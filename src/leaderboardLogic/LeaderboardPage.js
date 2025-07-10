import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './LeaderboardPage.css';

const LeaderboardPage = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/stats/leaderboard');
      setLeaderboard(response.data || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  if (loading) {
    return <div className="loading">Loading leaderboard...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="leaderboard-page">
      <h1>Leaderboard</h1>
      <div className="leaderboard-list">
        {leaderboard.map((user, index) => (
          <div key={user._id || user.id} className="leaderboard-item">
            <div className="rank">#{index + 1}</div>
            <div className="user-info">
              <img 
                src={user.profilePicture || '/placeholder-character.png'} 
                alt={user.username}
                className="user-avatar"
              />
              <div className="user-details">
                <h3>{user.username}</h3>
                <p>Wins: {user.wins || 0} | Losses: {user.losses || 0}</p>
              </div>
            </div>
            <div className="score">{user.score || 0} pts</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeaderboardPage;
