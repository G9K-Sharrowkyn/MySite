const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);