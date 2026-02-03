import { v4 as uuidv4 } from 'uuid';
import { readDb, nicknameChangeLogsRepo, usersRepo, withDb } from '../repositories/index.js';
import { buildProfileFights } from '../utils/profileFights.js';
import { getRankInfo } from '../utils/rankSystem.js';
import { getUserDisplayName, normalizeDisplayName } from '../utils/userDisplayName.js';

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
    displayName: getUserDisplayName(user),
    ...(includeEmail ? { email: user.email } : {}),
    ...(includeEmail ? { emailVerified: Boolean(user.emailVerified) } : {}),
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
    const user = await usersRepo.findOne(
      (entry) => resolveUserId(entry) === req.user.id,
      { db }
    );

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
      (await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.params.userId,
        { db }
      )) ||
      (await usersRepo.findOne(
        (entry) => (entry.username || '').toLowerCase() === lookup,
        { db }
      ));

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
    const users = await usersRepo.getAll();
    const profiles = users.map((user) => ({
      id: resolveUserId(user),
      username: user.username,
      displayName: getUserDisplayName(user)
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

    let updatedUser;
    await withDb(async (db) => {
      updatedUser = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.user.id,
        { db }
      );
      if (!updatedUser) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      updatedUser.profile = updatedUser.profile || {};
      const previousDisplayName = getUserDisplayName(updatedUser);

      if (description !== undefined) {
        updatedUser.profile.description = description;
        updatedUser.profile.bio = description;
      }

      if (profilePicture !== undefined) {
        updatedUser.profile.profilePicture = profilePicture;
        updatedUser.profile.avatar = profilePicture;
      }

      if (backgroundImage !== undefined) {
        updatedUser.profile.backgroundImage = backgroundImage;
      }

      if (selectedCharacters !== undefined) {
        updatedUser.profile.favoriteCharacters = selectedCharacters;
      }

      if (normalizedDisplayName !== undefined) {
        updatedUser.profile.displayName = normalizedDisplayName;
      } else if (!updatedUser.profile.displayName) {
        updatedUser.profile.displayName = updatedUser.username;
      }

      const nextDisplayName = getUserDisplayName(updatedUser);
      const now = new Date().toISOString();
      updatedUser.profile.lastActive = now;
      updatedUser.updatedAt = now;

      if (nextDisplayName !== previousDisplayName) {
        await nicknameChangeLogsRepo.insert(
          {
            id: uuidv4(),
            userId: resolveUserId(updatedUser),
            username: updatedUser.username,
            previousDisplayName,
            nextDisplayName,
            changedAt: now
          },
          { db }
        );
      }

      return db;
    });

    if (!updatedUser) {
      const error = new Error('User not found');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    res.json({ msg: 'Profile updated', user: buildProfileResponse(updatedUser, true) });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    console.error('Error updating profile:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
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

    const logs = await nicknameChangeLogsRepo.getAll();
    const sorted = [...logs]
      .sort(
        (a, b) =>
          new Date(b.changedAt || 0).getTime() - new Date(a.changedAt || 0).getTime()
      )
      .slice(0, 200);
    res.json(sorted);
  } catch (error) {
    console.error('Error fetching nickname change logs:', error.message);
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

    const q = query.toLowerCase();
    const users = await usersRepo.filter((user) =>
      (user.username || '').toLowerCase().includes(q)
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user leaderboard
// @route   GET /api/profile/leaderboard
// @access  Public
export const getLeaderboard = async (_req, res) => {
  try {
    const users = (await usersRepo.getAll()).map((user) => {
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
