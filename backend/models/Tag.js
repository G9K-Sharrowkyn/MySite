import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  
  // Kategoria tagu
  category: {
    type: String,
    enum: ['universe', 'character', 'power_tier', 'genre'],
    required: true,
    index: true
  },
  
  // Wygląd tagu
  color: { type: String, default: '#007bff' },
  icon: { type: String, default: null },
  
  // Statystyki
  postCount: { type: Number, default: 0 },
  trending: { type: Boolean, default: false },
  
  // Metadane
  description: { type: String, default: '' },
  aliases: [{ type: String }], // alternatywne nazwy
  
  // Automatyczne tagowanie
  autoTagRules: {
    characterNames: [{ type: String }], // nazwy postaci które automatycznie dodają ten tag
    universeKeywords: [{ type: String }], // słowa kluczowe uniwersum
    enabled: { type: Boolean, default: true }
  },
  
  // Popularność
  popularity: {
    weeklyUse: { type: Number, default: 0 },
    monthlyUse: { type: Number, default: 0 },
    lastUsed: { type: Date }
  },
  
  // Status
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indeksy
tagSchema.index({ 'category': 1 });
tagSchema.index({ 'trending': 1 });
tagSchema.index({ 'postCount': -1 });
tagSchema.index({ 'popularity.weeklyUse': -1 });
tagSchema.index({ 'active': 1 });

// Middleware
tagSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Statyczne metody
tagSchema.statics.getTrendingTags = function(limit = 10) {
  return this.find({ active: true, trending: true })
    .sort({ 'popularity.weeklyUse': -1 })
    .limit(limit);
};

tagSchema.statics.getPopularTags = function(category = null, limit = 20) {
  const query = { active: true };
  if (category) query.category = category;
  
  return this.find(query)
    .sort({ postCount: -1, 'popularity.weeklyUse': -1 })
    .limit(limit);
};

tagSchema.statics.searchTags = function(query) {
  return this.find({
    active: true,
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { aliases: { $regex: query, $options: 'i' } }
    ]
  });
};

// Metody instancji
tagSchema.methods.incrementUsage = function() {
  this.postCount += 1;
  this.popularity.weeklyUse += 1;
  this.popularity.monthlyUse += 1;
  this.popularity.lastUsed = new Date();
  
  // Sprawdź czy tag powinien być trending
  if (this.popularity.weeklyUse > 10) {
    this.trending = true;
  }
  
  return this.save();
};

const Tag = mongoose.model('Tag', tagSchema);
export default Tag;