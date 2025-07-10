const mongoose = require('mongoose');
const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: {
      content: String,
      timestamp: Date
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);