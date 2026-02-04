import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import hpp from 'hpp';
import http from 'http';
import { readFile } from 'fs/promises';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  addMessage as addLocalMessage,
  addReaction as addLocalReaction,
  getRecentMessages as getLocalRecentMessages,
  trimMessages as trimLocalMessages
} from './services/chatStore.js';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import fightRoutes from './routes/fights.js';
import commentRoutes from './routes/comments.js';
import postRoutes from './routes/posts.js';
import characterRoutes from './routes/characters.js';
import messageRoutes from './routes/messages.js';
import voteRoutes from './routes/votes.js';
import divisionsRoutes, { runDivisionSeasonScheduler } from './routes/divisions.js';
import notificationRoutes from './routes/notifications.js';
import tournamentRoutes from './routes/tournaments.js';
import statsRoutes from './routes/stats.js';
import badgeRoutes from './routes/badges.js';
import bettingRoutes from './routes/betting.js';
import tagRoutes from './routes/tags.js';
import privacyRoutes from './routes/privacy.js';
import usersRoutes from './routes/users.js';
import coinsRoutes from './routes/coins.js';
import communityRoutes from './routes/community.js';
import donationsRoutes from './routes/donations.js';
import legalRoutes from './routes/legal.js';
import recommendationsRoutes from './routes/recommendations.js';
import challengesRoutes from './routes/challenges.js';
import storeRoutes from './routes/store.js';
import userRoutes from './routes/user.js';
import pushRoutes from './routes/push.js';
import feedbackRoutes from './routes/feedback.js';
import moderationRoutes from './routes/moderation.js';
import translateRoutes from './routes/translate.js';
import ccgRoutes from './routes/ccg.js';
import './jobs/tournamentScheduler.js'; // Initialize tournament scheduler
import { notificationsRepo } from './repositories/index.js';
import { readDb as warmupReadDb } from './services/jsonDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const chatStore = {
  getRecentMessages: getLocalRecentMessages,
  addMessage: addLocalMessage,
  addReaction: addLocalReaction,
  trimMessages: trimLocalMessages
};
const app = express();
const PORT = process.env.PORT || 5000;
const shouldTrustProxy =
  process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production';
if (shouldTrustProxy) {
  app.set('trust proxy', 1);
}

// Create HTTP server
const server = http.createServer(app);

const isDev = process.env.NODE_ENV !== 'production';
const normalizeOrigin = (value) => {
  if (!value) return null;
  return value.replace(/\/$/, '');
};

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]
  .filter(Boolean)
  .map(normalizeOrigin);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.includes(normalized);
};

// Configure Socket.io
const io = new Server(server, {
  maxHttpBufferSize: 5e6,
  cors: {
    origin: (origin, callback) => {
      if (isDev || isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.io maps for tracking users
const activeUsers = new Map(); // Track active users in global chat
const userSocketMap = new Map(); // Map userId to socketId for private messages

io.engine.on('connection_error', (err) => {
  console.error('Engine.IO connection error:', err.code, err.message);
  if (err.context) {
    console.error('Engine.IO context:', err.context);
  }
});

// CCG namespace socket handling
const ccgNamespace = io.of('/ccg');
const ccgRoomPlayers = {};
const ccgCardsPath = path.join(__dirname, 'ccg', 'data', 'cards.json');

ccgNamespace.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, user }) => {
    socket.join(roomId);
    if (!ccgRoomPlayers[roomId]) {
      ccgRoomPlayers[roomId] = {};
    }
    ccgRoomPlayers[roomId][socket.id] = { id: user.id, username: user.username };
    const players = Object.values(ccgRoomPlayers[roomId]);
    ccgNamespace.to(roomId).emit('playersUpdate', players);
  });

  socket.on('startGame', async ({ roomId }) => {
    try {
      const raw = await readFile(ccgCardsPath, 'utf-8');
      const fullDeck = JSON.parse(raw);
      const shuffled = fullDeck.sort(() => 0.5 - Math.random()).slice(0, 40);
      ccgNamespace.to(roomId).emit('gameStart', { deck: shuffled });
    } catch (err) {
      console.error('Error loading CCG cards.json:', err);
    }
  });

  socket.on('playMove', ({ roomId, move }) => {
    socket.to(roomId).emit('opponentMove', move);
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (ccgRoomPlayers[roomId]) {
        delete ccgRoomPlayers[roomId][socket.id];
        ccgNamespace.to(roomId).emit(
          'playersUpdate',
          Object.values(ccgRoomPlayers[roomId])
        );
      }
    }
  });
});

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, enable in production
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: isDev ? false : undefined,
  crossOriginOpenerPolicy: isDev ? false : undefined
}));

