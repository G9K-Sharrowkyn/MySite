const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { voteFight } = require('../controllers/fightController');

const router = express.Router();

// POST /api/votes { fightId, team }
router.post('/', protect, (req, res, next) => {
  if (!req.body.fightId) return res.status(400).json({ message: 'fightId required' });
  // adjust request params for reuse
  req.params.id = req.body.fightId;
  return voteFight(req, res, next);
});

module.exports = router;