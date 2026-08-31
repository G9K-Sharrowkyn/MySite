import express from 'express';
import bcrypt from 'bcryptjs';
import auth from '../middleware/auth.js';
import {
  commentsRepo,
  getRepository,
  moderatorActionLogsRepo,
  postsRepo,
  tournamentsRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { clearAuthCookie } from '../utils/authCookie.js';
import { getLegalConfig } from '../config/legalConfig.js';
import { removeManagedUploads } from '../utils/uploadFiles.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

const sanitizeAccountForExport = (user) => {
  const copy = structuredClone(user);
  [
    'password',
    'resetPasswordToken',
    'resetPasswordTokenHash',
    'resetPasswordExpiry',
    'tokenVersion'
  ].forEach((key) => delete copy[key]);
  return copy;
};

const participantMatches = (participant, userId) =>
  participant === userId ||
  participant?.id === userId ||
  participant?._id === userId ||
  participant?.userId === userId;

const normalizeFightVoteTeam = (value) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'draw' || raw === 'tie') return 'draw';
  if (['a', 'teama', 'team a', 'fighter1', 'fighterone'].includes(raw)) return '0';
  if (['b', 'teamb', 'team b', 'fighter2', 'fightertwo'].includes(raw)) return '1';
  return /^\d+$/.test(raw) ? String(Number(raw)) : null;
};

const removeUserFromPostInteractions = (post, userId) => {
  const next = {
    ...post,
    likes: (post.likes || []).filter((id) => id !== userId),
    reactions: (post.reactions || []).filter(
      (reaction) => reaction.userId !== userId
    )
  };

  if (next.poll?.votes?.voters) {
    next.poll = {
      ...next.poll,
      votes: {
        ...next.poll.votes,
        voters: next.poll.votes.voters.filter((vote) => vote.userId !== userId)
      }
    };
  }

  if (next.fight?.votes?.voters) {
    const voters = next.fight.votes.voters.filter((vote) => vote.userId !== userId);
    const teamCount = Math.max(
      Array.isArray(next.fight.teams) ? next.fight.teams.length : 0,
      Array.isArray(next.fight.votes.teams) ? next.fight.votes.teams.length : 0,
      2
    );
    const teams = new Array(teamCount).fill(0);
    let draw = 0;
    voters.forEach((vote) => {
      const normalizedTeam = normalizeFightVoteTeam(vote.team);
      if (normalizedTeam === 'draw') {
        draw += 1;
        return;
      }
      const index = Number.parseInt(normalizedTeam, 10);
      if (Number.isInteger(index) && index >= 0 && index < teams.length) {
        teams[index] += 1;
      }
    });
    next.fight = {
      ...next.fight,
      votes: {
        ...next.fight.votes,
        voters,
        teams,
        teamA: teams[0] || 0,
        teamB: teams[1] || 0,
        draw
      }
    };
  }

  return next;
};

const anonymizeTournamentPlayer = (player, userId) => {
  if (!participantMatches(player, userId)) return player;
  return {
    ...player,
    userId: null,
    id: null,
    _id: null,
    username: 'Deleted user',
    displayName: 'Deleted user',
    profilePicture: ''
  };
};

const removeUserFromTournament = (tournament, userId) => ({
  ...tournament,
  participants: (tournament.participants || []).filter(
    (participant) => !participantMatches(participant, userId)
  ),
  brackets: (tournament.brackets || []).map((round) => ({
    ...round,
    matches: (round.matches || []).map((match) => ({
      ...match,
      player1: anonymizeTournamentPlayer(match.player1, userId),
      player2: anonymizeTournamentPlayer(match.player2, userId),
      winner: anonymizeTournamentPlayer(match.winner, userId),
      voters: (match.voters || []).filter((vote) => vote.userId !== userId)
    }))
  })),
  winner: anonymizeTournamentPlayer(tournament.winner, userId)
});

