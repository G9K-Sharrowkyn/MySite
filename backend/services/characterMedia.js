import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMongoDb } from './mongoDb.js';
import {
  MAX_STORED_IMAGE_BYTES,
  decodeSafeDataImage,
  imageBufferMatchesMime,
  fetchPublicImageBuffer,
  fetchTrustedImageBuffer,
  sanitizeImageForStorage
} from '../utils/imageSecurity.js';
import { getUploadDirectory } from '../utils/uploadFiles.js';

const COLLECTION = 'characterMedia';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LOCAL_PUBLIC_CHARACTERS_DIR = path.join(REPO_ROOT, 'public', 'characters');
const LOCAL_UPLOADED_CHARACTERS_DIR = getUploadDirectory('characters');

const sanitizeCharacterId = (value) => String(value || '').trim();

const normalizeBaseUrl = (value) => String(value || '').replace(/\/$/, '');

const normalizeImageSource = (value) => String(value || '').trim();

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

const tryReadFileWithin = async (baseDirectory, relativePath, sourceLabel) => {
  if (
    !relativePath ||
    relativePath.includes('\0') ||
    relativePath.includes('\\') ||
    relativePath.split('/').includes('..')
  ) {
    return null;
  }
  const absolutePath = path.resolve(baseDirectory, relativePath);
  const safeBase = `${path.resolve(baseDirectory)}${path.sep}`;
  if (!absolutePath.startsWith(safeBase)) return null;

  const data = await fs.readFile(absolutePath).catch(() => null);
  if (!data || !Buffer.isBuffer(data) || data.length === 0) return null;
  return {
    buffer: data,
    source: `${sourceLabel}:${absolutePath}`
  };
};

const tryReadLocalCharacterFile = async (rawImagePath) => {
  const source = normalizeImageSource(rawImagePath);
  if (source.startsWith('/characters/')) {
    return tryReadFileWithin(
      LOCAL_PUBLIC_CHARACTERS_DIR,
      source.slice('/characters/'.length),
      'file'
    );
  }
  if (source.startsWith('/uploads/characters/')) {
    return tryReadFileWithin(
      LOCAL_UPLOADED_CHARACTERS_DIR,
      source.slice('/uploads/characters/'.length),
      'upload'
    );
  }
  return null;
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

export const getCharacterMediaById = async (
  characterId,
  { allowLegacy = false } = {}
) => {
  const id = sanitizeCharacterId(characterId);
  if (!id) return null;
  const collection = await getCollection();
  const doc = await collection.findOne({ characterId: id });
  if (!doc) return null;
  const contentType = String(doc.contentType || 'application/octet-stream');
  const data = Buffer.isBuffer(doc.data)
    ? doc.data
    : Buffer.from(doc.data?.buffer || []);
  const sanitizedVersion = Number(doc.sanitizedVersion || 0);
  if (
    !allowLegacy &&
    (
      sanitizedVersion !== 1 ||
      contentType !== 'image/webp' ||
      data.length === 0 ||
      data.length > MAX_STORED_IMAGE_BYTES ||
      !imageBufferMatchesMime(data, contentType)
    )
  ) {
    return null;
  }

  return {
    characterId: id,
    contentType,
    data,
    etag: String(doc.etag || ''),
    updatedAt: doc.updatedAt || null,
    bytes: Number(doc.bytes || 0),
    source: String(doc.source || ''),
    sanitizedVersion
  };
};

export const deleteCharacterMediaById = async (characterId) => {
  const id = sanitizeCharacterId(characterId);
  if (!id) return false;
  const collection = await getCollection();
  const result = await collection.deleteOne({ characterId: id });
  return result.deletedCount === 1;
};

export const upsertCharacterMedia = async ({
  characterId,
  buffer,
  source
}) => {
  const id = sanitizeCharacterId(characterId);
  if (!id) throw new Error('characterId is required');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('buffer is required');
  }
  const sanitized = await sanitizeImageForStorage(buffer);
  if (!sanitized) {
    throw new Error('Character media must be a valid bounded PNG, JPEG, WebP, or GIF image');
  }
  const safeType = sanitized.mime;
  const safeBuffer = sanitized.buffer;
  const etag = crypto.createHash('sha256').update(safeBuffer).digest('hex');

  const collection = await getCollection();
  await collection.updateOne(
    { characterId: id },
    {
      $set: {
        characterId: id,
        contentType: safeType,
        data: safeBuffer,
        bytes: safeBuffer.length,
        source: String(source || ''),
        sanitizedVersion: 1,
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
    bytes: safeBuffer.length
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
  const inlineImage = decodeSafeDataImage(normalizeImageSource(image));
  if (inlineImage) {
    const stored = await upsertCharacterMedia({
      characterId: id,
      buffer: inlineImage.buffer,
      source: 'inline:data-image'
    });
    return {
      ok: true,
      sourceUrl: 'inline:data-image',
      mediaPath: buildCharacterMediaPath(id),
      ...stored
    };
  }
  const localFile = await tryReadLocalCharacterFile(image);
  if (localFile) {
    const stored = await upsertCharacterMedia({
      characterId: id,
      buffer: localFile.buffer,
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

  const isExternalSource = /^https?:\/\//i.test(normalizeImageSource(image));
  const allowedOrigins = [frontendOrigin, apiOrigin].filter(Boolean);
  const downloaded = isExternalSource
    ? await fetchPublicImageBuffer(sourceUrl, { timeoutMs: 8000 })
    : await fetchTrustedImageBuffer(sourceUrl, {
        allowedOrigins,
        allowPrivateNetwork: process.env.NODE_ENV !== 'production',
        timeoutMs: 8000
      });
  if (!downloaded?.buffer?.length) {
    return { ok: false, reason: 'empty_image_payload', sourceUrl };
  }

  const stored = await upsertCharacterMedia({
    characterId: id,
    buffer: downloaded.buffer,
    contentType: downloaded.mime,
    source: sourceUrl
  });

  return {
    ok: true,
    sourceUrl,
    mediaPath: buildCharacterMediaPath(id),
    ...stored
  };
};
