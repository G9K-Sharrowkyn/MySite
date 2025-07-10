const Division = require('../models/divisionModel');
const Character = require('../models/characterModel');
const User = require('../models/userModel');

// GET /api/divisions
const getDivisions = async (req, res) => {
  try {
    const divisions = await Division.find().populate('champion.user', 'username').populate('champion.team', 'name');
    res.json(divisions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/divisions (admin/moderator)
const createDivision = async (req, res) => {
  const { name, description, roster } = req.body;
  try {
    // simple role check
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const division = await Division.create({ name, description, roster });
    res.status(201).json(division);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/divisions/:id/join  {team: [charId1, charId2]}
const joinDivision = async (req, res) => {
  const divisionId = req.params.id;
  const { team } = req.body; // array of two character ids
  const userId = req.user._id;

  if (!Array.isArray(team) || team.length !== 2) {
    return res.status(400).json({ message: 'Team must contain exactly two characters.' });
  }

  try {
    const division = await Division.findById(divisionId);
    if (!division) return res.status(404).json({ message: 'Division not found' });

    // Ensure characters are in division roster and not locked
    const characters = await Character.find({ _id: { $in: team } });
    if (characters.length !== 2) return res.status(400).json({ message: 'Invalid characters' });

    for (const char of characters) {
      if (!division.roster.includes(char._id)) {
        return res.status(400).json({ message: `${char.name} not in this division roster` });
      }
      if (char.isLocked) {
        return res.status(400).json({ message: `${char.name} already picked by another user` });
      }
    }

    // Lock characters
    await Character.updateMany({ _id: { $in: team } }, { isLocked: true, lockedBy: userId });

    // Add to division teams
    division.teams.push({ user: userId, characters: team });
    await division.save();

    // Update user divisions
    await User.findByIdAndUpdate(userId, {
      $push: {
        divisions: {
          division: divisionId,
          team
        }
      }
    });

    res.json({ message: 'Joined division successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getDivisions, createDivision, joinDivision };