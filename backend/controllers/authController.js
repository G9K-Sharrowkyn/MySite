import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { readDb, updateDb } from '../services/jsonDb.js';

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
      profilePicture: '',
      favoriteCharacters: [],
      joinDate: now.toISOString(),
      lastActive: now.toISOString(),
      avatar: '',
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
      rank: 'Rookie',
      points: 0,
      level: 1,
      experience: 0
    },
    activity: {
      postsCreated: 0,
      commentsPosted: 0,
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

    await updateDb((db) => {
      const emailTaken = db.users.some(
        (user) => normalizeEmail(user.email || '') === normalizedEmail
      );
      if (emailTaken) {
        const error = new Error('Email is already in use.');
        error.code = 'EMAIL_IN_USE';
        throw error;
      }

      const usernameTaken = db.users.some(
        (user) => (user.username || '').toLowerCase() === trimmedUsername.toLowerCase()
      );
      if (usernameTaken) {
        const error = new Error('Username is already taken.');
        error.code = 'USERNAME_TAKEN';
        throw error;
      }

      db.users.push(newUser);
      return db;
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
    const db = await readDb();
    const normalizedEmail = normalizeEmail(email);
    const user = db.users.find(
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
    await updateDb((data) => {
      const storedUser = data.users.find(
        (entry) => resolveUserId(entry) === resolveUserId(user)
      );
      if (storedUser) {
        storedUser.profile = storedUser.profile || {};
        storedUser.profile.lastActive = now;
        storedUser.updatedAt = now;
      }
      return data;
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
          user: buildAuthResponse(user)
        });
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ msg: 'Server error. ' + error.message });
  }
};
