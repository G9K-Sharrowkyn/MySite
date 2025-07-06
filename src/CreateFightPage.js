import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './CreateFightPage.css';

const CreateFightPage = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    fighter1: '',
    fighter2: '',
    fighter1Image: '',
    fighter2Image: '',
    category: 'Mixed',
    type: 'feed',
    endDate: ''
  });
  const [categories, setCategories] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
    fetchCharacters();
    fetchUserData();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/fights/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchCharacters = async () => {
    try {
      const response = await axios.get('/api/characters');
      setCharacters(response.data);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  };

  const fetchUserData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const response = await axios.get('/api/profile/me', {
        headers: { 'x-auth-token': token }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
      navigate('/login');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCharacterSelect = (fighterNumber, character) => {
    setFormData(prev => ({
      ...prev,
      [`fighter${fighterNumber}`]: character.name,
      [`fighter${fighterNumber}Image`]: character.image
    }));
  };

  const generateRandomFight = () => {
    if (characters.length < 2) return;

    const shuffled = [...characters].sort(() => 0.5 - Math.random());
    const fighter1 = shuffled[0];
    const fighter2 = shuffled[1];

    setFormData(prev => ({
      ...prev,
      title: `${fighter1.name} vs ${fighter2.name}`,
      fighter1: fighter1.name,
      fighter2: fighter2.name,
      fighter1Image: fighter1.image,
      fighter2Image: fighter2.image,
      category: fighter1.universe === fighter2.universe ? 
        getUniverseCategory(fighter1.universe) : 'Mixed'
    }));
  };

  const getUniverseCategory = (universe) => {
    const categoryMap = {
      'Dragon Ball': 'Anime',
      'Naruto': 'Anime',
      'One Piece': 'Anime',
      'Bleach': 'Anime',
      'Marvel': 'Marvel',
      'DC': 'DC',
      'Pokemon': 'Gaming',
      'Star Wars': 'Movies'
    };
    return categoryMap[universe] || 'Mixed';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validation
    if (!formData.title.trim()) {
      setError('Tytuł walki jest wymagany');
      setLoading(false);
      return;
    }

    if (!formData.fighter1.trim() || !formData.fighter2.trim()) {
      setError('Musisz wybrać obu wojowników');
      setLoading(false);
      return;
    }

    if (formData.fighter1 === formData.fighter2) {
      setError('Wojownicy muszą być różni');
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Musisz być zalogowany, aby utworzyć walkę');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post('/api/fights', formData, {
        headers: { 'x-auth-token': token }
      });

      setSuccess('Walka została utworzona pomyślnie!');
      setTimeout(() => {
        navigate(`/fight/${response.data.fight.id}`);
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.msg || 'Błąd podczas tworzenia walki');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="create-fight-page loading">Ładowanie...</div>;
  }

  return (
    <div className="create-fight-page">
      <div className="page-header">
        <h1>Stwórz nową walkę</h1>
        <p>Wybierz swoich wojowników i pozwól społeczności zdecydować, kto wygra!</p>
      </div>

      <form onSubmit={handleSubmit} className="create-fight-form">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {/* Fight Type */}
        <div className="form-section">
          <h3>Typ walki</h3>
          <div className="fight-type-selector">
            <label className={`type-option ${formData.type === 'feed' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="type"
                value="feed"
                checked={formData.type === 'feed'}
                onChange={handleInputChange}
              />
              <div className="type-content">
                <span className="type-icon">🔥</span>
                <span className="type-title">Feed społeczności</span>
                <span className="type-description">Walka widoczna w feedzie społeczności</span>
              </div>
            </label>
            
            {user.role === 'moderator' && (
              <label className={`type-option ${formData.type === 'main' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="type"
                  value="main"
                  checked={formData.type === 'main'}
                  onChange={handleInputChange}
                />
                <div className="type-content">
                  <span className="type-icon">🏆</span>
                  <span className="type-title">Główna walka</span>
                  <span className="type-description">Oficjalna walka moderatora</span>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Basic Info */}
        <div className="form-section">
          <h3>Podstawowe informacje</h3>
          <div className="form-group">
            <label>Tytuł walki *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="np. Goku vs Superman - Kto jest silniejszy?"
              required
            />
          </div>

          <div className="form-group">
            <label>Opis walki</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Opisz kontekst walki, zasady, lub inne szczegóły..."
              rows="4"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Kategoria</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Data zakończenia</label>
              <input
                type="datetime-local"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                min={new Date().toISOString().slice(0, 16)}
              />
              <small>Pozostaw puste dla domyślnego czasu (7 dni)</small>
            </div>
          </div>
        </div>

        {/* Fighters Selection */}
        <div className="form-section">
          <h3>Wybór wojowników</h3>
          <div className="random-fight-button">
            <button
              type="button"
              onClick={generateRandomFight}
              className="btn btn-secondary"
            >
              🎲 Losowa walka
            </button>
          </div>

          <div className="fighters-selection">
            {/* Fighter 1 */}
            <div className="fighter-selection">
              <h4>Wojownik 1</h4>
              <div className="fighter-preview">
                {formData.fighter1Image && (
                  <img src={formData.fighter1Image} alt={formData.fighter1} />
                )}
                <div className="fighter-info">
                  <input
                    type="text"
                    name="fighter1"
                    value={formData.fighter1}
                    onChange={handleInputChange}
                    placeholder="Nazwa wojownika"
                    required
                  />
                  <input
                    type="url"
                    name="fighter1Image"
                    value={formData.fighter1Image}
                    onChange={handleInputChange}
                    placeholder="URL obrazka"
                  />
                </div>
              </div>
              
              <div className="character-grid">
                {characters.slice(0, 10).map(character => (
                  <div
                    key={character.id}
                    className={`character-option ${formData.fighter1 === character.name ? 'selected' : ''}`}
                    onClick={() => handleCharacterSelect(1, character)}
                  >
                    <img src={character.image} alt={character.name} />
                    <span>{character.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="vs-divider">
              <span>VS</span>
            </div>

            {/* Fighter 2 */}
            <div className="fighter-selection">
              <h4>Wojownik 2</h4>
              <div className="fighter-preview">
                {formData.fighter2Image && (
                  <img src={formData.fighter2Image} alt={formData.fighter2} />
                )}
                <div className="fighter-info">
                  <input
                    type="text"
                    name="fighter2"
                    value={formData.fighter2}
                    onChange={handleInputChange}
                    placeholder="Nazwa wojownika"
                    required
                  />
                  <input
                    type="url"
                    name="fighter2Image"
                    value={formData.fighter2Image}
                    onChange={handleInputChange}
                    placeholder="URL obrazka"
                  />
                </div>
              </div>
              
              <div className="character-grid">
                {characters.slice(10, 20).map(character => (
                  <div
                    key={character.id}
                    className={`character-option ${formData.fighter2 === character.name ? 'selected' : ''}`}
                    onClick={() => handleCharacterSelect(2, character)}
                  >
                    <img src={character.image} alt={character.name} />
                    <span>{character.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-outline"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Tworzenie...' : 'Stwórz walkę'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateFightPage;