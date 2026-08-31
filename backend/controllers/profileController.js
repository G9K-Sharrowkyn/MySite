import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import {
  blocksRepo,
  divisionFightsRepo,
  fightsRepo,
  nicknameChangeLogsRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';
import { buildProfileFights } from '../utils/profileFights.js';
import { isPrimaryAdminEmail } from '../utils/primaryAdmin.js';
import { getRankInfo } from '../utils/rankSystem.js';
import { getUserDisplayName, normalizeDisplayName } from '../utils/userDisplayName.js';
import { logModerationAction } from '../utils/moderationAudit.js';
import { parsePagination } from '../utils/pagination.js';

const resolveUserId = (user) => user?.id || user?._id;

const loadProfileFightDb = async (userId) => {
  const [divisionFights, fights] = await Promise.all([
    divisionFightsRepo.findManyBy({
      $or: [{ 'team1.userId': userId }, { 'team2.userId': userId }]
    }),
    fightsRepo.findManyBy({
      $or: [
        { 'participants.userId': userId },
        { 'participants.id': userId },
        { userId },
        { createdBy: userId }
      ]
    })
  ]);
  return { divisionFights, fights };
};

const getRoleRankOverride = (role) => {
  const safe = String(role || '').toLowerCase();
  if (safe === 'admin') return 'Overwatcher';
  if (safe === 'moderator') return 'Seer';
  return null;
};

const buildProfileResponse = (user, includeEmail = false, db = null) => {
  const profile = user.profile || {};
  const stats = user.stats || {};
  const rankInfo = getRankInfo(stats.points || 0);
  const roleRank = getRoleRankOverride(user.role);
  const description = profile.description || profile.bio || '';

  const fights = db
    ? buildProfileFights(db, resolveUserId(user))
    : user.fights || [];

  const effectiveRole = isPrimaryAdminEmail(user.email) ? 'admin' : (user.role || 'user');
  const publicProfile = {
    displayName: profile.displayName || user.username || '',
    bio: profile.bio || '',
    description: profile.description || '',
    profilePicture: profile.profilePicture || profile.avatar || '',
    avatar: profile.avatar || profile.profilePicture || '',
    backgroundImage: profile.backgroundImage || '',
    favoriteCharacters: profile.favoriteCharacters || [],
    location: profile.location || '',
    favoriteUniverse: profile.favoriteUniverse || '',
    website: profile.website || '',
    interests: profile.interests || [],
    joinDate: profile.joinDate || user.createdAt || null
  };

  return {
    id: resolveUserId(user),
    username: user.username,
    displayName: getUserDisplayName(user),
    ...(includeEmail ? { email: user.email } : {}),
    ...(includeEmail ? { emailVerified: Boolean(user.emailVerified) } : {}),
    ...(includeEmail ? { timezone: user.timezone || 'UTC' } : {}),
    role: effectiveRole,
    description,
    profilePicture: profile.profilePicture || profile.avatar || '',
    points: stats.points || 0,
    rank: roleRank || rankInfo.rank,
    stats: {
      fightsWon: stats.fightsWon || 0,
      fightsLost: stats.fightsLost || 0,
      fightsDrawn: stats.fightsDrawn || 0,
      fightsNoContest: stats.fightsNoContest || 0,
      totalFights: stats.totalFights || 0,
      winRate: stats.winRate || 0,
      officialStats: stats.officialStats || {
        fightsWon: 0,
        fightsLost: 0,
        fightsDrawn: 0,
        winRate: 0
      },
      unofficialStats: stats.unofficialStats || {
        fightsWon: 0,
        fightsLost: 0,
        fightsDrawn: 0,
        winRate: 0
      }
    },
    divisions: user.divisions || {},
    fights,
    joinDate: profile.joinDate || user.createdAt || new Date().toISOString(),
    ...(includeEmail
      ? {
          lastActive:
            profile.lastActive || user.updatedAt || new Date().toISOString()
        }
      : {}),
    profile: includeEmail
      ? { ...profile, backgroundImage: profile.backgroundImage || '' }
      : publicProfile
  };
};

// @desc    Get current user's profile
// @route   GET /api/profile/me
// @access  Private
export const getMyProfile = async (req, res) => {
  try {
    const [user, fightDb] = await Promise.all([
      usersRepo.findById(req.user.id),
      loadProfileFightDb(req.user.id)
    ]);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(buildProfileResponse(user, true, fightDb));
  } catch (error) {
    console.error('Error fetching my profile:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user profile
// @route   GET /api/profile/:userId
// @access  Public
export const getProfile = async (req, res) => {
  try {
    const lookup = String(req.params.userId || '');
    const user =
      (await usersRepo.findById(lookup)) ||
      (await usersRepo.findOneBy(
        { username: lookup },
        { collation: { locale: 'en', strength: 2 } }
      ));

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Hard block: if viewer is authenticated and either side blocked the other, deny.
    const viewerId = req.user?.id;
    if (viewerId) {
      const targetId = resolveUserId(user);
      const blocked = await blocksRepo.findOneBy({
        $or: [
          { blockerId: viewerId, blockedId: targetId },
          { blockerId: targetId, blockedId: viewerId }
        ]
      });
      if (blocked) {
        return res.status(403).json({ msg: 'Access denied' });
      }
    }

    const fightDb = await loadProfileFightDb(resolveUserId(user));
    res.json(buildProfileResponse(user, false, fightDb));
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all user profiles (public data only)
// @route   GET /api/profile/all
// @access  Public
export const getAllProfiles = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100
    });
    const users = await usersRepo.findManyBy(
      {},
      { sort: { username: 1 }, skip: (page - 1) * limit, limit }
    );
    const profiles = users.map((user) => ({
      id: resolveUserId(user),
      username: user.username,
      displayName: getUserDisplayName(user)
    }));
    res.json(profiles);
  } catch (error) {
    console.error('Error fetching all profiles:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/profile/me
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const {
      description,
      profilePicture,
      selectedCharacters,
      backgroundImage,
      displayName
    } = req.body;
    const normalizedDisplayName =
      displayName === undefined ? undefined : normalizeDisplayName(displayName);

    if (normalizedDisplayName !== undefined) {
      if (!normalizedDisplayName) {
        return res.status(400).json({ msg: 'Display name cannot be empty' });
      }
      if (normalizedDisplayName.length > 60) {
        return res
          .status(400)
          .json({ msg: 'Display name cannot exceed 60 characters' });
      }
    }

    const updatedUser = await withRepositoryTransaction(async (context) => {
      let nicknameLog = null;
      const stored = await usersRepo.updateById(req.user.id, (storedUser) => {
        storedUser.profile = storedUser.profile || {};
        const previousDisplayName = getUserDisplayName(storedUser);

        if (description !== undefined) {
          storedUser.profile.description = description;
          storedUser.profile.bio = description;
        }

        if (profilePicture !== undefined) {
          storedUser.profile.profilePicture = profilePicture;
          storedUser.profile.avatar = profilePicture;
        }

        if (backgroundImage !== undefined) {
          storedUser.profile.backgroundImage = backgroundImage;
        }

        if (selectedCharacters !== undefined) {
          storedUser.profile.favoriteCharacters = selectedCharacters;
        }

        if (normalizedDisplayName !== undefined) {
          storedUser.profile.displayName = normalizedDisplayName;
        } else if (!storedUser.profile.displayName) {
          storedUser.profile.displayName = storedUser.username;
        }

        const nextDisplayName = getUserDisplayName(storedUser);
        const now = new Date().toISOString();
        storedUser.profile.lastActive = now;
        storedUser.updatedAt = now;

        if (nextDisplayName !== previousDisplayName) {
          nicknameLog = {
            id: uuidv4(),
            userId: resolveUserId(storedUser),
            username: storedUser.username,
            previousDisplayName,
            nextDisplayName,
            changedAt: now
          };
        }
        return storedUser;
      }, context);

      if (!stored) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      if (nicknameLog) {
        await nicknameChangeLogsRepo.insert(nicknameLog, context);
      }
      return stored;
    });

    res.json({ msg: 'Profile updated', user: buildProfileResponse(updatedUser, true) });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    console.error('Error updating profile:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get nickname change log (admin/moderator)
// @route   GET /api/profile/nickname-logs
// @access  Private (admin/moderator)
export const getNicknameChangeLogs = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const sorted = await nicknameChangeLogsRepo.findManyBy(
      {},
      { sort: { changedAt: -1 }, limit: 200 }
    );
    res.json(sorted);
  } catch (error) {
    console.error('Error fetching nickname change logs:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Change another user's role (admin only, password confirmation required)
// @route   POST /api/profile/:userId/role
// @access  Private (admin)
export const changeUserRole = async (req, res) => {
  const actorId = req.user?.id;
  const targetUserId = String(req.params.userId || '');
  const nextRole = String(req.body?.role || '').trim();
  const adminPassword = String(req.body?.adminPassword || '');

  if (!actorId) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }

  if (!['moderator', 'user'].includes(nextRole)) {
    return res.status(400).json({ msg: 'Role must be moderator or user.' });
  }

  if (!adminPassword) {
    return res.status(400).json({ msg: 'Admin password is required.' });
  }

  try {
    let updatedUser = null;
    await withRepositoryTransaction(async (context) => {
      const adminUser = await usersRepo.findById(actorId, context);

      if (!adminUser || adminUser.role !== 'admin') {
        const error = new Error('Only admins can change user roles.');
        error.code = 'FORBIDDEN';
        throw error;
      }

      const passwordOk = await bcrypt.compare(adminPassword, adminUser.password || '');
      if (!passwordOk) {
        const error = new Error('Admin password is incorrect.');
        error.code = 'BAD_PASSWORD';
        throw error;
      }

      const targetUser =
        (await usersRepo.findById(targetUserId, context)) ||
        (await usersRepo.findOneBy(
          { username: targetUserId },
          { collation: { locale: 'en', strength: 2 } },
          context
        ));

      if (!targetUser) {
        const error = new Error('Target user not found.');
        error.code = 'TARGET_NOT_FOUND';
        throw error;
      }

      if (resolveUserId(targetUser) === actorId) {
        const error = new Error('Admin role cannot be changed this way.');
        error.code = 'SELF_CHANGE_FORBIDDEN';
        throw error;
      }

      if (targetUser.role === 'admin') {
        const error = new Error('Cannot change role of another admin.');
        error.code = 'TARGET_ADMIN_FORBIDDEN';
        throw error;
      }

      const previousRole = targetUser.role || 'user';
      if (previousRole === nextRole) {
        updatedUser = targetUser;
        return;
      }

      updatedUser = await usersRepo.updateById(resolveUserId(targetUser), (storedUser) => {
        storedUser.role = nextRole;
        storedUser.updatedAt = new Date().toISOString();
        return storedUser;
      }, context);

      await logModerationAction({
        db: context,
        actor: adminUser,
        action: 'user.role_change',
        targetType: 'user',
        targetId: resolveUserId(targetUser),
        details: {
          targetUsername: targetUser.username || '',
          previousRole,
          nextRole
        }
      });

    });

    return res.json({
      msg: 'User role updated successfully.',
      user: {
        id: resolveUserId(updatedUser),
        username: updatedUser.username,
        role: updatedUser.role
      }
    });
  } catch (error) {
    if (error.code === 'FORBIDDEN') {
      return res.status(403).json({ msg: error.message });
    }
    if (error.code === 'BAD_PASSWORD') {
      return res.status(401).json({ msg: error.message });
    }
    if (
      error.code === 'TARGET_NOT_FOUND' ||
      error.code === 'SELF_CHANGE_FORBIDDEN' ||
      error.code === 'TARGET_ADMIN_FORBIDDEN'
    ) {
      return res.status(400).json({ msg: error.message });
    }
    console.error('Error changing user role:', error);
    return res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Search user profiles by username
// @route   GET /api/profile/search
// @access  Public
export const searchProfiles = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ msg: 'Query is required' });
    }

    const escapedQuery = String(query)
      .trim()
      .slice(0, 80)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escapedQuery) {
      return res.status(400).json({ msg: 'Query is required' });
    }
    const users = await usersRepo.findManyBy(
      {
        $or: [
          { username: { $regex: escapedQuery, $options: 'i' } },
          { 'profile.displayName': { $regex: escapedQuery, $options: 'i' } }
        ]
      },
      { sort: { username: 1 }, limit: 20 }
    );

    const result = users.map((user) => ({
      id: resolveUserId(user),
      username: user.username,
      displayName: getUserDisplayName(user),
      profilePicture: user.profile?.profilePicture || user.profile?.avatar || ''
    }));

    res.json(result);
  } catch (error) {
    console.error('Error searching profiles:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user leaderboard
// @route   GET /api/profile/leaderboard
// @access  Public
export const getLeaderboard = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100
    });
    const leaderboardUsers = await usersRepo.findManyBy(
      {},
      {
        sort: { 'stats.points': -1, 'stats.fightsWon': -1, username: 1 },
        skip: (page - 1) * limit,
        limit
      }
    );
    const users = leaderboardUsers.map((user) => {
      const stats = user.stats || {};
      const rankInfo = getRankInfo(stats.points || 0);
      return {
        id: resolveUserId(user),
        username: user.username,
        displayName: getUserDisplayName(user),
        profilePicture: user.profile?.profilePicture || user.profile?.avatar || '',
        victories: stats.fightsWon || 0,
        losses: stats.fightsLost || 0,
        draws: stats.fightsDrawn || 0,
        totalFights: stats.totalFights || 0,
        winRate: stats.winRate || 0,
        rank: rankInfo.rank,
        points: stats.points || 0
      };
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching leaderboard:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};
