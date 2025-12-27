import React from 'react';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import { useLanguage } from '../i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';
import './TitleFightNotification.css';

const TitleFightNotification = ({ titleFights, divisionName, currentUser }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  if (!titleFights || titleFights.length === 0) {
    return null;
  }

  const handleViewFight = (fightId) => {
    navigate(`/fight/${fightId}`);
  };

  const isUserInvolved = (fight) => {
    if (!currentUser) return false;
    return fight.team1?.userId === currentUser._id || fight.team2?.userId === currentUser._id;
  };

  const getTimeRemaining = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff <= 0) return t('expired') || 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="title-fight-notification">
      <div className="title-fight-header">
        <div className="title-fight-icon">👑</div>
        <div className="title-fight-title">
          <h4>{t('titleFight') || 'Title Fight'}</h4>
          <p>{divisionName} {t('championship') || 'Championship'}</p>
        </div>
      </div>

      <div className="title-fights-list">
        {titleFights.map(fight => (
          <div 
            key={fight._id} 
            className={`title-fight-item ${isUserInvolved(fight) ? 'user-involved' : ''}`}
          >
            <div className="fight-matchup">
              <div className="fighter-info">
                <div className="fighter-avatar">
                  <img 
                    {...getOptimizedImageProps(
                      fight.team1?.mainCharacter?.image || '/placeholder-character.png',
                      { size: 50 }
                    )}
                    alt={fight.team1?.mainCharacter?.name}
                  />
                  {fight.team1?.secondaryCharacter && (
                    <img 
                      {...getOptimizedImageProps(
                        fight.team1?.secondaryCharacter?.image || '/placeholder-character.png',
                        { size: 30 }
                      )}
                      alt={fight.team1?.secondaryCharacter?.name}
                      className="secondary-character"
                    />
                  )}
                </div>
                <div className="fighter-details">
                  <span className="team-owner">{fight.team1?.username}</span>
                  <div className="character-names">
                    <span>{fight.team1?.mainCharacter?.name}</span>
                    {fight.team1?.secondaryCharacter && (
                      <>
                        <span className="vs-separator">+</span>
                        <span>{fight.team1?.secondaryCharacter?.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="vs-section">
                <span className="vs-text">VS</span>
                <div className="championship-belt">🏆</div>
              </div>

              <div className="fighter-info">
                <div className="fighter-avatar">
                  <img 
                    {...getOptimizedImageProps(
                      fight.team2?.mainCharacter?.image || '/placeholder-character.png',
                      { size: 50 }
                    )}
                    alt={fight.team2?.mainCharacter?.name}
                  />
                  {fight.team2?.secondaryCharacter && (
                    <img 
                      {...getOptimizedImageProps(
                        fight.team2?.secondaryCharacter?.image || '/placeholder-character.png',
                        { size: 30 }
                      )}
                      alt={fight.team2?.secondaryCharacter?.name}
                      className="secondary-character"
                    />
                  )}
                </div>
                <div className="fighter-details">
                  <span className="team-owner">{fight.team2?.username}</span>
                  <div className="character-names">
                    <span>{fight.team2?.mainCharacter?.name}</span>
                    {fight.team2?.secondaryCharacter && (
                      <>
                        <span className="vs-separator">+</span>
                        <span>{fight.team2?.secondaryCharacter?.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="fight-status">
              <div className="fight-stats">
                <span className="vote-count">🗳️ {fight.votes?.length || 0} {t('votes') || 'votes'}</span>
                <span className="time-remaining">⏰ {getTimeRemaining(fight.endTime)}</span>
              </div>
              
              {isUserInvolved(fight) && (
                <div className="user-involvement-badge">
                  <span>⭐ {t('yourFight') || 'Your Fight'}</span>
                </div>
              )}
            </div>

            <div className="fight-actions">
              <button 
                className="view-fight-btn"
                onClick={() => handleViewFight(fight._id)}
              >
                {t('viewFight') || 'View Fight'} 👑
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="title-fight-info">
        <p className="info-text">
          🏆 {t('titleFightDescription') || 'The winner becomes the new division champion!'}
        </p>
      </div>
    </div>
  );
};

export default TitleFightNotification;
