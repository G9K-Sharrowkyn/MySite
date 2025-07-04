import React, { useState, useEffect } from 'react';
import api from './api';
import Notification from './Notification';
import './CharacterSelectionPage.css';

const CharacterSelectionPage = () => {
  const [characters, setCharacters] = useState([]);
  const [selectedCharacters, setSelectedCharacters] = useState([]);
  const [notification, setNotification] = useState(null);

  const fetchCharacters = async () => {
    try {
      const res = await api.get('/api/characters');
      setCharacters(res.data);
    } catch (err) {
      showNotification('Błąd podczas pobierania postaci.', 'error');
    }
  };

  const fetchSelectedCharacters = async () => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    if (!token || !userId) return;
    try {
      const res = await api.get(`/api/profile/${userId}`);
      setSelectedCharacters(res.data.selectedCharacters || []);
    } catch (err) {
      showNotification('Błąd podczas pobierania wybranych postaci.', 'error');
    }
  };

  useEffect(() => {
    fetchCharacters();
    fetchSelectedCharacters();
  }, []);

  const showNotification = (message, type) => {
    setNotification({ message, type });
  };

  const clearNotification = () => {
    setNotification(null);
  };

  const handleSelect = (charId) => {
    if (selectedCharacters.includes(charId)) {
      setSelectedCharacters(selectedCharacters.filter(id => id !== charId));
    } else {
      if (selectedCharacters.length >= 2) {
        showNotification('Możesz wybrać maksymalnie dwie postacie.', 'error');
        return;
      }
      setSelectedCharacters([...selectedCharacters, charId]);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      showNotification('Musisz być zalogowany, aby zapisać drużynę.', 'error');
      return;
    }
    try {
      await api.put('/api/profile/me', { selectedCharacters }, {
        headers: { 'x-auth-token': token },
      });
      showNotification('Drużyna zapisana!', 'success');
    } catch (err) {
      showNotification('Błąd podczas zapisywania drużyny.', 'error');
    }
  };

  return (
    <div className="character-selection-page">
      <h1>Wybierz swoją drużynę</h1>
      <Notification message={notification?.message} type={notification?.type} onClose={clearNotification} />
      <div className="character-list">
        {characters.map(char => (
          <div key={char.id} className={`character-card${selectedCharacters.includes(char.id) ? ' selected' : ''}`} onClick={() => handleSelect(char.id)}>
            <img src={char.image} alt={char.name} />
            <h3>{char.name}</h3>
            <p>{char.universe}</p>
          </div>
        ))}
      </div>
      <button onClick={handleSave} className="save-team-btn">Zapisz drużynę</button>
    </div>
  );
};

export default CharacterSelectionPage;
