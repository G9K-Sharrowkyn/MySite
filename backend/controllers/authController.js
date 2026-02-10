import bcrypt from 'bcryptjs';
import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  authChallengesRepo,
  emailVerificationTokensRepo,
  usersRepo,
  withDb
} from '../repositories/index.js';
import { applyDailyActivityBonus } from '../utils/coinBonus.js';
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
  sendTwoFactorCodeEmail
} from '../services/emailService.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';

const isJwtConfigured = () =>
  typeof process.env.JWT_SECRET === 'string' &&
  process.env.JWT_SECRET.length > 0;

const ensureAuthAvailability = (res) => {
  if (!isJwtConfigured()) {
    res.status(500).json({
      msg: 'Authentication is unavailable. The server is missing a JWT secret.'
    });
    return false;
  }
  return true;
};

const normalizeEmail = (email) => email.trim().toLowerCase();
const DEFAULT_AVATAR = '/logo192.png';
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TWO_FACTOR_TTL_MS = 10 * 60 * 1000;
const PRIMARY_ADMIN_EMAIL = normalizeEmail(process.env.PRIMARY_ADMIN_EMAIL || '');
const requireEmailVerification =
  process.env.REQUIRE_EMAIL_VERIFICATION === 'true' ||
  process.env.NODE_ENV === 'production';

const isStaffRole = (role) => role === 'admin' || role === 'moderator';
const isPrimaryAdminAccount = (user) =>
  Boolean(user) &&
  Boolean(PRIMARY_ADMIN_EMAIL) &&
  normalizeEmail(user.email || '') === PRIMARY_ADMIN_EMAIL;

const getActiveSuspension = (user) => {
  const suspension = user?.moderation?.suspension;
  if (!suspension?.active) return null;
  if (suspension.type === 'time' && suspension.until) {
    if (new Date(suspension.until).getTime() <= Date.now()) {
      return null;
    }
  }
  return suspension;
};

const ensurePrimaryAdminRole = (user) => {
  if (!user || !PRIMARY_ADMIN_EMAIL) return false;
  if (normalizeEmail(user.email || '') !== PRIMARY_ADMIN_EMAIL) return false;
  if (user.role === 'admin') return false;
  user.role = 'admin';
  user.updatedAt = new Date().toISOString();
  return true;
};

const createTwoFactorCode = () =>
  `${Math.floor(100000 + Math.random() * 900000)}`;

const createTwoFactorCodeDigest = (code) =>
  crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(String(code || ''))
    .digest('hex');

const createSignedChallengeToken = (challengeId, metadata = {}) =>
  jwt.sign(
    { purpose: '2fa_challenge', challengeId, ...metadata },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

const verifySignedChallengeToken = (token) => {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload?.purpose !== '2fa_challenge' || !payload?.challengeId) {
    const error = new Error('Invalid challenge token.');
    error.code = 'INVALID_CHALLENGE_TOKEN';
    throw error;
  }
  return payload;
};

const resolveGoogleClientIds = () =>
  (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_IDS ||
    process.env.REACT_APP_GOOGLE_CLIENT_ID ||
    ''
  )
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const isGoogleAuthConfigured = () => resolveGoogleClientIds().length > 0;

const needsDefaultAvatar = (value) =>
  typeof value !== 'string' ||
  value.trim().length === 0 ||
  value.trim() === DEFAULT_AVATAR ||
  value.trim() === '/placeholder-avatar.png';

const sanitizeUsernameSource = (value) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);

const generateUniqueUsername = (users, { name, email }) => {
  const emailPart = sanitizeUsernameSource((email || '').split('@')[0]);
  const namePart = sanitizeUsernameSource(name);
  const base = namePart || emailPart || `user${Date.now().toString().slice(-5)}`;
  const existing = new Set(
    users.map((user) => (user.username || '').toLowerCase())
  );

  if (!existing.has(base)) {
    return base;
  }

  for (let i = 1; i <= 9999; i += 1) {
    const candidate = `${base}${i}`;
    if (!existing.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `${base}${Date.now().toString().slice(-4)}`;
};

const verifyGoogleIdToken = async (idToken) => {
  const allowedClientIds = resolveGoogleClientIds();
  const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
    params: { id_token: idToken },
    timeout: 10000
  });

  const payload = response?.data || {};
  const audience = payload.aud || payload.azp;
  const isEmailVerified =
    payload.email_verified === true || payload.email_verified === 'true';

  if (!payload.email || !isEmailVerified) {
    throw new Error('Google account email is missing or not verified.');
  }

  if (!audience || !allowedClientIds.includes(audience)) {
    throw new Error('Google token audience is invalid.');
  }

  return payload;
};

