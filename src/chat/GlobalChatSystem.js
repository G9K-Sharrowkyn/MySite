import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './GlobalChatSystem.css';

const GlobalChatSystem = ({ user, socket }) => {
  const [currentRoom, setCurrentRoom] = useState('general');
  const [messages, setMessages] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState({});
  const [isTyping, setIsTyping] = useState({});
  const [chatRooms, setChatRooms] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [chatSettings, setChatSettings] = useState({
    soundEnabled: true,
    autoEmoji: true,
    showTimestamps: true,
    theme: 'dark'
  });
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const { t } = useLanguage();

  // Define chat rooms
  const defaultRooms = [
    {
      id: 'general',
      name: 'General Feed',
      icon: '💬',
      description: 'General discussions about fights and characters',
      color: '#6c757d'
    },
    {
      id: 'help',
      name: 'Help & Support',
      icon: '❓',
      description: 'Get help with platform features',
      color: '#28a745'
    },
    {
      id: 'announcements',
      name: 'Announcements',
      icon: '📢',
      description: 'Official platform announcements',
      color: '#dc3545',
      modOnly: false
    },
    {
      id: 'regular_people',
      name: 'Regular People Division',
      icon: '🧑',
      description: 'Chat for Regular People division members',
      color: '#6c757d'
    },
    {
      id: 'metahuman',
      name: 'Metahuman Division',
      icon: '🦸',
      description: 'Chat for Metahuman division members',
      color: '#28a745'
    },
    {
      id: 'planet_busters',
      name: 'Planet Busters Division',
      icon: '💥',
      description: 'Chat for Planet Busters division members',
      color: '#ffc107'
    },
    {
      id: 'god_tier',
      name: 'God Tier Division',
      icon: '⚡',
      description: 'Chat for God Tier division members',
      color: '#dc3545'
    },
    {
      id: 'universal_threat',
      name: 'Universal Threat Division',
      icon: '🌌',
      description: 'Chat for Universal Threat division members',
      color: '#6f42c1'
    },
    {
      id: 'omnipotent',
      name: 'Omnipotent Division',
      icon: '∞',
      description: 'Chat for Omnipotent division members',
      color: '#fd7e14'
    },
    {
      id: 'betting',
      name: 'Betting Lounge',
      icon: '🎰',
      description: 'Discuss bets and predictions',
      color: '#20c997'
    },
    {
      id: 'memes',
      name: 'Memes & Fun',
      icon: '😂',
      description: 'Share memes and funny content',
      color: '#e83e8c'
    }
  ];

  // Emoji reactions
  const quickEmojis = ['👍', '👎', '😂', '😮', '❤️', '🔥', '💯', '🤔', '😤', '🙌'];

  useEffect(() => {
    setChatRooms(defaultRooms);
    fetchChatHistory(currentRoom);
    joinRoom(currentRoom);

    // Socket event listeners
    if (socket) {
      socket.on('new_message', handleNewMessage);
      socket.on('user_typing', handleUserTyping);
      socket.on('user_stopped_typing', handleUserStoppedTyping);
      socket.on('room_users_update', handleRoomUsersUpdate);
      socket.on('message_reaction', handleMessageReaction);
    }

    return () => {
      if (socket) {
        socket.off('new_message');
        socket.off('user_typing');
        socket.off('user_stopped_typing');
        socket.off('room_users_update');
        socket.off('message_reaction');
      }
    };
  }, [currentRoom, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages[currentRoom]]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChatHistory = async (roomId) => {
    try {
      const response = await axios.get(`/api/chat/history/${roomId}`, {
        params: { limit: 100 }
      });
      setMessages(prev => ({
        ...prev,
        [roomId]: response.data || []
      }));
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  };

  const joinRoom = (roomId) => {
    if (socket) {
      socket.emit('join_room', { roomId, userId: user.id });
    }
  };

  const leaveRoom = (roomId) => {
    if (socket) {
      socket.emit('leave_room', { roomId, userId: user.id });
    }
  };

  const switchRoom = (roomId) => {
    leaveRoom(currentRoom);
    setCurrentRoom(roomId);
    joinRoom(roomId);
    if (!messages[roomId]) {
      fetchChatHistory(roomId);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;

    const messageData = {
      roomId: currentRoom,
      userId: user.id,
      content: newMessage.trim(),
      type: selectedFile ? 'file' : 'text',
      file: selectedFile,
      replyTo: replyingTo?.id || null,
      timestamp: new Date()
    };

    try {
      if (selectedFile) {
        // Upload file first
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('roomId', currentRoom);
        
        const uploadResponse = await axios.post('/api/chat/upload', formData);
        messageData.fileUrl = uploadResponse.data.fileUrl;
        messageData.fileName = selectedFile.name;
      }

      await axios.post('/api/chat/message', messageData);
      
      // Emit via socket for real-time delivery
      if (socket) {
        socket.emit('send_message', messageData);
      }

      setNewMessage('');
      setSelectedFile(null);
      setReplyingTo(null);
      setShowEmojiPicker(false);

      if (chatSettings.soundEnabled) {
        playMessageSound();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing', { roomId: currentRoom, userId: user.id, username: user.username });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (socket) {
        socket.emit('stop_typing', { roomId: currentRoom, userId: user.id });
      }
    }, 2000);
  };

  const handleNewMessage = (messageData) => {
    setMessages(prev => ({
      ...prev,
      [messageData.roomId]: [...(prev[messageData.roomId] || []), messageData]
    }));

    if (chatSettings.soundEnabled && messageData.userId !== user.id) {
      playNotificationSound();
    }
  };

  const handleUserTyping = ({ roomId, userId, username }) => {
    setIsTyping(prev => ({
      ...prev,
      [roomId]: { ...prev[roomId], [userId]: username }
    }));
  };

  const handleUserStoppedTyping = ({ roomId, userId }) => {
    setIsTyping(prev => ({
      ...prev,
      [roomId]: { ...prev[roomId], [userId]: undefined }
    }));
  };

  const handleRoomUsersUpdate = ({ roomId, users }) => {
    setOnlineUsers(prev => ({
      ...prev,
      [roomId]: users
    }));
  };

  const handleMessageReaction = ({ messageId, reaction, userId }) => {
    setMessages(prev => ({
      ...prev,
      [currentRoom]: prev[currentRoom]?.map(msg => 
        msg.id === messageId 
          ? {
              ...msg,
              reactions: {
                ...msg.reactions,
                [reaction]: [...(msg.reactions?.[reaction] || []), userId]
              }
            }
          : msg
      )
    }));
  };

  const addReaction = async (messageId, emoji) => {
    try {
      await axios.post(`/api/chat/message/${messageId}/reaction`, {
        emoji,
        userId: user.id
      });

      if (socket) {
        socket.emit('add_reaction', { messageId, reaction: emoji, userId: user.id });
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await axios.delete(`/api/chat/message/${messageId}`);
      
      setMessages(prev => ({
        ...prev,
        [currentRoom]: prev[currentRoom]?.filter(msg => msg.id !== messageId)
      }));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const playMessageSound = () => {
    const audio = new Audio('/sounds/message-send.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  };

  const playNotificationSound = () => {
    const audio = new Audio('/sounds/message-received.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  const MessageComponent = ({ message }) => (
    <div className={`message ${message.userId === user.id ? 'own-message' : ''}`}>
      {message.replyTo && (
        <div className="reply-reference">
          <span>↳ Replying to {message.replyTo.username}</span>
        </div>
      )}
      
      <div className="message-header">
        <img 
          src={message.user?.avatar || '/default-avatar.png'} 
          alt={message.user?.username}
          className="user-avatar"
        />
        <span className="username" style={{ color: message.user?.nameColor || '#ffffff' }}>
          {message.user?.customTitle && (
            <span className="custom-title">{message.user.customTitle}</span>
          )}
          {message.user?.username}
        </span>
        {chatSettings.showTimestamps && (
          <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
        )}
      </div>

      <div className="message-content">
        {message.type === 'file' ? (
          <div className="file-message">
            {message.fileName?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
              <img src={message.fileUrl} alt={message.fileName} className="chat-image" />
            ) : (
              <div className="file-attachment">
                <span>📎 {message.fileName}</span>
                <a href={message.fileUrl} download>Download</a>
              </div>
            )}
          </div>
        ) : (
          <div className="text-message">
            {message.content}
          </div>
        )}
      </div>

      <div className="message-actions">
        <div className="reactions">
          {Object.entries(message.reactions || {}).map(([emoji, users]) => (
            <button
              key={emoji}
              className={`reaction ${users.includes(user.id) ? 'user-reacted' : ''}`}
              onClick={() => addReaction(message.id, emoji)}
            >
              {emoji} {users.length}
            </button>
          ))}
        </div>
        
        <div className="action-buttons">
          <button onClick={() => setReplyingTo(message)}>↳</button>
          {quickEmojis.map(emoji => (
            <button
              key={emoji}
              className="quick-reaction"
              onClick={() => addReaction(message.id, emoji)}
            >
              {emoji}
            </button>
          ))}
          {message.userId === user.id && (
            <button 
              className="delete-btn"
              onClick={() => deleteMessage(message.id)}
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const RoomSidebar = () => (
    <div className="room-sidebar">
      <div className="sidebar-header">
        <h3>💬 Chat Rooms</h3>
      </div>

      <div className="rooms-list">
        {chatRooms.map(room => (
          <div
            key={room.id}
            className={`room-item ${currentRoom === room.id ? 'active' : ''}`}
            onClick={() => switchRoom(room.id)}
            style={{ '--room-color': room.color }}
          >
            <div className="room-icon">{room.icon}</div>
            <div className="room-info">
              <span className="room-name">{room.name}</span>
              <div className="room-meta">
                <span className="online-count">
                  {onlineUsers[room.id]?.length || 0} online
                </span>
                {messages[room.id]?.length > 0 && (
                  <span className="message-count">
                    {messages[room.id].length} messages
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="online-users">
        <h4>👥 Online in {chatRooms.find(r => r.id === currentRoom)?.name}</h4>
        <div className="users-list">
          {onlineUsers[currentRoom]?.map(user => (
            <div key={user.id} className="online-user">
              <img src={user.avatar || '/default-avatar.png'} alt={user.username} />
              <span style={{ color: user.nameColor || '#ffffff' }}>
                {user.username}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const ChatInput = () => (
    <div className="chat-input-container">
      {replyingTo && (
        <div className="reply-preview">
          <span>Replying to {replyingTo.user?.username}: {replyingTo.content.substring(0, 50)}...</span>
          <button onClick={() => setReplyingTo(null)}>✕</button>
        </div>
      )}

      {selectedFile && (
        <div className="file-preview">
          <span>📎 {selectedFile.name}</span>
          <button onClick={() => setSelectedFile(null)}>✕</button>
        </div>
      )}

      <div className="input-row">
        <input
          type="file"
          id="file-input"
          style={{ display: 'none' }}
          onChange={(e) => setSelectedFile(e.target.files[0])}
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
        
        <button
          className="file-btn"
          onClick={() => document.getElementById('file-input').click()}
        >
          📎
        </button>

        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="message-input"
        />

        <button
          className="emoji-btn"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          😀
        </button>

        <button
          className="send-btn"
          onClick={sendMessage}
          disabled={!newMessage.trim() && !selectedFile}
        >
          ➤
        </button>
      </div>

      {showEmojiPicker && (
        <div className="emoji-picker">
          {quickEmojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                setNewMessage(prev => prev + emoji);
                setShowEmojiPicker(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const TypingIndicator = () => {
    const typingUsers = Object.values(isTyping[currentRoom] || {}).filter(Boolean);
    
    if (typingUsers.length === 0) return null;

    return (
      <div className="typing-indicator">
        <span>
          {typingUsers.slice(0, 3).join(', ')} 
          {typingUsers.length > 3 && ` and ${typingUsers.length - 3} others`}
          {typingUsers.length === 1 ? ' is' : ' are'} typing...
        </span>
        <div className="typing-animation">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  };

  return (
    <div className={`global-chat-system ${chatSettings.theme}`}>
      <RoomSidebar />
      
      <div className="chat-main">
        <div className="chat-header">
          <div className="current-room-info">
            <span className="room-icon">
              {chatRooms.find(r => r.id === currentRoom)?.icon}
            </span>
            <div className="room-details">
              <h3>{chatRooms.find(r => r.id === currentRoom)?.name}</h3>
              <p>{chatRooms.find(r => r.id === currentRoom)?.description}</p>
            </div>
          </div>

          <div className="chat-controls">
            <button
              className={`sound-toggle ${chatSettings.soundEnabled ? 'enabled' : 'disabled'}`}
              onClick={() => setChatSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
            >
              {chatSettings.soundEnabled ? '🔊' : '🔇'}
            </button>
            
            <button
              className="settings-btn"
              onClick={() => {/* Open chat settings modal */}}
            >
              ⚙️
            </button>
          </div>
        </div>

        <div className="messages-container">
          {messages[currentRoom]?.map(message => (
            <MessageComponent key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <TypingIndicator />
        <ChatInput />
      </div>
    </div>
  );
};

export default GlobalChatSystem;