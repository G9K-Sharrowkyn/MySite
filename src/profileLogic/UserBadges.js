import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import BadgeCollection from '../badges/BadgeCollection';
import BadgeDisplay from '../badges/BadgeDisplay';
import './UserBadges.css';

const UserBadges = ({ userId, isOwner = false }) => {
  const { t, lang } = useLanguage();
  const [leveledBadges, setLeveledBadges] = useState([]);
  const [loadingLeveled, setLoadingLeveled] = useState(true);

  useEffect(() => {
    const fetchLeveledBadges = async () => {
      if (!userId) return;
      try {
        setLoadingLeveled(true);
        const response = await axios.get(`/api/badges/leveled/${userId}`);
        setLeveledBadges(response.data.badges || []);
      } catch (error) {
        if (error.response?.status === 404) {
          setLeveledBadges([]);
        } else {
          console.error('Error fetching leveled badges:', error);
        }
      } finally {
        setLoadingLeveled(false);
      }
    };

    fetchLeveledBadges();
  }, [userId]);

  return (
    <div className="user-badges-wrapper">
      <div className="badges-header">
        <h3>{t('achievements') || 'Achievements'}</h3>
      </div>

      {/* Leveled Badges */}
      {loadingLeveled ? (
        <div className="badges-loading">{t('loading') || 'Loading...'}</div>
      ) : leveledBadges.length > 0 && (
        <div className="leveled-badges-grid">
          {leveledBadges.map((leveledData) => (
            <BadgeDisplay
              key={leveledData.badgeId}
              badge={leveledData.badge}
              leveledData={leveledData}
              size="medium"
            />
          ))}
        </div>
      )}

      {/* Regular Badges */}
      <BadgeCollection
        userId={userId}
        showAll={false}
        size="small"
      />
    </div>
  );
};

export default UserBadges; 
