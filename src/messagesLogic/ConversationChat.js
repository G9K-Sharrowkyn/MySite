import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { replacePlaceholderUrl, placeholderImages, getOptimizedImageProps } from '../utils/placeholderImage';
import { useLanguage } from '../i18n/LanguageContext';
import './ConversationChat.css';

const ConversationChat = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewMessageNotification, setShowNewMessageNotification] = useState(false);
  
  const messagesContainerRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);

  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');

  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const threshold = 150;
    const position = container.scrollHeight - container.scrollTop - container.clientHeight;
    return position < threshold;
  };

  const scrollToBottom = (smooth = true) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
    setShowNewMessageNotification(false);
  };

  const fetchMessages = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await axios.get(`/api/messages/conversation/${userId}`, {
        headers: { 'x-auth-token': token }
      });
      
      const newMessages = response.data.messages || [];
      
      // Set initial length on first load
      if (messages.length === 0) {
        prevMessagesLengthRef.current = newMessages.length;
      }
      
      setMessages(newMessages);
      if (response.data.otherUser) {
        setOtherUser(response.data.otherUser);
      }
      setLoading(false);
      
      // Only scroll on initial load
      if (messages.length === 0) {
        setTimeout(() => scrollToBottom(false), 100);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
    }
  }, [userId, token, messages.length]);

  // Fetch messages and mark as read
  useEffect(() => {
    fetchMessages();
    
    // Mark messages as read when opening conversation
    if (userId && token) {
      axios.post(`/api/messages/mark-read/${userId}`, {}, {
        headers: { 'x-auth-token': token }
      }).catch(err => console.error('Error marking messages as read:', err));
    }
  }, [userId, token, fetchMessages]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length === 0) return;
    
    // Check if there's actually a NEW message (not just refresh)
    const hasNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    
    // Only auto-scroll if there's a new message
    if (hasNewMessage) {
      // If user is near bottom, auto-scroll
      if (isNearBottom()) {
        setTimeout(() => scrollToBottom(true), 100);
      } else {
        // User is reading old messages, show notification
        setShowNewMessageNotification(true);
      }
    }
  }, [messages]);

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!userId || !token) return;
    
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [userId, token, fetchMessages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageContent = newMessage;
    setNewMessage(''); // Clear immediately for better UX

    try {
      const response = await axios.post('/api/messages', {
        recipientId: userId,
        content: messageContent
      }, {
        headers: { 'x-auth-token': token }
      });
      
      // Add message immediately to state
      if (response.data.message) {
        setMessages(prev => [...prev, response.data.message]);
      }
      
      // Scroll to bottom after sending
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent); // Restore message on error
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (!token) {
    navigate('/login');
    return null;
  }

  return (
    <div className="conversation-chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <button onClick={() => navigate('/messages')} className="back-btn">
            ← {t('back')}
          </button>
          {otherUser && (
            <Link to={`/profile/${otherUser.id}`} className="chat-user-info">
              <img
                {...getOptimizedImageProps(
                  replacePlaceholderUrl(otherUser.profilePicture) || placeholderImages.userSmall,
                  { size: 40 }
                )}
                alt={otherUser.username}
                className="chat-avatar"
              />
              <div className="chat-user-details">
                <span className="chat-username">{otherUser.username}</span>
                <span className="chat-status">{t('clickToViewProfile')}</span>
              </div>
            </Link>
          )}
        </div>

        <div className="messages-area" ref={messagesContainerRef}>
          {loading ? (
            <div className="loading">{t('loading')}</div>
          ) : messages.length > 0 ? (
            messages.map(message => (
              <div
                key={message.id}
                className={`message-bubble ${message.senderId === currentUserId ? 'sent' : 'received'}`}
              >
                <div className="message-content">
                  {message.content}
                </div>
                <div className="message-meta">
                  <span className="message-time">{formatTime(message.createdAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="no-messages">
              <p>{t('noMessages')}</p>
              <p>{t('writeFirstMessage')}</p>
            </div>
          )}
        </div>

        {showNewMessageNotification && (
          <div className="new-message-notification" onClick={() => scrollToBottom(true)}>
            <span>↓ {t('newMessage') || 'New message'}</span>
          </div>
        )}

        <form onSubmit={sendMessage} className="message-input-container">
          <div className="input-wrapper">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={t('writeMessage')}
              className="message-input"
              autoFocus
            />
            <button type="submit" className="send-btn" disabled={!newMessage.trim()}>
              <span className="send-icon">➤</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConversationChat;
