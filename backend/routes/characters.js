const express = require('express');
const router = express.Router();
const characterController = require('../controllers/characterController');
const auth = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

// @route   GET api/characters
// @desc    Get all characters
// @access  Public
router.get('/', characterController.getCharacters);

// @route   POST api/characters
// @desc    Add a new character
// @access  Private (Moderator)
router.post('/', auth, authorize(['moderator', 'admin']), characterController.addCharacter);

// @route   PUT api/characters/:id
// @desc    Update character availability
// @access  Private (Moderator)
router.put('/:id', auth, authorize(['moderator', 'admin']), characterController.updateCharacter);

module.exports = router;
