const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

// Configure lowdb
const file = path.join(__dirname, '..', 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

// Check and lock expired fights
async function checkAndLockExpiredFights() {
  try {
    await db.read();
    
    const now = new Date();
    let updatedCount = 0;
    
    // Find all active fight posts that have exceeded their lock time
    const activeFights = db.data.posts.filter(post => 
      post.type === 'fight' && 
      post.fight && 
      post.fight.status === 'active' &&
      post.fight.lockTime &&
      new Date(post.fight.lockTime) <= now
    );
    
    for (const fight of activeFights) {
      // Calculate winner
      const teamAVotes = fight.fight.votes.teamA || 0;
      const teamBVotes = fight.fight.votes.teamB || 0;
      
      let winnerTeam;
      if (teamAVotes > teamBVotes) {
        winnerTeam = 'teamA';
      } else if (teamBVotes > teamAVotes) {
        winnerTeam = 'teamB';
      } else {
        winnerTeam = 'draw';
      }
      
      // Update fight status
      fight.fight.status = 'locked';
      fight.fight.winnerTeam = winnerTeam;
      fight.fight.lockedAt = now.toISOString();
      fight.fight.finalVotes = {
        teamA: teamAVotes,
        teamB: teamBVotes,
        total: teamAVotes + teamBVotes
      };
      
      // Update user records for official fights
      if (fight.isOfficial) {
        await updateUserRecords(fight, db);
      }
      
      // Award points to users who voted for the winner
      if (winnerTeam !== 'draw') {
        await awardPointsToWinners(fight, winnerTeam, db);
      }
      
      // Award badges for achievements
      await checkAndAwardBadges(fight, db);
      
      // Handle special match types
      if (fight.isContenderMatch) {
        await handleContenderMatchResult(fight, winnerTeam, db);
      }
      
      if (fight.isTitleMatch) {
        await handleTitleMatchResult(fight, winnerTeam, db);
      }
      
      updatedCount++;
    }
    
    if (updatedCount > 0) {
      await db.write();
      console.log(`Locked ${updatedCount} expired fights at ${now.toISOString()}`);
    }
    
  } catch (error) {
    console.error('Error in fight scheduler:', error);
  }
}

// Update user records based on fight results
async function updateUserRecords(fight, db) {
  // Get all voters
  const teamAVoters = fight.fight.votes.voters.filter(v => v.team === 'A').map(v => v.userId);
  const teamBVoters = fight.fight.votes.voters.filter(v => v.team === 'B').map(v => v.userId);
  
  const winnerTeam = fight.fight.winnerTeam;
  
  // Update stats for team A voters
  for (const userId of teamAVoters) {
    const userIndex = db.data.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      if (!db.data.users[userIndex].stats) {
        db.data.users[userIndex].stats = {
          fightsWon: 0,
          fightsLost: 0,
          fightsDrawn: 0,
          fightsNoContest: 0,
          totalFights: 0,
          winRate: 0,
          experience: 0,
          points: 0
        };
      }
      
      db.data.users[userIndex].stats.totalFights += 1;
      
      if (winnerTeam === 'teamA') {
        db.data.users[userIndex].stats.fightsWon += 1;
        db.data.users[userIndex].stats.experience += 25; // Win XP
        db.data.users[userIndex].stats.points += 15; // Win points
      } else if (winnerTeam === 'teamB') {
        db.data.users[userIndex].stats.fightsLost += 1;
        db.data.users[userIndex].stats.experience += 10; // Loss XP
      } else {
        db.data.users[userIndex].stats.fightsDrawn += 1;
        db.data.users[userIndex].stats.experience += 15; // Draw XP
        db.data.users[userIndex].stats.points += 5; // Draw points
      }
      
      // Update win rate
      const stats = db.data.users[userIndex].stats;
      stats.winRate = stats.totalFights > 0 ? 
        ((stats.fightsWon / stats.totalFights) * 100).toFixed(1) : 0;
    }
  }
  
  // Update stats for team B voters
  for (const userId of teamBVoters) {
    const userIndex = db.data.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      if (!db.data.users[userIndex].stats) {
        db.data.users[userIndex].stats = {
          fightsWon: 0,
          fightsLost: 0,
          fightsDrawn: 0,
          fightsNoContest: 0,
          totalFights: 0,
          winRate: 0,
          experience: 0,
          points: 0
        };
      }
      
      db.data.users[userIndex].stats.totalFights += 1;
      
      if (winnerTeam === 'teamB') {
        db.data.users[userIndex].stats.fightsWon += 1;
        db.data.users[userIndex].stats.experience += 25; // Win XP
        db.data.users[userIndex].stats.points += 15; // Win points
      } else if (winnerTeam === 'teamA') {
        db.data.users[userIndex].stats.fightsLost += 1;
        db.data.users[userIndex].stats.experience += 10; // Loss XP
      } else {
        db.data.users[userIndex].stats.fightsDrawn += 1;
        db.data.users[userIndex].stats.experience += 15; // Draw XP
        db.data.users[userIndex].stats.points += 5; // Draw points
      }
      
      // Update win rate
      const stats = db.data.users[userIndex].stats;
      stats.winRate = stats.totalFights > 0 ? 
        ((stats.fightsWon / stats.totalFights) * 100).toFixed(1) : 0;
    }
  }
}

