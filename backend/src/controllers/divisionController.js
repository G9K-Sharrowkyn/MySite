const Division = require('../models/divisionModel');
const Character = require('../models/characterModel');
const User = require('../models/userModel');
const Fight = require('../models/fightModel');

// GET /api/divisions
const getDivisions = async (req, res) => {
  try {
    const divisions = await Division.find().populate('champion.user', 'username').populate('champion.team', 'name');
    res.json(divisions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/divisions (admin/moderator)
const createDivision = async (req, res) => {
  const { name, description, roster } = req.body;
  try {
    // simple role check
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const division = await Division.create({ name, description, roster });
    res.status(201).json(division);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/divisions/join - Updated to match frontend format
const joinDivision = async (req, res) => {
  const { divisionId, team } = req.body;
  const userId = req.user._id;

  try {
    // Update user's divisions array
    await User.findByIdAndUpdate(userId, {
      $push: {
        divisions: {
          division: divisionId,
          team: [team.mainCharacter, team.secondaryCharacter],
          joinedAt: new Date(),
          wins: 0,
          losses: 0,
          draws: 0
        }
      }
    });

    res.json({ 
      message: 'Successfully joined division',
      division: {
        joinedAt: new Date(),
        team: team,
        wins: 0,
        losses: 0,
        draws: 0
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/divisions/user - Get user's divisions
const getUserDivisions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('divisions.division');
    res.json(user.divisions || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/divisions/active-fights
const getActiveFights = async (req, res) => {
  try {
    const fights = await Fight.find({ 
      status: 'open',
      isOfficial: true,
      endsAt: { $gt: new Date() }
    }).populate('teamA teamB division');
    res.json(fights);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/divisions/:id/stats
const getDivisionStats = async (req, res) => {
  try {
    const stats = {
      totalFights: 0,
      activeFights: 0,
      totalParticipants: 0
    };
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/divisions/:id/champion
const getDivisionChampion = async (req, res) => {
  try {
    const division = await Division.findById(req.params.id).populate('champion.user');
    res.json(division?.champion || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/divisions/leave
const leaveDivision = async (req, res) => {
  const { divisionId } = req.body;
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { divisions: { division: divisionId } }
    });
    res.json({ message: 'Left division successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { 
  getDivisions, 
  createDivision, 
  joinDivision,
  getUserDivisions,
  getActiveFights,
  getDivisionStats,
  getDivisionChampion,
  leaveDivision
};