// Rate limiting
const apiLimitMax =
  Number(process.env.API_RATE_LIMIT_MAX) ||
  (isDev ? 1000 : 400);
const loginAuthLimitMax =
  Number(process.env.LOGIN_RATE_LIMIT_MAX) ||
  (isDev ? 120 : 30);
const registerAuthLimitMax =
  Number(process.env.REGISTER_RATE_LIMIT_MAX) ||
  (isDev ? 120 : 60);
const passwordAuthLimitMax =
  Number(process.env.AUTH_RATE_LIMIT_MAX) ||
  (isDev ? 120 : 30);
const googleAuthLimitMax =
  Number(process.env.GOOGLE_AUTH_RATE_LIMIT_MAX) ||
  (isDev ? 500 : 120);
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: apiLimitMax,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Auth endpoints have dedicated limiters below.
  skip: (req) => req.path.startsWith('/api/auth/')
});

const loginAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: loginAuthLimitMax,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

const registerAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: registerAuthLimitMax,
  message: 'Too many registration attempts, please try again later.',
  skipSuccessfulRequests: true
});

const googleAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: googleAuthLimitMax,
  message: 'Too many Google sign-in attempts, please try again later.',
  skipSuccessfulRequests: true
});

const passwordAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: passwordAuthLimitMax,
  message: 'Too many password reset attempts, please try again later.',
  skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/api/auth/login', loginAuthLimiter);
app.use('/api/auth/register', registerAuthLimiter);
app.use('/api/auth/google', googleAuthLimiter);
app.use('/api/auth/forgot-password', passwordAuthLimiter);
app.use('/api/auth/reset-password', passwordAuthLimiter);

// Prevent HTTP Parameter Pollution
app.use(hpp());
app.use(compression());

// Request logging middleware - disabled for cleaner output
// if (process.env.NODE_ENV === 'production') {
//   app.use(morgan('combined'));
// } else {
//   app.use(morgan('dev'));
// }

