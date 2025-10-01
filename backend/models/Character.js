import mongoose from 'mongoose';

const characterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  universe: { 
    type: String, 
    required: true,
    enum: ['DC', 'Marvel', 'Dragon Ball', 'Naruto', 'One Piece', 'Attack on Titan', 'Demon Slayer', 'JJK', 'Bleach', 'One Punch Man', 'My Hero Academia', 'Other']
  },
  
  // Obrazy postaci
  image: { type: String, required: true },
  images: {
    primary: { type: String, required: true },
    gallery: [{ type: String }],
    thumbnail: { type: String }
  },
  
  // Podstawowe informacje
  description: { type: String, default: '' },
  aliases: [{ type: String }], // inne nazwy postaci
  
  // Statystyki postaci
  stats: {
    powerLevel: { type: Number, min: 1, max: 100, default: 50 },
    strength: { type: Number, min: 1, max: 100, default: 50 },
    speed: { type: Number, min: 1, max: 100, default: 50 },
    intelligence: { type: Number, min: 1, max: 100, default: 50 },
    durability: { type: Number, min: 1, max: 100, default: 50 },
    energy: { type: Number, min: 1, max: 100, default: 50 }
  },
  
  // Tier mocy (zgodny z systemem dywizji)
  powerTier: {
    type: String,
    enum: ['Regular People', 'Metahuman', 'Planet Busters', 'God Tier', 'Universal Threat', 'Omnipotent'],
    required: true
  },
  
  // Kategorie
  category: {
    type: String,
    enum: ['Hero', 'Villain', 'Anti-Hero', 'Neutral', 'Other'],
    default: 'Other'
  },
  
  // Tagi dla filtrowania
  tags: [{ type: String }],
  
  // Statystyki walk
  fightStats: {
    totalFights: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    popularityScore: { type: Number, default: 0 }
  },
  
  // Informacje o dodaniu
  addedBy: { type: String, required: true }, // userId
  addedAt: { type: Date, default: Date.now },
  
  // Status postaci
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending_approval', 'rejected'],
    default: 'active'
  },
  
  // Moderacja
  moderation: {
    approved: { type: Boolean, default: false },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    moderatorNotes: { type: String }
  },
  
  // Popularność
  popularity: {
    votes: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    lastFightDate: { type: Date }
  },
  
  // Metadane
  metadata: {
    source: { type: String }, // skąd pochodzi postać
    firstAppearance: { type: String },
    creator: { type: String },
    abilities: [{ type: String }],
    weaknesses: [{ type: String }]
  }
}, { timestamps: true });

// Indeksy dla wydajności
characterSchema.index({ 'universe': 1 });
characterSchema.index({ 'powerTier': 1 });
characterSchema.index({ 'status': 1 });
characterSchema.index({ 'tags': 1 });
characterSchema.index({ 'fightStats.winRate': -1 });
characterSchema.index({ 'popularity.votes': -1 });

// Middleware do aktualizacji winRate
characterSchema.pre('save', function(next) {
  if (this.fightStats.totalFights > 0) {
    this.fightStats.winRate = (this.fightStats.wins / this.fightStats.totalFights) * 100;
  }
  next();
});

// Statyczne metody
characterSchema.statics.findByUniverse = function(universe) {
  return this.find({ universe, status: 'active' });
};

characterSchema.statics.findByPowerTier = function(powerTier) {
  return this.find({ powerTier, status: 'active' });
};

characterSchema.statics.getPopularCharacters = function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ 'popularity.votes': -1, 'fightStats.winRate': -1 })
    .limit(limit);
};

characterSchema.statics.searchCharacters = function(query) {
  return this.find({
    status: 'active',
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { aliases: { $regex: query, $options: 'i' } },
      { universe: { $regex: query, $options: 'i' } }
    ]
  });
};

// Metody instancji
characterSchema.methods.updateFightStats = function(result) {
  this.fightStats.totalFights += 1;
  
  if (result === 'win') {
    this.fightStats.wins += 1;
  } else if (result === 'loss') {
    this.fightStats.losses += 1;
  } else if (result === 'draw') {
    this.fightStats.draws += 1;
  }
  
  this.fightStats.winRate = (this.fightStats.wins / this.fightStats.totalFights) * 100;
  this.popularity.lastFightDate = new Date();
  
  return this.save();
};

const Character = mongoose.model('Character', characterSchema);
export default Character;
