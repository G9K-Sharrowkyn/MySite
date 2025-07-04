const { v4: uuidv4 } = require('uuid');

exports.getUserNotifications = async (req, res) => {
  const db = req.db;
  const { page = 1, limit = 20 } = req.query;
  
  try {
    await db.read();
    
    let notifications = db.data.notifications.filter(n => n.userId === req.user.id);
    
    // Sort by creation date (newest first)
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedNotifications = notifications.slice(startIndex, endIndex);
    
    const unreadCount = notifications.filter(n => !n.read).length;
    
    res.json({
      notifications: paginatedNotifications,
      totalNotifications: notifications.length,
      unreadCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(notifications.length / limit)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.markAsRead = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  
  try {
    await db.read();
    
    const notificationIndex = db.data.notifications.findIndex(n => n.id === id && n.userId === req.user.id);
    if (notificationIndex === -1) {
      return res.status(404).json({ msg: 'Notification not found' });
    }
    
    db.data.notifications[notificationIndex].read = true;
    db.data.notifications[notificationIndex].readAt = new Date().toISOString();
    
    await db.write();
    res.json({ msg: 'Notification marked as read' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.markAllAsRead = async (req, res) => {
  const db = req.db;
  
  try {
    await db.read();
    
    const userNotifications = db.data.notifications.filter(n => n.userId === req.user.id && !n.read);
    
    userNotifications.forEach(notification => {
      const index = db.data.notifications.findIndex(n => n.id === notification.id);
      if (index !== -1) {
        db.data.notifications[index].read = true;
        db.data.notifications[index].readAt = new Date().toISOString();
      }
    });
    
    await db.write();
    res.json({ msg: `${userNotifications.length} notifications marked as read` });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.deleteNotification = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  
  try {
    await db.read();
    
    const notificationIndex = db.data.notifications.findIndex(n => n.id === id && n.userId === req.user.id);
    if (notificationIndex === -1) {
      return res.status(404).json({ msg: 'Notification not found' });
    }
    
    db.data.notifications.splice(notificationIndex, 1);
    await db.write();
    
    res.json({ msg: 'Notification deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// Helper function to create notifications (can be used by other controllers)
exports.createNotification = async (db, userId, type, title, message, relatedId = null) => {
  const notification = {
    id: uuidv4(),
    userId,
    type, // 'like', 'comment', 'fight_result', 'tournament', 'message', etc.
    title,
    message,
    relatedId, // ID of related post, fight, tournament, etc.
    read: false,
    createdAt: new Date().toISOString(),
    readAt: null
  };
  
  db.data.notifications.push(notification);
  return notification;
};