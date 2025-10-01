import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['post', 'fight', 'user_profile'],
    required: true
  },
  targetId: {
    type: String,
    required: true
  },
  postId: String,
  fightId: String,
  authorId: {
    type: String,
    required: true
  },
  authorUsername: String,
  authorAvatar: String,
  text: {
    type: String,
    required: true
  },
  likes: {
    type: Number,
    default: 0
  },
  likedBy: {
    type: [String],
    default: []
  },
  edited: {
    type: Boolean,
    default: false
  },
  updatedAt: Date
}, { timestamps: true });

// Index for faster queries
commentSchema.index({ type: 1, targetId: 1 });
commentSchema.index({ postId: 1 });
commentSchema.index({ fightId: 1 });
commentSchema.index({ authorId: 1 });

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;
