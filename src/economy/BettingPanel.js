import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CoinBalance from './CoinBalance';
import { useLanguage } from '../i18n/LanguageContext';
import './BettingPanel.css';

const BettingPanel = ({ fightId, fightTitle, teamA, teamB, bettingEndsAt, onBetPlaced }) => {
  const { t } = useLanguage();

  const MIN_BET = 10;
  const MAX_BET = 1000;

  const [betAmount, setBetAmount] = useState(MIN_BET);
  const [prediction, setPrediction] = useState('');
  const [odds, setOdds] = useState({ A: 2.0, B: 2.0, draw: 3.0 });
  const [userBalance, setUserBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bettingOpen, setBettingOpen] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState('');

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    if (!token || !userId) return;

    const fetchData = async () => {
      try {
        // Fetch user balance
        const balanceResponse = await axios.get(`/api/coins/balance/${userId}`, {
          headers: { 'x-auth-token': token }
        });
        setUserBalance(balanceResponse.data.balance || 0);

        // Fetch current odds
        const oddsResponse = await axios.get(`/api/betting/fight/${fightId}/odds`, {
          headers: { 'x-auth-token': token }
        });
        setOdds(oddsResponse.data);
      } catch (err) {
        console.error('Error fetching betting data:', err);
      }
    };

    fetchData();
  }, [fightId, token, userId]);

  useEffect(() => {
    if (!bettingEndsAt) {
      setBettingOpen(false);
      setTimeRemaining(t('bettingClosed'));
      return undefined;
    }

    const closeTime = new Date(bettingEndsAt);
    if (Number.isNaN(closeTime.getTime())) {
      setBettingOpen(false);
      setTimeRemaining(t('bettingClosed'));
      return undefined;
    }

    const checkBettingStatus = () => {
      const now = new Date();
      if (now >= closeTime) {
        setBettingOpen(false);
        setTimeRemaining(t('bettingClosed'));
        return;
      }
      const remaining = closeTime - now;
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      setBettingOpen(true);
      setTimeRemaining(`${hours}h ${minutes}m`);
    };

    checkBettingStatus();
    const interval = setInterval(checkBettingStatus, 60000);
    return () => clearInterval(interval);
  }, [bettingEndsAt, t]);

  const handleBetAmountChange = (e) => {
    const amount = Number.parseInt(e.target.value, 10);
    if (Number.isNaN(amount)) return;
    setBetAmount(amount);
  };

  const handlePredictionChange = (pred) => {
    setPrediction(pred);
  };

  const calculatePotentialWinnings = () => {
    if (!prediction || !odds[prediction]) return 0;
    return Math.floor(betAmount * odds[prediction]);
  };

  const handlePlaceBet = async () => {
    if (!prediction) {
      setError(t('selectPrediction'));
      return;
    }

    if (betAmount > userBalance) {
      setError(t('insufficientFunds'));
      return;
    }

    if (betAmount < MIN_BET) {
      setError(t('minimumBetAmount', { amount: MIN_BET, coins: t('coins') }));
      return;
    }

    if (betAmount > MAX_BET) {
      setError(t('maximumBetAmount', { amount: MAX_BET, coins: t('coins') }));
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`/api/betting/fight/${fightId}`, {
        predictedWinner: prediction,
        betAmount: betAmount
      }, {
        headers: { 'x-auth-token': token }
      });

      setSuccess(t('betPlacedSuccessfully'));
      setUserBalance(response.data.newBalance || userBalance - betAmount);
      
      // Reset form
      setBetAmount(MIN_BET);
      setPrediction('');
      
      if (onBetPlaced) {
        onBetPlaced(response.data.bet);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || t('failedToPlaceBet'));
    } finally {
      setLoading(false);
    }
  };

  if (!token || !userId) {
    return (
      <div className="betting-panel">
        <div className="betting-login-required">
          <p>{t('loginToBet')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="betting-panel">
      <div className="betting-header">
        <h3>🎲 {t('placeBet')}</h3>
        <div className="betting-status">
          <span className={`status-indicator ${bettingOpen ? 'open' : 'closed'}`}>
            {bettingOpen ? `🟢 ${t('open')}` : `🔴 ${t('closed')}`}
          </span>
          <span className="time-remaining">{timeRemaining}</span>
        </div>
      </div>

      <div className="user-balance-section">
        <CoinBalance userId={userId} showLabel={true} className="compact" />
      </div>

      {error && <div className="betting-error">{error}</div>}
      {success && <div className="betting-success">{success}</div>}

      {bettingOpen ? (
        <div className="betting-form">
          <div className="prediction-section">
            <h4>{t('predictWinner')}</h4>
            <div className="prediction-options">
              <button
                className={`prediction-btn ${prediction === 'A' ? 'selected' : ''}`}
                onClick={() => handlePredictionChange('A')}
                disabled={loading}
              >
                <span className="team-name">{teamA}</span>
                <span className="odds">@{odds.A.toFixed(2)}</span>
              </button>
              
              <button
                className={`prediction-btn ${prediction === 'draw' ? 'selected' : ''}`}
                onClick={() => handlePredictionChange('draw')}
                disabled={loading}
              >
                <span className="team-name">{t('draw')}</span>
                <span className="odds">@{odds.draw.toFixed(2)}</span>
              </button>

              <button
                className={`prediction-btn ${prediction === 'B' ? 'selected' : ''}`}
                onClick={() => handlePredictionChange('B')}
                disabled={loading}
              >
                <span className="team-name">{teamB}</span>
                <span className="odds">@{odds.B.toFixed(2)}</span>
              </button>
            </div>
          </div>

          <div className="bet-amount-section">
            <h4>{t('betAmount')}:</h4>
            <div className="bet-amount-input">
              <input
                type="number"
                min={MIN_BET}
                max={Math.min(userBalance, MAX_BET)}
                value={betAmount}
                onChange={handleBetAmountChange}
                disabled={loading}
                className="amount-input"
              />
              <span className="coins-label">{t('coins')}</span>
            </div>
            
            <div className="quick-amounts">
              {[10, 25, 50, 100].map(amount => (
                <button
                  key={amount}
                  className={`quick-amount-btn ${betAmount === amount ? 'selected' : ''}`}
                  onClick={() => setBetAmount(amount)}
                  disabled={amount > userBalance || loading}
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>

          {prediction && (
            <div className="potential-winnings">
              <h4>{t('potentialWinnings')}:</h4>
              <div className="winnings-display">
                <span className="winnings-amount">
                  🪙 {calculatePotentialWinnings().toLocaleString()}
                </span>
                <span className="winnings-label">{t('coins')}</span>
              </div>
            </div>
          )}

          <button
            className="place-bet-btn"
            onClick={handlePlaceBet}
            disabled={!prediction || betAmount > userBalance || betAmount < MIN_BET || betAmount > MAX_BET || loading}
          >
            {loading ? t('placingBet') : t('placeBet')}
          </button>
        </div>
      ) : (
        <div className="betting-closed">
          <p>{t('bettingWindowClosed')}</p>
        </div>
      )}
    </div>
  );
};

export default BettingPanel; 
