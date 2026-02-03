import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import Notification from '../notificationLogic/Notification';
import { AuthContext } from '../auth/AuthContext';
import GoogleSignInButton from './GoogleSignInButton';
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
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
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

  const onCodeChange = (event) => {
    const numeric = event.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setTwoFactorCode(numeric);
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
  };

  const clearNotification = () => {
    setNotification(null);
  };

  const resendVerification = async () => {
    if (!pendingVerificationEmail || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(
        '/api/auth/resend-verification',
        { email: pendingVerificationEmail },
        { headers: { 'Content-Type': 'application/json' } }
      );
      showNotification('Verification email sent again. Check your inbox.', 'success');
    } catch (error) {
      showNotification(getErrorMessage(error, 'Unable to resend verification email.'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeTwoFactorLogin = async () => {
    if (twoFactorCode.length < 6) {
      showNotification('Enter the 6-digit code from your email.', 'error');
      return;
    }

    const response = await axios.post(
      '/api/auth/verify-2fa',
      { challengeToken, code: twoFactorCode },
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
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (twoFactorRequired) {
        await completeTwoFactorLogin();
        return;
      }

      const response = await axios.post(
        '/api/auth/login',
        { email, password },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.data?.requires2FA) {
        setTwoFactorRequired(true);
        setChallengeToken(response.data.challengeToken || '');
        showNotification(response.data?.msg || 'Enter your security code.', 'success');
        return;
      }

      if (!response.data?.token || !response.data?.userId) {
        showNotification('Unexpected response from the server.', 'error');
        return;
      }

      setPendingVerificationEmail('');
      login(response.data.token, response.data.userId, response.data.user);
      showNotification('Login successful!', 'success');

      setTimeout(() => {
        navigate('/feed', { replace: true });
      }, 800);
    } catch (error) {
      console.error('Login error:', error);
      if (error?.response?.data?.requiresEmailVerification) {
        setPendingVerificationEmail(error?.response?.data?.email || email);
      }
      showNotification(
        getErrorMessage(error, 'Login failed. Please check your credentials.'),
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleCredential = async (idToken) => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(
        '/api/auth/google',
        { idToken },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data?.requires2FA) {
        setTwoFactorRequired(true);
        setChallengeToken(response.data.challengeToken || '');
        showNotification(response.data?.msg || 'Enter your security code.', 'success');
        return;
      }

      if (!response.data?.token || !response.data?.userId) {
        showNotification('Unexpected response from the server.', 'error');
        return;
      }

      login(response.data.token, response.data.userId, response.data.user);
      showNotification('Google sign-in successful!', 'success');
      setTimeout(() => {
        navigate('/feed', { replace: true });
      }, 800);
    } catch (error) {
      console.error('Google login error:', error);
      showNotification(
        getErrorMessage(error, 'Google sign-in failed.'),
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
        {!twoFactorRequired && (
          <>
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
            <div className="forgot-password-link" style={{ textAlign: 'right', marginBottom: '15px' }}>
              <Link to="/forgot-password" style={{ color: '#ff6b00', fontSize: '14px', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
          </>
        )}
        {twoFactorRequired && (
          <div className="form-group">
            <input
              type="text"
              placeholder="6-digit security code"
              name="twoFactorCode"
              value={twoFactorCode}
              onChange={onCodeChange}
              required
              autoComplete="one-time-code"
              disabled={isSubmitting}
            />
          </div>
        )}
        <input
          type="submit"
          value={
            isSubmitting
              ? (twoFactorRequired ? 'Verifying...' : 'Signing in...')
              : (twoFactorRequired ? 'Verify code' : 'Sign in')
          }
          className="btn btn-primary"
          disabled={isSubmitting}
        />
      </form>
      {pendingVerificationEmail && (
        <button
          type="button"
          onClick={resendVerification}
          className="btn btn-secondary"
          disabled={isSubmitting}
          style={{ marginTop: '12px' }}
        >
          Resend verification email
        </button>
      )}
      {!twoFactorRequired && (
        <GoogleSignInButton
          onCredential={handleGoogleCredential}
          onError={(message) => showNotification(message, 'error')}
        />
      )}
    </div>
  );
};

export default Login;
