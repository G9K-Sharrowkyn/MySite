// services/notificationService.js
import { v4 as uuidv4 } from 'uuid';
import Notification from '../models/Notification.js';

/**
 * Create a new notification
 * @param {String} userId - User ID to notify
 * @param {Object} notification - The notification object
 * @returns {Object} - The created notification with ID
 */
export const createNotification = async (userId, notification) => {
  try {
    const newNotification = new Notification({
      userId,
      ...notification,
      read: false,
      createdAt: new Date()
    });

    await newNotification.save();

    return newNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Send a notification to a user
 * @param {Object} io - Socket.io instance
 * @param {String} userId - User ID to notify
 * @param {Object} notification - Notification data
 * @returns {Object} - Created notification
 */
export const sendNotification = async (io, userId, notification) => {
  try {
    const newNotification = await createNotification(userId, notification);

    // Emit notification to the user if connected
    if (io) {
      io.to(`user:${userId}`).emit('notification', newNotification);
    }

    return newNotification;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

/**
 * Mark a notification as read
 * @param {String} notificationId - ID of the notification
 * @param {String} userId - ID of the user
 * @returns {Object} - Updated notification
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOne({ _id: notificationId, userId });

    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Get notifications for a user
 * @param {String} userId - User ID
 * @param {Boolean} unreadOnly - Filter for unread notifications
 * @param {Number} limit - Max number of notifications to return
 * @returns {Array} - List of user notifications
 */
export const getUserNotifications = async (userId, unreadOnly = false, limit = 50) => {
  try {
    const query = { userId };
    if (unreadOnly) {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    return notifications;
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

/**
 * Delete a notification
 * @param {String} notificationId - ID of the notification
 * @param {String} userId - ID of the user
 * @returns {Boolean} - Success status
 */
export const deleteNotification = async (notificationId, userId) => {
  try {
    const result = await Notification.deleteOne({ _id: notificationId, userId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

export default {
  createNotification,
  sendNotification,
  markNotificationAsRead,
  getUserNotifications,
  deleteNotification
};