const resolveUserId = (user) => user.id || user._id;

const buildAuthPayload = (user) => ({
  user: {
    id: resolveUserId(user),
    role: user.role
  }
});

const buildAuthResponse = (user) => ({
  id: resolveUserId(user),
  username: user.username,
  displayName: getUserDisplayName(user),
  email: user.email,
  emailVerified: Boolean(user.emailVerified),
  role: user.role,
  profile: user.profile || {},
  coins: user.coins || {},
  suspension: getActiveSuspension(user)
});

const ensureEmailVerificationToken = async (db, userId, email) => {
  const existing = await emailVerificationTokensRepo.findOne(
    (entry) =>
      entry.userId === userId &&
      entry.usedAt == null &&
      Number(entry.expiresAt || 0) > Date.now(),
    { db }
  );

  const token = existing?.token || uuidv4();
  if (!existing) {
    await emailVerificationTokensRepo.insert(
      {
        id: uuidv4(),
        userId,
        email,
        token,
        createdAt: Date.now(),
        expiresAt: Date.now() + VERIFICATION_TOKEN_TTL_MS,
        usedAt: null
      },
      { db }
    );
  }

  return token;
};

const issueStaffTwoFactorChallenge = async (db, user) => {
  const userId = resolveUserId(user);
  const email = normalizeEmail(user.email || '');
  if (!userId || !email) {
    const error = new Error('Cannot create 2FA challenge: user is missing id or email.');
    error.code = 'INVALID_STAFF_ACCOUNT';
    throw error;
  }
  const code = createTwoFactorCode();
  const challengeId = uuidv4();
  const signedChallengeToken = createSignedChallengeToken(challengeId, {
    userId,
    email,
    codeDigest: createTwoFactorCodeDigest(code)
  });

  // Keep previous pending challenges to avoid invalidating a code/token pair
  // when a user accidentally triggers login twice. Clean up only stale entries.
  await authChallengesRepo.updateAll(
    (challenges) =>
      challenges.filter((entry) => {
        if (entry.purpose !== 'login_2fa') {
          return true;
        }
        const expired = Number(entry.expiresAt || 0) <= Date.now();
        const consumed = entry.usedAt != null;
        return !(expired || consumed);
      }),
    { db }
  );

  await authChallengesRepo.insert(
    {
      id: challengeId,
      userId,
      email,
      purpose: 'login_2fa',
      token: signedChallengeToken,
      code,
      createdAt: Date.now(),
      expiresAt: Date.now() + TWO_FACTOR_TTL_MS,
      usedAt: null
    },
    { db }
  );

  await sendTwoFactorCodeEmail(email, code);

  return signedChallengeToken;
};

const finalizeLoginResponse = async (res, user) => {
  const userId = resolveUserId(user);
  const payload = buildAuthPayload(user);
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

  return res.json({
    token,
    userId,
    user: buildAuthResponse(user)
  });
};

