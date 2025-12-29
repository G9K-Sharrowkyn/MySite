import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import './PowerTierDivisions.css';

const PowerTierDivisions = ({ user, isModerator }) => {
  const [userTeams, setUserTeams] = useState({});
  const [activeFights, setActiveFights] = useState([]);
  const [bettingFights, setBettingFights] = useState([]);
  const [leaderboards, setLeaderboards] = useState({});
  const [championshipHistory, setChampionshipHistory] = useState({});
  const [userCoins, setUserCoins] = useState(0);
  const [selectedBets, setSelectedBets] = useState({});
  const [betAmounts, setBetAmounts] = useState({});
  const [showHistoryDivisionId, setShowHistoryDivisionId] = useState(null);

  // Power-tier division definitions
  const divisionTiers = {
    regularPeople: {
      id: 'regular_people',
      name: 'Regular People',
      description: 'Ordinary humans with no superpowers',
      icon: 'RP',
      color: '#6c757d',
      powerRange: '1-10',
      examples: ['Jim Ross', 'Lois Lane', 'Ivan Drago', 'John Wick', 'Rocky Balboa']
    },
    metahuman: {
      id: 'metahuman',
      name: 'Metahuman',
      description: 'Enhanced humans with moderate superpowers',
      icon: 'MH',
      color: '#28a745',
      powerRange: '11-100',
      examples: ['Spider-Man', 'Cyclops', 'Captain America', 'Daredevil', 'Green Arrow']
    },
    planetBusters: {
      id: 'planet_busters',
      name: 'Planet Busters',
      description: 'Beings capable of destroying planets',
      icon: 'PB',
      color: '#ffc107',
      powerRange: '101-1000',
      examples: ['Hulk', 'Krillin', 'Piccolo', 'Iron Man', 'Wonder Woman']
    },
    godTier: {
      id: 'god_tier',
      name: 'God Tier',
      description: 'Divine or god-like beings',
      icon: 'GT',
      color: '#dc3545',
      powerRange: '1001-10000',
      examples: ['Thor', 'Zeus', 'Cell', 'Silver Surfer', 'Doctor Strange']
    },
    universalThreat: {
      id: 'universal_threat',
      name: 'Universal Threat',
      description: 'Beings that threaten entire universes',
      icon: 'UT',
      color: '#6f42c1',
      powerRange: '10001-100000',
      examples: ['Anti-Monitor', 'Fused Zamasu', 'Galactus', 'Thanos (with Infinity Gauntlet)']
    }
  };

  const fetchAllDivisionData = useCallback(async () => {
    try {
      const [
        userTeamsRes,
        activeFightsRes,
        bettingFightsRes,
        leaderboardsRes,
        historyRes,
        coinsRes
      ] = await Promise.all([
        axios.get(`/api/divisions/user-teams/${user?.id}`),
        axios.get('/api/divisions/active-fights'),
        axios.get('/api/divisions/betting-fights'),
        axios.get('/api/divisions/leaderboards'),
        axios.get('/api/divisions/championship-history'),
        axios.get(`/api/users/${user?.id}/coins`)
      ]);
      setUserTeams(userTeamsRes.data || {});
      setActiveFights(activeFightsRes.data || []);
      setBettingFights(bettingFightsRes.data || []);
      setLeaderboards(leaderboardsRes.data || {});
      setChampionshipHistory(historyRes.data || {});
      setUserCoins(coinsRes.data?.coins || 0);
    } catch (error) {
      console.error('Error fetching division data:', error);
    }
  }, [user?.id]);

  const createOfficialFight = async (team1Id, team2Id, divisionId, isTitle = false, isContender = false) => {
    if (!isModerator) return;

    try {
      await axios.post('/api/divisions/create-official-fight', {
        team1Id,
        team2Id,
        divisionId,
        isTitle,
        isContender,
        bettingPeriod: 24, // 24 hours for betting
        fightDuration: 72, // 72 hours for voting after betting closes
        createdBy: user.id
      });

      fetchAllDivisionData();
      alert(`Official ${isTitle ? 'Title ' : isContender ? 'Contender ' : ''}fight created successfully!`);
    } catch (error) {
      console.error('Error creating fight:', error);
      alert('Failed to create fight.');
    }
  };

  const placeBet = async (fightId, prediction, amount) => {
    try {
      await axios.post('/api/betting/place-bet', {
        userId: user.id,
        fightId,
        prediction, // 'team1' or 'team2'
        amount
      });

      setSelectedBets(prev => ({
        ...prev,
        [fightId]: { prediction, amount }
      }));

      setUserCoins(prev => prev - amount);
      alert(`Bet placed: ${amount} coins on ${prediction}`);
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('Failed to place bet.');
    }
  };

  const calculatePotentialWinnings = (fightId, prediction, amount) => {
    const fight = bettingFights.find(f => f.id === fightId);
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

  useEffect(() => {
    fetchAllDivisionData();
  }, [fetchAllDivisionData]);

  const setBetAmount = (fightId, teamKey, amount) => {
    const normalized = Number.isFinite(amount) && amount > 0 ? amount : 0;
    setBetAmounts(prev => ({
      ...prev,
      [fightId]: {
        ...(prev[fightId] || {}),
        [teamKey]: normalized
      }
    }));
  };

  const getBetAmount = (fightId, teamKey) => {
    return betAmounts[fightId]?.[teamKey] || 0;
  };

  const calculateOdds = (fight, teamKey) => {
    const team1Bets = Number(fight?.totalBets?.team1 || 0);
    const team2Bets = Number(fight?.totalBets?.team2 || 0);
    const base = teamKey === 'team1' ? team1Bets : team2Bets;
    const other = teamKey === 'team1' ? team2Bets : team1Bets;
    const ratio = (other + 1) / (base + 1);
    return Math.max(1, Math.round(ratio * 10) / 10);
  };

  const calculateParlayMultiplier = () => {
    const entries = Object.entries(selectedBets);
    if (entries.length === 0) return 1;
    const multiplier = entries.reduce((total, [fightId, bet]) => {
      const fight = bettingFights.find((entry) => entry.id === fightId);
      if (!fight) return total;
      return total * calculateOdds(fight, bet.prediction);
    }, 1);
    return Math.round(multiplier * 100) / 100;
  };

  const placeParlayBet = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please log in to place a parlay bet.');
      return;
    }

    const bets = Object.entries(selectedBets).map(([fightId, bet]) => ({
      fightId,
      prediction: bet.prediction
    }));
    const amount = Object.values(selectedBets).reduce(
      (sum, bet) => sum + (Number(bet.amount) || 0),
      0
    );

    if (bets.length < 2 || amount <= 0) {
      alert('Select at least two bets with valid amounts.');
      return;
    }

    try {
      const response = await axios.post(
        '/api/betting/parlay',
        { bets, amount },
        { headers: { 'x-auth-token': token } }
      );
      if (typeof response.data?.remainingCoins === 'number') {
        setUserCoins(response.data.remainingCoins);
      }
      alert('Parlay bet placed successfully.');
    } catch (error) {
      console.error('Error placing parlay bet:', error);
      alert('Failed to place parlay bet.');
    }
  };

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const setShowHistory = (divisionId) => {
    setShowHistoryDivisionId((prev) => (prev === divisionId ? null : divisionId));
  };

  const getDivisionTeams = (divisionId) => leaderboards[divisionId] || [];

  const openFightCreator = (divisionId) => {
    const teams = getDivisionTeams(divisionId);
    if (teams.length < 2) {
      alert('Not enough teams to create a fight.');
      return;
    }
    createOfficialFight(teams[0].owner.id, teams[1].owner.id, divisionId);
  };

  const openContenderFightCreator = (divisionId) => {
    const teams = getDivisionTeams(divisionId);
    if (teams.length < 3) {
      alert('Not enough teams to create a contender fight.');
      return;
    }
    createOfficialFight(
      teams[1].owner.id,
      teams[2].owner.id,
      divisionId,
      false,
      true
    );
  };

  const openTitleFightCreator = (divisionId) => {
    const teams = getDivisionTeams(divisionId);
    if (teams.length < 2) {
      alert('Not enough teams to create a title fight.');
      return;
    }
    const champion = teams.find((team) => team.isChampion) || teams[0];
    const challenger = teams.find((team) => team !== champion) || teams[1];
    createOfficialFight(
      champion.owner.id,
      challenger.owner.id,
      divisionId,
      true,
      false
    );
  };

  const generateMatchSuggestions = (divisionId) => {
    const teams = getDivisionTeams(divisionId);
    const suggestions = [];
    for (let i = 0; i < teams.length - 1 && suggestions.length < 3; i += 2) {
      suggestions.push({ team1: teams[i], team2: teams[i + 1] });
    }
    return suggestions;
  };

  const formatTimeRemaining = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const DivisionLeaderboard = ({ divisionId }) => {
    const leaderboard = leaderboards[divisionId] || [];
    const history = championshipHistory[divisionId] || [];

    return (
      <div className="division-leaderboard">
        <div className="leaderboard-header">
          <h4>🏆 Leaderboard</h4>
          <button onClick={() => setShowHistory(divisionId)}>
            📚 Championship History
          </button>
        </div>
        
        <div className="rankings">
          {leaderboard.slice(0, 10).map((team, index) => (
            <div key={team.id} className={`ranking-item ${index < 3 ? `rank-${index + 1}` : ''}`}>
              <span className="rank">#{index + 1}</span>
              <div className="team-info">
                <div className="team-fighters">
                  {team.fighters.map(fighter => (
                    <img key={fighter.id} {...getOptimizedImageProps(fighter.image, { size: 120 })} alt={fighter.name} />
                  ))}
                </div>
                <span className="team-owner">{team.owner.username}</span>
              </div>
              <div className="team-record">
                <span className="wins">{team.wins}W</span>
                <span className="losses">{team.losses}L</span>
                <span className="percentage">
                  {team.wins + team.losses > 0 
                    ? Math.round((team.wins / (team.wins + team.losses)) * 100)
                    : 0}%
                </span>
              </div>
              {team.isChampion && <span className="champion-crown">👑</span>}
            </div>
          ))}
        </div>

        <div className="division-stats">
          <div className="stat-item">
            <span className="stat-number">{leaderboard.length}</span>
            <span className="stat-label">Active Teams</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {Math.round(leaderboard.reduce((acc, team) => acc + (team.averageVotes || 0), 0) / leaderboard.length) || 0}
            </span>
            <span className="stat-label">Avg Votes</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{history.length}</span>
            <span className="stat-label">Total Champions</span>
          </div>
        </div>
      </div>
    );
  };

  const BettingSection = () => (
    <div className="betting-section">
      <div className="betting-header">
        <h2>🎰 Fight Night Betting</h2>
        <div className="user-coins">
          <span className="coins-amount">🪙 {userCoins} coins</span>
        </div>
      </div>

      <div className="betting-info">
        <p>📅 Betting closes in 24 hours, then fights begin!</p>
        <p>💰 Bet on individual fights or create parlays for bigger rewards!</p>
      </div>

      <div className="betting-fights">
        {bettingFights.map(fight => (
          <div key={fight.id} className="betting-fight-card">
            <div className="fight-header">
              <span className="division-name">{fight.division.name}</span>
              {fight.isTitle && <span className="title-fight">👑 TITLE FIGHT</span>}
              {fight.isContender && <span className="contender-fight">🥊 CONTENDER FIGHT</span>}
              <span className="betting-timer">
                ⏰ Betting closes in {formatTimeRemaining(fight.bettingCloses)}
              </span>
            </div>

            <div className="fight-matchup">
              <div className="team-side">
                <div className="team-info">
                  <div className="team-fighters">
                    {fight.team1.fighters.map(fighter => (
                      <img key={fighter.id} {...getOptimizedImageProps(fighter.image, { size: 120 })} alt={fighter.name} />
                    ))}
                  </div>
                  <span className="team-owner">{fight.team1.owner.username}</span>
                  <span className="team-record">{fight.team1.record}</span>
                </div>
                <div className="betting-odds">
                  <span className="odds">
                    {calculateOdds(fight, 'team1')}:1
                  </span>
                  <div className="bet-controls">
                    <input
                      type="number"
                      min="1"
                      max={userCoins}
                      placeholder="Bet amount"
                      onChange={(e) => setBetAmount(fight.id, 'team1', parseInt(e.target.value))}
                    />
                    <button 
                      onClick={() => placeBet(fight.id, 'team1', getBetAmount(fight.id, 'team1'))}
                      disabled={!getBetAmount(fight.id, 'team1') || getBetAmount(fight.id, 'team1') > userCoins}
                    >
                      Bet
                    </button>
                  </div>
                </div>
              </div>

              <div className="vs-section">
                <span className="vs">VS</span>
                <div className="fight-pool">
                  Total Pool: 🪙{fight.totalPool || 0}
                </div>
              </div>

              <div className="team-side">
                <div className="team-info">
                  <div className="team-fighters">
                    {fight.team2.fighters.map(fighter => (
                      <img key={fighter.id} {...getOptimizedImageProps(fighter.image, { size: 120 })} alt={fighter.name} />
                    ))}
                  </div>
                  <span className="team-owner">{fight.team2.owner.username}</span>
                  <span className="team-record">{fight.team2.record}</span>
                </div>
                <div className="betting-odds">
                  <span className="odds">
                    {calculateOdds(fight, 'team2')}:1
                  </span>
                  <div className="bet-controls">
                    <input
                      type="number"
                      min="1"
                      max={userCoins}
                      placeholder="Bet amount"
                      onChange={(e) => setBetAmount(fight.id, 'team2', parseInt(e.target.value))}
                    />
                    <button 
                      onClick={() => placeBet(fight.id, 'team2', getBetAmount(fight.id, 'team2'))}
                      disabled={!getBetAmount(fight.id, 'team2') || getBetAmount(fight.id, 'team2') > userCoins}
                    >
                      Bet
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {selectedBets[fight.id] && (
              <div className="user-bet-status">
                ✅ You bet {selectedBets[fight.id].amount} coins on {selectedBets[fight.id].prediction}
                <span className="potential-winnings">
                  Potential winnings: 🪙{calculatePotentialWinnings(fight.id, selectedBets[fight.id].prediction, selectedBets[fight.id].amount)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="parlay-section">
        <h3>🎯 Create Parlay Bet</h3>
        <p>Bet on multiple fights for exponentially higher rewards!</p>
        <div className="parlay-multiplier">
          Current Multiplier: x{calculateParlayMultiplier()}
        </div>
        <button 
          className="place-parlay-btn"
          onClick={placeParlayBet}
          disabled={Object.keys(selectedBets).length < 2}
        >
          Place Parlay Bet
        </button>
      </div>
    </div>
  );

  const ChampionshipHistory = ({ divisionId }) => {
    const history = championshipHistory[divisionId] || [];

    return (
      <div className="championship-history">
        <h3>👑 Championship History - {divisionTiers[divisionId]?.name}</h3>
        
        <div className="history-stats">
          <div className="stat-item">
            <span className="stat-number">{history.length}</span>
            <span className="stat-label">Total Champions</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {history.length > 0 ? Math.max(...history.map(h => h.reignLength)) : 0}
            </span>
            <span className="stat-label">Longest Reign (days)</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">
              {history.reduce((acc, h) => acc + h.titleDefenses, 0)}
            </span>
            <span className="stat-label">Total Defenses</span>
          </div>
        </div>

        <div className="history-timeline">
          {history.map((reign, index) => (
            <div key={index} className="reign-item">
              <div className="reign-number">#{history.length - index}</div>
              <div className="champion-info">
                <div className="champion-team">
                  {reign.team.fighters.map(fighter => (
                    <img key={fighter.id} {...getOptimizedImageProps(fighter.image, { size: 120 })} alt={fighter.name} />
                  ))}
                </div>
                <div className="reign-details">
                  <span className="champion-name">{reign.champion.username}</span>
                  <span className="reign-period">
                    {formatDate(reign.wonDate)} - {reign.lostDate ? formatDate(reign.lostDate) : 'Current'}
                  </span>
                  <span className="reign-stats">
                    {reign.reignLength} days • {reign.titleDefenses} defenses
                  </span>
                </div>
              </div>
              {!reign.lostDate && <span className="current-champion">👑 CURRENT</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="power-tier-divisions">
      <div className="divisions-header">
        <h1>🏆 Power Tier Divisions</h1>
        <p>Compete in divisions based on character power levels</p>
        
        <div className="header-stats">
          <div className="stat-card">
            <span className="stat-number">{Object.keys(divisionTiers).length}</span>
            <span className="stat-label">Power Tiers</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{activeFights.length}</span>
            <span className="stat-label">Active Fights</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{bettingFights.length}</span>
            <span className="stat-label">Betting Fights</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">🪙 {userCoins}</span>
            <span className="stat-label">Your Coins</span>
          </div>
        </div>
      </div>

      {/* Betting Section */}
      {bettingFights.length > 0 && <BettingSection />}

      {/* Divisions Grid */}
      <div className="power-tiers-grid">
        {Object.values(divisionTiers).map(division => (
          <div key={division.id} className="power-tier-card" style={{ '--tier-color': division.color }}>
            <div className="tier-header">
              <div className="tier-icon">{division.icon}</div>
              <h3>{division.name}</h3>
              <div className="power-range">Power: {division.powerRange}</div>
            </div>

            <div className="tier-description">
              <p>{division.description}</p>
              <div className="examples">
                <strong>Examples:</strong> {division.examples.slice(0, 3).join(', ')}...
              </div>
            </div>

            <div className="current-champion">
              {leaderboards[division.id]?.[0] && (
                <div className="champion-display">
                  <div className="champion-crown">👑</div>
                  <div className="champion-info">
                    <span className="champion-label">Current Champion</span>
                    <span className="champion-name">{leaderboards[division.id][0].owner.username}</span>
                    <div className="champion-team">
                      {leaderboards[division.id][0].fighters.map(fighter => (
                        <img key={fighter.id} {...getOptimizedImageProps(fighter.image, { size: 120 })} alt={fighter.name} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DivisionLeaderboard divisionId={division.id} />

            {showHistoryDivisionId === division.id && (
              <div className="championship-history-panel">
                <button
                  className="close-history-btn"
                  onClick={() => setShowHistoryDivisionId(null)}
                >
                  Close
                </button>
                <ChampionshipHistory divisionId={division.id} />
              </div>
            )}

            {userTeams[division.id] && (
              <div className="user-team-status">
                <h4>Your Team</h4>
                <div className="team-display">
                  {userTeams[division.id].fighters.map(fighter => (
                    <div key={fighter.id} className="fighter-card">
                      <img {...getOptimizedImageProps(fighter.image, { size: 120 })} alt={fighter.name} />
                      <span>{fighter.name}</span>
                    </div>
                  ))}
                </div>
                <div className="team-record">
                  <span className="record">{userTeams[division.id].wins}W - {userTeams[division.id].losses}L</span>
                  {userTeams[division.id].isChampion && <span className="champion-badge">👑 CHAMPION</span>}
                </div>
              </div>
            )}

            {isModerator && (
              <div className="moderator-controls">
                <h4>Moderator Controls</h4>
                <div className="mod-buttons">
                  <button onClick={() => openFightCreator(division.id)}>
                    Create Fight
                  </button>
                  <button onClick={() => openContenderFightCreator(division.id)}>
                    Contender Fight
                  </button>
                  <button onClick={() => openTitleFightCreator(division.id)}>
                    Title Fight
                  </button>
                </div>
                <div className="auto-match-suggestions">
                  <h5>Suggested Matches (by leaderboard):</h5>
                  {generateMatchSuggestions(division.id).map((suggestion, index) => (
                    <div key={index} className="match-suggestion">
                      <span>{suggestion.team1.owner.username} vs {suggestion.team2.owner.username}</span>
                      <button onClick={() => createOfficialFight(suggestion.team1.id, suggestion.team2.id, division.id)}>
                        Create Match
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PowerTierDivisions;
