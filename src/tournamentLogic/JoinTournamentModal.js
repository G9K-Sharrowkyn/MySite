import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './JoinTournamentModal.css';

const JoinTournamentModal = ({ tournamentId, onClose, onSuccess }) => {
  const [tournament, setTournament] = useState(null);
  const [availableCharacters, setAvailableCharacters] = useState([]);
  const [selectedCharacters, setSelectedCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchTournamentAndCharacters();
  }, [tournamentId]);

  const fetchTournamentAndCharacters = async () => {
    try {
      const [tournamentRes, charactersRes] = await Promise.all([
        axios.get(`/api/tournaments/${tournamentId}`),
        axios.get(`/api/tournaments/${tournamentId}/available-characters`, {
          headers: { 'x-auth-token': token }
        })
      ]);
      
      setTournament(tournamentRes.data);
      setAvailableCharacters(charactersRes.data.availableCharacters || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error loading tournament data');
      setLoading(false);
    }
  };

  const handleCharacterClick = (character) => {
    if (selectedCharacters.find(c => c.id === character.id)) {
      setSelectedCharacters(selectedCharacters.filter(c => c.id !== character.id));
    } else {
      if (selectedCharacters.length < tournament.teamSize) {
        setSelectedCharacters([...selectedCharacters, character]);
      } else {
        alert(`You can only select ${tournament.teamSize} character(s)`);
      }
    }
  };

  const handleJoin = async () => {
    if (selectedCharacters.length !== tournament.teamSize) {
      alert(`Please select exactly ${tournament.teamSize} character(s)`);
      return;
    }

    try {
      await axios.post(`/api/tournaments/${tournamentId}/join`, {
        characterIds: selectedCharacters.map(c => c.id)
      }, {
        headers: { 'x-auth-token': token }
      });
      
      alert('Successfully joined tournament!');
      onSuccess();
    } catch (error) {
      console.error('Error joining tournament:', error);
      alert(error.response?.data?.msg || 'Error joining tournament');
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
      <div className="join-modal">
        <button className="modal-close" onClick={onClose}>×</button>
        
        <h2>Join Tournament: {tournament?.title}</h2>
        
        <div className="team-size-info">
          <p>Select {tournament?.teamSize} character(s) for your team</p>
          <p className="selected-count">
            Selected: {selectedCharacters.length}/{tournament?.teamSize}
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
            disabled={selectedCharacters.length !== tournament?.teamSize}
          >
            Join Tournament
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinTournamentModal;
