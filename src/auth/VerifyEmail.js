import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useSearchParams } from 'react-router-dom';
import './VerifyEmail.css';

const VerifyEmail = () => {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    const verify = async () => {
      try {
        await axios.post('/api/auth/verify-email', { token });
        setStatus('success');
        setMessage('Email verified. You can sign in now.');
      } catch (error) {
        setStatus('error');
        setMessage(
          error?.response?.data?.msg || 'Verification failed. Request a new verification email.'
        );
      }
    };

    verify();
  }, [params]);

  return (
    <div className="verify-email-page">
      <div className="verify-email-card">
        <h1>Email verification</h1>
        <p className={`verify-message ${status}`}>{message}</p>
        <Link to="/login" className="verify-link">
          Go to sign in
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmail;
