import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CoinBalance.css';

const CoinBalance = ({ userId, showLabel = true, className = '' }) => {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const targetUserId = userId || localStorage.getItem('userId');
        
        const response = await axios.get(`/api/coins/balance/${targetUserId}`, {
          headers: token ? { 'x-auth-token': token } : {}
        });
        
        setBalance(response.data.balance || 0);
        setError(null);
      } catch (err) {
        console.error('Error fetching coin balance:', err);
        setError('Failed to load balance');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [userId]);

  if (loading) {
    return (
      <div className={`coin-balance loading ${className}`}>
        <span className="coin-icon">🪙</span>
        <span className="balance-text">...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`coin-balance error ${className}`}>
        <span className="coin-icon">🪙</span>
        <span className="balance-text">Error</span>
      </div>
    );
  }

  return (
    <div className={`coin-balance ${className}`}>
      <span className="coin-icon">🪙</span>
      {showLabel && <span className="balance-label">Coins:</span>}
      <span className="balance-amount">{balance.toLocaleString()}</span>
    </div>
  );
};

export default CoinBalance; 