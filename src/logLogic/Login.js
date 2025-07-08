import React, { useState } from 'react';
import axios from 'axios';
import Notification from '../notificationLogic/Notification';
import { useNavigate } from 'react-router-dom';
import '../Auth.css'; // Wspólny plik CSS dla autentykacji

const Login = ({ setIsLoggedIn }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();

  const { email, password } = formData;

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const showNotification = (message, type) => {
    setNotification({ message, type });
  };

  const clearNotification = () => {
    setNotification(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = {
        email,
        password,
      };

      const config = {
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const body = JSON.stringify(user);

      const res = await axios.post('/api/auth/login', body, config);
      console.log('Login response:', res.data);
      if (!res.data.userId) {
        showNotification('Błąd logowania: brak userId w odpowiedzi serwera.', 'error');
        return;
      }
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userId', res.data.userId);
      setIsLoggedIn(true);
      showNotification('Logowanie udane!', 'success');
      setTimeout(() => navigate('/'), 1000); // Przekieruj po krótkim opóźnieniu, aby powiadomienie było widoczne
    } catch (err) {
      console.error(err.response.data);
      showNotification(err.response.data.msg || 'Błąd logowania', 'error');
    }
  };

  return (
    <div className="auth-container">
      <h1>Zaloguj się</h1>
      <Notification message={notification?.message} type={notification?.type} onClose={clearNotification} />
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <input
            type="email"
            placeholder="Adres Email"
            name="email"
            value={email}
            onChange={onChange}
            required
          />
        </div>
        <div className="form-group">
          <input
            type="password"
            placeholder="Hasło"
            name="password"
            value={password}
            onChange={onChange}
            minLength="6"
            required
          />
        </div>
        <input type="submit" value="Zaloguj" className="btn btn-primary" />
      </form>
    </div>
  );
};

export default Login;
