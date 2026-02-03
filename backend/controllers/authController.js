import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { usersRepo, withDb } from '../repositories/index.js';
import { applyDailyBonus } from '../utils/coinBonus.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

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
