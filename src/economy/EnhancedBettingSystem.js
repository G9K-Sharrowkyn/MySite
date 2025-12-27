import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import './EnhancedBettingSystem.css';

const EnhancedBettingSystem = ({ user }) => {
  const [availableFights, setAvailableFights] = useState([]);
  const [userCoins, setUserCoins] = useState(0);
  const [bettingHistory, setBettingHistory] = useState([]);
  const [activeBets, setActiveBets] = useState([]);
  const [selectedBets, setSelectedBets] = useState({});
  const [parlayBets, setParlayBets] = useState([]);
  const [showParlayModal, setShowParlayModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showActiveBetsModal, setShowActiveBetsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    fetchBettingData();
  }, []);

  const fetchBettingData = async () => {
    try {
      const [fightsRes, coinsRes, historyRes, activeRes] = await Promise.all([
        axios.get('/api/betting/available-fights'),
        axios.get(`/api/users/${user?.id}/coins`),
        axios.get(`/api/betting/history/${user?.id}`),
        axios.get(`/api/betting/active-bets/${user?.id}`)
      ]);

      setAvailableFights(fightsRes.data || []);
      setUserCoins(coinsRes.data?.coins || 0);
      setBettingHistory(historyRes.data || []);
      setActiveBets(activeRes.data || []);
    } catch (error) {
      console.error('Error fetching betting data:', error);
    }
  };

  const placeBet = async (fightId, prediction, amount) => {
    if (!amount || amount <= 0) {
      alert('Please enter a valid bet amount.');
      return;
    }

    if (amount > userCoins) {
      alert('Insufficient eurodolary for this bet.');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post('/api/betting/place-bet', {
        userId: user.id,
        fightId,
        prediction,
        amount,
        timestamp: new Date().toISOString()
      });

      setUserCoins(prev => prev - amount);
      setSelectedBets(prev => ({
        ...prev,
        [fightId]: { prediction, amount }
      }));

      alert(`Bet placed: ${amount} eurodolary on ${prediction}`);
      fetchBettingData();
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('Failed to place bet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const placeParlayBet = async () => {
    if (parlayBets.length < 2) {
      alert('Parlay must include at least 2 bets.');
      return;
    }

    const totalAmount = parlayBets.reduce((sum, bet) => sum + bet.amount, 0);
    if (totalAmount > userCoins) {
      alert('Insufficient eurodolary for this parlay.');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post('/api/betting/place-parlay', {
        userId: user.id,
        bets: parlayBets,
        totalAmount,
        timestamp: new Date().toISOString()
      });

      setUserCoins(prev => prev - totalAmount);
      setParlayBets([]);
      setShowParlayModal(false);

      alert('Parlay bet placed successfully!');
      fetchBettingData();
    } catch (error) {
      console.error('Error placing parlay bet:', error);
      alert('Failed to place parlay bet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addToParlay = (fightId, prediction, amount) => {
    const fight = availableFights.find(f => f.id === fightId);
    if (!fight) return;

    const existingIndex = parlayBets.findIndex(bet => bet.fightId === fightId);
    if (existingIndex >= 0) {
      // Update existing bet
      const updatedBets = [...parlayBets];
      updatedBets[existingIndex] = { fightId, prediction, amount, fight };
      setParlayBets(updatedBets);
    } else {
      // Add new bet
      setParlayBets(prev => [...prev, { fightId, prediction, amount, fight }]);
    }
  };

  const removeFromParlay = (fightId) => {
    setParlayBets(prev => prev.filter(bet => bet.fightId !== fightId));
  };

  const calculateParlayOdds = () => {
    if (parlayBets.length === 0) return 1;
    
    return parlayBets.reduce((total, bet) => {
      const fight = bet.fight;
      const odds = bet.prediction === 'team1' ? 
        (fight.totalBets?.team2 || 1) / (fight.totalBets?.team1 || 1) :
        (fight.totalBets?.team1 || 1) / (fight.totalBets?.team2 || 1);
      return total * Math.max(odds, 1.1); // Minimum 1.1 odds
    }, 1);
  };

  const calculatePotentialWinnings = (fightId, prediction, amount) => {
    const fight = availableFights.find(f => f.id === fightId);
    if (!fight) return amount;

    const team1Bets = fight.totalBets?.team1 || 1;
    const team2Bets = fight.totalBets?.team2 || 1;
    const totalPool = team1Bets + team2Bets;

    if (prediction === 'team1') {
      return Math.floor((amount * totalPool) / team1Bets);
    } else {
      return Math.floor((amount * totalPool) / team2Bets);
    }
  };

  const getBettingStats = () => {
    const totalBets = bettingHistory.length;
    const wonBets = bettingHistory.filter(bet => bet.result === 'won').length;
    const totalWagered = bettingHistory.reduce((sum, bet) => sum + bet.amount, 0);
    const totalWon = bettingHistory
      .filter(bet => bet.result === 'won')
      .reduce((sum, bet) => sum + bet.winnings, 0);
    const winRate = totalBets > 0 ? (wonBets / totalBets) * 100 : 0;
    const profit = totalWon - totalWagered;

    return {
      totalBets,
      wonBets,
      totalWagered,
      totalWon,
      winRate: Math.round(winRate),
      profit
    };
  };

  const formatTimeRemaining = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff <= 0) return 'Betting Closed';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const BettingStats = () => {
    const stats = getBettingStats();
    
    return (
      <div className="betting-stats-modal">
        <div className="modal-header">
          <h2>📊 Betting Statistics</h2>
          <button className="close-btn" onClick={() => setShowStatsModal(false)}>×</button>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-info">
              <span className="stat-number">{stats.totalBets}</span>
              <span className="stat-label">Total Bets</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <span className="stat-number">{stats.wonBets}</span>
              <span className="stat-label">Won Bets</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-info">
              <span className="stat-number">{stats.winRate}%</span>
              <span className="stat-label">Win Rate</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <span className="stat-number">🪙 {stats.totalWagered}</span>
              <span className="stat-label">Total Wagered</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-info">
              <span className="stat-number">🪙 {stats.totalWon}</span>
              <span className="stat-label">Total Won</span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <span className={`stat-number ${stats.profit >= 0 ? 'positive' : 'negative'}`}>
                🪙 {stats.profit >= 0 ? '+' : ''}{stats.profit}
              </span>
              <span className="stat-label">Net Profit</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ActiveBetsModal = () => (
    <div className="active-bets-modal">
      <div className="modal-header">
        <h2>🎯 Active Bets</h2>
        <button className="close-btn" onClick={() => setShowActiveBetsModal(false)}>×</button>
      </div>
      
      <div className="active-bets-list">
        {activeBets.map(bet => (
          <div key={bet.id} className="active-bet-item">
            <div className="bet-fight-info">
              <span className="fight-matchup">
                {bet.fight.team1.name} vs {bet.fight.team2.name}
              </span>
              <span className="bet-prediction">Bet on: {bet.prediction}</span>
            </div>
            
            <div className="bet-details">
              <span className="bet-amount">🪙 {bet.amount}</span>
              <span className="potential-winnings">
                Potential: 🪙 {bet.potentialWinnings}
              </span>
            </div>
            
            <div className="bet-status">
              <span className="status-badge active">⏳ Active</span>
              <span className="time-remaining">
                {formatTimeRemaining(bet.fight.bettingEndTime)}
              </span>
            </div>
          </div>
        ))}
        
        {activeBets.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🎯</span>
            <p>No active bets</p>
            <p>Place some bets to see them here!</p>
          </div>
        )}
      </div>
    </div>
  );

  const BettingHistoryModal = () => (
    <div className="betting-history-modal">
      <div className="modal-header">
        <h2>📜 Betting History</h2>
        <button className="close-btn" onClick={() => setShowHistoryModal(false)}>×</button>
      </div>
      
      <div className="history-list">
        {bettingHistory.map(bet => (
          <div key={bet.id} className={`history-item ${bet.result}`}>
            <div className="bet-info">
              <span className="fight-matchup">
                {bet.fight.team1.name} vs {bet.fight.team2.name}
              </span>
              <span className="bet-prediction">Bet on: {bet.prediction}</span>
              <span className="bet-amount">Amount: 🪙 {bet.amount}</span>
              <span className="bet-date">
                {new Date(bet.timestamp).toLocaleDateString()}
              </span>
            </div>
            
            <div className="bet-result">
              {bet.result === 'won' && (
                <>
                  <span className="result-badge won">✅ Won</span>
                  <span className="winnings">+🪙 {bet.winnings}</span>
                </>
              )}
              {bet.result === 'lost' && (
                <>
                  <span className="result-badge lost">❌ Lost</span>
                  <span className="loss">-🪙 {bet.amount}</span>
                </>
              )}
              {bet.result === 'pending' && (
                <span className="result-badge pending">⏳ Pending</span>
              )}
            </div>
          </div>
        ))}
        
        {bettingHistory.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">📜</span>
            <p>No betting history</p>
            <p>Start betting to see your history here!</p>
          </div>
        )}
      </div>
    </div>
  );

  const ParlayModal = () => (
    <div className="parlay-modal">
      <div className="modal-header">
        <h2>🎰 Parlay Bet</h2>
        <button className="close-btn" onClick={() => setShowParlayModal(false)}>×</button>
      </div>
      
      <div className="parlay-content">
        <div className="parlay-bets">
          <h3>Selected Bets ({parlayBets.length})</h3>
          {parlayBets.map((bet, index) => (
            <div key={bet.fightId} className="parlay-bet-item">
              <div className="bet-info">
                <span className="bet-number">#{index + 1}</span>
                <span className="fight-matchup">
                  {bet.fight.team1.name} vs {bet.fight.team2.name}
                </span>
                <span className="bet-prediction">{bet.prediction}</span>
              </div>
              
              <div className="bet-actions">
                <input
                  type="number"
                  min="1"
                  max={userCoins}
                  value={bet.amount}
                  onChange={(e) => {
                    const updatedBets = [...parlayBets];
                    updatedBets[index].amount = parseInt(e.target.value) || 0;
                    setParlayBets(updatedBets);
                  }}
                  placeholder="Amount"
                />
                <button 
                  className="remove-btn"
                  onClick={() => removeFromParlay(bet.fightId)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {parlayBets.length > 0 && (
          <div className="parlay-summary">
            <div className="summary-item">
              <span>Total Bets:</span>
              <span>{parlayBets.length}</span>
            </div>
            <div className="summary-item">
              <span>Total Amount:</span>
              <span>🪙 {parlayBets.reduce((sum, bet) => sum + bet.amount, 0)}</span>
            </div>
            <div className="summary-item">
              <span>Parlay Odds:</span>
              <span>{calculateParlayOdds().toFixed(2)}:1</span>
            </div>
            <div className="summary-item">
              <span>Potential Winnings:</span>
              <span>🪙 {Math.floor(parlayBets.reduce((sum, bet) => sum + bet.amount, 0) * calculateParlayOdds())}</span>
            </div>
          </div>
        )}
        
        <div className="parlay-actions">
          <button 
            className="place-parlay-btn"
            onClick={placeParlayBet}
            disabled={parlayBets.length < 2 || isLoading}
          >
            {isLoading ? 'Processing...' : 'Place Parlay Bet'}
          </button>
          <button 
            className="cancel-btn"
            onClick={() => setShowParlayModal(false)}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="enhanced-betting-system">
      <div className="betting-header">
        <h1>🎰 Enhanced Betting System</h1>
        <p>Bet on official fights with eurodolary and create parlays for bigger rewards!</p>
        
        <div className="user-wallet">
          <div className="coin-balance">
            <span className="balance-label">Your Balance:</span>
            <span className="balance-amount">🪙 {userCoins.toLocaleString()}</span>
          </div>
          
          <div className="betting-actions">
            <button 
              className="stats-btn"
              onClick={() => setShowStatsModal(true)}
            >
              📊 Stats
            </button>
            <button 
              className="active-bets-btn"
              onClick={() => setShowActiveBetsModal(true)}
            >
              🎯 Active ({activeBets.length})
            </button>
            <button 
              className="history-btn"
              onClick={() => setShowHistoryModal(true)}
            >
              📜 History
            </button>
            <button 
              className="parlay-btn"
              onClick={() => setShowParlayModal(true)}
              disabled={parlayBets.length === 0}
            >
              🎰 Parlay ({parlayBets.length})
            </button>
          </div>
        </div>
      </div>

      <div className="betting-info">
        <div className="info-card">
          <h3>📅 Betting Schedule</h3>
          <p>• Betting opens 24 hours before each fight</p>
          <p>• Betting closes when the fight begins</p>
          <p>• Results are determined by community voting</p>
        </div>
        
        <div className="info-card">
          <h3>💰 How It Works</h3>
          <p>• Bet on individual fights or create parlays</p>
          <p>• Odds are calculated based on betting patterns</p>
          <p>• Win eurodolary when your predictions are correct</p>
        </div>
        
        <div className="info-card">
          <h3>🎰 Parlay Bets</h3>
          <p>• Combine multiple bets for higher rewards</p>
          <p>• All bets must win to collect winnings</p>
          <p>• Higher risk, higher potential reward</p>
        </div>
      </div>

      <div className="available-fights">
        <h2>🔥 Available Fights</h2>
        <div className="fights-grid">
          {availableFights.map(fight => (
            <div key={fight.id} className="fight-card">
              <div className="fight-header">
                <span className="fight-title">{fight.title}</span>
                <span className="betting-status">
                  {formatTimeRemaining(fight.bettingEndTime)}
                </span>
              </div>
              
              <div className="teams-display">
                <div className="team-side">
                  <div className="team-info">
                    <span className="team-name">{fight.team1.name}</span>
                    <span className="team-record">{fight.team1.record}</span>
                  </div>
                  <div className="team-fighters">
                    {fight.team1.fighters.map(fighter => (
                      <img key={fighter.id} {...getOptimizedImageProps(fighter.image, { size: 100 })} alt={fighter.name} />
                    ))}
                  </div>
                </div>
                
                <div className="vs-section">
                  <span className="vs">VS</span>
                  <div className="total-pool">
                    Total Pool: 🪙{fight.totalPool || 0}
                  </div>
                </div>
                
                <div className="team-side">
                  <div className="team-info">
                    <span className="team-name">{fight.team2.name}</span>
                    <span className="team-record">{fight.team2.record}</span>
                  </div>
                  <div className="team-fighters">
                    {fight.team2.fighters.map(fighter => (
                      <img key={fighter.id} {...getOptimizedImageProps(fighter.image, { size: 100 })} alt={fighter.name} />
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="betting-options">
                <div className="bet-option">
                  <div className="odds-display">
                    <span className="odds">
                      {fight.totalBets?.team2 || 1}:{fight.totalBets?.team1 || 1}
                    </span>
                    <span className="team-label">{fight.team1.name}</span>
                  </div>
                  
                  <div className="bet-controls">
                    <input
                      type="number"
                      min="1"
                      max={userCoins}
                      placeholder="Bet amount"
                      onChange={(e) => {
                        const amount = parseInt(e.target.value) || 0;
                        setSelectedBets(prev => ({
                          ...prev,
                          [fight.id]: { ...prev[fight.id], team1: amount }
                        }));
                      }}
                    />
                    <button 
                      onClick={() => {
                        const amount = selectedBets[fight.id]?.team1 || 0;
                        if (amount > 0) {
                          placeBet(fight.id, 'team1', amount);
                        }
                      }}
                      disabled={isLoading}
                    >
                      Bet
                    </button>
                    <button 
                      className="parlay-add-btn"
                      onClick={() => {
                        const amount = selectedBets[fight.id]?.team1 || 10;
                        addToParlay(fight.id, 'team1', amount);
                      }}
                    >
                      +Parlay
                    </button>
                  </div>
                </div>
                
                <div className="bet-option">
                  <div className="odds-display">
                    <span className="odds">
                      {fight.totalBets?.team1 || 1}:{fight.totalBets?.team2 || 1}
                    </span>
                    <span className="team-label">{fight.team2.name}</span>
                  </div>
                  
                  <div className="bet-controls">
                    <input
                      type="number"
                      min="1"
                      max={userCoins}
                      placeholder="Bet amount"
                      onChange={(e) => {
                        const amount = parseInt(e.target.value) || 0;
                        setSelectedBets(prev => ({
                          ...prev,
                          [fight.id]: { ...prev[fight.id], team2: amount }
                        }));
                      }}
                    />
                    <button 
                      onClick={() => {
                        const amount = selectedBets[fight.id]?.team2 || 0;
                        if (amount > 0) {
                          placeBet(fight.id, 'team2', amount);
                        }
                      }}
                      disabled={isLoading}
                    >
                      Bet
                    </button>
                    <button 
                      className="parlay-add-btn"
                      onClick={() => {
                        const amount = selectedBets[fight.id]?.team2 || 10;
                        addToParlay(fight.id, 'team2', amount);
                      }}
                    >
                      +Parlay
                    </button>
                  </div>
                </div>
              </div>
              
              {selectedBets[fight.id] && (
                <div className="user-bet-status">
                  ✅ You have bets on this fight
                  {selectedBets[fight.id].team1 && (
                    <span> • {fight.team1.name}: 🪙{selectedBets[fight.id].team1}</span>
                  )}
                  {selectedBets[fight.id].team2 && (
                    <span> • {fight.team2.name}: 🪙{selectedBets[fight.id].team2}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {availableFights.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🎰</span>
            <h3>No fights available for betting</h3>
            <p>Check back later for new betting opportunities!</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showStatsModal && (
        <div className="modal-overlay" onClick={() => setShowStatsModal(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <BettingStats />
          </div>
        </div>
      )}
      
      {showActiveBetsModal && (
        <div className="modal-overlay" onClick={() => setShowActiveBetsModal(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <ActiveBetsModal />
          </div>
        </div>
      )}
      
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <BettingHistoryModal />
          </div>
        </div>
      )}
      
      {showParlayModal && (
        <div className="modal-overlay" onClick={() => setShowParlayModal(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <ParlayModal />
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedBettingSystem;
