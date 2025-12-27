import { readDb, updateDb } from '../services/jsonDb.js';
import { getRankInfo, syncRankFromPoints } from '../utils/rankSystem.js';

// Achievement definitions
const ACHIEVEMENTS = {
  // Tournament achievements
  TOURNAMENT_WINNER: {
    id: 'tournament_winner',
    name: 'Tournament Champion',
    description: 'Win your first tournament',
    type: 'tournament',
    requirement: 1,
    reward: { experience: 100, points: 50 }
  },
  TOURNAMENT_MASTER: {
    id: 'tournament_master',
    name: 'Tournament Master',
    description: 'Win 5 tournaments',
    type: 'tournament',
    requirement: 5,
    reward: { experience: 500, points: 250 }
  },
  TOURNAMENT_LEGEND: {
    id: 'tournament_legend',
    name: 'Tournament Legend',
    description: 'Win 10 tournaments',
    type: 'tournament',
    requirement: 10,
    reward: { experience: 1000, points: 500 }
  },
  
  // Fight achievements
  FIRST_FIGHT: {
    id: 'first_fight',
    name: 'First Blood',
    description: 'Participate in your first fight',
    type: 'fight',
    requirement: 1,
    reward: { experience: 10, points: 5 }
  },
  FIGHT_VETERAN: {
    id: 'fight_veteran',
    name: 'Fight Veteran',
    description: 'Participate in 50 fights',
    type: 'fight',
    requirement: 50,
    reward: { experience: 200, points: 100 }
  },
  FIGHT_MASTER: {
    id: 'fight_master',
    name: 'Fight Master',
    description: 'Participate in 100 fights',
    type: 'fight',
    requirement: 100,
    reward: { experience: 500, points: 250 }
  },
  
  // Voting achievements
  ACTIVE_VOTER: {
    id: 'active_voter',
    name: 'Active Voter',
    description: 'Vote in 25 fights',
    type: 'vote',
    requirement: 25,
    reward: { experience: 50, points: 25 }
  },
  VOTING_EXPERT: {
    id: 'voting_expert',
    name: 'Voting Expert',
    description: 'Vote in 100 fights',
    type: 'vote',
    requirement: 100,
    reward: { experience: 200, points: 100 }
  },
  
  // Post achievements
  FIRST_POST: {
    id: 'first_post',
    name: 'First Post',
    description: 'Create your first post',
    type: 'post',
    requirement: 1,
    reward: { experience: 5, points: 3 }
  },
  CONTENT_CREATOR: {
    id: 'content_creator',
    name: 'Content Creator',
    description: 'Create 25 posts',
    type: 'post',
    requirement: 25,
    reward: { experience: 100, points: 50 }
  },
  POST_MASTER: {
    id: 'post_master',
    name: 'Post Master',
    description: 'Create 100 posts',
    type: 'post',
    requirement: 100,
    reward: { experience: 300, points: 150 }
  },
  
  // Comment achievements
  FIRST_COMMENT: {
    id: 'first_comment',
    name: 'First Comment',
    description: 'Post your first comment',
    type: 'comment',
    requirement: 1,
    reward: { experience: 3, points: 2 }
  },
  COMMENTATOR: {
    id: 'commentator',
    name: 'Commentator',
    description: 'Post 50 comments',
    type: 'comment',
    requirement: 50,
    reward: { experience: 75, points: 40 }
  },
  
  // Streak achievements
  WINNING_STREAK_3: {
    id: 'winning_streak_3',
    name: 'Hot Streak',
    description: 'Win 3 fights in a row',
    type: 'streak',
    requirement: 3,
    reward: { experience: 30, points: 15 }
  },
  WINNING_STREAK_5: {
    id: 'winning_streak_5',
    name: 'Unstoppable',
    description: 'Win 5 fights in a row',
    type: 'streak',
    requirement: 5,
    reward: { experience: 75, points: 40 }
  },
  WINNING_STREAK_10: {
    id: 'winning_streak_10',
    name: 'Legendary Streak',
    description: 'Win 10 fights in a row',
    type: 'streak',
    requirement: 10,
    reward: { experience: 200, points: 100 }
  },
  
  // Division achievements
  DIVISION_CHAMPION: {
    id: 'division_champion',
    name: 'Division Champion',
    description: 'Become a division champion',
    type: 'division',
    requirement: 1,
    reward: { experience: 150, points: 75 }
  },
  MULTI_DIVISION_CHAMPION: {
    id: 'multi_division_champion',
    name: 'Multi-Division Champion',
    description: 'Become champion in 3 different divisions',
    type: 'division',
    requirement: 3,
    reward: { experience: 500, points: 250 }
  }
};

