const { v4: uuidv4 } = require('uuid');

const calculateRank = victories => {
  const rawRank = Math.floor((Math.sqrt(8 * victories + 1) - 1) / 2);
  if (rawRank < 1) return 1;
  if (rawRank > 100) return 100;
  return rawRank;
};
exports.calculateRank = calculateRank;

// @desc    Get user profile
// @route   GET /api/profile/:userId
// @access  Public
exports.getProfile = async (req, res) => {
  const db = req.db;
  await db.read();
  const user = db.data.users.find(u => u.id === req.params.userId);

  if (!user) {
    return res.status(404).json({ msg: 'Użytkownik nie znaleziony' });
  }

  // Zwracamy tylko publiczne dane profilu
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    description: user.description || '',
    profilePicture: user.profilePicture || '',
    characters: db.data.characters.filter(c => c.ownerId === user.id),
    fights: db.data.fights.filter(f => f.user1 === user.id || f.user2 === user.id),
    points: user.points || 0,
    rank: calculateRank(user.stats?.fightsWon || 0),
  });
};

// @desc    Get all user profiles (public data only)
// @route   GET /api/profile/all
// @access  Public
exports.getAllProfiles = async (req, res) => {
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
exports.updateProfile = async (req, res) => {
  const { description, profilePicture, selectedCharacters } = req.body;
  const db = req.db;
  await db.read();

  const userIndex = db.data.users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ msg: 'Użytkownik nie znaleziony' });
  }

  db.data.users[userIndex].description = description || db.data.users[userIndex].description;
  db.data.users[userIndex].profilePicture = profilePicture || db.data.users[userIndex].profilePicture;
  db.data.users[userIndex].selectedCharacters = selectedCharacters || db.data.users[userIndex].selectedCharacters;

  await db.write();
  res.json({ msg: 'Profil zaktualizowany', user: db.data.users[userIndex] });
};

// @desc    Search user profiles by username
// @route   GET /api/profile/search
// @access  Public
exports.searchProfiles = async (req, res) => {
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
exports.getLeaderboard = async (req, res) => {
  const db = req.db;
  await db.read();

  const leaderboard = db.data.users
    .map(user => ({
      id: user.id,
      username: user.username,
      points: user.points || 0,
      profilePicture: user.profilePicture || '',
      rank: calculateRank(user.stats?.fightsWon || 0),
    }))
    .sort((a, b) => b.points - a.points); // Sortuj malejąco według punktów

  res.json(leaderboard);
};