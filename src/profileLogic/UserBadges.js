import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './UserBadges.css';

const UserBadges = ({ userId, isOwner = false }) => {
  const { t } = useLanguage();
  const [leveledBadges, setLeveledBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeveledBadges = async () => {
      if (!userId) return;
      try {
        setLoading(true);
        const response = await axios.get(`/api/badges/leveled/${userId}`);
        setLeveledBadges(response.data.badges || []);
      } catch (error) {
        if (error.response?.status === 404) {
          setLeveledBadges([]);
        } else {
          console.error('Error fetching leveled badges:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeveledBadges();
  }, [userId]);

  const translateBadgeName = (name) => {
    if (!name) return '';
    const translated = t(`badgeNames.${name}`);
    return translated.startsWith('badgeNames.') ? name : translated;
  };

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
