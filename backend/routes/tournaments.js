import express from 'express';
import {
  getAllTournaments,
  createTournament,
  getTournamentById,
  updateTournament,
  deleteTournament,
  joinTournament,
  leaveTournament,
  startTournament,
  voteInTournament,
  getTournamentBrackets,
  advanceMatch,
  getAvailableCharacters,
  getTournamentLoadoutOptions,
  getTournamentLoadoutCatalog
} from '../controllers/tournamentController.js';
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

// @route   GET api/tournaments/loadout-catalog
// @desc    Get full catalog for choose-your-weapon mode
// @access  Public
router.get('/loadout-catalog', getTournamentLoadoutCatalog);

// @route   GET api/tournaments/:id
// @desc    Get tournament by ID
// @access  Public
router.get('/:id', getTournamentById);

// @route   GET api/tournaments/:id/brackets
// @desc    Get tournament brackets
// @access  Public
router.get('/:id/brackets', getTournamentBrackets);

// @route   GET api/tournaments/:id/available-characters
// @desc    Get available characters for tournament
// @access  Public
router.get('/:id/available-characters', getAvailableCharacters);

// @route   GET api/tournaments/:id/loadout-options
// @desc    Get available loadout options for choose-your-weapon tournament
// @access  Public
router.get('/:id/loadout-options', getTournamentLoadoutOptions);

// @route   POST api/tournaments/:id/join
// @desc    Join tournament
// @access  Private
router.post('/:id/join', auth, joinTournament);

// @route   POST api/tournaments/:id/leave
// @desc    Leave tournament
// @access  Private
router.post('/:id/leave', auth, leaveTournament);

// @route   POST api/tournaments/:id/start
// @desc    Start tournament
// @access  Private (Moderator)
router.post('/:id/start', auth, startTournament);

// @route   POST api/tournaments/:id/matches/:matchId/vote
// @desc    Vote in tournament match
// @access  Private
router.post('/:id/matches/:matchId/vote', auth, voteInTournament);

// @route   POST api/tournaments/:id/matches/:matchId/advance
// @desc    Advance tournament match (Moderator)
// @access  Private
router.post('/:id/matches/:matchId/advance', auth, advanceMatch);

// @route   PUT api/tournaments/:id
// @desc    Update tournament
// @access  Private
router.put('/:id', auth, updateTournament);

// @route   DELETE api/tournaments/:id
// @desc    Delete tournament
// @access  Private
router.delete('/:id', auth, deleteTournament);

export default router;
