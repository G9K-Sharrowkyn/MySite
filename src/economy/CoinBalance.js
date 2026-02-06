import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './CoinBalance.css';

const CoinBalance = ({ userId, showLabel = true, className = '' }) => {
  const { t } = useLanguage();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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
        setHasError(false);
      } catch (err) {
        console.error('Error fetching coin balance:', err);
        setHasError(true);
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

  if (hasError) {
    return (
      <div className={`coin-balance error ${className}`}>
        <span className="coin-icon">🪙</span>
        <span className="balance-text">{t('error')}</span>
      </div>
    );
  }

  return (
    <div className={`coin-balance ${className}`}>
      <span className="coin-icon">🪙</span>
      {showLabel && <span className="balance-label">{t('coins')}:</span>}
      <span className="balance-amount">{balance.toLocaleString()}</span>
    </div>
  );
};

export default CoinBalance; 
