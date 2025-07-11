const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../src/models/userModel');
const Character = require('../src/models/characterModel');
const Division = require('../src/models/divisionModel');
const { Badge, UserBadge } = require('../src/models/badgeModel');
const { ChatRoom, ChatMessage, ChatUserSession } = require('../src/models/chatModel');
const Post = require('../src/models/postModel');
const Comment = require('../src/models/commentModel');
const Fight = require('../src/models/fightModel');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fight-site');
    console.log('MongoDB connected for seeding');
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Seed divisions
const seedDivisions = async () => {
  console.log('Seeding divisions...');
  
  const divisions = [
    {
      name: 'Regular People',
      description: 'Characters with normal human abilities',
      powerLevel: 1,
      color: '#6c757d',
      icon: '👤',
      rules: 'Only characters with normal human abilities. No superpowers, magic, or enhanced abilities.',
      stats: {
        totalFights: 0,
        totalVotes: 0,
        activeTeams: 0,
        averageVotesPerFight: 0
      }
    },
    {
      name: 'Metahuman',
      description: 'Enhanced humans with special abilities',
      powerLevel: 2,
      color: '#28a745',
      icon: '🦸',
      rules: 'Characters with enhanced abilities, minor superpowers, or special training.',
      stats: {
        totalFights: 0,
        totalVotes: 0,
        activeTeams: 0,
        averageVotesPerFight: 0
      }
    },
    {
      name: 'Planet Busters',
      description: 'Beings capable of destroying planets',
      powerLevel: 3,
      color: '#fd7e14',
      icon: '🌍',
      rules: 'Characters with planet-level destructive capabilities.',
      stats: {
        totalFights: 0,
        totalVotes: 0,
        activeTeams: 0,
        averageVotesPerFight: 0
      }
    },
    {
      name: 'God Tier',
      description: 'God-like beings with immense power',
      powerLevel: 4,
      color: '#6f42c1',
      icon: '⚡',
      rules: 'Deity-level characters with reality-warping abilities.',
      stats: {
        totalFights: 0,
        totalVotes: 0,
        activeTeams: 0,
        averageVotesPerFight: 0
      }
    },
    {
      name: 'Universal Threat',
      description: 'Threats to entire universes',
      powerLevel: 5,
      color: '#dc3545',
      icon: '🌌',
      rules: 'Characters capable of threatening or destroying entire universes.',
      stats: {
        totalFights: 0,
        totalVotes: 0,
        activeTeams: 0,
        averageVotesPerFight: 0
      }
    },
    {
      name: 'Omnipotent',
      description: 'All-powerful beings beyond comprehension',
      powerLevel: 6,
      color: '#ffd700',
      icon: '✨',
      rules: 'Characters with unlimited power and abilities.',
      stats: {
        totalFights: 0,
        totalVotes: 0,
        activeTeams: 0,
        averageVotesPerFight: 0
      }
    }
  ];

  for (const divisionData of divisions) {
    const existingDivision = await Division.findOne({ name: divisionData.name });
    if (!existingDivision) {
      await Division.create(divisionData);
      console.log(`Created division: ${divisionData.name}`);
    } else {
      console.log(`Division already exists: ${divisionData.name}`);
    }
  }
};

