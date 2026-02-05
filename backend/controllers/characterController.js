import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  charactersRepo,
  characterSuggestionsRepo
} from '../repositories/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATIC_CHARACTERS_PATH = path.join(__dirname, '..', 'scripts', 'characters.json');

let staticCharactersCache = null;
const loadStaticCharacters = async () => {
  if (Array.isArray(staticCharactersCache)) {
    return staticCharactersCache;
  }
  const raw = await fs.readFile(STATIC_CHARACTERS_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  staticCharactersCache = Array.isArray(parsed) ? parsed : [];
  return staticCharactersCache;
};

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t || '').trim()).filter(Boolean).slice(0, 30);
  }
  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 30);
  }
  return [];
};

const deriveBaseName = (name) => {
  const safe = String(name || '').trim();
  if (!safe) return '';
  const index = safe.indexOf('(');
  return (index > 0 ? safe.slice(0, index) : safe).trim();
};

const normalizeCharacterKey = (character) => {
  const name = typeof character?.name === 'string' ? character.name.trim().toLowerCase() : '';
  if (name) return `name:${name}`;
  const id = typeof character?.id === 'string' ? character.id : '';
  if (id) return `id:${id}`;
  return `idx:${Math.random().toString(16).slice(2)}`;
};

// @desc    Get all characters
// @route   GET /api/characters
// @access  Public
export const getCharacters = async (_req, res) => {
  try {
    const dbCharactersRaw = await charactersRepo.getAll();
    const dbCharacters = Array.isArray(dbCharactersRaw) ? dbCharactersRaw : [];

    // Always keep the large static catalog available, even if the DB contains only
    // moderator-approved additions. Otherwise a single approved suggestion would
    // hide the whole catalog in production.
    const staticCharacters = await loadStaticCharacters();

    let characters = staticCharacters;

    if (dbCharacters.length > 0) {
      const byName = new Map();

      for (const c of staticCharacters) {
        byName.set(normalizeCharacterKey(c), c);
      }
      for (const c of dbCharacters) {
        byName.set(normalizeCharacterKey(c), c); // DB overrides static if same name.
      }

      characters = Array.from(byName.values());
    }

    // Hide hard-deleted entries represented by DB tombstones.
    characters = characters.filter(
      (character) => String(character?.status || 'active').toLowerCase() !== 'deleted'
    );

    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.json(characters);
  } catch (error) {
    console.error('Error fetching characters:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Add a new character (Moderator only)
// @route   POST /api/characters
// @access  Private (Moderator)
export const addCharacter = async (req, res) => {
  try {
    const { id, name, universe, image, tags, baseName, powerTier, category } = req.body;

    if (!name || !image) {
      return res.status(400).json({ msg: 'Name and image are required' });
    }

    let created;
    const normalizedTags = normalizeTags(tags);
    const resolvedBaseName = String(baseName || '').trim() || deriveBaseName(name);

    const newCharacter = {
      id: String(id || '').trim() || uuidv4(),
      name: String(name || '').trim(),
      baseName: resolvedBaseName,
      tags: normalizedTags,
      universe: universe || 'Other',
      image: String(image || '').trim(),
      images: {
        primary: image,
        gallery: [],
        thumbnail: image
      },
      powerTier: powerTier || 'Metahuman',
      category: category || 'Other',
      addedBy: req.user?.id || null,
      status: 'active',
      moderation: {
        approved: true,
        approvedBy: req.user?.id || null,
        approvedAt: new Date().toISOString()
      }
    };

    created = await charactersRepo.insert(newCharacter);

    res.status(201).json(created);
  } catch (error) {
    console.error('Error adding character:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Update character availability (Moderator only)
// @route   PUT /api/characters/:id
// @access  Private (Moderator)
export const updateCharacter = async (req, res) => {
  try {
    const { id } = req.params;
    const { available, status, name, universe, image, tags, baseName } = req.body;
    let updated;

    const normalizedTags = normalizeTags(tags);
    const resolvedName = typeof name === 'string' ? name.trim() : '';
    const resolvedBaseName =
      typeof baseName === 'string' && baseName.trim()
        ? baseName.trim()
        : (resolvedName ? deriveBaseName(resolvedName) : '');

    const existing = await charactersRepo.findById(id);

    if (!existing) {
      // Upsert: allow overriding static catalog entries by writing an entry into DB.
      const created = {
        id,
        name: resolvedName || id,
        baseName: resolvedBaseName || deriveBaseName(resolvedName || id),
        tags: normalizedTags,
        universe: typeof universe === 'string' && universe.trim() ? universe.trim() : 'Other',
        image: typeof image === 'string' && image.trim() ? image.trim() : '/logo512.png',
        createdAt: new Date().toISOString(),
        addedBy: req.user?.id || null,
        status: 'active'
      };
      if (available !== undefined) {
        created.status = available ? 'active' : 'inactive';
      }
      if (status !== undefined) {
        created.status = status;
      }
      updated = await charactersRepo.insert(created);
    } else {
      updated = await charactersRepo.updateById(id, (character) => {
      if (available !== undefined) {
        character.status = available ? 'active' : 'inactive';
      }

      if (status !== undefined) {
        character.status = status;
      }

      if (resolvedName) {
        character.name = resolvedName;
        character.baseName = resolvedBaseName || character.baseName || deriveBaseName(resolvedName);
      }

      if (typeof universe === 'string' && universe.trim()) {
        character.universe = universe.trim();
      }

      if (typeof image === 'string' && image.trim()) {
        character.image = image.trim();
        character.images = character.images || {};
        character.images.primary = character.image;
        character.images.thumbnail = character.image;
      }

      if (normalizedTags.length) {
        character.tags = normalizedTags;
      }

      character.updatedAt = new Date().toISOString();
      return character;
      });
    }

    if (!updated) {
      const error = new Error('Character not found');
      error.code = 'CHARACTER_NOT_FOUND';
      throw error;
    }

    res.json(updated);
  } catch (error) {
    if (error.code === 'CHARACTER_NOT_FOUND') {
      return res.status(404).json({ msg: 'Character not found' });
    }
    console.error('Error updating character:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Suggest a new character (User suggestion)
// @route   POST /api/characters/suggest
// @access  Private
export const suggestCharacter = async (req, res) => {
  try {
    const { name, photo, universe, powerTier } = req.body;

    await characterSuggestionsRepo.insert({
      id: uuidv4(),
      name,
      photo,
      universe,
      powerTier,
      suggestedBy: req.user?.id || null,
      createdAt: new Date().toISOString()
    });

    res.status(200).json({ msg: 'Character suggestion saved' });
  } catch (error) {
    console.error('Error saving character suggestion:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Delete a character (admin only, with explicit confirmation)
// @route   DELETE /api/characters/:id
// @access  Private (Admin)
export const deleteCharacter = async (req, res) => {
  try {
    const { id } = req.params;
    const confirmPhrase = String(req.body?.confirmPhrase || '').trim().toUpperCase();
    const confirmName = String(req.body?.confirmName || '').trim();

    if (confirmPhrase !== 'DELETE') {
      return res.status(400).json({ msg: 'Double confirmation phrase is required.' });
    }

    const dbCharacters = await charactersRepo.getAll();
    const staticCharacters = await loadStaticCharacters();
    const dbEntry = dbCharacters.find((entry) => String(entry?.id || '') === String(id));
    const staticEntry = staticCharacters.find((entry) => String(entry?.id || '') === String(id));

    const target = dbEntry || staticEntry;
    if (!target) {
      return res.status(404).json({ msg: 'Character not found.' });
    }

    const expectedName = String(target.name || '').trim();
    if (!expectedName) {
      return res.status(400).json({ msg: 'Character has invalid name.' });
    }

    if (confirmName.toLowerCase() !== expectedName.toLowerCase()) {
      return res.status(400).json({ msg: 'Character name confirmation does not match.' });
    }

    if (dbEntry) {
      await charactersRepo.removeById(String(dbEntry.id));
    }

    // If this character exists in static catalog, write a tombstone override in DB
    // so merged output will keep it hidden.
    if (staticEntry) {
      const tombstone = {
        id: `deleted:${uuidv4()}`,
        name: expectedName,
        baseName: deriveBaseName(expectedName),
        universe: staticEntry.universe || 'Other',
        tags: normalizeTags(staticEntry.tags),
        image: staticEntry.image || '/logo512.png',
        status: 'deleted',
        deletedAt: new Date().toISOString(),
        deletedBy: req.user?.id || null
      };
      await charactersRepo.insert(tombstone);
    }

    return res.json({ msg: `Character "${expectedName}" deleted successfully.` });
  } catch (error) {
    console.error('Error deleting character:', error);
    return res.status(500).json({ msg: 'Server error' });
  }
};
