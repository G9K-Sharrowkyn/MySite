import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema({
  fightId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fight', required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  team: {
    type: String,
    enum: ['A', 'B', 'teamA', 'teamB', 'draw'],
    required: true
  },
  weight: { type: Number, default: 1 }, // For weighted voting if needed
  ip: { type: String }, // Track IP for fraud prevention
  userAgent: { type: String }
}, { timestamps: true });

// Indeksy dla wydajności i unikalności
voteSchema.index({ fightId: 1, userId: 1 }, { unique: true }); // One vote per fight per user
voteSchema.index({ postId: 1, userId: 1 });
voteSchema.index({ userId: 1 });
voteSchema.index({ createdAt: -1 });

const Vote = mongoose.model('Vote', voteSchema);
export default Vote;
