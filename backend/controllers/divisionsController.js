import User from '../models/User.js';
import Fight from '../models/Fight.js';
import divisionService from '../services/divisionService.js';

/**
 * Get division statistics
 * @route GET /api/divisions/:divisionId/stats
 * @access Public
 */
export const getDivisionStats = async (req, res) => {
  try {
    const { divisionId } = req.params;
    const stats = await divisionService.getDivisionStats(divisionId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting division stats:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

/**
 * Get current division champion
 * @route GET /api/divisions/:divisionId/champion
 * @access Public
 */
export const getDivisionChampion = async (req, res) => {
  try {
    const { divisionId } = req.params;
    const champion = await divisionService.getDivisionChampion(divisionId);
    res.json({ champion });
  } catch (error) {
    console.error('Error getting division champion:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

/**
 * Get division leaderboard
 * @route GET /api/divisions/:divisionId/leaderboard
 * @access Public
 */
export const getDivisionLeaderboard = async (req, res) => {
  try {
    const { divisionId } = req.params;
    const { limit = 50 } = req.query;

    const leaderboard = await divisionService.getLeaderboard(divisionId, parseInt(limit));
    res.json(leaderboard);
  } catch (error) {
    console.error('Error getting division leaderboard:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

/**
 * Join a division
 * @route POST /api/divisions/join
 * @access Private
 */
export const joinDivision = async (req, res) => {
  try {
    const { divisionId, team } = req.body;

    if (!divisionId || !team || !team.mainCharacter) {
      return res.status(400).json({ msg: 'Division ID and team with main character are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if user is already in this division
    if (user.divisions && user.divisions.get(divisionId)) {
      return res.status(400).json({ msg: 'You are already in this division' });
    }

    // Check if characters are already taken
    const existingUsers = await User.find({
      [`divisions.${divisionId}.team.characters`]: {
        $elemMatch: {
          characterId: { $in: [team.mainCharacter.id, team.secondaryCharacter?.id].filter(Boolean) }
        }
      },
      _id: { $ne: user._id }
    });

    if (existingUsers.length > 0) {
      return res.status(400).json({ msg: 'One or more selected characters are already taken in this division' });
    }

    // Prepare team data
    const teamData = {
      characters: [
        {
          characterId: team.mainCharacter.id,
          characterName: team.mainCharacter.name,
          characterImage: team.mainCharacter.image
        }
      ]
    };

    if (team.secondaryCharacter) {
      teamData.characters.push({
        characterId: team.secondaryCharacter.id,
        characterName: team.secondaryCharacter.name,
        characterImage: team.secondaryCharacter.image
      });
    }

    // Update user
    const updateData = {
      [`divisions.${divisionId}`]: {
        team: teamData,
        joinedAt: new Date(),
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        rank: 'Rookie',
        isChampion: false
      }
    };

    await User.findByIdAndUpdate(user._id, { $set: updateData });

    res.json({ msg: 'Successfully joined division', division: updateData[`divisions.${divisionId}`] });
  } catch (error) {
    console.error('Error joining division:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

/**
 * Leave a division
 * @route POST /api/divisions/leave
 * @access Private
 */
export const leaveDivision = async (req, res) => {
  try {
    const { divisionId } = req.body;

    if (!divisionId) {
      return res.status(400).json({ msg: 'Division ID is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if user is champion
    if (user.divisions?.get(divisionId)?.isChampion) {
      return res.status(400).json({ msg: 'Champions cannot leave their division. You must lose your title first.' });
    }

    // Remove user from division
    await User.findByIdAndUpdate(user._id, {
      $unset: { [`divisions.${divisionId}`]: 1 }
    });

    res.json({ msg: 'Successfully left division' });
  } catch (error) {
    console.error('Error leaving division:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

/**
 * Get user's divisions
 * @route GET /api/divisions/user
 * @access Private
 */
export const getUserDivisions = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('divisions');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(user.divisions || {});
  } catch (error) {
    console.error('Error getting user divisions:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

/**
 * Get available divisions list
 * @route GET /api/divisions/available
 * @access Public
 */
export const getAvailableDivisions = async (req, res) => {
  try {
    const divisions = [
      { id: 'regular-people', name: 'Regular People', description: 'Regular human fighters' },
      { id: 'metahuman', name: 'Metahuman', description: 'Enhanced humans with special abilities' },
      { id: 'planet-busters', name: 'Planet Busters', description: 'Powerful beings capable of planetary destruction' },
      { id: 'god-tier', name: 'God Tier', description: 'Divine and godlike entities' },
      { id: 'universal-threat', name: 'Universal Threat', description: 'Beings that threaten entire universes' },
      { id: 'omnipotent', name: 'Omnipotent', description: 'The most powerful beings in existence' }
    ];

    // Get member counts for each division
    const divisionsWithCounts = await Promise.all(
      divisions.map(async (division) => {
        const memberCount = await User.countDocuments({
          [`divisions.${division.id}`]: { $exists: true }
        });

        return {
          ...division,
          memberCount
        };
      })
    );

    res.json(divisionsWithCounts);
  } catch (error) {
    console.error('Error getting available divisions:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
};

export default {
  getDivisionStats,
  getDivisionChampion,
  getDivisionLeaderboard,
  joinDivision,
  leaveDivision,
  getUserDivisions,
  getAvailableDivisions
};
