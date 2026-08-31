import { v4 as uuidv4 } from 'uuid';
import { parsePagination } from '../utils/pagination.js';
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
    const { type } = req.query;
    const { page: pageNumber, limit: limitNumber } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100
    });

    const query = { userId: req.user.id, ...(type ? { type } : {}) };
    const [paged, totalNotifications, unreadCount] = await Promise.all([
      notificationsRepo.findManyBy(query, {
        sort: { createdAt: -1 },
        skip: (pageNumber - 1) * limitNumber,
        limit: limitNumber
      }),
      notificationsRepo.countBy(query),
      notificationsRepo.countBy({ userId: req.user.id, read: { $ne: true } })
    ]);

    res.json({
      notifications: paged.map((notification) =>
        normalizeNotification(notification)
      ),
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalNotifications / limitNumber) || 1,
        totalNotifications,
        hasNext: pageNumber * limitNumber < totalNotifications,
        hasPrev: pageNumber > 1
      },
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const notification = await notificationsRepo.findOneBy({
      id: req.params.id,
      userId: req.user.id
    });
    if (!notification) {
      const error = new Error('Notification not found');
      error.code = 'NOTIFICATION_NOT_FOUND';
      throw error;
    }
    const found = await notificationsRepo.updateById(req.params.id, (entry) => {
      entry.read = true;
      entry.readAt = new Date().toISOString();
      return entry;
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
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    await notificationsRepo.patchManyBy(
      { userId: req.user.id, read: { $ne: true } },
      { read: true, readAt: new Date().toISOString() }
    );

    res.json({ msg: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
  try {
    const notification = await notificationsRepo.findOneBy({
      id: req.params.id,
      userId: req.user.id
    });
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }
    await notificationsRepo.removeById(req.params.id);

    res.json({ msg: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread/count
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await notificationsRepo.countBy({
      userId: req.user.id,
      read: { $ne: true }
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread notification count:', error.message);
    res.status(500).json({ message: 'Server error' });
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

  const isTransactionalInsert = Boolean(db && typeof db === 'object');
  if (isTransactionalInsert) {
    const context = db.mongoDb || db.db ? db : { db };
    await notificationsRepo.insert(notification, context);
  } else {
    await notificationsRepo.insert(notification);
  }

  if (!isTransactionalInsert) {
    await sendPushToUser(userId, {
      title: title || 'New notification',
      body: content || '',
      url: data?.url || '/notifications',
      notificationId: notification.id
    });
  }

  return notification;
};
