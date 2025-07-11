import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './UserBadges.css';

const UserBadges = ({ userId, isOwner = false }) => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const { t } = useLanguage();

  // Badge definitions
  const BADGE_DEFINITIONS = {
    // Championship badges
    DIVISION_CHAMPION: {
      id: 'division_champion',
      name: 'Division Champion',
      description: 'Current champion in at least one division',
      icon: '👑',
      rarity: 'legendary',
      category: 'championship'
    },
    MULTI_DIVISION_CHAMPION: {
      id: 'multi_division_champion',
      name: 'Multi-Division Champion',
      description: 'Champion in multiple divisions simultaneously',
      icon: '🏆',
      rarity: 'mythic',
      category: 'championship'
    },
    LONGEST_REIGN: {
      id: 'longest_reign',
      name: 'Iron Throne',
      description: 'Held a championship for over 30 days',
      icon: '🛡️',
      rarity: 'epic',
      category: 'championship'
    },
    
    // Fight badges
    FIRST_WIN: {
      id: 'first_win',
      name: 'First Victory',
      description: 'Won your first official fight',
      icon: '⚔️',
      rarity: 'common',
      category: 'combat'
    },
    WINNING_STREAK_5: {
      id: 'winning_streak_5',
      name: 'Hot Streak',
      description: 'Won 5 official fights in a row',
      icon: '🔥',
      rarity: 'rare',
      category: 'combat'
    },
    WINNING_STREAK_10: {
      id: 'winning_streak_10',
      name: 'Unstoppable',
      description: 'Won 10 official fights in a row',
      icon: '💥',
      rarity: 'epic',
      category: 'combat'
    },
    COMEBACK_KID: {
      id: 'comeback_kid',
      name: 'Comeback Kid',
      description: 'Won a fight after losing 3 in a row',
      icon: '💪',
      rarity: 'rare',
      category: 'combat'
    },
    
    // Social badges
    POPULAR_FIGHTER: {
      id: 'popular_fighter',
      name: 'Fan Favorite',
      description: 'Received over 1000 votes in your fights',
      icon: '⭐',
      rarity: 'rare',
      category: 'social'
    },
    COMMUNITY_HERO: {
      id: 'community_hero',
      name: 'Community Hero',
      description: 'Created 50+ fights for the community',
      icon: '🦸',
      rarity: 'epic',
      category: 'social'
    },
    DEBATE_MASTER: {
      id: 'debate_master',
      name: 'Debate Master',
      description: 'Posted 100+ comments on fights',
      icon: '💭',
      rarity: 'rare',
      category: 'social'
    },
    
    // Special event badges
    EARLY_ADOPTER: {
      id: 'early_adopter',
      name: 'Early Adopter',
      description: 'Joined during the platform\'s first month',
      icon: '🌟',
      rarity: 'epic',
      category: 'special'
    },
    TOURNAMENT_WINNER: {
      id: 'tournament_winner',
      name: 'Tournament Champion',
      description: 'Won an official tournament',
      icon: '🏅',
      rarity: 'legendary',
      category: 'special'
    },
    PERFECT_SEASON: {
      id: 'perfect_season',
      name: 'Perfect Season',
      description: 'Went undefeated for an entire month',
      icon: '💎',
      rarity: 'mythic',
      category: 'special'
    },
    
    // Betting badges
    BETTING_MASTER: {
      id: 'betting_master',
      name: 'Oracle',
      description: 'Correctly predicted 20 fight outcomes',
      icon: '🔮',
      rarity: 'epic',
      category: 'betting'
    },
    HIGH_ROLLER: {
      id: 'high_roller',
      name: 'High Roller',
      description: 'Won a bet of 1000+ coins',
      icon: '💰',
      rarity: 'legendary',
      category: 'betting'
    }
  };

  useEffect(() => {
    fetchUserBadges();
  }, [userId]);

  const fetchUserBadges = async () => {
    try {
      const response = await axios.get(`/api/users/${userId}/badges`);
      setBadges(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching badges:', error);
      setLoading(false);
    }
  };

  const getRarityColor = (rarity) => {
    const colors = {
      common: '#9e9e9e',
      rare: '#2196F3',
      epic: '#9c27b0',
      legendary: '#ff9800',
      mythic: '#f44336'
    };
    return colors[rarity] || '#9e9e9e';
  };

  const BadgeModal = () => {
    if (!selectedBadge) return null;
    
    const definition = BADGE_DEFINITIONS[selectedBadge.badgeId] || {};
    
    return (
      <div className="badge-modal" onClick={() => setSelectedBadge(null)}>
        <div className="badge-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="badge-modal-header">
            <div className="badge-large" style={{ borderColor: getRarityColor(definition.rarity) }}>
              <span className="badge-icon-large">{definition.icon}</span>
            </div>
            <h3>{definition.name}</h3>
            <span className={`rarity-tag ${definition.rarity}`}>{definition.rarity}</span>
          </div>
          
          <div className="badge-modal-body">
            <p className="badge-description">{definition.description}</p>
            
            <div className="badge-stats">
              <div className="stat-item">
                <span className="stat-label">Earned on:</span>
                <span className="stat-value">{new Date(selectedBadge.earnedAt).toLocaleDateString()}</span>
              </div>
              {selectedBadge.progress && (
                <div className="stat-item">
                  <span className="stat-label">Progress:</span>
                  <span className="stat-value">{selectedBadge.progress}</span>
                </div>
              )}
              <div className="stat-item">
                <span className="stat-label">Category:</span>
                <span className="stat-value">{definition.category}</span>
              </div>
            </div>
            
            {selectedBadge.details && (
              <div className="badge-details">
                <h4>Details:</h4>
                <p>{selectedBadge.details}</p>
              </div>
            )}
          </div>
          
          <button className="close-btn" onClick={() => setSelectedBadge(null)}>
            Close
          </button>
        </div>
      </div>
    );
  };

  if (loading) return <div className="badges-loading">Loading badges...</div>;

  const groupedBadges = badges.reduce((acc, badge) => {
    const definition = BADGE_DEFINITIONS[badge.badgeId] || {};
    const category = definition.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(badge);
    return acc;
  }, {});

  return (
    <div className="user-badges">
      <div className="badges-header">
        <h3>🏅 Achievements</h3>
        <span className="badge-count">{badges.length} earned</span>
      </div>
      
      {badges.length === 0 ? (
        <div className="no-badges">
          <p>No badges earned yet. Keep fighting!</p>
        </div>
      ) : (
        <div className="badges-container">
          {Object.entries(groupedBadges).map(([category, categoryBadges]) => (
            <div key={category} className="badge-category">
              <h4 className="category-title">{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
              <div className="badges-grid">
                {categoryBadges.map(badge => {
                  const definition = BADGE_DEFINITIONS[badge.badgeId] || {};
                  return (
                    <div
                      key={badge.id}
                      className={`badge ${definition.rarity}`}
                      onClick={() => setSelectedBadge(badge)}
                      style={{ borderColor: getRarityColor(definition.rarity) }}
                    >
                      <span className="badge-icon">{definition.icon}</span>
                      <span className="badge-name">{definition.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {isOwner && (
        <div className="badge-progress">
          <h4>🎯 Next Badges</h4>
          <div className="progress-list">
            <div className="progress-item">
              <span className="progress-badge">🔥 Hot Streak</span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '60%' }}></div>
              </div>
              <span className="progress-text">3/5 wins</span>
            </div>
            <div className="progress-item">
              <span className="progress-badge">💭 Debate Master</span>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '40%' }}></div>
              </div>
              <span className="progress-text">40/100 comments</span>
            </div>
          </div>
        </div>
      )}
      
      <BadgeModal />
    </div>
  );
};

export default UserBadges; 