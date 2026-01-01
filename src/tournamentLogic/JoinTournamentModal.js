import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Toast from './Toast';
import './JoinTournamentModal.css';

const JoinTournamentModal = ({ tournamentId, onClose, onSuccess }) => {
  const [tournament, setTournament] = useState(null);
  const [availableCharacters, setAvailableCharacters] = useState([]);
  const [selectedCharacters, setSelectedCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamSize, setTeamSize] = useState(1);
  const [toast, setToast] = useState(null);
  const token = localStorage.getItem('token');

  const fetchTournamentAndCharacters = useCallback(async () => {
    try {
      const [tournamentRes, charactersRes] = await Promise.all([
        axios.get(`/api/tournaments/${tournamentId}`),
        axios.get(`/api/tournaments/${tournamentId}/available-characters`, {
          headers: { 'x-auth-token': token }
        })
      ]);
      
      setTournament(tournamentRes.data);
      setAvailableCharacters(charactersRes.data.characters || []);
      setTeamSize(charactersRes.data.teamSize || 1);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setToast({ message: 'Error loading tournament data', type: 'error' });
      setLoading(false);
    }
  }, [tournamentId, token]);

  useEffect(() => {
    fetchTournamentAndCharacters();
  }, [fetchTournamentAndCharacters]);

  const handleCharacterClick = (character) => {
    if (selectedCharacters.find(c => c.id === character.id)) {
      setSelectedCharacters(selectedCharacters.filter(c => c.id !== character.id));
    } else {
      if (selectedCharacters.length < teamSize) {
        setSelectedCharacters([...selectedCharacters, character]);
      } else {
        setToast({ message: `You can only select ${teamSize} character(s)`, type: 'warning' });
      }
    }
  };

  const handleJoin = async () => {
    if (selectedCharacters.length !== teamSize) {
      setToast({ message: `Please select exactly ${teamSize} character(s)`, type: 'warning' });
      return;
    }

    try {
      await axios.post(`/api/tournaments/${tournamentId}/join`, {
        characterIds: selectedCharacters.map(c => c.id)
      }, {
        headers: { 'x-auth-token': token }
      });
      
      setToast({ message: 'Successfully joined tournament!', type: 'success' });
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (error) {
      console.error('Error joining tournament:', error);
      setToast({ message: error.response?.data?.msg || 'Error joining tournament', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="join-modal-overlay">
        <div className="join-modal">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="join-modal-overlay">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <div className="join-modal">
        <button className="modal-close" onClick={onClose}>×</button>
        
        <h2>Join Tournament: {tournament?.title}</h2>
        
        <div className="team-size-info">
          <p>Select {teamSize} character(s) for your team</p>
          <p className="selected-count">
            Selected: {selectedCharacters.length}/{teamSize}
          </p>
        </div>

        <div className="selected-characters-preview">
          {selectedCharacters.map(char => (
            <div key={char.id} className="selected-char-badge">
              <img src={char.image} alt={char.name} />
              <span>{char.name}</span>
              <button onClick={() => handleCharacterClick(char)}>×</button>
            </div>
          ))}
        </div>

        <div className="available-characters">
          <h3>Available Characters ({availableCharacters.length})</h3>
          <div className="characters-grid">
            {availableCharacters.map(char => {
              const isSelected = selectedCharacters.find(c => c.id === char.id);
              
              return (
                <div
                  key={char.id}
                  className={`character-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleCharacterClick(char)}
                >
                  <img src={char.image} alt={char.name} />
                  <p className="char-name">{char.name}</p>
                  <span className="char-tier">{char.division}</span>
                  {isSelected && <div className="selected-indicator">✓</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn-join" 
            onClick={handleJoin}
            disabled={selectedCharacters.length !== teamSize}
          >
            Join Tournament
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinTournamentModal;
