import mongoose from 'mongoose';

const backgroundImageSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  
  // Informacje o pliku
  originalName: { type: String, required: true },
  fileName: { type: String, required: true, unique: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  
  // Wymiary obrazu
  dimensions: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    aspectRatio: { type: Number } // width/height
  },
  
  // Ścieżki do plików
  paths: {
    original: { type: String, required: true },
    compressed: { type: String },
    thumbnail: { type: String },
    webp: { type: String } // wersja WebP dla lepszej kompresji
  },
  
  // Status kompresji
  compressed: { type: Boolean, default: false },
  compressionRatio: { type: Number, default: 0 }, // % redukcji rozmiaru
  
  // Status moderacji
  approved: { type: Boolean, default: false },
  moderatorReview: {
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    status: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected', 'flagged'],
      default: 'pending'
    },
    notes: { type: String },
    rejectionReason: { 
      type: String,
      enum: ['inappropriate_content', 'copyright_violation', 'low_quality', 'wrong_format', 'other']
    }
  },
  
  // Metadane obrazu
  metadata: {
    colorPalette: [{ type: String }], // dominujące kolory
    brightness: { type: Number }, // jasność obrazu (0-100)
    contrast: { type: Number }, // kontrast (0-100)
    tags: [{ type: String }], // automatyczne tagi
    aiGenerated: { type: Boolean, default: false },
    source: { type: String } // skąd pochodzi obraz
  },
  
  // Użycie
  usage: {
    timesUsed: { type: Number, default: 0 },
    currentlyActive: { type: Boolean, default: false },
    lastUsed: { type: Date },
    popularityScore: { type: Number, default: 0 }
  },
  
  // Koszty i ekonomia
  cost: { type: Number, required: true }, // koszt w wirtualnych monetach
  purchaseDate: { type: Date, default: Date.now },
  
  // Status
  active: { type: Boolean, default: true },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  
  // Daty
  uploadedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indeksy
backgroundImageSchema.index({ 'userId': 1, 'active': 1 });
backgroundImageSchema.index({ 'moderatorReview.status': 1 });
backgroundImageSchema.index({ 'approved': 1, 'active': 1 });
backgroundImageSchema.index({ 'usage.currentlyActive': 1 });
backgroundImageSchema.index({ 'uploadedAt': -1 });

// Middleware
backgroundImageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Oblicz aspect ratio
  if (this.dimensions.width && this.dimensions.height) {
    this.dimensions.aspectRatio = this.dimensions.width / this.dimensions.height;
  }
  
  next();
});

// Statyczne metody
backgroundImageSchema.statics.getUserBackgrounds = function(userId, activeOnly = true) {
  const query = { userId, deleted: false };
  if (activeOnly) query.active = true;
  
  return this.find(query).sort({ uploadedAt: -1 });
};

backgroundImageSchema.statics.getPendingReviews = function() {
  return this.find({ 
    'moderatorReview.status': 'pending',
    deleted: false 
  }).sort({ uploadedAt: 1 });
};

backgroundImageSchema.statics.getApprovedBackgrounds = function(limit = 50) {
  return this.find({ 
    approved: true, 
    active: true, 
    deleted: false 
  })
  .sort({ 'usage.popularityScore': -1, uploadedAt: -1 })
  .limit(limit);
};

backgroundImageSchema.statics.getPopularBackgrounds = function(limit = 20) {
  return this.find({ 
    approved: true, 
    active: true, 
    deleted: false,
    'usage.timesUsed': { $gt: 0 }
  })
  .sort({ 'usage.timesUsed': -1, 'usage.popularityScore': -1 })
  .limit(limit);
};

// Metody instancji
backgroundImageSchema.methods.approve = function(moderatorId, notes = '') {
  this.approved = true;
  this.moderatorReview.status = 'approved';
  this.moderatorReview.reviewedBy = moderatorId;
  this.moderatorReview.reviewedAt = new Date();
  this.moderatorReview.notes = notes;
  
  return this.save();
};

backgroundImageSchema.methods.reject = function(moderatorId, reason, notes = '') {
  this.approved = false;
  this.active = false;
  this.moderatorReview.status = 'rejected';
  this.moderatorReview.reviewedBy = moderatorId;
  this.moderatorReview.reviewedAt = new Date();
  this.moderatorReview.rejectionReason = reason;
  this.moderatorReview.notes = notes;
  
  return this.save();
};

backgroundImageSchema.methods.setAsActive = function() {
  this.usage.currentlyActive = true;
  this.usage.timesUsed += 1;
  this.usage.lastUsed = new Date();
  this.usage.popularityScore += 1;
  
  return this.save();
};

backgroundImageSchema.methods.setAsInactive = function() {
  this.usage.currentlyActive = false;
  
  return this.save();
};

backgroundImageSchema.methods.softDelete = function() {
  this.deleted = true;
  this.active = false;
  this.deletedAt = new Date();
  this.usage.currentlyActive = false;
  
  return this.save();
};

const BackgroundImage = mongoose.model('BackgroundImage', backgroundImageSchema);
export default BackgroundImage;