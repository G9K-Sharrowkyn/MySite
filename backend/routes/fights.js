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

// @route   PUT api/fights/:id
// @desc    Update a fight
// @access  Private (Moderator)
router.put('/:id', auth, authorize(['moderator', 'admin']), fightController.updateFight);

// @route   DELETE api/fights/:id
// @desc    Delete a fight
// @access  Private (Moderator)
router.delete('/:id', auth, authorize(['moderator', 'admin']), fightController.deleteFight);

module.exports = router;
