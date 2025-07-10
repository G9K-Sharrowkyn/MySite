require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Basic middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Backend server is running'
  });
});

// Mock authentication endpoints
app.post('/api/auth/register', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Registration successful',
    token: 'mock-jwt-token',
    user: { id: 1, username: req.body.username, email: req.body.email }
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Login successful',
    token: 'mock-jwt-token',
    user: { id: 1, username: 'testuser', email: 'test@example.com' }
  });
});

// Mock profile endpoint
app.get('/api/profile/me', (req, res) => {
  res.json({
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    profilePicture: null,
    role: 'user'
  });
});

// Mock posts endpoint
app.get('/api/posts', (req, res) => {
  res.json([
    {
      _id: '1',
      content: 'Welcome to GeekFights! This is a test post.',
      author: { username: 'admin', profilePicture: null },
      likes: [],
      createdAt: new Date().toISOString()
    }
  ]);
});

// Mock characters endpoint
app.get('/api/characters', (req, res) => {
  res.json([
    { _id: '1', name: 'Superman', image: '/placeholder-character.png' },
    { _id: '2', name: 'Batman', image: '/placeholder-character.png' },
    { _id: '3', name: 'Spider-Man', image: '/placeholder-character.png' }
  ]);
});

// Mock divisions endpoint
app.get('/api/divisions', (req, res) => {
  res.json([
    { _id: '1', name: 'Metahuman', description: 'Enhanced humans with special abilities' },
    { _id: '2', name: 'Cosmic', description: 'Beings with cosmic-level powers' },
    { _id: '3', name: 'Street Level', description: 'Ground-level heroes and vigilantes' }
  ]);
});

// Mock messages endpoints
app.get('/api/messages/unread/count', (req, res) => {
  res.json({ unreadCount: 0 });
});

// Mock notifications endpoints
app.get('/api/notifications/unread/count', (req, res) => {
  res.json({ unreadCount: 0 });
});

app.get('/api/notifications', (req, res) => {
  res.json({ notifications: [] });
});

// Mock stats endpoint
app.get('/api/stats/leaderboard', (req, res) => {
  res.json([
    { _id: '1', username: 'Player1', wins: 10, losses: 2, score: 1000 },
    { _id: '2', username: 'Player2', wins: 8, losses: 3, score: 850 },
    { _id: '3', username: 'Player3', wins: 6, losses: 4, score: 700 }
  ]);
});

// Catch all other API routes
app.use('/api/*', (req, res) => {
  res.json({ 
    message: 'API endpoint not implemented yet',
    endpoint: req.originalUrl,
    method: req.method 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 CORS enabled for: ${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;