// Award points to users who voted for the winning team
async function awardPointsToWinners(fight, winnerTeam, db) {
  const winningVoters = fight.fight.votes.voters.filter(v => 
    (winnerTeam === 'teamA' && v.team === 'A') || 
    (winnerTeam === 'teamB' && v.team === 'B')
  );
  
  for (const voter of winningVoters) {
    const userIndex = db.data.users.findIndex(u => u.id === voter.userId);
    if (userIndex !== -1) {
      if (!db.data.users[userIndex].stats) {
        db.data.users[userIndex].stats = { points: 0, experience: 0 };
      }
      
      // Award bonus points for correct prediction
      db.data.users[userIndex].stats.points = (db.data.users[userIndex].stats.points || 0) + 5;
      db.data.users[userIndex].stats.experience = (db.data.users[userIndex].stats.experience || 0) + 5;
    }
  }
}

// Check and award badges based on achievements
async function checkAndAwardBadges(fight, db) {
  // This will be used by the badge system to award fight-related badges
  const allVoters = fight.fight.votes.voters.map(v => v.userId);
  
  for (const userId of allVoters) {
    const userIndex = db.data.users.findIndex(u => u.id === userId);
    if (userIndex === -1) continue;
    
    const user = db.data.users[userIndex];
    if (!user.badges) user.badges = [];
    
    // Check for fight milestones
    const totalFights = user.stats?.totalFights || 0;
    const wins = user.stats?.fightsWon || 0;
    
    // First Blood - First official fight
    if (totalFights === 1 && !user.badges.some(b => b.id === 'first-blood')) {
      user.badges.push({
        id: 'first-blood',
        awardedAt: new Date().toISOString()
      });
    }
    
    // Gladiator - 10 official fights
    if (totalFights >= 10 && !user.badges.some(b => b.id === 'gladiator')) {
      user.badges.push({
        id: 'gladiator',
        awardedAt: new Date().toISOString()
      });
    }
    
    // Undefeated - 10 wins, 0 losses
    if (wins >= 10 && user.stats?.fightsLost === 0 && !user.badges.some(b => b.id === 'undefeated')) {
      user.badges.push({
        id: 'undefeated',
        awardedAt: new Date().toISOString()
      });
    }
  }
}

// Handle contender match results
async function handleContenderMatchResult(fight, winnerTeam, db) {
  const { divisionId, challenger1Id, challenger2Id } = fight.contenderMatchData;
  const winnerId = winnerTeam === 'teamA' ? challenger1Id : challenger2Id;
  
  // Update the contender match status in division
  const divisionIndex = Object.keys(db.data.divisions).indexOf(divisionId);
  if (divisionIndex !== -1) {
    const contenderMatch = db.data.divisions[divisionId].contenderMatches?.find(
      cm => cm.matchId === fight.id
    );
    if (contenderMatch) {
      contenderMatch.status = 'completed';
      contenderMatch.winnerId = winnerId;
      contenderMatch.completedAt = new Date().toISOString();
    }
    
    // Mark winner as #1 contender
    const winnerIndex = db.data.users.findIndex(u => u.id === winnerId);
    if (winnerIndex !== -1) {
      if (!db.data.users[winnerIndex].divisions[divisionId].contenderStatus) {
        db.data.users[winnerIndex].divisions[divisionId].contenderStatus = {};
      }
      db.data.users[winnerIndex].divisions[divisionId].contenderStatus = {
        isNumberOneContender: true,
        earnedAt: new Date().toISOString(),
        fromMatchId: fight.id
      };
      
      // Award badge
      if (!db.data.users[winnerIndex].badges) {
        db.data.users[winnerIndex].badges = [];
      }
      if (!db.data.users[winnerIndex].badges.some(b => b.id === 'contender')) {
        db.data.users[winnerIndex].badges.push({
          id: 'contender',
          awardedAt: new Date().toISOString()
        });
      }
    }
  }
}

