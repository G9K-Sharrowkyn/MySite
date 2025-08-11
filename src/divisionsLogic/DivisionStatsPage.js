import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './DivisionStatsPage.css';

const DivisionStatsPage = () => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDivisionStats();
  }, []);

  const fetchDivisionStats = async () => {
    try {
      const response = await axios.get('/api/divisions/stats');
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching division stats:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="division-stats-page">
      <h1>Division Statistics</h1>
      <div className="stats-grid">
        {stats.map(division => (
          <div key={division.id} className="stat-card">
            <h2>{division.name}</h2>
            <p>{division.description}</p>
            <div className="stat-row">
              <strong>Members:</strong> {division.memberCount}
            </div>
            <div className="stat-row">
              <strong>Champion:</strong> {division.champion ? division.champion.username : 'None'}
            </div>
            <div className="stat-row">
              <strong>Average Votes per Fight:</strong> {division.avgVotesPerFight.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DivisionStatsPage;
