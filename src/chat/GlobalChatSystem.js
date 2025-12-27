import React, { useState, useEffect, useRef, useContext } from 'react';
import io from 'socket.io-client';
import { AuthContext } from '../auth/AuthContext';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import './GlobalChatSystem.css';

const GlobalChatSystem = () => {
  const { user, token } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUsers, setShowUsers] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const chatContainerRef = useRef(null);
  const socketRef = useRef(null);
  const userIdRef = useRef(null);
  const isMinimizedRef = useRef(true);


  const sanitizeProfilePicture = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:')) return null;
    if (trimmed.length > 2048) return null;
    return trimmed;
  };

  const resolveSocketUrl = () => {
    const envUrl = process.env.REACT_APP_SOCKET_URL;
    if (typeof window !== 'undefined') {
      if (envUrl) return envUrl;
      const { hostname, port, protocol, origin } = window.location;
      if (port === '3000') {
        return `${protocol}//${hostname}:5001`;
      }
      return origin;
    }
    return envUrl || 'http://localhost:5001';
  };

  // Extract stable values to prevent reconnection loops
  const userId = user?.id;
  const username = user?.username;
  const profilePicture = user?.profilePicture;

  useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  useEffect(() => {
    if (!userId || !token) return;

    // Prevent reconnection if already connected with same user
    if (socketRef.current && userIdRef.current === userId) {
      return;
    }

    // Clean up existing socket if user changed
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    userIdRef.current = userId;

    // Connect to Socket.io server
    const newSocket = io(resolveSocketUrl(), {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Connected to chat server');
      setIsConnected(true);

      // Join chat with user info
      newSocket.emit('join-chat', {
        userId,
        username,
        profilePicture: sanitizeProfilePicture(profilePicture)
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from chat server:', reason);
      setIsConnected(false);
      setSocket(null);
    });

    newSocket.on('connect_error', (error) => {
      console.warn('Chat connection error:', error?.message || error);
      setIsConnected(false);
      setSocket(null);
    });

    // Handle incoming messages
    newSocket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
      
      // Increment unread count if minimized
      if (isMinimizedRef.current && message.userId !== userId) {
        setUnreadCount(prev => prev + 1);
      }
      
      // Auto-scroll to bottom
      scrollToBottom();
    });

    // Handle message history
    newSocket.on('message-history', (history) => {
      setMessages(history);
      scrollToBottom();
    });

    // Handle active users
    newSocket.on('active-users', (users) => {
      setActiveUsers(users.filter(u => u.userId !== user.id));
    });

    // Handle user joined
    newSocket.on('user-joined', (userData) => {
      setActiveUsers(prev => [...prev, userData]);
    });

    // Handle user left
    newSocket.on('user-left', (userData) => {
      setActiveUsers(prev => prev.filter(u => u.userId !== userData.userId));
      setTypingUsers(prev => {
        const updated = new Map(prev);
        updated.delete(userData.userId);
        return updated;
      });
    });

    // Handle typing indicator
    newSocket.on('user-typing', ({ userId, username, isTyping }) => {
      setTypingUsers(prev => {
        const updated = new Map(prev);
        if (isTyping) {
          updated.set(userId, username);
        } else {
          updated.delete(userId);
        }
        return updated;
      });
    });

    // Handle reactions
    newSocket.on('reaction-added', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, reactions } : msg
      ));
    });

    setSocket(newSocket);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [userId, token]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !socket || !isConnected) return;
    
    socket.emit('send-message', {
      text: inputMessage.trim()
    });
    
    setInputMessage('');
  };

  const handleTyping = () => {
    if (!socket) return;
    
    socket.emit('typing', true);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', false);
    }, 1000);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (isMinimized) {
      setUnreadCount(0);
      scrollToBottom();
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    }
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getReactionCounts = (reactions) => {
    if (!reactions || reactions.length === 0) return {};
    
    const counts = {};
    reactions.forEach(reaction => {
      if (!counts[reaction.emoji]) {
        counts[reaction.emoji] = [];
      }
      counts[reaction.emoji].push(reaction.username);
    });
    
    return counts;
  };

  if (!user || !token) {
    return null;
  }

  return (
    <div className={`global-chat-container ${isMinimized ? 'minimized' : ''}`}>
      <div className="chat-header" onClick={toggleMinimize}>
        <div className="chat-header-left">
          <span className="chat-icon">💬</span>
          <h3>Global Chat</h3>
          {isMinimized && unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </div>
        <div className="chat-header-right">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢' : '🔴'}
          </span>
          <span className="online-count">{activeUsers.length + 1} online</span>
          <button
            className={`toggle-users-btn ${showUsers ? 'active' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              setShowUsers(prev => !prev);
            }}
          >
            {showUsers ? 'Hide users' : 'Users'}
          </button>
          <button
            className="minimize-btn"
            onClick={(event) => {
              event.stopPropagation();
              toggleMinimize();
            }}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
        </div>
      </div>
      
      {!isMinimized && (
        <>
          <div className="chat-body" ref={chatContainerRef}>
            <div className="messages-container">
              {messages.map((message) => {
                const isOwn = message.userId === user.id;
                const reactionCounts = getReactionCounts(message.reactions);
                const hasReactions = Object.keys(reactionCounts).length > 0;
                const authorLabel = message.username || (isOwn ? (username || 'Ty') : 'Unknown');
                
                return (
                  <div key={message.id} className={`message ${isOwn ? 'own' : 'other'}`}>
                    {!isOwn && (
                      <img 
                        {...getOptimizedImageProps(
                          message.profilePicture || '/placeholder-avatar.png',
                          { size: 36 }
                        )}
                        alt={message.username}
                        className="message-avatar"
                      />
                    )}
                    <div className="message-content">
                      <span className="message-author">{authorLabel}</span>
                      <div className="message-bubble">
                        <p className="message-text">{message.text}</p>
                      </div>
                      <span className="message-time">{formatTime(message.timestamp)}</span>
                      
                      {/* Reactions */}
                      {hasReactions && (
                        <div className="message-reactions">
                          {Object.entries(reactionCounts).map(([emoji, users]) => (
                            <div 
                              key={emoji} 
                              className="reaction-pill"
                              title={users.join(', ')}
                            >
                              <span>{emoji}</span>
                              <span className="reaction-count">{users.length}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Typing Indicator */}
              {typingUsers.size > 0 && (
                <div className="typing-indicator">
                  <span className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                  <span className="typing-text">
                    {Array.from(typingUsers.values()).join(', ')} typing...
                  </span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Active Users Sidebar */}
            {showUsers && (
              <div className="active-users-sidebar">
                <h4>Online Users</h4>
                <div className="users-list">
                  <div className="user-item current-user">
                    <img 
                      {...getOptimizedImageProps(
                        user.profilePicture || '/placeholder-avatar.png',
                        { size: 28 }
                      )}
                      alt={user.username}
                    />
                    <span>{user.username} (You)</span>
                  </div>
                  {activeUsers.map(activeUser => (
                    <div key={activeUser.userId} className="user-item">
                      <img 
                        {...getOptimizedImageProps(
                          activeUser.profilePicture || '/placeholder-avatar.png',
                          { size: 28 }
                        )}
                        alt={activeUser.username}
                      />
                      <span>{activeUser.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value);
                handleTyping();
              }}
              placeholder="Type a message..."
              className="chat-input"
              disabled={!isConnected}
            />
            <button 
              type="submit" 
              className="send-btn"
              disabled={!isConnected || !inputMessage.trim()}
            >
              <span>Send</span>
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default GlobalChatSystem;
