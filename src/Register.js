import React, { useState } from 'react';
import axios from 'axios';
import Notification from './Notification';
import './Auth.css'; // Wspólny plik CSS dla autentykacji

const Register = ({ setIsLoggedIn }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
  });
  const [notification, setNotification] = useState(null);

  const { username, email, password, password2 } = formData;

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
    if (password !== password2) {
      showNotification('Hasła nie pasują do siebie', 'error');
    } else {
      try {
        const newUser = {
          username,
          email,
          password,
        };

        const config = {
          headers: {
            'Content-Type': 'application/json',
          },
        };

        const body = JSON.stringify(newUser);

        const res = await axios.post('/api/auth/register', body, config);
        console.log('Register response:', res.data);
        if (!res.data.userId) {
          showNotification('Błąd rejestracji: brak userId w odpowiedzi serwera.', 'error');
          return;
        }
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('userId', res.data.userId);
        setIsLoggedIn(true);
        showNotification('Rejestracja udana!', 'success');
        // Tutaj można przekierować użytkownika lub zapisać token
      } catch (err) {
        console.error(err.response.data);
        showNotification(err.response.data.msg || 'Błąd rejestracji', 'error');
      }
    }
  };

  return (
    <div className="auth-container">
      <h1>Zarejestruj się</h1>
      <Notification message={notification?.message} type={notification?.type} onClose={clearNotification} />
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <input
            type="text"
            placeholder="Nazwa użytkownika"
            name="username"
            value={username}
            onChange={onChange}
            required
          />
        </div>
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
        <div className="form-group">
          <input
            type="password"
            placeholder="Potwierdź Hasło"
            name="password2"
            value={password2}
            onChange={onChange}
            minLength="6"
            required
          />
        </div>
        <input type="submit" value="Zarejestruj" className="btn btn-primary" />
      </form>
    </div>
  );
};

export default Register;
