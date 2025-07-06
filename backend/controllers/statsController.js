// @desc    Get site statistics
// @route   GET /api/stats/site
// @access  Public
exports.getSiteStats = async (req, res) => {
  const db = req.db;
  await db.read();

  const totalUsers = db.data.users.length;
  const totalFights = db.data.fights.length;
  const activeFights = db.data.fights.filter(f => f.status === 'active').length;
  const totalVotes = db.data.votes.length;
  const totalComments = db.data.comments.length;
  const totalMessages = db.data.messages.length;

  // Calculate most popular categories
  const categoryStats = {};
  db.data.fights.forEach(fight => {
    if (fight.category) {
      categoryStats[fight.category] = (categoryStats[fight.category] || 0) + 1;
    }
  });

  const mostPopularCategory = Object.keys(categoryStats).reduce((a, b) => 
    categoryStats[a] > categoryStats[b] ? a : b, 'Mixed'
  );

  // Calculate most active users (by comments and votes)
  const userActivity = {};
  db.data.comments.forEach(comment => {
    userActivity[comment.authorId] = (userActivity[comment.authorId] || 0) + 1;
  });
  db.data.votes.forEach(vote => {
    userActivity[vote.userId] = (userActivity[vote.userId] || 0) + 1;
  });

  const mostActiveUserId = Object.keys(userActivity).reduce((a, b) => 
    userActivity[a] > userActivity[b] ? a : b, null
  );

  const mostActiveUser = mostActiveUserId ? 
    db.data.users.find(u => u.id === mostActiveUserId) : null;

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
exports.getUserStats = async (req, res) => {
  const db = req.db;
  await db.read();

  const userId = req.params.userId;
  const user = db.data.users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ msg: 'Użytkownik nie znaleziony' });
  }

  // Get user's fights
  const userFights = db.data.fights.filter(f => 
    f.player1Id === userId || f.player2Id === userId ||
    f.user1 === userId || f.user2 === userId
  );

  // Calculate fight statistics
  const victories = userFights.filter(fight => 
    fight.winnerId === userId || 
    (fight.winner && fight.winner === userId)
  ).length;

  const losses = userFights.filter(fight => 
    (fight.winnerId && fight.winnerId !== userId) ||
    (fight.winner && fight.winner !== userId && fight.winner !== 'draw')
  ).length;

  const draws = userFights.filter(fight => 
    fight.winner === 'draw' || fight.result === 'draw'
  ).length;

  const totalFights = userFights.length;
  const winRate = totalFights > 0 ? ((victories / totalFights) * 100).toFixed(1) : 0;

  // Get user's votes
  const userVotes = db.data.votes.filter(v => v.userId === userId);
  const correctVotes = userVotes.filter(vote => {
    const fight = db.data.fights.find(f => f.id === vote.fightId);
    return fight && fight.winner === vote.choice;
  }).length;

  const voteAccuracy = userVotes.length > 0 ? 
    ((correctVotes / userVotes.length) * 100).toFixed(1) : 0;

  // Get user's comments
  const userComments = db.data.comments.filter(c => c.authorId === userId);
  const totalLikes = userComments.reduce((sum, comment) => sum + (comment.likes || 0), 0);

  // Get user's created fights
  const createdFights = db.data.fights.filter(f => f.createdBy === userId);

  res.json({
    userId,
    username: user.username,
    fightStats: {
      victories,
      losses,
      draws,
      totalFights,
      winRate: parseFloat(winRate)
    },
    voteStats: {
      totalVotes: userVotes.length,
      correctVotes,
      voteAccuracy: parseFloat(voteAccuracy)
    },
    socialStats: {
      commentsPosted: userComments.length,
      likesReceived: totalLikes,
      fightsCreated: createdFights.length
    },
    joinDate: user.profile?.joinDate || user.createdAt || 'Nieznana',
    lastActive: user.profile?.lastActive || 'Nieznana'
  });
};

// @desc    Get fight statistics
// @route   GET /api/stats/fight/:fightId
// @access  Public
exports.getFightStats = async (req, res) => {
  const db = req.db;
  await db.read();

  const fightId = req.params.fightId;
  const fight = db.data.fights.find(f => f.id === fightId);

  if (!fight) {
    return res.status(404).json({ msg: 'Walka nie znaleziona' });
  }

  // Get vote statistics
  const fightVotes = db.data.votes.filter(v => v.fightId === fightId);
  const fighter1Votes = fightVotes.filter(v => v.choice === 'fighter1').length;
  const fighter2Votes = fightVotes.filter(v => v.choice === 'fighter2').length;
  const totalVotes = fightVotes.length;

  // Get comment statistics
  const fightComments = db.data.comments.filter(c => c.fightId === fightId);
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