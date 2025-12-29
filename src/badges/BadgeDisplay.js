import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import './BadgeDisplay.css';

const BadgeDisplay = ({ badge, userBadge, size = 'medium', showTooltip = true, leveledData = null }) => {
  const { t } = useLanguage();
  
  const translateBadgeName = (name) => {
    if (!name) return '';
    const translated = t(`badgeNames.${name}`);
    // Jeśli tłumaczenie zwraca klucz (nie znaleziono), zwróć oryginalną nazwę
    return translated.startsWith('badgeNames.') ? name : translated;
  };
  
  const translateBadgeDescription = (description) => {
    if (!description) return '';
    const translated = t(`badgeDescriptions.${description}`);
    // Jeśli tłumaczenie zwraca klucz (nie znaleziono), zwróć oryginalny opis
    return translated.startsWith('badgeDescriptions.') ? description : translated;
  };
  
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

  const getLevelColor = (level) => {
    if (level >= 15) return '#EF4444'; // mythic red
    if (level >= 10) return '#F59E0B'; // legendary gold
    if (level >= 5) return '#8B5CF6';  // epic purple
    if (level >= 1) return '#3B82F6';  // rare blue
    return '#9CA3AF'; // common gray
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
      community: '🌟',
      activity: '📅'
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
    // For leveled badges
    if (leveledData) {
      return Math.min((leveledData.progress / leveledData.maxProgress) * 100, 100);
    }
    // For regular badges
    if (!userBadge?.progress || !badge.requirements?.count) return 0;
    return Math.min((userBadge.progress / badge.requirements.count) * 100, 100);
  };

  const isLeveled = badge.isLeveled || leveledData;
  const level = leveledData?.level || 0;
  const isEarned = userBadge?.earnedAt || (isLeveled && level > 0);
  const progressPercentage = getProgressPercentage();

  // For leveled badges, use level-based color
  const badgeColor = isLeveled ? getLevelColor(level) : getRarityColor(badge.rarity);

  return (
    <div
      className={`badge-display ${size} ${isEarned ? 'earned' : 'unearned'} ${isLeveled ? 'leveled' : ''}`}
      title={showTooltip ? `${badge.name} - ${badge.description}` : ''}
    >
      <div
        className="badge-icon-container"
        style={{
          borderColor: badgeColor,
          backgroundColor: isEarned ? badgeColor + '20' : 'var(--bg-dark)'
        }}
      >
        <span className="badge-emoji">{badge.icon || getCategoryIcon(badge.category)}</span>
        {isLeveled && level > 0 && (
          <span className="badge-level-number" style={{ background: badgeColor }}>
            Lv.{level}
          </span>
        )}
        {badge.rarity === 'legendary' && <div className="legendary-glow"></div>}
        {badge.rarity === 'mythic' && <div className="mythic-glow"></div>}
        {isLeveled && level >= 15 && <div className="mythic-glow"></div>}
        {isLeveled && level >= 10 && level < 15 && <div className="legendary-glow"></div>}
      </div>

      <div className="badge-info">
        <div className="badge-name" style={{ color: badgeColor }}>
          {translateBadgeName(badge.name)}
        </div>
        
        {size !== 'small' && (
          <>
            <div className="badge-description">{translateBadgeDescription(badge.description)}</div>

            {/* Leveled badge progress */}
            {isLeveled && (
              <div className="badge-progress leveled-progress">
                <div className="level-info">
                  <span className="level-label">{t('badgeLevel')} {level}/{badge.maxLevel || 20}</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${progressPercentage}%`,
                      backgroundColor: badgeColor
                    }}
                  ></div>
                </div>
                <div className="progress-text">
                  {leveledData?.progress || 0} / {leveledData?.maxProgress || badge.requirement?.perLevel || 100}
                </div>
              </div>
            )}

            {/* Regular badge progress */}
            {!isLeveled && !isEarned && badge.requirements?.count && (
              <div className="badge-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${progressPercentage}%`,
                      backgroundColor: badgeColor
                    }}
                  ></div>
                </div>
                <div className="progress-text">
                  {userBadge?.progress || 0} / {badge.requirements.count}
                </div>
              </div>
            )}

            {/* Regular badge earned status */}
            {!isLeveled && isEarned && (
              <div className="badge-earned">
                <span className="earned-icon">✓</span>
                {t('badgeEarned')}: {formatDate(userBadge.earnedAt)}
                {userBadge.championshipDate && (
                  <div className="championship-date">
                    {t('badgeChampionship')}: {formatDate(userBadge.championshipDate)}
                  </div>
                )}
              </div>
            )}

            {/* Rarity for non-leveled badges */}
            {!isLeveled && badge.rarity && (
              <div className="badge-rarity">
                <span className={`rarity-badge ${badge.rarity}`}>
                  {badge.rarity.toUpperCase()}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BadgeDisplay;