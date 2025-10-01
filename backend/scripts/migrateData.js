import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Fight from '../models/Fight.js';
import Character from '../models/Character.js';
import Notification from '../models/Notification.js';

dotenv.config();

const __dirname = path.dirname(new URL(import.meta.url).pathname);

async function migrateData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Setup LowDB
    const file = path.join(__dirname, '../db.json');
    const adapter = new JSONFile(file);
    const db = new Low(adapter, {});
    await db.read();

    console.log('📄 LowDB data loaded');

    // Migrate Users
    if (db.data.users && db.data.users.length > 0) {
      console.log(`🔄 Migrating ${db.data.users.length} users...`);

      for (const userData of db.data.users) {
        const existingUser = await User.findOne({
          $or: [
            { email: userData.email },
            { username: userData.username }
          ]
        });

        if (!existingUser) {
          const user = new User({
            username: userData.username,
            email: userData.email,
            password: userData.password,
            role: userData.role || 'user',
            profile: {
              bio: userData.profile?.bio || '',
              profilePicture: userData.profile?.profilePicture || userData.profile?.avatar || '',
              favoriteCharacters: userData.profile?.favoriteCharacters || [],
              joinDate: userData.profile?.joinDate ? new Date(userData.profile.joinDate) : new Date(),
              lastActive: userData.profile?.lastActive ? new Date(userData.profile.lastActive) : new Date(),
              avatar: userData.profile?.avatar || '',
              description: userData.profile?.description || ''
            },
            stats: {
              fightsWon: userData.profile?.stats?.wins || userData.stats?.fightsWon || 0,
              fightsLost: userData.profile?.stats?.losses || userData.stats?.fightsLost || 0,
              fightsDrawn: userData.profile?.stats?.draws || userData.stats?.fightsDrawn || 0,
              fightsNoContest: userData.stats?.fightsNoContest || 0,
              totalFights: userData.stats?.totalFights || 0,
              winRate: userData.stats?.winRate || 0,
              rank: userData.profile?.rank || userData.stats?.rank || 'Rookie',
              points: userData.profile?.score || userData.stats?.points || 0,
              level: userData.stats?.level || 1,
              experience: userData.stats?.experience || 0
            },
            activity: {
              postsCreated: userData.activity?.postsCreated || 0,
              commentsPosted: userData.activity?.commentsPosted || 0,
              likesReceived: userData.activity?.likesReceived || 0,
              tournamentsWon: userData.activity?.tournamentsWon || 0,
              tournamentsParticipated: userData.activity?.tournamentsParticipated || 0
            },
            achievements: userData.achievements || [],
            // Initialize coins system
            coins: {
              balance: 1000,
              totalEarned: 1000,
              totalSpent: 0,
              lastBonusDate: new Date()
            },
            // Migrate divisions data if exists
            divisions: new Map(Object.entries(userData.divisions || {}))
          });

          await user.save();
          console.log(`✅ Migrated user: ${userData.username}`);
        } else {
          console.log(`⚠️  User already exists: ${userData.username}`);
        }
      }
    }

    // Migrate Posts
    if (db.data.posts && db.data.posts.length > 0) {
      console.log(`🔄 Migrating ${db.data.posts.length} posts...`);

      for (const postData of db.data.posts) {
        const existingPost = await Post.findOne({
          title: postData.title,
          authorId: postData.authorId,
          createdAt: postData.createdAt
        });

        if (!existingPost) {
          // Find the user to get their MongoDB _id
          const author = await User.findOne({
            $or: [
              { _id: postData.authorId },
              { username: postData.author?.username }
            ]
          });

          if (author) {
            const post = new Post({
              title: postData.title,
              content: postData.content,
              type: postData.type || 'discussion',
              authorId: author._id,
              createdAt: postData.createdAt ? new Date(postData.createdAt) : new Date(),
              updatedAt: postData.updatedAt ? new Date(postData.updatedAt) : new Date(),
              likes: postData.likes || [],
              comments: postData.comments || [],
              views: postData.views || 0,
              photos: postData.photos || [],
              poll: postData.poll || null,
              fight: postData.fight || null,
              isOfficial: postData.isOfficial || false,
              moderatorCreated: postData.moderatorCreated || false,
              category: postData.category || null,
              featured: postData.featured || false
            });

            await post.save();
            console.log(`✅ Migrated post: ${postData.title}`);
          } else {
            console.log(`❌ Could not find author for post: ${postData.title}`);
          }
        }
      }
    }

    // Migrate Characters
    if (db.data.characters && db.data.characters.length > 0) {
      console.log(`🔄 Migrating ${db.data.characters.length} characters...`);

      for (const charData of db.data.characters) {
        const existingChar = await Character.findOne({ name: charData.name });

        if (!existingChar) {
          const character = new Character({
            name: charData.name,
            universe: charData.universe,
            image: charData.image,
            description: charData.description || '',
            powerLevel: charData.powerLevel || 'Regular People',
            abilities: charData.abilities || [],
            isActive: charData.isActive !== false
          });

          await character.save();
          console.log(`✅ Migrated character: ${charData.name}`);
        }
      }
    }

    // Migrate Notifications
    if (db.data.notifications && db.data.notifications.length > 0) {
      console.log(`🔄 Migrating ${db.data.notifications.length} notifications...`);

      for (const notifData of db.data.notifications) {
        const user = await User.findOne({
          $or: [
            { _id: notifData.userId },
            { username: notifData.user?.username }
          ]
        });

        if (user) {
          const notification = new Notification({
            userId: user._id,
            type: notifData.type,
            title: notifData.title,
            message: notifData.message,
            isRead: notifData.isRead || false,
            createdAt: notifData.createdAt ? new Date(notifData.createdAt) : new Date(),
            relatedId: notifData.relatedId || null,
            relatedType: notifData.relatedType || null
          });

          await notification.save();
          console.log(`✅ Migrated notification for user: ${user.username}`);
        }
      }
    }

    console.log('🎉 Data migration completed successfully!');
    console.log('💡 You can now disable LowDB and use MongoDB exclusively.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateData();
}

export default migrateData;