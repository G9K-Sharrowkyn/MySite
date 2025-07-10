const Tournament = require('../models/tournamentModel');

// GET /api/tournaments
const getTournaments = async (req, res) => {
  try {
    const tournaments = await Tournament.find().populate('creator', 'username').sort({ createdAt: -1 });
    res.json(tournaments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tournaments
const createTournament = async (req, res) => {
  try {
    const tournament = await Tournament.create({
      ...req.body,
      creator: req.user._id
    });
    res.status(201).json(tournament);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tournaments/:id/join
const joinTournament = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ message: 'Tournament not found' });
    
    if (tournament.participants.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already joined' });
    }
    
    tournament.participants.push(req.user._id);
    await tournament.save();
    
    res.json({ message: 'Joined tournament successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getTournaments, createTournament, joinTournament };