import Fight from '../models/Fight.js';
import User from '../models/User.js';
import Vote from '../models/Vote.js';
import Comment from '../models/Comment.js';

// @desc    Create a new fight
// @route   POST /api/fights
// @access  Private (Moderator only for main fights, users for feed fights)
export const createFight = async (req, res) => {
  try {
    const {
      title,
      description,
      fighter1,
      fighter2,
      fighter1Image,
      fighter2Image,
      category,
      type = 'feed', // 'main' or 'feed'
      endDate,
      teamA,
      teamB
    } = req.body;

    // Check if user is moderator for main fights
    const user = await User.findById(req.user.id);
    if (type === 'main' && user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Tylko moderatorzy mogą tworzyć główne walki' });
    }

    // Prepare teams (support both old and new formats)
    const teamAData = teamA || [{
      characterId: fighter1,
      characterName: fighter1,
      characterImage: fighter1Image || 'https://via.placeholder.com/150'
    }];

    const teamBData = teamB || [{
      characterId: fighter2,
      characterName: fighter2,
      characterImage: fighter2Image || 'https://via.placeholder.com/150'
    }];

    const newFight = await Fight.create({
      title,
      description,
      teamA: teamAData,
      teamB: teamBData,
      category,
      type: type === 'main' ? 'official' : 'regular',
      createdBy: req.user.id,
      status: 'active',
      timer: {
        duration: 168, // 7 days in hours
        startTime: new Date(),
        endTime: endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        autoLock: true
      },
      isOfficial: type === 'main',
      moderatorCreated: user.role === 'moderator'
    });

    res.json({ msg: 'Walka została utworzona', fight: newFight });
  } catch (error) {
    console.error('Error creating fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get all fights
// @route   GET /api/fights
// @access  Public
export const getFights = async (req, res) => {
  try {
    const { type, category, status, page = 1, limit = 10 } = req.query;

    // Build query
    const query = {};

    if (type) {
      if (type === 'main') {
        query.isOfficial = true;
      } else if (type === 'feed') {
        query.isOfficial = false;
      }
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    // Get total count for pagination
    const totalFights = await Fight.countDocuments(query);

    // Get fights with pagination
    const fights = await Fight.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Add creator info and vote counts
    const fightsWithDetails = await Promise.all(fights.map(async (fight) => {
      const creator = await User.findById(fight.createdBy);
      const voteCount = await Vote.countDocuments({ fightId: fight._id });
      const teamAVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['A', 'teamA'] } });
      const teamBVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['B', 'teamB'] } });

      return {
        ...fight.toObject(),
        id: fight._id.toString(),
        createdByUsername: creator ? creator.username : 'Nieznany',
        votes: {
          fighter1: teamAVotes,
          fighter2: teamBVotes,
          teamA: teamAVotes,
          teamB: teamBVotes,
          total: voteCount
        },
        votesA: teamAVotes,
        votesB: teamBVotes
      };
    }));

    res.json({
      fights: fightsWithDetails,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalFights / limit),
        totalFights,
        hasNext: page * limit < totalFights,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error getting fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Get single fight
// @route   GET /api/fights/:id
// @access  Public
export const getFight = async (req, res) => {
  try {
    const fight = await Fight.findById(req.params.id);
    if (!fight) {
      return res.status(404).json({ msg: 'Walka nie znaleziona' });
    }

    // Get creator info
    const creator = await User.findById(fight.createdBy);

    // Get vote counts
    const totalVotes = await Vote.countDocuments({ fightId: fight._id });
    const teamAVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['A', 'teamA'] } });
    const teamBVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['B', 'teamB'] } });

    // Get comments
    const comments = await Comment.find({ fightId: fight._id.toString(), type: 'fight' })
      .sort({ createdAt: -1 });

    const fightWithDetails = {
      ...fight.toObject(),
      id: fight._id.toString(),
      createdByUsername: creator ? creator.username : 'Nieznany',
      votes: {
        fighter1: teamAVotes,
        fighter2: teamBVotes,
        teamA: teamAVotes,
        teamB: teamBVotes,
        total: totalVotes
      },
      votesA: teamAVotes,
      votesB: teamBVotes,
      comments
    };

    res.json(fightWithDetails);
  } catch (error) {
    console.error('Error getting fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Update fight (moderator only)
// @route   PUT /api/fights/:id
// @access  Private (Moderator only)
export const updateFight = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Tylko moderatorzy mogą edytować walki' });
    }

    const fight = await Fight.findById(req.params.id);
    if (!fight) {
      return res.status(404).json({ msg: 'Walka nie znaleziona' });
    }

    const { title, description, status, winner, endDate } = req.body;

    if (title) fight.title = title;
    if (description) fight.description = description;
    if (status) fight.status = status;
    if (winner) {
      fight.result.winner = winner;
      if (status === 'finished') {
        fight.result.finishedAt = new Date();
      }
    }
    if (endDate) fight.timer.endTime = new Date(endDate);

    fight.updatedAt = new Date();
    await fight.save();

    res.json({ msg: 'Walka zaktualizowana', fight });
  } catch (error) {
    console.error('Error updating fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Delete fight (moderator only)
// @route   DELETE /api/fights/:id
// @access  Private (Moderator only)
export const deleteFight = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Tylko moderatorzy mogą usuwać walki' });
    }

    const fight = await Fight.findById(req.params.id);
    if (!fight) {
      return res.status(404).json({ msg: 'Walka nie znaleziona' });
    }

    // Remove associated votes and comments
    await Vote.deleteMany({ fightId: fight._id });
    await Comment.deleteMany({ fightId: fight._id.toString(), type: 'fight' });

    // Remove fight
    await Fight.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Walka została usunięta' });
  } catch (error) {
    console.error('Error deleting fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
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
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Tylko moderatorzy mogą kończyć walki' });
    }

    const fight = await Fight.findById(req.params.id);
    if (!fight) {
      return res.status(404).json({ msg: 'Walka nie znaleziona' });
    }

    // Count votes
    const teamAVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['A', 'teamA'] } });
    const teamBVotes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['B', 'teamB'] } });

    let winner;
    if (teamAVotes > teamBVotes) {
      winner = 'A';
    } else if (teamBVotes > teamAVotes) {
      winner = 'B';
    } else {
      winner = 'draw';
    }

    fight.status = 'finished';
    fight.result.winner = winner;
    fight.result.finishedAt = new Date();
    fight.result.finalVotesA = teamAVotes;
    fight.result.finalVotesB = teamBVotes;
    fight.result.method = 'moderator';

    // Award points to users who voted for the winner
    if (winner !== 'draw') {
      const winningVotes = await Vote.find({
        fightId: fight._id,
        team: winner === 'A' ? { $in: ['A', 'teamA'] } : { $in: ['B', 'teamB'] }
      });

      for (const vote of winningVotes) {
        await User.findByIdAndUpdate(vote.userId, {
          $inc: { 'stats.points': 10 }
        });
      }
    }

    await fight.save();
    res.json({ msg: 'Walka zakończona', fight });
  } catch (error) {
    console.error('Error ending fight:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};