const Character = require('../models/characterModel');

// GET /api/characters
const getCharacters = async (req, res) => {
  const { q } = req.query;
  const filter = q ? { name: { $regex: q, $options: 'i' } } : {};
  try {
    const characters = await Character.find(filter).select('name universe imageUrl powerTier');
    res.json(characters);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getCharacters };