// Handle title match results
async function handleTitleMatchResult(fight, winnerTeam, db) {
  const { divisionId, championId, challengerId } = fight.titleMatchData;
  const winnerId = winnerTeam === 'teamA' ? championId : challengerId;
  const loserId = winnerId === championId ? challengerId : championId;
  
  // Update title defense record
  const champIndex = db.data.users.findIndex(u => u.id === championId);
  if (champIndex !== -1) {
    const defenseRecord = db.data.users[champIndex].divisions[divisionId].titleDefenses?.find(
      td => td.matchId === fight.id
    );
    if (defenseRecord) {
      defenseRecord.status = 'completed';
      defenseRecord.result = winnerId === championId ? 'defended' : 'lost';
      defenseRecord.completedAt = new Date().toISOString();
    }
  }
  
  // If challenger won, transfer the title
  if (winnerId === challengerId) {
    // Record previous champion's reign in history
    const previousChamp = db.data.users.find(u => u.id === championId);
    if (previousChamp) {
      const reignStart = previousChamp.divisions[divisionId].championSince;
      const reignEnd = new Date().toISOString();
      const defenses = previousChamp.divisions[divisionId].titleDefenses?.filter(
        td => td.result === 'defended'
      ).length || 0;
      
      if (!db.data.championshipHistory[divisionId]) {
        db.data.championshipHistory[divisionId] = [];
      }
      
      db.data.championshipHistory[divisionId].push({
        userId: championId,
        username: previousChamp.username,
        team: previousChamp.divisions[divisionId].team,
        startDate: reignStart,
        endDate: reignEnd,
        reignDuration: Math.floor((new Date(reignEnd) - new Date(reignStart)) / (1000 * 60 * 60 * 24)),
        titleDefenses: defenses,
        totalFights: previousChamp.divisions[divisionId].wins + 
                     previousChamp.divisions[divisionId].losses + 
                     previousChamp.divisions[divisionId].draws,
        lostToUserId: challengerId,
        lostToUsername: db.data.users.find(u => u.id === challengerId)?.username
      });
      
      // Remove champion status from previous champion
      previousChamp.divisions[divisionId].isChampion = false;
      previousChamp.divisions[divisionId].championTitle = null;
      previousChamp.divisions[divisionId].championSince = null;
      previousChamp.divisions[divisionId].titleDefenses = [];
    }
    
    // Crown new champion
    const newChampIndex = db.data.users.findIndex(u => u.id === challengerId);
    if (newChampIndex !== -1) {
      db.data.users[newChampIndex].divisions[divisionId].isChampion = true;
      db.data.users[newChampIndex].divisions[divisionId].championTitle = 
        `${divisionId.charAt(0).toUpperCase() + divisionId.slice(1)} Champion`;
      db.data.users[newChampIndex].divisions[divisionId].championSince = new Date().toISOString();
      db.data.users[newChampIndex].divisions[divisionId].titleDefenses = [];
      
      // Update division champion reference
      db.data.divisions[divisionId].champion = challengerId;
      
      // Award championship badge
      if (!db.data.users[newChampIndex].badges) {
        db.data.users[newChampIndex].badges = [];
      }
      
      const championBadgeId = `${divisionId}-champion`;
      if (!db.data.users[newChampIndex].badges.some(b => b.id === championBadgeId)) {
        db.data.users[newChampIndex].badges.push({
          id: championBadgeId,
          awardedAt: new Date().toISOString()
        });
      }
      
      // Remove contender status
      if (db.data.users[newChampIndex].divisions[divisionId].contenderStatus) {
        db.data.users[newChampIndex].divisions[divisionId].contenderStatus.isNumberOneContender = false;
      }
    }
  } else {
    // Champion retained, increment defense count
    const champUser = db.data.users[champIndex];
    if (champUser && champUser.divisions[divisionId].isChampion) {
      if (!champUser.divisions[divisionId].titleDefenses) {
        champUser.divisions[divisionId].titleDefenses = [];
      }
      champUser.divisions[divisionId].titleDefenseCount = 
        (champUser.divisions[divisionId].titleDefenseCount || 0) + 1;
        
      // Award defense milestone badges
      const defenseCount = champUser.divisions[divisionId].titleDefenseCount;
      if (!champUser.badges) champUser.badges = [];
      
      if (defenseCount >= 3 && !champUser.badges.some(b => b.id === 'defender-bronze')) {
        champUser.badges.push({
          id: 'defender-bronze',
          awardedAt: new Date().toISOString()
        });
      }
      if (defenseCount >= 5 && !champUser.badges.some(b => b.id === 'defender-silver')) {
        champUser.badges.push({
          id: 'defender-silver',
          awardedAt: new Date().toISOString()
        });
      }
      if (defenseCount >= 10 && !champUser.badges.some(b => b.id === 'defender-gold')) {
        champUser.badges.push({
          id: 'defender-gold',
          awardedAt: new Date().toISOString()
        });
      }
    }
  }
}

// Run the scheduler every 5 minutes
function startScheduler() {
  console.log('Starting fight scheduler...');
  
  // Run immediately on start
  checkAndLockExpiredFights();
  
  // Then run every 5 minutes
  setInterval(checkAndLockExpiredFights, 5 * 60 * 1000);
}

module.exports = {
  startScheduler,
  checkAndLockExpiredFights
}; 