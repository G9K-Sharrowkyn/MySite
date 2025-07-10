const Fight = require('../models/fightModel');
const Division = require('../models/divisionModel');
const User = require('../models/userModel');

// Helper to close fights that passed endsAt
const closeExpiredFights = async () => {
  await Fight.updateMany({ status: 'open', endsAt: { $lte: new Date() } }, { status: 'closed' });
};

// GET /api/fights/categories
const getFightCategories = async (req, res) => {
  try {
    const categories = [
      { id: 'casual', name: 'Casual Fight', description: 'Just for fun' },
      { id: 'official', name: 'Official Fight', description: 'Counts towards records' },
      { id: 'tournament', name: 'Tournament Fight', description: 'Part of a tournament' }
    ];
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/fights
const getAllFights = async (req, res) => {
  await closeExpiredFights();
  try {
    const fights = await Fight.find()
      .populate('teamA', 'name')
      .populate('teamB', 'name')
      .populate('division', 'name')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });
    res.json(fights);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/fights/:id
const getFight = async (req, res) => {
  await closeExpiredFights();
  try {
    const fight = await Fight.findById(req.params.id)
      .populate('teamA', 'name')
      .populate('teamB', 'name')
      .populate('division', 'name');
    if (!fight) return res.status(404).json({ message: 'Fight not found' });
    res.json(fight);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/fights
const createFight = async (req, res) => {
  const { divisionId, teamA, teamB, isOfficial, isTitleFight, durationHours = 72 } = req.body;
  const createdBy = req.user._id;

  try {
    let division = null;
    if (isOfficial) {
      if (!divisionId) return res.status(400).json({ message: 'Official fights must be linked to a division' });
      division = await Division.findById(divisionId);
      if (!division) return res.status(404).json({ message: 'Division not found' });
      if (req.user.role !== 'moderator' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only moderators can create official fights' });
      }
    }

    const fight = await Fight.create({
      division: divisionId,
      createdBy,
      teamA,
      teamB,
      isOfficial: !!isOfficial,
      isTitleFight: !!isTitleFight,
      endsAt: new Date(Date.now() + durationHours * 3600 * 1000)
    });

    res.status(201).json(fight);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/fights/:id/vote {team: 'A'|'B'}
const voteFight = async (req, res) => {
  const { team } = req.body;
  if (!['A', 'B'].includes(team)) return res.status(400).json({ message: 'Invalid team' });

  try {
    const fight = await Fight.findById(req.params.id);
    if (!fight) return res.status(404).json({ message: 'Fight not found' });

    if (fight.status !== 'open') return res.status(400).json({ message: 'Voting closed for this fight' });

    // Prevent duplicate vote
    if (fight.voters.some(v => v.user.toString() === req.user._id.toString())) {
      return res.status(400).json({ message: 'Already voted' });
    }

    fight.voters.push({ user: req.user._id, team });
    if (team === 'A') fight.votesA += 1;
    else fight.votesB += 1;

    await fight.save();
    res.json({ message: 'Vote recorded' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getFight, createFight, voteFight, getFightCategories, getAllFights };