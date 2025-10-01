import Post from '../models/Post.js';
import User from '../models/User.js';
import Badge from '../models/Badge.js';
import UserBadge from '../models/UserBadge.js';
import Notification from '../models/Notification.js';

// Check and lock expired fights
async function checkAndLockExpiredFights() {
  try {
    const now = new Date();
    let updatedCount = 0;

    // Find all active fight posts that have exceeded their lock time
    const activeFights = await Post.find({
      type: 'fight',
      'fight.status': 'active',
      'fight.lockTime': { $lte: now }
    }).populate('authorId');

    for (const fight of activeFights) {
      // Calculate winner
      const teamAVotes = fight.fight?.votes?.teamA || 0;
      const teamBVotes = fight.fight?.votes?.teamB || 0;

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
      fight.fight.lockedAt = now;
      fight.fight.finalVotes = {
        teamA: teamAVotes,
        teamB: teamBVotes,
        total: teamAVotes + teamBVotes
      };

      await fight.save();

      // Update user records for official fights
      if (fight.isOfficial) {
        await updateUserRecords(fight);
      }

      // Award points to users who voted for the winner
      if (winnerTeam !== 'draw' && fight.fight.votes?.voters) {
        await awardPointsToWinners(fight, winnerTeam);
      }

      // Award badges for achievements
      if (fight.fight.votes?.voters) {
        await checkAndAwardBadges(fight);
      }

      // Handle special match types
      if (fight.isContenderMatch) {
        await handleContenderMatchResult(fight, winnerTeam);
      }

      if (fight.isTitleMatch) {
        await handleTitleMatchResult(fight, winnerTeam);
      }

      // Create notification for fight author
      if (fight.authorId) {
        await Notification.create({
          userId: fight.authorId._id,
          type: 'fight_result',
          message: `Your fight "${fight.title}" has ended. Result: ${winnerTeam === 'draw' ? 'Draw' : `Team ${winnerTeam === 'teamA' ? 'A' : 'B'} wins!`}`,
          relatedPost: fight._id,
          read: false
        });
      }

      updatedCount++;
    }

    if (updatedCount > 0) {
      console.log(`Locked ${updatedCount} expired fights at ${now.toISOString()}`);
    }

  } catch (error) {
    console.error('Error in fight scheduler:', error);
  }
}

