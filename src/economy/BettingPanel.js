import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CoinBalance from './CoinBalance';
import './BettingPanel.css';

const BettingPanel = ({ fightId, fightTitle, teamA, teamB, onBetPlaced }) => {
  const [betAmount, setBetAmount] = useState(10);
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
    // Check if betting is still open (24 hours before fight)
    const checkBettingStatus = () => {
      const now = new Date();
      const fightTime = new Date(); // This should come from fight data
      fightTime.setHours(fightTime.getHours() + 25); // Mock fight time
      
      const bettingDeadline = new Date(fightTime.getTime() - (24 * 60 * 60 * 1000));
      
      if (now > bettingDeadline) {
        setBettingOpen(false);
        setTimeRemaining('Betting closed');
      } else {
        const remaining = bettingDeadline - now;
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        setTimeRemaining(`${hours}h ${minutes}m`);
      }
    };

    checkBettingStatus();
    const interval = setInterval(checkBettingStatus, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const handleBetAmountChange = (e) => {
    const amount = parseInt(e.target.value);
    if (amount > 0 && amount <= userBalance) {
      setBetAmount(amount);
    }
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
      setError('Please select a prediction');
      return;
    }

    if (betAmount > userBalance) {
      setError('Insufficient coins');
      return;
    }

    if (betAmount < 1) {
      setError('Minimum bet is 1 coin');
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

      setSuccess('Bet placed successfully!');
      setUserBalance(response.data.newBalance || userBalance - betAmount);
      
      // Reset form
      setBetAmount(10);
      setPrediction('');
      
      if (onBetPlaced) {
        onBetPlaced(response.data.bet);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place bet');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !userId) {
    return (
      <div className="betting-panel">
        <div className="betting-login-required">
          <p>Please log in to place bets</p>
        </div>
      </div>
    );
  }

  return (
    <div className="betting-panel">
      <div className="betting-header">
        <h3>🎲 Place Your Bet</h3>
        <div className="betting-status">
          <span className={`status-indicator ${bettingOpen ? 'open' : 'closed'}`}>
            {bettingOpen ? '🟢 Open' : '🔴 Closed'}
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
            <h4>Predict the Winner:</h4>
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
                className={`prediction-btn ${prediction === 'B' ? 'selected' : ''}`}
                onClick={() => handlePredictionChange('B')}
                disabled={loading}
              >
                <span className="team-name">{teamB}</span>
                <span className="odds">@{odds.B.toFixed(2)}</span>
              </button>
              
              <button
                className={`prediction-btn ${prediction === 'draw' ? 'selected' : ''}`}
                onClick={() => handlePredictionChange('draw')}
                disabled={loading}
              >
                <span className="team-name">Draw</span>
                <span className="odds">@{odds.draw.toFixed(2)}</span>
              </button>
            </div>
          </div>

          <div className="bet-amount-section">
            <h4>Bet Amount:</h4>
            <div className="bet-amount-input">
              <input
                type="number"
                min="1"
                max={userBalance}
                value={betAmount}
                onChange={handleBetAmountChange}
                disabled={loading}
                className="amount-input"
              />
              <span className="coins-label">coins</span>
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
              <h4>Potential Winnings:</h4>
              <div className="winnings-display">
                <span className="winnings-amount">
                  🪙 {calculatePotentialWinnings().toLocaleString()}
                </span>
                <span className="winnings-label">coins</span>
              </div>
            </div>
          )}

          <button
            className="place-bet-btn"
            onClick={handlePlaceBet}
            disabled={!prediction || betAmount > userBalance || betAmount < 1 || loading}
          >
            {loading ? 'Placing Bet...' : 'Place Bet'}
          </button>
        </div>
      ) : (
        <div className="betting-closed">
          <p>Betting is closed for this fight</p>
        </div>
      )}
    </div>
  );
};

export default BettingPanel; 