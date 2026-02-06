import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from './i18n/LanguageContext';
import { replacePlaceholderUrl, placeholderImages, getOptimizedImageProps } from './utils/placeholderImage';
import LanguageSwitcher from './LanguageSwitcher/LanguageSwitcher';
import { AuthContext } from './auth/AuthContext';
import { getUserDisplayName } from './utils/userDisplay';
import './Header.css';

const Header = () => {
  const { user, token, logout } = useContext(AuthContext);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isLoggedIn = !!user;
  const isModerator = user?.role === 'moderator' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';
  const userDisplayName = getUserDisplayName(user);

  const handleLogout = useCallback(() => {
    logout();
    setUnreadMessages(0);
    setUnreadNotifications(0);
    setShowUserMenu(false);
    navigate('/');
  }, [logout, navigate]);

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
  }, [token, handleLogout]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchUnreadCounts();
      // Set up polling for real-time updates
      const interval = setInterval(() => {
        fetchUnreadCounts();
      }, 15000); // Check every 15 seconds

      return () => clearInterval(interval);
    }
  }, [isLoggedIn, fetchUnreadCounts]);

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

  const toggleNotifications = async () => {
    if (!showNotifications) {
      await fetchNotifications();
    }
    setShowNotifications(!showNotifications);
  };

  const toggleUserMenu = () => {
    setShowUserMenu(prev => {
      const next = !prev;
      if (next) {
        setShowMobileMenu(false);
        setShowNotifications(false);
      }
      return next;
    });
  };

  const toggleMobileMenu = () => {
    setShowMobileMenu(prev => {
      const next = !prev;
      if (next) {
        setShowUserMenu(false);
        setShowNotifications(false);
      }
      return next;
    });
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

  const handleFriendRequestAction = async (requestId, action, notificationId) => {
    if (!token || !requestId) return;
    try {
      await axios.post(`/api/friends/requests/${encodeURIComponent(requestId)}/${action}`, {}, {
        headers: { 'x-auth-token': token }
      });
      if (notificationId) {
        await markNotificationAsRead(notificationId);
      } else {
        fetchUnreadCounts();
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error handling friend request action:', error);
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
          <Link to="/" className="header-logo-link" aria-label="VersusVerseVault Home">
            <img src="/logo512.png" alt="VersusVerseVault" className="header-logo-image" />
          </Link>
        </div>

        <div className="header-body">
          <nav className="header-nav-block">
            <div className="nav-row nav-row-top">
              <Link to="/" className="nav-link pre-ccg">{t('home')}</Link>
              <Link to="/divisions" className="nav-link pre-ccg">{t('divisions')}</Link>
              <Link to="/leaderboard" className="nav-link pre-ccg">{t('leaderboard')}</Link>
            </div>
            <div className="nav-row nav-row-bottom">
              <Link to="/tournaments" className="nav-link pre-ccg">{t('tournaments')}</Link>
              {isModerator ? (
                <Link to="/speed-racing" className="nav-link pre-ccg">{t('speedRacing')}</Link>
              ) : (
                <span className="nav-link nav-link-disabled pre-ccg" aria-disabled="true" title="DostÄ™p tylko dla moderatorĂłw">
                  {t('speedRacing')}
                  <span className="nav-link-soon">(Soon!)</span>
                </span>
              )}
              {isModerator ? (
                <Link to="/ccg" className="nav-link pre-ccg">CCG</Link>
              ) : (
                <span className="nav-link nav-link-disabled pre-ccg" aria-disabled="true" title="DostÄ™p tylko dla moderatorĂłw">
                  CCG
                  <span className="nav-link-soon">(Soon!)</span>
                </span>
              )}
              {isModerator && (
                <Link to="/moderator" className="nav-link moderator-link after-ccg after-ccg-admin">{t('moderator')}</Link>
              )}
              {isAdmin && (
                <Link to="/admin" className="nav-link admin-link after-ccg after-ccg-admin">{t('adminPanel') || 'Admin'}</Link>
              )}
            </div>
          </nav>

          <div className="header-tools-block">
            <div className="tools-row tools-row-top">
              <LanguageSwitcher />
              <Link to="/help" className="nav-link header-help-link">{(t('help') || 'Help').toUpperCase()}</Link>
              {isLoggedIn ? (
                <div className="user-menu-container after-ccg after-ccg-user">
                  <button 
                    className="user-button"
                    onClick={toggleUserMenu}
                  >
                    <img 
                      {...getOptimizedImageProps(
                        replacePlaceholderUrl(user?.profilePicture) || placeholderImages.userSmall,
                        { size: 40 }
                      )}
                      alt="Profile" 
                      className="user-avatar"
                    />
                    <span className="user-name">{userDisplayName}</span>
                    <span className="dropdown-arrow">{'\u25BC'}</span>
                  </button>

                  {showUserMenu && (
                    <div className="user-dropdown">
                      <Link 
                        to={user?.username ? `/profile/${encodeURIComponent(user.username)}` : "/profile/me"} 
                        className="dropdown-item"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <span className="dropdown-icon">{'\u{1F464}'}</span>
                        {t('profile')}
                      </Link>
                      <Link 
                        to="/messages" 
                        className="dropdown-item"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <span className="dropdown-icon">{'\u{1F4AC}'}</span>
                        {t('messages')}
                        {unreadMessages > 0 && (
                          <span className="dropdown-badge">{unreadMessages}</span>
                        )}
                      </Link>
                      <Link 
                        to="/settings" 
                        className="dropdown-item"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <span className="dropdown-icon">{'\u2699\uFE0F'}</span>
                        Settings
                      </Link>
                      <div className="dropdown-divider"></div>
                      <button 
                        className="dropdown-item logout-item"
                        onClick={handleLogout}
                      >
                        <span className="dropdown-icon">{'\u{1F6AA}'}</span>
                        {t('logout')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="auth-buttons after-ccg after-ccg-user">
                  <Link to="/login" className="btn btn-outline">{t('login')}</Link>
                  <Link to="/register" className="btn btn-primary">{t('register')}</Link>
                </div>
              )}
            </div>

            {isLoggedIn && (
              <div className="tools-row tools-row-bottom">
                <Link to="/messages" className="icon-button after-ccg after-ccg-priority">
                  <span className="icon">{'\u{1F4AC}'}</span>
                  {unreadMessages > 0 && (
                    <span className="badge">{unreadMessages}</span>
                  )}
                </Link>

                <div className="notifications-container after-ccg after-ccg-priority">
                  <button 
                    className="icon-button"
                    onClick={toggleNotifications}
                  >
                    <span className="icon">{'\u{1F514}'}</span>
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
                              {notification.type === 'friend_request' && notification.data?.requestId && (
                                <div
                                  className="notification-actions"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    className="notification-action-btn primary"
                                    onClick={() => handleFriendRequestAction(notification.data.requestId, 'accept', notification.id)}
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    className="notification-action-btn"
                                    onClick={() => handleFriendRequestAction(notification.data.requestId, 'decline', notification.id)}
                                  >
                                    Decline
                                  </button>
                                </div>
                              )}
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
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="header-mobile">
        <div className="header-mobile-top">
          <Link to="/" className="header-logo-link" aria-label="VersusVerseVault Home">
            <img src="/logo512.png" alt="VersusVerseVault" className="header-logo-image" />
          </Link>
          <button
            type="button"
            className="mobile-menu-button"
            onClick={toggleMobileMenu}
          >
            {showMobileMenu ? (t('close') || 'Close') : (t('menu') || 'Menu')}
          </button>
        </div>

        <div className="header-mobile-actions">
          {isLoggedIn && (
            <>
              <Link to="/messages" className="icon-button mobile-action">
                <span className="icon">💬</span>
                {unreadMessages > 0 && (
                  <span className="badge">{unreadMessages}</span>
                )}
              </Link>
              <div className="notifications-container mobile-action">
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
                            {notification.type === 'friend_request' && notification.data?.requestId && (
                              <div
                                className="notification-actions"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="notification-action-btn primary"
                                  onClick={() => handleFriendRequestAction(notification.data.requestId, 'accept', notification.id)}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="notification-action-btn"
                                  onClick={() => handleFriendRequestAction(notification.data.requestId, 'decline', notification.id)}
                                >
                                  Decline
                                </button>
                              </div>
                            )}
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
            </>
          )}
          <LanguageSwitcher />
          {isLoggedIn ? (
            <div className="user-menu-container mobile-action">
              <button
                className="user-button"
                onClick={toggleUserMenu}
              >
                <img
                  {...getOptimizedImageProps(
                    replacePlaceholderUrl(user?.profilePicture) || placeholderImages.userSmall,
                    { size: 40 }
                  )}
                  alt="Profile"
                  className="user-avatar"
                />
                <span className="user-name">{userDisplayName}</span>
                <span className="dropdown-arrow">▼</span>
              </button>

              {showUserMenu && (
                <div className="header-mobile-menu header-mobile-profile-menu">
                  <Link
                    to={user?.username ? `/profile/${encodeURIComponent(user.username)}` : "/profile/me"}
                    className="mobile-nav-link"
                    onClick={() => setShowUserMenu(false)}
                  >
                    {t('profile')}
                  </Link>
                  <Link
                    to="/messages"
                    className="mobile-nav-link"
                    onClick={() => setShowUserMenu(false)}
                  >
                    {t('messages')}
                  </Link>
                  <Link
                    to="/settings"
                    className="mobile-nav-link"
                    onClick={() => setShowUserMenu(false)}
                  >
                    Settings
                  </Link>
                  <button
                    className="mobile-nav-link"
                    onClick={handleLogout}
                  >
                    {t('logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons mobile-action">
              <Link to="/login" className="btn btn-outline">{t('login')}</Link>
              <Link to="/register" className="btn btn-primary">{t('register')}</Link>
            </div>
          )}
        </div>

        {showMobileMenu && (
          <div className="header-mobile-menu">
            <Link to="/" className="mobile-nav-link" onClick={() => setShowMobileMenu(false)}>{t('home')}</Link>
            <Link to="/divisions" className="mobile-nav-link" onClick={() => setShowMobileMenu(false)}>{t('divisions')}</Link>
            <Link to="/leaderboard" className="mobile-nav-link" onClick={() => setShowMobileMenu(false)}>{t('leaderboard')}</Link>
            <Link to="/tournaments" className="mobile-nav-link" onClick={() => setShowMobileMenu(false)}>{t('tournaments')}</Link>
            {isModerator ? (
              <Link to="/speed-racing" className="mobile-nav-link" onClick={() => setShowMobileMenu(false)}>{t('speedRacing')}</Link>
            ) : (
              <span className="mobile-nav-link disabled">{t('speedRacing')} <span className="nav-link-soon">(Soon!)</span></span>
            )}
            {isModerator ? (
              <Link to="/ccg" className="mobile-nav-link" onClick={() => setShowMobileMenu(false)}>CCG</Link>
            ) : (
              <span className="mobile-nav-link disabled">CCG <span className="nav-link-soon">(Soon!)</span></span>
            )}
            {isModerator && (
              <Link to="/moderator" className="mobile-nav-link moderator-link" onClick={() => setShowMobileMenu(false)}>{t('moderator')}</Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="mobile-nav-link admin-link" onClick={() => setShowMobileMenu(false)}>{t('adminPanel') || 'Admin'}</Link>
            )}
            <Link to="/help" className="mobile-nav-link" onClick={() => setShowMobileMenu(false)}>{t('help') || 'Help'}</Link>
          </div>
        )}
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
      {(showUserMenu || showNotifications || showMobileMenu) && (
        <div 
          className="overlay"
          onClick={() => {
            setShowUserMenu(false);
            setShowNotifications(false);
            setShowMobileMenu(false);
          }}
        ></div>
      )}
    </header>
  );
};

export default Header;