// Seed characters
const seedCharacters = async () => {
  console.log('Seeding characters...');
  
  const characters = [
    // Regular People (Power Level 1)
    {
      name: 'Jim Ross',
      universe: 'WWE',
      powerLevel: 1,
      image: '/characters/Jim_Ross.jpg',
      description: 'Legendary WWE commentator and wrestling personality',
      abilities: ['Commentary', 'Wrestling Knowledge', 'Charisma'],
      isLocked: false
    },
    {
      name: 'Lois Lane',
      universe: 'DC',
      powerLevel: 1,
      image: '/characters/Lois_Lane.jpg',
      description: 'Intrepid reporter and Superman\'s love interest',
      abilities: ['Investigative Journalism', 'Intelligence', 'Courage'],
      isLocked: false
    },
    {
      name: 'Ivan Drago',
      universe: 'Rocky',
      powerLevel: 1,
      image: '/characters/Ivan_Drago.jpg',
      description: 'Soviet boxing champion with incredible strength',
      abilities: ['Boxing', 'Superior Strength', 'Discipline'],
      isLocked: false
    },
    
    // Metahuman (Power Level 2)
    {
      name: 'Spider-Man',
      universe: 'Marvel',
      powerLevel: 2,
      image: '/characters/Spider-Man.jpg',
      description: 'Web-slinging superhero with spider-like abilities',
      abilities: ['Spider-Sense', 'Web-Slinging', 'Superhuman Strength', 'Wall-Crawling'],
      isLocked: false
    },
    {
      name: 'Cyclops',
      universe: 'Marvel',
      powerLevel: 2,
      image: '/characters/Cyclops.jpg',
      description: 'X-Men leader with optic blast powers',
      abilities: ['Optic Blasts', 'Leadership', 'Tactical Genius'],
      isLocked: false
    },
    
    // Planet Busters (Power Level 3)
    {
      name: 'Hulk',
      universe: 'Marvel',
      powerLevel: 3,
      image: '/characters/Hulk.jpg',
      description: 'Incredible Hulk with unlimited strength',
      abilities: ['Unlimited Strength', 'Regeneration', 'Rage Enhancement'],
      isLocked: false
    },
    {
      name: 'Krillin',
      universe: 'Dragon Ball',
      powerLevel: 3,
      image: '/characters/Krillin.jpg',
      description: 'Z-Fighter with powerful ki abilities',
      abilities: ['Ki Manipulation', 'Destructo Disc', 'Solar Flare'],
      isLocked: false
    },
    
    // God Tier (Power Level 4)
    {
      name: 'Thor',
      universe: 'Marvel',
      powerLevel: 4,
      image: '/characters/Thor.jpg',
      description: 'God of Thunder with control over lightning',
      abilities: ['Lightning Control', 'Mjolnir', 'Godly Strength', 'Weather Manipulation'],
      isLocked: false
    },
    {
      name: 'Zeus',
      universe: 'Greek Mythology',
      powerLevel: 4,
      image: '/characters/Zeus.jpg',
      description: 'King of the Greek Gods',
      abilities: ['Lightning Control', 'Shape-Shifting', 'Immortality', 'Divine Authority'],
      isLocked: false
    },
    {
      name: 'Cell',
      universe: 'Dragon Ball',
      powerLevel: 4,
      image: '/characters/Cell.jpg',
      description: 'Perfect android with all Z-Fighter abilities',
      abilities: ['Ki Manipulation', 'Regeneration', 'Absorption', 'Solar Flare'],
      isLocked: false
    },
    
    // Universal Threat (Power Level 5)
    {
      name: 'Anti-Monitor',
      universe: 'DC',
      powerLevel: 5,
      image: '/characters/Anti-Monitor.jpg',
      description: 'Cosmic entity that destroys universes',
      abilities: ['Universe Destruction', 'Reality Manipulation', 'Cosmic Awareness'],
      isLocked: false
    },
    {
      name: 'Fused Zamasu',
      universe: 'Dragon Ball',
      powerLevel: 5,
      image: '/characters/Fused_Zamasu.jpg',
      description: 'Fusion of Goku Black and Zamasu',
      abilities: ['Ki Manipulation', 'Immortality', 'Reality Warping', 'Time Manipulation'],
      isLocked: false
    },
    
    // Omnipotent (Power Level 6)
    {
      name: 'Living Tribunal',
      universe: 'Marvel',
      powerLevel: 6,
      image: '/characters/Living_Tribunal.jpg',
      description: 'Cosmic entity that judges the multiverse',
      abilities: ['Omnipotence', 'Multiverse Control', 'Reality Manipulation', 'Cosmic Judgment'],
      isLocked: false
    },
    {
      name: 'Beyonder',
      universe: 'Marvel',
      powerLevel: 6,
      image: '/characters/Beyonder.jpg',
      description: 'Entity from beyond the multiverse',
      abilities: ['Omnipotence', 'Reality Manipulation', 'Existence Beyond Multiverse'],
      isLocked: false
    },
    {
      name: 'Cosmic Armor Superman',
      universe: 'DC',
      powerLevel: 6,
      image: '/characters/Cosmic_Armor_Superman.jpg',
      description: 'Superman with armor that makes him omnipotent',
      abilities: ['Omnipotence', 'Reality Manipulation', 'Cosmic Armor', 'Thought Robot'],
      isLocked: false
    }
  ];

  for (const characterData of characters) {
    const existingCharacter = await Character.findOne({ name: characterData.name });
    if (!existingCharacter) {
      await Character.create(characterData);
      console.log(`Created character: ${characterData.name}`);
    } else {
      console.log(`Character already exists: ${characterData.name}`);
    }
  }
};

