import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import io from 'socket.io-client';
import { placeholderImages, getOptimizedImageProps } from '../utils/placeholderImage';
import { useLanguage } from '../i18n/LanguageContext';
import { getUserDisplayName } from '../utils/userDisplay';
import './MessagesPage.css';

const MessagesPage = () => {
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState([]);
  const { t } = useLanguage();

  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');

  const fetchConversations = useCallback(async () => {
    try {
      const response = await axios.get('/api/messages', {
        headers: { 'x-auth-token': token }
      });
      
      // Group messages by conversation
      const messageData = response.data.messages || response.data;
      const conversationMap = new Map();
      
      messageData.forEach(message => {
        const otherUserId = message.senderId === currentUserId ? message.recipientId : message.senderId;
        const otherUsername = message.senderId === currentUserId ? message.recipientUsername : message.senderUsername;
        
        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            userId: otherUserId,
            username: otherUsername,
            lastMessage: message,
            unreadCount: 0
          });
        }
        
        const conversation = conversationMap.get(otherUserId);
        if (new Date(message.createdAt) > new Date(conversation.lastMessage.createdAt)) {
          conversation.lastMessage = message;
        }
        
        if (message.recipientId === currentUserId && !message.read) {
          conversation.unreadCount++;
        }
      });
      
      setConversations(Array.from(conversationMap.values()));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setLoading(false);
    }
  }, [token, currentUserId]);

  const searchUsers = useCallback(async (query) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }
    
    try {
      const response = await axios.get(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'x-auth-token': token }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  }, [token]);

  // Socket.io for online status
  useEffect(() => {
    if (!token || !currentUserId) return;

    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:5000'
      : window.location.origin;
    
    const socket = io(socketUrl, {
      auth: { token }
    });

    socket.on('connect', () => {
      // Join chat to be added to activeUsers
      socket.emit('join-chat', {
        userId: currentUserId,
        username: localStorage.getItem('username'),
        profilePicture: localStorage.getItem('profilePicture')
      });
      
      // Also join for private messages
      socket.emit('join-conversation', { userId: currentUserId });
    });

    socket.on('active-users', (users) => {
      console.log('Active users received:', users);
      setActiveUsers(users || []);
    });

    socket.on('new-private-message', (message) => {
      console.log('New private message received:', message);
      // Refresh conversations when new message arrives
      fetchConversations();
    });

    return () => {
      socket.disconnect();
    };
  }, [token, currentUserId, fetchConversations]);

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim() !== '') {
        searchUsers(searchQuery);
      } else {
        setUsers([]);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchUsers]);

  const startNewConversation = (user) => {
    // Navigate to conversation page when user clicks on a user from search
    window.location.href = `/messages/${user.id}`;
  };

  useEffect(() => {
    if (token) {
      fetchConversations();
    }
  }, [fetchConversations, token]);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return t('now');
    if (diffInMinutes < 60) return `${diffInMinutes}${t('minutesAgo')}`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}${t('hoursAgo')}`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}${t('daysAgo')}`;
    return date.toLocaleDateString();
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
    user.id !== currentUserId
  );

  return (
    <div className="messages-page">
      {!token ? (
        <div className="login-required">
          <h2>{t('loginRequired')}</h2>
          <p>{t('loginToAccessMessages')}</p>
          <Link to="/login" className="login-btn">{t('login')}</Link>
        </div>
      ) : (
      <div className="messages-container-single">
        <div className="messages-header">
          <h1>💬 {t('messages')}</h1>
        </div>

        <div className="search-panel">
          <div className="search-header">
            <h3>✉️ {t('newMessage') || 'New Message'}</h3>
          </div>
          <input
            type="text"
            placeholder={t('searchUsers')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="user-search-input"
          />
          {searchQuery.trim() !== '' && (
            <div className="users-list">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  className="user-item"
                  onClick={() => startNewConversation(user)}
                >
                  <img
                    {...getOptimizedImageProps(placeholderImages.userSmall, { size: 40 })}
                    alt={getUserDisplayName(user)}
                    className="user-avatar"
                  />
                  <span className="user-name">{getUserDisplayName(user)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="conversations-list">
          {loading ? (
            <div className="loading">{t('loading')}</div>
          ) : conversations.length > 0 ? (
            conversations.map(conversation => (
              <Link
                key={conversation.userId}
                to={`/messages/${conversation.userId}`}
                className="conversation-card"
              >
                <div className="conversation-avatar-wrapper">
                  <img 
                    {...getOptimizedImageProps(placeholderImages.userSmall, { size: 56 })}
                    alt={getUserDisplayName(conversation)}
                    className="conversation-avatar"
                  />
                  <span className={`user-online-status ${activeUsers.some(u => u.userId === conversation.userId) ? 'online' : 'offline'}`}></span>
                </div>
                <div className="conversation-content">
                  <div className="conversation-top">
                    <span className="conversation-name">{getUserDisplayName(conversation)}</span>
                    <span className="conversation-time">
                      {formatTime(conversation.lastMessage.createdAt)}
                    </span>
                  </div>
                  <div className="conversation-bottom">
                    <p className="last-message">
                      {conversation.lastMessage.content.length > 50 
                        ? conversation.lastMessage.content.substring(0, 50) + '...'
                        : conversation.lastMessage.content
                      }
                    </p>
                    {conversation.unreadCount > 0 && (
                      <span className="unread-badge">{conversation.unreadCount}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h3>{t('noConversations')}</h3>
              <p>{t('startSearching')}</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default MessagesPage;
