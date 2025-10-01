import User from '../models/User.js';
import Character from '../models/Character.js';
import Fight from '../models/Fight.js';

export const calculateRank = (victories, totalFights, winRate) => {
  // Base rank calculation on victories
  let baseRank = 'Rookie';
  if (victories >= 100) baseRank = 'Mythic';
  else if (victories >= 75) baseRank = 'Legend';
  else if (victories >= 50) baseRank = 'Grandmaster';
  else if (victories >= 35) baseRank = 'Master';
  else if (victories >= 20) baseRank = 'Champion';
  else if (victories >= 10) baseRank = 'Warrior';
  else if (victories >= 5) baseRank = 'Fighter';
  else if (victories >= 1) baseRank = 'Novice';

  // Bonus ranks for exceptional performance
  if (totalFights >= 20 && winRate >= 90) {
    const rankOrder = ['Rookie', 'Novice', 'Fighter', 'Warrior', 'Champion', 'Master', 'Grandmaster', 'Legend', 'Mythic'];
    const currentIndex = rankOrder.indexOf(baseRank);
    if (currentIndex < rankOrder.length - 1) {
      baseRank = rankOrder[currentIndex + 1];
    }
  }

  return baseRank;
};

const calculatePoints = (victories, losses, draws, winRate) => {
  let points = 0;
  points += victories * 10; // 10 points per victory
  points += draws * 3; // 3 points per draw
  points -= losses * 2; // -2 points per loss

  // Bonus points for high win rate
  if (winRate >= 80) points += victories * 5;
  else if (winRate >= 60) points += victories * 3;
  else if (winRate >= 40) points += victories * 1;

  return Math.max(0, points); // Never go below 0
};

