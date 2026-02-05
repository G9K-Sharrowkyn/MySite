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
      const keyFor = (c) => {
        const name = typeof c?.name === 'string' ? c.name.trim().toLowerCase() : '';
        if (name) return `name:${name}`;
        const id = typeof c?.id === 'string' ? c.id : '';
        if (id) return `id:${id}`;
        return `idx:${Math.random().toString(16).slice(2)}`;
      };

      for (const c of staticCharacters) {
        byName.set(keyFor(c), c);
      }
      for (const c of dbCharacters) {
        byName.set(keyFor(c), c); // DB overrides static if same name.
      }

      characters = Array.from(byName.values());
    }

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
    const { name, universe, image, powerTier, category } = req.body;

    if (!name || !image) {
      return res.status(400).json({ msg: 'Name and image are required' });
    }

    let created;

    const newCharacter = {
      id: uuidv4(),
      name,
      universe: universe || 'Other',
      image,
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
    const { available, status } = req.body;
    let updated;

    updated = await charactersRepo.updateById(id, (character) => {
      if (!character) {
        return character;
      }

      if (available !== undefined) {
        character.status = available ? 'active' : 'inactive';
      }

      if (status !== undefined) {
        character.status = status;
      }

      return character;
    });

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
