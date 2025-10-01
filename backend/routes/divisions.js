import express from 'express';
import auth from '../middleware/auth.js';
import moderatorAuth from '../middleware/moderatorAuth.js';
import divisionService from '../services/divisionService.js';
import User from '../models/User.js';
import Fight from '../models/Fight.js';

const router = express.Router();

// @route   GET /api/divisions/:divisionId/stats
// @desc    Get division statistics
// @access  Public
router.get('/:divisionId/stats', async (req, res) => {
  try {
    const { divisionId } = req.params;
    const stats = await divisionService.getDivisionStats(divisionId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting division stats:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/divisions/:divisionId/champion
// @desc    Get current division champion
// @access  Public
router.get('/:divisionId/champion', async (req, res) => {
  try {
    const { divisionId } = req.params;
    const champion = await divisionService.getDivisionChampion(divisionId);
    res.json({ champion });
  } catch (error) {
    console.error('Error getting division champion:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/divisions/:divisionId/championship-history
// @desc    Get championship history for division
// @access  Public
router.get('/:divisionId/championship-history', async (req, res) => {
  try {
    const { divisionId } = req.params;
    
    // Pobierz historię mistrzów z bazy danych
    const champions = await User.find({
      [`divisions.${divisionId}.championshipHistory`]: { $exists: true }
    }).select('username divisions profilePicture').sort({
      [`divisions.${divisionId}.championshipHistory.startDate`]: -1
    });

    const history = champions.map(champion => {
      const divisionData = champion.divisions[divisionId];
      const championshipData = divisionData.championshipHistory;
      
      return {
        username: champion.username,
        profilePicture: champion.profilePicture,
        team: divisionData.team,
        startDate: championshipData.startDate,
        endDate: championshipData.endDate,
        reignDuration: championshipData.endDate 
          ? Math.ceil((new Date(championshipData.endDate) - new Date(championshipData.startDate)) / (1000 * 60 * 60 * 24))
          : Math.ceil((new Date() - new Date(championshipData.startDate)) / (1000 * 60 * 60 * 24)),
        titleDefenses: championshipData.titleDefenses || 0,
        totalFights: championshipData.totalFights || 0
      };
    });

    res.json(history);
  } catch (error) {
    console.error('Error getting championship history:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/divisions/:divisionId/contender-matches
// @desc    Get active contender matches for division
// @access  Public
router.get('/:divisionId/contender-matches', async (req, res) => {
  try {
    const { divisionId } = req.params;
    
    const contenderMatches = await Fight.find({
      'division.id': divisionId,
      type: 'contender_match',
      status: { $in: ['active', 'finished'] }
    }).populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .limit(10);

    // Dodaj informacje o uczestnikach
    const matchesWithParticipants = await Promise.all(
      contenderMatches.map(async (match) => {
        const participants = await User.find({
          $or: [
            { [`divisions.${divisionId}.team.characters`]: { $in: match.teamA.map(c => c.characterId) } },
            { [`divisions.${divisionId}.team.characters`]: { $in: match.teamB.map(c => c.characterId) } }
          ]
        }).select('username profilePicture divisions');

        const challenger1 = participants.find(p => 
          p.divisions[divisionId]?.team?.characters?.some(c => 
            match.teamA.some(tc => tc.characterId === c.characterId)
          )
        );

        const challenger2 = participants.find(p => 
          p.divisions[divisionId]?.team?.characters?.some(c => 
            match.teamB.some(tc => tc.characterId === c.characterId)
          )
        );

        return {
          ...match.toObject(),
          challenger1: challenger1 ? {
            username: challenger1.username,
            profilePicture: challenger1.profilePicture,
            divisionStats: challenger1.divisions[divisionId]
          } : null,
          challenger2: challenger2 ? {
            username: challenger2.username,
            profilePicture: challenger2.profilePicture,
            divisionStats: challenger2.divisions[divisionId]
          } : null
        };
      })
    );

    res.json(matchesWithParticipants);
  } catch (error) {
    console.error('Error getting contender matches:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/divisions/:divisionId/members
// @desc    Get division members
// @access  Private
router.get('/:divisionId/members', auth, async (req, res) => {
  try {
    const { divisionId } = req.params;
    
    const members = await User.find({
      [`divisions.${divisionId}`]: { $exists: true }
    }).select('username profilePicture divisions');

    res.json(members);
  } catch (error) {
    console.error('Error getting division members:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/divisions/:divisionId/title-fight
// @desc    Create a title fight (Moderator only)
// @access  Private (Moderator)
router.post('/:divisionId/title-fight', [auth, moderatorAuth], async (req, res) => {
  try {
    const { divisionId } = req.params;
    const { challengerId, description } = req.body;

    if (!challengerId) {
      return res.status(400).json({ msg: 'Challenger ID is required' });
    }

    // Znajdź aktualnego mistrza
    const champion = await User.findOne({
      [`divisions.${divisionId}.isChampion`]: true
    });

    if (!champion) {
      return res.status(400).json({ msg: 'No champion found for this division' });
    }

    // Sprawdź czy challenger istnieje i ma status #1 contender
    const challenger = await User.findById(challengerId);
    if (!challenger) {
      return res.status(404).json({ msg: 'Challenger not found' });
    }

    if (!challenger.divisions?.[divisionId]?.contenderStatus?.isNumberOneContender) {
      return res.status(400).json({ msg: 'Challenger must be the #1 contender' });
    }

    const titleFight = await divisionService.createTitleFight(
      divisionId,
      challengerId,
      champion._id,
      req.user.id,
      description
    );

    res.json({
      msg: 'Title fight created successfully',
      fight: titleFight
    });
  } catch (error) {
    console.error('Error creating title fight:', error);
    res.status(500).json({ msg: error.message || 'Server error' });
  }
});

// @route   POST /api/divisions/:divisionId/contender-match
// @desc    Create a contender match (Moderator only)
// @access  Private (Moderator)
router.post('/:divisionId/contender-match', [auth, moderatorAuth], async (req, res) => {
  try {
    const { divisionId } = req.params;
    const { challenger1Id, challenger2Id, description } = req.body;

    if (!challenger1Id || !challenger2Id) {
      return res.status(400).json({ msg: 'Both challenger IDs are required' });
    }

    if (challenger1Id === challenger2Id) {
      return res.status(400).json({ msg: 'Challengers must be different' });
    }

    const contenderMatch = await divisionService.createContenderMatch(
      divisionId,
      challenger1Id,
      challenger2Id,
      req.user.id,
      description
    );

    res.json({
      msg: 'Contender match created successfully',
      fight: contenderMatch
    });
  } catch (error) {
    console.error('Error creating contender match:', error);
    res.status(500).json({ msg: error.message || 'Server error' });
  }
});

// @route   POST /api/divisions/join
// @desc    Join a division with selected team
// @access  Private
router.post('/join', auth, async (req, res) => {
  try {
    const { divisionId, team } = req.body;

    if (!divisionId || !team || !team.mainCharacter) {
      return res.status(400).json({ msg: 'Division ID and team with main character are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Sprawdź czy postaci nie są już używane przez innego gracza w tej dywizji
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

    // Przygotuj dane zespołu
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

    // Aktualizuj użytkownika
    const updateData = {
      [`divisions.${divisionId}`]: {
        team: teamData,
        joinedAt: new Date(),
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        isChampion: false
      }
    };

    await User.findByIdAndUpdate(user._id, { $set: updateData });

    res.json({ msg: 'Successfully joined division' });
  } catch (error) {
    console.error('Error joining division:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/divisions/leave
// @desc    Leave a division
// @access  Private
router.post('/leave', auth, async (req, res) => {
  try {
    const { divisionId } = req.body;

    if (!divisionId) {
      return res.status(400).json({ msg: 'Division ID is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Sprawdź czy użytkownik jest mistrzem - mistrz nie może opuścić dywizji
    if (user.divisions?.[divisionId]?.isChampion) {
      return res.status(400).json({ msg: 'Champions cannot leave their division. You must lose your title first.' });
    }

    // Usuń użytkownika z dywizji
    await User.findByIdAndUpdate(user._id, {
      $unset: { [`divisions.${divisionId}`]: 1 }
    });

    res.json({ msg: 'Successfully left division' });
  } catch (error) {
    console.error('Error leaving division:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET /api/divisions/user
// @desc    Get user's divisions
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('divisions');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(user.divisions || {});
  } catch (error) {
    console.error('Error getting user divisions:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/divisions/fights/:fightId/lock
// @desc    Manually lock a fight (Moderator only)
// @access  Private (Moderator)
router.post('/fights/:fightId/lock', [auth, moderatorAuth], async (req, res) => {
  try {
    const { fightId } = req.params;
    
    const fight = await divisionService.lockFight(fightId, 'moderator');
    
    res.json({
      msg: 'Fight locked successfully',
      fight
    });
  } catch (error) {
    console.error('Error locking fight:', error);
    res.status(500).json({ msg: error.message || 'Server error' });
  }
});

// @route   GET /api/divisions/fights/expired
// @desc    Get expired fights that need to be locked (Moderator only)
// @access  Private (Moderator)
router.get('/fights/expired', [auth, moderatorAuth], async (req, res) => {
  try {
    const now = new Date();
    const expiredFights = await Fight.find({
      'timer.endTime': { $lt: now },
      status: 'active',
      'timer.autoLock': true
    }).populate('createdBy', 'username');

    res.json(expiredFights);
  } catch (error) {
    console.error('Error getting expired fights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST /api/divisions/auto-lock-expired
// @desc    Auto-lock all expired fights (Moderator only)
// @access  Private (Moderator)
router.post('/auto-lock-expired', [auth, moderatorAuth], async (req, res) => {
  try {
    const lockedCount = await divisionService.autoLockExpiredFights();
    
    res.json({
      msg: `Successfully auto-locked ${lockedCount} expired fights`,
      lockedCount
    });
  } catch (error) {
    console.error('Error auto-locking expired fights:', error);
    res.status(500).json({ msg: error.message || 'Server error' });
  }
});

export default router;
