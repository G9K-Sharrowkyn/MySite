import React from 'react';
import './BadgeDisplay.css';

const BadgeDisplay = ({ badge, userBadge, size = 'medium', showTooltip = true }) => {
  const getRarityColor = (rarity) => {
    const colors = {
      common: '#9CA3AF',
      uncommon: '#10B981',
      rare: '#3B82F6',
      epic: '#8B5CF6',
      legendary: '#F59E0B',
      mythic: '#EF4444'
    };
    return colors[rarity] || colors.common;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      fighting: '⚔️',
      social: '👥',
      achievement: '🏆',
      division: '🥇',
      championship: '👑',
      betting: '🎲',
      special: '⭐',
      milestone: '📈',
      community: '🌟'
    };
    return icons[category] || '🏅';
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getProgressPercentage = () => {
    if (!userBadge?.progress || !badge.requirements?.count) return 0;
    return Math.min((userBadge.progress / badge.requirements.count) * 100, 100);
  };

  const isEarned = userBadge?.earnedAt;
  const progressPercentage = getProgressPercentage();

  return (
    <div 
      className={`badge-display ${size} ${isEarned ? 'earned' : 'unearned'}`}
      title={showTooltip ? `${badge.name} - ${badge.description}` : ''}
    >
      <div 
        className="badge-icon"
        style={{ 
          borderColor: getRarityColor(badge.rarity),
          backgroundColor: isEarned ? getRarityColor(badge.rarity) + '20' : '#f3f4f6'
        }}
      >
        <span className="badge-emoji">{getCategoryIcon(badge.category)}</span>
        {badge.rarity === 'legendary' && <div className="legendary-glow"></div>}
        {badge.rarity === 'mythic' && <div className="mythic-glow"></div>}
      </div>

      <div className="badge-info">
        <div className="badge-name" style={{ color: getRarityColor(badge.rarity) }}>
          {badge.name}
        </div>
        
        {size !== 'small' && (
          <>
            <div className="badge-description">{badge.description}</div>
            
            {!isEarned && badge.requirements?.count && (
              <div className="badge-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${progressPercentage}%`,
                      backgroundColor: getRarityColor(badge.rarity)
                    }}
                  ></div>
                </div>
                <div className="progress-text">
                  {userBadge?.progress || 0} / {badge.requirements.count}
                </div>
              </div>
            )}

            {isEarned && (
              <div className="badge-earned">
                <span className="earned-icon">✓</span>
                Zdobyte: {formatDate(userBadge.earnedAt)}
                {userBadge.championshipDate && (
                  <div className="championship-date">
                    Mistrzostwo: {formatDate(userBadge.championshipDate)}
                  </div>
                )}
              </div>
            )}

            <div className="badge-rarity">
              <span className={`rarity-badge ${badge.rarity}`}>
                {badge.rarity.toUpperCase()}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BadgeDisplay;