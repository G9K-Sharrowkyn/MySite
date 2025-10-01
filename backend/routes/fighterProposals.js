import express from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import FighterProposal from '../models/FighterProposal.js';
import Character from '../models/Character.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import moderatorAuth from '../middleware/moderatorAuth.js';

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/fighter-proposals');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'fighter-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Tylko pliki obrazów są dozwolone!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Submit a new fighter proposal
router.post('/submit', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Zdjęcie fightera jest wymagane' });
    }

    const { name, description, universe, powerLevel, abilities } = req.body;

    // Validate required fields
    if (!name || !description || !universe || !powerLevel) {
      // Clean up uploaded file if validation fails
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ 
        error: 'Wszystkie wymagane pola muszą być wypełnione' 
      });
    }

    // Check if fighter with this name already exists
    const existingCharacter = await Character.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingCharacter) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ 
        error: 'Fighter o tej nazwie już istnieje w bazie danych' 
      });
    }

    // Check if there's already a pending proposal for this fighter
    const existingProposal = await FighterProposal.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      status: 'pending'
    });

    if (existingProposal) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ 
        error: 'Propozycja fightera o tej nazwie już oczekuje na moderację' 
      });
    }

    // Create the proposal
    const proposal = new FighterProposal({
      name: name.trim(),
      description: description.trim(),
      universe: universe.trim(),
      powerLevel,
      abilities: abilities ? abilities.trim() : '',
      imageUrl: `/uploads/fighter-proposals/${req.file.filename}`,
      imageFilename: req.file.filename,
      proposedBy: req.user.id
    });

    await proposal.save();

    // Notify all moderators about the new proposal
    const moderators = await User.find({ role: 'moderator' });
    const notifications = moderators.map(moderator => ({
      userId: moderator._id,
      type: 'fighter_proposal',
      title: 'Nowa propozycja fightera',
      message: `${req.user.username} zaproponował nowego fightera: ${name}`,
      data: {
        proposalId: proposal._id,
        proposerUsername: req.user.username,
        fighterName: name
      },
      priority: 'medium'
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    res.status(201).json({
      message: 'Propozycja fightera została wysłana do moderacji',
      proposal: {
        id: proposal._id,
        name: proposal.name,
        status: proposal.status,
        createdAt: proposal.createdAt
      }
    });

  } catch (error) {
    console.error('Error submitting fighter proposal:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    if (error.code === 11000) {
      return res.status(400).json({ error: 'Propozycja o tej nazwie już istnieje' });
    }

    res.status(500).json({ error: 'Błąd podczas wysyłania propozycji' });
  }
});

// Get user's proposals
router.get('/my-proposals', auth, async (req, res) => {
  try {
    const proposals = await FighterProposal.getByUser(req.user.id);
    res.json(proposals);
  } catch (error) {
    console.error('Error fetching user proposals:', error);
    res.status(500).json({ error: 'Błąd podczas pobierania propozycji' });
  }
});

// Get pending proposals (moderators only)
router.get('/pending', moderatorAuth, async (req, res) => {
  try {
    const proposals = await FighterProposal.getPending();
    res.json(proposals);
  } catch (error) {
    console.error('Error fetching pending proposals:', error);
    res.status(500).json({ error: 'Błąd podczas pobierania oczekujących propozycji' });
  }
});

// Get all proposals with pagination (moderators only)
router.get('/all', moderatorAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const skip = (page - 1) * limit;

    let query = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const proposals = await FighterProposal.find(query)
      .populate('proposedBy', 'username email')
      .populate('reviewedBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FighterProposal.countDocuments(query);

    res.json({
      proposals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching all proposals:', error);
    res.status(500).json({ error: 'Błąd podczas pobierania propozycji' });
  }
});

// Get proposal statistics (moderators only)
router.get('/stats', moderatorAuth, async (req, res) => {
  try {
    const stats = await FighterProposal.getStats();
    const statsObj = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0
    };

    stats.forEach(stat => {
      statsObj[stat._id] = stat.count;
      statsObj.total += stat.count;
    });

    res.json(statsObj);
  } catch (error) {
    console.error('Error fetching proposal stats:', error);
    res.status(500).json({ error: 'Błąd podczas pobierania statystyk' });
  }
});

