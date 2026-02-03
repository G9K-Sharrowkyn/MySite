import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { usersRepo, withDb } from '../repositories/index.js';

const STAFF_PASSWORD = process.env.STAFF_TEMP_PASSWORD || 'Admin123!';

const nowIso = () => new Date().toISOString();

const buildBaseUser = ({ username, email, role }) => {
  const now = nowIso();
  return {
    id: uuidv4(),
    username,
    email,
    emailVerified: true,
    password: '',
    role,
    authProvider: 'local',
    profile: {
      displayName: username,
      bio: '',
      profilePicture: '/logo192.png',
      favoriteCharacters: [],
      joinDate: now,
      lastActive: now,
      avatar: '/logo192.png',
      description: role === 'admin' ? 'Site Administrator' : 'Site Moderator',
      backgroundImage: ''
    },
    stats: {
      fightsWon: 0,
      fightsLost: 0,
      fightsDrawn: 0,
      fightsNoContest: 0,
      totalFights: 0,
      winRate: 0,
      rank: 'Mortal',
      points: 0,
      level: 1,
      experience: 0,
      officialStats: { fightsWon: 0, fightsLost: 0, fightsDrawn: 0, winRate: 0 },
      unofficialStats: { fightsWon: 0, fightsLost: 0, fightsDrawn: 0, winRate: 0 }
    },
    activity: {
      postsCreated: 0,
      commentsPosted: 0,
      reactionsGiven: 0,
      likesReceived: 0,
      tournamentsWon: 0,
      tournamentsParticipated: 0
    },
    coins: {
      balance: 1000,
      totalEarned: 1000,
      totalSpent: 0,
      lastBonusDate: now
    },
    achievements: [],
    divisions: {},
    customBackgrounds: [],
    backgroundSlots: 1,
    notificationSettings: {
      fightResults: true,
      divisionFights: true,
      reactions: true,
      comments: true,
      mentions: true,
      pushEnabled: false
    },
    tagPreferences: [],
    privacy: {
      cookieConsent: {
        given: false,
        analytics: false,
        marketing: false,
        functional: true
      },
      settings: {
        dataProcessing: true,
        marketing: false,
        profiling: false
      },
      accountDeleted: false
    },
    createdAt: now,
    updatedAt: now
  };
};

const desiredStaff = [
  { username: 'admin', email: 'admin@versusversevault.com', role: 'admin' },
  { username: 'moderator1', email: 'moderator1@versusversevault.com', role: 'moderator' },
  { username: 'moderator2', email: 'moderator2@versusversevault.com', role: 'moderator' },
  { username: 'moderator3', email: 'moderator3@versusversevault.com', role: 'moderator' }
];

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const run = async () => {
  const hashedPassword = await bcrypt.hash(STAFF_PASSWORD, 10);

  await withDb(async (db) => {
    await usersRepo.updateAll((users) => {
      const legacyEmails = new Set(['admin@site.local', 'moderator@site.local']);
      const legacyUsernames = new Set(['admin', 'moderator']);

      const cleaned = users.filter((user) => {
        const email = normalizeEmail(user.email);
        const username = String(user.username || '').toLowerCase();
        const isLegacy =
          legacyEmails.has(email) || legacyUsernames.has(username);
        return !isLegacy;
      });

      for (const staff of desiredStaff) {
        const user = buildBaseUser(staff);
        user.password = hashedPassword;
        cleaned.push(user);
      }

      return cleaned;
    }, { db });

    return db;
  });

  console.log('Staff accounts provisioned.');
  console.log('Temporary password for all staff:', STAFF_PASSWORD);
  for (const staff of desiredStaff) {
    console.log(`${staff.role.toUpperCase()}: ${staff.email}`);
  }
};

run().catch((error) => {
  console.error('Failed to provision staff accounts:', error);
  process.exitCode = 1;
});
