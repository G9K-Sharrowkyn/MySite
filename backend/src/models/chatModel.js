const mongoose = require('mongoose');

// Chat Room Schema
const chatRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['general', 'division', 'support', 'off-topic'],
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maxUsers: {
    type: Number,
    default: 100
  },
  currentUsers: {
    type: Number,
    default: 0
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Chat Message Schema
const chatMessageSchema = new mongoose.Schema({
  room: {
    type: String,
    required: true,
    ref: 'ChatRoom'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'system', 'join', 'leave'],
    default: 'text'
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: {
      type: String,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Chat User Session Schema (for tracking who's in which room)
const chatUserSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  room: {
    type: String,
    required: true,
    ref: 'ChatRoom'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
chatRoomSchema.index({ name: 1 });
chatRoomSchema.index({ category: 1, isActive: 1 });
chatRoomSchema.index({ lastMessageAt: -1 });

chatMessageSchema.index({ room: 1, createdAt: -1 });
chatMessageSchema.index({ user: 1, createdAt: -1 });
chatMessageSchema.index({ room: 1, isDeleted: 1 });

chatUserSessionSchema.index({ user: 1, room: 1 }, { unique: true });
chatUserSessionSchema.index({ room: 1, isActive: 1 });

// Chat Room Methods
chatRoomSchema.methods.addUser = async function() {
  if (this.currentUsers < this.maxUsers) {
    this.currentUsers += 1;
    await this.save();
    return true;
  }
  return false;
};

chatRoomSchema.methods.removeUser = async function() {
  if (this.currentUsers > 0) {
    this.currentUsers -= 1;
    await this.save();
  }
};

chatRoomSchema.methods.updateLastMessage = async function() {
  this.lastMessageAt = new Date();
  await this.save();
};

// Chat Message Methods
chatMessageSchema.methods.addReaction = async function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  
  // Add new reaction
  this.reactions.push({ user: userId, emoji });
  await this.save();
  return this;
};

chatMessageSchema.methods.removeReaction = async function(userId, emoji) {
  this.reactions = this.reactions.filter(r => 
    !(r.user.toString() === userId.toString() && r.emoji === emoji)
  );
  await this.save();
  return this;
};

chatMessageSchema.methods.edit = async function(newContent, userId) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  await this.save();
  return this;
};

chatMessageSchema.methods.delete = async function(userId, isModerator = false) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
  return this;
};

// Static methods for ChatRoom
chatRoomSchema.statics.getActiveRooms = function() {
  return this.find({ isActive: true }).sort({ lastMessageAt: -1 });
};

chatRoomSchema.statics.getRoomByName = function(name) {
  return this.findOne({ name, isActive: true });
};

// Static methods for ChatMessage
chatMessageSchema.statics.getRoomMessages = function(roomName, limit = 50, offset = 0) {
  return this.find({ 
    room: roomName, 
    isDeleted: false 
  })
  .populate('user', 'username profile.avatar profile.customTitle')
  .populate('deletedBy', 'username')
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(offset);
};

chatMessageSchema.statics.getUserMessages = function(userId, limit = 50) {
  return this.find({ 
    user: userId, 
    isDeleted: false 
  })
  .populate('room', 'displayName')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static methods for ChatUserSession
chatUserSessionSchema.statics.getRoomUsers = function(roomName) {
  return this.find({ 
    room: roomName, 
    isActive: true 
  })
  .populate('user', 'username profile.avatar profile.customTitle')
  .sort({ joinedAt: 1 });
};

chatUserSessionSchema.statics.getUserRooms = function(userId) {
  return this.find({ 
    user: userId, 
    isActive: true 
  })
  .populate('room', 'displayName description')
  .sort({ joinedAt: -1 });
};

// Create models
const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
const ChatUserSession = mongoose.model('ChatUserSession', chatUserSessionSchema);

module.exports = {
  ChatRoom,
  ChatMessage,
  ChatUserSession
}; 