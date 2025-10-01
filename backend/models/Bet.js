import mongoose from 'mongoose';

const betSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  
  // Typ zakładu
  type: {
    type: String,
    enum: ['single', 'parlay', 'system'],
    default: 'single',
    required: true
  },
  
  // Pojedynczy zakład
  fightId: { type: String, index: true },
  prediction: { type: String, enum: ['A', 'B'] },
  
  // Zakłady parlay (wielokrotne)
  parlayBets: [{
    fightId: { type: String, required: true },
    prediction: { type: String, enum: ['A', 'B'], required: true },
    odds: { type: Number, required: true },
    fightTitle: { type: String, required: true }
  }],
  
  // Kwoty i kursy
  amount: { type: Number, required: true, min: 1 },
  odds: { type: Number, required: true, min: 1.01 },
  totalOdds: { type: Number }, // dla parlay
  multiplier: { type: Number, default: 1 }, // dodatkowy mnożnik
  potentialWinnings: { type: Number, required: true },
  
  // Status zakładu
  status: {
    type: String,
    enum: ['active', 'won', 'lost', 'cancelled', 'pending'],
    default: 'active',
    index: true
  },
  
  // Wynik
  result: {
    actualResult: { type: String, enum: ['A', 'B', 'draw', 'no_contest'] },
    winnings: { type: Number, default: 0 },
    settledAt: { type: Date },
    settledBy: { type: String } // system lub moderator
  },
  
  // Ubezpieczenie zakładu
  insurance: {
    enabled: { type: Boolean, default: false },
    amount: { type: Number, default: 0 },
    refundPercentage: { type: Number, default: 0 }, // % zwrotu przy przegranej
    cost: { type: Number, default: 0 } // koszt ubezpieczenia
  },
  
  // Dynamiczne kursy
  dynamicOdds: {
    initialOdds: { type: Number },
    finalOdds: { type: Number },
    oddsChanged: { type: Boolean, default: false },
    oddsHistory: [{
      odds: { type: Number },
      timestamp: { type: Date, default: Date.now }
    }]
  },
  
  // Metadane
  metadata: {
    ip: { type: String },
    userAgent: { type: String },
    source: { type: String, default: 'web' }, // web, mobile, api
    confidence: { type: Number, min: 1, max: 10 } // pewność użytkownika (1-10)
  },
  
  // Daty
  placedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }, // kiedy zakład wygasa
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indeksy
betSchema.index({ 'userId': 1, 'status': 1 });
betSchema.index({ 'fightId': 1, 'status': 1 });
betSchema.index({ 'status': 1, 'placedAt': -1 });
betSchema.index({ 'type': 1 });
betSchema.index({ 'expiresAt': 1 }, { expireAfterSeconds: 0 });

// Middleware
betSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Oblicz potencjalne wygrane
  if (this.type === 'single') {
    this.potentialWinnings = this.amount * this.odds;
  } else if (this.type === 'parlay' && this.parlayBets.length > 0) {
    this.totalOdds = this.parlayBets.reduce((acc, bet) => acc * bet.odds, 1);
    this.potentialWinnings = this.amount * this.totalOdds * this.multiplier;
  }
  
  // Dodaj koszt ubezpieczenia
  if (this.insurance.enabled) {
    this.potentialWinnings -= this.insurance.cost;
  }
  
  next();
});

// Statyczne metody
betSchema.statics.getUserBets = function(userId, status = null) {
  const query = { userId };
  if (status) query.status = status;
  
  return this.find(query).sort({ placedAt: -1 });
};

betSchema.statics.getFightBets = function(fightId, status = 'active') {
  return this.find({ 
    $or: [
      { fightId, status },
      { 'parlayBets.fightId': fightId, status }
    ]
  });
};

betSchema.statics.getActiveBets = function() {
  return this.find({ status: 'active' });
};

betSchema.statics.getParlayBets = function(userId = null) {
  const query = { type: 'parlay' };
  if (userId) query.userId = userId;
  
  return this.find(query).sort({ placedAt: -1 });
};

betSchema.statics.getBettingStats = function(userId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalWinnings: { $sum: '$result.winnings' }
      }
    }
  ]);
};

// Metody instancji
betSchema.methods.settle = function(actualResult, settledBy = 'system') {
  this.result.actualResult = actualResult;
  this.result.settledAt = new Date();
  this.result.settledBy = settledBy;
  
  if (this.type === 'single') {
    if (this.prediction === actualResult) {
      this.status = 'won';
      this.result.winnings = this.potentialWinnings;
    } else if (actualResult === 'draw' || actualResult === 'no_contest') {
      this.status = 'cancelled';
      this.result.winnings = this.amount; // zwrot stawki
    } else {
      this.status = 'lost';
      this.result.winnings = this.insurance.enabled ? 
        this.amount * (this.insurance.refundPercentage / 100) : 0;
    }
  } else if (this.type === 'parlay') {
    // Dla parlay wszystkie zakłady muszą być wygrane
    const allWon = this.parlayBets.every(bet => bet.prediction === actualResult);
    
    if (allWon) {
      this.status = 'won';
      this.result.winnings = this.potentialWinnings;
    } else {
      this.status = 'lost';
      this.result.winnings = this.insurance.enabled ? 
        this.amount * (this.insurance.refundPercentage / 100) : 0;
    }
  }
  
  return this.save();
};

betSchema.methods.cancel = function(reason = 'user_request') {
  this.status = 'cancelled';
  this.result.winnings = this.amount; // zwrot stawki
  this.result.settledAt = new Date();
  this.result.settledBy = reason;
  
  return this.save();
};

const Bet = mongoose.model('Bet', betSchema);
export default Bet;