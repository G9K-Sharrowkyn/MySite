import { readDb, updateDb } from '../services/jsonDb.js';
import { buildProfileFights } from '../utils/profileFights.js';
import { getRankInfo } from '../utils/rankSystem.js';

const resolveUserId = (user) => user?.id || user?._id;

const buildProfileResponse = (user, includeEmail = false, db = null) => {
  const profile = user.profile || {};
  const stats = user.stats || {};
  const rankInfo = getRankInfo(stats.points || 0);
  const description = profile.description || profile.bio || '';

  const fights = db
    ? buildProfileFights(db, resolveUserId(user))
    : user.fights || [];

  return {
    id: resolveUserId(user),
    username: user.username,
    ...(includeEmail ? { email: user.email } : {}),
    ...(includeEmail ? { timezone: user.timezone || 'UTC' } : {}),
    role: user.role || 'user',
    description,
    profilePicture: profile.profilePicture || profile.avatar || '',
    points: stats.points || 0,
    rank: rankInfo.rank,
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
    lastActive: profile.lastActive || user.updatedAt || new Date().toISOString(),
    profile: {
      ...profile,
      backgroundImage: profile.backgroundImage || ''
    }
  };
};

// @desc    Get current user's profile
// @route   GET /api/profile/me
// @access  Private
export const getMyProfile = async (req, res) => {
  try {
    const db = await readDb();
    const user = db.users.find((entry) => resolveUserId(entry) === req.user.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(buildProfileResponse(user, true, db));
  } catch (error) {
    console.error('Error fetching my profile:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/profile/:userId
// @access  Public
export const getProfile = async (req, res) => {
  try {
    const db = await readDb();
    const lookup = String(req.params.userId || '').toLowerCase();
    const user =
      db.users.find((entry) => resolveUserId(entry) === req.params.userId) ||
      db.users.find((entry) => (entry.username || '').toLowerCase() === lookup);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(buildProfileResponse(user, false, db));
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all user profiles (public data only)
// @route   GET /api/profile/all
// @access  Public
export const getAllProfiles = async (_req, res) => {
  try {
    const db = await readDb();
    const profiles = db.users.map((user) => ({
      id: resolveUserId(user),
      username: user.username
    }));
    res.json(profiles);
  } catch (error) {
    console.error('Error fetching all profiles:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/profile/me
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { description, profilePicture, selectedCharacters, backgroundImage } = req.body;

    let updatedUser;

    await updateDb((db) => {
      const user = db.users.find((entry) => resolveUserId(entry) === req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      user.profile = user.profile || {};

      if (description !== undefined) {
        user.profile.description = description;
        user.profile.bio = description;
      }

      if (profilePicture !== undefined) {
        user.profile.profilePicture = profilePicture;
        user.profile.avatar = profilePicture;
      }

      if (backgroundImage !== undefined) {
        user.profile.backgroundImage = backgroundImage;
      }

      if (selectedCharacters !== undefined) {
        user.profile.favoriteCharacters = selectedCharacters;
      }

      user.profile.lastActive = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      updatedUser = user;
      return db;
    });

    res.json({ msg: 'Profile updated', user: buildProfileResponse(updatedUser, true) });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    console.error('Error updating profile:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
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

    const db = await readDb();
    const q = query.toLowerCase();
    const users = db.users.filter((user) =>
      (user.username || '').toLowerCase().includes(q)
    );

    const result = users.map((user) => ({
      id: resolveUserId(user),
      username: user.username,
      profilePicture: user.profile?.profilePicture || user.profile?.avatar || ''
    }));

    res.json(result);
  } catch (error) {
    console.error('Error searching profiles:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user leaderboard
// @route   GET /api/profile/leaderboard
// @access  Public
export const getLeaderboard = async (_req, res) => {
  try {
    const db = await readDb();
    const users = db.users.map((user) => {
      const stats = user.stats || {};
      const rankInfo = getRankInfo(stats.points || 0);
      return {
        id: resolveUserId(user),
        username: user.username,
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

    const sorted = users.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.victories !== a.victories) return b.victories - a.victories;
      return a.username.localeCompare(b.username);
    });

    res.json(sorted);
  } catch (error) {
    console.error('Error fetching leaderboard:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
