const express = require('express');
const router = express.Router();
const fightController = require('../controllers/fightController');
const auth = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

// @route   GET api/fights
// @desc    Get all fights
// @access  Public
router.get('/', fightController.getFights);

// @route   POST api/fights
// @desc    Create a new fight
// @access  Private (Moderator)
router.post('/', auth, authorize(['moderator', 'admin']), fightController.createFight);

// @route   GET api/fights/pairs
// @desc    Get available player pairs
// @access  Private (Moderator)
router.get('/pairs', auth, authorize(['moderator', 'admin']), fightController.getPlayerPairs);

// @route   POST api/fights/auto
// @desc    Create fight from selected characters
// @access  Private (Moderator)
router.post('/auto', auth, authorize(['moderator', 'admin']), fightController.createFightFromSelections);

// @route   PUT api/fights/:id
// @desc    Update a fight
// @access  Private (Moderator)
router.put('/:id', auth, authorize(['moderator', 'admin']), fightController.updateFight);

// @route   DELETE api/fights/:id
// @desc    Delete a fight
// @access  Private (Moderator)
router.delete('/:id', auth, authorize(['moderator', 'admin']), fightController.deleteFight);

module.exports = router;
