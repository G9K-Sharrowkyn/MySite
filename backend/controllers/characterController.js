const { v4: uuidv4 } = require('uuid');

// @desc    Get all characters
// @route   GET /api/characters
// @access  Public
exports.getCharacters = async (req, res) => {
  const db = req.db;
  await db.read();
  res.json(db.data.characters);
};

// @desc    Add a new character (Moderator only)
// @route   POST /api/characters
// @access  Private (Moderator)
exports.addCharacter = async (req, res) => {
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
exports.updateCharacter = async (req, res) => {
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
