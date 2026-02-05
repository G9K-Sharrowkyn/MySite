import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './FeedbackButton.css';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const FeedbackButton = () => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState('character');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reportedUser, setReportedUser] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [characterTags, setCharacterTags] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handler = (event) => {
      const detail = event?.detail || {};
      if (detail?.type === 'user' && typeof detail?.username === 'string') {
        setReportType('user');
        setReportedUser(detail.username);
        setTitle(`User report: ${detail.username}`);
        setDescription('');
        setSuccessMessage('');
        setErrorMessage('');
        setIsOpen(true);
      }
    };
    window.addEventListener('open-feedback', handler);
    return () => window.removeEventListener('open-feedback', handler);
  }, []);

  const resetCharacterFields = () => {
    setCharacterName('');
    setCharacterTags('');
    setImageFile(null);
    setImagePreview('');
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMessage(t('fileTooLarge') || 'File size must be less than 5MB');
      return;
    }

    if (!String(file.type || '').startsWith('image/')) {
      setErrorMessage(t('invalidFileType') || 'Please upload an image file');
      return;
    }

    setImageFile(file);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setErrorMessage(t('fillAllFields') || 'Please fill in all required fields');
      return;
    }

    if (reportType === 'user' && !reportedUser.trim()) {
      setErrorMessage(t('provideUsername') || 'Please provide the username to report');
      return;
    }

    if (reportType === 'character') {
      if (!characterName.trim() || !characterTags.trim()) {
        setErrorMessage(t('provideCharacterDetails') || 'Please provide character name and tags');
        return;
      }

      // Only file uploads - no URL option (avoids mixed content + hotlink failures).
      if (!imageFile) {
        setErrorMessage(t('pleaseUploadImage') || 'Please upload an image file');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const token = localStorage.getItem('token');
      const imageDataToSend =
        reportType === 'character' && imageFile ? await readFileAsDataUrl(imageFile) : '';

      await axios.post(
        '/api/feedback',
        {
          type: reportType,
          title,
          description,
          reportedUser: reportType === 'user' ? reportedUser : undefined,
          characterName: reportType === 'character' ? characterName : undefined,
          characterTags:
            reportType === 'character'
              ? characterTags.split(',').map((value) => value.trim()).filter(Boolean)
              : undefined,
          characterImage: reportType === 'character' ? imageDataToSend : undefined
        },
        {
          headers: token ? { 'x-auth-token': token } : {}
        }
      );

      setSuccessMessage(t('feedbackSent') || 'Thank you! Your report has been sent.');
      setTitle('');
      setDescription('');
      setReportedUser('');
      resetCharacterFields();

      setTimeout(() => {
        setIsOpen(false);
        setSuccessMessage('');
        setReportType('character');
      }, 2000);
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.msg || t('feedbackError') || 'Failed to send report'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        className="feedback-button"
        onClick={() => setIsOpen(!isOpen)}
        title={t('reportIssue') || 'Report an issue'}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          <path d="M11 5h2v6h-2zm0 8h2v2h-2z" />
        </svg>
      </button>

      <div className={`feedback-panel ${isOpen ? 'open' : ''}`}>
        <div className="feedback-header">
          <h2>{t('reportIssue') || 'Report an Issue'}</h2>
          <button className="close-btn" onClick={() => setIsOpen(false)} type="button">
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} className="feedback-form">
          <div className="form-group">
            <label>{t('reportType') || 'Report Type'} *</label>
            <select
              value={reportType}
              onChange={(e) => {
                const nextType = e.target.value;
                setReportType(nextType);
                setSuccessMessage('');
                setErrorMessage('');
                if (nextType !== 'character') {
                  resetCharacterFields();
                }
              }}
              className="feedback-select"
            >
              <option value="character">{t('suggestCharacter') || 'Suggest Character'}</option>
              <option value="bug">{t('reportBug') || 'Report Bug'}</option>
              <option value="feature">{t('featureRequest') || 'Feature Request'}</option>
              <option value="user">{t('reportUser') || 'Report User'}</option>
              <option value="other">{t('other') || 'Other'}</option>
            </select>
          </div>

          {reportType === 'user' && (
            <div className="form-group">
              <label>{t('username') || 'Username'} *</label>
              <input
                type="text"
                value={reportedUser}
                onChange={(e) => setReportedUser(e.target.value)}
                placeholder={t('enterUsername') || 'Enter username to report'}
                className="feedback-input"
              />
            </div>
          )}

          {reportType === 'character' && (
            <>
              <div className="form-group">
                <label>{t('characterName') || 'Character Name'} *</label>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder={t('enterCharacterName') || 'Enter character name'}
                  className="feedback-input"
                />
              </div>
              <div className="form-group">
                <label>{t('characterTags') || 'Tags (comma separated)'} *</label>
                <input
                  type="text"
                  value={characterTags}
                  onChange={(e) => setCharacterTags(e.target.value)}
                  placeholder={t('enterTags') || 'e.g. DC, Hero, Swamp Thing'}
                  className="feedback-input"
                />
              </div>
              <div className="form-group">
                <label>{t('characterImage') || 'Character Image'} *</label>
                <div className="file-upload-section">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="feedback-file-input"
                    id="character-image-file"
                  />
                  <label htmlFor="character-image-file" className="file-upload-label">
                    {imageFile ? imageFile.name : (t('chooseFile') || 'Choose file (max 5MB)')}
                  </label>
                  {imagePreview && (
                    <div className="image-preview-container">
                      <img src={imagePreview} alt="Preview" className="image-preview" />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>{t('title') || 'Title'} *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('shortDescription') || 'Short description'}
              className="feedback-input"
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label>{t('description') || 'Description'} *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('detailedDescription') || 'Detailed description...'}
              className="feedback-textarea"
              rows={6}
              maxLength={1000}
            />
            <small>{description.length}/1000</small>
          </div>

          {successMessage && <div className="feedback-success">{successMessage}</div>}
          {errorMessage && <div className="feedback-error">{errorMessage}</div>}

          <div className="feedback-actions">
            <button type="button" onClick={() => setIsOpen(false)} className="btn-cancel">
              {t('cancel') || 'Cancel'}
            </button>
            <button type="submit" className="btn-submit" disabled={isSubmitting}>
              {isSubmitting ? (t('sending') || 'Sending...') : (t('send') || 'Send')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default FeedbackButton;

