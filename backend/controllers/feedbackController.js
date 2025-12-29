import { readDb, updateDb } from '../services/jsonDb.js';

export const submitFeedback = async (req, res) => {
  try {
    const { type, title, description, reportedUser } = req.body;

    if (!type || !title || !description) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    const validTypes = ['bug', 'feature', 'user', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ msg: 'Invalid report type' });
    }

    if (type === 'user' && !reportedUser) {
      return res.status(400).json({ msg: 'Username is required for user reports' });
    }

    const db = readDb();
    
    const feedback = {
      id: Date.now().toString(),
      type,
      title: title.substring(0, 100),
      description: description.substring(0, 1000),
      reportedUser: type === 'user' ? reportedUser : undefined,
      submittedBy: req.user?.username || 'Anonymous',
      submittedById: req.user?.id || null,
      status: 'pending', // pending, reviewed, resolved, dismissed
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      adminNotes: null
    };

    if (!db.feedback) {
      db.feedback = [];
    }

    db.feedback.push(feedback);
    updateDb(db);

    // Send notification to all admins
    const admins = db.users.filter(user => user.role === 'admin');
    const notificationText = type === 'user' 
      ? `New user report: ${reportedUser}` 
      : `New ${type} report: ${title}`;

    admins.forEach(admin => {
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

    updateDb(db);

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
    // Only admins can view all feedback
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const db = readDb();
    const { status, type } = req.query;

    let feedback = db.feedback || [];

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
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const db = readDb();
    const feedback = db.feedback?.find(f => f.id === id);

    if (!feedback) {
      return res.status(404).json({ msg: 'Feedback not found' });
    }

    feedback.status = status;
    feedback.adminNotes = adminNotes || feedback.adminNotes;
    
    if (status === 'resolved') {
      feedback.resolvedAt = new Date().toISOString();
    }

    updateDb(db);

    res.json({ msg: 'Feedback updated successfully', feedback });
  } catch (err) {
    console.error('Error updating feedback:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
