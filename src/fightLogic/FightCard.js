import React, { useState, useEffect, useCallback } from 'react';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './FightCard.css';

const FightCard = ({ fight }) => {
  const [userVote, setUserVote] = useState(null);
  const [voteStats, setVoteStats] = useState({
    fighter1Votes: 0,
    fighter2Votes: 0,
    totalVotes: 0,
    fighter1Percentage: 0,
    fighter2Percentage: 0
  });
  const [isVoting, setIsVoting] = useState(false);

  const fetchVoteStats = useCallback(async () => {
    try {
      const response = await axios.get(`/api/votes/fight/${fight.id}/stats`);
      setVoteStats(response.data);
    } catch (error) {
      console.error('Error fetching vote stats:', error);
    }
  }, [fight.id]);

  const fetchUserVote = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await axios.get(`/api/votes/fight/${fight.id}/user`, {
        headers: { 'x-auth-token': token }
      });
      setUserVote(response.data.choice);
    } catch (error) {
      // User hasn't voted yet
      setUserVote(null);
    }
  }, [fight.id]);

  useEffect(() => {
    fetchVoteStats();
    fetchUserVote();
  }, [fetchVoteStats, fetchUserVote]);

  const handleVote = async (choice) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Musisz być zalogowany, aby głosować');
      return;
    }

    if (fight.status !== 'active') {
      alert('Nie można głosować na zakończoną walkę');
      return;
    }

    setIsVoting(true);
    try {
      await axios.post('/api/votes', {
        fightId: fight.id,
        choice
      }, {
        headers: { 'x-auth-token': token }
      });

      setUserVote(choice);
      fetchVoteStats();
    } catch (error) {
      console.error('Error voting:', error);
      alert('Błąd podczas głosowania');
    } finally {
      setIsVoting(false);
    }
  };

  const getTimeRemaining = () => {
    if (!fight.endDate) return 'Brak limitu';
    
    const now = new Date();
    const endDate = new Date(fight.endDate);
    const timeDiff = endDate - now;

    if (timeDiff <= 0) return 'Zakończona';

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const getWinnerDisplay = () => {
    if (fight.status !== 'ended' || !fight.winner) return null;

    if (fight.winner === 'draw') {
      return <div className="fight-result draw">🤝 Remis</div>;
    }

    const winnerName = fight.winner === 'fighter1' ? fight.fighter1 : fight.fighter2;
    return <div className="fight-result winner">🏆 Zwycięzca: {winnerName}</div>;
  };

  return (
    <div className={`fight-card ${fight.type}`}>
      <div className="fight-header">
        <div className="fight-type-badge">
          {fight.type === 'main' ? '🏆 Główna' : '🔥 Feed'}
        </div>
        <div className="fight-status">
          {fight.status === 'active' ? (
            <span className="status-active">⏰ {getTimeRemaining()}</span>
          ) : (
            <span className="status-ended">✅ Zakończona</span>
          )}
        </div>
      </div>

      <div className="fight-title">
        <h3>{fight.title}</h3>
        <p className="fight-category">{fight.category}</p>
      </div>

      <div className="fighters">
        <div className="fighter fighter1">
          <div className="fighter-image">
            <img {...getOptimizedImageProps(fight.fighter1Image, { size: 100 })} alt={fight.fighter1} />
            {userVote === 'fighter1' && <div className="vote-indicator">✓</div>}
          </div>
          <h4>{fight.fighter1}</h4>
          <div className="vote-stats">
            <div className="vote-count">{voteStats.fighter1Votes} głosów</div>
            <div className="vote-percentage">{voteStats.fighter1Percentage}%</div>
          </div>
          {fight.status === 'active' && (
            <button
              className={`vote-btn ${userVote === 'fighter1' ? 'voted' : ''}`}
              onClick={() => handleVote('fighter1')}
              disabled={isVoting}
            >
              {userVote === 'fighter1' ? 'Zagłosowano' : 'Głosuj'}
            </button>
          )}
        </div>

        <div className="vs-divider">
          <span>VS</span>
          <div className="total-votes">{voteStats.totalVotes} głosów</div>
        </div>

        <div className="fighter fighter2">
          <div className="fighter-image">
            <img {...getOptimizedImageProps(fight.fighter2Image, { size: 100 })} alt={fight.fighter2} />
            {userVote === 'fighter2' && <div className="vote-indicator">✓</div>}
          </div>
          <h4>{fight.fighter2}</h4>
          <div className="vote-stats">
            <div className="vote-count">{voteStats.fighter2Votes} głosów</div>
            <div className="vote-percentage">{voteStats.fighter2Percentage}%</div>
          </div>
          {fight.status === 'active' && (
            <button
              className={`vote-btn ${userVote === 'fighter2' ? 'voted' : ''}`}
              onClick={() => handleVote('fighter2')}
              disabled={isVoting}
            >
              {userVote === 'fighter2' ? 'Zagłosowano' : 'Głosuj'}
            </button>
          )}
        </div>
      </div>

      {/* Vote Progress Bar */}
      {voteStats.totalVotes > 0 && (
        <div className="vote-progress">
          <div 
            className="progress-bar fighter1-bar"
            style={{ width: `${voteStats.fighter1Percentage}%` }}
          ></div>
          <div 
            className="progress-bar fighter2-bar"
            style={{ width: `${voteStats.fighter2Percentage}%` }}
          ></div>
        </div>
      )}

      {getWinnerDisplay()}

      <div className="fight-footer">
        <div className="fight-meta">
          <span className="created-by">Utworzona przez: {fight.createdByUsername}</span>
          <span className="created-date">{new Date(fight.createdAt).toLocaleDateString()}</span>
        </div>
        <div className="fight-actions">
          <Link to={`/fight/${fight.id}`} className="btn btn-outline btn-small">
            Zobacz szczegóły
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FightCard;