const recordReferencesUser = (record, userId, username = '', email = '') => {
  if (!record || typeof record !== 'object') return false;
  const directKeys = [
    'userId',
    'authorId',
    'senderId',
    'recipientId',
    'createdBy',
    'submittedById',
    'fromUserId',
    'toUserId',
    'blockerId',
    'blockedId',
    'userId1',
    'userId2',
    'actorId',
    'targetUserId'
  ];
  if (directKeys.some((key) => record[key] === userId)) return true;
  if (
    username &&
    ['submittedBy', 'authorUsername', 'username'].some(
      (key) => String(record[key] || '').toLowerCase() === username.toLowerCase()
    )
  ) {
    return true;
  }
  if (
    email &&
    ['email', 'userEmail'].some(
      (key) => String(record[key] || '').toLowerCase() === email.toLowerCase()
    )
  ) {
    return true;
  }
  if ((record.participants || []).some((entry) => participantMatches(entry, userId))) {
    return true;
  }
  if ((record.members || []).some((entry) => participantMatches(entry, userId))) {
    return true;
  }
  return (
    record.team1?.userId === userId ||
    record.team2?.userId === userId ||
    record.owner?.userId === userId ||
    record.user?.id === userId ||
    record.user?._id === userId ||
    record.data?.userId === userId ||
    record.metadata?.userId === userId
  );
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildUserReferenceQuery = (userId, username = '', email = '') => {
  const clauses = [
    ...[
      'userId',
      'authorId',
      'senderId',
      'recipientId',
      'createdBy',
      'creatorId',
      'submittedById',
      'fromUserId',
      'toUserId',
      'blockerId',
      'blockedId',
      'userId1',
      'userId2',
      'actorId',
      'targetUserId',
      'participants',
      'participants.id',
      'participants._id',
      'participants.userId',
      'members',
      'members.id',
      'members._id',
      'members.userId',
      'team1.userId',
      'team2.userId',
      'owner.userId',
      'user.id',
      'user._id',
      'data.userId',
      'metadata.userId'
    ].map((path) => ({ [path]: userId }))
  ];
  if (username) {
    const usernameRegex = new RegExp(`^${escapeRegex(username)}$`, 'i');
    clauses.push(
      { submittedBy: usernameRegex },
      { authorUsername: usernameRegex },
      { username: usernameRegex }
    );
  }
  if (email) {
    const emailRegex = new RegExp(`^${escapeRegex(email)}$`, 'i');
    clauses.push({ email: emailRegex }, { userEmail: emailRegex });
  }
  return { $or: clauses };
};

const updateRecord = (repo, record, updater, context) => {
  const id = record?.id ?? record?._id;
  if (id === undefined || id === null) return Promise.resolve(undefined);
  return repo.updateById(
    id,
    updater,
    record?.id !== undefined ? 'id' : '_id',
    context
  );
};

const USER_EXPORT_COLLECTIONS = [
  'posts',
  'comments',
  'notifications',
  'messages',
  'chatMessages',
  'friendRequests',
  'friendships',
  'blocks',
  'divisionFights',
  'fights',
  'votes',
  'tournaments',
  'userBadges',
  'bets',
  'conversations',
  'coinTransactions',
  'storePurchases',
  'communityDiscussions',
  'pushSubscriptions',
  'legalConsents',
  'challengeProgress',
  'recommendationEvents',
  'characterSuggestions',
  'feedback',
  'nicknameChangeLogs',
  'moderatorActionLogs'
];

/**
 * Get Privacy Policy
 * @route GET /api/privacy/policy
 * @access Public
 */
router.get('/policy', (req, res) => {
  const legal = getLegalConfig();
  const privacyPolicy = {
    version: legal.policyVersion,
    lastUpdated: new Date('2026-07-28'),
    content: `
# Privacy Policy

## 1. Information We Collect
We collect information you provide directly to us, including:
- Email address and a one-way password hash (we do not store your plain password)
- Username and profile information
- User-generated content (posts, comments, votes, messages and reactions)
- Technical logs, security events and the device information sent with requests

## 2. How We Use Your Information
We use the information we collect to:
- Provide, maintain, and improve our services
- Process your transactions and manage your account
- Send you technical notices and support messages
- Operate requested features and diagnose reliability problems
- Detect and prevent fraud and abuse

## 3. Data Sharing and Disclosure
We do not sell your personal information. We disclose only what is necessary:
- To hosting, email, database and other processors used to operate the service
- If optional translation is enabled, text is sent to MyMemory only when you
  explicitly press a Translate button
- With your consent
- To comply with legal obligations
- To protect our rights and prevent fraud

## 4. Your Privacy Rights
Depending on the law that applies to you, you may have the right to:
- Access your personal data
- Correct inaccurate data
- Request deletion of your data
- Object to processing of your data
- Export your data in a portable format
- Withdraw consent at any time

## 5. Data Retention
Account and content data are retained while your account is active. Security logs,
backup copies and records required by law may be retained for a limited additional
period. You can export or delete your account from Account Settings.

## 6. Security
We use password hashing, access controls, encrypted transport, session revocation
and operational backups. No online service can guarantee absolute security.

## 7. Cookies
The authentication cookie is required to keep you signed in. Optional categories
are disabled until you select them in the consent dialog.

## 8. International Data Transfers
Your data may be transferred to and processed in countries other than your own.

## 9. Changes to This Policy
We may update this policy from time to time. We will notify you of significant changes.

## 10. Contact Us
The service operator is ${legal.operatorName}. For privacy requests, contact
${legal.privacyEmail || 'the privacy address configured by the operator before launch'}.
    `.trim()
  };

  res.json(privacyPolicy);
});

/**
 * Get Terms of Service
 * @route GET /api/privacy/terms
 * @access Public
 */
router.get('/terms', (req, res) => {
  const legal = getLegalConfig();
  const termsOfService = {
    version: legal.policyVersion,
    lastUpdated: new Date('2026-07-28'),
    content: `
# Terms of Service

## 1. Acceptance of Terms
By accessing and using this service, you accept and agree to be bound by these Terms of Service.

## 2. User Accounts
- You must be at least ${legal.minimumAge} years old, or older if local law requires it
- You are responsible for maintaining the security of your account
- You must not share your account credentials
- One person may not maintain multiple accounts

## 3. User Content
- You retain ownership of content you create
- You grant us a license to use, display, and distribute your content
- You must not post illegal, harmful, or offensive content
- We reserve the right to remove content that violates these terms

## 4. Acceptable Use
You agree not to:
- Violate any laws or regulations
- Infringe on intellectual property rights
- Harass, abuse, or harm others
- Spam or engage in unauthorized advertising
- Attempt to gain unauthorized access to the service

## 5. Intellectual Property
- The service and its content are protected by copyright and other laws
- You may not copy, modify, or distribute our content without permission

## 6. Termination
We reserve the right to suspend or terminate your account for violations of these terms.

## 7. Disclaimers
- The service is provided "as is" without warranties
- We are not liable for user-generated content
- We do not guarantee uninterrupted or error-free service

## 8. Limitation of Liability
We are not liable for any indirect, incidental, or consequential damages.

## 9. Governing Law
These terms are governed by the laws of ${legal.jurisdiction}, subject to
mandatory consumer protections that apply where you live.

## 10. Changes to Terms
We may modify these terms at any time. Continued use constitutes acceptance.

## 11. Contact
The service operator is ${legal.operatorName}. For questions, contact
${legal.supportEmail || 'the support address configured by the operator before launch'}.
    `.trim()
  };

  res.json(termsOfService);
});

/**
 * Get Cookie Policy
 * @route GET /api/privacy/cookies
 * @access Public
 */
router.get('/cookies', (req, res) => {
  const legal = getLegalConfig();
  const cookiePolicy = {
    version: legal.policyVersion,
    lastUpdated: new Date('2026-07-28'),
    content: `
# Cookie Policy

## What Are Cookies?
Cookies are small text files stored on your device when you visit our website.

## Types of Cookies We Use

### Essential Cookies
Required for the website to function properly:
- Authentication tokens
- Session management
- Security features

### Optional Analytics or Marketing
These categories remain disabled unless you enable them. If the operator later
configures a provider, this policy and the consent screen must identify it before
those tools are activated.

### Preference Cookies
Remember your settings and preferences:
- Language preferences
- Theme selections
- Display settings

## Third-Party Cookies
Infrastructure or payment providers may process request data when you use their
features. They are not permitted to use the authentication cookie as an advertising cookie.

## Managing Cookies
You can control cookies through your browser settings:
- Block all cookies
- Delete existing cookies
- Allow cookies from specific sites

## Consent
Your choice in the consent dialog controls optional categories. Rejecting optional
categories does not prevent use of the core service.

## Updates
We may update this cookie policy. Check this page periodically for changes.

## Contact
Questions about cookies? Contact ${legal.privacyEmail || 'the privacy address configured by the operator before launch'}.
    `.trim()
  };

  res.json(cookiePolicy);
});

/**
 * Update cookie consent
 * @route POST /api/privacy/cookie-consent
 * @access Private
 */
router.post('/cookie-consent', auth, async (req, res) => {
  try {
    const { analytics, marketing, functional } = req.body;

    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(req.user.id, context);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      user.privacy = user.privacy || {};
      user.privacy.cookieConsent = {
        given: true,
        date: new Date().toISOString(),
        analytics: Boolean(analytics),
        marketing: Boolean(marketing),
        functional: functional !== false
      };
      user.updatedAt = new Date().toISOString();
      await usersRepo.updateById(user.id, () => user, context);
    });

    res.json({ msg: 'Cookie consent updated successfully' });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    console.error('Error updating cookie consent:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * Request data export (GDPR Right to Data Portability)
 * @route POST /api/privacy/export-data
 * @access Private
 */
router.post('/export-data', auth, async (req, res) => {
  try {
    const user = await usersRepo.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const userData = {
      account: sanitizeAccountForExport(user),
      data: Object.fromEntries(await Promise.all(
        USER_EXPORT_COLLECTIONS.map(async (collection) => [
          collection,
          (await getRepository(collection).findManyBy(
            buildUserReferenceQuery(req.user.id, user.username, user.email)
          )).filter((record) => recordReferencesUser(
            record,
            req.user.id,
            user.username,
            user.email
          ))
        ])
      )),
      exportDate: new Date().toISOString(),
      format: 'JSON'
    };

    res.json({
      msg: 'Data export prepared',
      data: userData
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * Request account deletion (GDPR Right to Erasure)
 * @route DELETE /api/privacy/delete-account
 * @access Private
 */
router.delete('/delete-account', auth, async (req, res) => {
  try {
    const { password, confirmation } = req.body;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({ msg: 'Please type DELETE to confirm account deletion' });
    }

    const deletionDate = new Date().toISOString();
    let profileUploads = [];

    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(req.user.id, context);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const requiresPassword = user.authProvider !== 'google';
      const isMatch =
        !requiresPassword || await bcrypt.compare(password || '', user.password || '');
      if (!isMatch) {
        const error = new Error('Incorrect password');
        error.code = 'BAD_PASSWORD';
        throw error;
      }

      const userId = req.user.id;
      profileUploads = [
        user.profile?.profilePicture,
        user.profile?.avatar,
        user.profile?.backgroundImage
      ];
      const authoredPosts = await postsRepo.findManyBy(
        { authorId: userId },
        { projection: { id: 1 } },
        context
      );
      const authoredPostIds = authoredPosts
        .map((post) => post.id ?? post._id)
        .filter((id) => id !== undefined && id !== null);

      const interactedPosts = await postsRepo.findManyBy({
        $or: [
          { likes: userId },
          { 'reactions.userId': userId },
          { 'poll.votes.voters.userId': userId },
          { 'fight.votes.voters.userId': userId }
        ]
      }, {}, context);
      for (const post of interactedPosts) {
        if (post.authorId !== userId) {
          await updateRecord(
            postsRepo,
            post,
            (draft) => removeUserFromPostInteractions(draft, userId),
            context
          );
        }
      }

      await commentsRepo.removeManyBy({
        $or: [
          { authorId: userId },
          ...(authoredPostIds.length ? [{ postId: { $in: authoredPostIds } }] : [])
        ]
      }, context);
      const interactedComments = await commentsRepo.findManyBy({
        $or: [
          { likedBy: userId },
          { 'reactions.userId': userId }
        ]
      }, {}, context);
      for (const comment of interactedComments) {
        await updateRecord(commentsRepo, comment, (draft) => ({
          ...draft,
          likedBy: (draft.likedBy || []).filter((id) => id !== userId),
          reactions: (draft.reactions || []).filter(
            (reaction) => reaction.userId !== userId
          )
        }), context);
      }
      await postsRepo.removeManyBy({ authorId: userId }, context);

      const removeReferencedRecords = [
        'notifications',
        'messages',
        'chatMessages',
        'friendRequests',
        'friendships',
        'blocks',
        'divisionFights',
        'fights',
        'votes',
        'userBadges',
        'bets',
        'conversations',
        'coinTransactions',
        'storePurchases',
        'communityDiscussions',
        'pushSubscriptions',
        'legalConsents',
        'challengeProgress',
        'recommendationEvents',
        'characterSuggestions',
        'feedback',
        'nicknameChangeLogs',
        'emailVerificationTokens',
        'authChallenges'
      ];
      const referenceQuery = buildUserReferenceQuery(
        userId,
        user.username,
        user.email
      );
      for (const collection of removeReferencedRecords) {
        await getRepository(collection).removeManyBy(referenceQuery, context);
      }

      await tournamentsRepo.removeManyBy({
        $or: [{ createdBy: userId }, { creatorId: userId }]
      }, context);
      const affectedTournaments = await tournamentsRepo.findManyBy({
        $or: [
          { participants: userId },
          { 'participants.id': userId },
          { 'participants._id': userId },
          { 'participants.userId': userId },
          { 'brackets.matches.player1.userId': userId },
          { 'brackets.matches.player2.userId': userId },
          { 'brackets.matches.winner.userId': userId },
          { 'winner.userId': userId }
        ]
      }, {}, context);
      for (const tournament of affectedTournaments) {
        await updateRecord(
          tournamentsRepo,
          tournament,
          (draft) => removeUserFromTournament(draft, userId),
          context
        );
      }

      const moderationEntries = await moderatorActionLogsRepo.findManyBy({
        $or: [{ actorId: userId }, { targetUserId: userId }]
      }, {}, context);
      for (const entry of moderationEntries) {
        await updateRecord(moderatorActionLogsRepo, entry, (draft) => ({
          ...draft,
          actorId: draft.actorId === userId ? null : draft.actorId,
          actorUsername:
            draft.actorId === userId ? 'Deleted user' : draft.actorUsername,
          targetUserId:
            draft.targetUserId === userId ? null : draft.targetUserId,
          personalDataErasedAt: deletionDate
        }), context);
      }
      await usersRepo.removeById(userId, context);
    });

    await removeManagedUploads(profileUploads).catch((error) => {
      console.warn('Account data was erased, but a profile upload could not be removed:', error.message);
    });
    clearAuthCookie(res);
    res.json({
      msg: 'Account and associated personal data were deleted.',
      deletionDate
    });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (error.code === 'BAD_PASSWORD') {
      return res.status(400).json({ msg: 'Incorrect password' });
    }
    console.error('Error deleting account:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * Get user's privacy settings
 * @route GET /api/privacy/settings
 * @access Private
 */
router.get('/settings', auth, async (req, res) => {
  try {
    const user = await usersRepo.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json({
      cookieConsent: user.privacy?.cookieConsent || {},
      notifications: user.notificationSettings || {},
      accountStatus: {
        deleted: user.privacy?.accountDeleted || false
      }
    });
  } catch (error) {
    console.error('Error getting privacy settings:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * Update privacy settings
 * @route PUT /api/privacy/settings
 * @access Private
 */
router.put('/settings', auth, async (req, res) => {
  try {
    const { dataProcessing, marketing, profiling } = req.body;

    await withRepositoryTransaction(async (context) => {
      const user = await usersRepo.findById(req.user.id, context);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      user.privacy = user.privacy || {};
      user.privacy.settings = {
        dataProcessing: dataProcessing !== false,
        marketing: Boolean(marketing),
        profiling: Boolean(profiling),
        updatedAt: new Date().toISOString()
      };
      user.updatedAt = new Date().toISOString();
      await usersRepo.updateById(user.id, () => user, context);
    });

    res.json({ msg: 'Privacy settings updated successfully' });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    console.error('Error updating privacy settings:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;

