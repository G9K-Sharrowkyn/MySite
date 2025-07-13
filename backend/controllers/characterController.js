
import { v4 as uuidv4 } from 'uuid';
import { createNotification } from './notificationController.js';

// @desc    Get all characters
// @route   GET /api/characters
// @access  Public
export const getCharacters = async (req, res) => {
  const db = req.db;
  await db.read();
  res.json(db.data.characters);
};

// @desc    Add a new character (Moderator only)
// @route   POST /api/characters
// @access  Private (Moderator)
export const addCharacter = async (req, res) => {
  const { name } = req.body;
  const db = req.db;
  await db.read();

  const newCharacter = { id: uuidv4(), name, available: true };
  db.data.characters.push(newCharacter);
  await db.write();
  res.status(201).json(newCharacter);
};

// @desc    Update character availability (Moderator only)
// @route   PUT /api/characters/:id
// @access  Private (Moderator)
export const updateCharacter = async (req, res) => {
  const { id } = req.params;
  const { available } = req.body;
  const db = req.db;
  await db.read();

  const index = db.data.characters.findIndex(c => c.id === id);

  if (index === -1) {
    return res.status(404).json({ msg: 'Postać nie znaleziona' });
  }

  db.data.characters[index].available = available;
  await db.write();
  res.json(db.data.characters[index]);
};

// @desc    Suggest a new character (User suggestion)
// @route   POST /api/characters/suggest
// @access  Private
export const suggestCharacter = async (req, res) => {
  const { name, photo } = req.body;
  const db = req.db;
  await db.read();

  // Create notification for moderators
  try {
    const moderators = db.data.users.filter(u => u.role === 'moderator');
    for (const mod of moderators) {
      await createNotification(
        db,
        mod.id,
        'character_suggestion',
        'New Character Suggestion',
        `User suggested a new character: ${name}`,
        { name, photo }
      );
    }
    await db.write();
    res.status(200).json({ msg: 'Character suggestion sent to moderators' });
  } catch (error) {
    console.error('Error sending character suggestion notification:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};
