import Notification from '../models/Notification.js';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    console.log('Get notifications request received:', {
      userId: req.user.id,
      query: req.query
    });

    const { page = 1, limit = 20, type } = req.query;

    const query = { userId: req.user.id };
    if (type) {
      query.type = type;
    }

    const totalNotifications = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const unreadCount = await Notification.countDocuments({ userId: req.user.id, read: false });

    console.log(`Returning ${notifications.length} notifications out of ${totalNotifications}`);

    res.json({
      notifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalNotifications / limit),
        totalNotifications,
        hasNext: page * limit < totalNotifications,
        hasPrev: page > 1
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    console.log('Mark notification as read request received:', {
      userId: req.user.id,
      notificationId: req.params.id
    });

    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      console.error('Notification not found:', req.params.id);
      return res.status(404).json({ msg: 'Powiadomienie nie znalezione' });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({ msg: 'Powiadomienie oznaczone jako przeczytane' });
  } catch (error) {
    console.error('Error marking notification as read:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    console.log('Mark all notifications as read request received:', {
      userId: req.user.id
    });

    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ msg: 'Wszystkie powiadomienia oznaczone jako przeczytane' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    console.log('Delete notification request received:', {
      userId: req.user.id,
      notificationId: req.params.id
    });

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      console.error('Notification not found:', req.params.id);
      return res.status(404).json({ msg: 'Powiadomienie nie znalezione' });
    }

    res.json({ msg: 'Powiadomienie usunięte' });
  } catch (error) {
    console.error('Error deleting notification:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread/count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    console.log('Get unread notification count request received:', {
      userId: req.user.id
    });

    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      read: false
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread notification count:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create notification (internal function)
// This function is no longer needed as we use Notification.create directly
// Keeping it for backward compatibility
export const createNotification = async (db, userId, type, title, content, data = {}) => {
  try {
    console.log('Create notification called (deprecated):', {
      userId,
      type,
      title,
      content,
      data
    });

    const notification = await Notification.create({
      userId,
      type,
      title,
      message: content,
      data,
      read: false
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
    throw error;
  }
};
