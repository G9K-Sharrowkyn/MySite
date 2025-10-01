import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
  // Typ raportu
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
    required: true,
    index: true
  },
  
  // Data raportu
  date: { type: Date, required: true, index: true },
  dateRange: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  
  // Dane użytkowników
  users: {
    total: { type: Number, default: 0 },
    active: { type: Number, default: 0 },
    newRegistrations: { type: Number, default: 0 },
    returningUsers: { type: Number, default: 0 },
    averageSessionTime: { type: Number, default: 0 }, // w minutach
    topActiveUsers: [{
      userId: String,
      username: String,
      activityScore: Number
    }]
  },
  
  // Dane postów i walk
  content: {
    newPosts: { type: Number, default: 0 },
    newFights: { type: Number, default: 0 },
    totalVotes: { type: Number, default: 0 },
    totalComments: { type: Number, default: 0 },
    averageVotesPerFight: { type: Number, default: 0 },
    mostPopularFights: [{
      fightId: String,
      title: String,
      votes: Number,
      engagement: Number
    }]
  },
  
  // Dane dywizji
  divisions: {
    totalActivity: { type: Number, default: 0 },
    mostActiveDivision: {
      id: String,
      name: String,
      fights: Number,
      participants: Number
    },
    championshipChanges: { type: Number, default: 0 },
    divisionStats: [{
      divisionId: String,
      divisionName: String,
      fights: Number,
      participants: Number,
      averageVotes: Number
    }]
  },
  
  // Dane ekonomii wirtualnej
  economy: {
    totalCoinsEarned: { type: Number, default: 0 },
    totalCoinsSpent: { type: Number, default: 0 },
    totalBets: { type: Number, default: 0 },
    totalBetAmount: { type: Number, default: 0 },
    totalWinnings: { type: Number, default: 0 },
    averageBetAmount: { type: Number, default: 0 },
    mostPopularPurchases: [{
      item: String,
      count: Number,
      totalSpent: Number
    }]
  },
  
  // Popularne tagi
  tags: {
    trending: [{
      name: String,
      usage: Number,
      growth: Number // % wzrost w stosunku do poprzedniego okresu
    }],
    mostUsed: [{
      name: String,
      usage: Number,
      category: String
    }]
  },
  
  // Dane techniczne
  technical: {
    averageLoadTime: { type: Number, default: 0 }, // ms
    errorRate: { type: Number, default: 0 }, // %
    uptime: { type: Number, default: 100 }, // %
    apiCalls: { type: Number, default: 0 },
    mobileUsers: { type: Number, default: 0 },
    desktopUsers: { type: Number, default: 0 }
  },
  
  // Moderacja
  moderation: {
    reportsReceived: { type: Number, default: 0 },
    reportsResolved: { type: Number, default: 0 },
    bannedUsers: { type: Number, default: 0 },
    deletedPosts: { type: Number, default: 0 },
    approvedFighters: { type: Number, default: 0 },
    rejectedFighters: { type: Number, default: 0 }
  },
  
  // Engagement metrics
  engagement: {
    averageTimeOnSite: { type: Number, default: 0 }, // minuty
    bounceRate: { type: Number, default: 0 }, // %
    pagesPerSession: { type: Number, default: 0 },
    socialShares: { type: Number, default: 0 },
    commentsPerPost: { type: Number, default: 0 },
    likesPerPost: { type: Number, default: 0 }
  },
  
  // Porównanie z poprzednim okresem
  comparison: {
    userGrowth: { type: Number, default: 0 }, // %
    contentGrowth: { type: Number, default: 0 }, // %
    engagementGrowth: { type: Number, default: 0 }, // %
    economyGrowth: { type: Number, default: 0 } // %
  },
  
  // Metadane
  metadata: {
    generatedBy: { type: String, default: 'system' },
    generatedAt: { type: Date, default: Date.now },
    version: { type: String, default: '1.0' },
    dataQuality: { type: Number, default: 100 }, // % kompletności danych
    notes: { type: String }
  }
}, { timestamps: true });

// Indeksy
analyticsSchema.index({ 'type': 1, 'date': -1 });
analyticsSchema.index({ 'dateRange.start': 1, 'dateRange.end': 1 });
analyticsSchema.index({ 'metadata.generatedAt': -1 });

// Statyczne metody
analyticsSchema.statics.getLatestReport = function(type = 'daily') {
  return this.findOne({ type }).sort({ date: -1 });
};

analyticsSchema.statics.getReportsInRange = function(startDate, endDate, type = null) {
  const query = {
    date: { $gte: startDate, $lte: endDate }
  };
  if (type) query.type = type;
  
  return this.find(query).sort({ date: -1 });
};

analyticsSchema.statics.getDashboardData = function() {
  return this.aggregate([
    { $match: { type: 'daily' } },
    { $sort: { date: -1 } },
    { $limit: 30 },
    {
      $group: {
        _id: null,
        avgActiveUsers: { $avg: '$users.active' },
        totalNewUsers: { $sum: '$users.newRegistrations' },
        totalFights: { $sum: '$content.newFights' },
        totalVotes: { $sum: '$content.totalVotes' },
        avgEngagement: { $avg: '$engagement.averageTimeOnSite' }
      }
    }
  ]);
};

analyticsSchema.statics.getTrendingData = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    type: 'daily',
    date: { $gte: startDate }
  })
  .sort({ date: -1 })
  .select('date users.active content.newFights content.totalVotes economy.totalBets');
};

// Metody instancji
analyticsSchema.methods.calculateGrowth = function(previousReport) {
  if (!previousReport) return;
  
  this.comparison.userGrowth = this.calculatePercentageGrowth(
    this.users.active, 
    previousReport.users.active
  );
  
  this.comparison.contentGrowth = this.calculatePercentageGrowth(
    this.content.newFights, 
    previousReport.content.newFights
  );
  
  this.comparison.engagementGrowth = this.calculatePercentageGrowth(
    this.engagement.averageTimeOnSite, 
    previousReport.engagement.averageTimeOnSite
  );
  
  this.comparison.economyGrowth = this.calculatePercentageGrowth(
    this.economy.totalBetAmount, 
    previousReport.economy.totalBetAmount
  );
};

analyticsSchema.methods.calculatePercentageGrowth = function(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const Analytics = mongoose.model('Analytics', analyticsSchema);
export default Analytics;