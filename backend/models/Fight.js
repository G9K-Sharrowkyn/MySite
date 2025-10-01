import mongoose from 'mongoose';

const fightSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  
  // Zespoły walczące
  teamA: [{
    characterId: { type: String, required: true },
    characterName: { type: String, required: true },
    characterImage: { type: String, required: true }
  }],
  teamB: [{
    characterId: { type: String, required: true },
    characterName: { type: String, required: true },
    characterImage: { type: String, required: true }
  }],
  
  // Wyniki głosowania
  votesA: { type: Number, default: 0 },
  votesB: { type: Number, default: 0 },
  voters: [{
    userId: { type: String, required: true },
    vote: { type: String, enum: ['A', 'B'], required: true },
    votedAt: { type: Date, default: Date.now }
  }],
  
  // Metadane walki
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'finished', 'cancelled'], 
    default: 'active' 
  },
  
  // Typ walki
  type: {
    type: String,
    enum: ['regular', 'official', 'title_fight', 'contender_match'],
    default: 'regular'
  },
  
  // Oficjalne walki
  isOfficial: { type: Boolean, default: false },
  moderatorCreated: { type: Boolean, default: false },
  
  // Timer dla walk
  timer: {
    duration: { type: Number, default: 72 }, // godziny
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    autoLock: { type: Boolean, default: true }
  },
  
  // Betting system
  betting: {
    enabled: { type: Boolean, default: false },
    bettingWindow: {
      openTime: { type: Date },
      closeTime: { type: Date },
      active: { type: Boolean, default: false },
      locked: { type: Boolean, default: false }
    },
    totalBetsA: { type: Number, default: 0 },
    totalBetsB: { type: Number, default: 0 },
    oddsA: { type: Number, default: 1.5 },
    oddsB: { type: Number, default: 1.5 }
  },
  
  // Dywizja (jeśli dotyczy)
  division: {
    id: { type: String },
    name: { type: String },
    tier: { type: String }
  },
  
  // Wynik walki
  result: {
    winner: { type: String, enum: ['A', 'B', 'draw', 'no_contest'], default: null },
    winnerTeam: { type: String, default: null },
    finalVotesA: { type: Number, default: 0 },
    finalVotesB: { type: Number, default: 0 },
    finishedAt: { type: Date },
    method: { type: String, enum: ['decision', 'auto_lock', 'moderator'], default: 'decision' }
  },
  
  // Komentarze
  comments: [{
    id: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    likes: { type: Number, default: 0 },
    replies: { type: Array, default: [] }
  }],
  
  // Tagi automatyczne
  autoTags: {
    universes: { type: [String], default: [] },
    characters: { type: [String], default: [] },
    powerTiers: { type: [String], default: [] }
  }
}, { timestamps: true });

// Indeksy dla wydajności
fightSchema.index({ 'status': 1 });
fightSchema.index({ 'type': 1, 'isOfficial': 1 });
fightSchema.index({ 'createdBy': 1 });
fightSchema.index({ 'division.id': 1 });
fightSchema.index({ 'betting.bettingWindow.active': 1 });
fightSchema.index({ 'timer.endTime': 1 });

// Middleware do automatycznego ustawiania endTime
fightSchema.pre('save', function(next) {
  if (this.isNew && this.timer && this.timer.duration) {
    this.timer.endTime = new Date(this.timer.startTime.getTime() + (this.timer.duration * 60 * 60 * 1000));
  }
  next();
});

const Fight = mongoose.model('Fight', fightSchema);
export default Fight;