// CORS
app.use(cors({
  origin: (origin, callback) => {
    if (isDev || isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '50mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Increase URL-encoded payload limit
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '30d',
    immutable: true,
    etag: true
  })
);
app.use(
  '/characters',
  express.static(path.join(__dirname, '..', 'public', 'characters'), {
    maxAge: '7d',
    etag: true
  })
);

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io; // Make Socket.io available to routes
  req.userSocketMap = userSocketMap; // Make userSocketMap available to routes
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
app.use('/api/tags', tagRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/coins', coinsRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/donations', donationsRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/challenges', challengesRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/ccg', ccgRoutes);
app.use('/api/user', userRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/moderation', moderationRoutes);

// Lightweight health endpoints for uptime checks
app.get(['/healthz', '/api/health'], (req, res) => {
  const databaseModeRaw = process.env.DATABASE || process.env.Database || 'local';
  const databaseMode = databaseModeRaw.toLowerCase();
  const databaseLabel = databaseMode === 'mongo' || databaseMode === 'mongodb'
    ? 'mongo'
    : 'local';

  res.status(200).json({
    ok: true,
    service: 'versusversevault-backend',
    env: process.env.NODE_ENV || 'development',
    database: databaseLabel,
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Division seasons scheduler (auto + manual trigger support)
const DIVISION_SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const startDivisionScheduler = () => {
  runDivisionSeasonScheduler().catch((error) => {
    console.error('Initial division scheduler error:', error);
  });

  setInterval(() => {
    runDivisionSeasonScheduler().catch((error) => {
      console.error('Recurring division scheduler error:', error);
    });
  }, DIVISION_SCHEDULER_INTERVAL_MS);
};

startDivisionScheduler();

// Basic route or static frontend for production
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '..', 'build');

  // Serve static files with proper cache control
  app.use(express.static(buildPath, {
    maxAge: 0, // Don't cache HTML
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Cache JS/CSS files for 1 year (they have hashes in filenames)
      if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } 
      // Don't cache HTML files
      else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // Cache images for 1 week
      else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      }
    }
  }));

  app.get('/*splat', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('API is running...');
  });
}

// Socket.io chat functionality
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.conn.on('upgradeError', (err) => {
    console.error('Socket upgrade error:', err?.message || err);
  });

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
    try {
      const recentMessages = await chatStore.getRecentMessages(50);
      const formattedMessages = recentMessages.map((msg) => ({
        id: msg.id,
        userId: msg.userId,
        username: msg.username,
        profilePicture: msg.profilePicture,
        text: msg.text,
        timestamp: msg.timestamp || msg.createdAt,
        reactions: msg.reactions || [],
        isOwn: msg.userId === userData.userId
      }));

      socket.emit('message-history', formattedMessages);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  });

  // User joins a private conversation
  socket.on('join-conversation', (data) => {
    console.log('Received join-conversation event:', data);
    if (!data || !data.userId) {
      console.error('Invalid data for join-conversation:', data);
      return;
    }
    
    // Map userId to socketId
    userSocketMap.set(data.userId, socket.id);
    console.log(`User ${data.userId} joined with socket ${socket.id}`);
    console.log('Current userSocketMap:', Array.from(userSocketMap.entries()));
  });

  // Handle sending messages
  socket.on('send-message', async (messageData) => {
    if (!messageData || !messageData.text || !activeUsers.has(socket.id)) {
      console.error('Invalid message data');
      return;
    }

    const user = activeUsers.get(socket.id);

    try {
      const newMessage = await chatStore.addMessage({
        userId: user.userId,
        username: user.username,
        profilePicture: user.profilePicture,
        text: messageData.text
      });

      // Trim messages older than 24 hours
      await chatStore.trimMessages();

      const formattedMessage = {
        id: newMessage.id,
        userId: newMessage.userId,
        username: newMessage.username,
        profilePicture: newMessage.profilePicture,
        text: newMessage.text,
        timestamp: newMessage.timestamp || newMessage.createdAt,
        reactions: newMessage.reactions || []
      };

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
      const reactionUpdate = await chatStore.addReaction({
        messageId: data.messageId,
        userId: user.userId,
        username: user.username,
        emoji: data.emoji
      });

      if (reactionUpdate) {
        const payload = reactionUpdate.messageId
          ? reactionUpdate
          : {
              messageId: reactionUpdate.id,
              reactions: reactionUpdate.reactions || []
            };
        io.emit('reaction-added', payload);
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
  socket.on('disconnect', (reason) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      activeUsers.delete(socket.id);
      
      // Remove from userSocketMap
      userSocketMap.forEach((socketId, userId) => {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
        }
      });
      
      // Notify others that user left
      socket.broadcast.emit('user-left', {
        userId: user.userId,
        username: user.username
      });
    }
    console.log('Client disconnected:', socket.id, reason);
  });
});

// One-time migration: Remove message-type notifications (they should only be on chat icon)
(async () => {
  try {
    const notifications = await notificationsRepo.getAll();
    const messageNotifications =
      notifications?.filter((n) => n.type === 'message') || [];
    if (messageNotifications.length > 0) {
      await notificationsRepo.updateAll((items) =>
        items.filter((n) => n.type !== 'message')
      );
      console.log(`Cleaned up ${messageNotifications.length} message notifications from bell`);
    }
  } catch (err) {
    console.error('Migration error:', err);
  }
})();

// Start the server
server.listen(PORT, () => {
  const databaseModeRaw = process.env.DATABASE || process.env.Database || 'local';
  const databaseMode = databaseModeRaw.toLowerCase();
  const databaseLabel = databaseMode === 'mongo' || databaseMode === 'mongodb'
    ? 'mongo'
    : 'local';
  console.log(`Database mode: ${databaseLabel}`);
  console.log(`Server is running on port ${PORT}`);

  // Prime Mongo cache once on startup to reduce first-request latency in production.
  if (databaseLabel === 'mongo') {
    const warmupStartedAt = Date.now();
    warmupReadDb()
      .then(() => {
        console.log(`Mongo cache warmup completed in ${Date.now() - warmupStartedAt}ms`);
      })
      .catch((error) => {
        console.error('Mongo cache warmup failed:', error?.message || error);
      });
  }
});

export { io };
