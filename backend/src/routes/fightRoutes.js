const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { createFight, getFight, voteFight } = require('../controllers/fightController');

const router = express.Router();

router.get('/:id', getFight);
router.post('/', protect, createFight);
router.post('/:id/vote', protect, voteFight);

module.exports = router;