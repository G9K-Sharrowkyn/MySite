import { usersRepo, withDb } from '../repositories/index.js';

const TARGET_ADMIN_EMAIL = (process.env.PRIMARY_ADMIN_EMAIL || 'ak4maaru@gmail.com').trim().toLowerCase();

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isLegacyModeratorAccount = (user) => {
  const email = normalizeEmail(user.email);
  const username = String(user.username || '').toLowerCase();
  return (
    email.startsWith('moderator') && email.endsWith('@versusversevault.com')
  ) || /^moderator[0-9]*$/.test(username);
};

const run = async () => {
  await withDb(async (db) => {
    await usersRepo.updateAll((users) => {
      let adminFound = false;

      for (const user of users) {
        if (normalizeEmail(user.email) === TARGET_ADMIN_EMAIL) {
          user.role = 'admin';
          user.emailVerified = true;
          user.updatedAt = new Date().toISOString();
          adminFound = true;
        } else if (user.role === 'admin') {
          user.role = 'user';
          user.updatedAt = new Date().toISOString();
        }
      }

      if (!adminFound) {
        const error = new Error(`Admin account ${TARGET_ADMIN_EMAIL} not found.`);
        error.code = 'ADMIN_NOT_FOUND';
        throw error;
      }

      const cleanedUsers = users.filter((user) => !isLegacyModeratorAccount(user));

      for (const user of cleanedUsers) {
        if (user.role === 'moderator') {
          user.role = 'user';
          user.updatedAt = new Date().toISOString();
        }
      }

      return cleanedUsers;
    }, { db });

    return db;
  });

  console.log(`Primary admin set to ${TARGET_ADMIN_EMAIL}.`);
  console.log('Legacy moderator accounts removed and all remaining moderators demoted to user.');
};

run().catch((error) => {
  if (error.code === 'ADMIN_NOT_FOUND') {
    console.error(error.message);
  } else {
    console.error('Failed to update admin/moderator accounts:', error);
  }
  process.exitCode = 1;
});
