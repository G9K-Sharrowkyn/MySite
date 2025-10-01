import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from './i18n/LanguageContext';
import { replacePlaceholderUrl, placeholderImages } from './utils/placeholderImage';
import LanguageSwitcher from './LanguageSwitcher/LanguageSwitcher';
import { AuthContext } from './auth/AuthContext';
import './Header.css';

const Header = () => {
  const { user, token, logout } = useContext(AuthContext);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isLoggedIn = !!user;

  const fetchUserData = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const response = await axios.get('/api/profile/me', {
        headers: { 'x-auth-token': token }
      });
      // User data is already managed by AuthContext, so we don't need to set it here
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  }, [token]);

  const fetchUnreadCounts = useCallback(async () => {
    if (!token) {
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return;
    }

    try {
      const [messagesResponse, notificationsResponse] = await Promise.all([
        axios.get('/api/messages/unread/count', {
          headers: { 'x-auth-token': token }
        }),
        axios.get('/api/notifications/unread/count', {
          headers: { 'x-auth-token': token }
        })
      ]);

      setUnreadMessages(messagesResponse.data.unreadCount);
      setUnreadNotifications(notificationsResponse.data.unreadCount);
    } catch (error) {
      console.error('Error fetching unread counts:', error);
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        // Set to 0 if there's any other error
        setUnreadMessages(0);
        setUnreadNotifications(0);
      }
    }
  }, [token]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchUserData();
      fetchUnreadCounts();
      // Set up polling for real-time updates
      const interval = setInterval(() => {
        fetchUnreadCounts();
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isLoggedIn, fetchUserData, fetchUnreadCounts]);

  const fetchNotifications = async () => {
    if (!token) return;

    try {
      const response = await axios.get('/api/notifications?limit=5', {
        headers: { 'x-auth-token': token }
      });
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleLogout = () => {
    logout();
    setUnreadMessages(0);
    setUnreadNotifications(0);
    setShowUserMenu(false);
    navigate('/');
  };

  const toggleNotifications = async () => {
    if (!showNotifications) {
      await fetchNotifications();
    }
    setShowNotifications(!showNotifications);
  };

  const markNotificationAsRead = async (notificationId) => {
    if (!token) return;

    try {
      await axios.put(`/api/notifications/${notificationId}/read`, {}, {
        headers: { 'x-auth-token': token }
      });
      fetchUnreadCounts();
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!token) return;

    try {
      await axios.put('/api/notifications/read-all', {}, {
        headers: { 'x-auth-token': token }
      });
      fetchUnreadCounts();
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return (
    <header className="header">
      <div className="header-container">
        {/* Logo */}
        <div className="header-logo">
          <h1>GeekFights</h1>
        </div>

        {/* Navigation */}
        <nav className="header-nav">
          <Link to="/" className="nav-link">{t('home')}</Link>
          <Link to="/divisions" className="nav-link">{t('divisions')}</Link>
          <Link to="/leaderboard" className="nav-link">{t('leaderboard')}</Link>
          {isLoggedIn && (
            <>
              <Link to="/betting" className="nav-link betting-link">💰 {t('betting')}</Link>
              <Link to="/propose-fighter" className="nav-link propose-fighter-link">⚔️ {t('proposeFighter')}</Link>
            </>
          )}
          {user && user.role === 'moderator' && (
            <Link to="/moderator" className="nav-link moderator-link">{t('moderator')}</Link>
          )}
        </nav>

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* User Section */}
        <div className="header-user">
          {isLoggedIn ? (
            <div className="user-section">
              {/* Messages */}
              <Link to="/messages" className="icon-button">
                <span className="icon">💬</span>
                {unreadMessages > 0 && (
                  <span className="badge">{unreadMessages}</span>
                )}
              </Link>

              {/* Notifications */}
              <div className="notifications-container">
                <button 
                  className="icon-button"
                  onClick={toggleNotifications}
                >
                  <span className="icon">🔔</span>
                  {unreadNotifications > 0 && (
                    <span className="badge">{unreadNotifications}</span>
                  )}
                </button>

                {showNotifications && (
                  <div className="notifications-dropdown">
                    <div className="notifications-header">
                      <h3>{t('notifications')}</h3>
                      {unreadNotifications > 0 && (
                        <button 
                          className="mark-all-read"
                          onClick={markAllNotificationsAsRead}
                        >
                          {t('markAllAsRead')}
                        </button>
                      )}
                    </div>
                    <div className="notifications-list">
                      {notifications.length > 0 ? (
                        notifications.map(notification => (
                          <div 
                            key={notification.id} 
                            className={`notification-item ${!notification.read ? 'unread' : ''}`}
                            onClick={() => markNotificationAsRead(notification.id)}
                          >
                            <div className="notification-title">{notification.title}</div>
                            <div className="notification-content">{notification.content}</div>
                            <div className="notification-time">
                              {new Date(notification.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="no-notifications">{t('noNotifications')}</div>
                      )}
                    </div>
                    <div className="notifications-footer">
                      <Link to="/notifications" onClick={() => setShowNotifications(false)}>
                        {t('seeAll')}
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="user-menu-container">
                <button 
                  className="user-button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <img 
                    src={replacePlaceholderUrl(user?.profilePicture) || placeholderImages.userSmall} 
                    alt="Profile" 
                    className="user-avatar"
                  />
                  <span className="user-name">{user?.username}</span>
                  <span className="dropdown-arrow">▼</span>
                </button>

                {showUserMenu && (
                  <div className="user-dropdown">
                    <Link 
                      to="/profile/me" 
                      className="dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <span className="dropdown-icon">👤</span>
                      {t('profile')}
                    </Link>
                    <Link 
                      to="/messages" 
                      className="dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <span className="dropdown-icon">💬</span>
                      {t('messages')}
                      {unreadMessages > 0 && (
                        <span className="dropdown-badge">{unreadMessages}</span>
                      )}
                    </Link>
                    <Link 
                      to="/characters" 
                      className="dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <span className="dropdown-icon">🎮</span>
                      {t('characters')}
                    </Link>
                    <div className="dropdown-divider"></div>
                    <button 
                      className="dropdown-item logout-item"
                      onClick={handleLogout}
                    >
                      <span className="dropdown-icon">🚪</span>
                      {t('logout')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn btn-outline">{t('login')}</Link>
              <Link to="/register" className="btn btn-primary">{t('register')}</Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu Toggle */}
      <div className="mobile-menu-toggle">
        <button className="hamburger">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Click outside handlers */}
      {(showUserMenu || showNotifications) && (
        <div 
          className="overlay"
          onClick={() => {
            setShowUserMenu(false);
            setShowNotifications(false);
          }}
        ></div>
      )}
    </header>
  );
};

export default Header;