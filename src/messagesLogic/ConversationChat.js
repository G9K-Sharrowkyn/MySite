import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link, useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
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
  const socketRef = useRef(null);

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

  // Setup Socket.IO for real-time messages
  useEffect(() => {
    if (!token || !currentUserId) {
      console.error('ConversationChat: Missing token or currentUserId', { token: !!token, currentUserId });
      return;
    }

    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:5000'
      : window.location.origin;
    
    console.log('ConversationChat: Creating socket connection to:', socketUrl);
    console.log('ConversationChat: Token:', token?.substring(0, 20) + '...');
    console.log('ConversationChat: CurrentUserId:', currentUserId);
    
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('ConversationChat: Connected to socket with ID:', socket.id);
      console.log('ConversationChat: Emitting join-conversation with userId:', currentUserId);
      socket.emit('join-conversation', { userId: currentUserId });
    });

    socket.on('new-private-message', (message) => {
      console.log('ConversationChat: Received new-private-message:', message);
      // Only add message if it's part of this conversation
      if ((message.senderId === userId && message.recipientId === currentUserId) ||
          (message.senderId === currentUserId && message.recipientId === userId)) {
        console.log('ConversationChat: Adding message to state');
        setMessages(prev => [...prev, message]);
      } else {
        console.log('ConversationChat: Message not for this conversation');
      }
    });

    socket.on('connect_error', (error) => {
      console.error('ConversationChat: Socket connection error:', error);
    });

    return () => {
      console.log('ConversationChat: Disconnecting socket');
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token, currentUserId, userId]);

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
