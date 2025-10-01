import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
// import mongoSanitize from 'express-mongo-sanitize'; // Incompatible with Express 5.x
import hpp from 'hpp';
import { startScheduler } from './services/fightScheduler.js';
import { startBettingService } from './services/bettingService.js';
import { startFightAutoLockJob } from './jobs/fightAutoLock.js';
import http from 'http';
import { Server } from 'socket.io';
import ChatMessage from './models/ChatMessage.js';

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
import bettingRoutes from './routes/betting.js';
import fighterProposalRoutes from './routes/fighterProposals.js';
import tagRoutes from './routes/tags.js';
import privacyRoutes from './routes/privacy.js';

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
  mongoose.connect(mongoUri)
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

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, enable in production
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Data sanitization against NoSQL query injection
// Note: express-mongo-sanitize has compatibility issues with Express 5.x
// Using custom sanitization in validation middleware instead
// app.use(mongoSanitize());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Request logging middleware
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined')); // Apache-style combined logging for production
} else {
  app.use(morgan('dev')); // Concise colored output for development
}

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '50mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Increase URL-encoded payload limit

// Make io accessible to routes
app.use((req, res, next) => {
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
app.use('/api/badges', badgeRoutes);
app.use('/api/betting', bettingRoutes);
app.use('/api/fighter-proposals', fighterProposalRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/privacy', privacyRoutes);

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

    // Load recent chat messages from MongoDB
    try {
      const recentMessages = await ChatMessage.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const formattedMessages = recentMessages
        .reverse()
        .map(msg => ({
          id: msg._id.toString(),
          userId: msg.userId,
          username: msg.username,
          profilePicture: msg.profilePicture,
          text: msg.text,
          timestamp: msg.createdAt,
          reactions: msg.reactions || [],
          isOwn: msg.userId === userData.userId
        }));

      socket.emit('message-history', formattedMessages);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  });

  // Handle sending messages
  socket.on('send-message', async (messageData) => {
    if (!messageData || !messageData.text || !activeUsers.has(socket.id)) {
      console.error('Invalid message data');
      return;
    }

    const user = activeUsers.get(socket.id);

    try {
      // Save to MongoDB
      const newMessage = await ChatMessage.create({
        userId: user.userId,
        username: user.username,
        profilePicture: user.profilePicture,
        text: messageData.text,
        reactions: []
      });

      // Clean up old messages - keep only last 1000
      const messageCount = await ChatMessage.countDocuments();
      if (messageCount > 1000) {
        const oldMessages = await ChatMessage.find()
          .sort({ createdAt: 1 })
          .limit(messageCount - 1000)
          .select('_id');
        const idsToDelete = oldMessages.map(msg => msg._id);
        await ChatMessage.deleteMany({ _id: { $in: idsToDelete } });
      }

      // Format message for broadcast
      const formattedMessage = {
        id: newMessage._id.toString(),
        userId: newMessage.userId,
        username: newMessage.username,
        profilePicture: newMessage.profilePicture,
        text: newMessage.text,
        timestamp: newMessage.createdAt,
        reactions: []
      };

      // Broadcast to all clients
      io.emit('new-message', formattedMessage);
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  });

  // Handle reactions
  socket.on('add-reaction', async (data) => {
    if (!data || !data.messageId || !data.emoji || !activeUsers.has(socket.id)) {
      return;
    }

    const user = activeUsers.get(socket.id);

    try {
      // Find message and update reactions
      const message = await ChatMessage.findById(data.messageId);

      if (message) {
        // Check if user already reacted with this emoji
        const existingReaction = message.reactions.find(
          r => r.userId === user.userId && r.emoji === data.emoji
        );

        if (!existingReaction) {
          message.reactions.push({
            userId: user.userId,
            username: user.username,
            emoji: data.emoji
          });

          await message.save();

          // Broadcast reaction update
          io.emit('reaction-added', {
            messageId: data.messageId,
            reactions: message.reactions
          });
        }
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
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
  
  // Start the betting service
  (async () => {
    await startBettingService();
  })();
  
  // Start the fight auto-lock job
  (async () => {
    await startFightAutoLockJob(io);
  })();
});
