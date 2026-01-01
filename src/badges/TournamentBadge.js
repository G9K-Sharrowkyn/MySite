import React from 'react';
import './TournamentBadge.css';

const TournamentBadge = ({ badge }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  return (
    <div className="tournament-badge">
      <div className="badge-trophy">🏆</div>
      <div className="badge-content">
        <div className="badge-title">Tournament Winner</div>
        <div className="badge-tournament-name">{badge.tournamentTitle}</div>
        <div className="badge-date">{formatDate(badge.wonAt)}</div>
        {badge.teamMembers && badge.teamMembers.length > 0 && (
          <div className="badge-team">
            <span className="team-label">with:</span>
            <div className="team-members">
              {badge.teamMembers.map((member, idx) => (
                <span key={idx} className="team-member">
                  {member.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentBadge;
