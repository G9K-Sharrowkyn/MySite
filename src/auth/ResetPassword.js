import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Toast from '../tournamentLogic/Toast';
import './ResetPassword.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(true);

  useEffect(() => {
    if (!token) {
      setValidToken(false);
      setToast({ message: 'Invalid or missing reset token', type: 'error' });
    }
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setToast({ message: 'Passwords do not match', type: 'error' });
      return;
    }

    if (formData.password.length < 6) {
      setToast({ message: 'Password must be at least 6 characters', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      await axios.post('/api/auth/reset-password', {
        token: token,
        newPassword: formData.password
      });

      setToast({ message: 'Password reset successful!', type: 'success' });
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Reset password error:', error);
      setToast({ 
        message: error.response?.data?.msg || 'Error resetting password', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!validToken) {
    return (
      <div className="reset-password-page">
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
        <div className="reset-password-container">
          <div className="reset-password-card">
            <div className="error-icon">✕</div>
            <h2>Invalid Reset Link</h2>
            <p>This password reset link is invalid or has expired.</p>
            <button 
              className="btn-back"
              onClick={() => navigate('/forgot-password')}
            >
              Request New Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="reset-password-container">
        <div className="reset-password-card">
          <h1>🔒 Reset Password</h1>
          <p className="instruction-text">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter new password (min 6 characters)"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Confirm new password"
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              className="btn-submit"
              disabled={loading}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
