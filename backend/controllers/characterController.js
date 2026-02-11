import { v4 as uuidv4 } from 'uuid';
import {
  charactersRepo,
  characterSuggestionsRepo
} from '../repositories/index.js';
import {
  buildCharacterMediaPath,
  ingestCharacterMediaFromSource
} from '../services/characterMedia.js';

const resolveCharacterImage = (character) =>
  String(
    character?.image ||
      character?.images?.primary ||
      character?.images?.thumbnail ||
      ''
  ).trim();

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

const getMongoCharacters = async () => {
  const dbCharactersRaw = await charactersRepo.getAll();
  const dbCharacters = Array.isArray(dbCharactersRaw) ? dbCharactersRaw : [];
  return dbCharacters.filter(
    (character) => String(character?.status || 'active').toLowerCase() !== 'deleted'
  );
};

// @desc    Get all characters
// @route   GET /api/characters
// @access  Public
export const getCharacters = async (req, res) => {
  try {
    const characters = await getMongoCharacters();

    // Avoid stale list right after moderation/admin edits.
    if (req.header('x-auth-token')) {
      res.set('Cache-Control', 'no-store');
    } else {
      res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    }
    res.json(characters);
  } catch (error) {
    console.error('Error fetching characters:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

// @desc    Search characters by name/universe (for global header search)
// @route   GET /api/characters/search?q=...
// @access  Public
export const searchCharacters = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q.length < 2) {
      return res.json([]);
    }

    const limitRaw = Number(req.query.limit || 12);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(30, limitRaw)) : 12;

    const characters = await getMongoCharacters();
    const results = characters
      .filter((character) => {
        const name = String(character?.name || '').toLowerCase();
        const baseName = String(character?.baseName || '').toLowerCase();
        const universe = String(character?.universe || '').toLowerCase();
        return (
          name.includes(q) ||
          (baseName && baseName.includes(q)) ||
          (universe && universe.includes(q))
        );
      })
      .slice(0, limit)
      .map((character) => ({
        id: String(character?.id || '').trim() || null,
        name: String(character?.name || '').trim(),
        universe: String(character?.universe || 'Other').trim(),
        image: resolveCharacterImage(character)
      }))
      .filter((entry) => entry.name);

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json(results);
  } catch (error) {
    console.error('Error searching characters:', error);
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
    const resolvedId = String(id || '').trim() || uuidv4();

    const ingested = await ingestCharacterMediaFromSource({
      characterId: resolvedId,
      image,
      frontendOrigin: process.env.FRONTEND_URL,
      apiOrigin: process.env.API_ORIGIN || process.env.FRONTEND_URL
    }).catch((error) => ({
      ok: false,
      reason: error?.message || 'ingest_failed'
    }));

    if (!ingested?.ok) {
      return res.status(400).json({
        msg: `Character image could not be imported to Mongo media (${ingested?.reason || 'unknown_error'}).`
      });
    }

    const newCharacter = {
      id: resolvedId,
      name: String(name || '').trim(),
      baseName: resolvedBaseName,
      tags: normalizedTags,
      universe: universe || 'Other',
      image: buildCharacterMediaPath(resolvedId),
      images: {
        primary: buildCharacterMediaPath(resolvedId),
        gallery: [],
        thumbnail: buildCharacterMediaPath(resolvedId)
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

    const hasTagsField = Object.prototype.hasOwnProperty.call(req.body || {}, 'tags');
    const hasBaseNameField = Object.prototype.hasOwnProperty.call(req.body || {}, 'baseName');
    const normalizedTags = normalizeTags(tags);
    const resolvedName = typeof name === 'string' ? name.trim() : '';
    const resolvedBaseName =
      typeof baseName === 'string' && baseName.trim()
        ? baseName.trim()
        : (resolvedName ? deriveBaseName(resolvedName) : '');

    const existing = await charactersRepo.findById(id);
    let nextImagePath =
      typeof image === 'string' && image.trim()
        ? image.trim()
        : String(existing?.image || '').trim();

    if (typeof image === 'string' && image.trim()) {
      const ingested = await ingestCharacterMediaFromSource({
        characterId: id,
        image,
        frontendOrigin: process.env.FRONTEND_URL,
        apiOrigin: process.env.API_ORIGIN || process.env.FRONTEND_URL
      }).catch((error) => ({
        ok: false,
        reason: error?.message || 'ingest_failed'
      }));

      if (!ingested?.ok) {
        return res.status(400).json({
          msg: `Character image could not be imported to Mongo media (${ingested?.reason || 'unknown_error'}).`
        });
      }
      nextImagePath = buildCharacterMediaPath(id);
    }

    if (!existing) {
      if (!nextImagePath) {
        return res.status(400).json({ msg: 'Image is required for new character.' });
      }
      // Upsert: allow creating a character if a specific ID does not exist yet.
      const created = {
        id,
        name: resolvedName || id,
        baseName: resolvedBaseName || deriveBaseName(resolvedName || id),
        tags: normalizedTags,
        universe: typeof universe === 'string' && universe.trim() ? universe.trim() : 'Other',
        image: nextImagePath,
        images: {
          primary: nextImagePath,
          gallery: [],
          thumbnail: nextImagePath
        },
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

      if (nextImagePath) {
        character.image = nextImagePath;
        character.images = character.images || {};
        character.images.primary = character.image;
        character.images.thumbnail = character.image;
      }

      if (hasTagsField) {
        character.tags = normalizedTags;
      }

      if (hasBaseNameField && resolvedBaseName) {
        character.baseName = resolvedBaseName;
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
    const target = dbCharacters.find((entry) => String(entry?.id || '') === String(id));
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

    await charactersRepo.removeById(String(id));

    return res.json({ msg: `Character "${expectedName}" deleted successfully.` });
  } catch (error) {
    console.error('Error deleting character:', error);
    return res.status(500).json({ msg: 'Server error' });
  }
};