// Helper function to check and award achievements
function checkAndAwardAchievements(db, userId, achievementType, currentCount) {
  const user = (db.users || []).find((u) => u.id === userId || u._id === userId);
  if (!user) return [];
  
  if (!user.achievements) {
    user.achievements = [];
  }
  
  const awardedAchievements = [];
  
  // Check each achievement of the given type
  Object.values(ACHIEVEMENTS).forEach(achievement => {
    if (achievement.type === achievementType && !user.achievements.some(a => a.id === achievement.id)) {
      if (currentCount >= achievement.requirement) {
        // Award achievement
        const userAchievement = {
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          type: achievement.type,
          awardedAt: new Date().toISOString(),
          progress: currentCount,
          requirement: achievement.requirement,
          reward: achievement.reward
        };
        
        user.achievements.push(userAchievement);
        
        // Award rewards
        if (!user.stats) user.stats = { experience: 0, points: 0 };
        if (achievement.reward.experience) {
          user.stats.experience += achievement.reward.experience;
        }
        if (achievement.reward.points) {
          user.stats.points += achievement.reward.points;
          syncRankFromPoints(user);
        }
        
        awardedAchievements.push(userAchievement);
      }
    }
  });
  
  return awardedAchievements;
}

// Helper function to check streak achievements
function checkStreakAchievements(db, userId, currentStreak) {
  const user = (db.users || []).find((u) => u.id === userId || u._id === userId);
  if (!user) return [];
  
  if (!user.achievements) {
    user.achievements = [];
  }
  
  const awardedAchievements = [];
  
  // Check streak achievements
  Object.values(ACHIEVEMENTS).forEach(achievement => {
    if (achievement.type === 'streak' && !user.achievements.some(a => a.id === achievement.id)) {
      if (currentStreak >= achievement.requirement) {
        const userAchievement = {
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          type: achievement.type,
          awardedAt: new Date().toISOString(),
          progress: currentStreak,
          requirement: achievement.requirement,
          reward: achievement.reward
        };
        
        user.achievements.push(userAchievement);
        
        // Award rewards
        if (!user.stats) user.stats = { experience: 0, points: 0 };
        if (achievement.reward.experience) {
          user.stats.experience += achievement.reward.experience;
        }
        if (achievement.reward.points) {
          user.stats.points += achievement.reward.points;
          syncRankFromPoints(user);
        }
        
        awardedAchievements.push(userAchievement);
      }
    }
  });
  
  return awardedAchievements;
}

// @desc    Get site statistics
// @route   GET /api/stats/site
// @access  Public
export const getSiteStats = async (req, res) => {
  const db = await readDb();
  const totalUsers = (db.users || []).length;
  const totalFights = (db.fights || []).length;
  const activeFights = (db.fights || []).filter((f) => f.status === 'active').length;
  const totalVotes = (db.votes || []).length;
  const totalComments = (db.comments || []).length;
  const totalMessages = (db.messages || []).length;

  // Calculate most popular categories
  const categoryStats = {};
  (db.fights || []).forEach((fight) => {
    if (fight.category) {
      categoryStats[fight.category] = (categoryStats[fight.category] || 0) + 1;
    }
  });

  const mostPopularCategory = Object.keys(categoryStats).reduce((a, b) => 
    categoryStats[a] > categoryStats[b] ? a : b, 'Mixed'
  );

  // Calculate most active users (by comments and votes)
  const userActivity = {};
  (db.comments || []).forEach((comment) => {
    userActivity[comment.authorId] = (userActivity[comment.authorId] || 0) + 1;
  });
  (db.votes || []).forEach((vote) => {
    userActivity[vote.userId] = (userActivity[vote.userId] || 0) + 1;
  });

  const mostActiveUserId = Object.keys(userActivity).reduce((a, b) => 
    userActivity[a] > userActivity[b] ? a : b, null
  );

  const mostActiveUser = mostActiveUserId
    ? (db.users || []).find((u) => u.id === mostActiveUserId || u._id === mostActiveUserId)
    : null;

  res.json({
    totalUsers,
    totalFights,
    activeFights,
    totalVotes,
    totalComments,
    totalMessages,
    mostPopularCategory,
    mostActiveUser: mostActiveUser ? {
      id: mostActiveUser.id,
      username: mostActiveUser.username,
      activity: userActivity[mostActiveUserId]
    } : null,
    categoryStats
  });
};

