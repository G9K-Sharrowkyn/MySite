import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Notification from '../notificationLogic/Notification';
import { AuthContext } from '../auth/AuthContext';
import '../Auth.css';

const getErrorMessage = (error, fallback) => {
  if (error?.response?.data) {
    const { data } = error.response;
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors.map((item) => item.msg || item.message).join(' ');
    }
    if (data.msg) {
      return data.msg;
    }
  }

  return fallback;
};

const Login = () => {
  const { login, user } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [notification, setNotification] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const { email, password } = formData;

  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
  };

  const clearNotification = () => {
    setNotification(null);
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axios.post(
        '/api/auth/login',
        { email, password },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!response.data?.token || !response.data?.userId) {
        showNotification('Unexpected response from the server.', 'error');
        return;
      }

      login(response.data.token, response.data.userId, response.data.user);
      showNotification('Login successful!', 'success');

      setTimeout(() => {
        navigate('/feed', { replace: true });
      }, 800);
    } catch (error) {
      console.error('Login error:', error);
      showNotification(
        getErrorMessage(error, 'Login failed. Please check your credentials.'),
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <h1>Sign in</h1>
      <Notification
        message={notification?.message}
        type={notification?.type}
        onClose={clearNotification}
      />
      <form onSubmit={onSubmit} noValidate>
        <div className="form-group">
          <input
            type="email"
            placeholder="Email address"
            name="email"
            value={email}
            onChange={onChange}
            required
            autoComplete="email"
            disabled={isSubmitting}
          />
        </div>
        <div className="form-group">
          <input
            type="password"
            placeholder="Password"
            name="password"
            value={password}
            onChange={onChange}
            minLength="6"
            required
            autoComplete="current-password"
            disabled={isSubmitting}
          />
        </div>
        <input
          type="submit"
          value={isSubmitting ? 'Signing in...' : 'Sign in'}
          className="btn btn-primary"
          disabled={isSubmitting}
        />
      </form>
    </div>
  );
};

export default Login;
