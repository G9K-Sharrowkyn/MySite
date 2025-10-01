import Character from '../models/Character.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// @desc    Get all characters
// @route   GET /api/characters
// @access  Public
export const getCharacters = async (req, res) => {
  try {
    const characters = await Character.find({ status: 'active' });
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

    const newCharacter = await Character.create({
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
      addedBy: req.user.id,
      status: 'active',
      moderation: {
        approved: true,
        approvedBy: req.user.id,
        approvedAt: new Date()
      }
    });

    res.status(201).json(newCharacter);
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

    const character = await Character.findById(id);

    if (!character) {
      return res.status(404).json({ msg: 'Postać nie znaleziona' });
    }

    // Update status based on available field
    if (available !== undefined) {
      character.status = available ? 'active' : 'inactive';
    }

    if (status !== undefined) {
      character.status = status;
    }

    await character.save();
    res.json(character);
  } catch (error) {
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

    // Create notification for moderators
    const moderators = await User.find({ role: 'moderator' });

    for (const mod of moderators) {
      await Notification.create({
        userId: mod._id,
        type: 'character_suggestion',
        title: 'New Character Suggestion',
        message: `User suggested a new character: ${name}`,
        data: { name, photo, universe, powerTier, suggestedBy: req.user.id },
        read: false
      });
    }

    res.status(200).json({ msg: 'Character suggestion sent to moderators' });
  } catch (error) {
    console.error('Error sending character suggestion notification:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};