// Approve a proposal (moderators only)
router.post('/:id/approve', moderatorAuth, async (req, res) => {
  try {
    const { notes } = req.body;
    const proposal = await FighterProposal.findById(req.params.id)
      .populate('proposedBy', 'username');

    if (!proposal) {
      return res.status(404).json({ error: 'Propozycja nie została znaleziona' });
    }

    if (proposal.status !== 'pending') {
      return res.status(400).json({ error: 'Propozycja została już zweryfikowana' });
    }

    // Check if character already exists (double-check)
    const existingCharacter = await Character.findOne({ 
      name: { $regex: new RegExp(`^${proposal.name}$`, 'i') } 
    });
    
    if (existingCharacter) {
      return res.status(400).json({ 
        error: 'Fighter o tej nazwie już istnieje w bazie danych' 
      });
    }

    // Approve the proposal
    await proposal.approve(req.user.id, notes);

    // Create the character in the database
    const character = new Character({
      name: proposal.name,
      description: proposal.description,
      universe: proposal.universe,
      powerLevel: proposal.powerLevel,
      abilities: proposal.abilities,
      imageUrl: proposal.imageUrl,
      addedBy: proposal.proposedBy._id,
      approvedBy: req.user.id,
      createdAt: new Date()
    });

    await character.save();

    // Notify the proposer about approval
    await new Notification({
      userId: proposal.proposedBy._id,
      type: 'fighter_approved',
      title: 'Propozycja fightera zatwierdzona!',
      message: `Twoja propozycja fightera "${proposal.name}" została zatwierdzona i dodana do bazy danych.`,
      data: {
        proposalId: proposal._id,
        characterId: character._id,
        fighterName: proposal.name,
        moderatorNotes: notes
      },
      priority: 'high'
    }).save();

    res.json({
      message: 'Propozycja została zatwierdzona i fighter dodany do bazy danych',
      proposal,
      character: {
        id: character._id,
        name: character.name
      }
    });

  } catch (error) {
    console.error('Error approving proposal:', error);
    res.status(500).json({ error: 'Błąd podczas zatwierdzania propozycji' });
  }
});

// Reject a proposal (moderators only)
router.post('/:id/reject', moderatorAuth, async (req, res) => {
  try {
    const { notes } = req.body;
    const proposal = await FighterProposal.findById(req.params.id)
      .populate('proposedBy', 'username');

    if (!proposal) {
      return res.status(404).json({ error: 'Propozycja nie została znaleziona' });
    }

    if (proposal.status !== 'pending') {
      return res.status(400).json({ error: 'Propozycja została już zweryfikowana' });
    }

    // Reject the proposal
    await proposal.reject(req.user.id, notes);

    // Notify the proposer about rejection
    await new Notification({
      userId: proposal.proposedBy._id,
      type: 'fighter_rejected',
      title: 'Propozycja fightera odrzucona',
      message: `Twoja propozycja fightera "${proposal.name}" została odrzucona.`,
      data: {
        proposalId: proposal._id,
        fighterName: proposal.name,
        moderatorNotes: notes
      },
      priority: 'medium'
    }).save();

    res.json({
      message: 'Propozycja została odrzucona',
      proposal
    });

  } catch (error) {
    console.error('Error rejecting proposal:', error);
    res.status(500).json({ error: 'Błąd podczas odrzucania propozycji' });
  }
});

// Delete a proposal (moderators only)
router.delete('/:id', moderatorAuth, async (req, res) => {
  try {
    const proposal = await FighterProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({ error: 'Propozycja nie została znaleziona' });
    }

    // Delete the image file
    const imagePath = path.join(__dirname, '../uploads/fighter-proposals', proposal.imageFilename);
    await fs.unlink(imagePath).catch(() => {
      console.log('Image file not found or already deleted');
    });

    // Delete the proposal
    await FighterProposal.findByIdAndDelete(req.params.id);

    res.json({ message: 'Propozycja została usunięta' });

  } catch (error) {
    console.error('Error deleting proposal:', error);
    res.status(500).json({ error: 'Błąd podczas usuwania propozycji' });
  }
});

// Get proposal details
router.get('/:id', auth, async (req, res) => {
  try {
    const proposal = await FighterProposal.findById(req.params.id)
      .populate('proposedBy', 'username')
      .populate('reviewedBy', 'username');

    if (!proposal) {
      return res.status(404).json({ error: 'Propozycja nie została znaleziona' });
    }

    // Check if user can view this proposal
    const isModerator = req.user.role === 'moderator';
    const isOwner = proposal.proposedBy._id.toString() === req.user.id;

    if (!isModerator && !isOwner) {
      return res.status(403).json({ error: 'Brak uprawnień do wyświetlenia tej propozycji' });
    }

    res.json(proposal);

  } catch (error) {
    console.error('Error fetching proposal details:', error);
    res.status(500).json({ error: 'Błąd podczas pobierania szczegółów propozycji' });
  }
});

module.exports = router;