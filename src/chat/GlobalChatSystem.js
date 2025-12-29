import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import axios from 'axios';
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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showUsers, setShowUsers] = useState(false);
  const [activeTab, setActiveTab] = useState('global'); // 'global' or 'private'
  const [privateSearchQuery, setPrivateSearchQuery] = useState('');
  const [privateUsers, setPrivateUsers] = useState([]);
  const [privateConversations, setPrivateConversations] = useState([]);
  const [selectedPrivateConversation, setSelectedPrivateConversation] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [privateMessageInput, setPrivateMessageInput] = useState('');
  const [privateView, setPrivateView] = useState('search'); // 'search', 'conversations', 'chat'

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
      setActiveUsers(users.filter(u => u.userId !== userId));
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
  }, [userId, token, username, profilePicture]);

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

  const toggleChat = () => {
    if (isChatOpen) {
      setIsClosing(true);
      setIsChatOpen(false);
      setTimeout(() => {
        setIsClosing(false);
      }, 600);
    } else {
      setIsChatOpen(true);
      setIsMinimized(false);
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

  // Private chat functions
  const searchPrivateUsers = useCallback(async (query) => {
    if (!query.trim()) {
      setPrivateUsers([]);
      return;
    }
    
    try {
      const response = await axios.get(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'x-auth-token': token }
      });
      setPrivateUsers(response.data.filter(u => u.id !== user.id));
    } catch (error) {
      console.error('Error searching users:', error);
    }
  }, [token, user?.id]);

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (privateSearchQuery.trim() !== '') {
        searchPrivateUsers(privateSearchQuery);
      } else {
        setPrivateUsers([]);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [privateSearchQuery, searchPrivateUsers]);

  const startPrivateChat = (targetUser) => {
    setSelectedPrivateConversation(targetUser);
    setPrivateView('chat');
    setPrivateSearchQuery('');
    setPrivateUsers([]);
    loadPrivateMessages(targetUser.id);
    
    // Add to conversations list if not exists
    if (!privateConversations.find(c => c.userId === targetUser.id)) {
      setPrivateConversations(prev => [...prev, {
        userId: targetUser.id,
        username: targetUser.username,
        profilePicture: targetUser.avatar,
        lastMessage: { content: '', createdAt: new Date().toISOString() },
        unreadCount: 0
      }]);
    }
  };

  const loadPrivateMessages = async (userId) => {
    try {
      const response = await axios.get(`/api/messages/conversation/${userId}`, {
        headers: { 'x-auth-token': token }
      });
      setPrivateMessages(response.data.messages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendPrivateMessage = async (e) => {
    e.preventDefault();
    if (!privateMessageInput.trim() || !selectedPrivateConversation) return;

    try {
      await axios.post('/api/messages', {
        recipientId: selectedPrivateConversation.id,
        content: privateMessageInput,
        subject: 'Chat message'
      }, {
        headers: { 'x-auth-token': token }
      });

      setPrivateMessageInput('');
      loadPrivateMessages(selectedPrivateConversation.id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const backToPrivateConversations = () => {
    setPrivateView('conversations');
    setSelectedPrivateConversation(null);
    setPrivateMessages([]);
  };

  const backToPrivateSearch = () => {
    setPrivateView('search');
    setPrivateConversations([]);
  };

  if (!user || !token) {
    return null;
  }

  return (
    <>
      <label className="chat-toggle-switch">
        <input 
          className="chat-toggle-input" 
          type="checkbox" 
          role="switch"
          checked={isChatOpen}
          onChange={toggleChat}
        />
        <span className="chat-toggle-base-outer"></span>
        <span className="chat-toggle-base-inner"></span>
        <svg className="chat-toggle-base-neon" viewBox="0 0 40 24" width="40px" height="24px">
          <defs>
            <filter id="chat-switch-glow">
              <feGaussianBlur result="coloredBlur" stdDeviation="1"></feGaussianBlur>
              <feMerge>
                <feMergeNode in="coloredBlur"></feMergeNode>
                <feMergeNode in="SourceGraphic"></feMergeNode>
              </feMerge>
            </filter>
            <linearGradient id="chat-switch-gradient1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(168,90%,70%)" />
              <stop offset="100%" stopColor="hsl(123,90%,70%)" />
            </linearGradient>
            <linearGradient id="chat-switch-gradient2" x1="0.7" y1="0" x2="0.3" y2="1">
              <stop offset="25%" stopColor="hsla(168,90%,70%,0)" />
              <stop offset="50%" stopColor="hsla(168,90%,70%,0.3)" />
              <stop offset="100%" stopColor="hsla(123,90%,70%,0.3)" />
            </linearGradient>
          </defs>
          <path fill="none" filter="url(#chat-switch-glow)" stroke="url(#chat-switch-gradient1)" strokeWidth="1" strokeDasharray="0 104.26 0" strokeDashoffset="0.01" strokeLinecap="round" d="m.5,12C.5,5.649,5.649.5,12,.5h16c6.351,0,11.5,5.149,11.5,11.5s-5.149,11.5-11.5,11.5H12C5.649,23.5.5,18.351.5,12Z"/>
        </svg>
        <span className="chat-toggle-knob-shadow"></span>
        <span className="chat-toggle-knob-container">
          <span className="chat-toggle-knob">
            <svg className="chat-toggle-knob-neon" viewBox="0 0 48 48" width="48px" height="48px">
              <circle fill="none" stroke="url(#chat-switch-gradient2)" strokeDasharray="0 90.32 0 54.19" strokeLinecap="round" strokeWidth="1" r="23" cx="24" cy="24" transform="rotate(-112.5,24,24)" />
            </svg>	
          </span>
        </span>
        <span className="chat-toggle-led"></span>
        {unreadCount > 0 && (
          <span className="chat-toggle-badge">{unreadCount}</span>
        )}
      </label>

      {(isChatOpen || isClosing) && (
      <div className={`global-chat-container ${isMinimized ? 'minimized' : ''} ${isClosing ? 'closing' : ''}`}>
      <div className="chat-header" onClick={toggleMinimize}>
        <div className="chat-header-left">
          <div className="chat-tabs">
            <button 
              className={`chat-tab ${activeTab === 'global' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('global');
              }}
            >
              Global
            </button>
            <button 
              className={`chat-tab ${activeTab === 'private' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('private');
              }}
            >
              Private
            </button>
          </div>
          {isMinimized && unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </div>
        <div className="chat-header-right">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢' : '🔴'}
          </span>
          <span 
            className="online-count"
            style={{ visibility: activeTab === 'global' ? 'visible' : 'hidden' }}
          >
            {activeUsers.length + 1} online
          </span>
          <button
            className={`toggle-users-btn ${showUsers ? 'active' : ''}`}
            style={{ visibility: activeTab === 'global' ? 'visible' : 'hidden' }}
            onClick={(event) => {
              event.stopPropagation();
              if (activeTab === 'global') {
                setShowUsers(prev => !prev);
              }
            }}
          >
            {showUsers ? 'Hide users' : 'Users'}
          </button>
        </div>
      </div>
      
      {!isMinimized && (
        <>
          {activeTab === 'global' ? (
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
          ) : (
            <div className="private-messages-tab">
              {privateView === 'search' && (
                <div className="private-search-container">
                  <h3>Start Private Chat</h3>
                  <input
                    type="text"
                    placeholder="Enter username..."
                    value={privateSearchQuery}
                    onChange={(e) => setPrivateSearchQuery(e.target.value)}
                    className="private-search-input"
                  />
                  {privateSearchQuery.trim() && privateUsers.length > 0 && (
                    <div className="private-users-list">
                      {privateUsers.map(user => (
                        <div key={user.id} className="private-user-item">
                          <img 
                            {...getOptimizedImageProps(
                              user.avatar || '/placeholder-avatar.png',
                              { size: 36 }
                            )}
                            alt={user.username}
                            className="private-user-avatar"
                          />
                          <span className="private-user-name">{user.username}</span>
                          <button 
                            className="start-chat-btn"
                            onClick={() => startPrivateChat(user)}
                          >
                            Chat
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {privateSearchQuery.trim() && privateUsers.length === 0 && (
                    <p className="no-users-found">No users found</p>
                  )}
                  {privateConversations.length > 0 && (
                    <button 
                      className="view-conversations-btn"
                      onClick={() => setPrivateView('conversations')}
                    >
                      View Conversations ({privateConversations.length})
                    </button>
                  )}
                </div>
              )}

              {privateView === 'conversations' && (
                <div className="private-conversations-container">
                  <div className="private-conversations-header">
                    <button className="back-btn" onClick={backToPrivateSearch}>
                      ← Back
                    </button>
                    <h3>Conversations</h3>
                  </div>
                  <div className="private-conversations-list">
                    {privateConversations.map(conv => (
                      <div 
                        key={conv.userId}
                        className="private-conversation-item"
                        onClick={() => {
                          setSelectedPrivateConversation({
                            id: conv.userId,
                            username: conv.username,
                            profilePicture: conv.profilePicture
                          });
                          setPrivateView('chat');
                          loadPrivateMessages(conv.userId);
                        }}
                      >
                        <img 
                          {...getOptimizedImageProps(
                            conv.profilePicture || '/placeholder-avatar.png',
                            { size: 40 }
                          )}
                          alt={conv.username}
                          className="private-conv-avatar"
                        />
                        <div className="private-conv-info">
                          <span className="private-conv-name">{conv.username}</span>
                          <p className="private-conv-preview">
                            {conv.lastMessage.content.substring(0, 30)}
                            {conv.lastMessage.content.length > 30 ? '...' : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {privateView === 'chat' && selectedPrivateConversation && (
                <div className="private-chat-container">
                  <div className="private-chat-header">
                    <button className="back-btn" onClick={backToPrivateConversations}>
                      ← Back
                    </button>
                    <div className="private-chat-user-info">
                      <img 
                        {...getOptimizedImageProps(
                          selectedPrivateConversation.profilePicture || '/placeholder-avatar.png',
                          { size: 32 }
                        )}
                        alt={selectedPrivateConversation.username}
                        className="private-chat-avatar"
                      />
                      <span>{selectedPrivateConversation.username}</span>
                    </div>
                  </div>
                  <div className="private-messages-area">
                    {privateMessages.map(message => {
                      const isOwn = message.senderId === user.id;
                      return (
                        <div 
                          key={message.id}
                          className={`private-message ${isOwn ? 'own' : 'other'}`}
                        >
                          <div className="private-message-bubble">
                            <p>{message.content}</p>
                            <span className="private-message-time">
                              {formatTime(message.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <form className="private-message-input-form" onSubmit={sendPrivateMessage}>
                    <input
                      type="text"
                      value={privateMessageInput}
                      onChange={(e) => setPrivateMessageInput(e.target.value)}
                      placeholder="Type a message..."
                      className="private-message-input"
                    />
                    <button 
                      type="submit" 
                      className="private-send-btn"
                      disabled={!privateMessageInput.trim()}
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
    )}
    </>
  );
};

export default GlobalChatSystem;
