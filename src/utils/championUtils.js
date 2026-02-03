import React from 'react';
import axios from 'axios';
import { getUserDisplayName } from './userDisplay';

// Check if a user is a champion in any division
export const checkUserChampionStatus = async (userId) => {
  try {
    const response = await axios.get(`/api/users/${userId}/champion-status`);
    return response.data;
  } catch (error) {
    console.error('Error checking champion status:', error);
    return {
      isChampion: false,
      divisions: []
    };
  }
};

// Get CSS classes for champion styling
export const getChampionClasses = (isChampion, divisionIds = []) => {
  if (!isChampion) return '';
  
  const baseClass = 'champion-user';
  const divisionClasses = divisionIds.map(divId => `champion-${divId}`).join(' ');
  
  return `${baseClass} ${divisionClasses}`.trim();
};

// Get champion title for display
export const getChampionTitle = (userDivisions) => {
  if (!userDivisions) return null;
  
  const championDivisions = Object.entries(userDivisions)
    .filter(([_, data]) => data.isChampion)
    .map(([divId, data]) => ({
      divisionId: divId,
      title: data.championTitle || `${divId} Champion`
    }));
  
  if (championDivisions.length === 0) return null;
  if (championDivisions.length === 1) return championDivisions[0].title;
  
  // Multiple championships
  return `${championDivisions.length}x Division Champion`;
};

// Format username with champion styling
export const ChampionUsername = ({ user, className = '', showCrown = true }) => {
  const isChampion = user?.divisions && Object.values(user.divisions).some(d => d.isChampion);
  const championDivisions = user?.divisions 
    ? Object.entries(user.divisions)
        .filter(([_, data]) => data.isChampion)
        .map(([divId]) => divId)
    : [];
  
  const championClasses = getChampionClasses(isChampion, championDivisions);
  
  return (
    <span className={`username-display ${championClasses} ${className}`}>
      {showCrown && isChampion && <span className="champion-crown-icon">👑</span>}
      {getUserDisplayName(user)}
    </span>
  );
}; 