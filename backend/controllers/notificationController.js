import { v4 as uuidv4 } from 'uuid';
import { notificationsRepo } from '../repositories/index.js';
import { sendPushToUser } from '../services/pushService.js';

const normalizeNotification = (notification) => ({
  id: notification.id || notification._id,
  userId: notification.userId,
  type: notification.type || 'system',
  title: notification.title || '',
  content: notification.content || notification.message || '',
  message: notification.message || notification.content || '',
  data: notification.data || notification.metadata || {},
  read: Boolean(notification.read),
  createdAt: notification.createdAt,
  readAt: notification.readAt || null
});

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;

    const notifications = await notificationsRepo.getAll();

    const filtered = notifications.filter((notification) => {
      if (notification.userId !== req.user.id) return false;
      if (type) {
        return notification.type === type;
      }
      return true;
    });

    const sorted = [...filtered].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    const paged = sorted.slice(
      (pageNumber - 1) * limitNumber,
      pageNumber * limitNumber
    );

    const unreadCount = notifications.filter(
      (notification) =>
        notification.userId === req.user.id && !notification.read
    ).length;

    res.json({
      notifications: paged.map((notification) =>
        normalizeNotification(notification)
      ),
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(filtered.length / limitNumber) || 1,
        totalNotifications: filtered.length,
        hasNext: pageNumber * limitNumber < filtered.length,
        hasPrev: pageNumber > 1
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
    let found;

    await notificationsRepo.updateAll((notifications) => {
      const notification = notifications.find(
        (entry) => entry.id === req.params.id || entry._id === req.params.id
      );
      if (!notification || notification.userId !== req.user.id) {
        const error = new Error('Notification not found');
        error.code = 'NOTIFICATION_NOT_FOUND';
        throw error;
      }

      notification.read = true;
      notification.readAt = new Date().toISOString();
      found = notification;
      return notifications;
    });

    res.json({
      msg: 'Notification marked as read',
      notification: normalizeNotification(found)
    });
  } catch (error) {
    if (error.code === 'NOTIFICATION_NOT_FOUND') {
      return res.status(404).json({ msg: 'Notification not found' });
    }
    console.error('Error marking notification as read:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    await notificationsRepo.updateAll((notifications) => {
      notifications.forEach((notification) => {
        if (notification.userId === req.user.id && !notification.read) {
          notification.read = true;
          notification.readAt = new Date().toISOString();
        }
      });
      return notifications;
    });

    res.json({ msg: 'All notifications marked as read' });
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
    let removed = false;

    await notificationsRepo.updateAll((notifications) => {
      const before = notifications.length;
      const filtered = notifications.filter(
        (entry) =>
          !(
            (entry.id === req.params.id || entry._id === req.params.id) &&
            entry.userId === req.user.id
          )
      );
      removed = filtered.length !== before;
      return filtered;
    });

    if (!removed) {
      return res.status(404).json({ msg: 'Notification not found' });
    }

    res.json({ msg: 'Notification deleted' });
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
    const notifications = await notificationsRepo.getAll();
    const unreadCount = notifications.filter(
      (notification) =>
        notification.userId === req.user.id && !notification.read
    ).length;

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread notification count:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Create notification (compat helper)
// @access  Internal
export const createNotification = async (
  db,
  userId,
  type,
  title,
  content,
  data = {}
) => {
  if (!userId) {
    throw new Error('createNotification requires a userId');
  }
  if (!title || !content) {
    throw new Error('createNotification requires a title and content');
  }

  const now = new Date().toISOString();
  const notification = {
    id: uuidv4(),
    userId,
    type,
    title,
    content,
    message: content,
    data,
    read: false,
    createdAt: now
  };

  if (db && typeof db === 'object') {
    await notificationsRepo.insert(notification, { db });
  } else {
    await notificationsRepo.insert(notification);
  }

  await sendPushToUser(userId, {
    title: title || 'New notification',
    body: content || '',
    url: data?.url || '/notifications',
    notificationId: notification.id
  });

  return notification;
};
