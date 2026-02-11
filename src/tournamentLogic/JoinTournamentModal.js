import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import Toast from './Toast';
import './JoinTournamentModal.css';

const TOURNAMENT_MODE_CHOOSE_YOUR_WEAPON = 'choose_your_weapon';

const JoinTournamentModal = ({ tournamentId, onClose, onSuccess }) => {
  const [tournament, setTournament] = useState(null);
  const [availableCharacters, setAvailableCharacters] = useState([]);
  const [selectedCharacters, setSelectedCharacters] = useState([]);
  const [teamSize, setTeamSize] = useState(1);

  const [loadoutType, setLoadoutType] = useState('powers');
  const [loadoutBudget, setLoadoutBudget] = useState(10);
  const [loadoutOptionsByCategory, setLoadoutOptionsByCategory] = useState({});
  const [selectedLoadoutOptionIds, setSelectedLoadoutOptionIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const token = localStorage.getItem('token');

  const isLoadoutMode =
    tournament?.mode === TOURNAMENT_MODE_CHOOSE_YOUR_WEAPON ||
    tournament?.settings?.mode === TOURNAMENT_MODE_CHOOSE_YOUR_WEAPON;

  const selectedLoadoutOptions = useMemo(() => {
    const all = Object.values(loadoutOptionsByCategory).flat();
    const map = new Map(all.map((option) => [option.id, option]));
    return selectedLoadoutOptionIds
      .map((id) => map.get(id))
      .filter(Boolean);
  }, [loadoutOptionsByCategory, selectedLoadoutOptionIds]);

  const selectedLoadoutCost = selectedLoadoutOptions.reduce(
    (sum, option) => sum + (option?.cost || 0),
    0
  );

  const fetchTournamentAndOptions = useCallback(async () => {
    setLoading(true);
    try {
      const tournamentRes = await axios.get(`/api/tournaments/${tournamentId}`);
      const tournamentData = tournamentRes.data;
      setTournament(tournamentData);

      const mode =
        tournamentData?.mode || tournamentData?.settings?.mode || 'character';

      if (mode === TOURNAMENT_MODE_CHOOSE_YOUR_WEAPON) {
        const loadoutRes = await axios.get(
          `/api/tournaments/${tournamentId}/loadout-options`,
          { headers: { 'x-auth-token': token } }
        );
        const loadoutData = loadoutRes.data || {};
        setLoadoutType(loadoutData.loadoutType || 'powers');
        setLoadoutBudget(Number(loadoutData.budget) || 10);
        setLoadoutOptionsByCategory(loadoutData.optionsByCategory || {});
      } else {
        const charactersRes = await axios.get(
          `/api/tournaments/${tournamentId}/available-characters`,
          { headers: { 'x-auth-token': token } }
        );
        setAvailableCharacters(charactersRes.data.characters || []);
        setTeamSize(charactersRes.data.teamSize || 1);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setToast({ message: 'Error loading tournament data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tournamentId, token]);

  useEffect(() => {
    fetchTournamentAndOptions();
  }, [fetchTournamentAndOptions]);

  const handleCharacterClick = (character) => {
    if (selectedCharacters.find((entry) => entry.id === character.id)) {
      setSelectedCharacters((prev) => prev.filter((entry) => entry.id !== character.id));
      return;
    }

    if (selectedCharacters.length >= teamSize) {
      setToast({
        message: `You can only select ${teamSize} character(s)`,
        type: 'warning'
      });
      return;
    }

    setSelectedCharacters((prev) => [...prev, character]);
  };

  const handleLoadoutOptionToggle = (option) => {
    const alreadySelected = selectedLoadoutOptionIds.includes(option.id);
    if (alreadySelected) {
      setSelectedLoadoutOptionIds((prev) => prev.filter((id) => id !== option.id));
      return;
    }

    const nextCost = selectedLoadoutCost + (option.cost || 0);
    if (nextCost > loadoutBudget) {
      setToast({
        message: `Budget exceeded (${nextCost}/${loadoutBudget})`,
        type: 'warning'
      });
      return;
    }

    setSelectedLoadoutOptionIds((prev) => [...prev, option.id]);
  };

  const handleJoin = async () => {
    if (!isLoadoutMode && selectedCharacters.length !== teamSize) {
      setToast({
        message: `Please select exactly ${teamSize} character(s)`,
        type: 'warning'
      });
      return;
    }

    try {
      const payload = isLoadoutMode
        ? { selectionIds: selectedLoadoutOptionIds }
        : { characterIds: selectedCharacters.map((entry) => entry.id) };

      await axios.post(`/api/tournaments/${tournamentId}/join`, payload, {
        headers: { 'x-auth-token': token }
      });

      setToast({ message: 'Successfully joined tournament', type: 'success' });
      setTimeout(() => onSuccess(), 800);
    } catch (error) {
      console.error('Error joining tournament:', error);
      setToast({
        message: error.response?.data?.msg || 'Error joining tournament',
        type: 'error'
      });
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
        <button className="modal-close" onClick={onClose} type="button">
          X
        </button>

        <h2>Join Tournament: {tournament?.title}</h2>

        {isLoadoutMode ? (
          <>
            <div className="team-size-info">
              <p>Mode: Choose Your Weapon ({loadoutType})</p>
              <p className="selected-count">
                Budget: ${selectedLoadoutCost} / ${loadoutBudget}
              </p>
            </div>

            <div className="selected-loadout-preview">
              {selectedLoadoutOptions.map((option) => (
                <div key={option.id} className="selected-loadout-badge">
                  <span>{option.name}</span>
                  <strong>${option.cost}</strong>
                  <button type="button" onClick={() => handleLoadoutOptionToggle(option)}>
                    X
                  </button>
                </div>
              ))}
            </div>

            <div className="available-characters">
              <h3>Available Options</h3>
              {Object.entries(loadoutOptionsByCategory).map(([category, options]) => (
                <div key={category} className="loadout-join-category">
                  <h4>{category}</h4>
                  <div className="loadout-join-grid">
                    {options.map((option) => {
                      const selected = selectedLoadoutOptionIds.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`loadout-join-option ${selected ? 'selected' : ''}`}
                          onClick={() => handleLoadoutOptionToggle(option)}
                          title={option.description}
                        >
                          <span>{option.name}</span>
                          <strong>${option.cost}</strong>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="team-size-info">
              <p>Select {teamSize} character(s) for your team</p>
              <p className="selected-count">
                Selected: {selectedCharacters.length}/{teamSize}
              </p>
            </div>

            <div className="selected-characters-preview">
              {selectedCharacters.map((char) => (
                <div key={char.id} className="selected-char-badge">
                  <img src={char.image} alt={char.name} />
                  <span>{char.name}</span>
                  <button type="button" onClick={() => handleCharacterClick(char)}>
                    X
                  </button>
                </div>
              ))}
            </div>

            <div className="available-characters">
              <h3>Available Characters ({availableCharacters.length})</h3>
              <div className="characters-grid">
                {availableCharacters.map((char) => {
                  const isSelected = selectedCharacters.find((entry) => entry.id === char.id);
                  return (
                    <div
                      key={char.id}
                      className={`character-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleCharacterClick(char)}
                    >
                      <img src={char.image} alt={char.name} />
                      <p className="char-name">{char.name}</p>
                      <span className="char-tier">{char.division}</span>
                      {isSelected && <div className="selected-indicator">OK</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="btn-join"
            onClick={handleJoin}
            type="button"
            disabled={!isLoadoutMode && selectedCharacters.length !== teamSize}
          >
            Join Tournament
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinTournamentModal;
