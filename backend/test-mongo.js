console.log('🚀 Testing MongoDB Atlas connection...');

require('dotenv').config();

const mongoose = require('mongoose');

const mongoUri = "mongodb+srv://aaaa:aaaa@atlascluster.8zc3jdx.mongodb.net/fight-site?retryWrites=true&w=majority&appName=AtlasCluster";

console.log('📡 Attempting to connect to MongoDB Atlas...');
console.log('🔗 URI:', mongoUri);

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
})
.then(() => {
  console.log('✅ MongoDB Atlas connected successfully!');
  console.log('📊 Database:', mongoose.connection.name);
  console.log('🌐 Host:', mongoose.connection.host);
  process.exit(0);
})
.catch((error) => {
  console.error('❌ MongoDB connection failed:', error.message);
  process.exit(1);
}); 