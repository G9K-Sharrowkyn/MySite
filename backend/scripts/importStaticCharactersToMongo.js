import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMongoMode, updateCollection } from '../services/jsonDb.js';
import { closeMongo } from '../services/mongoDb.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_FILE = path.join(__dirname, 'characters.json');

const normalizeNameKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const normalizeId = (value) => String(value || '').trim();

const ensureString = (value, fallback = '') =>
  String(value ?? fallback).trim();

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => ensureString(entry))
      .filter(Boolean)
      .slice(0, 30);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 30);
  }
  return [];
};

const deriveBaseName = (name) => {
  const safe = ensureString(name);
  if (!safe) return '';
  const index = safe.indexOf('(');
  return (index > 0 ? safe.slice(0, index) : safe).trim();
};

const normalizeSeedCharacter = (input) => {
  const id = normalizeId(input?.id);
  const name = ensureString(input?.name);
  if (!id || !name) return null;
  const image = ensureString(input?.image);
  return {
    id,
    name,
    baseName: ensureString(input?.baseName) || deriveBaseName(name),
    tags: normalizeTags(input?.tags),
    universe: ensureString(input?.universe, 'Other') || 'Other',
    image: image || '/logo512.png'
  };
};

const run = async () => {
  if (!isMongoMode()) {
    throw new Error(
      'Refusing to run: database mode is not MongoDB. Set MONGO_URI in environment first.'
    );
  }

  const raw = await fs.readFile(SEED_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid characters.json format: expected an array.');
  }

  let inserted = 0;
  let patched = 0;
  let unchanged = 0;
  let skipped = 0;
  const startedAt = new Date().toISOString();

  await updateCollection('characters', (items) => {
    const list = Array.isArray(items) ? [...items] : [];
    const idToIndex = new Map();
    const nameToIndex = new Map();

    list.forEach((entry, index) => {
      const idKey = normalizeId(entry?.id);
      if (idKey) idToIndex.set(idKey, index);
      const isDeleted = String(entry?.status || '').toLowerCase() === 'deleted';
      const nameKey = normalizeNameKey(entry?.name);
      if (nameKey && !isDeleted && !nameToIndex.has(nameKey)) {
        nameToIndex.set(nameKey, index);
      }
    });

    for (const rawCharacter of parsed) {
      const normalized = normalizeSeedCharacter(rawCharacter);
      if (!normalized) {
        skipped += 1;
        continue;
      }

      const idKey = normalizeId(normalized.id);
      const nameKey = normalizeNameKey(normalized.name);
      let index = idToIndex.get(idKey);
      if (index === undefined && nameKey) {
        index = nameToIndex.get(nameKey);
      }

      if (index === undefined) {
        const next = {
          ...normalized,
          status: 'active',
          createdAt: startedAt
        };
        list.push(next);
        const newIndex = list.length - 1;
        idToIndex.set(idKey, newIndex);
        if (nameKey) nameToIndex.set(nameKey, newIndex);
        inserted += 1;
        continue;
      }

      const current = list[index] && typeof list[index] === 'object' ? { ...list[index] } : {};
      let changed = false;

      if (!normalizeId(current.id)) {
        current.id = normalized.id;
        changed = true;
      }
      if (!ensureString(current.name)) {
        current.name = normalized.name;
        changed = true;
      }
      if (!ensureString(current.baseName) && normalized.baseName) {
        current.baseName = normalized.baseName;
        changed = true;
      }
      if ((!Array.isArray(current.tags) || current.tags.length === 0) && normalized.tags.length) {
        current.tags = normalized.tags;
        changed = true;
      }
      if (!ensureString(current.universe) || ensureString(current.universe) === 'Other') {
        current.universe = normalized.universe;
        changed = true;
      }
      if (!ensureString(current.image) || ensureString(current.image) === '/logo512.png') {
        current.image = normalized.image;
        changed = true;
      }

      if (changed) {
        current.updatedAt = startedAt;
        list[index] = current;
        patched += 1;
      } else {
        unchanged += 1;
      }
    }

    return list;
  });

  console.log(
    `Characters import done. inserted=${inserted} patched=${patched} unchanged=${unchanged} skipped=${skipped}`
  );
};

run()
  .catch(async (error) => {
    console.error('Characters import failed:', error);
    try {
      await closeMongo();
    } finally {
      process.exit(1);
    }
  })
  .finally(async () => {
    await closeMongo();
  });
