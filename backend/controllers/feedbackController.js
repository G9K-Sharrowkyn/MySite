import {
  charactersRepo,
  feedbackRepo,
  usersRepo,
  withDb
} from '../repositories/index.js';

export const submitFeedback = async (req, res) => {
  try {
    const { type, title, description, reportedUser } = req.body;

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

    if (type === 'character' && (!req.body.characterName || !req.body.characterTags)) {
      return res.status(400).json({ msg: 'Character name and tags are required for character suggestions' });
    }

    const feedback = {
      id: Date.now().toString(),
      type,
      title: title.substring(0, 100),
      description: description.substring(0, 1000),
      reportedUser: type === 'user' ? reportedUser : undefined,
      characterName: type === 'character' ? req.body.characterName : undefined,
      characterTags: type === 'character' ? req.body.characterTags : undefined,
      characterImage: type === 'character' ? req.body.characterImage : undefined,
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
          id: Date.now().toString() + Math.random(),
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

    updatedFeedback = await feedbackRepo.updateById(id, (feedback) => {
      if (!feedback) {
        return feedback;
      }

      feedback.status = status;
      feedback.adminNotes = adminNotes || feedback.adminNotes;

      if (status === 'resolved') {
        feedback.resolvedAt = new Date().toISOString();
      }

      return feedback;
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

    const removed = await feedbackRepo.removeById(id);
    deleted = Boolean(removed);

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
    let characterCreated = false;
    let newCharacter = null;

    await withDb(async (db) => {
      const feedback = await feedbackRepo.findById(id, { db });

      if (!feedback || feedback.type !== 'character') {
        return db;
      }

      // Create new character
      const character = {
        id: Date.now().toString(),
        name: feedback.characterName,
        image: feedback.characterImage || '/characters/default.jpg',
        tags: feedback.characterTags || [],
        createdAt: new Date().toISOString(),
        suggestedBy: feedback.submittedBy,
        approvedBy: req.user.username
      };

      await charactersRepo.insert(character, { db });
      newCharacter = character;

      // Update feedback status
      feedback.status = 'approved';
      feedback.resolvedAt = new Date().toISOString();
      feedback.adminNotes = `Character approved and added to database by ${req.user.username}`;

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
