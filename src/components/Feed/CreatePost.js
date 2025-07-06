import React, { useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../i18n/LanguageContext';
import './CreatePost.css';

const CreatePost = ({ onPostCreated, initialData, onPostUpdated, onCancel }) => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(!!initialData);
  const [postData, setPostData] = useState({
    title: '',
    content: '',
    type: 'discussion',
    teamA: '',
    teamB: '',
    image: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = localStorage.getItem('token');

  React.useEffect(() => {
    if (initialData) {
      setPostData({
        title: initialData.title || '',
        content: initialData.content || '',
        type: initialData.type || 'discussion',
        teamA: initialData.teamA || '',
        teamB: initialData.teamB || '',
        image: initialData.image || ''
      });
      setIsExpanded(true);
    }
  }, [initialData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPostData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token || !postData.title.trim() || !postData.content.trim()) return;

    setIsSubmitting(true);
    try {
      if (initialData && initialData.id) {
        // Update existing post
        const response = await axios.put(`/api/posts/${initialData.id}`, postData, {
          headers: { 'x-auth-token': token }
        });
        if (onPostUpdated) {
          onPostUpdated(response.data);
        }
      } else {
        // Create new post
        await axios.post('/api/posts', postData, {
          headers: { 'x-auth-token': token }
        });
        if (onPostCreated) {
          onPostCreated();
        }
      }

      // Reset form only if creating new post
      if (!initialData) {
        setPostData({
          title: '',
          content: '',
          type: 'discussion',
          teamA: '',
          teamB: '',
          image: ''
        });
        setIsExpanded(false);
      }
    } catch (error) {
      console.error('Error submitting post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'fight': return '⚔️';
      case 'image': return '🖼️';
      case 'poll': return '📊';
      default: return '💬';
    }
  };

  if (!token) {
    return (
      <div className="create-post-card">
        <div className="login-prompt">
          <p>🔐 {t('loginToCreatePosts')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="create-post-card">
      {!isExpanded ? (
        <div className="create-post-prompt" onClick={() => setIsExpanded(true)}>
          <div className="prompt-content">
            <span className="prompt-icon">✨</span>
            <span className="prompt-text">{t('createPost')}</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="create-post-form">
          <div className="form-header">
            <h3>🌟 {t('createNewPost')}</h3>
            <button 
              type="button" 
              className="close-btn"
              onClick={() => setIsExpanded(false)}
            >
              ✕
            </button>
          </div>

          <div className="post-type-selector">
            <button
              type="button"
              className={`type-btn ${postData.type === 'discussion' ? 'active' : ''}`}
              onClick={() => setPostData(prev => ({ ...prev, type: 'discussion' }))}
            >
              💬 {t('discussion')}
            </button>
            <button
              type="button"
              className={`type-btn ${postData.type === 'fight' ? 'active' : ''}`}
              onClick={() => setPostData(prev => ({ ...prev, type: 'fight' }))}
            >
              ⚔️ {t('fight')}
            </button>
            <button
              type="button"
              className={`type-btn ${postData.type === 'image' ? 'active' : ''}`}
              onClick={() => setPostData(prev => ({ ...prev, type: 'image' }))}
            >
              🖼️ {t('image')}
            </button>
            <button
              type="button"
              className={`type-btn ${postData.type === 'poll' ? 'active' : ''}`}
              onClick={() => setPostData(prev => ({ ...prev, type: 'poll' }))}
            >
              📊 {t('poll')}
            </button>
          </div>

          <div className="form-fields">
            <input
              type="text"
              name="title"
              value={postData.title}
              onChange={handleInputChange}
              placeholder={`${getTypeIcon(postData.type)} ${t('postTitle')}`}
              className="title-input"
              required
            />

            <textarea
              name="content"
              value={postData.content}
              onChange={handleInputChange}
              placeholder={t('describeThoughts')}
              className="content-input"
              rows="4"
              required
            />

            {postData.type === 'fight' && (
              <div className="fight-inputs">
                <input
                  type="text"
                  name="teamA"
                  value={postData.teamA}
                  onChange={handleInputChange}
                  placeholder={t('teamAPlaceholder')}
                  className="team-input"
                  required
                />
                <div className="vs-label">VS</div>
                <input
                  type="text"
                  name="teamB"
                  value={postData.teamB}
                  onChange={handleInputChange}
                  placeholder={t('teamBPlaceholder')}
                  className="team-input"
                  required
                />
              </div>
            )}

            {postData.type === 'image' && (
              <input
                type="url"
                name="image"
                value={postData.image}
                onChange={handleInputChange}
                placeholder={t('imageUrl')}
                className="image-input"
              />
            )}
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-btn"
              onClick={() => setIsExpanded(false)}
            >
              {t('cancel')}
            </button>
            <button 
              type="submit" 
              className="submit-btn"
              disabled={isSubmitting || !postData.title.trim() || !postData.content.trim()}
            >
              {isSubmitting ? `📤 ${t('publishing')}` : `🚀 ${t('publish')}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CreatePost;