import express from 'express';
import { getCharacters, addCharacter, updateCharacter, suggestCharacter } from '../controllers/characterController.js';
import auth from '../middleware/auth.js';
import authorize from '../middleware/roleMiddleware.js';

const router = express.Router();

// @route   GET api/characters
// @desc    Get all characters
// @access  Public
router.get('/', getCharacters);

// @route   POST api/characters
// @desc    Add a new character
// @access  Private (Moderator)
router.post('/', auth, authorize(['moderator', 'admin']), addCharacter);

// @route   PUT api/characters/:id
// @desc    Update character availability
// @access  Private (Moderator)
router.put('/:id', auth, authorize(['moderator', 'admin']), updateCharacter);

// @route   POST api/characters/suggest
// @desc    Suggest a new character (User suggestion)
// @access  Private
router.post('/suggest', auth, suggestCharacter);

export default router;
