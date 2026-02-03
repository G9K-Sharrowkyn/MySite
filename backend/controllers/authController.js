import bcrypt from 'bcryptjs';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { usersRepo, withDb } from '../repositories/index.js';
import { applyDailyBonus } from '../utils/coinBonus.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
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

const resolveGoogleClientIds = () =>
  (process.env.GOOGLE_CLIENT_ID || '')
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
  role: user.role,
  profile: user.profile || {},
  coins: user.coins || {}
});

const buildNewUser = ({ username, email, passwordHash }) => {
  const now = new Date();

  return {
    id: uuidv4(),
    username,
    email,
    password: passwordHash,
    role: 'user',
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
    });

    const payload = buildAuthPayload(newUser);

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) {
          throw err;
        }

        res.status(201).json({
          token,
          userId: newUser.id,
          user: buildAuthResponse(newUser)
        });
      }
    );
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

    const now = new Date().toISOString();
    let responseUser = user;
    await withDb(async (db) => {
      const storedUser = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === resolveUserId(user),
        { db }
      );
      if (storedUser) {
        applyDailyBonus(db, storedUser);
        storedUser.profile = storedUser.profile || {};
        storedUser.profile.lastActive = now;
        storedUser.updatedAt = now;
        responseUser = storedUser;
      }
      return db;
    });

    const payload = buildAuthPayload(user);

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) {
          throw err;
        }

        res.json({
          token,
          userId: resolveUserId(user),
          user: buildAuthResponse(responseUser)
        });
      }
    );
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
        user.authProvider = user.authProvider || 'local';

        applyDailyBonus(db, user);
        user.profile.lastActive = now;
        user.updatedAt = now;
        responseUser = user;
        return users;
      }, { db });

      return db;
    });

    const payload = buildAuthPayload(responseUser);

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) {
          throw err;
        }

        res.status(created ? 201 : 200).json({
          token,
          userId: resolveUserId(responseUser),
          user: buildAuthResponse(responseUser),
          isNewUser: created
        });
      }
    );
  } catch (error) {
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
