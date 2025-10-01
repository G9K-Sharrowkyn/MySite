import User from '../models/User.js';
import Fight from '../models/Fight.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Vote from '../models/Vote.js';
import Message from '../models/Message.js';

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
async function checkAndAwardAchievements(userId, achievementType, currentCount) {
  const user = await User.findById(userId);
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
          user.stats.experience = (user.stats.experience || 0) + achievement.reward.experience;
        }
        if (achievement.reward.points) {
          user.stats.points = (user.stats.points || 0) + achievement.reward.points;
        }

        awardedAchievements.push(userAchievement);
      }
    }
  });

  if (awardedAchievements.length > 0) {
    await user.save();
  }

  return awardedAchievements;
}

// Helper function to check streak achievements
async function checkStreakAchievements(userId, currentStreak) {
  const user = await User.findById(userId);
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
          user.stats.experience = (user.stats.experience || 0) + achievement.reward.experience;
        }
        if (achievement.reward.points) {
          user.stats.points = (user.stats.points || 0) + achievement.reward.points;
        }

        awardedAchievements.push(userAchievement);
      }
    }
  });

  if (awardedAchievements.length > 0) {
    await user.save();
  }

  return awardedAchievements;
}

// @desc    Get site statistics
// @route   GET /api/stats/site
// @access  Public
export const getSiteStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalFights = await Fight.countDocuments();
    const activeFights = await Fight.countDocuments({ status: 'active' });
    const totalVotes = await Vote.countDocuments();
    const totalComments = await Comment.countDocuments();
    const totalMessages = await Message.countDocuments();

    // Calculate most popular categories
    const categoryStats = await Fight.aggregate([
      { $match: { category: { $exists: true } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const mostPopularCategory = categoryStats.length > 0 ? categoryStats[0]._id : 'Mixed';

    // Calculate most active users (by comments and votes)
    const commentActivity = await Comment.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]);

    const voteActivity = await Vote.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]);

    // Combine activity counts
    const userActivity = {};
    commentActivity.forEach(item => {
      if (item._id) {
        userActivity[item._id.toString()] = item.count;
      }
    });
    voteActivity.forEach(item => {
      if (item._id) {
        const userId = item._id.toString();
        userActivity[userId] = (userActivity[userId] || 0) + item.count;
      }
    });

    let mostActiveUser = null;
    if (Object.keys(userActivity).length > 0) {
      const mostActiveUserId = Object.keys(userActivity).reduce((a, b) =>
        userActivity[a] > userActivity[b] ? a : b
      );
      const user = await User.findById(mostActiveUserId).select('_id username');
      if (user) {
        mostActiveUser = {
          id: user._id,
          username: user.username,
          activity: userActivity[mostActiveUserId]
        };
      }
    }

    const categoryStatsObject = {};
    categoryStats.forEach(stat => {
      categoryStatsObject[stat._id] = stat.count;
    });

    res.json({
      totalUsers,
      totalFights,
      activeFights,
      totalVotes,
      totalComments,
      totalMessages,
      mostPopularCategory,
      mostActiveUser,
      categoryStats: categoryStatsObject
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @desc    Get user statistics
// @route   GET /api/stats/user/:userId
// @access  Public
export const getUserStats = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Calculate additional stats
    const userFights = await Fight.find({
      $or: [
        { 'teamA.userId': userId },
        { 'teamB.userId': userId }
      ]
    });

    const userPosts = await Post.find({ userId });
    const userComments = await Comment.find({ userId });
    const userVotes = await Vote.find({ userId });

    const wins = userFights.filter(f => f.winnerId && f.winnerId.toString() === userId).length;

    const stats = {
      ...user.stats,
      fights: {
        total: userFights.length,
        wins,
        losses: userFights.filter(f => f.winnerId && f.winnerId.toString() !== userId && f.result !== 'draw').length,
        winRate: userFights.length > 0 ? (wins / userFights.length * 100).toFixed(1) : 0
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
  try {
    const fightId = req.params.fightId;
    const fight = await Fight.findById(fightId);

    if (!fight) {
      return res.status(404).json({ msg: 'Walka nie znaleziona' });
    }

    // Get vote statistics
    const fightVotes = await Vote.find({ fightId });
    const fighter1Votes = fightVotes.filter(v => v.team === 'A' || v.team === 'teamA').length;
    const fighter2Votes = fightVotes.filter(v => v.team === 'B' || v.team === 'teamB').length;
    const totalVotes = fightVotes.length;

    // Get comment statistics
    const fightComments = await Comment.find({ fightId });
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
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const getUserAchievements = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);

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
            progress = achievements.filter(a => a.id.includes('division_champion')).length || 0;
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
    const awardedAchievements = await checkAndAwardAchievements(userId, achievementType, currentCount);

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
    const awardedAchievements = await checkStreakAchievements(userId, currentStreak);

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
    const allUsers = await User.find().select('-password');

    // Get all users and calculate their stats
    const users = await Promise.all(allUsers.map(async (user) => {
      // Calculate user fights and wins
      const userFights = await Fight.find({
        $or: [
          { 'teamA.userId': user._id },
          { 'teamB.userId': user._id }
        ]
      });
      const userWins = userFights.filter(f => f.winnerId && f.winnerId.toString() === user._id.toString());

      // Get user posts for activity
      const userPosts = await Post.find({ userId: user._id });

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
        id: user._id,
        username: user.username,
        profilePicture: user.profile?.profilePicture || user.profile?.avatar || '',
        rank: user.stats?.rank || user.profile?.rank || 'Rookie',
        points: combinedStats.points,
        victories: combinedStats.victories,
        level: combinedStats.level,
        experience: combinedStats.experience,
        achievements: user.achievements?.length || 0,
        ...combinedStats
      };
    }));

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

    const leaderboard = users.slice(0, parseInt(limit));

    res.json(leaderboard);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// Pobieranie statystyk dywizji
export const getDivisionStatistics = async (req, res) => {
  try {
    const { divisionId } = req.params;
    const { timeFrame = 'all' } = req.query;

    // Note: Divisions are stored in User model as a Map
    // We need to get all users with this division and calculate stats

    // Przygotuj filtry czasowe
    const now = new Date();
    let startDate = new Date(0); // Początek czasu unix

    if (timeFrame === 'month') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (timeFrame === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    }

    // Get all users in this division
    const usersInDivision = await User.find({
      [`divisions.${divisionId}`]: { $exists: true }
    });

    if (usersInDivision.length === 0) {
      return res.status(404).json({ message: 'Dywizja nie znaleziona lub brak drużyn' });
    }

    // Filtruj walki dla danej dywizji i przedziału czasowego
    const divisionFights = await Fight.find({
      divisionId,
      createdAt: { $gte: startDate },
      status: 'completed'
    });

    // Statystyki aktywnych drużyn
    const teamStats = {};

    // Identyfikacja aktywnych drużyn i zbieranie statystyk
    usersInDivision.forEach(user => {
      const divisionData = user.divisions.get(divisionId);
      if (divisionData) {
        const teamId = user._id.toString();
        const team = divisionData.team;
        teamStats[teamId] = {
          id: teamId,
          name: `${team?.mainCharacter?.name || 'Unknown'} & ${team?.secondaryCharacter?.name || 'Unknown'}`,
          userId: user._id,
          wins: divisionData.wins || 0,
          losses: divisionData.losses || 0,
          draws: divisionData.draws || 0,
          totalVotes: 0,
          fights: 0
        };
      }
    });

    // Liczenie wyników walk
    let totalVotes = 0;

    for (const fight of divisionFights) {
      // Oblicz całkowitą liczbę głosów
      const fightVotes = await Vote.countDocuments({ fightId: fight._id });
      totalVotes += fightVotes;

      const team1Id = fight.teamA?.userId?.toString();
      const team2Id = fight.teamB?.userId?.toString();

      // Aktualizuj statystyki dla obu drużyn
      if (teamStats[team1Id]) {
        teamStats[team1Id].fights++;
        const team1Votes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['A', 'teamA'] } });
        teamStats[team1Id].totalVotes += team1Votes;

        if (fight.winnerId && fight.winnerId.toString() === team1Id) {
          teamStats[team1Id].wins++;
        } else if (fight.winnerId && fight.winnerId.toString() === team2Id) {
          teamStats[team1Id].losses++;
        } else if (fight.result === 'draw') {
          teamStats[team1Id].draws++;
        }
      }

      if (teamStats[team2Id]) {
        teamStats[team2Id].fights++;
        const team2Votes = await Vote.countDocuments({ fightId: fight._id, team: { $in: ['B', 'teamB'] } });
        teamStats[team2Id].totalVotes += team2Votes;

        if (fight.winnerId && fight.winnerId.toString() === team2Id) {
          teamStats[team2Id].wins++;
        } else if (fight.winnerId && fight.winnerId.toString() === team1Id) {
          teamStats[team2Id].losses++;
        } else if (fight.result === 'draw') {
          teamStats[team2Id].draws++;
        }
      }
    }

    // Przekształć statystyki drużyn na tablicę
    const teamsArray = Object.values(teamStats);

    // Znajdź drużynę z najwyższym wskaźnikiem zwycięstw
    let highestWinRateTeam = null;
    let highestWinRate = 0;

    teamsArray.forEach(team => {
      if (team.fights > 0) {
        const winRate = (team.wins / team.fights) * 100;
        if (winRate > highestWinRate) {
          highestWinRate = winRate;
          highestWinRateTeam = {
            teamName: team.name,
            winRate: Math.round(winRate)
          };
        }
      }
    });

    // Znajdź drużynę z największą liczbą zwycięstw
    let mostWinsTeam = null;
    let mostWins = 0;

    teamsArray.forEach(team => {
      if (team.wins > mostWins) {
        mostWins = team.wins;
        mostWinsTeam = {
          teamName: team.name,
          wins: team.wins
        };
      }
    });

    // Find current champion
    const currentChampion = usersInDivision.find(user => {
      const divisionData = user.divisions.get(divisionId);
      return divisionData?.isChampion === true;
    });

    let longestChampion = null;
    if (currentChampion) {
      const divisionData = currentChampion.divisions.get(divisionId);
      const team = divisionData.team;
      longestChampion = {
        teamName: `${team?.mainCharacter?.name || 'Unknown'} & ${team?.secondaryCharacter?.name || 'Unknown'}`,
        days: 0 // Would need to track this in the schema
      };
    }

    // Zbierz wyniki
    const statistics = {
      activeTeams: Object.keys(teamStats).length,
      totalFights: divisionFights.length,
      averageVotes: divisionFights.length > 0 ? totalVotes / divisionFights.length : 0,
      highestWinRateTeam,
      mostWinsTeam,
      longestChampion,
      championHistory: [] // Would need to implement champion history tracking
    };

    res.json(statistics);

  } catch (err) {
    console.error('Error getting division statistics:', err);
    res.status(500).send('Server Error');
  }
};
