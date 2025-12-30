import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { placeholderImages, getOptimizedImageProps } from '../utils/placeholderImage';
import CharacterSelector from '../feedLogic/CharacterSelector';
import Modal from '../Modal/Modal';
import './ModeratorPanel.css';

const ModeratorPanel = () => {
  const [activeTab, setActiveTab] = useState('fights');
  const [fights, setFights] = useState([]);
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [bets, setBets] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [divisionStats, setDivisionStats] = useState({});
  const [seasonConfigs, setSeasonConfigs] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [divisionOverview, setDivisionOverview] = useState({
    stats: {},
    champions: {},
    titleFights: {},
    activeFights: {},
    championshipHistory: {}
  });
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [feedback, setFeedback] = useState([]);
  const [feedbackFilter, setFeedbackFilter] = useState('all');
  const [showDeleteFeedbackModal, setShowDeleteFeedbackModal] = useState(false);
  const [feedbackToDelete, setFeedbackToDelete] = useState(null);
  
  // Fight creation state
  const [newFight, setNewFight] = useState({
    title: '',
    description: '',
    character1: null,
    character2: null,
    category: 'Main Event',
    featured: false
  });

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const { t } = useLanguage();

  // Default English division names for matching
  const DEFAULT_ENGLISH_DIVISION_NAMES = {
    regular: 'Regular People',
    metahuman: 'Metahumans',
    planetBusters: 'Planet Busters',
    godTier: 'God Tier',
    universalThreat: 'Universal Threat',
    'star-wars': 'Star Wars',
    'dragon-ball': 'Dragon Ball',
    dc: 'DC',
    marvel: 'Marvel'
  };

  // Fallback seasons with translations
  const fallbackSeasons = useMemo(
    () => [
      {
        id: 'regular',
        name: t('regularPeople'),
        description: '',
        image: '/site/regularpeople.jpg',
        accent: '#9aa0a6'
      },
      {
        id: 'metahuman',
        name: t('metahuman'),
        description: '',
        image: '/site/metahumans.jpg',
        accent: '#1f8f5f'
      },
      {
        id: 'planetBusters',
        name: t('planetBusters'),
        description: '',
        image: '/site/planetbusters.jpg',
        accent: '#e67e22'
      },
      {
        id: 'godTier',
        name: t('godTier'),
        description: '',
        image: '/site/gods.jpg',
        accent: '#6f42c1'
      },
      {
        id: 'universalThreat',
        name: t('universalThreat'),
        description: '',
        image: '/site/universal.jpg',
        accent: '#c0392b'
      },
      {
        id: 'star-wars',
        name: 'Star Wars',
        description: '',
        image: '/site/starwarskoldvisions.jpg',
        accent: '#1c1f2b'
      },
      {
        id: 'dragon-ball',
        name: 'Dragon Ball',
        description: '',
        image: '/site/dragonball.jpg',
        accent: '#ff7b00'
      },
      {
        id: 'dc',
        name: 'DC',
        description: '',
        image: '/site/dc.jpg',
        accent: '#1b4f9c'
      },
      {
        id: 'marvel',
        name: 'Marvel',
        description: '',
        image: '/site/marvel.jpg',
        accent: '#c0392b'
      }
    ],
    [t]
  );

  // Merged seasons with translations
  const mergedSeasons = useMemo(() => {
    if (seasonConfigs.length === 0) {
      return fallbackSeasons.map((season) => ({ ...season, status: 'locked' }));
    }

    const fallbackMap = new Map(fallbackSeasons.map((item) => [item.id, item]));
    return seasonConfigs.map((season) => {
      const fallback = fallbackMap.get(season.id) || {};
      const defaultEnglishName = DEFAULT_ENGLISH_DIVISION_NAMES[season.id];
      const isDefaultEnglishName =
        season.name && defaultEnglishName && season.name.trim().toLowerCase() === defaultEnglishName.toLowerCase();
      const displayName = isDefaultEnglishName ? fallback.name || season.name || season.id : season.name || fallback.name || season.id;
      const description = season.description || fallback.description || '';
      return {
        ...fallback,
        ...season,
        name: displayName,
        description,
        bannerImage: season.bannerImage || fallback.image,
        accentColor: season.accentColor || fallback.accent || '#6c757d'
      };
    });
  }, [seasonConfigs, fallbackSeasons, DEFAULT_ENGLISH_DIVISION_NAMES]);

  const showNotification = useCallback((message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const fetchDivisions = useCallback(async () => {
    if (!token) return;

    try {
      const response = await axios.get('/api/divisions', {
        headers: { 'x-auth-token': token }
      });
      setDivisions(response.data || []);
    } catch (error) {
      console.error('Error fetching divisions:', error);
    }
  }, [token]);

  const fetchSeasons = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get('/api/divisions/seasons', {
        headers: { 'x-auth-token': token }
      });
      setSeasonConfigs(response.data || []);
    } catch (error) {
      console.error('Error fetching seasons:', error);
      setSeasonConfigs([]);
    }
  }, [token]);

  const fetchDivisionOverview = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get('/api/divisions/overview', {
        headers: { 'x-auth-token': token }
      });
      setDivisionOverview(response.data || {
        stats: {},
        champions: {},
        titleFights: {},
        activeFights: {},
        championshipHistory: {}
      });
    } catch (error) {
      console.error('Error fetching division overview:', error);
    }
  }, [token]);

  const checkModeratorAccess = useCallback(async () => {
    try {
      const response = await axios.get('/api/profile/me', {
        headers: { 'x-auth-token': token }
      });
      
      // Allow both moderators and admins
      if (response.data.role !== 'moderator' && response.data.role !== 'admin') {
        showNotification('Brak uprawnień moderatora', 'error');
        navigate('/');
      }
    } catch (error) {
      console.error('Error checking moderator access:', error);
      navigate('/login');
    }
  }, [navigate, showNotification, token]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [fightsRes, postsRes, usersRes, charactersRes, betsRes, divisionsRes, feedbackRes] = await Promise.all([
        axios.get('/api/posts/official'),
        axios.get('/api/posts'),
        axios.get('/api/profile/all', {
          headers: { 'x-auth-token': token }
        }),
        axios.get('/api/characters'),
        axios.get('/api/betting/moderator/all', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: [] })), // Fallback if betting not available
        axios.get('/api/divisions/stats', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: {} })), // Fallback if divisions not available
        axios.get('/api/feedback', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: [] })) // Fallback if feedback not available
      ]);

      setFights(fightsRes.data.fights || fightsRes.data);
      setPosts(postsRes.data.posts || postsRes.data);
      setUsers(usersRes.data);
      setCharacters(charactersRes.data);
      setBets(betsRes.data || []);
      setDivisionStats(divisionsRes.data || {});
      setFeedback(feedbackRes.data || []);
      
      // Fetch divisions data
      await Promise.all([fetchDivisions(), fetchSeasons()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Błąd podczas ładowania danych', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchDivisions, fetchSeasons, showNotification, token]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    checkModeratorAccess();
    fetchData();
  }, [checkModeratorAccess, fetchData, navigate, token]);

  const handleFightSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!newFight.character1 || !newFight.character2) {
        showNotification('Wybierz obie postacie do walki', 'error');
        setLoading(false);
        return;
      }

      const fightData = {
        type: 'fight',
        title: newFight.title,
        content: newFight.description,
        teamA: newFight.character1.name,
        teamB: newFight.character2.name,
        featured: newFight.featured,
        category: newFight.category,
        isOfficial: true,
        moderatorCreated: true
      };

      await axios.post('/api/posts', fightData, {
        headers: { 'x-auth-token': token }
      });

      showNotification('Oficjalna walka została utworzona!', 'success');
      setNewFight({
        title: '',
        description: '',
        character1: null,
        character2: null,
        category: 'Main Event',
        featured: false
      });
      
      fetchData();
    } catch (error) {
      console.error('Error creating fight:', error);
      showNotification('Błąd podczas tworzenia walki', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = (postId) => {
    setPostToDelete(postId);
    setShowDeleteModal(true);
  };

  const confirmDeletePost = async () => {
    try {
      await axios.delete(`/api/posts/${postToDelete}`, {
        headers: { 'x-auth-token': token }
      });
      
      showNotification('Post został usunięty', 'success');
      fetchData();
      setShowDeleteModal(false);
      setPostToDelete(null);
    } catch (error) {
      console.error('Error deleting post:', error);
      showNotification('Błąd podczas usuwania postu', 'error');
    }
  };

  const handleFeaturePost = async (postId, featured) => {
    try {
      await axios.put(`/api/posts/${postId}`, 
        { featured: !featured },
        { headers: { 'x-auth-token': token } }
      );
      
      showNotification(
        !featured ? 'Post został wyróżniony' : 'Post przestał być wyróżniony', 
        'success'
      );
      fetchData();
    } catch (error) {
      console.error('Error featuring post:', error);
      showNotification('Błąd podczas zmiany statusu postu', 'error');
    }
  };

  const handleSettleBet = async (betId, result) => {
    try {
      await axios.post(`/api/betting/moderator/settle/${betId}`,
        { result },
        { headers: { 'x-auth-token': token } }
      );
      
      showNotification('Zakład został rozliczony', 'success');
      fetchData();
    } catch (error) {
      console.error('Error settling bet:', error);
      showNotification('Błąd podczas rozliczania zakładu', 'error');
    }
  };

  const handleRefundBet = async (betId) => {
    try {
      await axios.post(`/api/betting/moderator/refund/${betId}`, {}, {
        headers: { 'x-auth-token': token }
      });
      
      showNotification('Zakład został zwrócony', 'success');
      fetchData();
    } catch (error) {
      console.error('Error refunding bet:', error);
      showNotification('Błąd podczas zwracania zakładu', 'error');
    }
  };

  const handleUpdateFeedback = async (feedbackId, status, notes = '') => {
    try {
      await axios.put(`/api/feedback/${feedbackId}`, 
        { status, adminNotes: notes },
        { headers: { 'x-auth-token': token } }
      );
      
      showNotification(t('moderatorPanel.feedbackUpdated'), 'success');
      fetchData();
    } catch (error) {
      console.error('Error updating feedback:', error);
      showNotification(t('moderatorPanel.errorUpdating'), 'error');
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    setFeedbackToDelete(feedbackId);
    setShowDeleteFeedbackModal(true);
  };

  const confirmDeleteFeedback = async () => {
    if (!feedbackToDelete) return;

    try {
      await axios.delete(`/api/feedback/${feedbackToDelete}`, {
        headers: { 'x-auth-token': token }
      });
      
      showNotification(t('moderatorPanel.feedbackDeleted'), 'success');
      fetchData();
      setShowDeleteFeedbackModal(false);
      setFeedbackToDelete(null);
    } catch (error) {
      console.error('Error deleting feedback:', error);
      showNotification(t('moderatorPanel.errorDeleting'), 'error');
    }
  };

  const handleApproveCharacter = async (feedbackId) => {
    try {
      await axios.post(`/api/feedback/${feedbackId}/approve-character`, {}, {
        headers: { 'x-auth-token': token }
      });
      
      showNotification(t('moderatorPanel.characterApproved'), 'success');
      fetchData();
    } catch (error) {
      console.error('Error approving character:', error);
      showNotification(t('moderatorPanel.errorApproving'), 'error');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pl-PL');
  };

  const formatCurrency = (amount) => {
    return `${amount} 🪙`;
  };
  const getLocalDateTime = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const getSeasonStatus = (season) => {
    if (season.status) {
      return season.status === 'active'
        ? 'Aktywny'
        : season.status === 'scheduled'
          ? 'Zaplanowany'
          : season.status === 'ended'
            ? 'Zakończony'
            : 'Zablokowany';
    }

    if (season.isLocked) {
      return 'Zablokowany';
    }
    if (!season.startAt && !season.endAt) {
      return 'Nieustawiony';
    }
    const now = new Date();
    const start = season.startAt ? new Date(season.startAt) : null;
    const end = season.endAt ? new Date(season.endAt) : null;

    if (start && now < start) {
      return 'Zaplanowany';
    }
    if (end && now > end) {
      return 'Zakończony';
    }
    return 'Aktywny';
  };

  const updateSeasonField = (seasonId, field, value) => {
    setSeasonConfigs((prev) =>
      prev.map((season) =>
        season.id === seasonId ? { ...season, [field]: value } : season
      )
    );
  };

  const handleScheduleSeason = async (seasonId) => {
    const season = seasonConfigs.find((item) => item.id === seasonId);
    if (!season) return;
    try {
      await axios.patch(
        `/api/divisions/seasons/${seasonId}`,
        {
          startAt: season.startAt || null,
          endAt: season.endAt || null,
          name: season.name,
          bannerImage: season.bannerImage,
          accentColor: season.accentColor,
          description: season.description
        },
        { headers: { 'x-auth-token': token } }
      );
      showNotification(season.startAt || season.endAt ? t('moderatorPanel.scheduleSaved') : t('moderatorPanel.scheduleRemoved'), 'success');
      fetchSeasons();
    } catch (error) {
      console.error('Error scheduling season:', error);
      showNotification(t('moderatorPanel.errorSchedule'), 'error');
    }
  };

  const handleStartSeasonNow = async (seasonId) => {
    try {
      await axios.post(
        `/api/divisions/seasons/${seasonId}/activate`,
        {},
        { headers: { 'x-auth-token': token } }
      );
      showNotification(t('moderatorPanel.seasonStarted'), 'success');
      fetchSeasons();
    } catch (error) {
      console.error('Error activating season:', error);
      showNotification(t('moderatorPanel.errorActivating'), 'error');
    }
  };

  const handleEndSeasonNow = async (seasonId) => {
    try {
      await axios.post(
        `/api/divisions/seasons/${seasonId}/deactivate`,
        {},
        { headers: { 'x-auth-token': token } }
      );
      showNotification(t('moderatorPanel.seasonEnded'), 'success');
      fetchSeasons();
    } catch (error) {
      console.error('Error deactivating season:', error);
      showNotification(t('moderatorPanel.errorEnding'), 'error');
    }
  };

  const handleRunScheduler = async () => {
    try {
      await axios.post('/api/divisions/seasons/run-scheduler', {}, {
        headers: { 'x-auth-token': token }
      });
      showNotification('Scheduler uruchomiony', 'success');
      fetchSeasons();
    } catch (error) {
      console.error('Error running scheduler:', error);
      showNotification('Błąd uruchamiania scheduler', 'error');
    }
  };


  // Division Management Functions
  const handleCreateTitleFight = async (divisionId, challengerId) => {
    try {
      await axios.post(`/api/divisions/${divisionId}/title-fight`,
        { challengerId },
        { headers: { 'x-auth-token': token } }
      );
      
      showNotification('Walka o tytuł została utworzona!', 'success');
      fetchData();
    } catch (error) {
      console.error('Error creating title fight:', error);
      showNotification('Błąd podczas tworzenia walki o tytuł', 'error');
    }
  };

  const handleCreateContenderMatch = async (divisionId, fighter1Id, fighter2Id) => {
    try {
      await axios.post(`/api/divisions/${divisionId}/contender-match`,
        { fighter1Id, fighter2Id },
        { headers: { 'x-auth-token': token } }
      );
      
      showNotification('Walka pretendentów została utworzona!', 'success');
      fetchData();
    } catch (error) {
      console.error('Error creating contender match:', error);
      showNotification('Błąd podczas tworzenia walki pretendentów', 'error');
    }
  };

  const handleLockExpiredFights = async () => {
    try {
      const response = await axios.post('/api/divisions/lock-expired-fights', {}, {
        headers: { 'x-auth-token': token }
      });
      
      showNotification(`Zablokowano ${response.data.lockedCount} walk`, 'success');
      fetchData();
    } catch (error) {
      console.error('Error locking expired fights:', error);
      showNotification('Błąd podczas blokowania walk', 'error');
    }
  };

  if (loading && fights.length === 0) {
    return (
      <div className="moderator-panel">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Ładowanie panelu moderatora...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="moderator-panel">
      <div className="panel-header">
        <h1>🛡️ Panel Moderatora</h1>
        <p>Zarządzaj treścią i społecznością GeekFights</p>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      <div className="panel-tabs">
        <button
          className={`tab-btn ${activeTab === 'fights' ? 'active' : ''}`}
          onClick={() => setActiveTab('fights')}
        >
          ⚔️ {t('moderatorPanel.officialFights')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'divisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('divisions')}
        >
          🏆 {t('moderatorPanel.divisions')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          📝 {t('moderatorPanel.managePosts')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 {t('moderatorPanel.users')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'betting' ? 'active' : ''}`}
          onClick={() => setActiveTab('betting')}
        >
          💰 {t('moderatorPanel.betting')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          📋 {t('moderatorPanel.feedback')}
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'fights' && (
          <div className="fights-section">
            <div className="create-fight-card">
              <h3>🌟 {t('moderatorPanel.createFight')}</h3>
              <form onSubmit={handleFightSubmit} className="fight-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('moderatorPanel.fightTitle')}</label>
                    <input
                      type="text"
                      value={newFight.title}
                      onChange={(e) => setNewFight({...newFight, title: e.target.value})}
                      placeholder={t('moderatorPanel.fightTitlePlaceholder')}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('moderatorPanel.category')}</label>
                    <select
                      value={newFight.category}
                      onChange={(e) => setNewFight({...newFight, category: e.target.value})}
                    >
                      <option value="Main Event">{t('moderatorPanel.mainEvent')}</option>
                      <option value="Co-Main Event">{t('moderatorPanel.coMainEvent')}</option>
                      <option value="Featured Fight">{t('moderatorPanel.featuredFight')}</option>
                      <option value="Special Event">{t('moderatorPanel.specialEvent')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>{t('moderatorPanel.character1')}</label>
                    <CharacterSelector
                      characters={characters}
                      selectedCharacter={newFight.character1}
                      onSelect={(character) => setNewFight({...newFight, character1: character})}
                    />
                  </div>
                  <div className="vs-divider">{t('moderatorPanel.vs')}</div>
                  <div className="form-group">
                    <label>{t('moderatorPanel.character2')}</label>
                    <CharacterSelector
                      characters={characters}
                      selectedCharacter={newFight.character2}
                      onSelect={(character) => setNewFight({...newFight, character2: character})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('moderatorPanel.fightDescription')}</label>
                  <textarea
                    value={newFight.description}
                    onChange={(e) => setNewFight({...newFight, description: e.target.value})}
                    placeholder={t('moderatorPanel.fightDescriptionPlaceholder')}
                    rows="4"
                    required
                  />
                </div>

                <div className="form-options">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newFight.featured}
                      onChange={(e) => setNewFight({...newFight, featured: e.target.checked})}
                    />
                    <span className="checkmark"></span>
                    {t('moderatorPanel.featureFight')}
                  </label>
                </div>

                <button type="submit" className="create-btn" disabled={loading}>
                  {loading ? `⏳ ${t('moderatorPanel.creating')}` : `🚀 ${t('moderatorPanel.createFightBtn')}`}
                </button>
              </form>
            </div>

            <div className="existing-fights">
              <h3>🎯 {t('moderatorPanel.existingFights')}</h3>
              <div className="fights-grid">
                {fights.map(fight => (
                  <div key={fight.id} className="fight-card">
                    <div className="fight-header">
                      <h4>{fight.title}</h4>
                      <div className="fight-badges">
                        <span className="badge badge-official">🛡️ {t('moderatorPanel.official')}</span>
                        {fight.featured && <span className="badge badge-featured">⭐ {t('moderatorPanel.featuredBadge')}</span>}
                        {fight.category && <span className="badge badge-category">{fight.category}</span>}
                      </div>
                    </div>
                    <div className="fight-details">
                      <div className="fighters">
                        <span className="fighter">{fight.teamA}</span>
                        <span className="vs">{t('moderatorPanel.vs')}</span>
                        <span className="fighter">{fight.teamB}</span>
                      </div>
                      <div className="fight-stats">
                        <span>👍 {fight.likes?.length || 0}</span>
                        <span>🗳️ {(fight.fight?.votes?.teamA || 0) + (fight.fight?.votes?.teamB || 0)}</span>
                        <span>💬 {fight.comments?.length || 0}</span>
                      </div>
                      <div className="fight-meta">
                        <span className="fight-date">{formatDate(fight.createdAt)}</span>
                        <span className="fight-status">{fight.fight?.status === 'active' ? `🟢 ${t('moderatorPanel.active')}` : `🔴 ${t('moderatorPanel.finished')}`}</span>
                      </div>
                    </div>
                    <div className="fight-actions">
                      <button 
                        onClick={() => handleFeaturePost(fight.id, fight.featured)}
                        className="feature-btn"
                      >
                        {fight.featured ? `⭐ ${t('moderatorPanel.removeFeature')}` : `⭐ ${t('moderatorPanel.featurePost')}`}
                      </button>
                      <button 
                        onClick={() => handleDeletePost(fight.id)}
                        className="delete-btn"
                      >
                        🗑️ {t('moderatorPanel.deletePost')}
                      </button>
                    </div>
                  </div>
                ))}
                {fights.length === 0 && (
                  <div className="no-fights">
                    <p>{t('moderatorPanel.noFights')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'divisions' && (
          <div className="divisions-section">
            <div className="divisions-moderator-header">
              <h3>🏆 {t('moderatorPanel.divisionsSystem')}</h3>
              <p>{t('moderatorPanel.divisionsManagement')}</p>
            </div>

            {/* Full DivisionsPage Categories View - with Schedule Management Overlay */}
            <div className="divisions-page-embed">
              <div className="division-categories">
                {mergedSeasons.map((season) => (
                  <div key={season.id} className="division-banner-wrapper">
                    <button
                      type="button"
                      className={`category-banner ${season.status !== 'active' ? 'locked' : ''}`}
                      style={{
                        '--banner-color': season.accentColor || season.accent || '#6c757d',
                        '--banner-image': `url("${season.bannerImage || season.image || '/site/default.jpg'}")`,
                        '--banner-pos-y': '0%'
                      }}
                      onClick={() => {
                        if (season.status === 'active') {
                          setSelectedSeasonId(season.id);
                          fetchDivisionOverview();
                        }
                      }}
                      disabled={season.status !== 'active'}
                    >
                      <div className="category-image" aria-hidden="true" />
                      <div className="category-content">
                        <div className="category-title">
                          <span className="category-name">{season.name}</span>
                        </div>
                        <p className="category-description">{season.description}</p>
                        <div className="category-meta">
                          <span className="category-season">
                            {season.status === 'active' ? '✅ Aktywny' : 
                             season.status === 'scheduled' ? '📅 Zaplanowany' : 
                             '🔒 Zablokowany'}
                          </span>
                        </div>
                      </div>
                    </button>
                    
                    {/* Schedule Management Overlay */}
                    <div className="schedule-overlay" onClick={(e) => e.stopPropagation()}>
                      {season.startAt && season.endAt ? (
                        // Display scheduled dates with option to remove
                        <>
                          <div className="scheduled-dates">
                            <div className="scheduled-date-item">
                              <span className="date-icon">📅</span>
                              <div className="date-info">
                                <span className="date-label">{t('moderatorPanel.start')}</span>
                                <span className="date-value">{new Date(season.startAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                            </div>
                            <div className="scheduled-date-item">
                              <span className="date-icon">🏁</span>
                              <div className="date-info">
                                <span className="date-label">{t('moderatorPanel.end')}</span>
                                <span className="date-value">{new Date(season.endAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                            </div>
                          </div>
                          <div className="schedule-actions">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await axios.patch(
                                    `/api/divisions/seasons/${season.id}`,
                                    {
                                      startAt: null,
                                      endAt: null,
                                      name: season.name,
                                      bannerImage: season.bannerImage,
                                      accentColor: season.accentColor,
                                      description: season.description
                                    },
                                    { headers: { 'x-auth-token': token } }
                                  );
                                  showNotification(t('moderatorPanel.scheduleRemoved'), 'success');
                                  fetchSeasons();
                                } catch (error) {
                                  console.error('Error removing schedule:', error);
                                  showNotification(t('moderatorPanel.errorSchedule'), 'error');
                                }
                              }}
                              className="schedule-btn remove"
                              title={t('moderatorPanel.removeSchedule')}
                            >
                              🗑️ {t('moderatorPanel.remove')}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartSeasonNow(season.id); }}
                              className="schedule-btn start"
                              title="Start teraz"
                            >
                              ▶️
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEndSeasonNow(season.id); }}
                              className="schedule-btn end"
                              title="Koniec teraz"
                            >
                              ⏹️
                            </button>
                          </div>
                        </>
                      ) : (
                        // Display date inputs for scheduling
                        <>
                          <div className="schedule-fields">
                            <label className="schedule-field">
                              <span className="field-label">📅 Start</span>
                              <input
                                type="datetime-local"
                                value={season.startAt ? season.startAt.slice(0, 16) : ''}
                                onChange={(e) => updateSeasonField(season.id, 'startAt', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </label>
                            <label className="schedule-field">
                              <span className="field-label">🏁 Koniec</span>
                              <input
                                type="datetime-local"
                                value={season.endAt ? season.endAt.slice(0, 16) : ''}
                                onChange={(e) => updateSeasonField(season.id, 'endAt', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </label>
                          </div>
                          <div className="schedule-actions">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleScheduleSeason(season.id); }}
                              className="schedule-btn save"
                              title="Zapisz harmonogram"
                            >
                              💾
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartSeasonNow(season.id); }}
                              className="schedule-btn start"
                              title="Start teraz"
                            >
                              ▶️
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEndSeasonNow(season.id); }}
                              className="schedule-btn end"
                              title="Koniec teraz"
                            >
                              ⏹️
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Division Detail View with Management */}
            {selectedSeasonId && (
              <div className="division-detail-view-mod">
                <div className="division-detail-header-mod">
                  <button
                    type="button"
                    className="detail-back-btn-mod"
                    onClick={() => setSelectedSeasonId(null)}
                  >
                    ← Powrót do kategorii
                  </button>
                  <div className="division-detail-info-mod">
                    <h2>{seasonConfigs.find(s => s.id === selectedSeasonId)?.name || 'Dywizja'}</h2>
                    <p>{seasonConfigs.find(s => s.id === selectedSeasonId)?.description || 'Zarządzaj dywizją'}</p>
                  </div>
                </div>

                {/* Champion Section */}
                {divisionOverview.champions[selectedSeasonId] && (
                  <div className="champion-display-mod">
                    <div className="champion-badge-mod">
                      <span className="champion-icon">👑</span>
                      <span>Aktualny Mistrz</span>
                    </div>
                    <div className="champion-info-display">
                      <div className="champion-avatar-mod">
                        <img
                          {...getOptimizedImageProps(
                            divisionOverview.champions[selectedSeasonId].profilePicture || '/placeholder-character.png',
                            { size: 80 }
                          )}
                          alt={divisionOverview.champions[selectedSeasonId].username}
                          className="champion-image-mod"
                        />
                      </div>
                      <div className="champion-details-mod">
                        <h4>{divisionOverview.champions[selectedSeasonId].username}</h4>
                        <p className="champion-title-mod">{divisionOverview.champions[selectedSeasonId].title}</p>
                        <div className="champion-stats-mod">
                          <span>Wins: {divisionOverview.champions[selectedSeasonId].stats?.wins || 0}</span>
                          <span>Rank: {divisionOverview.champions[selectedSeasonId].stats?.rank || 'Unknown'}</span>
                          <span>Points: {divisionOverview.champions[selectedSeasonId].stats?.points || 0}</span>
                        </div>
                        {divisionOverview.champions[selectedSeasonId].team && (
                          <div className="champion-team-mod">
                            <span className="team-label">Team:</span>
                            <div className="team-characters">
                              <span>{divisionOverview.champions[selectedSeasonId].team.mainCharacter?.name}</span>
                              <span className="vs-sep">vs</span>
                              <span>{divisionOverview.champions[selectedSeasonId].team.secondaryCharacter?.name}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Fights */}
                {divisionOverview.activeFights[selectedSeasonId]?.length > 0 && (
                  <div className="active-fights-display-mod">
                    <h4>🔥 Aktywne Walki</h4>
                    <div className="fights-list-mod">
                      {divisionOverview.activeFights[selectedSeasonId].map((fight) => (
                        <div key={fight._id || fight.id} className="fight-item-mod">
                          <div className="fight-participants-mod">
                            <span className="participant-name">{fight.character1?.name || 'Fighter 1'}</span>
                            <span className="vs-text-mod">vs</span>
                            <span className="participant-name">{fight.character2?.name || 'Fighter 2'}</span>
                          </div>
                          <div className="fight-meta-mod">
                            <span className="fight-type-mod">
                              {fight.fightType === 'title' ? '👑 Title Fight' :
                               fight.fightType === 'contender' ? '🥊 Contender Match' :
                               '⚔️ Official Fight'}
                            </span>
                            <span className="fight-votes-mod">🗳️ {fight.votes?.length || 0} votes</span>
                            {fight.endTime && (
                              <span className="fight-timer-mod">⏰ {new Date(fight.endTime).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Moderator Actions for Division */}
                <div className="division-management-actions">
                  <button
                    onClick={() => {
                      const challengerId = prompt('ID pretendenta do walki o tytuł:');
                      if (challengerId) handleCreateTitleFight(selectedSeasonId, challengerId);
                    }}
                    className="manage-btn title-fight-btn-mod"
                  >
                    👑 Stwórz Walkę o Tytuł
                  </button>
                  <button
                    onClick={() => {
                      const fighter1Id = prompt('ID zawodnika 1:');
                      const fighter2Id = prompt('ID zawodnika 2:');
                      if (fighter1Id && fighter2Id) {
                        handleCreateContenderMatch(selectedSeasonId, fighter1Id, fighter2Id);
                      }
                    }}
                    className="manage-btn contender-match-btn-mod"
                  >
                    🥊 Stwórz Walkę Pretendentów
                  </button>
                </div>

                {/* Division Stats */}
                <div className="division-stats-display-mod">
                  <div className="stat-box-mod">
                    <span className="stat-icon-mod">👥</span>
                    <span className="stat-label-mod">Aktywne Zespoły</span>
                    <span className="stat-value-mod">{divisionOverview.stats[selectedSeasonId]?.activeTeams || 0}</span>
                  </div>
                  <div className="stat-box-mod">
                    <span className="stat-icon-mod">⚔️</span>
                    <span className="stat-label-mod">Oficjalne Walki</span>
                    <span className="stat-value-mod">{divisionOverview.stats[selectedSeasonId]?.totalOfficialFights || 0}</span>
                  </div>
                  <div className="stat-box-mod">
                    <span className="stat-icon-mod">🗳️</span>
                    <span className="stat-label-mod">Średnie Głosy</span>
                    <span className="stat-value-mod">{divisionOverview.stats[selectedSeasonId]?.averageVotes || 0}</span>
                  </div>
                  <div className="stat-box-mod">
                    <span className="stat-icon-mod">🔥</span>
                    <span className="stat-label-mod">Aktywne Walki</span>
                    <span className="stat-value-mod">{divisionOverview.activeFights[selectedSeasonId]?.length || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="posts-section">
            <h3>📝 {t('moderatorPanel.allPostsTitle')}</h3>
            <div className="posts-list">
              {posts.map(post => (
                <div key={post.id} className="post-card">
                  <div className="post-header">
                    <div className="post-info">
                      <h4>{post.title}</h4>
                      <p className="post-meta">
                        {t('moderatorPanel.author')}: {post.author?.username || 'Nieznany'} • 
                        {formatDate(post.createdAt)} • 
                        {t('moderatorPanel.type')}: {post.type}
                      </p>
                    </div>
                    <div className="post-stats">
                      <span>👍 {post.likes?.length || 0}</span>
                      <span>💬 {post.comments?.length || 0}</span>
                    </div>
                  </div>
                  <div className="post-content">
                    <p>{post.content ? post.content.substring(0, 150) : 'Brak treści'}...</p>
                  </div>
                  <div className="post-actions">
                    <button 
                      onClick={() => handleFeaturePost(post.id, post.featured)}
                      className="feature-btn"
                    >
                      {post.featured ? `⭐ ${t('moderatorPanel.removeFeature')}` : `⭐ ${t('moderatorPanel.featurePost')}`}
                    </button>
                    <button 
                      onClick={() => handleDeletePost(post.id)}
                      className="delete-btn"
                    >
                      🗑️ {t('moderatorPanel.deletePost')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-section">
            <div className="users-header">
              <h3>👥 {t('moderatorPanel.userManagement')}</h3>
              <div className="user-search-bar">
                <input
                  type="text"
                  placeholder={`🔍 ${t('moderatorPanel.searchUser')}`}
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="user-search-input"
                />
                {userSearchQuery && (
                  <button
                    onClick={() => setUserSearchQuery('')}
                    className="clear-search-btn"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div className="users-grid">
              {users
                .filter(user => 
                  user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                  user.id.toString().includes(userSearchQuery)
                )
                .map(user => (
                <div key={user.id} className="user-card">
                  <img 
                    {...getOptimizedImageProps(placeholderImages.userSmall, { size: 60 })}
                    alt={user.username}
                    className="user-avatar"
                  />
                  <div className="user-info">
                    <h4>{user.username}</h4>
                    <p>ID: {user.id}</p>
                  </div>
                  <div className="user-actions">
                    <button 
                      onClick={() => navigate(`/profile/${user.id}`)}
                      className="view-btn"
                    >
                      👁️ {t('moderatorPanel.viewProfile')}
                    </button>
                  </div>
                </div>
              ))}
              {users.filter(user => 
                user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                user.id.toString().includes(userSearchQuery)
              ).length === 0 && (
                <div className="no-users-found">
                  <p>{t('moderatorPanel.noUsersFound')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'betting' && (
          <div className="betting-section">
            <h3>💰 {t('moderatorPanel.bettingManagement')}</h3>
            
            <div className="betting-stats">
              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-info">
                  <h4>{bets.length}</h4>
                  <p>{t('moderatorPanel.totalBets')}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-info">
                  <h4>{bets.filter(bet => bet.status === 'pending').length}</h4>
                  <p>{t('moderatorPanel.pendingBets')}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <h4>{bets.filter(bet => bet.status === 'won').length}</h4>
                  <p>{t('moderatorPanel.wonBets')}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">❌</div>
                <div className="stat-info">
                  <h4>{bets.filter(bet => bet.status === 'lost').length}</h4>
                  <p>{t('moderatorPanel.lostBets')}</p>
                </div>
              </div>
            </div>

            <div className="bets-list">
              <h4>🎲 {t('moderatorPanel.allBets')}</h4>
              {bets.length > 0 ? (
                <div className="bets-grid">
                  {bets.map(bet => (
                    <div key={bet._id} className="bet-card">
                      <div className="bet-header">
                        <div className="bet-info">
                          <h5>{bet.type === 'single' ? `🎯 ${t('moderatorPanel.singleBet')}` : `🎰 ${t('moderatorPanel.parlayBet')}`}</h5>
                          <span className={`bet-status status-${bet.status}`}>
                            {bet.status === 'pending' && `⏳ ${t('moderatorPanel.betStatus.pending')}`}
                            {bet.status === 'won' && `✅ ${t('moderatorPanel.betStatus.won')}`}
                            {bet.status === 'lost' && `❌ ${t('moderatorPanel.betStatus.lost')}`}
                            {bet.status === 'refunded' && `🔄 ${t('moderatorPanel.betStatus.refunded')}`}
                          </span>
                        </div>
                        <div className="bet-amounts">
                          <div className="bet-amount">{t('moderatorPanel.betDetails.stake')}: {formatCurrency(bet.amount)}</div>
                          <div className="potential-winnings">
                            {t('moderatorPanel.betDetails.potentialWinnings')}: {formatCurrency(bet.potentialWinnings)}
                          </div>
                        </div>
                      </div>

                      <div className="bet-details">
                        <div className="bet-user">
                          <strong>{t('moderatorPanel.betDetails.user')}:</strong> {bet.userId?.username || bet.userId}
                        </div>
                        <div className="bet-date">
                          <strong>{t('moderatorPanel.betDetails.date')}:</strong> {formatDate(bet.createdAt)}
                        </div>
                        
                        {bet.type === 'single' ? (
                          <div className="single-bet-details">
                            <div className="fight-info">
                              <strong>{t('moderatorPanel.betDetails.fight')}:</strong> {bet.fightId?.title || t('moderatorPanel.unknownFight')}
                            </div>
                            <div className="selected-team">
                              <strong>{t('moderatorPanel.betDetails.selectedTeam')}:</strong> {bet.selectedTeam}
                            </div>
                            <div className="odds">
                              <strong>{t('moderatorPanel.betDetails.odds')}:</strong> {bet.odds}
                            </div>
                          </div>
                        ) : (
                          <div className="parlay-bet-details">
                            <div className="parlay-fights">
                              <strong>{t('moderatorPanel.betDetails.parlayFights')}:</strong>
                              {bet.fights?.map((fight, index) => (
                                <div key={index} className="parlay-fight">
                                  • {fight.fightTitle} - {fight.selectedTeam} ({fight.odds})
                                </div>
                              ))}
                            </div>
                            <div className="total-odds">
                              <strong>{t('moderatorPanel.betDetails.totalOdds')}:</strong> {bet.totalOdds}
                            </div>
                          </div>
                        )}

                        {bet.insurance && (
                          <div className="insurance-info">
                            <span className="insurance-badge">🛡️ {t('moderatorPanel.betDetails.insured')}</span>
                          </div>
                        )}
                      </div>

                      {bet.status === 'pending' && (
                        <div className="bet-actions">
                          <button
                            onClick={() => handleSettleBet(bet._id, 'won')}
                            className="settle-btn win-btn"
                          >
                            ✅ {t('moderatorPanel.betActions.markWon')}
                          </button>
                          <button
                            onClick={() => handleSettleBet(bet._id, 'lost')}
                            className="settle-btn lose-btn"
                          >
                            ❌ {t('moderatorPanel.betActions.markLost')}
                          </button>
                          <button
                            onClick={() => handleRefundBet(bet._id)}
                            className="refund-btn"
                          >
                            🔄 {t('moderatorPanel.betActions.refund')}
                          </button>
                        </div>
                      )}

                      {bet.status === 'won' && bet.actualWinnings && (
                        <div className="actual-winnings">
                          <strong>{t('moderatorPanel.betDetails.actualWinnings')}:</strong> {formatCurrency(bet.actualWinnings)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-bets">
                  <p>{t('moderatorPanel.noBets')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="feedback-section">
            <div className="feedback-header">
              <h3>📋 {t('moderatorPanel.feedbackManagement')}</h3>
              <div className="feedback-filters">
                <button
                  className={`filter-btn ${feedbackFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setFeedbackFilter('all')}
                >
                  {t('moderatorPanel.filterAll')}
                </button>
                <button
                  className={`filter-btn ${feedbackFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => setFeedbackFilter('pending')}
                >
                  {t('moderatorPanel.filterPending')}
                </button>
                <button
                  className={`filter-btn ${feedbackFilter === 'reviewed' ? 'active' : ''}`}
                  onClick={() => setFeedbackFilter('reviewed')}
                >
                  {t('moderatorPanel.filterReviewed')}
                </button>
                <button
                  className={`filter-btn ${feedbackFilter === 'resolved' ? 'active' : ''}`}
                  onClick={() => setFeedbackFilter('resolved')}
                >
                  {t('moderatorPanel.filterResolved')}
                </button>
                <button
                  className={`filter-btn ${feedbackFilter === 'dismissed' ? 'active' : ''}`}
                  onClick={() => setFeedbackFilter('dismissed')}
                >
                  {t('moderatorPanel.filterDismissed')}
                </button>
              </div>
            </div>
            <div className="feedback-list">
              {feedback
                .filter(f => feedbackFilter === 'all' || f.status === feedbackFilter)
                .map(item => (
                  <div key={item.id} className={`feedback-card status-${item.status}`}>
                    <div className="feedback-card-header">
                      <div className="feedback-type-badge">
                        {t(`moderatorPanel.feedbackType.${item.type}`)}
                      </div>
                      <div className="feedback-status-badge">
                        {t(`moderatorPanel.feedbackStatus.${item.status}`)}
                      </div>
                    </div>
                    <h4 className="feedback-title">{item.title}</h4>
                    <p className="feedback-description">{item.description}</p>
                    {item.reportedUser && (
                      <div className="feedback-reported-user">
                        <strong>{t('moderatorPanel.reportedUser')}:</strong> {item.reportedUser}
                      </div>
                    )}
                    {item.type === 'character' && (
                      <div className="character-suggestion-details">
                        <h5>{t('moderatorPanel.characterDetails')}</h5>
                        <p><strong>{t('moderatorPanel.characterName')}:</strong> {item.characterName}</p>
                        <p><strong>{t('moderatorPanel.tags')}:</strong> {Array.isArray(item.characterTags) ? item.characterTags.join(', ') : item.characterTags}</p>
                        {item.characterImage && (
                          <div className="character-image-preview">
                            <img src={item.characterImage} alt={item.characterName} onError={(e) => e.target.style.display = 'none'} />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="feedback-meta">
                      <span>
                        <strong>{t('moderatorPanel.submittedBy')}:</strong> {item.submittedBy}
                      </span>
                      <span>
                        <strong>{t('moderatorPanel.submittedAt')}:</strong> {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {item.adminNotes && (
                      <div className="feedback-notes">
                        <strong>{t('moderatorPanel.adminNotes')}:</strong> {item.adminNotes}
                      </div>
                    )}
                    <div className="feedback-actions">
                      {item.status === 'pending' && (
                        <>
                          {item.type === 'character' && (
                            <button
                              onClick={() => handleApproveCharacter(item.id)}
                              className="feedback-btn approve-character-btn"
                            >
                              ✨ {t('moderatorPanel.approveCharacter')}
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateFeedback(item.id, 'reviewed')}
                            className="feedback-btn reviewed-btn"
                          >
                            👁️ {t('moderatorPanel.markAsReviewed')}
                          </button>
                          <button
                            onClick={() => handleUpdateFeedback(item.id, 'resolved')}
                            className="feedback-btn resolved-btn"
                          >
                            ✅ {t('moderatorPanel.markAsResolved')}
                          </button>
                          <button
                            onClick={() => handleUpdateFeedback(item.id, 'dismissed')}
                            className="feedback-btn dismissed-btn"
                          >
                            ❌ {t('moderatorPanel.markAsDismissed')}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteFeedback(item.id)}
                        className="feedback-btn delete-btn"
                      >
                        🗑️ {t('moderatorPanel.deleteFeedback')}
                      </button>
                    </div>
                  </div>
                ))}
              {feedback.filter(f => feedbackFilter === 'all' || f.status === feedbackFilter).length === 0 && (
                <div className="no-feedback">
                  <p>{t('moderatorPanel.noFeedback')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Post Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Potwierdzenie usunięcia"
        type="warning"
        confirmText="Usuń"
        cancelText="Anuluj"
        onConfirm={confirmDeletePost}
        confirmButtonType="danger"
      >
        <p>Czy na pewno chcesz usunąć ten post? Ta akcja nie może być cofnięta.</p>
      </Modal>

      {/* Delete Feedback Confirmation Modal */}
      <Modal
        isOpen={showDeleteFeedbackModal}
        onClose={() => {
          setShowDeleteFeedbackModal(false);
          setFeedbackToDelete(null);
        }}
        title={t('moderatorPanel.confirmDeleteFeedback')}
        type="warning"
        confirmText={t('moderatorPanel.deleteFeedback')}
        cancelText={t('moderatorPanel.cancel') || 'Anuluj'}
        onConfirm={confirmDeleteFeedback}
        confirmButtonType="danger"
      >
        <p>{t('moderatorPanel.confirmDeleteFeedbackMessage')}</p>
      </Modal>
    </div>
  );
};

export default ModeratorPanel;
