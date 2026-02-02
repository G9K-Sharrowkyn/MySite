import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import axios from 'axios';
import './MessagingSystem.css';

const MessagingSystem = ({ user }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isComposing, setIsComposing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typing, setTyping] = useState({});
  const messagesEndRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = useCallback(async () => {
    try {
      const userId = user?.id;
      if (!userId) return;
      const response = await axios.get(`/api/messages/conversations/${userId}`);
      setConversations(response.data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [user?.id]);

  const handleNewMessage = useCallback((message) => {
    if (activeConversation && message.conversationId === activeConversation.id) {
      setMessages(prev => [...prev, message]);
    }
    
    // Update conversation list
    setConversations(prev => 
      prev.map(conv => 
        conv.id === message.conversationId 
          ? { ...conv, lastMessage: message, unreadCount: conv.unreadCount + 1 }
          : conv
      )
    );
  }, [activeConversation]);

  const setupWebSocket = useCallback(() => {
    const userId = user?.id;
    if (!userId) return;
    const socket = new WebSocket(`ws://localhost:8080/messages?userId=${userId}`);
    
    socket.onopen = () => {
      console.log('Connected to message server');
    };
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'new_message':
          handleNewMessage(data.message);
          break;
        case 'typing_start':
          setTyping(prev => ({ ...prev, [data.userId]: true }));
          break;
        case 'typing_stop':
          setTyping(prev => ({ ...prev, [data.userId]: false }));
          break;
        case 'user_online':
          setOnlineUsers(prev => [...prev.filter(id => id !== data.userId), data.userId]);
          break;
        case 'user_offline':
          setOnlineUsers(prev => prev.filter(id => id !== data.userId));
          break;
        default:
          break;
      }
    };
    
    socket.onclose = () => {
      console.log('Disconnected from message server');
      // Attempt to reconnect after 3 seconds
      setTimeout(setupWebSocket, 3000);
    };

    window.messageSocket = socket;
  }, [handleNewMessage, user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchConversations();
      setupWebSocket();
    }
    return () => {
      if (window.messageSocket) {
        window.messageSocket.close();
      }
    };
  }, [fetchConversations, setupWebSocket, user?.id]);


  const fetchMessages = async (conversationId) => {
    try {
      const response = await axios.get(`/api/messages/conversation/${conversationId}`);
      setMessages(response.data || []);
      
      // Mark messages as read
      await markAsRead(conversationId);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };


  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation) return;

    const messageData = {
      conversationId: activeConversation.id,
      senderId: user.id,
      content: newMessage.trim(),
      timestamp: new Date(),
      type: 'text'
    };

    try {
      const response = await axios.post('/api/messages/send', messageData);
      setMessages(prev => [...prev, response.data]);
      setNewMessage('');
      
      // Send via WebSocket for real-time delivery
      if (window.messageSocket) {
        window.messageSocket.send(JSON.stringify({
          type: 'send_message',
          message: response.data
        }));
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const startConversation = async (recipientId) => {
    try {
      const response = await axios.post('/api/messages/conversations', {
        participants: [user.id, recipientId]
      });
      
      const newConversation = response.data;
      setConversations(prev => [newConversation, ...prev]);
      setActiveConversation(newConversation);
      setIsComposing(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await axios.get(`/api/users/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      await axios.post(`/api/messages/read/${conversationId}`, {
        userId: user.id
      });
      
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleTyping = () => {
    if (window.messageSocket && activeConversation) {
      window.messageSocket.send(JSON.stringify({
        type: 'typing_start',
        conversationId: activeConversation.id
      }));
    }
  };

  const handleStopTyping = () => {
    if (window.messageSocket && activeConversation) {
      window.messageSocket.send(JSON.stringify({
        type: 'typing_stop',
        conversationId: activeConversation.id
      }));
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.abs(now - date) / 36e5;
    
    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  const getOtherParticipant = (conversation) => {
    return conversation.participants.find(p => p.id !== user.id);
  };

  const isUserOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  return (
    <div className="messaging-system">
      <div className="conversations-sidebar">
        <div className="sidebar-header">
          <h2>💬 Messages</h2>
          <button 
            className="compose-btn"
            onClick={() => setIsComposing(true)}
          >
            ✏️ New
          </button>
        </div>

        {isComposing && (
          <div className="compose-section">
            <div className="search-users">
              <input
                type="text"
                placeholder="Search users to message..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                className="user-search-input"
              />
              <button onClick={() => setIsComposing(false)}>Cancel</button>
            </div>
            
            <div className="search-results">
              {searchResults.map(foundUser => (
                <div 
                  key={foundUser.id}
                  className="search-result-item"
                  onClick={() => startConversation(foundUser.id)}
                >
                  <img {...getOptimizedImageProps(foundUser.avatar, { size: 40 })} alt={foundUser.username} />
                  <div className="user-info">
                    <span className="username">{foundUser.username}</span>
                    {foundUser.isModerator && <span className="mod-badge">MOD</span>}
                  </div>
                  <div className="online-indicator">
                    {isUserOnline(foundUser.id) && <span className="online-dot"></span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="conversations-list">
          {conversations.map(conversation => {
            const otherParticipant = getOtherParticipant(conversation);
            return (
              <div 
                key={conversation.id}
                className={`conversation-item ${activeConversation?.id === conversation.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveConversation(conversation);
                  fetchMessages(conversation.id);
                }}
              >
                <div className="participant-avatar">
                  <img {...getOptimizedImageProps(otherParticipant?.avatar, { size: 40 })} alt={otherParticipant?.username} />
                  {isUserOnline(otherParticipant?.id) && (
                    <div className="online-status"></div>
                  )}
                </div>
                
                <div className="conversation-info">
                  <div className="participant-name">
                    {otherParticipant?.username}
                    {otherParticipant?.isModerator && <span className="mod-badge">MOD</span>}
                  </div>
                  <div className="last-message">
                    {conversation.lastMessage?.content || 'No messages yet'}
                  </div>
                  <div className="message-time">
                    {conversation.lastMessage && formatTime(conversation.lastMessage.timestamp)}
                  </div>
                </div>
                
                {conversation.unreadCount > 0 && (
                  <div className="unread-badge">
                    {conversation.unreadCount}
                  </div>
                )}
              </div>
            );
          })}
          
          {conversations.length === 0 && !isComposing && (
            <div className="no-conversations">
              <p>No conversations yet</p>
              <button onClick={() => setIsComposing(true)}>
                Start a conversation
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="chat-area">
        {activeConversation ? (
          <>
            <div className="chat-header">
              <div className="participant-info">
                <img 
                  {...getOptimizedImageProps(
                    getOtherParticipant(activeConversation)?.avatar,
                    { size: 40 }
                  )}
                  alt={getOtherParticipant(activeConversation)?.username} 
                />
                <div className="participant-details">
                  <span className="participant-name">
                    {getOtherParticipant(activeConversation)?.username}
                  </span>
                  <span className="participant-status">
                    {isUserOnline(getOtherParticipant(activeConversation)?.id) 
                      ? '🟢 Online' 
                      : '⚫ Offline'
                    }
                  </span>
                </div>
              </div>
              
              <div className="chat-actions">
                <button className="action-btn">📞</button>
                <button className="action-btn">📹</button>
                <button className="action-btn">ℹ️</button>
              </div>
            </div>

            <div className="messages-container">
              {messages.map(message => (
                <div 
                  key={message.id}
                  className={`message ${message.senderId === user.id ? 'sent' : 'received'}`}
                >
                  <div className="message-bubble">
                    <p>{message.content}</p>
                    <span className="message-time">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              
              {/* Typing indicators */}
              {Object.entries(typing).map(([userId, isTyping]) => 
                isTyping && userId !== user.id.toString() && (
                  <div key={userId} className="typing-indicator">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )
              )}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="message-input-area">
              <div className="input-container">
                <button className="attachment-btn">📎</button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onBlur={handleStopTyping}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      sendMessage();
                      handleStopTyping();
                    }
                  }}
                  placeholder="Type a message..."
                  className="message-input"
                />
                <button className="emoji-btn">😊</button>
                <button 
                  className="send-btn"
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                >
                  ➤
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="welcome-content">
              <h3>Welcome to VersusVerseVault Messenger</h3>
              <p>Select a conversation or start a new one to begin chatting</p>
              <div className="quick-actions">
                <button onClick={() => setIsComposing(true)}>
                  Start New Conversation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="online-friends">
        <h4>🟢 Online Friends</h4>
        <div className="online-list">
          {onlineUsers
            .filter(userId => userId !== user.id)
            .slice(0, 10)
            .map(userId => (
              <div 
                key={userId}
                className="online-friend"
                onClick={() => {
                  // Start conversation with this user
                  startConversation(userId);
                }}
              >
                <img {...getOptimizedImageProps(`/avatars/${userId}.jpg`, { size: 32 })} alt="User" />
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
};

export default MessagingSystem;
