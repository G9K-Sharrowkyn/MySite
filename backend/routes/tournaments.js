import express from 'express';
import { getAllTournaments, createTournament, getTournamentById, updateTournament, deleteTournament } from '../controllers/tournamentController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   GET api/tournaments
// @desc    Get all tournaments
// @access  Public
router.get('/', getAllTournaments);

// @route   POST api/tournaments
// @desc    Create a new tournament
// @access  Private
router.post('/', auth, createTournament);

// @route   GET api/tournaments/:id
// @desc    Get tournament by ID
// @access  Public
router.get('/:id', getTournamentById);

// @route   PUT api/tournaments/:id
// @desc    Update tournament
// @access  Private
router.put('/:id', auth, updateTournament);

// @route   DELETE api/tournaments/:id
// @desc    Delete tournament
// @access  Private
router.delete('/:id', auth, deleteTournament);

export default router;