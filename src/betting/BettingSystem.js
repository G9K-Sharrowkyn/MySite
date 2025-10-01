import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './BettingSystem.css';

const BettingSystem = () => {
  const { user } = useContext(AuthContext);
  const [availableFights, setAvailableFights] = useState([]);
  const [myBets, setMyBets] = useState([]);
  const [activeTab, setActiveTab] = useState('available');
  const [loading, setLoading] = useState(true);
  const [selectedFight, setSelectedFight] = useState(null);
  const [showBetModal, setShowBetModal] = useState(false);

  useEffect(() => {
    fetchAvailableFights();
    fetchMyBets();
  }, []);

  const fetchAvailableFights = async () => {
    try {
      const response = await fetch('/api/betting/fights', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setAvailableFights(data.fights);
      }
    } catch (error) {
      console.error('Error fetching available fights:', error);
    }
  };

  const fetchMyBets = async () => {
    try {
      const response = await fetch('/api/betting/my-bets', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setMyBets(data.bets);
      }
    } catch (error) {
      console.error('Error fetching my bets:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeRemaining = (closeTime) => {
    const now = new Date();
    const close = new Date(closeTime);
    const diff = close - now;
    
    if (diff <= 0) return 'Zamknięte';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const openBetModal = (fight) => {
    setSelectedFight(fight);
    setShowBetModal(true);
  };

  if (loading) {
    return (
      <div className="betting-system">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Ładowanie zakładów...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="betting-system">
      <div className="betting-header">
        <h1>🎰 System Zakładów</h1>
        <div className="user-coins">
          <span className="coins-icon">🪙</span>
          <span className="coins-amount">{user?.virtualCoins || 0}</span>
        </div>
      </div>

      <div className="betting-tabs">
        <button 
          className={`tab ${activeTab === 'available' ? 'active' : ''}`}
          onClick={() => setActiveTab('available')}
        >
          Dostępne Walki ({availableFights.length})
        </button>
        <button 
          className={`tab ${activeTab === 'my-bets' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-bets')}
        >
          Moje Zakłady ({myBets.length})
        </button>
        <button 
          className={`tab ${activeTab === 'parlay' ? 'active' : ''}`}
          onClick={() => setActiveTab('parlay')}
        >
          Zakłady Parlay
        </button>
      </div>

      <div className="betting-content">
        {activeTab === 'available' && (
          <AvailableFights 
            fights={availableFights} 
            onBetClick={openBetModal}
            formatTimeRemaining={formatTimeRemaining}
          />
        )}
        
        {activeTab === 'my-bets' && (
          <MyBets bets={myBets} />
        )}
        
        {activeTab === 'parlay' && (
          <ParlayBetting fights={availableFights} />
        )}
      </div>

      {showBetModal && (
        <BetModal 
          fight={selectedFight}
          onClose={() => setShowBetModal(false)}
          onBetPlaced={() => {
            fetchAvailableFights();
            fetchMyBets();
            setShowBetModal(false);
          }}
        />
      )}
    </div>
  );
};

// Komponent dostępnych walk
const AvailableFights = ({ fights, onBetClick, formatTimeRemaining }) => {
  if (fights.length === 0) {
    return (
      <div className="no-fights">
        <h3>🚫 Brak dostępnych walk</h3>
        <p>Obecnie nie ma walk z otwartymi zakładami.</p>
      </div>
    );
  }

  return (
    <div className="available-fights">
      {fights.map(fight => (
        <div key={fight._id} className="fight-card">
          <div className="fight-header">
            <h3>{fight.title}</h3>
            <div className="betting-window">
              <span className="time-remaining">
                ⏰ {formatTimeRemaining(fight.betting.bettingWindow.closeTime)}
              </span>
            </div>
          </div>

          <div className="fight-teams">
            <div className="team team-a">
              <div className="team-info">
                <div className="team-characters">
                  {fight.teamA.map((char, idx) => (
                    <div key={idx} className="character">
                      <img src={char.characterImage} alt={char.characterName} />
                      <span>{char.characterName}</span>
                    </div>
                  ))}
                </div>
                <div className="odds">
                  Kurs: {fight.betting.oddsA}
                </div>
              </div>
              <button 
                className="bet-button team-a-btn"
                onClick={() => onBetClick(fight)}
              >
                Postaw na A
              </button>
            </div>

            <div className="vs-divider">VS</div>

            <div className="team team-b">
              <div className="team-info">
                <div className="team-characters">
                  {fight.teamB.map((char, idx) => (
                    <div key={idx} className="character">
                      <img src={char.characterImage} alt={char.characterName} />
                      <span>{char.characterName}</span>
                    </div>
                  ))}
                </div>
                <div className="odds">
                  Kurs: {fight.betting.oddsB}
                </div>
              </div>
              <button 
                className="bet-button team-b-btn"
                onClick={() => onBetClick(fight)}
              >
                Postaw na B
              </button>
            </div>
          </div>

          <div className="fight-stats">
            <div className="stat">
              <span>Głosy A:</span>
              <span>{fight.votesA || 0}</span>
            </div>
            <div className="stat">
              <span>Głosy B:</span>
              <span>{fight.votesB || 0}</span>
            </div>
            <div className="stat">
              <span>Zakłady A:</span>
              <span>{fight.betting.totalBetsA || 0}</span>
            </div>
            <div className="stat">
              <span>Zakłady B:</span>
              <span>{fight.betting.totalBetsB || 0}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Komponent moich zakładów
const MyBets = ({ bets }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'won': return '🏆';
      case 'lost': return '❌';
      case 'active': return '⏳';
      case 'cancelled': return '🚫';
      default: return '❓';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'won': return '#4CAF50';
      case 'lost': return '#f44336';
      case 'active': return '#2196F3';
      case 'cancelled': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  if (bets.length === 0) {
    return (
      <div className="no-bets">
        <h3>📋 Brak zakładów</h3>
        <p>Nie masz jeszcze żadnych zakładów.</p>
      </div>
    );
  }

  return (
    <div className="my-bets">
      {bets.map(bet => (
        <div key={bet._id} className="bet-card">
          <div className="bet-header">
            <div className="bet-type">
              {bet.type === 'parlay' ? '🎯 Parlay' : '🎲 Pojedynczy'}
            </div>
            <div 
              className="bet-status"
              style={{ color: getStatusColor(bet.status) }}
            >
              {getStatusIcon(bet.status)} {bet.status.toUpperCase()}
            </div>
          </div>

          {bet.type === 'single' ? (
            <div className="single-bet">
              <div className="bet-details">
                <h4>{bet.fightDetails?.title || 'Nieznana walka'}</h4>
                <div className="bet-info">
                  <span>Predykcja: Zespół {bet.prediction}</span>
                  <span>Kurs: {bet.odds}</span>
                  <span>Stawka: {bet.amount} 🪙</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="parlay-bet">
              <div className="parlay-details">
                <h4>Zakład Parlay ({bet.parlayBets.length} walk)</h4>
                <div className="parlay-fights">
                  {bet.parlayBets.map((parlayBet, idx) => (
                    <div key={idx} className="parlay-fight">
                      <span>{parlayBet.fightTitle}</span>
                      <span>Zespół {parlayBet.prediction} ({parlayBet.odds})</span>
                    </div>
                  ))}
                </div>
                <div className="bet-info">
                  <span>Łączny kurs: {bet.totalOdds}</span>
                  <span>Stawka: {bet.amount} 🪙</span>
                </div>
              </div>
            </div>
          )}

          <div className="bet-footer">
            <div className="bet-amounts">
              <span>Potencjalna wygrana: {bet.potentialWinnings} 🪙</span>
              {bet.result?.winnings > 0 && (
                <span className="actual-winnings">
                  Wygrane: {bet.result.winnings} 🪙
                </span>
              )}
            </div>
            <div className="bet-date">
              {new Date(bet.placedAt).toLocaleDateString('pl-PL')}
            </div>
          </div>

          {bet.insurance?.enabled && (
            <div className="insurance-info">
              🛡️ Ubezpieczenie: {bet.insurance.refundPercentage}% zwrotu
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Komponent zakładów parlay
const ParlayBetting = ({ fights }) => {
  const [selectedFights, setSelectedFights] = useState([]);
  const [betAmount, setBetAmount] = useState('');
  const [insurance, setInsurance] = useState(false);

  const addToParlayBet = (fight, prediction) => {
    const existingIndex = selectedFights.findIndex(f => f.fightId === fight._id);
    
    if (existingIndex >= 0) {
      // Aktualizuj predykcję
      const updated = [...selectedFights];
      updated[existingIndex].prediction = prediction;
      setSelectedFights(updated);
    } else {
      // Dodaj nową walkę
      setSelectedFights([...selectedFights, {
        fightId: fight._id,
        title: fight.title,
        prediction,
        odds: prediction === 'A' ? fight.betting.oddsA : fight.betting.oddsB
      }]);
    }
  };

  const removeFromParlay = (fightId) => {
    setSelectedFights(selectedFights.filter(f => f.fightId !== fightId));
  };

  const calculateTotalOdds = () => {
    return selectedFights.reduce((total, fight) => total * fight.odds, 1);
  };

  const calculatePotentialWinnings = () => {
    const amount = parseFloat(betAmount) || 0;
    const totalOdds = calculateTotalOdds();
    const multiplier = 1.2; // bonus parlay
    return Math.round(amount * totalOdds * multiplier);
  };

  const placeParlayBet = async () => {
    if (selectedFights.length < 2) {
      alert('Zakład parlay wymaga minimum 2 walk');
      return;
    }

    if (!betAmount || parseFloat(betAmount) < 1) {
      alert('Minimalna stawka to 1 moneta');
      return;
    }

    try {
      const response = await fetch('/api/betting/parlay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          bets: selectedFights.map(f => ({
            fightId: f.fightId,
            prediction: f.prediction
          })),
          amount: parseFloat(betAmount),
          insurance
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Zakład parlay został postawiony pomyślnie!');
        setSelectedFights([]);
        setBetAmount('');
        setInsurance(false);
      } else {
        alert(data.error || 'Błąd podczas stawiania zakładu');
      }
    } catch (error) {
      console.error('Error placing parlay bet:', error);
      alert('Błąd serwera');
    }
  };

  return (
    <div className="parlay-betting">
      <div className="parlay-header">
        <h3>🎯 Zakłady Parlay</h3>
        <p>Wybierz minimum 2 walki i postaw na wszystkie jednocześnie. Bonus +20%!</p>
      </div>

      <div className="parlay-content">
        <div className="available-fights-parlay">
          <h4>Dostępne walki:</h4>
          {fights.map(fight => (
            <div key={fight._id} className="parlay-fight-option">
              <div className="fight-info">
                <h5>{fight.title}</h5>
                <div className="fight-teams-simple">
                  <button 
                    className={`team-btn ${selectedFights.find(f => f.fightId === fight._id && f.prediction === 'A') ? 'selected' : ''}`}
                    onClick={() => addToParlayBet(fight, 'A')}
                  >
                    Zespół A ({fight.betting.oddsA})
                  </button>
                  <button 
                    className={`team-btn ${selectedFights.find(f => f.fightId === fight._id && f.prediction === 'B') ? 'selected' : ''}`}
                    onClick={() => addToParlayBet(fight, 'B')}
                  >
                    Zespół B ({fight.betting.oddsB})
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="parlay-summary">
          <h4>Twój zakład parlay:</h4>
          
          {selectedFights.length === 0 ? (
            <p>Wybierz walki do zakładu parlay</p>
          ) : (
            <>
              <div className="selected-fights">
                {selectedFights.map(fight => (
                  <div key={fight.fightId} className="selected-fight">
                    <span>{fight.title} - Zespół {fight.prediction} ({fight.odds})</span>
                    <button 
                      className="remove-btn"
                      onClick={() => removeFromParlay(fight.fightId)}
                    >
                      ❌
                    </button>
                  </div>
                ))}
              </div>

              <div className="parlay-calculations">
                <div className="calc-row">
                  <span>Łączny kurs:</span>
                  <span>{calculateTotalOdds().toFixed(2)}</span>
                </div>
                <div className="calc-row">
                  <span>Bonus parlay:</span>
                  <span>+20%</span>
                </div>
                <div className="calc-row total">
                  <span>Potencjalna wygrana:</span>
                  <span>{calculatePotentialWinnings()} 🪙</span>
                </div>
              </div>

              <div className="parlay-controls">
                <div className="amount-input">
                  <label>Stawka:</label>
                  <input 
                    type="number"
                    min="1"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="Wprowadź stawkę"
                  />
                  <span>🪙</span>
                </div>

                <div className="insurance-option">
                  <label>
                    <input 
                      type="checkbox"
                      checked={insurance}
                      onChange={(e) => setInsurance(e.target.checked)}
                    />
                    🛡️ Ubezpieczenie (+15% stawki, 25% zwrotu przy przegranej)
                  </label>
                </div>

                <button 
                  className="place-parlay-btn"
                  onClick={placeParlayBet}
                  disabled={selectedFights.length < 2 || !betAmount}
                >
                  Postaw zakład parlay
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Modal do stawiania zakładu
const BetModal = ({ fight, onClose, onBetPlaced }) => {
  const { user } = useContext(AuthContext);
  const [selectedTeam, setSelectedTeam] = useState('A');
  const [betAmount, setBetAmount] = useState('');
  const [insurance, setInsurance] = useState(false);
  const [loading, setLoading] = useState(false);

  const getOdds = () => {
    return selectedTeam === 'A' ? fight.betting.oddsA : fight.betting.oddsB;
  };

  const calculatePotentialWinnings = () => {
    const amount = parseFloat(betAmount) || 0;
    return Math.round(amount * getOdds());
  };

  const calculateInsuranceCost = () => {
    const amount = parseFloat(betAmount) || 0;
    return Math.ceil(amount * 0.1);
  };

  const placeBet = async () => {
    if (!betAmount || parseFloat(betAmount) < 1) {
      alert('Minimalna stawka to 1 moneta');
      return;
    }

    if (parseFloat(betAmount) > user.virtualCoins) {
      alert('Niewystarczająca ilość monet');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/betting/place/${fight._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          prediction: selectedTeam,
          amount: parseFloat(betAmount),
          insurance
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Zakład został postawiony pomyślnie!');
        onBetPlaced();
      } else {
        alert(data.error || 'Błąd podczas stawiania zakładu');
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('Błąd serwera');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bet-modal-overlay" onClick={onClose}>
      <div className="bet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🎲 Postaw zakład</h3>
          <button className="close-btn" onClick={onClose}>❌</button>
        </div>

        <div className="modal-content">
          <div className="fight-info">
            <h4>{fight.title}</h4>
            <div className="teams-selection">
              <div 
                className={`team-option ${selectedTeam === 'A' ? 'selected' : ''}`}
                onClick={() => setSelectedTeam('A')}
              >
                <div className="team-characters">
                  {fight.teamA.map((char, idx) => (
                    <div key={idx} className="character">
                      <img src={char.characterImage} alt={char.characterName} />
                      <span>{char.characterName}</span>
                    </div>
                  ))}
                </div>
                <div className="odds">Kurs: {fight.betting.oddsA}</div>
              </div>

              <div 
                className={`team-option ${selectedTeam === 'B' ? 'selected' : ''}`}
                onClick={() => setSelectedTeam('B')}
              >
                <div className="team-characters">
                  {fight.teamB.map((char, idx) => (
                    <div key={idx} className="character">
                      <img src={char.characterImage} alt={char.characterName} />
                      <span>{char.characterName}</span>
                    </div>
                  ))}
                </div>
                <div className="odds">Kurs: {fight.betting.oddsB}</div>
              </div>
            </div>
          </div>

          <div className="bet-controls">
            <div className="amount-input">
              <label>Stawka:</label>
              <input 
                type="number"
                min="1"
                max={user?.virtualCoins || 0}
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="Wprowadź stawkę"
              />
              <span>🪙</span>
            </div>

            <div className="quick-amounts">
              <button onClick={() => setBetAmount('10')}>10</button>
              <button onClick={() => setBetAmount('25')}>25</button>
              <button onClick={() => setBetAmount('50')}>50</button>
              <button onClick={() => setBetAmount('100')}>100</button>
            </div>

            <div className="insurance-option">
              <label>
                <input 
                  type="checkbox"
                  checked={insurance}
                  onChange={(e) => setInsurance(e.target.checked)}
                />
                🛡️ Ubezpieczenie (+{calculateInsuranceCost()} 🪙, 50% zwrotu przy przegranej)
              </label>
            </div>

            <div className="bet-summary">
              <div className="summary-row">
                <span>Stawka:</span>
                <span>{betAmount || 0} 🪙</span>
              </div>
              {insurance && (
                <div className="summary-row">
                  <span>Ubezpieczenie:</span>
                  <span>{calculateInsuranceCost()} 🪙</span>
                </div>
              )}
              <div className="summary-row total">
                <span>Łączny koszt:</span>
                <span>{(parseFloat(betAmount) || 0) + (insurance ? calculateInsuranceCost() : 0)} 🪙</span>
              </div>
              <div className="summary-row potential">
                <span>Potencjalna wygrana:</span>
                <span>{calculatePotentialWinnings()} 🪙</span>
              </div>
            </div>

            <button 
              className="place-bet-btn"
              onClick={placeBet}
              disabled={loading || !betAmount || parseFloat(betAmount) < 1}
            >
              {loading ? 'Stawianie...' : 'Postaw zakład'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BettingSystem;