import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import { getMongoDb } from './mongoDb.js';

const COLLECTION = 'characterMedia';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LOCAL_PUBLIC_CHARACTERS_DIR = path.join(REPO_ROOT, 'public', 'characters');

const sanitizeCharacterId = (value) => String(value || '').trim();

const normalizeBaseUrl = (value) => String(value || '').replace(/\/$/, '');

const normalizeImageSource = (value) => String(value || '').trim();

const guessContentType = (sourceUrl, headerType) => {
  const normalizedHeader = String(headerType || '').toLowerCase();
  if (normalizedHeader.startsWith('image/')) return normalizedHeader.split(';')[0].trim();
  const lower = String(sourceUrl || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
};

const resolveSourceUrl = (rawImage, options = {}) => {
  const value = normalizeImageSource(rawImage);
  if (!value) return '';
  if (/^data:/i.test(value)) return '';
  if (/^https?:\/\//i.test(value)) return value;

  const frontendOrigin = normalizeBaseUrl(options.frontendOrigin || process.env.FRONTEND_URL || '');
  const apiOrigin = normalizeBaseUrl(options.apiOrigin || process.env.API_ORIGIN || frontendOrigin);
  const withSlash = value.startsWith('/') ? value : `/${value}`;

  if (withSlash.startsWith('/api/')) {
    return apiOrigin ? `${apiOrigin}${withSlash}` : withSlash;
  }
  return frontendOrigin ? `${frontendOrigin}${withSlash}` : withSlash;
};

const tryReadLocalCharacterFile = async (rawImagePath) => {
  const source = normalizeImageSource(rawImagePath);
  if (!source.startsWith('/characters/')) return null;
  const relative = source.replace(/^\/characters\//, '');
  if (!relative || relative.includes('..')) return null;
  const absolutePath = path.join(LOCAL_PUBLIC_CHARACTERS_DIR, relative);
  const data = await fs.readFile(absolutePath).catch(() => null);
  if (!data || !Buffer.isBuffer(data) || data.length === 0) {
    return null;
  }
  return {
    buffer: data,
    contentType: guessContentType(source, ''),
    source: `file:${absolutePath}`
  };
};

const ensureIndexes = async (collection) => {
  await collection.createIndex({ characterId: 1 }, { unique: true, background: true });
  await collection.createIndex({ updatedAt: -1 }, { background: true });
};

const getCollection = async () => {
  const db = await getMongoDb();
  const collection = db.collection(COLLECTION);
  await ensureIndexes(collection);
  return collection;
};

export const buildCharacterMediaPath = (characterId) =>
  `/api/media/characters/${encodeURIComponent(sanitizeCharacterId(characterId))}`;

export const getCharacterMediaById = async (characterId) => {
  const id = sanitizeCharacterId(characterId);
  if (!id) return null;
  const collection = await getCollection();
  const doc = await collection.findOne({ characterId: id });
  if (!doc) return null;
  return {
    characterId: id,
    contentType: String(doc.contentType || 'application/octet-stream'),
    data: Buffer.isBuffer(doc.data) ? doc.data : Buffer.from(doc.data?.buffer || []),
    etag: String(doc.etag || ''),
    updatedAt: doc.updatedAt || null,
    bytes: Number(doc.bytes || 0),
    source: String(doc.source || '')
  };
};

export const upsertCharacterMedia = async ({
  characterId,
  buffer,
  contentType,
  source
}) => {
  const id = sanitizeCharacterId(characterId);
  if (!id) throw new Error('characterId is required');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('buffer is required');
  }
  const safeType = guessContentType('', contentType);
  const etag = crypto.createHash('sha256').update(buffer).digest('hex');

  const collection = await getCollection();
  await collection.updateOne(
    { characterId: id },
    {
      $set: {
        characterId: id,
        contentType: safeType,
        data: buffer,
        bytes: buffer.length,
        source: String(source || ''),
        etag,
        updatedAt: new Date().toISOString()
      }
    },
    { upsert: true }
  );

  return {
    characterId: id,
    contentType: safeType,
    etag,
    bytes: buffer.length
  };
};

export const ingestCharacterMediaFromSource = async ({
  characterId,
  image,
  frontendOrigin,
  apiOrigin
}) => {
  const id = sanitizeCharacterId(characterId);
  if (!id) {
    return { ok: false, reason: 'missing_character_id' };
  }
  const localFile = await tryReadLocalCharacterFile(image);
  if (localFile) {
    const stored = await upsertCharacterMedia({
      characterId: id,
      buffer: localFile.buffer,
      contentType: localFile.contentType,
      source: localFile.source
    });
    return {
      ok: true,
      sourceUrl: localFile.source,
      mediaPath: buildCharacterMediaPath(id),
      ...stored
    };
  }

  const sourceUrl = resolveSourceUrl(image, { frontendOrigin, apiOrigin });
  if (!sourceUrl) {
    return { ok: false, reason: 'missing_or_unsupported_image_source' };
  }

  const response = await axios.get(sourceUrl, {
    responseType: 'arraybuffer',
    timeout: 20000,
    validateStatus: (status) => status >= 200 && status < 300
  });
  const buffer = Buffer.from(response.data || []);
  if (!buffer.length) {
    return { ok: false, reason: 'empty_image_payload', sourceUrl };
  }

  const contentType = guessContentType(
    sourceUrl,
    response.headers?.['content-type'] || ''
  );
  const stored = await upsertCharacterMedia({
    characterId: id,
    buffer,
    contentType,
    source: sourceUrl
  });

  return {
    ok: true,
    sourceUrl,
    mediaPath: buildCharacterMediaPath(id),
    ...stored
  };
};
