import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './CharacterSelector.css';

const getApiBaseUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '';
    }
    return `${protocol}//api.${hostname}`;
  }
  return '';
};

const parseCharactersPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.characters)) return payload.characters;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.characters)) return payload.data.characters;
  return [];
};

const CharacterSelector = ({ characters: externalCharacters = null, selectedCharacter, onSelect }) => {
  const hasExternalCharacters = Array.isArray(externalCharacters) && externalCharacters.length > 0;
  const [characters, setCharacters] = useState(hasExternalCharacters ? externalCharacters : []);
  const [filteredCharacters, setFilteredCharacters] = useState([]);
  const [inputValue, setInputValue] = useState(selectedCharacter ? selectedCharacter.name : '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(!hasExternalCharacters);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hasExternalCharacters) {
      setCharacters(externalCharacters);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchCharacters = async () => {
      try {
        let response = await axios.get('/api/characters');
        let parsed = parseCharactersPayload(response.data);

        if (!parsed.length) {
          const apiBase = getApiBaseUrl();
          if (apiBase) {
            response = await axios.get(`${apiBase}/api/characters`);
            parsed = parseCharactersPayload(response.data);
          }
        }

        setCharacters(parsed);
        if (!parsed.length) {
          setError('Character list is currently unavailable');
        } else {
          setError(null);
        }
      } catch (err) {
        setError('Failed to load characters');
      } finally {
        setLoading(false);
      }
    };
    fetchCharacters();
  }, [externalCharacters, hasExternalCharacters]);

  useEffect(() => {
    setInputValue(selectedCharacter ? selectedCharacter.name : '');
  }, [selectedCharacter]);

  useEffect(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) {
      setFilteredCharacters([]);
      setShowSuggestions(false);
      return;
    }
    const filtered = characters.filter((character) => {
      const name = (character.name || '').toLowerCase();
      const baseName = (character.baseName || '').toLowerCase();
      const tags = Array.isArray(character.tags)
        ? character.tags.join(' ').toLowerCase()
        : '';
      return (
        name.includes(query) ||
        baseName.includes(query) ||
        tags.includes(query)
      );
    });
    setFilteredCharacters(filtered);
  }, [inputValue, characters]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (e.target.value.trim().length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      onSelect(null); // Clear selection when input is empty
    }
  };

  const handleFocus = () => {
    if (inputValue.trim().length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const handleSelect = (character) => {
    setInputValue(character.name);
    setShowSuggestions(false);
    onSelect(character);
  };

  if (loading) return <div className="character-selector-loading">Loading characters...</div>;

  return (
    <div className="character-selector">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="Type to search characters..."
        className="character-input"
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {showSuggestions && filteredCharacters.length > 0 && (
        <div className="character-suggestions">
          {filteredCharacters.map(character => (
            <div
              key={character.id}
              className="character-item-name-only"
              onClick={() => handleSelect(character)}
              title={character.name}
            >
              <span className="character-name">{character.name}</span>
            </div>
          ))}
        </div>
      )}
      {error && <div className="character-selector-error">{error}</div>}
    </div>
  );
};

export default CharacterSelector;