const buildNewUser = ({ username, email, passwordHash }) => {
  const now = new Date();

  return {
    id: uuidv4(),
    username,
    email,
    emailVerified: false,
    password: passwordHash,
    role: 'user',
    authProvider: 'local',
    profile: {
      displayName: username,
      bio: '',
      profilePicture: '/logo192.png',
      favoriteCharacters: [],
      joinDate: now.toISOString(),
      lastActive: now.toISOString(),
      avatar: '/logo192.png',
      description: '',
      backgroundImage: ''
    },
    stats: {
      fightsWon: 0,
      fightsLost: 0,
      fightsDrawn: 0,
      fightsNoContest: 0,
      totalFights: 0,
      winRate: 0,
      rank: 'Mortal',
      points: 0,
      level: 1,
      experience: 0,
      // Rozdzielone statystyki: oficjalne (dywizje) vs nieoficjalne (społeczność)
      officialStats: {
        fightsWon: 0,
        fightsLost: 0,
        fightsDrawn: 0,
        winRate: 0
      },
      unofficialStats: {
        fightsWon: 0,
        fightsLost: 0,
        fightsDrawn: 0,
        winRate: 0
      }
    },
    activity: {
      postsCreated: 0,
      commentsPosted: 0,
      reactionsGiven: 0,
      likesReceived: 0,
      tournamentsWon: 0,
      tournamentsParticipated: 0
    },
    coins: {
      balance: 1000,
      totalEarned: 1000,
      totalSpent: 0,
      lastBonusDate: now.toISOString()
    },
    achievements: [],
    divisions: {},
    customBackgrounds: [],
    backgroundSlots: 1,
    notificationSettings: {
      fightResults: true,
      divisionFights: true,
      reactions: true,
      comments: true,
      mentions: true,
      pushEnabled: false
    },
    tagPreferences: [],
    privacy: {
      cookieConsent: {
        given: false,
        analytics: false,
        marketing: false,
        functional: true
      },
      settings: {
        dataProcessing: true,
        marketing: false,
        profiling: false
      },
      accountDeleted: false
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
};

export const register = async (req, res) => {
  if (!ensureAuthAvailability(res)) {
    return;
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ msg: 'Missing required fields.' });
  }

  const trimmedUsername = username.trim();
  const normalizedEmail = normalizeEmail(email);

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = buildNewUser({
      username: trimmedUsername,
      email: normalizedEmail,
      passwordHash: hashedPassword
    });

    let verificationToken = null;
    await withDb(async (db) => {
      await usersRepo.updateAll((users) => {
        const emailTaken = users.some(
          (user) => normalizeEmail(user.email || '') === normalizedEmail
        );
        if (emailTaken) {
          const error = new Error('Email is already in use.');
          error.code = 'EMAIL_IN_USE';
          throw error;
        }

        const usernameTaken = users.some(
          (user) => (user.username || '').toLowerCase() === trimmedUsername.toLowerCase()
        );
        if (usernameTaken) {
          const error = new Error('Username is already taken.');
          error.code = 'USERNAME_TAKEN';
          throw error;
        }

        users.push(newUser);
        return users;
      }, { db });

      verificationToken = await ensureEmailVerificationToken(
        db,
        newUser.id,
        normalizedEmail
      );

      return db;
    });

    let verificationEmailSent = true;
    try {
      await sendEmailVerificationEmail(normalizedEmail, verificationToken);
    } catch (emailError) {
      verificationEmailSent = false;
      console.error('Registration verification email error:', emailError);
    }

    if (requireEmailVerification && verificationEmailSent) {
      return res.status(201).json({
        msg: 'Account created. Please verify your email before logging in.',
        requiresEmailVerification: true,
        email: normalizedEmail
      });
    }

    if (requireEmailVerification && !verificationEmailSent) {
      return res.status(503).json({
        msg: 'Account created, but verification email could not be sent right now. Please try again later.',
        requiresEmailVerification: true,
        email: normalizedEmail
      });
    }

    const payload = buildAuthPayload(newUser);
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    res.status(201).json({
      token,
      userId: newUser.id,
      user: buildAuthResponse(newUser),
      requiresEmailVerification: false,
      verificationEmailSent
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error.code === 'EMAIL_IN_USE' || error.code === 'USERNAME_TAKEN') {
      return res.status(400).json({ msg: error.message });
    }

    res.status(500).json({ msg: 'Server error. ' + error.message });
  }
};

