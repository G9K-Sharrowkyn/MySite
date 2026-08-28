import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router';
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

const Register = () => {
  const { login, user } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: ''
  });
  const [notification, setNotification] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [minimumAgeConfirmed, setMinimumAgeConfirmed] = useState(false);
  const navigate = useNavigate();

  const { username, email, password, password2 } = formData;

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

    if (password !== password2) {
      showNotification('Passwords do not match.', 'error');
      return;
    }
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      showNotification(
        'Password must be at least 10 characters and contain a letter and a number.',
        'error'
      );
      return;
    }
    if (!acceptedLegal || !minimumAgeConfirmed) {
      showNotification(
        'Accept the Terms and Privacy Policy and confirm the minimum age requirement.',
        'error'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axios.post(
        '/api/auth/register',
        {
          username: username.trim(),
          email,
          password,
          consent: {
            termsOfService: acceptedLegal,
            privacyPolicy: acceptedLegal,
            minimumAgeConfirmed
          }
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (response.data?.requiresEmailVerification) {
        setPendingVerificationEmail(response.data?.email || email);
        showNotification(
          'Account created. Verify your email, then sign in.',
          'success'
        );
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 1200);
        return;
      }

      if (!response.data?.authenticated || !response.data?.userId) {
        showNotification('Unexpected response from the server.', 'error');
        return;
      }

      login(null, response.data.userId, response.data.user);
      showNotification('Registration successful!', 'success');

      setTimeout(() => {
        navigate('/profile/me', { replace: true });
      }, 800);
    } catch (error) {
      console.error('Registration error:', error);
      showNotification(
        getErrorMessage(error, 'Registration failed. Please review the form.'),
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendVerification = async () => {
    const targetEmail = pendingVerificationEmail || email;
    if (!targetEmail || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post(
        '/api/auth/resend-verification',
        { email: targetEmail },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      showNotification('Verification email sent again.', 'success');
    } catch (error) {
      showNotification(
        getErrorMessage(error, 'Unable to resend verification email.'),
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

    if (!acceptedLegal || !minimumAgeConfirmed) {
      showNotification(
        'Accept the Terms and Privacy Policy and confirm the minimum age requirement before creating a Google account.',
        'error'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(
        '/api/auth/google',
        {
          idToken,
          consent: {
            termsOfService: acceptedLegal,
            privacyPolicy: acceptedLegal,
            minimumAgeConfirmed
          }
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data?.requires2FA) {
        showNotification('This account requires 2FA. Please sign in from the login page.', 'info');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 800);
        return;
      }

      if (!response.data?.authenticated || !response.data?.userId) {
        showNotification('Unexpected response from the server.', 'error');
        return;
      }

      login(null, response.data.userId, response.data.user);
      showNotification(
        response.data?.isNewUser
          ? 'Google account linked and registered!'
          : 'Google sign-in successful!',
        'success'
      );

      setTimeout(() => {
        navigate(response.data?.isNewUser ? '/profile/me' : '/feed', { replace: true });
      }, 800);
    } catch (error) {
      console.error('Google registration error:', error);
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
      <h1>Create an account</h1>
      <Notification
        message={notification?.message}
        type={notification?.type}
        onClose={clearNotification}
      />
      <form onSubmit={onSubmit} noValidate>
        <div className="form-group">
          <input
            type="text"
            placeholder="Username"
            name="username"
            value={username}
            onChange={onChange}
            required
            autoComplete="username"
            disabled={isSubmitting}
          />
        </div>
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
            minLength="10"
            required
            autoComplete="new-password"
            disabled={isSubmitting}
          />
        </div>
        <div className="form-group">
          <input
            type="password"
            placeholder="Confirm password"
            name="password2"
            value={password2}
            onChange={onChange}
            minLength="10"
            required
            autoComplete="new-password"
            disabled={isSubmitting}
          />
        </div>
        <label className="auth-consent-row">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(event) => setAcceptedLegal(event.target.checked)}
            disabled={isSubmitting}
            required
          />
          <span>
            I accept the <Link to="/terms">Terms of Service</Link> and acknowledge
            the <Link to="/privacy-policy">Privacy Policy</Link>.
          </span>
        </label>
        <label className="auth-consent-row">
          <input
            type="checkbox"
            checked={minimumAgeConfirmed}
            onChange={(event) => setMinimumAgeConfirmed(event.target.checked)}
            disabled={isSubmitting}
            required
          />
          <span>I confirm that I meet the minimum age stated in the Terms.</span>
        </label>
        <input
          type="submit"
          value={isSubmitting ? 'Creating account...' : 'Create account'}
          className="btn btn-primary"
          disabled={isSubmitting}
        />
      </form>
      <GoogleSignInButton
        onCredential={handleGoogleCredential}
        onError={(message) => showNotification(message, 'error')}
      />
      {pendingVerificationEmail && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={resendVerification}
          disabled={isSubmitting}
          style={{ marginTop: '12px' }}
        >
          Resend verification email
        </button>
      )}
    </div>
  );
};

export default Register;
