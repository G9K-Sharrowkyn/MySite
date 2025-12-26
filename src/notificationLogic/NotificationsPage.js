import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Modal from '../Modal/Modal';
import { useLanguage } from '../i18n/LanguageContext';
import './NotificationsPage.css';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [currentPage, filter]);

  const fetchNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20
      });
      
      if (filter !== 'all') {
        params.append('type', filter);
      }

      const response = await axios.get(`/api/notifications?${params}`, {
        headers: { 'x-auth-token': token }
      });

      setNotifications(response.data.notifications);
      setPagination(response.data.pagination);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await axios.put(`/api/notifications/${notificationId}/read`, {}, {
        headers: { 'x-auth-token': token }
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await axios.put('/api/notifications/read-all', {}, {
        headers: { 'x-auth-token': token }
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = (notificationId) => {
    setNotificationToDelete(notificationId);
    setShowDeleteModal(true);
  };

  const confirmDeleteNotification = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await axios.delete(`/api/notifications/${notificationToDelete}`, {
        headers: { 'x-auth-token': token }
      });
      
      // Remove from local state
      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationToDelete)
      );
      setShowDeleteModal(false);
      setNotificationToDelete(null);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      message: '💬',
      comment: '💭',
      like: '👍',
      fight_result: '🏆',
      tournament: '🎯',
      system: '⚙️'
    };
    return icons[type] || '📢';
  };

  const getNotificationLink = (notification) => {
    const { type, data } = notification;
    
    switch (type) {
      case 'message':
        return `/messages/conversation/${data?.senderId}`;
      case 'comment':
        if (data?.postId) {
          return `/post/${data.postId}`;
        }
        if (data?.fightId) {
          return `/fight/${data.fightId}`;
        }
        if (data?.profileId) {
          return `/profile/${data.profileId}`;
        }
        return data?.authorId ? `/profile/${data.authorId}` : null;
      case 'like':
        return `/profile/me`;
      case 'fight_result':
        return `/fight/${data?.fightId}`;
      case 'tournament':
        return `/tournaments/${data?.tournamentId}`;
      default:
        return null;
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    const link = getNotificationLink(notification);
    if (link) {
      navigate(link);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="notifications-page">
        <div className="loading">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <div className="page-header">
        <h1>{t('notifications')}</h1>
        <div className="header-actions">
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="btn btn-outline">
              {t('markAllAsRead')} ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button 
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t('all')}
        </button>
        <button 
          className={`filter-tab ${filter === 'message' ? 'active' : ''}`}
          onClick={() => setFilter('message')}
        >
          💬 {t('messages')}
        </button>
        <button 
          className={`filter-tab ${filter === 'comment' ? 'active' : ''}`}
          onClick={() => setFilter('comment')}
        >
          💭 {t('comments')}
        </button>
        <button 
          className={`filter-tab ${filter === 'like' ? 'active' : ''}`}
          onClick={() => setFilter('like')}
        >
          👍 {t('likes')}
        </button>
        <button 
          className={`filter-tab ${filter === 'fight_result' ? 'active' : ''}`}
          onClick={() => setFilter('fight_result')}
        >
          🏆 {t('fightResults')}
        </button>
      </div>

      {/* Notifications List */}
      <div className="notifications-list">
        {notifications.length > 0 ? (
          notifications.map(notification => (
            <div 
              key={notification.id} 
              className={`notification-item ${!notification.read ? 'unread' : ''}`}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              
              <div 
                className="notification-content"
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-title">
                  {notification.title}
                </div>
                <div className="notification-text">
                  {notification.content}
                </div>
                <div className="notification-time">
                  {new Date(notification.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="notification-actions">
                {!notification.read && (
                  <button 
                    className="mark-read-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                    title={t('markAsRead')}
                  >
                    ✓
                  </button>
                )}
                <button 
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                  title={t('deleteNotification')}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="no-notifications">
            <div className="no-notifications-icon">🔔</div>
            <h3>{t('noNotifications')}</h3>
            <p>
              {filter === 'all' 
                ? t('noNotificationsMessage')
                : t('noNotificationsOfType', { type: filter })
              }
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button 
            className="pagination-btn"
            disabled={!pagination.hasPrev}
            onClick={() => setCurrentPage(prev => prev - 1)}
          >
            ← {t('previous')}
          </button>
          
          <span className="pagination-info">
            {t('pageInfo', { current: pagination.currentPage, total: pagination.totalPages })}
          </span>
          
          <button 
            className="pagination-btn"
            disabled={!pagination.hasNext}
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            {t('next')} →
          </button>
        </div>
      )}

      {/* Delete Notification Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={t('confirmDelete')}
        type="warning"
        confirmText={t('delete')}
        cancelText={t('cancel')}
        onConfirm={confirmDeleteNotification}
        confirmButtonType="danger"
      >
        <p>{t('deleteNotificationConfirm')}</p>
      </Modal>
    </div>
  );
};

export default NotificationsPage;