// @desc    Get current user's profile
// @route   GET /api/profile/me
// @access  Private
export const getMyProfile = async (req, res) => {
  try {
    console.log('Get my profile request received:', {
      userId: req.user.id
    });

    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      console.error('User not found:', req.user.id);
      return res.status(404).json({ msg: 'Użytkownik nie znaleziony' });
    }

    // Normalize profile data structure
    const profile = user.profile || {};
    const stats = user.stats || {
      fightsWon: 0,
      fightsLost: 0,
      fightsDrawn: 0,
      fightsNoContest: 0,
      totalFights: 0,
      winRate: 0
    };

    const avatar = profile.avatar || profile.profilePicture || '';
    const description = profile.description || profile.bio || '';

    // Get user's selected characters
    const selectedCharacterIds = profile.favoriteCharacters || [];
    const characters = await Character.find({ _id: { $in: selectedCharacterIds } });

    // Get user's fights
    const fights = await Fight.find({
      $or: [
        { 'teamA.userId': user._id },
        { 'teamB.userId': user._id }
      ]
    });

    // Calculate fight statistics
    const victories = fights.filter(fight =>
      fight.winnerId && fight.winnerId.toString() === user._id.toString()
    ).length;

    const losses = fights.filter(fight =>
      fight.winnerId && fight.winnerId.toString() !== user._id.toString() && fight.result !== 'draw'
    ).length;

    const draws = fights.filter(fight =>
      fight.result === 'draw'
    ).length;

    const totalFights = fights.length;
    const winRate = totalFights > 0 ? ((victories / totalFights) * 100).toFixed(1) : 0;
    const calculatedRank = calculateRank(victories, totalFights, parseFloat(winRate));
    const calculatedPoints = calculatePoints(victories, losses, draws, parseFloat(winRate));

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      description,
      profilePicture: avatar,
      points: calculatedPoints,
      rank: calculatedRank,
      stats: {
        fightsWon: victories,
        fightsLost: losses,
        fightsDrawn: draws,
        fightsNoContest: stats.fightsNoContest || 0,
        totalFights,
        winRate: parseFloat(winRate)
      },
      characters,
      fights,
      joinDate: profile.joinDate || user.createdAt || new Date().toISOString(),
      lastActive: profile.lastActive || new Date().toISOString()
    });
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
    const user = await User.findById(req.params.userId).select('-password -email');

    if (!user) {
      return res.status(404).json({ msg: 'Użytkownik nie znaleziony' });
    }

    // Normalize profile data structure
    const profile = user.profile || {};
    const stats = user.stats || {
      fightsWon: 0,
      fightsLost: 0,
      fightsDrawn: 0,
      fightsNoContest: 0,
      totalFights: 0,
      winRate: 0
    };

    const avatar = profile.avatar || profile.profilePicture || '';
    const description = profile.description || profile.bio || '';

    // Get user's selected characters
    const selectedCharacterIds = profile.favoriteCharacters || [];
    const characters = await Character.find({ _id: { $in: selectedCharacterIds } });

    // Get user's fights
    const fights = await Fight.find({
      $or: [
        { 'teamA.userId': user._id },
        { 'teamB.userId': user._id }
      ]
    });

    // Calculate fight statistics
    const victories = fights.filter(fight =>
      fight.winnerId && fight.winnerId.toString() === user._id.toString()
    ).length;

    const losses = fights.filter(fight =>
      fight.winnerId && fight.winnerId.toString() !== user._id.toString() && fight.result !== 'draw'
    ).length;

    const draws = fights.filter(fight =>
      fight.result === 'draw'
    ).length;

    const totalFights = fights.length;
    const winRate = totalFights > 0 ? ((victories / totalFights) * 100).toFixed(1) : 0;
    const calculatedRank = calculateRank(victories, totalFights, parseFloat(winRate));
    const calculatedPoints = calculatePoints(victories, losses, draws, parseFloat(winRate));

    res.json({
      id: user._id,
      username: user.username,
      description,
      profilePicture: avatar,
      points: calculatedPoints,
      rank: calculatedRank,
      stats: {
        fightsWon: victories,
        fightsLost: losses,
        fightsDrawn: draws,
        fightsNoContest: stats.fightsNoContest || 0,
        totalFights,
        winRate: parseFloat(winRate)
      },
      characters,
      fights,
      joinDate: profile.joinDate || user.createdAt || new Date().toISOString(),
      lastActive: profile.lastActive || new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching profile:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all user profiles (public data only)
// @route   GET /api/profile/all
// @access  Public
export const getAllProfiles = async (req, res) => {
  try {
    const users = await User.find().select('_id username');

    const profiles = users.map(user => ({
      id: user._id,
      username: user.username,
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
    const { description, profilePicture, selectedCharacters } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: 'Użytkownik nie znaleziony' });
    }

    // Initialize profile object if it doesn't exist
    if (!user.profile) {
      user.profile = {
        bio: '',
        avatar: '',
        favoriteCharacters: [],
        joinDate: new Date(),
        lastActive: new Date()
      };
    }

    // Update profile fields
    if (description !== undefined) {
      user.profile.description = description;
      user.profile.bio = description; // Keep both for compatibility
    }

    if (profilePicture !== undefined) {
      user.profile.avatar = profilePicture;
      user.profile.profilePicture = profilePicture; // Keep both for compatibility
    }

    if (selectedCharacters !== undefined) {
      user.profile.favoriteCharacters = selectedCharacters;
    }

    // Update last active timestamp
    user.profile.lastActive = new Date();

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({ msg: 'Profil zaktualizowany', user: userResponse });
  } catch (error) {
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
      return res.status(400).json({ msg: 'Brak zapytania wyszukiwania' });
    }

    const users = await User.find({
      username: { $regex: query, $options: 'i' }
    }).select('_id username profile.profilePicture profile.avatar');

    const filteredUsers = users.map(user => ({
      id: user._id,
      username: user.username,
      profilePicture: user.profile?.profilePicture || user.profile?.avatar || '',
    }));

    res.json(filteredUsers);
  } catch (error) {
    console.error('Error searching profiles:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user leaderboard
// @route   GET /api/profile/leaderboard
// @access  Public
export const getLeaderboard = async (req, res) => {
  try {
    const users = await User.find().select('-password -email');

    // Get all users and calculate their stats
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const userFights = await Fight.find({
        $or: [
          { 'teamA.userId': user._id },
          { 'teamB.userId': user._id }
        ]
      });

      const victories = userFights.filter(fight =>
        fight.winnerId && fight.winnerId.toString() === user._id.toString()
      ).length;

      const losses = userFights.filter(fight =>
        fight.winnerId && fight.winnerId.toString() !== user._id.toString() && fight.result !== 'draw'
      ).length;

      const draws = userFights.filter(fight =>
        fight.result === 'draw'
      ).length;

      const totalFights = userFights.length;
      const winRate = totalFights > 0 ? (victories / totalFights * 100).toFixed(1) : 0;

      const profile = user.profile || {};
      const avatar = profile.avatar || profile.profilePicture || '';
      const calculatedRank = calculateRank(victories, totalFights, parseFloat(winRate));
      const calculatedPoints = calculatePoints(victories, losses, draws, parseFloat(winRate));

      return {
        id: user._id,
        username: user.username,
        profilePicture: avatar,
        victories,
        losses,
        draws,
        totalFights,
        winRate: parseFloat(winRate),
        rank: calculatedRank,
        points: calculatedPoints
      };
    }));

    // Sort users by points (descending), then by victories (descending), then by username (ascending)
    const sortedUsers = usersWithStats.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      if (b.victories !== a.victories) {
        return b.victories - a.victories;
      }
      return a.username.localeCompare(b.username);
    });

    res.json(sortedUsers);
  } catch (error) {
    console.error('Error fetching leaderboard:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
