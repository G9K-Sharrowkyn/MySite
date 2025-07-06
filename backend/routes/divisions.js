const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Get all divisions
router.get('/', async (req, res) => {
  try {
    await req.db.read();
    
    const divisions = [
      {
        id: 'regular',
        name: 'Regular People',
        description: 'Normal humans without special powers',
        powerLevel: 1,
        color: '#4CAF50'
      },
      {
        id: 'metahuman',
        name: 'Metahuman',
        description: 'Enhanced humans with special abilities',
        powerLevel: 2,
        color: '#2196F3'
      },
      {
        id: 'planet-busters',
        name: 'Planet Busters',
        description: 'Beings capable of destroying planets',
        powerLevel: 3,
        color: '#FF9800'
      },
      {
        id: 'god-tier',
        name: 'God Tier',
        description: 'Divine or god-like beings',
        powerLevel: 4,
        color: '#9C27B0'
      },
      {
        id: 'universal-threat',
        name: 'Universal Threat',
        description: 'Beings that threaten entire universes',
        powerLevel: 5,
        color: '#F44336'
      },
      {
        id: 'omnipotent',
        name: 'Omnipotent',
        description: 'All-powerful beings beyond comprehension',
        powerLevel: 6,
        color: '#FFD700'
      }
    ];

    res.json(divisions);
  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's divisions
router.get('/user', auth, async (req, res) => {
  try {
    await req.db.read();
    const userId = req.user.id;
    
    // Find user's division participations
    const userDivisions = req.db.data.users.find(u => u.id === userId)?.divisions || [];
    
    res.json(userDivisions);
  } catch (error) {
    console.error('Error fetching user divisions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get taken characters for a division
router.get('/:divisionId/taken-characters', async (req, res) => {
  try {
    await req.db.read();
    const { divisionId } = req.params;
    
    // Find all users who have selected characters in this division
    const takenCharacters = [];
    req.db.data.users.forEach(user => {
      if (user.divisions && user.divisions[divisionId]) {
        const team = user.divisions[divisionId].team;
        if (team?.mainCharacter) {
          takenCharacters.push({
            characterId: team.mainCharacter.id,
            characterName: team.mainCharacter.name,
            userId: user.id,
            username: user.username,
            role: 'main'
          });
        }
        if (team?.secondaryCharacter) {
          takenCharacters.push({
            characterId: team.secondaryCharacter.id,
            characterName: team.secondaryCharacter.name,
            userId: user.id,
            username: user.username,
            role: 'secondary'
          });
        }
      }
    });
    
    res.json(takenCharacters);
  } catch (error) {
    console.error('Error fetching taken characters:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Join a division
router.post('/join', auth, async (req, res) => {
  try {
    console.log('Division join request received:', {
      userId: req.user.id,
      body: req.body
    });

    await req.db.read();
    const userId = req.user.id;
    const { divisionId, team } = req.body;
    
    // Validate input
    if (!divisionId) {
      console.error('Missing divisionId');
      return res.status(400).json({ message: 'Division ID is required' });
    }
    
    if (!team) {
      console.error('Missing team data');
      return res.status(400).json({ message: 'Team data is required' });
    }
    
    if (!team.mainCharacter) {
      console.error('Missing main character');
      return res.status(400).json({ message: 'Main character is required' });
    }
    
    if (!team.secondaryCharacter) {
      console.error('Missing secondary character');
      return res.status(400).json({ message: 'Secondary character is required' });
    }
    
    console.log('Validated team data:', team);
    
    // Find user
    const userIndex = req.db.data.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      console.error('User not found:', userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('User found at index:', userIndex);
    
    // Check if either character is already taken in this division
    const isMainCharacterTaken = req.db.data.users.some(user => 
      user.divisions && 
      user.divisions[divisionId] && 
      (user.divisions[divisionId].team?.mainCharacter?.id === team.mainCharacter.id ||
       user.divisions[divisionId].team?.secondaryCharacter?.id === team.mainCharacter.id) &&
      user.id !== userId
    );
    
    const isSecondaryCharacterTaken = req.db.data.users.some(user => 
      user.divisions && 
      user.divisions[divisionId] && 
      (user.divisions[divisionId].team?.mainCharacter?.id === team.secondaryCharacter.id ||
       user.divisions[divisionId].team?.secondaryCharacter?.id === team.secondaryCharacter.id) &&
      user.id !== userId
    );
    
    console.log('Character availability check:', {
      isMainCharacterTaken,
      isSecondaryCharacterTaken
    });
    
    if (isMainCharacterTaken || isSecondaryCharacterTaken) {
      return res.status(400).json({ message: 'One or both characters are already taken in this division' });
    }
    
    // Initialize divisions object if it doesn't exist
    if (!req.db.data.users[userIndex].divisions) {
      req.db.data.users[userIndex].divisions = {};
    }
    
    // Add user to division
    const divisionData = {
      joinedAt: new Date().toISOString(),
      team: {
        mainCharacter: team.mainCharacter,
        secondaryCharacter: team.secondaryCharacter
      },
      wins: 0,
      losses: 0,
      draws: 0,
      rank: 'Rookie',
      points: 0,
      isChampion: false
    };
    
    console.log('Creating division data:', divisionData);
    
    req.db.data.users[userIndex].divisions[divisionId] = divisionData;
    
    console.log('Writing to database...');
    await req.db.write();
    console.log('Database write successful');
    
    res.json({ 
      message: 'Successfully joined division',
      division: req.db.data.users[userIndex].divisions[divisionId]
    });
  } catch (error) {
    console.error('Error joining division:', error.message, error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Leave a division
router.post('/leave', auth, async (req, res) => {
  try {
    await req.db.read();
    const userId = req.user.id;
    const { divisionId } = req.body;
    
    // Find user
    const userIndex = req.db.data.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Remove user from division
    if (req.db.data.users[userIndex].divisions && req.db.data.users[userIndex].divisions[divisionId]) {
      delete req.db.data.users[userIndex].divisions[divisionId];
      await req.db.write();
    }
    
    res.json({ message: 'Successfully left division' });
  } catch (error) {
    console.error('Error leaving division:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get division leaderboard
router.get('/:divisionId/leaderboard', async (req, res) => {
  try {
    await req.db.read();
    const { divisionId } = req.params;
    
    // Get all users in this division
    const divisionUsers = req.db.data.users
      .filter(user => user.divisions && user.divisions[divisionId])
      .map(user => ({
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture,
        ...user.divisions[divisionId],
        winRate: user.divisions[divisionId].wins + user.divisions[divisionId].losses > 0 
          ? (user.divisions[divisionId].wins / (user.divisions[divisionId].wins + user.divisions[divisionId].losses) * 100).toFixed(1)
          : 0
      }))
      .sort((a, b) => b.points - a.points);
    
    res.json(divisionUsers);
  } catch (error) {
    console.error('Error fetching division leaderboard:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create official fight (moderator only)
router.post('/:divisionId/create-fight', auth, roleMiddleware(['moderator']), async (req, res) => {
  try {
    await req.db.read();
    const { divisionId } = req.params;
    const { title, description, fighter1Id, fighter2Id } = req.body;
    
    // Find the fighters
    const fighter1 = req.db.data.users.find(u => u.id === fighter1Id);
    const fighter2 = req.db.data.users.find(u => u.id === fighter2Id);
    
    if (!fighter1 || !fighter2) {
      return res.status(404).json({ message: 'One or both fighters not found' });
    }
    
    // Check if both fighters are in the division
    if (!fighter1.divisions?.[divisionId] || !fighter2.divisions?.[divisionId]) {
      return res.status(400).json({ message: 'Both fighters must be in the specified division' });
    }
    
    // Create official fight
    const officialFight = {
      id: Date.now().toString(),
      type: 'official-fight',
      title,
      description,
      divisionId,
      fighter1: {
        userId: fighter1.id,
        username: fighter1.username,
        team: fighter1.divisions[divisionId].team,
        profilePicture: fighter1.profilePicture
      },
      fighter2: {
        userId: fighter2.id,
        username: fighter2.username,
        team: fighter2.divisions[divisionId].team,
        profilePicture: fighter2.profilePicture
      },
      votes: {
        fighter1: 0,
        fighter2: 0
      },
      voters: [],
      status: 'active',
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      isOfficial: true,
      featured: true
    };
    
    // Add to fights collection
    if (!req.db.data.officialFights) {
      req.db.data.officialFights = [];
    }
    req.db.data.officialFights.push(officialFight);
    
    await req.db.write();
    
    res.status(201).json(officialFight);
  } catch (error) {
    console.error('Error creating official fight:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
