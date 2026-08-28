import {
  charactersRepo,
  feedbackRepo,
  usersRepo,
  withDb
} from '../repositories/index.js';
import { v4 as uuidv4 } from 'uuid';
import { logModerationAction } from '../utils/moderationAudit.js';
import { decodeSafeDataImage } from '../utils/imageSecurity.js';
import {
  buildCharacterMediaPath,
  ingestCharacterMediaFromSource
} from '../services/characterMedia.js';

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .slice(0, 20);
};

const boundedText = (value, maxLength) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const normalizeSuggestionImage = (value) => {
  if (typeof value !== 'string') return '';
  return decodeSafeDataImage(value)?.source || '';
};

const deriveBaseName = (name) => {
  const safe = String(name || '').trim();
  if (!safe) return '';
  const index = safe.indexOf('(');
  return (index > 0 ? safe.slice(0, index) : safe).trim();
};

const guessUniverseFromTags = (tags) => {
  const haystack = normalizeTags(tags).join(' ').toLowerCase();
  const candidates = [
    ['star wars', 'Star Wars'],
    ['sw', 'Star Wars'],
    ['dragon ball', 'Dragon Ball'],
    ['db', 'Dragon Ball'],
    ['marvel', 'Marvel'],
    ['dc', 'DC']
  ];
  for (const [needle, label] of candidates) {
    if (haystack.includes(needle)) return label;
  }
  return 'Other';
};

