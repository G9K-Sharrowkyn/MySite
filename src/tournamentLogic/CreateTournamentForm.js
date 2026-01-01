import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './CreateTournamentForm.css';

const CreateTournamentForm = ({ onClose, onTournamentCreated }) => {
  const { t } = useLanguage();
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
    { id: 'regularPeople', name: 'Street Level' },
    { id: 'metahuman', name: 'Metahuman' },
    { id: 'planetBusters', name: 'Planet Busters' },
    { id: 'godTier', name: 'God Tier' },
    { id: 'universalThreat', name: 'Universal Threat' }
  ];

  useEffect(() => {
    fetchCharacters();
  }, []);

  useEffect(() => {
    filterAvailableCharacters();
  }, [formData.allowedTiers, characters]);

  const fetchCharacters = async () => {
    try {
      const response = await axios.get('/api/characters');
      setCharacters(response.data);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  };

  const filterAvailableCharacters = () => {
    if (formData.allowedTiers.length === 0) {
      setAvailableCharacters(characters);
    } else {
      const filtered = characters.filter(char => 
        formData.allowedTiers.includes(char.division)
      );
      setAvailableCharacters(filtered);
    }
  };

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
      alert('You must be logged in to create a tournament');
      return;
    }

    try {
      const response = await axios.post('/api/tournaments', formData, {
        headers: { 'x-auth-token': token }
      });
      
      alert('Tournament created successfully!');
      if (onTournamentCreated) onTournamentCreated(response.data);
      if (onClose) onClose();
    } catch (error) {
      console.error('Error creating tournament:', error);
      alert(error.response?.data?.msg || 'Error creating tournament');
    }
  };

  return (
    <div className="create-tournament-modal">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>🏆 Create Tournament</h2>
        
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
            <label>Allowed Tiers</label>
            <div className="tier-selection">
              {tierOptions.map(tier => (
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
              Show battles on main feed
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Tournament
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTournamentForm;
