import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';

// Import models
import User from '../src/models/userModel.js';
import Character from '../src/models/characterModel.js';
import Division from '../src/models/divisionModel.js';
import Fight from '../src/models/fightModel.js';
import Post from '../src/models/postModel.js';
import Comment from '../src/models/commentModel.js';
import Message from '../src/models/messageModel.js';
import Conversation from '../src/models/conversationModel.js';
import Notification from '../src/models/notificationModel.js';
import Tournament from '../src/models/tournamentModel.js';
import Badge from '../src/models/badgeModel.js';
import { ChatRoom } from '../src/models/chatModel.js';

const seedCompleteSystem = async () => {
  try {
    console.log('🌱 Starting complete system seeding...');
    await connectDB();
    
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await Character.deleteMany({});
    await Division.deleteMany({});
    await Fight.deleteMany({});
    await Post.deleteMany({});
    await Comment.deleteMany({});
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    await Notification.deleteMany({});
    await Tournament.deleteMany({});
    await Badge.deleteMany({});
    await ChatRoom.deleteMany({});
    
    console.log('✅ Data cleared');
    
    // 1. Create Divisions
    console.log('🏆 Creating divisions...');
    const divisions = await Division.insertMany([
      {
        name: "Regular People",
        description: "Fighters like Jim Ross, Lois Lane, Ivan Drago - normal humans with exceptional skills",
        powerLevel: 1,
        maxCharacters: 50,
        rules: "Only regular humans with no supernatural powers. Peak human abilities allowed.",
        color: "#8B4513",
        icon: "👤"
      },
      {
        name: "Metahuman", 
        description: "Enhanced humans with special abilities like Spider-Man, Cyclops, Batman",
        powerLevel: 2,
        maxCharacters: 75,
        rules: "Enhanced humans with special abilities. No planet-level threats.",
        color: "#4169E1",
        icon: "🦸"
      },
      {
        name: "Planet Busters",
        description: "Beings capable of destroying planets like Hulk, Krillin, Superman",
        powerLevel: 3,
        maxCharacters: 60,
        rules: "Characters with planet-level destructive capabilities.",
        color: "#FF4500",
        icon: "🌍"
      },
      {
        name: "God Tier",
        description: "Divine beings like Thor, Zeus, Cell, Goku SSJ4",
        powerLevel: 4,
        maxCharacters: 40,
        rules: "God-level beings with reality-warping abilities.",
        color: "#FFD700",
        icon: "⚡"
      },
      {
        name: "Universal Threat",
        description: "Beings that threaten entire universes like Anti-Monitor, Fused Zamasu",
        powerLevel: 5,
        maxCharacters: 25,
        rules: "Universal-level threats with reality-destroying powers.",
        color: "#8B0000",
        icon: "🌌"
      },
      {
        name: "Omnipotent",
        description: "All-powerful beings like Living Tribunal, Beyonder, Cosmic Armor Superman",
        powerLevel: 6,
        maxCharacters: 15,
        rules: "Omnipotent beings with unlimited power. Highest tier.",
        color: "#9400D3",
        icon: "♾️"
      }
    ]);
    console.log(`✅ Created ${divisions.length} divisions`);
    
    // 2. Create Characters
    console.log('⚔️ Creating characters...');
    const characters = await Character.insertMany([
      // Regular People
      { name: "Jim Ross", universe: "WWE", division: "Regular People", image: "/characters/jim-ross.jpg", description: "Legendary WWE commentator", powerLevel: 1 },
      { name: "Lois Lane", universe: "DC", division: "Regular People", image: "/characters/lois-lane.jpg", description: "Intrepid reporter", powerLevel: 1 },
      { name: "Ivan Drago", universe: "Rocky", division: "Regular People", image: "/characters/ivan-drago.jpg", description: "Soviet boxing champion", powerLevel: 1 },
      
      // Metahuman
      { name: "Spider-Man", universe: "Marvel", division: "Metahuman", image: "/characters/spider-man.jpg", description: "Web-slinging superhero", powerLevel: 2 },
      { name: "Batman (New52)", universe: "DC", division: "Metahuman", image: "/characters/Batman(New52).jpg", description: "Dark Knight detective", powerLevel: 2 },
      { name: "Black Adam (New52)", universe: "DC", division: "Metahuman", image: "/characters/Black_Adam(New52).jpg", description: "Ancient Egyptian champion", powerLevel: 2 },
      
      // Planet Busters
      { name: "Hulk", universe: "Marvel", division: "Planet Busters", image: "/characters/hulk.jpg", description: "Gamma-powered giant", powerLevel: 3 },
      { name: "Superman (New52)", universe: "DC", division: "Planet Busters", image: "/characters/Superman(New52).webp", description: "Man of Steel", powerLevel: 3 },
      { name: "Thor", universe: "Marvel", division: "Planet Busters", image: "/characters/thor.jpg", description: "God of Thunder", powerLevel: 3 },
      
      // God Tier
      { name: "Goku (SSJ4)", universe: "Dragon Ball", division: "God Tier", image: "/characters/Goku(SSJ4).jpg", description: "Saiyan warrior", powerLevel: 4 },
      { name: "Vegeta (Ultra Ego)", universe: "Dragon Ball", division: "God Tier", image: "/characters/Vegeta(UltraEgo).jpg", description: "Saiyan prince", powerLevel: 4 },
      { name: "Zeus", universe: "Greek Mythology", division: "God Tier", image: "/characters/zeus.jpg", description: "King of the Greek gods", powerLevel: 4 },
      
      // Universal Threat
      { name: "Anti-Monitor (New52)", universe: "DC", division: "Universal Threat", image: "/characters/Anti-Monitor(New52).webp", description: "Anti-matter being", powerLevel: 5 },
      { name: "Fused Zamasu", universe: "Dragon Ball", division: "Universal Threat", image: "/characters/fused-zamasu.jpg", description: "Fusion of Goku Black and Zamasu", powerLevel: 5 },
      { name: "Darkseid (New52)", universe: "DC", division: "Universal Threat", image: "/characters/Darkseid_(New52).jpg", description: "God of Evil", powerLevel: 5 },
      
      // Omnipotent
      { name: "Living Tribunal", universe: "Marvel", division: "Omnipotent", image: "/characters/living-tribunal.jpg", description: "Cosmic entity", powerLevel: 6 },
      { name: "Beyonder", universe: "Marvel", division: "Omnipotent", image: "/characters/beyonder.jpg", description: "Omnipotent being", powerLevel: 6 },
      { name: "Cosmic Armor Superman", universe: "DC", division: "Omnipotent", image: "/characters/cosmic-armor-superman.jpg", description: "Thought robot armor", powerLevel: 6 }
    ]);
    console.log(`✅ Created ${characters.length} characters`);
    
    // 3. Create Badges
    console.log('🏅 Creating badges...');
    const badges = await Badge.insertMany([
      {
        name: 'First Victory',
        description: 'Win your first official fight',
        icon: '🏆',
        category: 'achievement',
        rarity: 'common',
        autoAward: { enabled: true, condition: 'wins', value: 1 },
        points: 50,
        color: '#FFD700'
      },
      {
        name: 'Champion',
        description: 'Become a division champion',
        icon: '👑',
        category: 'champion',
        rarity: 'epic',
        autoAward: { enabled: true, condition: 'champion', value: 1 },
        points: 500,
        color: '#FFD700'
      },
      {
        name: 'Veteran Fighter',
        description: 'Participate in 50 fights',
        icon: '⚔️',
        category: 'milestone',
        rarity: 'rare',
        autoAward: { enabled: true, condition: 'fights', value: 50 },
        points: 200,
        color: '#C0C0C0'
      },
      {
        name: 'Community Pillar',
        description: 'Create 100 posts',
        icon: '📝',
        category: 'achievement',
        rarity: 'uncommon',
        autoAward: { enabled: true, condition: 'posts', value: 100 },
        points: 150,
        color: '#87CEEB'
      }
    ]);
    console.log(`✅ Created ${badges.length} badges`);
    
    // 4. Create Chat Rooms
    console.log('💬 Creating chat rooms...');
    const chatRooms = await ChatRoom.insertMany([
      {
        name: 'global',
        displayName: 'Global Chat',
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
    ]);
    console.log(`✅ Created ${chatRooms.length} chat rooms`);
    
    // 5. Create Users
    console.log('👥 Creating users...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const users = await User.insertMany([
      {
        username: 'moderator',
        email: 'moderator@site.local',
        password: hashedPassword,
        role: 'moderator',
        virtualCoins: 5000,
        profile: {
          avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiM2NjYiLz48dGV4dCB4PSI3NSIgeT0iODAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNSIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TW9kPC90ZXh0Pjwvc3ZnPg==',
          description: 'Site moderator and administrator',
          customTitle: 'Site Moderator',
          customNicknameColor: '#FFD700'
        },
        badges: [
          {
            name: 'First Victory',
            description: 'Win your first official fight',
            icon: '🏆',
            earnedAt: new Date(),
            category: 'achievement'
          }
        ],
        consent: {
          privacyPolicy: true,
          termsOfService: true,
          cookies: true,
          marketingEmails: false
        }
      },
      {
        username: 'ultracode1',
        email: 'invinciblecharles@wp.pl',
        password: hashedPassword,
        role: 'user',
        virtualCoins: 1500,
        profile: {
          avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI3NSIgeT0iODAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNSIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VXNlcjwvdGV4dD48L3N2Zz4=',
          description: 'I love anime and games!',
          customTitle: 'Anime Enthusiast',
          customNicknameColor: '#FF69B4'
        },
        stats: {
          wins: 5,
          losses: 2,
          draws: 1,
          totalFights: 8,
          winRate: 62.5
        },
        activity: {
          postsCreated: 15,
          commentsPosted: 25,
          fightsCreated: 8,
          votesGiven: 30,
          lastActive: new Date()
        },
        consent: {
          privacyPolicy: true,
          termsOfService: true,
          cookies: true,
          marketingEmails: true
        }
      },
      {
        username: 'testuser',
        email: 'testuser@example.com',
        password: hashedPassword,
        role: 'user',
        virtualCoins: 1000,
        profile: {
          avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiM0Q0FGNTAiLz48dGV4dCB4PSI3NSIgeT0iODAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNSIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VGVzdDwvdGV4dD48L3N2Zz4=',
          description: 'Testing the system',
          customTitle: 'Beta Tester',
          customNicknameColor: '#4CAF50'
        },
        stats: {
          wins: 2,
          losses: 3,
          draws: 0,
          totalFights: 5,
          winRate: 40
        },
        activity: {
          postsCreated: 5,
          commentsPosted: 10,
          fightsCreated: 3,
          votesGiven: 15,
          lastActive: new Date()
        },
        consent: {
          privacyPolicy: true,
          termsOfService: true,
          cookies: true,
          marketingEmails: false
        }
      }
    ]);
    console.log(`✅ Created ${users.length} users`);
    
    // 6. Create Sample Fights
    console.log('🥊 Creating sample fights...');
    const fights = await Fight.insertMany([
      {
        createdBy: users[1]._id, // ultracode1
        teamA: [characters[3]._id, characters[4]._id], // Spider-Man, Batman
        teamB: [characters[5]._id, characters[6]._id], // Black Adam, Hulk
        votesA: 15,
        votesB: 12,
        voters: [
          { user: users[0]._id, team: 'A' },
          { user: users[1]._id, team: 'B' },
          { user: users[2]._id, team: 'A' }
        ],
        isOfficial: true,
        division: divisions[1]._id, // Metahuman
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        status: 'open',
        bettingEnabled: true,
        bettingEndsAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
        totalBetsA: 500,
        totalBetsB: 300,
        totalBetAmount: 800,
        tags: ['marvel', 'dc', 'metahuman', 'spider-man', 'batman', 'black-adam', 'hulk']
      },
      {
        createdBy: users[2]._id, // testuser
        teamA: [characters[7]._id], // Superman
        teamB: [characters[8]._id], // Thor
        votesA: 8,
        votesB: 10,
        voters: [
          { user: users[0]._id, team: 'B' },
          { user: users[1]._id, team: 'A' }
        ],
        isOfficial: false,
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        status: 'open',
        tags: ['superman', 'thor', 'planet-busters', 'marvel', 'dc']
      }
    ]);
    console.log(`✅ Created ${fights.length} fights`);
    
    // 7. Create Sample Posts
    console.log('📝 Creating sample posts...');
    const posts = await Post.insertMany([
      {
        author: users[1]._id,
        content: 'Who would win: Spider-Man vs Batman? Both are street-level heroes with amazing skills!',
        type: 'discussion',
        tags: ['spider-man', 'batman', 'marvel', 'dc', 'discussion'],
        likes: 5,
        comments: 3
      },
      {
        author: users[2]._id,
        content: 'Just created my first fight! Superman vs Thor - who do you think will win?',
        type: 'fight_announcement',
        relatedFight: fights[1]._id,
        tags: ['superman', 'thor', 'fight', 'planet-busters'],
        likes: 3,
        comments: 2
      }
    ]);
    console.log(`✅ Created ${posts.length} posts`);
    
    // 8. Create Sample Comments
    console.log('💬 Creating sample comments...');
    const comments = await Comment.insertMany([
      {
        author: users[0]._id,
        content: 'Great discussion! I think Batman would win due to his preparation and intelligence.',
        post: posts[0]._id,
        likes: 2
      },
      {
        author: users[2]._id,
        content: 'Spider-Man has superhuman strength and spider-sense though!',
        post: posts[0]._id,
        likes: 1
      },
      {
        author: users[1]._id,
        content: 'I voted for Thor! His lightning powers are incredible.',
        post: posts[1]._id,
        likes: 1
      }
    ]);
    console.log(`✅ Created ${comments.length} comments`);
    
    // 9. Create Sample Tournament
    console.log('🏆 Creating sample tournament...');
    const tournament = await Tournament.create({
      name: 'Metahuman Championship',
      description: 'The ultimate tournament for metahuman fighters',
      creator: users[0]._id,
      participants: [users[1]._id, users[2]._id],
      maxParticipants: 16,
      status: 'upcoming',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      rules: 'Standard tournament rules apply. Single elimination bracket.'
    });
    console.log('✅ Created tournament');
    
    // 10. Create Sample Notifications
    console.log('🔔 Creating sample notifications...');
    const notifications = await Notification.insertMany([
      {
        user: users[1]._id,
        type: 'fight_result',
        title: 'Fight Result',
        message: 'Your fight "Spider-Man & Batman vs Black Adam & Hulk" has ended!',
        data: { fightId: fights[0]._id },
        isRead: false
      },
      {
        user: users[1]._id,
        type: 'comment',
        title: 'New Comment',
        message: 'Someone commented on your post about Spider-Man vs Batman',
        data: { postId: posts[0]._id, commentId: comments[0]._id },
        isRead: false
      }
    ]);
    console.log(`✅ Created ${notifications.length} notifications`);
    
    console.log('\n🎉 Complete system seeding finished!');
    console.log('\n📊 Summary:');
    console.log(`- ${divisions.length} divisions created`);
    console.log(`- ${characters.length} characters created`);
    console.log(`- ${badges.length} badges created`);
    console.log(`- ${chatRooms.length} chat rooms created`);
    console.log(`- ${users.length} users created`);
    console.log(`- ${fights.length} fights created`);
    console.log(`- ${posts.length} posts created`);
    console.log(`- ${comments.length} comments created`);
    console.log(`- 1 tournament created`);
    console.log(`- ${notifications.length} notifications created`);
    
    console.log('\n🔑 Test Accounts:');
    console.log('Moderator: moderator@site.local / password123');
    console.log('User 1: invinciblecharles@wp.pl / password123');
    console.log('User 2: testuser@example.com / password123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding system:', error);
    process.exit(1);
  }
};

seedCompleteSystem(); 