import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  profilePicture: { type: String },
  text: { type: String, required: true },
  reactions: [{
    userId: { type: String },
    username: { type: String },
    emoji: { type: String }
  }],
  room: { type: String, default: 'global' }
}, { timestamps: true });

// Indeksy
chatMessageSchema.index({ createdAt: -1 });
chatMessageSchema.index({ room: 1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
export default ChatMessage;
