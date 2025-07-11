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
    const userDivisions = req.db.data.users.find(u => u.id === userId)?.divisions || {};
    
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

// Get division statistics
router.get('/:divisionId/stats', async (req, res) => {
  try {
    await req.db.read();
    const { divisionId } = req.params;
    
    // Count active teams in this division
    const activeTeams = req.db.data.users.filter(user => 
      user.divisions && user.divisions[divisionId]
    ).length;
    
    // Get division info
    const divisionInfo = {
      id: divisionId,
      activeTeams,
      totalUsers: req.db.data.users.length
    };
    
    res.json(divisionInfo);
  } catch (error) {
    console.error('Error fetching division stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get division champion history
router.get('/:divisionId/championship-history', async (req, res) => {
  try {
    await req.db.read();
    const { divisionId } = req.params;
    
    // Initialize championship history if it doesn't exist
    if (!req.db.data.championshipHistory) {
      req.db.data.championshipHistory = {};
    }
    
    const history = req.db.data.championshipHistory[divisionId] || [];
    
    // Sort by startDate descending (most recent first)
    const sortedHistory = history.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    
    res.json(sortedHistory);
  } catch (error) {
    console.error('Error fetching championship history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign division champion (moderator only)
router.post('/:divisionId/assign-champion', auth, roleMiddleware(['moderator']), async (req, res) => {
  try {
    await req.db.read();
    const { divisionId } = req.params;
    const { userId } = req.body;
    
    // Find user
    const userIndex = req.db.data.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is in the division
    if (!req.db.data.users[userIndex].divisions?.[divisionId]) {
      return res.status(400).json({ message: 'User is not in this division' });
    }
    
    // Initialize championship history if it doesn't exist
    if (!req.db.data.championshipHistory) {
      req.db.data.championshipHistory = {};
    }
    if (!req.db.data.championshipHistory[divisionId]) {
      req.db.data.championshipHistory[divisionId] = [];
    }
    
    // Find current champion and end their reign
    const currentChampIndex = req.db.data.users.findIndex(user => 
      user.divisions && 
      user.divisions[divisionId] && 
      user.divisions[divisionId].isChampion
    );
    
    if (currentChampIndex !== -1) {
      const currentChamp = req.db.data.users[currentChampIndex];
      
      // Add to history
      const reignStart = currentChamp.divisions[divisionId].championSince;
      const reignEnd = new Date().toISOString();
      const defenses = currentChamp.divisions[divisionId].titleDefenses || 0;
      
      req.db.data.championshipHistory[divisionId].push({
        userId: currentChamp.id,
        username: currentChamp.username,
        team: currentChamp.divisions[divisionId].team,
        startDate: reignStart,
        endDate: reignEnd,
        reignDuration: Math.floor((new Date(reignEnd) - new Date(reignStart)) / (1000 * 60 * 60 * 24)), // days
        titleDefenses: defenses,
        totalFights: currentChamp.divisions[divisionId].wins + currentChamp.divisions[divisionId].losses + currentChamp.divisions[divisionId].draws
      });
      
      // Remove champion status from previous champion
      req.db.data.users[currentChampIndex].divisions[divisionId].isChampion = false;
      req.db.data.users[currentChampIndex].divisions[divisionId].championTitle = null;
      req.db.data.users[currentChampIndex].divisions[divisionId].championSince = null;
      req.db.data.users[currentChampIndex].divisions[divisionId].titleDefenses = 0;
    }
    
    // Remove champion status from all users in this division (safety check)
    req.db.data.users.forEach(user => {
      if (user.divisions && user.divisions[divisionId]) {
        user.divisions[divisionId].isChampion = false;
        user.divisions[divisionId].championTitle = null;
        user.divisions[divisionId].championSince = null;
        user.divisions[divisionId].titleDefenses = 0;
      }
    });
    
    // Assign champion status to the selected user
    req.db.data.users[userIndex].divisions[divisionId].isChampion = true;
    req.db.data.users[userIndex].divisions[divisionId].championTitle = `${divisionId.charAt(0).toUpperCase() + divisionId.slice(1)} Champion`;
    req.db.data.users[userIndex].divisions[divisionId].championSince = new Date().toISOString();
    req.db.data.users[userIndex].divisions[divisionId].titleDefenses = 0;
    
    // Update user's global title if they don't have a higher one
    const currentTitle = req.db.data.users[userIndex].title || '';
    const divisionTitles = {
      'regular': 'Regular Division Champion',
      'metahuman': 'Metahuman Division Champion', 
      'planet-busters': 'Planet Busters Champion',
      'god-tier': 'God Tier Champion',
      'universal-threat': 'Universal Threat Champion',
      'omnipotent': 'Omnipotent Champion'
    };
    
    const newTitle = divisionTitles[divisionId];
    if (newTitle && !currentTitle.includes('Champion')) {
      req.db.data.users[userIndex].title = newTitle;
    }
    
    await req.db.write();
    
    res.json({ 
      message: 'Champion assigned successfully',
      champion: {
        userId: req.db.data.users[userIndex].id,
        username: req.db.data.users[userIndex].username,
        title: newTitle,
        championSince: req.db.data.users[userIndex].divisions[divisionId].championSince
      }
    });
  } catch (error) {
    console.error('Error assigning champion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user ranking after fight result
router.post('/:divisionId/update-ranking', auth, async (req, res) => {
  try {
    await req.db.read();
    const { divisionId } = req.params;
    const { winnerId, loserId, isDraw = false, isTitle = false } = req.body;
    
    // Update winner stats
    if (winnerId && !isDraw) {
      const winnerIndex = req.db.data.users.findIndex(u => u.id === winnerId);
      if (winnerIndex !== -1 && req.db.data.users[winnerIndex].divisions?.[divisionId]) {
        req.db.data.users[winnerIndex].divisions[divisionId].wins += 1;
        req.db.data.users[winnerIndex].divisions[divisionId].points += 10;
        req.db.data.users[winnerIndex].divisions[divisionId].streak = (req.db.data.users[winnerIndex].divisions[divisionId].streak || 0) + 1;
        
        // If this was a title defense, increment defenses
        if (isTitle && req.db.data.users[winnerIndex].divisions[divisionId].isChampion) {
          req.db.data.users[winnerIndex].divisions[divisionId].titleDefenses = 
            (req.db.data.users[winnerIndex].divisions[divisionId].titleDefenses || 0) + 1;
        }
        
        // Update rank based on points
        updateUserRank(req.db.data.users[winnerIndex].divisions[divisionId]);
      }
    }
    
    // Update loser stats
    if (loserId && !isDraw) {
      const loserIndex = req.db.data.users.findIndex(u => u.id === loserId);
      if (loserIndex !== -1 && req.db.data.users[loserIndex].divisions?.[divisionId]) {
        req.db.data.users[loserIndex].divisions[divisionId].losses += 1;
        req.db.data.users[loserIndex].divisions[divisionId].points = Math.max(0, req.db.data.users[loserIndex].divisions[divisionId].points - 2);
        req.db.data.users[loserIndex].divisions[divisionId].streak = 0;
        
        // If champion lost a title fight, they lose the title
        if (isTitle && req.db.data.users[loserIndex].divisions[divisionId].isChampion) {
          // Pass the championship to the winner
          await req.app.post(`/api/divisions/${divisionId}/assign-champion`, { userId: winnerId });
        }
        
        // Update rank based on points
        updateUserRank(req.db.data.users[loserIndex].divisions[divisionId]);
      }
    }
    
    // Update draw stats
    if (isDraw && winnerId && loserId) {
      const user1Index = req.db.data.users.findIndex(u => u.id === winnerId);
      const user2Index = req.db.data.users.findIndex(u => u.id === loserId);
      
      if (user1Index !== -1 && req.db.data.users[user1Index].divisions?.[divisionId]) {
        req.db.data.users[user1Index].divisions[divisionId].draws += 1;
        req.db.data.users[user1Index].divisions[divisionId].points += 1;
      }
      
      if (user2Index !== -1 && req.db.data.users[user2Index].divisions?.[divisionId]) {
        req.db.data.users[user2Index].divisions[divisionId].draws += 1;
        req.db.data.users[user2Index].divisions[divisionId].points += 1;
      }
    }
    
    await req.db.write();
    
    res.json({ message: 'Ranking updated successfully' });
  } catch (error) {
    console.error('Error updating ranking:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get division champion
router.get('/:divisionId/champion', async (req, res) => {
  try {
    await req.db.read();
    const { divisionId } = req.params;
    
    // Find the champion in this division
    const champion = req.db.data.users.find(user => 
      user.divisions && 
      user.divisions[divisionId] && 
      user.divisions[divisionId].isChampion
    );
    
    if (!champion) {
      return res.json({ champion: null });
    }
    
    res.json({
      champion: {
        id: champion.id,
        username: champion.username,
        profilePicture: champion.profilePicture,
        title: champion.title,
        team: champion.divisions[divisionId].team,
        stats: {
          wins: champion.divisions[divisionId].wins,
          losses: champion.divisions[divisionId].losses,
          draws: champion.divisions[divisionId].draws,
          points: champion.divisions[divisionId].points,
          rank: champion.divisions[divisionId].rank
        },
        championSince: champion.divisions[divisionId].championSince
      }
    });
  } catch (error) {
    console.error('Error fetching division champion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's division achievements
router.get('/:divisionId/achievements/:userId', async (req, res) => {
  try {
    await req.db.read();
    const { divisionId, userId } = req.params;
    
    const user = req.db.data.users.find(u => u.id === userId);
    if (!user || !user.divisions?.[divisionId]) {
      return res.status(404).json({ message: 'User not found in division' });
    }
    
    const divisionData = user.divisions[divisionId];
    const achievements = [];
    
    // Check for various achievements
    if (divisionData.wins >= 10) {
      achievements.push({
        id: 'veteran',
        name: 'Division Veteran',
        description: 'Win 10 fights in this division',
        icon: '🏆',
        unlocked: true
      });
    }
    
    if (divisionData.streak >= 5) {
      achievements.push({
        id: 'streak',
        name: 'Winning Streak',
        description: 'Win 5 fights in a row',
        icon: '🔥',
        unlocked: true
      });
    }
    
    if (divisionData.isChampion) {
      achievements.push({
        id: 'champion',
        name: 'Division Champion',
        description: 'Become the champion of this division',
        icon: '👑',
        unlocked: true
      });
    }
    
    if (divisionData.points >= 100) {
      achievements.push({
        id: 'elite',
        name: 'Elite Fighter',
        description: 'Reach 100 points in this division',
        icon: '⚡',
        unlocked: true
      });
    }
    
    res.json({ achievements });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to update user rank based on points
function updateUserRank(divisionData) {
  const points = divisionData.points;
  
  if (points >= 200) {
    divisionData.rank = 'Legend';
  } else if (points >= 150) {
    divisionData.rank = 'Master';
  } else if (points >= 100) {
    divisionData.rank = 'Elite';
  } else if (points >= 50) {
    divisionData.rank = 'Veteran';
  } else if (points >= 20) {
    divisionData.rank = 'Fighter';
  } else if (points >= 10) {
    divisionData.rank = 'Novice';
  } else {
    divisionData.rank = 'Rookie';
  }
}

// @desc    Create a contender match for a division
// @route   POST api/divisions/:divisionId/contender-match
// @access  Private (Moderator only)
router.post('/:divisionId/contender-match', auth, async (req, res) => {
  try {
    const { divisionId } = req.params;
    const { challenger1Id, challenger2Id, description } = req.body;
    
    await req.db.read();
    
    // Check if user is moderator
    const currentUser = req.db.data.users.find(u => u.id === req.user.id);
    if (!currentUser || currentUser.role !== 'moderator') {
      return res.status(403).json({ msg: 'Only moderators can create contender matches' });
    }
    
    // Validate division exists
    if (!req.db.data.divisions[divisionId]) {
      return res.status(404).json({ msg: 'Division not found' });
    }
    
    // Get challenger users
    const challenger1 = req.db.data.users.find(u => u.id === challenger1Id);
    const challenger2 = req.db.data.users.find(u => u.id === challenger2Id);
    
    if (!challenger1 || !challenger2) {
      return res.status(404).json({ msg: 'One or both challengers not found' });
    }
    
    // Check if challengers are in the division
    if (!challenger1.divisions?.[divisionId] || !challenger2.divisions?.[divisionId]) {
      return res.status(400).json({ msg: 'Both challengers must be in the division' });
    }
    
    // Create contender match as an official fight post
    const newContenderMatch = {
      id: require('uuid').v4(),
      title: `#1 Contender Match: ${challenger1.username} vs ${challenger2.username}`,
      content: description || `Winner becomes the #1 contender for the ${req.db.data.divisions[divisionId].name} Championship`,
      type: 'fight',
      authorId: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likes: [],
      comments: [],
      views: 0,
      photos: [],
      poll: {
        options: [
          `${challenger1.username} (${challenger1.divisions[divisionId].team.mainCharacter.name})`,
          `${challenger2.username} (${challenger2.divisions[divisionId].team.mainCharacter.name})`
        ],
        votes: {
          voters: []
        }
      },
      fight: {
        teamA: `${challenger1.username} (${challenger1.divisions[divisionId].team.mainCharacter.name})`,
        teamB: `${challenger2.username} (${challenger2.divisions[divisionId].team.mainCharacter.name})`,
        votes: {
          teamA: 0,
          teamB: 0,
          voters: []
        },
        status: 'active',
        isOfficial: true,
        lockTime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
        winner: null,
        winnerTeam: null
      },
      isOfficial: true,
      moderatorCreated: true,
      category: divisionId,
      featured: true,
      isContenderMatch: true,
      contenderMatchData: {
        divisionId,
        challenger1Id,
        challenger2Id,
        winnerGetsShot: true
      },
      tags: [`${divisionId}-division`, 'contender-match', 'title-shot']
    };
    
    req.db.data.posts.push(newContenderMatch);
    
    // Store reference in divisions data
    if (!req.db.data.divisions[divisionId].contenderMatches) {
      req.db.data.divisions[divisionId].contenderMatches = [];
    }
    req.db.data.divisions[divisionId].contenderMatches.push({
      matchId: newContenderMatch.id,
      challenger1Id,
      challenger2Id,
      createdAt: newContenderMatch.createdAt,
      status: 'active'
    });
    
    await req.db.write();
    
    res.json({ 
      msg: 'Contender match created successfully',
      match: newContenderMatch
    });
  } catch (error) {
    console.error('Error creating contender match:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// @desc    Get active contender matches for a division
// @route   GET api/divisions/:divisionId/contender-matches
// @access  Public
router.get('/:divisionId/contender-matches', async (req, res) => {
  try {
    const { divisionId } = req.params;
    
    await req.db.read();
    
    // Get all contender matches for this division
    const contenderMatches = req.db.data.posts.filter(post => 
      post.isContenderMatch && 
      post.contenderMatchData?.divisionId === divisionId
    );
    
    // Add user info to matches
    const matchesWithUserInfo = contenderMatches.map(match => {
      const challenger1 = req.db.data.users.find(u => u.id === match.contenderMatchData.challenger1Id);
      const challenger2 = req.db.data.users.find(u => u.id === match.contenderMatchData.challenger2Id);
      
      return {
        ...match,
        challenger1: {
          id: challenger1?.id,
          username: challenger1?.username,
          profilePicture: challenger1?.profile?.profilePicture,
          divisionStats: challenger1?.divisions?.[divisionId]
        },
        challenger2: {
          id: challenger2?.id,
          username: challenger2?.username,
          profilePicture: challenger2?.profile?.profilePicture,
          divisionStats: challenger2?.divisions?.[divisionId]
        }
      };
    });
    
    res.json(matchesWithUserInfo);
  } catch (error) {
    console.error('Error fetching contender matches:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// @desc    Create title match after contender wins
// @route   POST api/divisions/:divisionId/title-match
// @access  Private (Moderator only)
router.post('/:divisionId/title-match', auth, async (req, res) => {
  try {
    const { divisionId } = req.params;
    const { challengerId, description } = req.body;
    
    await req.db.read();
    
    // Check if user is moderator
    const currentUser = req.db.data.users.find(u => u.id === req.user.id);
    if (!currentUser || currentUser.role !== 'moderator') {
      return res.status(403).json({ msg: 'Only moderators can create title matches' });
    }
    
    // Get division and champion
    const division = req.db.data.divisions[divisionId];
    if (!division || !division.champion) {
      return res.status(400).json({ msg: 'Division has no champion' });
    }
    
    const champion = req.db.data.users.find(u => u.id === division.champion);
    const challenger = req.db.data.users.find(u => u.id === challengerId);
    
    if (!champion || !challenger) {
      return res.status(404).json({ msg: 'Champion or challenger not found' });
    }
    
    // Create title match
    const newTitleMatch = {
      id: require('uuid').v4(),
      title: `${division.name} Championship: ${champion.username} (c) vs ${challenger.username}`,
      content: description || `Championship match for the ${division.name} title!`,
      type: 'fight',
      authorId: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likes: [],
      comments: [],
      views: 0,
      photos: [],
      poll: {
        options: [
          `${champion.username} (c) - ${champion.divisions[divisionId].team.mainCharacter.name}`,
          `${challenger.username} - ${challenger.divisions[divisionId].team.mainCharacter.name}`
        ],
        votes: {
          voters: []
        }
      },
      fight: {
        teamA: `${champion.username} (c) - ${champion.divisions[divisionId].team.mainCharacter.name}`,
        teamB: `${challenger.username} - ${challenger.divisions[divisionId].team.mainCharacter.name}`,
        votes: {
          teamA: 0,
          teamB: 0,
          voters: []
        },
        status: 'active',
        isOfficial: true,
        lockTime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
        winner: null,
        winnerTeam: null
      },
      isOfficial: true,
      moderatorCreated: true,
      category: divisionId,
      featured: true,
      isTitleMatch: true,
      titleMatchData: {
        divisionId,
        championId: champion.id,
        challengerId,
        titleOnTheLine: true
      },
      tags: [`${divisionId}-division`, 'title-match', 'championship']
    };
    
    req.db.data.posts.push(newTitleMatch);
    
    // Store reference in champion's data
    const champIndex = req.db.data.users.findIndex(u => u.id === champion.id);
    if (champIndex !== -1) {
      if (!req.db.data.users[champIndex].divisions[divisionId].titleDefenses) {
        req.db.data.users[champIndex].divisions[divisionId].titleDefenses = [];
      }
      req.db.data.users[champIndex].divisions[divisionId].titleDefenses.push({
        matchId: newTitleMatch.id,
        challengerId,
        date: newTitleMatch.createdAt,
        status: 'scheduled'
      });
    }
    
    await req.db.write();
    
    res.json({ 
      msg: 'Title match created successfully',
      match: newTitleMatch
    });
  } catch (error) {
    console.error('Error creating title match:', error);
    res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

module.exports = router;
