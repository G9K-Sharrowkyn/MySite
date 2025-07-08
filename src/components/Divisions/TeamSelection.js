import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useLanguage } from '../../i18n/LanguageContext';
import { replacePlaceholderUrl } from '../../utils/placeholderImage';
import './TeamSelection.css';

const TeamSelection = ({ division, onTeamSelected, onCancel }) => {
  const [characters, setCharacters] = useState([]);
  const [selectedCharacters, setSelectedCharacters] = useState([]);
  const [takenCharacters, setTakenCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { t } = useLanguage();

  const fetchCharacters = useCallback(async () => {
    try {
      const response = await axios.get('/api/characters');
      setCharacters(response.data);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  }, []);

  const fetchTakenCharacters = useCallback(async () => {
    try {
      const response = await axios.get(`/api/divisions/${division.id}/taken-characters`);
      setTakenCharacters(response.data.takenCharacters || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching taken characters:', error);
      setLoading(false);
    }
  }, [division.id]);

  useEffect(() => {
    fetchCharacters();
    fetchTakenCharacters();
  }, [fetchCharacters, fetchTakenCharacters]);

  const isCharacterTaken = (characterId) => {
    return takenCharacters.includes(characterId);
  };

  const handleCharacterSelect = (character) => {
    if (isCharacterTaken(character.id)) return;
    
    if (selectedCharacters.find(c => c.id === character.id)) {
      // Deselect character
      setSelectedCharacters(prev => prev.filter(c => c.id !== character.id));
    } else if (selectedCharacters.length < 2) {
      // Select character
      setSelectedCharacters(prev => [...prev, character]);
    }
  };

  const handleConfirmTeam = () => {
    if (selectedCharacters.length === 2) {
      const teamData = {
        mainCharacter: selectedCharacters[0],
        secondaryCharacter: selectedCharacters[1]
      };
      onTeamSelected(teamData);
    }
  };

  const filteredCharacters = characters.filter(character =>
    character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    character.universe.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="team-selection-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="team-selection-page">
      <div className="selection-header">
        <button className="back-btn" onClick={onCancel}>
          ← {t('back')}
        </button>
        <div className="division-info">
          <span className="division-icon">{division.icon}</span>
          <h1>{t('chooseTeam')} - {division.name}</h1>
          <p>Select 2 characters for your team</p>
        </div>
      </div>

      <div className="selected-team">
        <h3>Your Team ({selectedCharacters.length}/2)</h3>
        <div className="selected-characters">
          {[0, 1].map(index => (
            <div key={index} className="team-slot">
              {selectedCharacters[index] ? (
                <div className="selected-character">
                  <img 
                    src={replacePlaceholderUrl(selectedCharacters[index].image)}
                    alt={selectedCharacters[index].name}
                    className="character-image"
                  />
                  <div className="character-info">
                    <h4>{selectedCharacters[index].name}</h4>
                    <p>{selectedCharacters[index].universe}</p>
                  </div>
                  <button 
                    className="remove-btn"
                    onClick={() => handleCharacterSelect(selectedCharacters[index])}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="empty-slot">
                  <span>{t('warrior') || 'Warrior'} {index + 1}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {selectedCharacters.length === 2 && (
          <button className="confirm-team-btn" onClick={handleConfirmTeam}>
            ⚔️ Confirm Team
          </button>
        )}
      </div>

      <div className="character-selection">
        <div className="selection-controls">
          <input
            type="text"
            placeholder="Search characters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <div className="selection-info">
            <span className="available">🟢 Available</span>
            <span className="taken">🔴 Taken</span>
            <span className="selected">🟡 Selected</span>
          </div>
        </div>

        <div className="characters-grid">
          {filteredCharacters.map(character => {
            const isTaken = isCharacterTaken(character.id);
            const isSelected = selectedCharacters.find(c => c.id === character.id);
            
            return (
              <div 
                key={character.id}
                className={`character-card ${isTaken ? 'taken' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleCharacterSelect(character)}
              >
                <div className="character-status">
                  {isTaken ? '🔴' : isSelected ? '🟡' : '🟢'}
                </div>
                
                <img 
                  src={replacePlaceholderUrl(character.image)}
                  alt={character.name}
                  className="character-image"
                />
                
                <div className="character-info">
                  <h4>{character.name}</h4>
                  <p>{character.universe}</p>
                </div>
                
                {isTaken && (
                  <div className="taken-overlay">
                    <span>TAKEN</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TeamSelection;