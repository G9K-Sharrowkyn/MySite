import { v4 as uuidv4 } from 'uuid';
import { readDb, updateDb } from '../services/jsonDb.js';

// @desc    Get all characters
// @route   GET /api/characters
// @access  Public
export const getCharacters = async (_req, res) => {
  try {
    const db = await readDb();
    const characters = db.characters || [];
    res.json(characters);
  } catch (error) {
    console.error('Error fetching characters:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Add a new character (Moderator only)
// @route   POST /api/characters
// @access  Private (Moderator)
export const addCharacter = async (req, res) => {
  try {
    const { name, universe, image, powerTier, category } = req.body;

    if (!name || !image) {
      return res.status(400).json({ msg: 'Name and image are required' });
    }

    let created;

    await updateDb((db) => {
      const newCharacter = {
        id: uuidv4(),
        name,
        universe: universe || 'Other',
        image,
        images: {
          primary: image,
          gallery: [],
          thumbnail: image
        },
        powerTier: powerTier || 'Metahuman',
        category: category || 'Other',
        addedBy: req.user?.id || null,
        status: 'active',
        moderation: {
          approved: true,
          approvedBy: req.user?.id || null,
          approvedAt: new Date().toISOString()
        }
      };

      db.characters.push(newCharacter);
      created = newCharacter;
      return db;
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error adding character:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Update character availability (Moderator only)
// @route   PUT /api/characters/:id
// @access  Private (Moderator)
export const updateCharacter = async (req, res) => {
  try {
    const { id } = req.params;
    const { available, status } = req.body;
    let updated;

    await updateDb((db) => {
      const character = db.characters.find((entry) => entry.id === id);

      if (!character) {
        const error = new Error('Character not found');
        error.code = 'CHARACTER_NOT_FOUND';
        throw error;
      }

      if (available !== undefined) {
        character.status = available ? 'active' : 'inactive';
      }

      if (status !== undefined) {
        character.status = status;
      }

      updated = character;
      return db;
    });

    res.json(updated);
  } catch (error) {
    if (error.code === 'CHARACTER_NOT_FOUND') {
      return res.status(404).json({ msg: 'Character not found' });
    }
    console.error('Error updating character:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Suggest a new character (User suggestion)
// @route   POST /api/characters/suggest
// @access  Private
export const suggestCharacter = async (req, res) => {
  try {
    const { name, photo, universe, powerTier } = req.body;

    await updateDb((db) => {
      db.characterSuggestions = Array.isArray(db.characterSuggestions)
        ? db.characterSuggestions
        : [];
      db.characterSuggestions.push({
        id: uuidv4(),
        name,
        photo,
        universe,
        powerTier,
        suggestedBy: req.user?.id || null,
        createdAt: new Date().toISOString()
      });
      return db;
    });

    res.status(200).json({ msg: 'Character suggestion saved' });
  } catch (error) {
    console.error('Error saving character suggestion:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};
