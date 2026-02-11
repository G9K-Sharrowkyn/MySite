import dotenv from 'dotenv';
import { charactersRepo } from '../repositories/index.js';
import { updateCollection } from '../services/jsonDb.js';
import { closeMongo } from '../services/mongoDb.js';
import {
  buildCharacterMediaPath,
  ingestCharacterMediaFromSource
} from '../services/characterMedia.js';

dotenv.config();

const normalize = (value) => String(value || '').trim();

const isApiMediaPath = (value) =>
  normalize(value).toLowerCase().startsWith('/api/media/characters/');

const run = async () => {
  const frontendOrigin = process.env.FRONTEND_URL || 'https://versusversevault.com';
  const apiOrigin = process.env.API_ORIGIN || frontendOrigin;
  const characters = await charactersRepo.getAll();
  const list = Array.isArray(characters) ? characters : [];

  let processed = 0;
  let migrated = 0;
  let unchanged = 0;
  let failed = 0;
  const updatesById = new Map();

  for (const character of list) {
    const id = normalize(character?.id);
    const sourceImage = normalize(character?.image || character?.images?.primary);
    if (!id) {
      failed += 1;
      continue;
    }
    if (!sourceImage) {
      failed += 1;
      continue;
    }

    processed += 1;

    if (isApiMediaPath(sourceImage)) {
      unchanged += 1;
      continue;
    }

    const ingested = await ingestCharacterMediaFromSource({
      characterId: id,
      image: sourceImage,
      frontendOrigin,
      apiOrigin
    }).catch((error) => ({
      ok: false,
      reason: error?.message || 'ingest_failed'
    }));

    if (!ingested?.ok) {
      failed += 1;
      console.warn(
        `Failed to migrate image for ${id} (${normalize(character?.name)}): ${ingested?.reason || 'unknown_error'}`
      );
      continue;
    }

    const mediaPath = buildCharacterMediaPath(id);
    updatesById.set(id, mediaPath);
    migrated += 1;
  }

  if (updatesById.size > 0) {
    await updateCollection('characters', (items) =>
      (Array.isArray(items) ? items : []).map((item) => {
        const id = normalize(item?.id);
        const mediaPath = updatesById.get(id);
        if (!mediaPath) return item;
        const next = { ...(item || {}) };
        next.image = mediaPath;
        next.images = next.images && typeof next.images === 'object' ? { ...next.images } : {};
        next.images.primary = mediaPath;
        next.images.thumbnail = mediaPath;
        next.updatedAt = new Date().toISOString();
        return next;
      })
    );
  }

  console.log(
    `Character image migration complete. processed=${processed} migrated=${migrated} unchanged=${unchanged} failed=${failed}`
  );
};

run()
  .catch(async (error) => {
    console.error('Character image migration failed:', error);
    try {
      await closeMongo();
    } finally {
      process.exit(1);
    }
  })
  .finally(async () => {
    await closeMongo();
  });
