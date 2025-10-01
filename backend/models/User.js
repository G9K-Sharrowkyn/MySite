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
  achievements: { type: Array, default: [] },

  // Virtual coins system
  coins: {
    balance: { type: Number, default: 1000 },
    totalEarned: { type: Number, default: 1000 },
    totalSpent: { type: Number, default: 0 },
    lastBonusDate: { type: Date, default: Date.now }
  },

  // Divisions the user is part of
  divisions: {
    type: Map,
    of: {
      joinedAt: { type: Date, default: Date.now },
      team: {
        mainCharacter: {
          id: String,
          name: String,
          universe: String,
          image: String
        },
        secondaryCharacter: {
          id: String,
          name: String,
          universe: String,
          image: String
        }
      },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      rank: { type: String, default: 'Rookie' },
      points: { type: Number, default: 0 },
      isChampion: { type: Boolean, default: false }
    },
    default: {}
  },
  
  // Nowe pola dla niestandardowych teł profili
  customBackgrounds: [{
    id: { type: String, required: true },
    imageUrl: { type: String, required: true },
    purchaseDate: { type: Date, default: Date.now },
    active: { type: Boolean, default: false },
    cost: { type: Number, required: true }
  }],
  backgroundSlots: { type: Number, default: 1 },
  
  // Ustawienia powiadomień
  notificationSettings: {
    fightResults: { type: Boolean, default: true },
    divisionFights: { type: Boolean, default: true },
    reactions: { type: Boolean, default: true },
    comments: { type: Boolean, default: true },
    mentions: { type: Boolean, default: true },
    pushEnabled: { type: Boolean, default: false }
  },
  
  // Preferowane tagi do filtrowania
  tagPreferences: {
    type: [String],
    default: []
  },

  // Privacy and GDPR compliance
  privacy: {
    cookieConsent: {
      given: { type: Boolean, default: false },
      date: Date,
      analytics: { type: Boolean, default: false },
      marketing: { type: Boolean, default: false },
      functional: { type: Boolean, default: true }
    },
    settings: {
      dataProcessing: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
      profiling: { type: Boolean, default: false },
      updatedAt: Date
    },
    accountDeleted: { type: Boolean, default: false },
    deletionDate: Date
  }
}, { timestamps: true });

// Indeksy dla wydajności
userSchema.index({ 'customBackgrounds.active': 1 });
userSchema.index({ 'role': 1 });

const User = mongoose.model('User', userSchema);
export default User;
