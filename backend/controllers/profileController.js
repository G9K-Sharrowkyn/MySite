import { v4 as uuidv4 } from 'uuid';

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

    const db = req.db;
    await db.read();
    const user = db.data.users.find(u => u.id === req.user.id);

    if (!user) {
      console.error('User not found:', req.user.id);
      return res.status(404).json({ msg: 'Użytkownik nie znaleziony' });
    }

    // Normalize profile data structure
    const profile = user.profile || {};
    const stats = user.stats || profile.stats || {
      fightsWon: 0,
      fightsLost: 0,
      fightsDrawn: 0,
      fightsNoContest: 0,
      totalFights: 0,
      winRate: 0
    };
    
    const avatar = profile.avatar || profile.profilePicture || user.profilePicture || '';
    const description = profile.description || profile.bio || user.description || '';

    // Get user's selected characters
    const selectedCharacterIds = user.selectedCharacters || [];
    const characters = db.data.characters.filter(c => selectedCharacterIds.includes(c.id));
    
    // Get user's fights
    const fights = db.data.fights.filter(f => 
      f.player1Id === user.id || f.player2Id === user.id || 
      f.user1 === user.id || f.user2 === user.id
    );

    // Calculate fight statistics
    const victories = fights.filter(fight => 
      fight.winnerId === user.id || 
      (fight.winner && fight.winner === user.id)
    ).length;
    
    const losses = fights.filter(fight => 
      (fight.winnerId && fight.winnerId !== user.id) ||
      (fight.winner && fight.winner !== user.id && fight.winner !== 'draw')
    ).length;
    
    const draws = fights.filter(fight => 
      fight.winner === 'draw' || fight.result === 'draw'
    ).length;

    const totalFights = fights.length;
    const winRate = totalFights > 0 ? ((victories / totalFights) * 100).toFixed(1) : 0;
    const calculatedRank = calculateRank(victories, totalFights, parseFloat(winRate));
    const calculatedPoints = calculatePoints(victories, losses, draws, parseFloat(winRate));

    res.json({
      id: user.id,
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
  const db = req.db;
  await db.read();
  const user = db.data.users.find(u => u.id === req.params.userId);

  if (!user) {
    return res.status(404).json({ msg: 'Użytkownik nie znaleziony' });
  }

  // Normalize profile data structure
  const profile = user.profile || {};
  const stats = user.stats || profile.stats || {
    fightsWon: 0,
    fightsLost: 0,
    fightsDrawn: 0,
    fightsNoContest: 0,
    totalFights: 0,
    winRate: 0
  };
  
  const avatar = profile.avatar || profile.profilePicture || user.profilePicture || '';
  const description = profile.description || profile.bio || user.description || '';

  // Get user's selected characters
  const selectedCharacterIds = user.selectedCharacters || [];
  const characters = db.data.characters.filter(c => selectedCharacterIds.includes(c.id));
  
  // Get user's fights
  const fights = db.data.fights.filter(f => 
    f.player1Id === user.id || f.player2Id === user.id || 
    f.user1 === user.id || f.user2 === user.id
  );

  // Calculate fight statistics
  const victories = fights.filter(fight => 
    fight.winnerId === user.id || 
    (fight.winner && fight.winner === user.id)
  ).length;
  
  const losses = fights.filter(fight => 
    (fight.winnerId && fight.winnerId !== user.id) ||
    (fight.winner && fight.winner !== user.id && fight.winner !== 'draw')
  ).length;
  
  const draws = fights.filter(fight => 
    fight.winner === 'draw' || fight.result === 'draw'
  ).length;

  const totalFights = fights.length;
  const winRate = totalFights > 0 ? ((victories / totalFights) * 100).toFixed(1) : 0;
  const calculatedRank = calculateRank(victories, totalFights, parseFloat(winRate));
  const calculatedPoints = calculatePoints(victories, losses, draws, parseFloat(winRate));

  res.json({
    id: user.id,
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
};

// @desc    Get all user profiles (public data only)
// @route   GET /api/profile/all
// @access  Public
export const getAllProfiles = async (req, res) => {
  const db = req.db;
  await db.read();
  const users = db.data.users.map(user => ({
    id: user.id,
    username: user.username,
  }));
  res.json(users);
};

// @desc    Update user profile
// @route   PUT /api/profile/me
// @access  Private
export const updateProfile = async (req, res) => {
  const { description, profilePicture, selectedCharacters } = req.body;
  const db = req.db;
  await db.read();

  const userIndex = db.data.users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ msg: 'Użytkownik nie znaleziony' });
  }

  // Initialize profile object if it doesn't exist
  if (!db.data.users[userIndex].profile) {
    db.data.users[userIndex].profile = {
      bio: '',
      avatar: '',
      favoriteCharacters: [],
      joinDate: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };
  }

  // Update profile fields
  if (description !== undefined) {
    db.data.users[userIndex].profile.description = description;
    db.data.users[userIndex].profile.bio = description; // Keep both for compatibility
  }
  
  if (profilePicture !== undefined) {
    db.data.users[userIndex].profile.avatar = profilePicture;
    db.data.users[userIndex].profile.profilePicture = profilePicture; // Keep both for compatibility
  }
  
  if (selectedCharacters !== undefined) {
    db.data.users[userIndex].selectedCharacters = selectedCharacters;
    db.data.users[userIndex].profile.favoriteCharacters = selectedCharacters;
  }

  // Update last active timestamp
  db.data.users[userIndex].profile.lastActive = new Date().toISOString();

  await db.write();
  res.json({ msg: 'Profil zaktualizowany', user: db.data.users[userIndex] });
};

// @desc    Search user profiles by username
// @route   GET /api/profile/search
// @access  Public
export const searchProfiles = async (req, res) => {
  const db = req.db;
  await db.read();
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ msg: 'Brak zapytania wyszukiwania' });
  }

  const filteredUsers = db.data.users.filter(user =>
    user.username.toLowerCase().includes(query.toLowerCase())
  ).map(user => ({
    id: user.id,
    username: user.username,
    profilePicture: user.profilePicture || '',
  }));

  res.json(filteredUsers);
};

// @desc    Get user leaderboard
// @route   GET /api/profile/leaderboard
// @access  Public
export const getLeaderboard = async (req, res) => {
  const db = req.db;
  await db.read();

  // Get all users and calculate their stats
  const usersWithStats = db.data.users.map(user => {
    const userFights = db.data.fights.filter(
      fight => fight.player1Id === user.id || fight.player2Id === user.id ||
               fight.user1 === user.id || fight.user2 === user.id
    );

    const victories = userFights.filter(fight => 
      fight.winnerId === user.id || 
      (fight.winner && fight.winner === user.id)
    ).length;

    const losses = userFights.filter(fight => 
      (fight.winnerId && fight.winnerId !== user.id) ||
      (fight.winner && fight.winner !== user.id && fight.winner !== 'draw')
    ).length;

    const draws = userFights.filter(fight => 
      fight.winner === 'draw' || fight.result === 'draw'
    ).length;

    const totalFights = userFights.length;
    const winRate = totalFights > 0 ? (victories / totalFights * 100).toFixed(1) : 0;
    
    const profile = user.profile || {};
    const avatar = profile.avatar || profile.profilePicture || user.profilePicture || '';
    const calculatedRank = calculateRank(victories, totalFights, parseFloat(winRate));
    const calculatedPoints = calculatePoints(victories, losses, draws, parseFloat(winRate));

    return {
      id: user.id,
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
  });

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
};