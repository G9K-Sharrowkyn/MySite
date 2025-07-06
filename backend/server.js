require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

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
  divisions: []
});

// Read data from JSON file
db.read();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Increase URL-encoded payload limit

// Make db accessible to routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/fights', require('./routes/fights'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/votes', require('./routes/votes'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/divisions', require('./routes/divisions'));

// Basic route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