export const submitFeedback = async (req, res) => {
  try {
    const type = boundedText(req.body?.type, 30).toLowerCase();
    const title = boundedText(req.body?.title, 100);
    const description = boundedText(req.body?.description, 1000);
    const reportedUser = boundedText(req.body?.reportedUser, 80);

    if (!type || !title || !description) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    const validTypes = ['bug', 'feature', 'user', 'character', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ msg: 'Invalid report type' });
    }

    if (type === 'user' && !reportedUser) {
      return res.status(400).json({ msg: 'Username is required for user reports' });
    }

    const characterName = boundedText(req.body?.characterName, 120);
    const characterTags = normalizeTags(req.body?.characterTags);
    const characterImage = normalizeSuggestionImage(req.body?.characterImage);
    if (
      type === 'character' &&
      (!characterName || characterTags.length === 0 || !characterImage)
    ) {
      return res.status(400).json({ msg: 'Character name and tags are required for character suggestions' });
    }

    const feedback = {
      id: uuidv4(),
      type,
      title,
      description,
      reportedUser: type === 'user' ? reportedUser : undefined,
      characterName: type === 'character' ? characterName : undefined,
      characterTags: type === 'character' ? characterTags : undefined,
      characterImage: type === 'character' ? characterImage : undefined,
      submittedBy: req.user?.username || 'Anonymous',
      submittedById: req.user?.id || null,
      status: 'pending', // pending, reviewed, resolved, dismissed, approved
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      adminNotes: null
    };

    await withDb(async (db) => {
      await feedbackRepo.insert(feedback, { db });

      // Send notification to all admins
      const admins = await usersRepo.filter((user) => user.role === 'admin', {
        db
      });
      const notificationText =
        type === 'user'
          ? `New user report: ${reportedUser}`
          : `New ${type} report: ${title}`;

      admins.forEach((admin) => {
        if (!admin.notifications) {
          admin.notifications = [];
        }
        admin.notifications.push({
          id: uuidv4(),
          type: 'feedback',
          text: notificationText,
          feedbackId: feedback.id,
          read: false,
          createdAt: new Date().toISOString()
        });
      });

      return db;
    });

    res.json({ 
      msg: 'Feedback submitted successfully',
      feedbackId: feedback.id 
    });
  } catch (err) {
    console.error('Error submitting feedback:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const getFeedback = async (req, res) => {
  try {
    // Only admins and moderators can view all feedback
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { status, type } = req.query;

    let feedback = await feedbackRepo.getAll();

    if (status && status !== 'all') {
      feedback = feedback.filter(f => f.status === status);
    }

    if (type && type !== 'all') {
      feedback = feedback.filter(f => f.type === type);
    }
    feedback = feedback.map((entry) =>
      entry?.type === 'character'
        ? {
            ...entry,
            characterImage: normalizeSuggestionImage(entry.characterImage)
          }
        : entry
    );

    // Sort by newest first
    feedback.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(feedback);
  } catch (err) {
    console.error('Error fetching feedback:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const updateFeedbackStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    let updatedFeedback = null;
    await withDb(async (db) => {
      const actorUser = await usersRepo.findOne(
        (entry) => (entry.id || entry._id) === req.user.id,
        { db }
      );
      updatedFeedback = await feedbackRepo.findById(id, { db });
      if (!updatedFeedback) {
        return db;
      }

      const previousStatus = updatedFeedback.status;
      updatedFeedback.status = status;
      updatedFeedback.adminNotes = adminNotes || updatedFeedback.adminNotes;

      if (status === 'resolved') {
        updatedFeedback.resolvedAt = new Date().toISOString();
      }

      await logModerationAction({
        db,
        actor: actorUser || req.user,
        action: 'feedback.status_update',
        targetType: 'feedback',
        targetId: id,
        details: {
          previousStatus,
          nextStatus: status,
          hasAdminNotes: Boolean(adminNotes)
        }
      });

      return db;
    });

    if (!updatedFeedback) {
      return res.status(404).json({ msg: 'Feedback not found' });
    }

    res.json({ msg: 'Feedback updated successfully', feedback: updatedFeedback });
  } catch (err) {
    console.error('Error updating feedback:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const deleteFeedback = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { id } = req.params;
    let deleted = false;
    await withDb(async (db) => {
      const actorUser = await usersRepo.findOne(
        (entry) => (entry.id || entry._id) === req.user.id,
        { db }
      );
      const existing = await feedbackRepo.findById(id, { db });
      if (!existing) {
        return db;
      }
      const removed = await feedbackRepo.removeById(id, { db });
      deleted = Boolean(removed);
      if (deleted) {
        await logModerationAction({
          db,
          actor: actorUser || req.user,
          action: 'feedback.delete',
          targetType: 'feedback',
          targetId: id,
          details: {
            feedbackType: existing.type || 'unknown',
            feedbackStatus: existing.status || 'unknown'
          }
        });
      }
      return db;
    });

    if (!deleted) {
      return res.status(404).json({ msg: 'Feedback not found' });
    }

    res.json({ msg: 'Feedback deleted successfully' });
  } catch (err) {
    console.error('Error deleting feedback:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const approveCharacterSuggestion = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { id } = req.params;
    const pendingFeedback = await feedbackRepo.findById(id);
    if (!pendingFeedback || pendingFeedback.type !== 'character') {
      return res.status(404).json({ msg: 'Character suggestion not found' });
    }
    if (pendingFeedback.status === 'approved') {
      return res.status(409).json({ msg: 'Character suggestion was already approved' });
    }
    const safeSuggestionImage = normalizeSuggestionImage(
      pendingFeedback.characterImage
    );
    if (!safeSuggestionImage) {
      return res.status(400).json({
        msg: 'The suggested character image is invalid and must be resubmitted'
      });
    }

    const characterId = uuidv4();
    const ingested = await ingestCharacterMediaFromSource({
      characterId,
      image: safeSuggestionImage,
      frontendOrigin: process.env.FRONTEND_URL,
      apiOrigin: process.env.API_ORIGIN || process.env.FRONTEND_URL
    }).catch((error) => ({
      ok: false,
      reason: error?.message || 'ingest_failed'
    }));
    if (!ingested?.ok) {
      return res.status(400).json({
        msg: `Character image could not be safely imported (${ingested?.reason || 'unknown_error'}).`
      });
    }

    let characterCreated = false;
    let newCharacter = null;

    await withDb(async (db) => {
      const actorUser = await usersRepo.findOne(
        (entry) => (entry.id || entry._id) === req.user.id,
        { db }
      );
      const actorName = actorUser?.username || req.user.username || 'moderator';
      const feedback = await feedbackRepo.findById(id, { db });

      if (
        !feedback ||
        feedback.type !== 'character' ||
        feedback.status === 'approved'
      ) {
        return db;
      }

      // Create new character
      const tags = normalizeTags(feedback.characterTags);
      const name = String(feedback.characterName || '').trim();
      const baseName = deriveBaseName(name);
      const universe = guessUniverseFromTags(tags);
      const image = buildCharacterMediaPath(characterId);

      const character = {
        id: characterId,
        name,
        baseName,
        tags,
        universe,
        image,
        createdAt: new Date().toISOString(),
        suggestedBy: feedback.submittedBy,
        approvedBy: actorName
      };

      await charactersRepo.insert(character, { db });
      newCharacter = character;

      // Update feedback status
      feedback.status = 'approved';
      feedback.resolvedAt = new Date().toISOString();
      feedback.adminNotes = `Character approved and added to database by ${actorName}`;
      await logModerationAction({
        db,
        actor: actorUser || req.user,
        action: 'feedback.character_approved',
        targetType: 'feedback',
        targetId: id,
        details: {
          characterId: character.id,
          characterName: character.name
        }
      });

      characterCreated = true;
      return db;
    });

    if (!characterCreated) {
      return res.status(404).json({ msg: 'Character suggestion not found' });
    }

    res.json({ 
      msg: 'Character approved and added to database',
      character: newCharacter
    });
  } catch (err) {
    console.error('Error approving character:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
