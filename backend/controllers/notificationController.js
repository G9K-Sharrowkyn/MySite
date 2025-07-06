const { v4: uuidv4 } = require('uuid');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    console.log('Get notifications request received:', {
      userId: req.user.id,
      query: req.query
    });

    const { page = 1, limit = 20, type } = req.query;
    const db = req.db;
    await db.read();

    let notifications = db.data.notifications.filter(n => n.userId === req.user.id);

    // Filter by type if specified
    if (type) {
      notifications = notifications.filter(n => n.type === type);
    }

    // Sort by creation date (newest first)
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedNotifications = notifications.slice(startIndex, endIndex);

    console.log(`Returning ${paginatedNotifications.length} notifications out of ${notifications.length}`);

    res.json({
      notifications: paginatedNotifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(notifications.length / limit),
        totalNotifications: notifications.length,
        hasNext: endIndex < notifications.length,
        hasPrev: startIndex > 0
      },
      unreadCount: notifications.filter(n => !n.read).length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    console.log('Mark notification as read request received:', {
      userId: req.user.id,
      notificationId: req.params.id
    });

    const db = req.db;
    await db.read();

    const notificationIndex = db.data.notifications.findIndex(n => 
      n.id === req.params.id && n.userId === req.user.id
    );

    if (notificationIndex === -1) {
      console.error('Notification not found:', req.params.id);
      return res.status(404).json({ msg: 'Powiadomienie nie znalezione' });
    }

    db.data.notifications[notificationIndex].read = true;
    db.data.notifications[notificationIndex].readAt = new Date().toISOString();

    await db.write();
    res.json({ msg: 'Powiadomienie oznaczone jako przeczytane' });
  } catch (error) {
    console.error('Error marking notification as read:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    console.log('Mark all notifications as read request received:', {
      userId: req.user.id
    });

    const db = req.db;
    await db.read();

    const userNotifications = db.data.notifications.filter(n => 
      n.userId === req.user.id && !n.read
    );

    userNotifications.forEach(notification => {
      const notificationIndex = db.data.notifications.findIndex(n => n.id === notification.id);
      if (notificationIndex !== -1) {
        db.data.notifications[notificationIndex].read = true;
        db.data.notifications[notificationIndex].readAt = new Date().toISOString();
      }
    });

    await db.write();
    res.json({ msg: 'Wszystkie powiadomienia oznaczone jako przeczytane' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    console.log('Delete notification request received:', {
      userId: req.user.id,
      notificationId: req.params.id
    });

    const db = req.db;
    await db.read();

    const notificationIndex = db.data.notifications.findIndex(n => 
      n.id === req.params.id && n.userId === req.user.id
    );

    if (notificationIndex === -1) {
      console.error('Notification not found:', req.params.id);
      return res.status(404).json({ msg: 'Powiadomienie nie znalezione' });
    }

    db.data.notifications.splice(notificationIndex, 1);
    await db.write();

    res.json({ msg: 'Powiadomienie usunięte' });
  } catch (error) {
    console.error('Error deleting notification:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread/count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    console.log('Get unread notification count request received:', {
      userId: req.user.id
    });

    const db = req.db;
    await db.read();

    const unreadCount = db.data.notifications.filter(n => 
      n.userId === req.user.id && !n.read
    ).length;

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread notification count:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create notification (internal function)
exports.createNotification = async (db, userId, type, title, content, data = {}) => {
  try {
    console.log('Create notification called:', {
      userId,
      type,
      title,
      content,
      data
    });

    const notification = {
      id: uuidv4(),
      userId,
      type, // 'message', 'fight_result', 'comment', 'like', 'tournament', 'system'
      title,
      content,
      data,
      read: false,
      createdAt: new Date().toISOString()
    };

    db.data.notifications.push(notification);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
    throw error;
  }
};