// @desc    Get user statistics
// @route   GET /api/stats/user/:userId
// @access  Public
export const getUserStats = async (req, res) => {
  const { userId } = req.params;
  
  try {
    const db = await readDb();
    const user = (db.users || []).find((u) => u.id === userId || u._id === userId);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Calculate additional stats
    const userFights = (db.fights || []).filter(
      (fight) => Array.isArray(fight.participants) && fight.participants.some((p) => p.userId === userId)
    );
    
    const userPosts = (db.posts || []).filter((p) => p.userId === userId || p.authorId === userId);
    const userComments = (db.comments || []).filter((c) => c.userId === userId || c.authorId === userId);
    const userVotes = (db.votes || []).filter((v) => v.userId === userId);
    
    const stats = {
      ...user.stats,
      fights: {
        total: userFights.length,
        wins: userFights.filter(f => f.winner === userId).length,
        losses: userFights.filter(f => f.winner && f.winner !== userId).length,
        winRate: userFights.length > 0 ? 
          (userFights.filter(f => f.winner === userId).length / userFights.length * 100).toFixed(1) : 0
      },
      posts: userPosts.length,
      comments: userComments.length,
      votes: userVotes.length,
      achievements: user.achievements || [],
      level: Math.floor((user.stats?.experience || 0) / 100) + 1,
      experienceToNextLevel: 100 - ((user.stats?.experience || 0) % 100)
    };
    
    res.json(stats);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Get fight statistics
// @route   GET /api/stats/fight/:fightId
// @access  Public
export const getFightStats = async (req, res) => {
  const db = await readDb();

  const fightId = req.params.fightId;
  const fight = (db.fights || []).find((f) => f.id === fightId);

  if (!fight) {
    return res.status(404).json({ msg: 'Walka nie znaleziona' });
  }

  // Get vote statistics
  const fightVotes = (db.votes || []).filter((v) => v.fightId === fightId);
  const fighter1Votes = fightVotes.filter(v => v.choice === 'fighter1').length;
  const fighter2Votes = fightVotes.filter(v => v.choice === 'fighter2').length;
  const totalVotes = fightVotes.length;

  // Get comment statistics
  const fightComments = (db.comments || []).filter((c) => c.fightId === fightId);
  const totalComments = fightComments.length;
  const totalCommentLikes = fightComments.reduce((sum, comment) => 
    sum + (comment.likes || 0), 0
  );

  // Get hourly vote distribution (last 24 hours)
  const now = new Date();
  const hourlyVotes = Array(24).fill(0);
  
  fightVotes.forEach(vote => {
    const voteTime = new Date(vote.createdAt);
    const hoursDiff = Math.floor((now - voteTime) / (1000 * 60 * 60));
    if (hoursDiff >= 0 && hoursDiff < 24) {
      hourlyVotes[23 - hoursDiff]++;
    }
  });

  res.json({
    fightId,
    title: fight.title,
    status: fight.status,
    voteStats: {
      fighter1Votes,
      fighter2Votes,
      totalVotes,
      fighter1Percentage: totalVotes > 0 ? ((fighter1Votes / totalVotes) * 100).toFixed(1) : 0,
      fighter2Percentage: totalVotes > 0 ? ((fighter2Votes / totalVotes) * 100).toFixed(1) : 0
    },
    commentStats: {
      totalComments,
      totalCommentLikes,
      averageLikesPerComment: totalComments > 0 ? 
        (totalCommentLikes / totalComments).toFixed(1) : 0
    },
    engagement: {
      hourlyVotes,
      peakHour: hourlyVotes.indexOf(Math.max(...hourlyVotes)),
      engagementRate: totalVotes + totalComments
    },
    createdAt: fight.createdAt,
    endDate: fight.endDate
  });
};

export const getUserAchievements = async (req, res) => {
  const { userId } = req.params;
  
  try {
    const db = await readDb();
    const user = (db.users || []).find((u) => u.id === userId || u._id === userId);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    const achievements = user.achievements || [];
    
    // Add progress for unearned achievements
    const allAchievements = Object.values(ACHIEVEMENTS).map(achievement => {
      const earned = achievements.find(a => a.id === achievement.id);
      if (earned) {
        return {
          ...achievement,
          earned: true,
          awardedAt: earned.awardedAt,
          progress: earned.progress
        };
      } else {
        // Calculate current progress
        let progress = 0;
        switch (achievement.type) {
          case 'tournament':
            progress = user.activity?.tournamentsWon || 0;
            break;
          case 'fight':
            progress = user.activity?.fightsParticipated || 0;
            break;
          case 'vote':
            progress = user.activity?.votesGiven || 0;
            break;
          case 'post':
            progress = user.activity?.postsCreated || 0;
            break;
          case 'comment':
            progress = user.activity?.commentsPosted || 0;
            break;
          case 'division':
            progress = user.achievements?.filter(a => a.id.includes('division_champion')).length || 0;
            break;
          default:
            progress = 0;
        }
        
        return {
          ...achievement,
          earned: false,
          progress,
          awardedAt: null
        };
      }
    });
    
    res.json(allAchievements);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const awardAchievement = async (req, res) => {
  const { userId, achievementType, currentCount } = req.body;
  
  try {
    let awardedAchievements = [];
    await updateDb((data) => {
      awardedAchievements = checkAndAwardAchievements(data, userId, achievementType, currentCount);
      return data;
    });
    
    res.json({ 
      awardedAchievements,
      message: awardedAchievements.length > 0 ? 'Achievements awarded!' : 'No new achievements'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const awardStreakAchievement = async (req, res) => {
  const { userId, currentStreak } = req.body;
  
  try {
    let awardedAchievements = [];
    await updateDb((data) => {
      awardedAchievements = checkStreakAchievements(data, userId, currentStreak);
      return data;
    });
    
    res.json({ 
      awardedAchievements,
      message: awardedAchievements.length > 0 ? 'Streak achievements awarded!' : 'No new streak achievements'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const getLeaderboard = async (req, res) => {
  const { type = 'experience', limit = 10 } = req.query;
  
  try {
    const db = await readDb();
    
    // Get all users and calculate their stats
    let users = (db.users || []).map((user) => {
      // Calculate user fights and wins
      const userFights = (db.fights || []).filter(
        (fight) => Array.isArray(fight.participants) && fight.participants.some((p) => p.userId === user.id)
      );
      const userWins = userFights.filter(f => f.winner === user.id);
      
      // Get user posts for activity
      const userPosts = (db.posts || []).filter((p) => p.authorId === user.id);
      
      // Combine stats from different sources
      const combinedStats = {
        experience: user.stats?.experience || user.profile?.stats?.experience || 0,
        points: user.stats?.points || user.profile?.stats?.points || user.profile?.score || 0,
        level: user.stats?.level || Math.floor((user.stats?.experience || 0) / 100) + 1,
        victories: userWins.length,
        fights: userFights.length,
        posts: userPosts.length
      };
      
      return {
        id: user.id,
        username: user.username,
        profilePicture: user.profile?.profilePicture || user.profile?.avatar || '',
        rank: getRankInfo(combinedStats.points).rank,
        points: combinedStats.points,
        victories: combinedStats.victories,
        level: combinedStats.level,
        experience: combinedStats.experience,
        achievements: user.achievements?.length || 0,
        ...combinedStats
      };
    });
    
    // Sort by the specified type
    switch (type) {
      case 'experience':
        users.sort((a, b) => (b.experience || 0) - (a.experience || 0));
        break;
      case 'points':
        users.sort((a, b) => (b.points || 0) - (a.points || 0));
        break;
      case 'achievements':
        users.sort((a, b) => (b.achievements || 0) - (a.achievements || 0));
        break;
      case 'fights':
        users.sort((a, b) => (b.fights || 0) - (a.fights || 0));
        break;
      case 'victories':
        users.sort((a, b) => (b.victories || 0) - (a.victories || 0));
        break;
      default:
        users.sort((a, b) => (b.experience || 0) - (a.experience || 0));
    }
    
    const leaderboard = users.slice(0, limit);
    
    res.json(leaderboard);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
