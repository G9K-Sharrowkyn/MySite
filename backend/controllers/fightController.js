import { v4 as uuidv4 } from 'uuid';
import { checkFightBadges } from '../routes/badges.js';

// @desc    Create a new fight
// @route   POST /api/fights
// @access  Private (Moderator only for main fights, users for feed fights)
export const createFight = async (req, res) => {
  const { 
    title, 
    description, 
    fighter1, 
    fighter2, 
    fighter1Image, 
    fighter2Image,
    fighter1UserId,
    fighter2UserId,
    category, 
    type = 'feed', // 'main' or 'feed'
    endDate,
    isContender = false
  } = req.body;
  
  const db = req.db;
  await db.read();

  // Check if user is moderator for main fights
  const user = db.data.users.find(u => u.id === req.user.id);
  if (type === 'main' && user.role !== 'moderator') {
    return res.status(403).json({ msg: 'Tylko moderatorzy mogą tworzyć główne walki' });
  }

  const newFight = {
    id: uuidv4(),
    title,
    description,
    fighter1: type === 'main' ? { name: fighter1, userId: fighter1UserId } : fighter1,
    fighter2: type === 'main' ? { name: fighter2, userId: fighter2UserId } : fighter2,
    fighter1Image: fighter1Image || 'https://via.placeholder.com/150',
    fighter2Image: fighter2Image || 'https://via.placeholder.com/150',
    category,
    type, // 'main' or 'feed'
    createdBy: req.user.id,
    createdByUsername: user.username,
    createdAt: new Date().toISOString(),
    endDate: endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    status: 'active', // 'active', 'ended', 'cancelled'
    votes: {
      fighter1: 0,
      fighter2: 0,
      total: 0
    },
    winner: null,
    comments: [],
    isContender
  };

  db.data.fights.push(newFight);
  await db.write();

  res.json({ msg: 'Walka została utworzona', fight: newFight });
};

// @desc    Get all fights
// @route   GET /api/fights
// @access  Public
export const getFights = async (req, res) => {
  const { type, category, status, page = 1, limit = 10 } = req.query;
  const db = req.db;
  await db.read();

  let fights = db.data.fights;

  // Filter by type
  if (type) {
    fights = fights.filter(fight => fight.type === type);
  }

  // Filter by category
  if (category) {
    fights = fights.filter(fight => fight.category === category);
  }

  // Filter by status
  if (status) {
    fights = fights.filter(fight => fight.status === status);
  }

  // Sort by creation date (newest first)
  fights.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedFights = fights.slice(startIndex, endIndex);

  // Add creator info and vote counts
  const fightsWithDetails = paginatedFights.map(fight => {
    const creator = db.data.users.find(u => u.id === fight.createdBy);
    const totalVotes = db.data.votes.filter(v => v.fightId === fight.id).length;
    const fighter1Votes = db.data.votes.filter(v => v.fightId === fight.id && v.choice === 'fighter1').length;
    const fighter2Votes = db.data.votes.filter(v => v.fightId === fight.id && v.choice === 'fighter2').length;

    return {
      ...fight,
      createdByUsername: creator ? creator.username : 'Nieznany',
      votes: {
        fighter1: fighter1Votes,
        fighter2: fighter2Votes,
        total: totalVotes
      }
    };
  });

  res.json({
    fights: fightsWithDetails,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(fights.length / limit),
      totalFights: fights.length,
      hasNext: endIndex < fights.length,
      hasPrev: startIndex > 0
    }
  });
};

