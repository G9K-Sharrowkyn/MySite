import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './CharacterSelector.css';

const CharacterSelector = ({ selectedCharacter, onSelect }) => {
  const [characters, setCharacters] = useState([]);
  const [filteredCharacters, setFilteredCharacters] = useState([]);
  const [inputValue, setInputValue] = useState(selectedCharacter ? selectedCharacter.name : '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const response = await axios.get('/api/characters');
        setCharacters(response.data);
        setFilteredCharacters(response.data);
      } catch (err) {
        setError('Failed to load characters');
      } finally {
        setLoading(false);
      }
    };
    fetchCharacters();
  }, []);

  useEffect(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) {
      setFilteredCharacters([]);
      setShowSuggestions(false);
      onSelect(null);
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
  if (error) return <div className="character-selector-error">{error}</div>;

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
        <div className="character-suggestions-right">
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
    </div>
  );
};

export default CharacterSelector;
