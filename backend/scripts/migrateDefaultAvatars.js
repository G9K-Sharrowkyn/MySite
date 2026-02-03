import dotenv from 'dotenv';
import { usersRepo } from '../repositories/index.js';

dotenv.config();

const DEFAULT_AVATAR = '/logo192.png';

const resolveDatabaseMode = () => {
  const explicitMode = process.env.DATABASE || process.env.Database;
  if (explicitMode) {
    return explicitMode.toLowerCase();
  }

  // Backward-compatible fallback for older env setup.
  if ((process.env.USE_JSON_DB || '').toLowerCase() === 'true') {
    return 'local';
  }

  return 'local';
};

const isBlank = (value) => typeof value !== 'string' || value.trim().length === 0;

const needsDefaultAvatar = (value) =>
  isBlank(value) || value.trim() === '/placeholder-avatar.png';

const ensureProfileObject = (user) => {
  if (!user.profile || typeof user.profile !== 'object') {
    user.profile = {};
  }
};

const run = async () => {
  const mode = resolveDatabaseMode();
  process.env.DATABASE = mode;

  let touchedUsers = 0;
  let touchedFields = 0;

  const usersBefore = await usersRepo.getAll();

  await usersRepo.updateAll((users) => {
    users.forEach((user) => {
      let userChanged = false;

      ensureProfileObject(user);

      const maybeSet = (target, key) => {
        if (!needsDefaultAvatar(target[key])) {
          return;
        }
        target[key] = DEFAULT_AVATAR;
        touchedFields += 1;
        userChanged = true;
      };

      maybeSet(user.profile, 'profilePicture');
      maybeSet(user.profile, 'avatar');
      maybeSet(user, 'profilePicture');
      maybeSet(user, 'avatar');

      if (userChanged) {
        touchedUsers += 1;
      }
    });

    return users;
  });

  console.log(`Database mode: ${mode}`);
  console.log(`Users scanned: ${usersBefore.length}`);
  console.log(`Users updated: ${touchedUsers}`);
  console.log(`Avatar fields updated: ${touchedFields}`);

  if (mode === 'mongo' || mode === 'mongodb') {
    const { closeMongo } = await import('../services/mongoDb.js');
    await closeMongo();
  }
};

run().catch(async (error) => {
  console.error('Default avatar migration failed:', error);

  const mode = resolveDatabaseMode();
  if (mode === 'mongo' || mode === 'mongodb') {
    try {
      const { closeMongo } = await import('../services/mongoDb.js');
      await closeMongo();
    } catch (_closeError) {
      // Ignore close errors in failure path.
    }
  }

  process.exit(1);
});
