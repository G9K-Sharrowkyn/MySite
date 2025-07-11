console.log('🚀 Starting working server...');

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Atlas connection
const mongoUri = "mongodb+srv://aaaa:aaaa@atlascluster.8zc3jdx.mongodb.net/fight-site?retryWrites=true&w=majority&appName=AtlasCluster";

console.log('📡 Connecting to MongoDB Atlas...');

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
})
.then(() => {
  console.log('✅ MongoDB Atlas connected successfully!');
  console.log('📊 Database:', mongoose.connection.name);
  console.log('🌐 Host:', mongoose.connection.host);
})
.catch((error) => {
  console.error('❌ MongoDB connection failed:', error.message);
});

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Server is working!',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API: http://localhost:${PORT}`);
  console.log(`🗄️ Database: MongoDB Atlas`);
  console.log(`🔒 Security: CORS enabled`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Server shutting down...');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed.');
    process.exit(0);
  });
}); 