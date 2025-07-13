import express from 'express';
import { createFight, getFights, getFight, updateFight, deleteFight, endFight } from '../controllers/fightController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   GET api/fights
// @desc    Get all fights
// @access  Public
router.get('/', getFights);

// @route   POST api/fights
// @desc    Create a new fight
// @access  Private
router.post('/', auth, createFight);

// @route   GET api/fights/:id
// @desc    Get fight by ID
// @access  Public
router.get('/:id', getFight);

// @route   PUT api/fights/:id
// @desc    Update fight
// @access  Private
router.put('/:id', auth, updateFight);

// @route   DELETE api/fights/:id
// @desc    Delete fight
// @access  Private
router.delete('/:id', auth, deleteFight);

// @route   POST api/fights/:id/vote
// @desc    Vote on a fight
// @access  Private
router.post('/:id/vote', auth, (req, res) => {
  res.status(501).json({ message: 'Vote functionality not implemented yet' });
});

// @route   POST api/fights/:id/result
// @desc    Set fight result
// @access  Private
router.post('/:id/result', auth, endFight);

export default router;