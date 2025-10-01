import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'discussion' },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  likes: { type: Array, default: [] },
  comments: { type: Array, default: [] },
  views: { type: Number, default: 0 },
  photos: { type: Array, default: [] },
  poll: { type: Object, default: null },
  fight: { type: Object, default: null },
  isOfficial: { type: Boolean, default: false },
  moderatorCreated: { type: Boolean, default: false },
  category: { type: String, default: null },
  featured: { type: Boolean, default: false },
  
  // Nowe pola dla systemu tagów
  tags: {
    type: [String],
    default: []
  },
  autoTags: {
    universes: { type: [String], default: [] },
    characters: { type: [String], default: [] },
    powerTiers: { type: [String], default: [] },
    categories: { type: [String], default: [] }
  },
  
  // Betting window dla oficjalnych walk
  bettingWindow: {
    bettingOpenTime: { type: Date, default: null },
    bettingCloseTime: { type: Date, default: null },
    bettingActive: { type: Boolean, default: false },
    bettingLocked: { type: Boolean, default: false }
  }
}, { timestamps: true });

// Indeksy dla wydajności
postSchema.index({ 'autoTags.universes': 1 });
postSchema.index({ 'bettingWindow.bettingActive': 1 });
postSchema.index({ 'type': 1, 'isOfficial': 1 });

const Post = mongoose.model('Post', postSchema);
export default Post;
