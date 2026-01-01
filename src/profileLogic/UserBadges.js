import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import TournamentBadge from '../badges/TournamentBadge';
import './UserBadges.css';

const UserBadges = ({ userId, isOwner = false }) => {
  const { t } = useLanguage();
  const [leveledBadges, setLeveledBadges] = useState([]);
  const [tournamentBadges, setTournamentBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() Badges = async () => {
      if (!userId) return;
      try {
        setLoading(true);
        
        // Fetch leveled badges
        const leveledResponse = await axios.get(`/api/badges/leveled/${userId}`);
        setLeveledBadges(leveledResponse.data.badges || []);
        
        // Fetch tournament badges
        try {
          const tournamentResponse = await axios.get(`/api/badges/tournament/${userId}`);
          setTournamentBadges(tournamentResponse.data.badges || []);
        } catch (err) {
          if (err.response?.status !== 404) {
            console.error('Error fetching tournament badges:', err);
          }
          setTournamentBadges([]);
        }
        
      } catch (error) {
        if (error.response?.status === 404) {
          setLeveledBadges([]);
          setTournamentBadges([]);
        } else {
          console.error('Error fetching badges:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetch
    fetchLeveledBadges();
  }, [userId]);

  const translateBadgeName = (name) => {
    if (!name) return '';
    const translated = t(`badgeNames.${name}`);
    ret/* Tournament Winner Badges */}
      {tournamentBadges.length > 0 && (
        <div className="tournament-badges-section">
          <h4 className="badges-section-title">🏆 Tournament Victories</h4>
          <div className="tournament-badges-list">
            {tournamentBadges.map((badge) => (
              <TournamentBadge key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      )}
      
      {/* Leveled Badges */}
      {leveledBadges.length === 0 && tournamentBadges.length === 0 ? (
        <p>Brak odznak do wyświetlenia.</p>
      ) : leveledBadges.length > 0 && (
        <div className="leveled-badges-section">
          <h4 className="badges-section-title">🎯 Progress Badges</h4>
    if (loading) {
    return (
      <div className="user-badges-simple">
        <h3>{t('achievements') || 'Achievements'}</h3>
        <p>{t('loading') || 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className="user-badges-simple">
      <h3>{t('achievements') || 'Osiągnięcia'}</h3>
      
      {leveledBadges.length === 0 ? (
        <p>Brak odznak do wyświetlenia.</p>
        </div>
      ) : (
        <div className="badges-simple-grid">
          {leveledBadges.map((leveledData) => {
            const badge = leveledData.badge;
            const level = leveledData.level || 0;
            const progress = leveledData.progress || 0;
            const maxProgress = leveledData.maxProgress || 100;
            const percentage = Math.min((progress / maxProgress) * 100, 100);

            return (
              <div key={leveledData.badgeId} className="badge-simple-card">
                <div className="badge-simple-icon">{badge.icon || '🏅'}</div>
                <div className="badge-simple-content">
                  <h4 className="badge-simple-title">{translateBadgeName(badge.name)}</h4>
                  <p className="badge-simple-level">
                    {t('badgeLevel')} {level}/{badge.maxLevel || 20}
                  </p>
                  <div className="badge-simple-progress-bar">
                    <div 
                      className="badge-simple-progress-fill" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="badge-simple-progress-text">
                    {progress} / {maxProgress}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserBadges; 
