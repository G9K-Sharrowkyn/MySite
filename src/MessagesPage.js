import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import { replacePlaceholderUrl, placeholderImages } from './utils/placeholderImage';
import './MessagesPage.css';

const MessagesPage = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');

  useEffect(() => {
    if (token) {
      fetchConversations();
      
      // Check if there's a 'to' parameter in URL and start conversation
      const toUserId = searchParams.get('to');
      const toUsername = searchParams.get('username');
      if (toUserId && toUsername) {
        const user = {
          id: toUserId,
          username: toUsername
        };
        startConversationWithUser(user);
        setShowNewMessage(false); // Hide new message panel if open
      }
    }
  }, [token, searchParams]);

  const fetchConversations = async () => {
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
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }
    
    try {
      const response = await axios.get(`/api/profile/search?query=${encodeURIComponent(query)}`, {
        headers: { 'x-auth-token': token }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (showNewMessage && searchQuery.trim() !== '') {
        searchUsers(searchQuery);
      } else {
        setUsers([]);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, showNewMessage]);

  const fetchConversation = async (userId) => {
    try {
      const response = await axios.get(`/api/messages/conversation/${userId}`, {
        headers: { 'x-auth-token': token }
      });
      setMessages(response.data.messages);
      setSelectedConversation(response.data.otherUser);
      
      // Update conversation list to mark as read
      fetchConversations();
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      await axios.post('/api/messages', {
        recipientId: selectedConversation.id,
        content: newMessage,
        subject: 'Chat message'
      }, {
        headers: { 'x-auth-token': token }
      });

      setNewMessage('');
      fetchConversation(selectedConversation.id);
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const startConversationWithUser = (user) => {
    setSelectedConversation(user);
    fetchConversation(user.id);
  };

  const startNewConversation = (user) => {
    setSelectedConversation(user);
    setMessages([]);
    setShowNewMessage(false);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Teraz';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d`;
    return date.toLocaleDateString();
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
    user.id !== currentUserId
  );

  if (!token) {
    return (
      <div className="messages-page">
        <div className="login-required">
          <h2>🔐 Logowanie wymagane</h2>
          <p>Musisz być zalogowany, aby korzystać z wiadomości.</p>
          <Link to="/login" className="login-btn">Zaloguj się</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-page">
      <div className="messages-container">
        {/* Conversations Sidebar */}
        <div className="conversations-sidebar">
          <div className="sidebar-header">
            <h2>💬 Wiadomości</h2>
            <button
              className="new-message-btn"
              onClick={() => {
                if (showNewMessage) {
                  setSearchQuery('');
                  setUsers([]);
                }
                setShowNewMessage(!showNewMessage);
              }}
            >
              ✏️
            </button>
          </div>

          {showNewMessage && (
            <div className="new-message-panel">
              <div className="search-users">
                <input
                  type="text"
                  placeholder="Szukaj użytkowników..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="user-search-input"
                />
              </div>
          <div className="users-list">
            {searchQuery.trim() !== '' ? (
              filteredUsers.map(user => (
                <div
                  key={user.id}
                  className="user-item"
                  onClick={() => startNewConversation(user)}
                >
                  <img
                    src={placeholderImages.userSmall}
                    alt={user.username}
                    className="user-avatar"
                  />
                  <span className="user-name">{user.username}</span>
                </div>
              ))
            ) : (
              <p className="no-users-message">Wpisz nazwę użytkownika, aby wyszukać</p>
            )}
          </div>
            </div>
          )}

          <div className="conversations-list">
            {loading ? (
              <div className="loading">Ładowanie...</div>
            ) : conversations.length > 0 ? (
              conversations.map(conversation => (
                <div 
                  key={conversation.userId}
                  className={`conversation-item ${selectedConversation?.id === conversation.userId ? 'active' : ''}`}
                  onClick={() => fetchConversation(conversation.userId)}
                >
                  <img 
                    src={placeholderImages.userSmall} 
                    alt={conversation.username}
                    className="conversation-avatar"
                  />
                  <div className="conversation-info">
                    <div className="conversation-header">
                      <span className="conversation-name">{conversation.username}</span>
                      <span className="conversation-time">
                        {formatTime(conversation.lastMessage.createdAt)}
                      </span>
                    </div>
                    <div className="conversation-preview">
                      <span className="last-message">
                        {conversation.lastMessage.content.length > 50 
                          ? conversation.lastMessage.content.substring(0, 50) + '...'
                          : conversation.lastMessage.content
                        }
                      </span>
                      {conversation.unreadCount > 0 && (
                        <span className="unread-badge">{conversation.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-conversations">
                <p>Brak konwersacji</p>
                <p>Kliknij ✏️ aby rozpocząć nową</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="chat-area">
          {selectedConversation ? (
            <>
              <div className="chat-header">
                <Link 
                  to={`/profile/${selectedConversation.id}`}
                  className="chat-user-info"
                >
                  <img 
                    src={replacePlaceholderUrl(selectedConversation.profilePicture) || placeholderImages.userSmall} 
                    alt={selectedConversation.username}
                    className="chat-avatar"
                  />
                  <span className="chat-username">{selectedConversation.username}</span>
                </Link>
              </div>

              <div className="messages-area">
                {messages.length > 0 ? (
                  messages.map(message => (
                    <div 
                      key={message.id}
                      className={`message ${message.senderId === currentUserId ? 'sent' : 'received'}`}
                    >
                      <div className="message-content">
                        {message.content}
                      </div>
                      <div className="message-time">
                        {formatTime(message.createdAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-messages">
                    <p>Brak wiadomości</p>
                    <p>Napisz pierwszą wiadomość!</p>
                  </div>
                )}
              </div>

              <form onSubmit={sendMessage} className="message-input-form">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Napisz wiadomość..."
                  className="message-input"
                />
                <button type="submit" className="send-btn" disabled={!newMessage.trim()}>
                  📤
                </button>
              </form>
            </>
          ) : (
            <div className="no-chat-selected">
              <div className="welcome-message">
                <h3>💬 Witaj w wiadomościach!</h3>
                <p>Wybierz konwersację z lewej strony lub rozpocznij nową</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;