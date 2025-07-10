const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// In-memory fallback data
const fallbackData = {
  users: [],
  posts: [],
  characters: [],
  divisions: [],
  fights: [],
  comments: [],
  messages: [],
  notifications: []
};

let isConnected = false;
let useFallback = false;

const connectDB = async () => {
  try {
    if (isConnected) return;

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    });

    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn('MongoDB connection failed, using fallback data:', error.message);
    useFallback = true;
    
    // Load fallback data from JSON file if it exists
    try {
      const dbPath = path.join(__dirname, '../../db.json');
      if (fs.existsSync(dbPath)) {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        Object.assign(fallbackData, data);
        console.log('Loaded fallback data from db.json');
      }
    } catch (jsonError) {
      console.warn('Could not load fallback data:', jsonError.message);
    }
  }
};

const saveFallbackData = () => {
  if (useFallback) {
    try {
      const dbPath = path.join(__dirname, '../../db.json');
      fs.writeFileSync(dbPath, JSON.stringify(fallbackData, null, 2));
    } catch (error) {
      console.error('Error saving fallback data:', error);
    }
  }
};

module.exports = {
  connectDB,
  isConnected: () => isConnected,
  useFallback: () => useFallback,
  fallbackData,
  saveFallbackData
};