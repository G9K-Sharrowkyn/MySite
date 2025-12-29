import React, { useState, useEffect, useCallback } from 'react';
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

  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');

  const fetchMessages = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await axios.get(`/api/messages/conversation/${userId}`, {
        headers: { 'x-auth-token': token }
      });
      
      setMessages(response.data.messages || []);
      if (response.data.otherUser) {
        setOtherUser(response.data.otherUser);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await axios.post('/api/messages', {
        recipientId: userId,
        content: newMessage
      }, {
        headers: { 'x-auth-token': token }
      });

      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
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

        <div className="messages-area">
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
