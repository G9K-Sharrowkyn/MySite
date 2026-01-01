import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Toast from './Toast';
import './CreateTournamentForm.css';

const CreateTournamentForm = ({ onClose, onTournamentCreated }) => {
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    maxParticipants: 32,
    recruitmentDays: 2,
    battleTime: '18:00',
    teamSize: 1,
    showOnFeed: false,
    allowedTiers: [],
    excludedCharacters: []
  });
  
  const [characters, setCharacters] = useState([]);
  const [availableCharacters, setAvailableCharacters] = useState([]);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const token = localStorage.getItem('token');

  const tierOptions = [
    { id: 'regularPeople', name: 'Street Level', type: 'power' },
    { id: 'metahuman', name: 'Metahuman', type: 'power' },
    { id: 'planetBusters', name: 'Planet Busters', type: 'power' },
    { id: 'godTier', name: 'God Tier', type: 'power' },
    { id: 'universalThreat', name: 'Universal Threat', type: 'power' },
    { id: 'star-wars', name: 'Star Wars', type: 'franchise' },
    { id: 'dragon-ball', name: 'Dragon Ball', type: 'franchise' },
    { id: 'dc', name: 'DC Comics', type: 'franchise' },
    { id: 'marvel', name: 'Marvel', type: 'franchise' }
  ];

  const fetchCharacters = async () => {
    try {
      const response = await axios.get('/api/characters');
      setCharacters(response.data);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  };

  const filterAvailableCharacters = useCallback(() => {
    if (formData.allowedTiers.length === 0) {
      setAvailableCharacters(characters);
    } else {
      const filtered = characters.filter(char => {
        // Separate power levels and franchises
        const powerLevels = ['regularPeople', 'metahuman', 'planetBusters', 'godTier', 'universalThreat'];
        const franchises = ['star-wars', 'dragon-ball', 'dc', 'marvel'];
        
        const selectedPowerLevels = formData.allowedTiers.filter(tier => powerLevels.includes(tier));
        const selectedFranchises = formData.allowedTiers.filter(tier => franchises.includes(tier));
        
        // Normalize universe name to match tier format
        const normalizedUniverse = char.universe ? char.universe.toLowerCase().replace(/\s+/g, '-') : '';
        
        // Check matches
        const matchesPowerLevel = selectedPowerLevels.length === 0 || selectedPowerLevels.includes(char.division);
        const matchesFranchise = selectedFranchises.length === 0 || selectedFranchises.includes(normalizedUniverse);
        
        // Both must match (AND logic)
        return matchesPowerLevel && matchesFranchise;
      });
      setAvailableCharacters(filtered);
    }
  }, [formData.allowedTiers, characters]);

  useEffect(() => {
    fetchCharacters();
  }, []);

  useEffect(() => {
    filterAvailableCharacters();
  }, [filterAvailableCharacters]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleTierToggle = (tierId) => {
    setFormData(prev => {
      const newTiers = prev.allowedTiers.includes(tierId)
        ? prev.allowedTiers.filter(id => id !== tierId)
        : [...prev.allowedTiers, tierId];
      return { ...prev, allowedTiers: newTiers };
    });
  };

  const handleCharacterExclude = (characterId) => {
    setFormData(prev => {
      const isExcluded = prev.excludedCharacters.includes(characterId);
      const newExcluded = isExcluded
        ? prev.excludedCharacters.filter(id => id !== characterId)
        : [...prev.excludedCharacters, characterId];
      return { ...prev, excludedCharacters: newExcluded };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!token) {
      setToast({ message: 'You must be logged in to create a tournament', type: 'error' });
      return;
    }

    try {
      const response = await axios.post('/api/tournaments', formData, {
        headers: { 'x-auth-token': token }
      });
      
      setToast({ message: 'Tournament created successfully!', type: 'success' });
      setTimeout(() => {
        if (onTournamentCreated) onTournamentCreated(response.data);
        if (onClose) onClose();
      }, 1000);
    } catch (error) {
      console.error('Error creating tournament:', error);
      setToast({ message: error.response?.data?.msg || 'Error creating tournament', type: 'error' });
    }
  };

  return (
    <div className="create-tournament-form">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <div className="form-header">
        <h2>🏆 Create Tournament</h2>
        <button className="btn-close" onClick={onClose}>Cancel</button>
      </div>
      
      <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tournament Name</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g., Star Wars Championship"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="Describe your tournament..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Max Participants</label>
              <select name="maxParticipants" value={formData.maxParticipants} onChange={handleChange}>
                <option value={8}>8</option>
                <option value={16}>16</option>
                <option value={32}>32</option>
                <option value={64}>64</option>
              </select>
            </div>

            <div className="form-group">
              <label>Team Size</label>
              <select name="teamSize" value={formData.teamSize} onChange={handleChange}>
                <option value={1}>1 Character</option>
                <option value={2}>2 Characters</option>
                <option value={3}>3 Characters</option>
                <option value={5}>5 Characters</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Recruitment Time</label>
              <select name="recruitmentDays" value={formData.recruitmentDays} onChange={handleChange}>
                <option value={1}>1 Day</option>
                <option value={2}>2 Days</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
              </select>
            </div>

            <div className="form-group">
              <label>Battle Time</label>
              <input
                type="time"
                name="battleTime"
                value={formData.battleTime}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Allowed Tiers / Universes</label>
            <div className="tier-selection-section">
              <div className="tier-group">
                <span className="tier-group-label">⚡ Power Levels</span>
                <div className="tier-buttons">
                  {tierOptions.filter(t => t.type === 'power').map(tier => (
                    <button
                      key={tier.id}
                      type="button"
                      className={`tier-btn ${formData.allowedTiers.includes(tier.id) ? 'active' : ''}`}
                      onClick={() => handleTierToggle(tier.id)}
                    >
                      {tier.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="tier-group">
                <span className="tier-group-label">🌌 Universes / Franchises</span>
                <div className="tier-buttons">
                  {tierOptions.filter(t => t.type === 'franchise').map(tier => (
                    <button
                      key={tier.id}
                      type="button"
                      className={`tier-btn franchise-btn ${formData.allowedTiers.includes(tier.id) ? 'active' : ''}`}
                      onClick={() => handleTierToggle(tier.id)}
                    >
                      {tier.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="hint">Leave empty to allow all characters</p>
          </div>

          <div className="form-group">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCharacterPicker(!showCharacterPicker)}
            >
              Exclude Characters ({formData.excludedCharacters.length} excluded)
            </button>
          </div>

          {showCharacterPicker && (
            <div className="character-picker">
              <div className="character-grid">
                {availableCharacters.map(char => (
                  <div
                    key={char.id}
                    className={`character-card ${formData.excludedCharacters.includes(char.id) ? 'excluded' : ''}`}
                    onClick={() => handleCharacterExclude(char.id)}
                  >
                    <img src={char.image} alt={char.name} />
                    <p>{char.name}</p>
                    {formData.excludedCharacters.includes(char.id) && (
                      <div className="excluded-overlay">✖</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="showOnFeed"
                checked={formData.showOnFeed}
                onChange={handleChange}
              />
              <div className="toggle-switch"></div>
              <span>Show battles on main feed</span>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Create Tournament
            </button>
          </div>
        </form>
    </div>
  );
};

export default CreateTournamentForm;
