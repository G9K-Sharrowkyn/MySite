import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import CharacterSelector from '../feedLogic/CharacterSelector';
import './CreatePost.css';

const CreatePost = ({ onPostCreated, initialData, onPostUpdated, onCancel }) => {
  const { t, lang } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(!!initialData);
  const [characters, setCharacters] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [postData, setPostData] = useState({
    title: '',
    content: '',
    type: 'discussion', // discussion, fight, other
    photos: [],
    category: 'discussion',
    voteDuration: '3d',
    pollOptions: ['', ''], // For fight posts (mandatory) or other posts (optional)
    teams: [] // For fight posts: array of {name: '', warriors: [{ character, customImage }] }
  });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchCharacters();
    if (initialData) {
      // Map backend post structure to frontend format
      let mappedTeams = [];
      let mappedPollOptions = ['', ''];
      const resolveVoteDuration = (lockTime, createdAt) => {
        if (!lockTime) return 'none';
        const created = createdAt ? new Date(createdAt).getTime() : Date.now();
        const lock = new Date(lockTime).getTime();
        if (!Number.isFinite(created) || !Number.isFinite(lock)) return '3d';
        const diffDays = Math.round((lock - created) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) return '1d';
        if (diffDays === 2) return '2d';
        if (diffDays === 3) return '3d';
        if (diffDays === 7) return '7d';
        return '3d';
      };
      let mappedVoteDuration = '3d';
      
      if (initialData.type === 'fight') {
        mappedVoteDuration = resolveVoteDuration(
          initialData.fight?.lockTime,
          initialData.createdAt
        );
        // Convert teamA/teamB structure to teams array
        if (initialData.fight) {
          if (initialData.fight.teamA) {
            mappedTeams.push({
              name: 'Team A',
              warriors: initialData.fight.teamA.split(',').map(name => ({
                character: { name: name.trim() },
                customImage: null
              }))
            });
            mappedPollOptions[0] = initialData.fight.teamA;
          }
          if (initialData.fight.teamB) {
            mappedTeams.push({
              name: 'Team B', 
              warriors: initialData.fight.teamB.split(',').map(name => ({
                character: { name: name.trim() },
                customImage: null
              }))
            });
            mappedPollOptions[1] = initialData.fight.teamB;
          }
        }
      } else if (initialData.poll && initialData.poll.options) {
        // For other post types with polls
        mappedPollOptions = [...initialData.poll.options];
      }
      
      setPostData({
        title: initialData.title || '',
        content: initialData.content || '',
        type: initialData.type || 'discussion',
        photos: initialData.photos ? initialData.photos.map(url => ({ url, type: 'database' })) : [],
        category: initialData.category || 'discussion',
        voteDuration: mappedVoteDuration,
        pollOptions: mappedPollOptions,
        teams: mappedTeams
      });
      setIsExpanded(true);
    }
  }, [initialData]);

  // When switching to fight type, always initialize with two teams and one empty fighter each
  useEffect(() => {
    if (postData.type === 'fight' && postData.teams.length === 0) {
      setPostData(prev => ({
        ...prev,
        teams: [
          { name: 'Team A', warriors: [{ character: null, customImage: null }] },
          { name: 'Team B', warriors: [{ character: null, customImage: null }] }
        ]
      }));
    }
  }, [postData.type]);

  const fetchCharacters = async () => {
    try {
      const response = await axios.get('/api/characters');
      setCharacters(response.data);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPostData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePollOptionChange = (index, value) => {
    const newPollOptions = [...postData.pollOptions];
    newPollOptions[index] = value;
    setPostData(prev => ({
      ...prev,
      pollOptions: newPollOptions
    }));
  };

  const addPollOption = () => {
    setPostData(prev => ({
      ...prev,
      pollOptions: [...prev.pollOptions, '']
    }));
  };

  const removePollOption = (index) => {
    if (postData.pollOptions.length > 2) {
      const newPollOptions = postData.pollOptions.filter((_, i) => i !== index);
      setPostData(prev => ({
        ...prev,
        pollOptions: newPollOptions
      }));
    }
  };

  const addTeam = () => {
    setPostData(prev => ({
      ...prev,
      teams: [...prev.teams, { name: '', warriors: [] }]
    }));
  };

  const updateTeam = (index, team) => {
    setPostData(prev => ({
      ...prev,
      teams: prev.teams.map((t, i) => i === index ? team : t)
    }));
  };

  const removeTeam = (index) => {
    const newTeams = postData.teams.filter((_, i) => i !== index);
    setPostData(prev => ({
      ...prev,
      teams: newTeams
    }));
  };

  const addWarrior = (teamIndex, warrior) => {
    const newTeams = [...postData.teams];
    newTeams[teamIndex] = {
      ...newTeams[teamIndex],
      warriors: [...newTeams[teamIndex].warriors, warrior]
    };
    setPostData(prev => ({
      ...prev,
      teams: newTeams
    }));
  };

  const updateWarrior = (teamIndex, warriorIndex, character) => {
    const newTeams = [...postData.teams];
    newTeams[teamIndex] = {
      ...newTeams[teamIndex],
      warriors: newTeams[teamIndex].warriors.map((w, i) => i === warriorIndex ? { ...w, character } : w)
    };
    setPostData(prev => ({
      ...prev,
      teams: newTeams
    }));
  };

  const updateWarriorImage = (teamIndex, warriorIndex, customImage) => {
    const newTeams = [...postData.teams];
    newTeams[teamIndex] = {
      ...newTeams[teamIndex],
      warriors: newTeams[teamIndex].warriors.map((w, i) => i === warriorIndex ? { ...w, customImage } : w)
    };
    setPostData(prev => ({
      ...prev,
      teams: newTeams
    }));
  };

  const handleWarriorImageUpload = (teamIndex, warriorIndex, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateWarriorImage(teamIndex, warriorIndex, reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeWarrior = (teamIndex, warriorIndex) => {
    const newTeams = [...postData.teams];
    newTeams[teamIndex] = {
      ...newTeams[teamIndex],
      warriors: newTeams[teamIndex].warriors.filter((_, i) => i !== warriorIndex)
    };
    setPostData(prev => ({
      ...prev,
      teams: newTeams
    }));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPostData(prev => ({
          ...prev,
          photos: [...prev.photos, { url: reader.result, type: 'upload' }]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const selectPhotoFromDatabase = (photoUrl) => {
    setPostData(prev => ({
      ...prev,
      photos: [...prev.photos, { url: photoUrl, type: 'database' }]
    }));
  };

  const removePhoto = (index) => {
    setPostData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    if (!postData.title.trim() || !postData.content.trim()) {
      return false;
    }
    
    if (postData.type === 'fight') {
      // Fight posts must have at least two teams, each with at least one fighter
      if (postData.teams.length < 2) {
        return false;
      }
      const teamAHasFighter = postData.teams[0].warriors && postData.teams[0].warriors.some(w => w.character && w.character.name);
      const teamBHasFighter = postData.teams[1].warriors && postData.teams[1].warriors.some(w => w.character && w.character.name);
      if (!teamAHasFighter || !teamBHasFighter) {
        return false;
      }
      // Removed pollOptions check for fight posts
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token || !validateForm()) return;

    setIsSubmitting(true);
    try {
      const submitData = {
        title: postData.title,
        content: postData.content,
        type: postData.type,
        photos: postData.photos.map(p => p.url),
        pollOptions: postData.pollOptions.filter(opt => opt.trim()),
        voteDuration: postData.voteDuration,
        category: postData.type === 'fight' ? null : postData.category
      };

      if (postData.type === 'fight') {
        // For fight posts, create teamA and teamB from teams
        const teamANames = postData.teams[0]?.warriors.map(w => w.character?.name).filter(Boolean) || [];
        const teamBNames = postData.teams[1]?.warriors.map(w => w.character?.name).filter(Boolean) || [];
        
        submitData.teamA = teamANames.join(', ');
        submitData.teamB = teamBNames.join(', ');
      }

      if (initialData && initialData.id) {
        // Update existing post
        const response = await axios.put(`/api/posts/${initialData.id}`, submitData, {
          headers: { 'x-auth-token': token }
        });
        if (onPostUpdated) {
          onPostUpdated(response.data);
        }
      } else {
        // Create new post
        await axios.post('/api/posts', submitData, {
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
        photos: [],
        category: 'discussion',
        voteDuration: '3d',
        pollOptions: ['', ''],
        teams: []
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
      case 'other': return '🖼️';
      default: return '💬';
    }
  };

  // Helper for ordinal labels
  const getCharacterLabel = (index, t, lang) => {
    if (lang === 'pl') {
      const ordinals = ['Pierwsza postać', 'Druga postać', 'Trzecia postać', 'Czwarta postać', 'Piąta postać', 'Szósta postać', 'Siódma postać', 'Ósma postać', 'Dziewiąta postać', 'Dziesiąta postać'];
      return `${index + 1}. ${ordinals[index] || 'Postać'}`;
    } else {
      const ordinals = ['First character', 'Second character', 'Third character', 'Fourth character', 'Fifth character', 'Sixth character', 'Seventh character', 'Eighth character', 'Ninth character', 'Tenth character'];
      return `${index + 1}. ${ordinals[index] || 'Character'}`;
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

          {/* Post Type Selector */}
          <div className="post-type-selector">
            <button
              type="button"
              className={`type-btn${postData.type === 'discussion' ? ' active' : ''}`}
              onClick={() => setPostData(prev => ({ ...prev, type: 'discussion' }))}
            >
              {t('discussion') || 'Discussion'}
            </button>
            <button
              type="button"
              className={`type-btn${postData.type === 'fight' ? ' active' : ''}`}
              onClick={() => setPostData(prev => ({ ...prev, type: 'fight' }))}
            >
              {t('fight') || 'Fight'}
            </button>
          </div>

          {postData.type !== 'fight' && (
            <div className="post-category">
              <label htmlFor="postCategory">
                {t('postCategory') || 'Post category'}
              </label>
              <select
                id="postCategory"
                name="category"
                value={postData.category}
                onChange={handleInputChange}
                className="post-category-select"
              >
                <option value="question">{t('categoryQuestion') || 'Question'}</option>
                <option value="discussion">{t('categoryDiscussion') || 'Discussion'}</option>
                <option value="article">{t('categoryArticle') || 'Article'}</option>
              </select>
            </div>
          )}

          {/* Basic Post Fields */}
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

            {/* Photo Upload Section */}
            {/* Entire photo-section removed */}

            {/* Fight Section */}
            {postData.type === 'fight' && (
              <div className="fight-section">
                <h4>⚔️ {t('teams') || 'Teams'}</h4>
                <div className="vote-duration">
                  <label htmlFor="voteDuration">
                    {t('voteDuration') || 'Voting ends'}
                  </label>
                  <select
                    id="voteDuration"
                    name="voteDuration"
                    value={postData.voteDuration}
                    onChange={handleInputChange}
                    className="vote-duration-select"
                  >
                    <option value="1d">{t('oneDay') || '1 day'}</option>
                    <option value="2d">{t('twoDays') || '2 days'}</option>
                    <option value="3d">{t('threeDays') || '3 days'}</option>
                    <option value="7d">{t('oneWeek') || '1 week'}</option>
                    <option value="none">{t('noTimeLimit') || 'No time limit'}</option>
                  </select>
                </div>
                {/* Render first two teams in a horizontal row if present */}
                {postData.teams.length >= 2 && (
                  <div className="teams-row">
                    {postData.teams.slice(0, 2).map((team, index) => (
                      <div key={index} className="team-builder">
                        <div className="team-header">
                          <h5>{team.name}</h5>
                          <button
                            type="button"
                            className="remove-team-btn"
                            onClick={() => removeTeam(index)}
                          >
                            🗑️ {t('remove')}
                          </button>
                        </div>
                        {/* Horizontal row for warriors */}
                        <div className="warriors horizontal-row">
                          {team.warriors.map((warrior, warriorIndex) => (
                            <div key={warriorIndex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <div className="character-label">
                                {getCharacterLabel(warriorIndex, t, lang)}
                              </div>
                              <div className="warrior-pair compact">
                                <div className="warrior-inputs" style={{ width: '100%' }}>
                                  <div className="warrior-input" style={{ width: '100%' }}>
                                    <CharacterSelector
                                      characters={characters}
                                      selectedCharacter={warrior.character}
                                      onSelect={(character) => updateWarrior(index, warriorIndex, character)}
                                    />
                                  </div>
                                  {warrior.character && (
                                    <div style={{ width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
                                      <div className="warrior-preview-frame">
                                        <img
                                          {...getOptimizedImageProps(warrior.character.image, { size: 220 })}
                                          alt={warrior.character.name}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="remove-warrior-btn"
                                  onClick={() => removeWarrior(index, warriorIndex)}
                                >
                                  🗑️ {t('remove')}
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="add-warriors-btn"
                            onClick={() => addWarrior(index, { character: null, customImage: null })}
                          >
                            ➕ {t('addAnotherCharacter') || 'Add another character'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Render any additional teams vertically */}
                {postData.teams.length > 2 && postData.teams.slice(2).map((team, index) => (
                  <div key={index + 2} className="team-builder">
                    <div className="team-header">
                      <h5>{team.name}</h5>
                      <button
                        type="button"
                        className="remove-team-btn"
                        onClick={() => removeTeam(index + 2)}
                      >
                        🗑️ {t('remove')}
                      </button>
                    </div>
                    {/* Horizontal row for warriors */}
                    <div className="warriors horizontal-row">
                      {team.warriors.map((warrior, warriorIndex) => (
                        <div key={warriorIndex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div className="character-label">
                            {getCharacterLabel(warriorIndex, t, lang)}
                          </div>
                          <div className="warrior-pair compact">
                            <div className="warrior-inputs" style={{ width: '100%' }}>
                              <div className="warrior-input" style={{ width: '100%' }}>
                                <CharacterSelector
                                  characters={characters}
                                  selectedCharacter={warrior.character}
                                  onSelect={(character) => updateWarrior(index + 2, warriorIndex, character)}
                                />
                              </div>
                              {warrior.character && (
                                <div style={{ width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
                                  <div className="warrior-preview-frame">
                                    <img
                                      {...getOptimizedImageProps(warrior.character.image, { size: 220 })}
                                      alt={warrior.character.name}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              className="remove-warrior-btn"
                              onClick={() => removeWarrior(index + 2, warriorIndex)}
                            >
                              🗑️ {t('remove')}
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="add-warriors-btn"
                        onClick={() => addWarrior(index + 2, { character: null, customImage: null })}
                      >
                        ➕ {t('addAnotherCharacter') || 'Add another character'}
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="add-teams-btn"
                  onClick={addTeam}
                >
                  ➕ {t('addTeam') || 'Add Team'}
                </button>
              </div>
            )}
          </div>

          {/* Form Actions */}
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
              disabled={isSubmitting || !validateForm()}
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
