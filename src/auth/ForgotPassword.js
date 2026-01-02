import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Toast from '../tournamentLogic/Toast';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post('/api/auth/forgot-password', { email });
      setEmailSent(true);
      setToast({ 
        message: 'Password reset link has been sent to your email!', 
        type: 'success' 
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      setToast({ 
        message: error.response?.data?.msg || 'Error sending reset email', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="forgot-password-container">
        <div className="forgot-password-card">
          <h1>🔑 Forgot Password</h1>
          
          {!emailSent ? (
            <>
              <p className="instruction-text">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your.email@example.com"
                    disabled={loading}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="back-to-login">
                <Link to="/login">← Back to Login</Link>
              </div>
            </>
          ) : (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <h2>Check Your Email</h2>
              <p>
                We've sent a password reset link to <strong>{email}</strong>
              </p>
              <p className="sub-text">
                The link will expire in 1 hour. If you don't see the email, check your spam folder.
              </p>
              <Link to="/login" className="btn-back-login">
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
