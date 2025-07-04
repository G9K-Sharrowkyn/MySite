import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Notification from './Notification';
import './MessagesPage.css';
import { Link } from 'react-router-dom';

const MessagesPage = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState({
    to: '',
    subject: '',
    body: '',
  });
  const [users, setUsers] = useState([]);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchMessages();
    fetchUsers();
  }, []);

  const showNotification = (message, type) => {
    setNotification({ message, type });
  };

  const clearNotification = () => {
    setNotification(null);
  };

  const fetchMessages = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await axios.get('/api/messages', {
        headers: {
          'x-auth-token': token,
        },
      });
      setMessages(res.data);
    } catch (err) {
      showNotification('Błąd podczas pobierania wiadomości.', 'error');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/profile/all');
      setUsers(res.data);
    } catch (err) {
      showNotification('Błąd podczas pobierania listy użytkowników.', 'error');
    }
  };

  const onChange = (e) => {
    setNewMessage({ ...newMessage, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      showNotification('Musisz być zalogowany, aby wysłać wiadomość.', 'error');
      return;
    }
    try {
      await axios.post('/api/messages', newMessage, {
        headers: {
          'x-auth-token': token,
        },
      });
      showNotification('Wiadomość wysłana!', 'success');
      setNewMessage({ to: '', subject: '', body: '' });
      fetchMessages();
    } catch (err) {
      showNotification(err.response?.data?.msg || 'Błąd wysyłania wiadomości', 'error');
    }
  };

  return (
    <div className="messages-page">
      <h1>Wiadomości</h1>
      <Notification message={notification?.message} type={notification?.type} onClose={clearNotification} />
      <form onSubmit={onSubmit} className="send-message-form">
        <select name="to" value={newMessage.to} onChange={onChange} required>
          <option value="">Wybierz użytkownika</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.username}</option>
          ))}
        </select>
        <input type="text" name="subject" value={newMessage.subject} onChange={onChange} placeholder="Temat" required />
        <textarea name="body" value={newMessage.body} onChange={onChange} placeholder="Treść wiadomości" required />
        <button type="submit">Wyślij</button>
      </form>
      <div className="messages-list">
        <h2>Odebrane wiadomości</h2>
        {messages.length > 0 ? (
          messages.map((msg) => (
            <div key={msg.id} className="message-item">
              <p><strong>Od: </strong><Link to={`/profile/${msg.from}`}>{msg.fromUsername || msg.from}</Link></p>
              <p><strong>Temat: </strong>{msg.subject}</p>
              <p>{msg.body}</p>
              <p className="message-date">{new Date(msg.createdAt).toLocaleString()}</p>
            </div>
          ))
        ) : (
          <p>Brak wiadomości.</p>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