// Seed badges
const seedBadges = async () => {
  console.log('Seeding badges...');
  
  const badges = [
    {
      name: 'first_victory',
      displayName: 'First Victory',
      description: 'Win your first official fight',
      icon: '🏆',
      color: '#FFD700',
      category: 'achievement',
      rarity: 'common',
      criteria: {
        type: 'wins',
        value: 1,
        timeFrame: 'lifetime'
      }
    },
    {
      name: 'veteran_fighter',
      displayName: 'Veteran Fighter',
      description: 'Participate in 50 fights',
      icon: '⚔️',
      color: '#C0C0C0',
      category: 'achievement',
      rarity: 'rare',
      criteria: {
        type: 'votes',
        value: 50,
        timeFrame: 'lifetime'
      }
    },
    {
      name: 'community_pillar',
      displayName: 'Community Pillar',
      description: 'Create 100 posts',
      icon: '📝',
      color: '#87CEEB',
      category: 'achievement',
      rarity: 'uncommon',
      criteria: {
        type: 'posts',
        value: 100,
        timeFrame: 'lifetime'
      }
    },
    {
      name: 'division_pioneer',
      displayName: 'Division Pioneer',
      description: 'Join all 6 divisions',
      icon: '🌟',
      color: '#9370DB',
      category: 'achievement',
      rarity: 'epic',
      criteria: {
        type: 'custom',
        value: 6,
        timeFrame: 'lifetime'
      }
    },
    {
      name: 'betting_master',
      displayName: 'Betting Master',
      description: 'Win 10 bets in a row',
      icon: '💰',
      color: '#FFD700',
      category: 'achievement',
      rarity: 'legendary',
      criteria: {
        type: 'custom',
        value: 10,
        timeFrame: 'lifetime'
      }
    },
    {
      name: 'winning_streak',
      displayName: 'Winning Streak',
      description: 'Win 5 fights in a row',
      icon: '🔥',
      color: '#FF4500',
      category: 'achievement',
      rarity: 'rare',
      criteria: {
        type: 'streak',
        value: 5,
        timeFrame: 'lifetime'
      }
    }
  ];

  for (const badgeData of badges) {
    const existingBadge = await Badge.findOne({ name: badgeData.name });
    if (!existingBadge) {
      await Badge.create(badgeData);
      console.log(`Created badge: ${badgeData.displayName}`);
    } else {
      console.log(`Badge already exists: ${badgeData.displayName}`);
    }
  }
};

// Seed chat rooms
const seedChatRooms = async () => {
  console.log('Seeding chat rooms...');
  
  const chatRooms = [
    {
      name: 'general',
      displayName: 'General Chat',
      description: 'General discussion for all users',
      category: 'general'
    },
    {
      name: 'divisions',
      displayName: 'Divisions',
      description: 'Division-specific discussions',
      category: 'division'
    },
    {
      name: 'feed',
      displayName: 'Feed',
      description: 'Feed-related discussions',
      category: 'general'
    },
    {
      name: 'help',
      displayName: 'Help & Support',
      description: 'Get help and support from the community',
      category: 'support'
    },
    {
      name: 'off-topic',
      displayName: 'Off Topic',
      description: 'Random discussions and fun',
      category: 'off-topic'
    }
  ];

  for (const roomData of chatRooms) {
    const existingRoom = await ChatRoom.findOne({ name: roomData.name });
    if (!existingRoom) {
      await ChatRoom.create(roomData);
      console.log(`Created chat room: ${roomData.displayName}`);
    } else {
      console.log(`Chat room already exists: ${roomData.displayName}`);
    }
  }
};

// Seed admin user
const seedAdminUser = async () => {
  console.log('Seeding admin user...');
  
  const adminData = {
    username: 'admin',
    email: 'admin@fightsite.com',
    password: await bcrypt.hash('admin123', 12),
    role: 'moderator',
    profile: {
      avatar: '/avatars/admin.jpg',
      bio: 'Site administrator and moderator',
      customTitle: 'Site Admin',
      customNicknameColor: '#FF0000'
    },
    stats: {
      posts: 0,
      comments: 0,
      votes: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      currentStreak: 0,
      longestStreak: 0
    },
    virtualCoins: 1000,
    divisions: [],
    following: [],
    followers: [],
    gdprConsent: true,
    cookieConsent: true
  };

  const existingAdmin = await User.findOne({ email: adminData.email });
  if (!existingAdmin) {
    await User.create(adminData);
    console.log('Created admin user');
  } else {
    console.log('Admin user already exists');
  }
};

// Seed test user
const seedTestUser = async () => {
  console.log('Seeding test user...');
  
  const testUserData = {
    username: 'testuser',
    email: 'test@fightsite.com',
    password: await bcrypt.hash('test123', 12),
    role: 'user',
    profile: {
      avatar: '/avatars/testuser.jpg',
      bio: 'Test user for development',
      customTitle: 'Test User',
      customNicknameColor: '#00FF00'
    },
    stats: {
      posts: 5,
      comments: 20,
      votes: 50,
      wins: 3,
      losses: 2,
      draws: 1,
      winRate: 50,
      currentStreak: 2,
      longestStreak: 3
    },
    virtualCoins: 500,
    divisions: [],
    following: [],
    followers: [],
    gdprConsent: true,
    cookieConsent: true
  };

  const existingTestUser = await User.findOne({ email: testUserData.email });
  if (!existingTestUser) {
    await User.create(testUserData);
    console.log('Created test user');
  } else {
    console.log('Test user already exists');
  }
};

// Main seeding function
const seedAllData = async () => {
  try {
    await connectDB();
    
    console.log('Starting data seeding...');
    
    await seedDivisions();
    await seedCharacters();
    await seedBadges();
    await seedChatRooms();
    await seedAdminUser();
    await seedTestUser();
    
    console.log('Data seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedAllData();
}

module.exports = { seedAllData }; 