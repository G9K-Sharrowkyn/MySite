import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import { splitFightTeamMembers } from '../utils/fightTeams';
import CharacterSelector from '../feedLogic/CharacterSelector';
import './CreatePost.css';

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

const getCharacterPreviewFallbacks = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== 'string') return [];
  const clean = imageUrl.replace(/\?.*$/, '');
  const out = [];
  const pushUnique = (value) => {
    if (value && !out.includes(value)) out.push(value);
  };
  pushUnique(clean);

  const hasExt = /\.[a-z0-9]+$/i.test(clean);
  if (!hasExt) {
    pushUnique(`${clean}.jpg`);
  }

  if (clean.includes('(SW)')) {
    const starWarsVariant = clean.replace('(SW)', '(Star Wars)');
    pushUnique(starWarsVariant);
    if (!/\.[a-z0-9]+$/i.test(starWarsVariant)) {
      pushUnique(`${starWarsVariant}.jpg`);
    }
  }

  if (clean.includes('(Star Wars)')) {
    const shortVariant = clean.replace('(Star Wars)', '(SW)');
    pushUnique(shortVariant);
    if (!/\.[a-z0-9]+$/i.test(shortVariant)) {
      pushUnique(`${shortVariant}.jpg`);
    }
  }

  return out;
};

