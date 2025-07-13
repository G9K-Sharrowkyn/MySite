import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { startScheduler } from './services/fightScheduler.js';
import http from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import fightRoutes from './routes/fights.js';
import commentRoutes from './routes/comments.js';
import postRoutes from './routes/posts.js';
import characterRoutes from './routes/characters.js';
import messageRoutes from './routes/messages.js';
import voteRoutes from './routes/votes.js';
import divisionsRoutes from './routes/divisions.js';
import notificationRoutes from './routes/notifications.js';
import tournamentRoutes from './routes/tournaments.js';
import statsRoutes from './routes/stats.js';
import badgeRoutes from './routes/badges.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
  mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));
} else {
  console.warn('⚠️  No MONGODB_URI found in .env, MongoDB will not be used.');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Configure lowdb to write to JSONFile
const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter, { 
  users: [], 
  fights: [], 
  characters: [], 
  tournaments: [],
  posts: [],
  comments: [],
  messages: [],
  votes: [],
  notifications: [],
  officialFights: [],
  divisions: [],
  chatMessages: [] // Add chat messages storage
});

// Read data from JSON file
await db.read();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Increase URL-encoded payload limit

// Make db and io accessible to routes
app.use((req, res, next) => {
  req.db = db;
  req.io = io; // Make Socket.io available to routes
  next();
});

// Import routes

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/fights', fightRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/divisions', divisionsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users/:userId/badges', badgeRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Socket.io chat functionality
const activeUsers = new Map(); // Track active users in chat

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // User joins the global chat
  socket.on('join-chat', async (userData) => {
    if (!userData || !userData.userId) {
      console.error('Invalid user data for join-chat');
      return;
    }

    // Store user info
    activeUsers.set(socket.id, {
      userId: userData.userId,
      username: userData.username,
      profilePicture: userData.profilePicture
    });

    // Notify others that user joined
    socket.broadcast.emit('user-joined', {
      userId: userData.userId,
      username: userData.username
    });

    // Send active users list
    socket.emit('active-users', Array.from(activeUsers.values()));

    // Load recent chat messages
    await db.read();
    const recentMessages = db.data.chatMessages
      .slice(-50) // Last 50 messages
      .map(msg => ({
        ...msg,
        isOwn: msg.userId === userData.userId
      }));
    
    socket.emit('message-history', recentMessages);
  });

  // Handle sending messages
  socket.on('send-message', async (messageData) => {
    if (!messageData || !messageData.text || !activeUsers.has(socket.id)) {
      console.error('Invalid message data');
      return;
    }

    const user = activeUsers.get(socket.id);
    const newMessage = {
      id: Date.now().toString(),
      userId: user.userId,
      username: user.username,
      profilePicture: user.profilePicture,
      text: messageData.text,
      timestamp: new Date().toISOString(),
      reactions: []
    };

    // Save to database
    await db.read();
    db.data.chatMessages.push(newMessage);
    
    // Keep only last 1000 messages
    if (db.data.chatMessages.length > 1000) {
      db.data.chatMessages = db.data.chatMessages.slice(-1000);
    }
    
    await db.write();

    // Broadcast to all clients
    io.emit('new-message', newMessage);
  });

  // Handle reactions
  socket.on('add-reaction', async (data) => {
    if (!data || !data.messageId || !data.emoji || !activeUsers.has(socket.id)) {
      return;
    }

    const user = activeUsers.get(socket.id);
    
    await db.read();
    const messageIndex = db.data.chatMessages.findIndex(m => m.id === data.messageId);
    
    if (messageIndex !== -1) {
      if (!db.data.chatMessages[messageIndex].reactions) {
        db.data.chatMessages[messageIndex].reactions = [];
      }
      
      // Check if user already reacted with this emoji
      const existingReaction = db.data.chatMessages[messageIndex].reactions.find(
        r => r.userId === user.userId && r.emoji === data.emoji
      );
      
      if (!existingReaction) {
        db.data.chatMessages[messageIndex].reactions.push({
          userId: user.userId,
          username: user.username,
          emoji: data.emoji
        });
        
        await db.write();
        
        // Broadcast reaction update
        io.emit('reaction-added', {
          messageId: data.messageId,
          reactions: db.data.chatMessages[messageIndex].reactions
        });
      }
    }
  });

  // User typing indicator
  socket.on('typing', (isTyping) => {
    if (!activeUsers.has(socket.id)) return;
    
    const user = activeUsers.get(socket.id);
    socket.broadcast.emit('user-typing', {
      userId: user.userId,
      username: user.username,
      isTyping
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      activeUsers.delete(socket.id);
      
      // Notify others that user left
      socket.broadcast.emit('user-left', {
        userId: user.userId,
        username: user.username
      });
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Start the fight scheduler
  (async () => {
    await startScheduler();
  })();
});
