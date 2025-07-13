import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  profile: {
    bio: String,
    profilePicture: String,
    favoriteCharacters: [String],
    joinDate: Date,
    lastActive: Date,
    avatar: String,
    description: String
  },
  stats: {
    fightsWon: { type: Number, default: 0 },
    fightsLost: { type: Number, default: 0 },
    fightsDrawn: { type: Number, default: 0 },
    fightsNoContest: { type: Number, default: 0 },
    totalFights: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    rank: { type: String, default: 'Rookie' },
    points: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 }
  },
  activity: {
    postsCreated: { type: Number, default: 0 },
    commentsPosted: { type: Number, default: 0 },
    likesReceived: { type: Number, default: 0 },
    tournamentsWon: { type: Number, default: 0 },
    tournamentsParticipated: { type: Number, default: 0 }
  },
  achievements: { type: Array, default: [] }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;