// Update user records based on fight results
async function updateUserRecords(fight) {
  try {
    if (!fight.fight?.votes?.voters) return;

    const teamAVoters = fight.fight.votes.voters
      .filter(v => v.team === 'A' || v.team === 'teamA')
      .map(v => v.userId);
    const teamBVoters = fight.fight.votes.voters
      .filter(v => v.team === 'B' || v.team === 'teamB')
      .map(v => v.userId);

    const winnerTeam = fight.fight.winnerTeam;

    // Update stats for team A voters
    for (const userId of teamAVoters) {
      const user = await User.findById(userId);
      if (!user) continue;

      if (!user.stats) {
        user.stats = {
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

      user.stats.totalFights += 1;

      if (winnerTeam === 'teamA') {
        user.stats.fightsWon += 1;
        user.stats.experience += 25;
        user.stats.points += 15;
      } else if (winnerTeam === 'teamB') {
        user.stats.fightsLost += 1;
        user.stats.experience += 10;
      } else {
        user.stats.fightsDrawn += 1;
        user.stats.experience += 15;
        user.stats.points += 5;
      }

      // Update win rate
      user.stats.winRate = user.stats.totalFights > 0 ?
        (user.stats.fightsWon / user.stats.totalFights) * 100 : 0;

      await user.save();
    }

    // Update stats for team B voters
    for (const userId of teamBVoters) {
      const user = await User.findById(userId);
      if (!user) continue;

      if (!user.stats) {
        user.stats = {
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

      user.stats.totalFights += 1;

      if (winnerTeam === 'teamB') {
        user.stats.fightsWon += 1;
        user.stats.experience += 25;
        user.stats.points += 15;
      } else if (winnerTeam === 'teamA') {
        user.stats.fightsLost += 1;
        user.stats.experience += 10;
      } else {
        user.stats.fightsDrawn += 1;
        user.stats.experience += 15;
        user.stats.points += 5;
      }

      // Update win rate
      user.stats.winRate = user.stats.totalFights > 0 ?
        (user.stats.fightsWon / user.stats.totalFights) * 100 : 0;

      await user.save();
    }
  } catch (error) {
    console.error('Error updating user records:', error);
  }
}

// Award points to users who voted for the winning team
async function awardPointsToWinners(fight, winnerTeam) {
  try {
    const winningVoters = fight.fight.votes.voters.filter(v =>
      (winnerTeam === 'teamA' && (v.team === 'A' || v.team === 'teamA')) ||
      (winnerTeam === 'teamB' && (v.team === 'B' || v.team === 'teamB'))
    );

    for (const voter of winningVoters) {
      const user = await User.findById(voter.userId);
      if (!user) continue;

      if (!user.stats) {
        user.stats = { points: 0, experience: 0 };
      }

      // Award bonus points for correct prediction
      user.stats.points = (user.stats.points || 0) + 5;
      user.stats.experience = (user.stats.experience || 0) + 5;

      await user.save();
    }
  } catch (error) {
    console.error('Error awarding points:', error);
  }
}

// Check and award badges based on achievements
async function checkAndAwardBadges(fight) {
  try {
    const allVoters = fight.fight.votes.voters.map(v => v.userId);

    for (const userId of allVoters) {
      const user = await User.findById(userId);
      if (!user) continue;

      if (!user.achievements) user.achievements = [];

      const totalFights = user.stats?.totalFights || 0;
      const wins = user.stats?.fightsWon || 0;

      // Check for fight milestones
      const badgesToAward = [];

      if (totalFights === 1 && !user.achievements.includes('first-blood')) {
        badgesToAward.push('first-blood');
        user.achievements.push('first-blood');
      }

      if (totalFights >= 10 && !user.achievements.includes('gladiator')) {
        badgesToAward.push('gladiator');
        user.achievements.push('gladiator');
      }

      if (wins >= 10 && user.stats?.fightsLost === 0 && !user.achievements.includes('undefeated')) {
        badgesToAward.push('undefeated');
        user.achievements.push('undefeated');
      }

      if (badgesToAward.length > 0) {
        await user.save();

        // Create notifications for new badges
        for (const badgeId of badgesToAward) {
          await Notification.create({
            userId: user._id,
            type: 'badge_earned',
            message: `You've earned a new badge: ${badgeId}!`,
            read: false
          });
        }
      }
    }
  } catch (error) {
    console.error('Error awarding badges:', error);
  }
}

// Handle contender match results
async function handleContenderMatchResult(fight, winnerTeam) {
  try {
    const { divisionId, challenger1Id, challenger2Id } = fight.contenderMatchData || {};
    if (!divisionId) return;

    const winnerId = winnerTeam === 'teamA' ? challenger1Id : challenger2Id;

    // Mark winner as #1 contender
    const winner = await User.findById(winnerId);
    if (winner && winner.divisions) {
      const divisionData = winner.divisions.get(divisionId);
      if (divisionData) {
        divisionData.contenderStatus = {
          isNumberOneContender: true,
          earnedAt: new Date(),
          fromMatchId: fight._id
        };
        winner.divisions.set(divisionId, divisionData);
        await winner.save();

        // Award contender achievement
        if (!winner.achievements) winner.achievements = [];
        if (!winner.achievements.includes('contender')) {
          winner.achievements.push('contender');
          await winner.save();

          await Notification.create({
            userId: winner._id,
            type: 'contender_status',
            message: `You are now the #1 contender in the ${divisionId} division!`,
            read: false
          });
        }
      }
    }
  } catch (error) {
    console.error('Error handling contender match:', error);
  }
}

// Handle title match results
async function handleTitleMatchResult(fight, winnerTeam) {
  try {
    const { divisionId, championId, challengerId } = fight.titleMatchData || {};
    if (!divisionId) return;

    const winnerId = winnerTeam === 'teamA' ? championId : challengerId;
    const loserId = winnerId === championId ? challengerId : championId;

    // If challenger won, transfer the title
    if (winnerId === challengerId) {
      // Remove champion status from previous champion
      const previousChamp = await User.findById(championId);
      if (previousChamp && previousChamp.divisions) {
        const divisionData = previousChamp.divisions.get(divisionId);
        if (divisionData) {
          divisionData.isChampion = false;
          divisionData.championTitle = null;
          divisionData.championSince = null;
          previousChamp.divisions.set(divisionId, divisionData);
          await previousChamp.save();
        }
      }

      // Crown new champion
      const newChamp = await User.findById(challengerId);
      if (newChamp && newChamp.divisions) {
        const divisionData = newChamp.divisions.get(divisionId) || {};
        divisionData.isChampion = true;
        divisionData.championTitle = `${divisionId.charAt(0).toUpperCase() + divisionId.slice(1)} Champion`;
        divisionData.championSince = new Date();
        divisionData.titleDefenses = 0;
        newChamp.divisions.set(divisionId, divisionData);

        // Award championship achievement
        if (!newChamp.achievements) newChamp.achievements = [];
        const championAchievement = `${divisionId}-champion`;
        if (!newChamp.achievements.includes(championAchievement)) {
          newChamp.achievements.push(championAchievement);
        }

        await newChamp.save();

        await Notification.create({
          userId: newChamp._id,
          type: 'championship_won',
          message: `Congratulations! You are now the ${divisionId} Champion!`,
          read: false
        });
      }
    } else {
      // Champion retained, increment defense count
      const champ = await User.findById(championId);
      if (champ && champ.divisions) {
        const divisionData = champ.divisions.get(divisionId);
        if (divisionData && divisionData.isChampion) {
          divisionData.titleDefenses = (divisionData.titleDefenses || 0) + 1;
          champ.divisions.set(divisionId, divisionData);

          // Award defense milestone achievements
          const defenseCount = divisionData.titleDefenses;
          if (!champ.achievements) champ.achievements = [];

          if (defenseCount >= 3 && !champ.achievements.includes('defender-bronze')) {
            champ.achievements.push('defender-bronze');
          }
          if (defenseCount >= 5 && !champ.achievements.includes('defender-silver')) {
            champ.achievements.push('defender-silver');
          }
          if (defenseCount >= 10 && !champ.achievements.includes('defender-gold')) {
            champ.achievements.push('defender-gold');
          }

          await champ.save();
        }
      }
    }
  } catch (error) {
    console.error('Error handling title match:', error);
  }
}

// Run the scheduler every 5 minutes
async function startScheduler() {
  console.log('Starting fight scheduler...');

  // Run immediately on start
  await checkAndLockExpiredFights();

  // Then run every 5 minutes
  setInterval(checkAndLockExpiredFights, 5 * 60 * 1000);
}

export { startScheduler, checkAndLockExpiredFights };