export const login = async (req, res) => {
  if (!ensureAuthAvailability(res)) {
    return;
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: 'Email and password are required.' });
  }

  try {
    const normalizedEmail = normalizeEmail(email);
    const user = await usersRepo.findOne(
      (entry) => normalizeEmail(entry.email || '') === normalizedEmail
    );

    if (!user) {
      return res.status(400).json({ msg: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid email or password.' });
    }

    const suspension = getActiveSuspension(user);
    if (suspension) {
      return res.status(403).json({
        msg: suspension.type === 'time'
          ? `Account suspended until ${suspension.until}.`
          : 'Account suspended.',
        suspended: true,
        suspension
      });
    }

    if (requireEmailVerification && !user.emailVerified) {
      await withDb(async (db) => {
        const token = await ensureEmailVerificationToken(
          db,
          resolveUserId(user),
          normalizedEmail
        );
        await sendEmailVerificationEmail(normalizedEmail, token);
        return db;
      });

      return res.status(403).json({
        msg: 'Please verify your email before logging in.',
        requiresEmailVerification: true,
        email: normalizedEmail
      });
    }

    const now = new Date().toISOString();
    let responseUser = user;
    let challengeToken = null;
    await withDb(async (db) => {
      const storedUser = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === resolveUserId(user),
        { db }
      );
      if (storedUser) {
        if (!storedUser.id) {
          storedUser.id = uuidv4();
        }
        ensurePrimaryAdminRole(storedUser);
        applyDailyActivityBonus(db, storedUser, 'login', 50);
        storedUser.profile = storedUser.profile || {};
        storedUser.profile.lastActive = now;
        storedUser.updatedAt = now;
        responseUser = storedUser;

        if (isStaffRole(storedUser.role) && !isPrimaryAdminAccount(storedUser)) {
          challengeToken = await issueStaffTwoFactorChallenge(db, storedUser);
        }
      }
      return db;
    });

    if (challengeToken) {
      return res.status(202).json({
        requires2FA: true,
        challengeToken,
        msg: 'Security code sent to your email.'
      });
    }

    return finalizeLoginResponse(res, responseUser);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ msg: 'Server error. ' + error.message });
  }
};

