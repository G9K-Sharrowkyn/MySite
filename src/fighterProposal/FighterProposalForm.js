import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import './FighterProposalForm.css';

const FighterProposalForm = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    universe: '',
    powerLevel: 'Regular People',
    abilities: '',
    image: null
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const fileInputRef = useRef(null);

  const powerLevels = [
    'Regular People',
    'Metahuman', 
    'Planet Busters',
    'God Tier',
    'Universal Threat',
    'Omnipotent'
  ];

  const universes = [
    'DC Comics',
    'Marvel Comics',
    'Dragon Ball',
    'Naruto',
    'One Piece',
    'Attack on Titan',
    'My Hero Academia',
    'Demon Slayer',
    'Jujutsu Kaisen',
    'One Punch Man',
    'Bleach',
    'Hunter x Hunter',
    'Fullmetal Alchemist',
    'Death Note',
    'Pokemon',
    'Digimon',
    'Yu-Gi-Oh!',
    'Street Fighter',
    'Tekken',
    'Mortal Kombat',
    'League of Legends',
    'Overwatch',
    'Final Fantasy',
    'Kingdom Hearts',
    'Star Wars',
    'Lord of the Rings',
    'Harry Potter',
    'Game of Thrones',
    'The Witcher',
    'Cyberpunk',
    'Mass Effect',
    'Halo',
    'Destiny',
    'Warcraft',
    'Warhammer',
    'Transformers',
    'Power Rangers',
    'Ben 10',
    'Avatar: The Last Airbender',
    'Teen Titans',
    'Justice League',
    'Avengers',
    'X-Men',
    'Spider-Man',
    'Batman',
    'Superman',
    'Wonder Woman',
    'The Flash',
    'Green Lantern',
    'Aquaman',
    'Thor',
    'Iron Man',
    'Captain America',
    'Hulk',
    'Wolverine',
    'Deadpool',
    'Fantastic Four',
    'Guardians of the Galaxy',
    'Inhumans',
    'Defenders',
    'Netflix Marvel',
    'MCU',
    'DCEU',
    'Arrowverse',
    'Anime Original',
    'Manga Original',
    'Video Game Original',
    'Movie Original',
    'TV Show Original',
    'Book Original',
    'Comic Original',
    'Web Series',
    'YouTube',
    'Twitch',
    'Internet Meme',
    'Real Person',
    'Historical Figure',
    'Mythology',
    'Religion',
    'Folklore',
    'Urban Legend',
    'Creepypasta',
    'SCP Foundation',
    'Other'
  ];

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        showNotification(t('fighterProposal.invalidFileType'), 'error');
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        showNotification(t('fighterProposal.fileTooLarge'), 'error');
        return;
      }

      setFormData(prev => ({
        ...prev,
        image: file
      }));

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({
      ...prev,
      image: null
    }));
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      showNotification(t('fighterProposal.nameRequired'), 'error');
      return;
    }

    if (!formData.description.trim()) {
      showNotification(t('fighterProposal.descriptionRequired'), 'error');
      return;
    }

    if (!formData.universe.trim()) {
      showNotification(t('fighterProposal.universeRequired'), 'error');
    }

    if (!formData.image) {
      showNotification(t('fighterProposal.imageRequired'), 'error');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showNotification(t('fighterProposal.loginRequired'), 'error');
        setLoading(false);
        return;
      }

      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('name', formData.name.trim());
      submitData.append('description', formData.description.trim());
      submitData.append('universe', formData.universe.trim());
      submitData.append('powerLevel', formData.powerLevel);
      submitData.append('abilities', formData.abilities.trim());
      submitData.append('image', formData.image);

      const response = await axios.post('/api/fighter-proposals', submitData, {
        headers: {
          'x-auth-token': token,
          'Content-Type': 'multipart/form-data'
        }
      });

      showNotification(t('fighterProposal.proposalSubmitted'), 'success');
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        universe: '',
        powerLevel: 'Regular People',
        abilities: '',
        image: null
      });
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Error submitting fighter proposal:', error);
      const errorMessage = error.response?.data?.message || t('fighterProposal.submissionError');
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fighter-proposal-form">
      <div className="form-header">
        <h1>🥊 {t('fighterProposal.proposeNewFighter')}</h1>
        <p>{t('fighterProposal.formDescription')}</p>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="proposal-form">
        <div className="form-section">
          <h3>📝 {t('fighterProposal.basicInfo')}</h3>
          
          <div className="form-group">
            <label htmlFor="name">{t('fighterProposal.fighterName')} *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder={t('fighterProposal.fighterNamePlaceholder')}
              required
              maxLength={100}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="universe">{t('fighterProposal.universe')} *</label>
              <select
                id="universe"
                name="universe"
                value={formData.universe}
                onChange={handleInputChange}
                required
              >
                <option value="">{t('fighterProposal.selectUniverse')}</option>
                {universes.map(universe => (
                  <option key={universe} value={universe}>{universe}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="powerLevel">{t('fighterProposal.powerLevel')} *</label>
              <select
                id="powerLevel"
                name="powerLevel"
                value={formData.powerLevel}
                onChange={handleInputChange}
                required
              >
                {powerLevels.map(level => (
                  <option key={level} value={level}>
                    {t(`divisions.${level.toLowerCase().replace(' ', '')}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">{t('fighterProposal.description')} *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder={t('fighterProposal.descriptionPlaceholder')}
              required
              rows="4"
              maxLength={1000}
            />
            <div className="char-count">
              {formData.description.length}/1000
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="abilities">{t('fighterProposal.abilities')}</label>
            <textarea
              id="abilities"
              name="abilities"
              value={formData.abilities}
              onChange={handleInputChange}
              placeholder={t('fighterProposal.abilitiesPlaceholder')}
              rows="3"
              maxLength={500}
            />
            <div className="char-count">
              {formData.abilities.length}/500
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>🖼️ {t('fighterProposal.fighterImage')} *</h3>
          <p className="image-requirements">
            {t('fighterProposal.imageRequirements')}
          </p>

          <div className="image-upload-area">
            {!imagePreview ? (
              <div className="upload-placeholder">
                <div className="upload-icon">📷</div>
                <p>{t('fighterProposal.clickToUpload')}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  required
                />
              </div>
            ) : (
              <div className="image-preview">
                <img src={imagePreview} alt="Fighter preview" />
                <button
                  type="button"
                  className="remove-image-btn"
                  onClick={handleRemoveImage}
                >
                  ✕ {t('fighterProposal.removeImage')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                {t('fighterProposal.submitting')}
              </>
            ) : (
              <>
                🚀 {t('fighterProposal.submitProposal')}
              </>
            )}
          </button>
        </div>
      </form>

      <div className="form-footer">
        <div className="info-box">
          <h4>ℹ️ {t('fighterProposal.importantInfo')}</h4>
          <ul>
            <li>{t('fighterProposal.moderatorReview')}</li>
            <li>{t('fighterProposal.originalContent')}</li>
            <li>{t('fighterProposal.appropriateContent')}</li>
            <li>{t('fighterProposal.qualityImages')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FighterProposalForm;