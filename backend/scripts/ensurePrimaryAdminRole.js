import { usersRepo, withDb } from '../repositories/index.js';
import {
  ensurePrimaryAdminRole as enforceAdminRole,
  normalizeEmail
} from '../utils/primaryAdmin.js';

const targetEmail = normalizeEmail(
  process.env.PRIMARY_ADMIN_EMAIL || 'ak4maaru@gmail.com'
);

const run = async () => {
  if (!targetEmail) {
    console.log('PRIMARY_ADMIN_EMAIL missing, skipping admin role sync.');
    return;
  }

  let updated = 0;
  let found = 0;

  await withDb(async (db) => {
    await usersRepo.updateAll((users) => {
      for (const user of users) {
        if (normalizeEmail(user.email) !== targetEmail) continue;
        found += 1;
        if (enforceAdminRole(user)) {
          updated += 1;
        }
      }
      return users;
    }, { db });
    return db;
  });

  if (found === 0) {
    console.log(`Primary admin account not found yet: ${targetEmail}`);
    return;
  }

  console.log(`Primary admin role sync complete. target=${targetEmail} found=${found} updated=${updated}`);
};

run().catch((error) => {
  console.error('Failed to sync primary admin role:', error);
  process.exitCode = 1;
});