export const loginWithGoogle = async (req, res) => {
  if (!ensureAuthAvailability(res)) {
    return;
  }

    if (!isGoogleAuthConfigured()) {
    return res.status(500).json({
      msg: 'Google sign-in is not configured on the server.'
    });
  }

  const idToken = req.body?.idToken;
  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ msg: 'Google ID token is required.' });
  }

  try {
    const googlePayload = await verifyGoogleIdToken(idToken);
    const normalizedEmail = normalizeEmail(googlePayload.email);
    const now = new Date().toISOString();
    let responseUser = null;
    let created = false;

    await withDb(async (db) => {
      await usersRepo.updateAll((users) => {
        let user = users.find(
          (entry) => normalizeEmail(entry.email || '') === normalizedEmail
        );

        if (!user) {
          const username = generateUniqueUsername(users, {
            name: googlePayload.name,
            email: normalizedEmail
          });
          const randomPassword = uuidv4();
          const salt = bcrypt.genSaltSync(10);
          const hashedPassword = bcrypt.hashSync(randomPassword, salt);
          user = buildNewUser({
            username,
            email: normalizedEmail,
            passwordHash: hashedPassword
          });
          user.profile.displayName =
            (googlePayload.name || '').trim() || username;
          user.authProvider = 'google';
          user.googleId = googlePayload.sub || '';
          user.emailVerified = true;
          created = true;
          users.push(user);
        }

        user.profile = user.profile || {};
        if (!user.profile.displayName) {
          user.profile.displayName = user.username;
        }
        if (googlePayload.picture && needsDefaultAvatar(user.profile.profilePicture)) {
          user.profile.profilePicture = googlePayload.picture;
          user.profile.avatar = googlePayload.picture;
        } else {
          if (needsDefaultAvatar(user.profile.profilePicture)) {
            user.profile.profilePicture = DEFAULT_AVATAR;
          }
          if (needsDefaultAvatar(user.profile.avatar)) {
            user.profile.avatar = user.profile.profilePicture || DEFAULT_AVATAR;
          }
        }

        if (!user.googleId && googlePayload.sub) {
          user.googleId = googlePayload.sub;
        }
        user.authProvider = 'google';
        user.emailVerified = true;
        if (!user.id) {
          user.id = uuidv4();
        }
        ensurePrimaryAdminRole(user);

        const suspension = getActiveSuspension(user);
        if (suspension) {
          const error = new Error(
            suspension.type === 'time'
              ? `Account suspended until ${suspension.until}.`
              : 'Account suspended.'
          );
          error.code = 'ACCOUNT_SUSPENDED';
          error.details = suspension;
          throw error;
        }

        applyDailyActivityBonus(db, user, 'login', 50);
        user.profile.lastActive = now;
        user.updatedAt = now;
        responseUser = user;
        return users;
      }, { db });

      return db;
    });

    if (isStaffRole(responseUser.role) && !isPrimaryAdminAccount(responseUser)) {
      const challengeToken = await withDb(async (db) => {
        const storedUser = await usersRepo.findOne(
          (entry) => resolveUserId(entry) === resolveUserId(responseUser),
          { db }
        );
        if (!storedUser) {
          throw new Error('User not found for challenge');
        }
        if (!storedUser.id) {
          storedUser.id = uuidv4();
        }
        ensurePrimaryAdminRole(storedUser);
        return issueStaffTwoFactorChallenge(db, storedUser);
      });

      return res.status(202).json({
        requires2FA: true,
        challengeToken,
        isNewUser: created,
        msg: 'Security code sent to your email.'
      });
    }

    const payload = buildAuthPayload(responseUser);
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    return res.status(created ? 201 : 200).json({
      token,
      userId: resolveUserId(responseUser),
      user: buildAuthResponse(responseUser),
      isNewUser: created
    });
  } catch (error) {
    if (error.code === 'ACCOUNT_SUSPENDED') {
      return res.status(403).json({
        msg: error.message,
        suspended: true,
        suspension: error.details || null
      });
    }
    console.error('Google login error:', error?.response?.data || error);
    res.status(400).json({
      msg: 'Google sign-in failed. Please try again.'
    });
  }
};

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = resolveUserId(req.user);

  try {
    const user = await usersRepo.findOne(
      (u) => resolveUserId(u) === userId
    );

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await usersRepo.updateById(userId, (storedUser) => {
      storedUser.password = hashedPassword;
      return storedUser;
    });

    res.json({ msg: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @route   PUT /api/auth/update-timezone
// @desc    Update user timezone
// @access  Private
export const updateTimezone = async (req, res) => {
  const { timezone } = req.body;
  const userId = resolveUserId(req.user);

  try {
    const user = await usersRepo.findOne(
      (u) => resolveUserId(u) === userId
    );

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Update timezone
    await usersRepo.updateById(userId, (storedUser) => {
      storedUser.timezone = timezone;
      return storedUser;
    });

    res.json({ msg: 'Timezone updated successfully', timezone });
  } catch (error) {
    console.error('Update timezone error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @route   POST /api/auth/forgot-password
// @desc    Request password reset email
// @access  Public
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const normalizedEmail = normalizeEmail(email);
    const user = await usersRepo.findOne(
      (u) => normalizeEmail(u.email) === normalizedEmail
    );

    // Always return success message (security best practice - don't reveal if email exists)
    if (!user) {
      return res.json({ msg: 'If that email is registered, a reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = uuidv4();
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

    // Save reset token to user
    await usersRepo.updateById(resolveUserId(user), (storedUser) => {
      storedUser.resetPasswordToken = resetToken;
      storedUser.resetPasswordExpiry = resetTokenExpiry;
      return storedUser;
    });

    // Send email
    await sendPasswordResetEmail(user.email, resetToken);

    res.json({ msg: 'If that email is registered, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ msg: 'Error sending reset email' });
  }
};

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await usersRepo.findOne(
      (u) => u.resetPasswordToken === token && u.resetPasswordExpiry > Date.now()
    );

    if (!user) {
      return res.status(400).json({ msg: 'Invalid or expired reset token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    await usersRepo.updateById(resolveUserId(user), (storedUser) => {
      storedUser.password = hashedPassword;
      storedUser.resetPasswordToken = null;
      storedUser.resetPasswordExpiry = null;
      return storedUser;
    });

    res.json({ msg: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ msg: 'Error resetting password' });
  }
};

// @route   POST /api/auth/verify-email
// @desc    Verify account email by token
// @access  Public
export const verifyEmail = async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) {
    return res.status(400).json({ msg: 'Verification token is required.' });
  }

  try {
    let verifiedUser = null;
    await withDb(async (db) => {
      const verificationRecord = await emailVerificationTokensRepo.findOne(
        (entry) =>
          entry.token === token &&
          entry.usedAt == null &&
          Number(entry.expiresAt || 0) > Date.now(),
        { db }
      );

      if (!verificationRecord) {
        const error = new Error('Invalid or expired verification token.');
        error.code = 'INVALID_TOKEN';
        throw error;
      }

      verificationRecord.usedAt = Date.now();
      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === verificationRecord.userId,
        { db }
      );
      if (!user) {
        const error = new Error('User not found.');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      user.emailVerified = true;
      user.updatedAt = new Date().toISOString();
      verifiedUser = user;
      return db;
    });

    return res.json({
      msg: 'Email verified successfully.',
      email: verifiedUser?.email || null
    });
  } catch (error) {
    if (error.code === 'INVALID_TOKEN') {
      return res.status(400).json({ msg: error.message });
    }
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: error.message });
    }
    console.error('Email verification error:', error);
    return res.status(500).json({ msg: 'Server error.' });
  }
};

// @route   POST /api/auth/resend-verification
// @desc    Resend email verification link
// @access  Public
export const resendVerificationEmail = async (req, res) => {
  const rawEmail = String(req.body?.email || '').trim();
  if (!rawEmail) {
    return res.status(400).json({ msg: 'Email is required.' });
  }

  const normalizedEmail = normalizeEmail(rawEmail);
  try {
    let token = null;
    await withDb(async (db) => {
      const user = await usersRepo.findOne(
        (entry) => normalizeEmail(entry.email || '') === normalizedEmail,
        { db }
      );

      if (!user || user.emailVerified) {
        return db;
      }

      token = await ensureEmailVerificationToken(
        db,
        resolveUserId(user),
        normalizedEmail
      );
      return db;
    });

    if (token) {
      await sendEmailVerificationEmail(normalizedEmail, token);
    }

    return res.json({
      msg: 'If that account exists and is unverified, a new verification email has been sent.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ msg: 'Server error.' });
  }
};

// @route   POST /api/auth/verify-2fa
// @desc    Complete staff login with one-time code
// @access  Public
export const verifyLoginTwoFactor = async (req, res) => {
  if (!ensureAuthAvailability(res)) {
    return;
  }

  const challengeToken = String(req.body?.challengeToken || '').trim();
  const code = String(req.body?.code || '').trim();
  if (!challengeToken || !code) {
    return res.status(400).json({ msg: 'Challenge token and code are required.' });
  }

  try {
    let challengePayload = null;
    let challengeId = null;
    let challengeTokenSignatureValid = false;
    try {
      challengePayload = verifySignedChallengeToken(challengeToken);
      challengeId = challengePayload.challengeId;
      challengeTokenSignatureValid = true;
    } catch (tokenError) {
      if (
        tokenError?.name !== 'TokenExpiredError' &&
        tokenError?.name !== 'JsonWebTokenError' &&
        tokenError?.name !== 'NotBeforeError'
      ) {
        throw tokenError;
      }
    }

    let authenticatedUser = null;
    await withDb(async (db) => {
      const challenge = await authChallengesRepo.findOne(
        (entry) =>
          (
            (challengeTokenSignatureValid && entry.id === challengeId) ||
            entry.token === challengeToken
          ) &&
          entry.purpose === 'login_2fa',
        { db }
      );
      if (!challenge) {
        // Fallback for cases where a previously issued challenge entry is not
        // persisted but the signed token is still valid.
        if (
          challengeTokenSignatureValid &&
          challengePayload?.codeDigest &&
          createTwoFactorCodeDigest(code) === challengePayload.codeDigest
        ) {
          let fallbackUser = null;
          if (challengePayload?.userId) {
            fallbackUser = await usersRepo.findOne(
              (entry) => resolveUserId(entry) === challengePayload.userId,
              { db }
            );
          }
          if (!fallbackUser && challengePayload?.email) {
            fallbackUser = await usersRepo.findOne(
              (entry) => normalizeEmail(entry.email || '') === normalizeEmail(challengePayload.email || ''),
              { db }
            );
          }
          if (!fallbackUser) {
            const error = new Error('User not found.');
            error.code = 'USER_NOT_FOUND';
            throw error;
          }

          if (!fallbackUser.id) {
            fallbackUser.id = uuidv4();
          }
          ensurePrimaryAdminRole(fallbackUser);
          fallbackUser.profile = fallbackUser.profile || {};
          fallbackUser.profile.lastActive = new Date().toISOString();
          fallbackUser.updatedAt = new Date().toISOString();
          applyDailyActivityBonus(db, fallbackUser, 'login', 50);
          authenticatedUser = fallbackUser;
          return db;
        }

        const error = new Error('Challenge not found.');
        error.code = 'CHALLENGE_NOT_FOUND';
        throw error;
      }
      if (challenge.usedAt != null) {
        const error = new Error('Security code already used. Please sign in again.');
        error.code = 'CHALLENGE_ALREADY_USED';
        throw error;
      }
      if (Number(challenge.expiresAt || 0) <= Date.now()) {
        const error = new Error('Challenge expired.');
        error.code = 'CHALLENGE_EXPIRED';
        throw error;
      }
      if (challenge.code !== code) {
        const error = new Error('Invalid security code.');
        error.code = 'INVALID_CODE';
        throw error;
      }

      challenge.usedAt = Date.now();
      // Resolve by challenge userId first to avoid matching a different account
      // that happens to share the same email (e.g. legacy local + google account).
      let user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === challenge.userId,
        { db }
      );
      if (!user) {
        user = await usersRepo.findOne(
          (entry) => normalizeEmail(entry.email || '') === normalizeEmail(challenge.email || ''),
          { db }
        );
      }
      if (!user) {
        const error = new Error('User not found.');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      if (requireEmailVerification && !user.emailVerified) {
        const error = new Error('Email must be verified before login.');
        error.code = 'EMAIL_NOT_VERIFIED';
        throw error;
      }

      if (!user.id) {
        user.id = uuidv4();
      }
      ensurePrimaryAdminRole(user);
      const suspension = getActiveSuspension(user);
      if (suspension) {
        const error = new Error(
          suspension.type === 'time'
            ? `Account suspended until ${suspension.until}.`
            : 'Account suspended.'
        );
        error.code = 'ACCOUNT_SUSPENDED';
        throw error;
      }
      user.profile = user.profile || {};
      user.profile.lastActive = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      applyDailyActivityBonus(db, user, 'login', 50);
      authenticatedUser = user;
      return db;
    });

    return finalizeLoginResponse(res, authenticatedUser);
  } catch (error) {
    if (
      error?.name === 'TokenExpiredError' ||
      error?.name === 'JsonWebTokenError' ||
      error?.name === 'NotBeforeError'
    ) {
      return res.status(400).json({ msg: 'Invalid or expired challenge token.' });
    }
    if (
      error.code === 'INVALID_CHALLENGE_TOKEN' ||
      error.code === 'CHALLENGE_NOT_FOUND' ||
      error.code === 'CHALLENGE_EXPIRED' ||
      error.code === 'INVALID_CODE' ||
      error.code === 'CHALLENGE_ALREADY_USED'
    ) {
      return res.status(400).json({ msg: error.message });
    }
    if (error.code === 'EMAIL_NOT_VERIFIED') {
      return res.status(403).json({ msg: error.message, requiresEmailVerification: true });
    }
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: error.message });
    }
    if (error.code === 'ACCOUNT_SUSPENDED') {
      return res.status(403).json({ msg: error.message, suspended: true });
    }
    console.error('2FA verification error:', error);
    return res.status(500).json({ msg: 'Server error.' });
  }
};
