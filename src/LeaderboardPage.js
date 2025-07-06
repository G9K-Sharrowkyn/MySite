import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { placeholderImages } from './utils/placeholderImage';
import './LeaderboardPage.css';

const LeaderboardPage = () => {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await axios.get('/api/profile/leaderboard');
        setLeaderboard(res.data);
      } catch (err) {
        console.error('Błąd podczas pobierania rankingu:', err);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="leaderboard-page">
      <h1>Ranking Użytkowników</h1>
      {leaderboard.length > 0 ? (
        <ol className="leaderboard-list">
          {leaderboard.map((user, index) => (
            <li key={user.id} className="leaderboard-item">
              <span className="rank">{index + 1}.</span>
              <Link to={`/profile/${user.id}`} className="leaderboard-user-link">
                <img src={user.profilePicture || placeholderImages.userSmall} alt="Profilowe" className="leaderboard-profile-picture" />
                <div className="leaderboard-user-info">
                  <span className="username">{user.username}</span>
                  <span className="stats">
                    Zwycięstwa: {user.victories} | 
                    Walki: {user.totalFights} | 
                    Win Rate: {user.winRate}% |
                    Ranga: {user.rank}
                  </span>
                </div>
                <span className="username">{user.username}</span>
              </Link>
              <span className="points">{user.points} pkt</span>
            </li>
          ))}
        </ol>
      ) : (
        <p>Brak danych w rankingu.</p>
      )}
    </div>
  );
};

export default LeaderboardPage;
