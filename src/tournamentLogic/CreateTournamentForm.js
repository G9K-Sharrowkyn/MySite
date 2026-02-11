import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Toast from './Toast';
import './CreateTournamentForm.css';

const TOURNAMENT_MODE_CHARACTER = 'character';
const TOURNAMENT_MODE_CHOOSE_YOUR_WEAPON = 'choose_your_weapon';

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

const formatDateTimeLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const normalizeUniverse = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .trim();

const CreateTournamentForm = ({ onClose, onTournamentCreated }) => {
  const [toast, setToast] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [availableCharacters, setAvailableCharacters] = useState([]);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [loadoutCatalog, setLoadoutCatalog] = useState([]);
  const [loadoutCatalogByCategory, setLoadoutCatalogByCategory] = useState({});
  const [loadoutCatalogLabel, setLoadoutCatalogLabel] = useState('');
  const [loadingLoadoutCatalog, setLoadingLoadoutCatalog] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    maxParticipants: 32,
    recruitmentDays: 2,
    battleDate: '',
    teamSize: 1,
    showOnFeed: false,
    voteVisibility: 'live',

    mode: TOURNAMENT_MODE_CHARACTER,
    loadoutType: 'powers',
    budget: 10,
    allowAllLoadoutOptions: true,
    allowedLoadoutOptionIds: [],

    allowedTiers: [],
    excludedCharacters: []
  });

  const token = localStorage.getItem('token');

  const fetchCharacters = useCallback(async () => {
    try {
      const response = await axios.get('/api/characters');
      setCharacters(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  }, []);

  const fetchLoadoutCatalog = useCallback(async (loadoutType) => {
    setLoadingLoadoutCatalog(true);
    try {
      const response = await axios.get('/api/tournaments/loadout-catalog', {
        params: { type: loadoutType }
      });
      const data = response.data || {};
      setLoadoutCatalog(Array.isArray(data.options) ? data.options : []);
      setLoadoutCatalogByCategory(data.optionsByCategory || {});
      setLoadoutCatalogLabel(data.catalogLabel || '');
    } catch (error) {
      console.error('Error fetching loadout catalog:', error);
      setLoadoutCatalog([]);
      setLoadoutCatalogByCategory({});
      setLoadoutCatalogLabel('');
      setToast({ message: 'Could not load powers/weapons catalog', type: 'error' });
    } finally {
      setLoadingLoadoutCatalog(false);
    }
  }, []);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  useEffect(() => {
    if (formData.mode !== TOURNAMENT_MODE_CHOOSE_YOUR_WEAPON) return;
    fetchLoadoutCatalog(formData.loadoutType);
  }, [formData.mode, formData.loadoutType, fetchLoadoutCatalog]);

  useEffect(() => {
    if (formData.battleDate) return;
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + (Number(formData.recruitmentDays) || 2));
    setFormData((prev) => ({ ...prev, battleDate: formatDateTimeLocal(minDate) }));
  }, [formData.battleDate, formData.recruitmentDays]);

  useEffect(() => {
    if (formData.mode !== TOURNAMENT_MODE_CHARACTER) {
      setAvailableCharacters([]);
      return;
    }

    if (!formData.allowedTiers.length) {
      setAvailableCharacters(characters);
      return;
    }

    const powerLevels = ['regularPeople', 'metahuman', 'planetBusters', 'godTier', 'universalThreat'];
    const franchises = ['star-wars', 'dragon-ball', 'dc', 'marvel'];
    const selectedPowerLevels = formData.allowedTiers.filter((tier) => powerLevels.includes(tier));
    const selectedFranchises = formData.allowedTiers.filter((tier) => franchises.includes(tier));

    const filtered = characters.filter((char) => {
      const matchesPowerLevel =
        selectedPowerLevels.length === 0 || selectedPowerLevels.includes(char.division);
      const matchesFranchise =
        selectedFranchises.length === 0 ||
        selectedFranchises.includes(normalizeUniverse(char.universe));
      return matchesPowerLevel && matchesFranchise;
    });

    setAvailableCharacters(filtered);
  }, [formData.allowedTiers, formData.mode, characters]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleTierToggle = (tierId) => {
    setFormData((prev) => {
      const next = prev.allowedTiers.includes(tierId)
        ? prev.allowedTiers.filter((id) => id !== tierId)
        : [...prev.allowedTiers, tierId];
      return { ...prev, allowedTiers: next };
    });
  };

  const handleCharacterExclude = (characterId) => {
    setFormData((prev) => {
      const next = prev.excludedCharacters.includes(characterId)
        ? prev.excludedCharacters.filter((id) => id !== characterId)
        : [...prev.excludedCharacters, characterId];
      return { ...prev, excludedCharacters: next };
    });
  };

  const handleLoadoutOptionToggle = (optionId) => {
    setFormData((prev) => {
      const next = prev.allowedLoadoutOptionIds.includes(optionId)
        ? prev.allowedLoadoutOptionIds.filter((id) => id !== optionId)
        : [...prev.allowedLoadoutOptionIds, optionId];
      return { ...prev, allowedLoadoutOptionIds: next };
    });
  };

  const selectedLoadoutCost = formData.allowedLoadoutOptionIds.reduce((sum, optionId) => {
    const option = loadoutCatalog.find((entry) => entry.id === optionId);
    return sum + (option?.cost || 0);
  }, 0);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!token) {
      setToast({ message: 'You must be logged in to create a tournament', type: 'error' });
      return;
    }

    if (!formData.battleDate) {
      setToast({ message: 'Please select a battle date and time', type: 'error' });
      return;
    }

    if (
      formData.mode === TOURNAMENT_MODE_CHOOSE_YOUR_WEAPON &&
      !formData.allowAllLoadoutOptions &&
      formData.allowedLoadoutOptionIds.length === 0
    ) {
      setToast({
        message: 'Select at least one option or enable all options',
        type: 'warning'
      });
      return;
    }

    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const battleDateTime = new Date(formData.battleDate);
      const battleTime = `${String(battleDateTime.getHours()).padStart(2, '0')}:${String(
        battleDateTime.getMinutes()
      ).padStart(2, '0')}`;

      const payload = {
        title: formData.title,
        description: formData.description,
        maxParticipants: Number(formData.maxParticipants) || 32,
        recruitmentDays: Number(formData.recruitmentDays) || 2,
        battleDate: battleDateTime.toISOString(),
        battleTime,
        userTimezone,
        showOnFeed: !!formData.showOnFeed,
        voteVisibility: formData.voteVisibility,
        mode: formData.mode
      };

      if (formData.mode === TOURNAMENT_MODE_CHOOSE_YOUR_WEAPON) {
        payload.loadoutType = formData.loadoutType;
        payload.budget = Number(formData.budget) || 10;
        payload.allowAllLoadoutOptions = !!formData.allowAllLoadoutOptions;
        payload.allowedLoadoutOptionIds = formData.allowAllLoadoutOptions
          ? []
          : formData.allowedLoadoutOptionIds;
      } else {
        payload.teamSize = Number(formData.teamSize) || 1;
        payload.allowedTiers = formData.allowedTiers;
        payload.excludedCharacters = formData.excludedCharacters;
      }

      const response = await axios.post('/api/tournaments', payload, {
        headers: { 'x-auth-token': token }
      });

      setToast({ message: 'Tournament created successfully', type: 'success' });
      setTimeout(() => {
        if (onTournamentCreated) onTournamentCreated(response.data);
        if (onClose) onClose();
      }, 900);
    } catch (error) {
      console.error('Error creating tournament:', error);
      setToast({
        message: error.response?.data?.msg || 'Error creating tournament',
        type: 'error'
      });
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
        <h2>Create Tournament</h2>
        <button className="btn-close" onClick={onClose} type="button">
          Cancel
        </button>
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
            placeholder="e.g. Star Wars Championship"
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

        <div className="form-group">
          <label>Mode</label>
          <select name="mode" value={formData.mode} onChange={handleChange}>
            <option value={TOURNAMENT_MODE_CHARACTER}>Classic Character Tournament</option>
            <option value={TOURNAMENT_MODE_CHOOSE_YOUR_WEAPON}>
              Choose Your Weapon
            </option>
          </select>
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

          {formData.mode === TOURNAMENT_MODE_CHARACTER ? (
            <div className="form-group">
              <label>Team Size</label>
              <select name="teamSize" value={formData.teamSize} onChange={handleChange}>
                <option value={1}>1 Character</option>
                <option value={2}>2 Characters</option>
                <option value={3}>3 Characters</option>
                <option value={5}>5 Characters</option>
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label>Loadout Type</label>
              <select name="loadoutType" value={formData.loadoutType} onChange={handleChange}>
                <option value="powers">Powers</option>
                <option value="weapons">Weapons</option>
              </select>
            </div>
          )}
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
            <label>Battle Start Time (Local)</label>
            <input
              type="datetime-local"
              name="battleDate"
              value={formData.battleDate}
              onChange={handleChange}
              required
              min={(() => {
                const minDate = new Date();
                minDate.setDate(minDate.getDate() + (Number(formData.recruitmentDays) || 2));
                return formatDateTimeLocal(minDate);
              })()}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Vote Visibility</label>
          <select name="voteVisibility" value={formData.voteVisibility} onChange={handleChange}>
            <option value="live">Show live votes</option>
            <option value="final">Hide votes until the end</option>
          </select>
        </div>

        {formData.mode === TOURNAMENT_MODE_CHARACTER && (
          <>
            <div className="form-group">
              <label>Allowed Tiers / Universes</label>
              <div className="tier-selection-section">
                <div className="tier-group">
                  <span className="tier-group-label">Power Levels</span>
                  <div className="tier-buttons">
                    {tierOptions
                      .filter((tier) => tier.type === 'power')
                      .map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          className={`tier-btn ${
                            formData.allowedTiers.includes(tier.id) ? 'active' : ''
                          }`}
                          onClick={() => handleTierToggle(tier.id)}
                        >
                          {tier.name}
                        </button>
                      ))}
                  </div>
                </div>
                <div className="tier-group">
                  <span className="tier-group-label">Franchises</span>
                  <div className="tier-buttons">
                    {tierOptions
                      .filter((tier) => tier.type === 'franchise')
                      .map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          className={`tier-btn franchise-btn ${
                            formData.allowedTiers.includes(tier.id) ? 'active' : ''
                          }`}
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
                onClick={() => setShowCharacterPicker((prev) => !prev)}
              >
                Exclude Characters ({formData.excludedCharacters.length})
              </button>
            </div>

            {showCharacterPicker && (
              <div className="character-picker">
                <div className="character-grid">
                  {availableCharacters.map((char) => (
                    <div
                      key={char.id}
                      className={`character-card ${
                        formData.excludedCharacters.includes(char.id) ? 'excluded' : ''
                      }`}
                      onClick={() => handleCharacterExclude(char.id)}
                    >
                      <img src={char.image} alt={char.name} />
                      <p>{char.name}</p>
                      {formData.excludedCharacters.includes(char.id) && (
                        <div className="excluded-overlay">X</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {formData.mode === TOURNAMENT_MODE_CHOOSE_YOUR_WEAPON && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Budget ($)</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  name="budget"
                  value={formData.budget}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="allowAllLoadoutOptions"
                    checked={formData.allowAllLoadoutOptions}
                    onChange={handleChange}
                  />
                  <div className="toggle-switch"></div>
                  <span>Allow all options</span>
                </label>
              </div>
            </div>

            <div className="form-group loadout-summary">
              <div>
                <strong>{loadoutCatalogLabel || 'Catalog'}</strong>
                <span> options: {loadoutCatalog.length}</span>
              </div>
              {!formData.allowAllLoadoutOptions && (
                <div>
                  enabled: {formData.allowedLoadoutOptionIds.length} | sum cost: ${selectedLoadoutCost}
                </div>
              )}
            </div>

            {!formData.allowAllLoadoutOptions && (
              <div className="loadout-catalog">
                {loadingLoadoutCatalog && <p className="hint">Loading catalog...</p>}
                {Object.entries(loadoutCatalogByCategory).map(([category, options]) => (
                  <div key={category} className="loadout-category">
                    <h4>{category}</h4>
                    <div className="loadout-option-grid">
                      {options.map((option) => {
                        const active = formData.allowedLoadoutOptionIds.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={`loadout-option-btn ${active ? 'active' : ''}`}
                            onClick={() => handleLoadoutOptionToggle(option.id)}
                            title={option.description}
                          >
                            <span className="loadout-option-name">{option.name}</span>
                            <span className="loadout-option-cost">${option.cost}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
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
