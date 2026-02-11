import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { charactersRepo } from '../repositories/index.js';
import { updateCollection } from '../services/jsonDb.js';
import { closeMongo } from '../services/mongoDb.js';
import {
  buildCharacterMediaPath,
  ingestCharacterMediaFromSource,
  upsertCharacterMedia
} from '../services/characterMedia.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.production') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.production') });
dotenv.config();

const normalize = (value) => String(value || '').trim();
const PLACEHOLDER_FILE = path.resolve(__dirname, '..', '..', 'public', 'placeholder-character.png');
const INLINE_PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zx5QAAAAASUVORK5CYII=';

const isApiMediaPath = (value) =>
  normalize(value).toLowerCase().startsWith('/api/media/characters/');

const loadPlaceholderBuffer = async () => {
  try {
    const fileBuffer = await fs.readFile(PLACEHOLDER_FILE);
    if (Buffer.isBuffer(fileBuffer) && fileBuffer.length > 0) {
      return { buffer: fileBuffer, source: `file:${PLACEHOLDER_FILE}` };
    }
  } catch (_error) {
    // Fall back to embedded placeholder for environments where frontend assets
    // are not present (e.g. backend-only deployment on VPS).
  }

  return {
    buffer: Buffer.from(INLINE_PLACEHOLDER_PNG_BASE64, 'base64'),
    source: 'inline:1x1-png'
  };
};

const run = async () => {
  const frontendOrigin = process.env.FRONTEND_URL || 'https://versusversevault.com';
  const apiOrigin = process.env.API_ORIGIN || frontendOrigin;
  const characters = await charactersRepo.getAll();
  const list = Array.isArray(characters) ? characters : [];

  let processed = 0;
  let migrated = 0;
  let unchanged = 0;
  let failed = 0;
  let placeholderApplied = 0;
  const updatesById = new Map();
  const { buffer: placeholderBuffer, source: placeholderSource } =
    await loadPlaceholderBuffer();

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
      try {
        await upsertCharacterMedia({
          characterId: id,
          buffer: placeholderBuffer,
          contentType: 'image/png',
          source: placeholderSource
        });
        updatesById.set(id, buildCharacterMediaPath(id));
        placeholderApplied += 1;
      } catch (placeholderError) {
        failed += 1;
        console.warn(
          `Failed to migrate image for ${id} (${normalize(character?.name)}): ${ingested?.reason || 'unknown_error'}; placeholder_error=${placeholderError?.message || 'unknown'}`
        );
      }
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

  const afterCharacters = await charactersRepo.getAll();
  const remainingStatic = (Array.isArray(afterCharacters) ? afterCharacters : []).filter(
    (entry) => normalize(entry?.image).startsWith('/characters/')
  );

  console.log(
    `Character image migration complete. processed=${processed} migrated=${migrated} placeholderApplied=${placeholderApplied} unchanged=${unchanged} failed=${failed}`
  );

  if (failed > 0 || remainingStatic.length > 0) {
    throw new Error(
      `Mongo media migration is incomplete. failed=${failed}, remainingStatic=${remainingStatic.length}`
    );
  }
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
