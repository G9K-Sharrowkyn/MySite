import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './ChampionshipHistory.css';

const ChampionshipHistory = ({ divisionId, divisionName, initialHistory }) => {
  const [history, setHistory] = useState(
    Array.isArray(initialHistory) ? initialHistory : []
  );
  const [loading, setLoading] = useState(!Array.isArray(initialHistory));
  const [showModal, setShowModal] = useState(false);

  const fetchChampionshipHistory = useCallback(async () => {
    try {
      const response = await axios.get(`/api/divisions/${divisionId}/championship-history`);
      setHistory(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching championship history:', error);
      setLoading(false);
    }
  }, [divisionId]);

  useEffect(() => {
    if (Array.isArray(initialHistory)) {
      setHistory(initialHistory);
      setLoading(false);
      return;
    }

    fetchChampionshipHistory();
  }, [divisionId, initialHistory, fetchChampionshipHistory]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getLongestReign = () => {
    if (history.length === 0) return null;
    return history.reduce((longest, current) => 
      current.reignDuration > longest.reignDuration ? current : longest
    );
  };

  const getMostDefenses = () => {
    if (history.length === 0) return null;
    return history.reduce((most, current) => 
      current.titleDefenses > most.titleDefenses ? current : most
    );
  };

  if (loading) return <div className="loading">Loading championship history...</div>;

  return (
    <div className="championship-history">
      <div className="history-header" onClick={() => setShowModal(true)}>
        <h3>👑 Championship History</h3>
        <span className="view-all">View All →</span>
      </div>

      {history.length === 0 ? (
        <div className="no-history">
          <p>No champions crowned yet in this division</p>
        </div>
      ) : (
        <div className="history-summary">
          <div className="history-stats">
            <div className="championship-stat-item">
              <span className="championship-stat-label">Total Champions</span>
              <span className="championship-stat-value">{history.length}</span>
            </div>
            <div className="championship-stat-item">
              <span className="championship-stat-label">Longest Reign</span>
              <span className="championship-stat-value">
                {getLongestReign()?.reignDuration || 0} days
              </span>
            </div>
            <div className="championship-stat-item">
              <span className="championship-stat-label">Most Defenses</span>
              <span className="championship-stat-value">
                {getMostDefenses()?.titleDefenses || 0}
              </span>
            </div>
          </div>

          <div className="recent-champions">
            <h4>Recent Champions</h4>
            <div className="champions-list">
              {history.slice(0, 3).map((champion, index) => (
                <div key={index} className={`champion-item ${!champion.endDate ? 'current' : ''}`}>
                  <div className="champion-info">
                    {!champion.endDate && <span className="current-badge">Current</span>}
                    <h5>{champion.username}</h5>
                    <div className="champion-team">
                      {champion.team && (
                        <>
                          <span className="fighter">{champion.team.mainCharacter?.name}</span>
                          <span className="vs">&</span>
                          <span className="fighter">{champion.team.secondaryCharacter?.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="reign-info">
                    <div className="reign-dates">
                      <span className="start-date">From: {formatDate(champion.startDate)}</span>
                      {champion.endDate && (
                        <span className="end-date">To: {formatDate(champion.endDate)}</span>
                      )}
                    </div>
                    <div className="reign-stats">
                      <span className="duration">{champion.reignDuration} days</span>
                      <span className="defenses">{champion.titleDefenses} defenses</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="history-modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{divisionName} Championship History</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="full-history">
                {history.map((champion, index) => (
                  <div key={index} className={`history-entry ${!champion.endDate ? 'current-champion' : ''}`}>
                    <div className="entry-number">#{history.length - index}</div>
                    <div className="entry-content">
                      <div className="champion-details">
                        <h3>{champion.username}</h3>
                        {!champion.endDate && <span className="current-champion-badge">👑 Current Champion</span>}
                        <div className="team-display">
                          <span className="team-label">Team:</span>
                          <span className="team-fighters">
                            {champion.team?.mainCharacter?.name} & {champion.team?.secondaryCharacter?.name}
                          </span>
                        </div>
                      </div>
                      
                      <div className="reign-details">
                        <div className="reign-timeline">
                          <span className="reign-start">
                            <strong>Crowned:</strong> {formatDate(champion.startDate)}
                          </span>
                          {champion.endDate && (
                            <span className="reign-end">
                              <strong>Lost Title:</strong> {formatDate(champion.endDate)}
                            </span>
                          )}
                        </div>
                        
                        <div className="reign-achievements">
                          <div className="achievement">
                            <span className="achievement-icon">📅</span>
                            <span className="achievement-text">{champion.reignDuration} days</span>
                          </div>
                          <div className="achievement">
                            <span className="achievement-icon">🛡️</span>
                            <span className="achievement-text">{champion.titleDefenses} title defenses</span>
                          </div>
                          <div className="achievement">
                            <span className="achievement-icon">⚔️</span>
                            <span className="achievement-text">{champion.totalFights} total fights</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {history.length > 0 && (
                <div className="history-records">
                  <h3>Division Records</h3>
                  <div className="records-grid">
                    <div className="record-card">
                      <h4>Longest Reign</h4>
                      <p className="record-holder">{getLongestReign()?.username}</p>
                      <p className="record-value">{getLongestReign()?.reignDuration} days</p>
                    </div>
                    <div className="record-card">
                      <h4>Most Title Defenses</h4>
                      <p className="record-holder">{getMostDefenses()?.username}</p>
                      <p className="record-value">{getMostDefenses()?.titleDefenses} defenses</p>
                    </div>
                    <div className="record-card">
                      <h4>Total Title Reigns</h4>
                      <p className="record-value">{history.length}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChampionshipHistory; 