// @desc    Get single fight
// @route   GET /api/fights/:id
// @access  Public
export const getFight = async (req, res) => {
  const db = req.db;
  await db.read();

  const fight = db.data.fights.find(f => f.id === req.params.id);
  if (!fight) {
    return res.status(404).json({ msg: 'Walka nie znaleziona' });
  }

  // Get creator info
  const creator = db.data.users.find(u => u.id === fight.createdBy);
  
  // Get vote counts
  const totalVotes = db.data.votes.filter(v => v.fightId === fight.id).length;
  const fighter1Votes = db.data.votes.filter(v => v.fightId === fight.id && v.choice === 'fighter1').length;
  const fighter2Votes = db.data.votes.filter(v => v.fightId === fight.id && v.choice === 'fighter2').length;

  // Get comments
  const comments = db.data.comments.filter(c => c.fightId === fight.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const fightWithDetails = {
    ...fight,
    createdByUsername: creator ? creator.username : 'Nieznany',
    votes: {
      fighter1: fighter1Votes,
      fighter2: fighter2Votes,
      total: totalVotes
    },
    comments
  };

  res.json(fightWithDetails);
};

// @desc    Update fight (moderator only)
// @route   PUT /api/fights/:id
// @access  Private (Moderator only)
export const updateFight = async (req, res) => {
  const db = req.db;
  await db.read();

  const user = db.data.users.find(u => u.id === req.user.id);
  if (user.role !== 'moderator') {
    return res.status(403).json({ msg: 'Tylko moderatorzy mogą edytować walki' });
  }

  const fightIndex = db.data.fights.findIndex(f => f.id === req.params.id);
  if (fightIndex === -1) {
    return res.status(404).json({ msg: 'Walka nie znaleziona' });
  }

  const { title, description, status, winner, endDate, isContender } = req.body;

  if (title) db.data.fights[fightIndex].title = title;
  if (description) db.data.fights[fightIndex].description = description;
  if (status) db.data.fights[fightIndex].status = status;
  if (winner) db.data.fights[fightIndex].winner = winner;
  if (endDate) db.data.fights[fightIndex].endDate = endDate;
  if (isContender !== undefined) db.data.fights[fightIndex].isContender = isContender;

  db.data.fights[fightIndex].updatedAt = new Date().toISOString();

  await db.write();
  res.json({ msg: 'Walka zaktualizowana', fight: db.data.fights[fightIndex] });
};

// @desc    Delete fight (moderator only)
// @route   DELETE /api/fights/:id
// @access  Private (Moderator only)
export const deleteFight = async (req, res) => {
  const db = req.db;
  await db.read();

  const user = db.data.users.find(u => u.id === req.user.id);
  if (user.role !== 'moderator') {
    return res.status(403).json({ msg: 'Tylko moderatorzy mogą usuwać walki' });
  }

  const fightIndex = db.data.fights.findIndex(f => f.id === req.params.id);
  if (fightIndex === -1) {
    return res.status(404).json({ msg: 'Walka nie znaleziona' });
  }

  // Remove associated votes and comments
  db.data.votes = db.data.votes.filter(v => v.fightId !== req.params.id);
  db.data.comments = db.data.comments.filter(c => c.fightId !== req.params.id);
  
  // Remove fight
  db.data.fights.splice(fightIndex, 1);

  await db.write();
  res.json({ msg: 'Walka została usunięta' });
};

// @desc    Get fight categories
// @route   GET /api/fights/categories
// @access  Public
export const getCategories = async (req, res) => {
  const categories = [
    'Anime',
    'Marvel',
    'DC',
    'Gaming',
    'Movies',
    'TV Shows',
    'Books',
    'Mythology',
    'History',
    'Mixed'
  ];
  
  res.json(categories);
};

// @desc    End fight and determine winner (moderator only)
// @route   POST /api/fights/:id/end
// @access  Private (Moderator only)
export const endFight = async (req, res) => {
  const db = req.db;
  await db.read();

  const user = db.data.users.find(u => u.id === req.user.id);
  if (user.role !== 'moderator') {
    return res.status(403).json({ msg: 'Tylko moderatorzy mogą kończyć walki' });
  }

  const fightIndex = db.data.fights.findIndex(f => f.id === req.params.id);
  if (fightIndex === -1) {
    return res.status(404).json({ msg: 'Walka nie znaleziona' });
  }

  const fight = db.data.fights[fightIndex];
  
  // Count votes
  const fighter1Votes = db.data.votes.filter(v => v.fightId === fight.id && v.choice === 'fighter1').length;
  const fighter2Votes = db.data.votes.filter(v => v.fightId === fight.id && v.choice === 'fighter2').length;

  let winner;
  if (fighter1Votes > fighter2Votes) {
    winner = 'fighter1';
  } else if (fighter2Votes > fighter1Votes) {
    winner = 'fighter2';
  } else {
    winner = 'draw';
  }

  db.data.fights[fightIndex].status = 'ended';
  db.data.fights[fightIndex].winner = winner;
  db.data.fights[fightIndex].endedAt = new Date().toISOString();
  db.data.fights[fightIndex].finalVotes = {
    fighter1: fighter1Votes,
    fighter2: fighter2Votes,
    total: fighter1Votes + fighter2Votes
  };

  // Award points to users who voted for the winner
  if (winner !== 'draw') {
    const winningVotes = db.data.votes.filter(v => v.fightId === fight.id && v.choice === winner);
    winningVotes.forEach(vote => {
      const userIndex = db.data.users.findIndex(u => u.id === vote.userId);
      if (userIndex !== -1) {
        if (!db.data.users[userIndex].stats) {
          db.data.users[userIndex].stats = { points: 0 };
        }
        db.data.users[userIndex].stats.points = (db.data.users[userIndex].stats.points || 0) + 10;
      }
    });
  }

  // Check for badges
  if (fight.type === 'main') {
    const winnerId = winner === 'fighter1' ? fight.fighter1.userId : fight.fighter2.userId;
    const loserId = winner === 'fighter1' ? fight.fighter2.userId : fight.fighter1.userId;
    if (winner !== 'draw') {
      await checkFightBadges(db, winnerId, loserId);
    }
  }

  await db.write();
  res.json({ msg: 'Walka zakończona', fight: db.data.fights[fightIndex] });
};