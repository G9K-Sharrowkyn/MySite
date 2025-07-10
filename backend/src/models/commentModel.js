const mongoose = require('mongoose');
const { Schema } = mongoose;

const commentSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['post', 'fight', 'user'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Comment', commentSchema);