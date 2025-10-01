import React from 'react';
import BadgeCollection from '../badges/BadgeCollection';
import './UserBadges.css';

const UserBadges = ({ userId, isOwner = false }) => {
  return (
    <div className="user-badges-wrapper">
      <div className="badges-header">
        <h3>🏅 Odznaki</h3>
      </div>
      
      <BadgeCollection
        userId={userId}
        showAll={false}
        size="small"
      />
      
      {isOwner && (
        <div className="view-all-badges">
          <a href="/badges" className="view-all-link">
            Zobacz wszystkie odznaki →
          </a>
        </div>
      )}
    </div>
  );
};

export default UserBadges; 