const CreatePost = ({ onPostCreated, initialData, onPostUpdated, onCancel }) => {
  const { t, lang } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(!!initialData);
  const [characters, setCharacters] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // User-vs-user challenge state
  const [fightMode, setFightMode] = useState('community'); // 'community' or 'user_vs_user'
  const [opponentSearch, setOpponentSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const [postData, setPostData] = useState({
    title: '',
    content: '',
    type: 'discussion', // discussion, fight, other
    photos: [],
    category: 'discussion',
    voteDuration: '3d',
    voteVisibility: 'live',
    pollOptions: ['', ''], // For fight posts (mandatory) or other posts (optional)
    teams: [] // For fight posts: array of {name: '', warriors: [{ character, customImage }] }
  });

  const token = localStorage.getItem('token');

  const handleCharacterPreviewError = (event, character) => {
    const image = event.currentTarget;
    let tried = [];
    try {
      tried = image.dataset.tried ? JSON.parse(image.dataset.tried) : [];
    } catch (_error) {
      tried = [];
    }
    const allCandidates = getCharacterPreviewFallbacks(character?.image);
    const nextCandidate = allCandidates.find((candidate) => !tried.includes(candidate));

    if (nextCandidate) {
      const nextTried = [...tried, nextCandidate];
      image.dataset.tried = JSON.stringify(nextTried);
      image.src = nextCandidate;
      return;
    }

    image.onerror = null;
    image.src = '/placeholder-character.png';
  };

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
      const mappedVoteVisibility =
        initialData.fight?.voteVisibility === 'final' ? 'final' : 'live';
      
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
              warriors: splitFightTeamMembers(initialData.fight.teamA).map(name => ({
                character: { name: name.trim() },
                customImage: null
              }))
            });
            mappedPollOptions[0] = initialData.fight.teamA;
          }
          if (initialData.fight.teamB) {
            mappedTeams.push({
              name: 'Team B', 
              warriors: splitFightTeamMembers(initialData.fight.teamB).map(name => ({
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
        voteVisibility: mappedVoteVisibility,
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
  }, [postData.type, postData.teams.length]);

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
    } catch (error) {
      console.error('Error fetching characters:', error);
      setCharacters([]);
    }
  };

  // Search users for challenge
  const handleOpponentSearch = async (e) => {
    const value = e.target.value;
    setOpponentSearch(value);

    if (value.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.get(`/api/posts/search-users?q=${encodeURIComponent(value)}`, {
        headers: { 'x-auth-token': token }
      });
      setSearchResults(response.data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectOpponent = (user) => {
    setSelectedOpponent(user);
    setOpponentSearch(user.username);
    setSearchResults([]);
  };

  const clearOpponent = () => {
    setSelectedOpponent(null);
    setOpponentSearch('');
    setSearchResults([]);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPostData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addTeam = () => {
    setPostData(prev => ({
      ...prev,
      teams: [...prev.teams, { name: '', warriors: [] }]
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

  const validateForm = () => {
    if (!postData.title.trim() || !postData.content.trim()) {
      return false;
    }

    if (postData.type === 'fight') {
      // User-vs-user mode: only need Team A (challenger's team) and opponent
      if (fightMode === 'user_vs_user') {
        if (!selectedOpponent) {
          return false;
        }
        // Only check Team A for user-vs-user
        if (postData.teams.length < 1) {
          return false;
        }
        const teamAHasFighter = postData.teams[0]?.warriors?.some(w => w.character && w.character.name);
        if (!teamAHasFighter) {
          return false;
        }
        return true;
      }

      // Community mode: Fight posts must have at least two teams, each with at least one fighter
      if (postData.teams.length < 2) {
        return false;
      }
      const teamAHasFighter = postData.teams[0].warriors && postData.teams[0].warriors.some(w => w.character && w.character.name);
      const teamBHasFighter = postData.teams[1].warriors && postData.teams[1].warriors.some(w => w.character && w.character.name);
      if (!teamAHasFighter || !teamBHasFighter) {
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token || !validateForm()) return;

    setIsSubmitting(true);
    try {
      // Handle user-vs-user challenge separately
      if (postData.type === 'fight' && fightMode === 'user_vs_user') {
        const teamANames = postData.teams[0]?.warriors.map(w => w.character?.name).filter(Boolean) || [];

        await axios.post('/api/posts/user-challenge', {
          title: postData.title,
          content: postData.content,
          opponentId: selectedOpponent.id,
          challengerTeam: teamANames.join(', '),
          voteDuration: postData.voteDuration,
          photos: postData.photos.map(p => p.url)
        }, {
          headers: { 'x-auth-token': token }
        });

        if (onPostCreated) {
          onPostCreated();
        }

        // Reset form
        setPostData({
          title: '',
          content: '',
          type: 'discussion',
          photos: [],
          category: 'discussion',
          voteDuration: '3d',
          voteVisibility: 'live',
          pollOptions: ['', ''],
          teams: []
        });
        setFightMode('community');
        setSelectedOpponent(null);
        setOpponentSearch('');
        setIsExpanded(false);
        return;
      }

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
        submitData.voteVisibility = postData.voteVisibility;
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
          voteVisibility: 'live',
          pollOptions: ['', ''],
          teams: []
        });
        setFightMode('community');
        setSelectedOpponent(null);
        setOpponentSearch('');
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
        <div className="create-post-prompt create-post-prompt-emphasis" onClick={() => setIsExpanded(true)}>
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
                {/* Fight Mode Selector */}
                <div className="fight-mode-selector">
                  <button
                    type="button"
                    className={`fight-mode-btn${fightMode === 'community' ? ' active' : ''}`}
                    onClick={() => {
                      setFightMode('community');
                      setSelectedOpponent(null);
                      setOpponentSearch('');
                    }}
                  >
                    🌍 {lang === 'pl' ? 'Walka społeczności' : 'Community Fight'}
                  </button>
                  <button
                    type="button"
                    className={`fight-mode-btn${fightMode === 'user_vs_user' ? ' active' : ''}`}
                    onClick={() => setFightMode('user_vs_user')}
                  >
                    ⚔️ {lang === 'pl' ? 'Wyzwij użytkownika' : 'Challenge User'}
                  </button>
                </div>

                {/* User-vs-user: Opponent Search */}
                {fightMode === 'user_vs_user' && (
                  <div className="opponent-search-section">
                    <label>{lang === 'pl' ? 'Wybierz przeciwnika' : 'Choose Opponent'}</label>
                    {selectedOpponent ? (
                      <div className="selected-opponent">
                        <div className="opponent-info">
                          {selectedOpponent.profilePicture && (
                            <img
                              src={selectedOpponent.profilePicture}
                              alt={selectedOpponent.username}
                              className="opponent-avatar"
                            />
                          )}
                          <span className="opponent-name">{selectedOpponent.username}</span>
                          <span className="opponent-rank">{selectedOpponent.rank}</span>
                        </div>
                        <button
                          type="button"
                          className="clear-opponent-btn"
                          onClick={clearOpponent}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="opponent-search-wrapper">
                        <input
                          type="text"
                          placeholder={lang === 'pl' ? 'Wpisz nazwę użytkownika...' : 'Enter username...'}
                          value={opponentSearch}
                          onChange={handleOpponentSearch}
                          className="opponent-search-input"
                        />
                        {isSearching && (
                          <div className="search-loading">{lang === 'pl' ? 'Szukam...' : 'Searching...'}</div>
                        )}
                        {searchResults.length > 0 && (
                          <div className="search-results-dropdown">
                            {searchResults.map((user) => (
                              <div
                                key={user.id}
                                className="search-result-item"
                                onClick={() => selectOpponent(user)}
                              >
                                {user.profilePicture && (
                                  <img
                                    src={user.profilePicture}
                                    alt={user.username}
                                    className="search-result-avatar"
                                  />
                                )}
                                <span className="search-result-name">{user.username}</span>
                                <span className="search-result-rank">{user.rank}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <h4>⚔️ {fightMode === 'user_vs_user' ? (lang === 'pl' ? 'Twoja drużyna' : 'Your Team') : (t('teams') || 'Teams')}</h4>
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

                <div className="vote-visibility">
                  <label htmlFor="voteVisibility">
                    {t('voteVisibility') || 'Vote visibility'}
                  </label>
                  <select
                    id="voteVisibility"
                    name="voteVisibility"
                    value={postData.voteVisibility}
                    onChange={handleInputChange}
                    className="vote-visibility-select"
                  >
                    <option value="live">{t('showLiveVotes') || 'Show live votes'}</option>
                    <option value="final">{t('hideVotesUntilEnd') || 'Hide votes until the end'}</option>
                  </select>
                </div>
                {/* Render first two teams in a horizontal row if present (community mode) */}
                {fightMode === 'community' && postData.teams.length >= 2 && (
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
                                          {...getOptimizedImageProps(warrior.character.image, { size: null })}
                                          alt={warrior.character.name}
                                          onError={(event) => handleCharacterPreviewError(event, warrior.character)}
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
                {/* Render Team A only for user_vs_user mode */}
                {fightMode === 'user_vs_user' && postData.teams.length >= 1 && (
                  <div className="team-builder single-team">
                    <div className="team-header">
                      <h5>{lang === 'pl' ? 'Twoja drużyna' : 'Your Team'}</h5>
                    </div>
                    <div className="warriors horizontal-row">
                      {postData.teams[0]?.warriors.map((warrior, warriorIndex) => (
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
                                  onSelect={(character) => updateWarrior(0, warriorIndex, character)}
                                />
                              </div>
                              {warrior.character && (
                                <div style={{ width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center' }}>
                                  <div className="warrior-preview-frame">
                                    <img
                                      {...getOptimizedImageProps(warrior.character.image, { size: null })}
                                      alt={warrior.character.name}
                                      onError={(event) => handleCharacterPreviewError(event, warrior.character)}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              className="remove-warrior-btn"
                              onClick={() => removeWarrior(0, warriorIndex)}
                            >
                              🗑️ {t('remove')}
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="add-warriors-btn"
                        onClick={() => addWarrior(0, { character: null, customImage: null })}
                      >
                        ➕ {t('addAnotherCharacter') || 'Add another character'}
                      </button>
                    </div>
                    <p className="challenge-info">
                      {lang === 'pl'
                        ? '💡 Przeciwnik wybierze swoją drużynę po zaakceptowaniu wyzwania'
                        : '💡 Opponent will choose their team after accepting the challenge'}
                    </p>
                  </div>
                )}
                {/* Render any additional teams vertically (community mode) */}
                {fightMode === 'community' && postData.teams.length > 2 && postData.teams.slice(2).map((team, index) => (
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
                                      {...getOptimizedImageProps(warrior.character.image, { size: null })}
                                      alt={warrior.character.name}
                                      onError={(event) => handleCharacterPreviewError(event, warrior.character)}
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
                {fightMode === 'community' && (
                  <button
                    type="button"
                    className="add-teams-btn"
                    onClick={addTeam}
                  >
                    ➕ {t('addTeam') || 'Add Team'}
                  </button>
                )}
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
