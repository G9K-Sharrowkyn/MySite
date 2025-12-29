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
  const [privateView, setPrivateView] = useState('conversations'); // 'search', 'conversations', 'chat'
  const [showNewMessageNotification, setShowNewMessageNotification] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const chatContainerRef = useRef(null);
  const socketRef = useRef(null);
  const userIdRef = useRef(null);
  const isMinimizedRef = useRef(true);
  const selectedConversationRef = useRef(null);
  const privateMessagesContainerRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    selectedConversationRef.current = selectedPrivateConversation;
  }, [selectedPrivateConversation]);

  // Auto-scroll private messages when new message arrives
  useEffect(() => {
    if (privateMessages.length === 0) return;
    
    // If user is near bottom, auto-scroll
    if (isNearBottom()) {
      scrollPrivateToBottom(true);
    } else {
      // User is reading old messages, show notification
      setShowNewMessageNotification(true);
    }
  }, [privateMessages]);

  // Scroll global chat to bottom when opened
  useEffect(() => {
    if (isChatOpen && !isMinimized && activeTab === 'global' && messages.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [isChatOpen, isMinimized, activeTab]);

  const loadExistingConversations = useCallback(async (changeView = true) => {
    try {
      const response = await axios.get('/api/messages', {
        headers: { 'x-auth-token': token }
      });
      
      const currentUserId = localStorage.getItem('userId');
      const messageData = response.data.messages || response.data;
      const conversationMap = new Map();
      
      messageData.forEach(message => {
        const otherUserId = message.senderId === currentUserId ? message.recipientId : message.senderId;
        const otherUsername = message.senderId === currentUserId ? message.recipientUsername : message.senderUsername;
        
        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            userId: otherUserId,
            username: otherUsername,
            profilePicture: null,
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
      
      const conversationsList = Array.from(conversationMap.values())
        .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
      
      setPrivateConversations(conversationsList);
      
      // Only change view if explicitly requested
      if (changeView) {
        setPrivateView('conversations');
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      // Even on error, show conversations view only if requested
      if (changeView) {
        setPrivateView('conversations');
      }
    }
  }, [token]);

  // Load existing conversations when Private tab is opened
  useEffect(() => {
    if (activeTab === 'private' && isChatOpen && token) {
      loadExistingConversations();
    }
  }, [activeTab, isChatOpen, token, loadExistingConversations]);


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
      
      // Also join for private messages
      console.log('GlobalChatSystem: Emitting join-conversation with userId:', userId);
      newSocket.emit('join-conversation', { userId });
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

    // Handle new private messages
    newSocket.on('new-private-message', (message) => {
      console.log('GlobalChatSystem: Received new-private-message:', message);
      
      const currentConversation = selectedConversationRef.current;
      const currentUserId = userIdRef.current;
      
      // If currently in a private chat with this user, add message to view
      if (currentConversation && 
          (message.senderId === currentConversation.id || 
           message.recipientId === currentConversation.id ||
           message.senderId === currentConversation.userId || 
           message.recipientId === currentConversation.userId)) {
        console.log('GlobalChatSystem: Adding message to privateMessages');
        setPrivateMessages(prev => [...prev, message]);
      }
      
      // Refresh conversations list to show new message WITHOUT changing view
      loadExistingConversations(false);
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

  const isNearBottom = () => {
    const container = privateMessagesContainerRef.current;
    if (!container) return true;
    
    const threshold = 150; // pixels from bottom
    const position = container.scrollHeight - container.scrollTop - container.clientHeight;
    return position < threshold;
  };

  const scrollPrivateToBottom = (smooth = true) => {
    const container = privateMessagesContainerRef.current;
    if (!container) return;
    
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
    setShowNewMessageNotification(false);
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
      // Scroll to bottom after loading messages
      setTimeout(() => scrollPrivateToBottom(false), 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendPrivateMessage = async (e) => {
    e.preventDefault();
    if (!privateMessageInput.trim() || !selectedPrivateConversation) return;

    const messageContent = privateMessageInput;
    setPrivateMessageInput(''); // Clear immediately

    try {
      const response = await axios.post('/api/messages', {
        recipientId: selectedPrivateConversation.id,
        content: messageContent,
        subject: 'Chat message'
      }, {
        headers: { 'x-auth-token': token }
      });

      // Add message immediately to state
      if (response.data.message) {
        setPrivateMessages(prev => [...prev, response.data.message]);
      }
      
      // Scroll to bottom after sending
      setTimeout(() => scrollPrivateToBottom(true), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setPrivateMessageInput(messageContent); // Restore on error
    }
  };

  const backToPrivateConversations = () => {
    setPrivateView('conversations');
    setSelectedPrivateConversation(null);
    setPrivateMessages([]);
  };

  if (!user || !token) {
    return null;
  }

  return (
    <>
      <div className="chat-toggle-wrapper">
        <span className="chat-toggle-label">Chat</span>
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
        {activeTab === 'global' && <span className="chat-toggle-led"></span>}
        {unreadCount > 0 && (
          <span className="chat-toggle-badge">{unreadCount}</span>
        )}
      </label>
      </div>

      {(isChatOpen || isClosing) && (
      <div className={`global-chat-container ${isMinimized ? 'minimized' : ''} ${isClosing ? 'closing' : ''}`}>
      <div className="chat-header">
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
          {activeTab === 'global' && (
            <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢' : '🔴'}
            </span>
          )}
          <span 
            className="online-count"
            style={{ display: activeTab === 'global' ? 'block' : 'none' }}
          >
            {activeUsers.length + 1} online
          </span>
          <button
            className={`toggle-users-btn ${showUsers ? 'active' : ''}`}
            style={{ display: activeTab === 'global' ? 'block' : 'none' }}
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
              {privateView === 'conversations' && (
                <div className="private-combined-container">
                  <div className="private-search-section">
                    <h3>Start New Chat</h3>
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
                  </div>

                  {privateConversations.length > 0 && (
                    <div className="private-conversations-section">
                      <h3>Your Conversations</h3>
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
                          <div className="private-conv-name-row">
                            <span className="private-conv-name">{conv.username}</span>
                            <span className={`user-online-status ${activeUsers.some(u => u.username === conv.username) ? 'online' : 'offline'}`}></span>
                          </div>
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
                          { size: 32, lazy: false, fetchPriority: 'high', decoding: 'sync' }
                        )}
                        alt={selectedPrivateConversation.username}
                        className="private-chat-avatar"
                      />
                      <span>{selectedPrivateConversation.username}</span>
                      <span className={`user-online-status ${activeUsers.some(u => u.username === selectedPrivateConversation.username) ? 'online' : 'offline'}`}></span>
                    </div>
                  </div>
                  <div className="private-messages-area" ref={privateMessagesContainerRef}>
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
                  {showNewMessageNotification && (
                    <div className="new-message-notification" onClick={() => scrollPrivateToBottom(true)}>
                      <span>↓ New message</span>
                    </div>
                  )}
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
