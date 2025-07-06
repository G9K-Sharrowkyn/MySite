const express = require('express');
const router = express.Router();
const fightController = require('../controllers/fightController');
const auth = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

// @route   GET api/fights/categories
// @desc    Get fight categories
// @access  Public
router.get('/categories', fightController.getCategories);

// @route   GET api/fights
// @desc    Get all fights
// @access  Public
router.get('/', fightController.getFights);

// @route   GET api/fights/:id
// @desc    Get single fight
// @access  Public
router.get('/:id', fightController.getFight);

// @route   POST api/fights
// @desc    Create a new fight
// @access  Private
router.post('/', auth, fightController.createFight);

// @route   PUT api/fights/:id
// @desc    Update a fight
// @access  Private (Moderator)
router.put('/:id', auth, authorize(['moderator', 'admin']), fightController.updateFight);

// @route   DELETE api/fights/:id
// @desc    Delete a fight
// @access  Private (Moderator)
router.delete('/:id', auth, authorize(['moderator', 'admin']), fightController.deleteFight);

// @route   POST api/fights/:id/end
// @desc    End fight and determine winner
// @access  Private (Moderator)
router.post('/:id/end', auth, authorize(['moderator', 'admin']), fightController.endFight);

module.exports = router;