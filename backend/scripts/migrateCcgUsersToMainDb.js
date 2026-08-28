import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readDb, updateDb } from '../services/jsonDb.js';
import { normalizeCcgProfile } from '../ccg/services/profileService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, '..', 'ccg', 'data', 'users.json');
const apply = process.argv.includes('--apply');

const resolveId = (user) => user?.id || user?._id || null;
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const toLegacyProfile = (legacy) =>
  normalizeCcgProfile({
    points: legacy.points,
    collection: legacy.collection,
    packs: legacy.packs,
    currency: legacy.currency,
    decks: legacy.decks,
    activeDeck: legacy.activeDeck,
    xp: legacy.xp,
    stats: legacy.stats,
    achievements: legacy.achievements,
    rank: legacy.rank,
    cardFragments: legacy.cardFragments
  });

const raw = await fs.readFile(sourcePath, 'utf8');
const legacyUsers = JSON.parse(raw);
if (!Array.isArray(legacyUsers)) {
  throw new Error('Legacy CCG users file is not an array');
}

const summary = { legacy: legacyUsers.length, matched: 0, migrated: 0, skipped: 0 };

const migrateProfiles = (db) => {
  for (const mainUser of db.users || []) {
    const mainId = resolveId(mainUser);
    const mainEmail = normalizeEmail(mainUser.email);
    const legacy = legacyUsers.find(
      (entry) =>
        (mainId && resolveId(entry) === mainId) ||
        (mainEmail && normalizeEmail(entry.email) === mainEmail)
    );
    if (!legacy) continue;

    summary.matched += 1;
    if (mainUser.ccg && Object.keys(mainUser.ccg).length > 0) {
      summary.skipped += 1;
      continue;
    }
    if (apply) {
      mainUser.ccg = toLegacyProfile(legacy);
      summary.migrated += 1;
    }
  }
};

if (apply) {
  await updateDb(migrateProfiles);
} else {
  migrateProfiles(await readDb());
}

if (!apply) {
  console.log(
    `Dry run: ${summary.matched}/${summary.legacy} legacy profiles match a main account. Run with --apply to migrate them.`
  );
} else {
  console.log(
    `Migrated ${summary.migrated} CCG profiles; skipped ${summary.skipped} profiles already present.`
  );
}
