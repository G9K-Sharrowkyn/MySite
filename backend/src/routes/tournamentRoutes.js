const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getTournaments, createTournament, joinTournament } = require('../controllers/tournamentController');

const router = express.Router();

router.get('/', getTournaments);
router.post('/', protect, createTournament);
router.post('/:id/join', protect, joinTournament);

module.exports = router;