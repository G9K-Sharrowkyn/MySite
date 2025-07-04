const express = require('express');
const router = express.Router();
const tournamentController = require('../controllers/tournamentController');
const auth = require('../middleware/auth');

// @route   GET api/tournaments
// @desc    Get all tournaments
// @access  Public
router.get('/', tournamentController.getAllTournaments);

// @route   GET api/tournaments/:id
// @desc    Get tournament by ID
// @access  Public
router.get('/:id', tournamentController.getTournamentById);

// @route   POST api/tournaments
// @desc    Create new tournament (moderator only)
// @access  Private
router.post('/', auth, tournamentController.createTournament);

// @route   PUT api/tournaments/:id
// @desc    Update tournament (moderator only)
// @access  Private
router.put('/:id', auth, tournamentController.updateTournament);

// @route   DELETE api/tournaments/:id
// @desc    Delete tournament (moderator only)
// @access  Private
router.delete('/:id', auth, tournamentController.deleteTournament);

// @route   POST api/tournaments/:id/join
// @desc    Join tournament
// @access  Private
router.post('/:id/join', auth, tournamentController.joinTournament);

// @route   POST api/tournaments/:id/leave
// @desc    Leave tournament
// @access  Private
router.post('/:id/leave', auth, tournamentController.leaveTournament);

module.exports = router;