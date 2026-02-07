import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { placeholderImages, getOptimizedImageProps } from '../utils/placeholderImage';
import { sortDivisionSeasons } from '../utils/divisionOrder';
import CharacterSelector from '../feedLogic/CharacterSelector';
import Modal from '../Modal/Modal';
import './ModeratorPanel.css';

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

const ModeratorPanel = () => {
  const [activeTab, setActiveTab] = useState('fights');
  const [fights, setFights] = useState([]);
  const [posts, setPosts] = useState([]);
  const [deletedPosts, setDeletedPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [bets, setBets] = useState([]);
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
  const [tournaments, setTournaments] = useState([]);
  const [nicknameLogs, setNicknameLogs] = useState([]);
  const [moderationLogs, setModerationLogs] = useState([]);
  const [reportsQueue, setReportsQueue] = useState({
    counts: { pending: 0, reviewed: 0, resolved: 0, dismissed: 0, approved: 0 },
    queue: [],
    total: 0
  });
  const [showDeleteTournamentModal, setShowDeleteTournamentModal] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState(null);
  const [showRestorePostModal, setShowRestorePostModal] = useState(false);
  const [postToRestore, setPostToRestore] = useState(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [userToSuspend, setUserToSuspend] = useState(null);
  const [showUnsuspendModal, setShowUnsuspendModal] = useState(false);
  const [userToUnsuspend, setUserToUnsuspend] = useState(null);
  const [suspendType, setSuspendType] = useState('time');
  const [suspendHours, setSuspendHours] = useState(24);
  const [suspendReason, setSuspendReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [suspendConfirmText, setSuspendConfirmText] = useState('');
  const [unsuspendConfirmText, setUnsuspendConfirmText] = useState('');
  const [divisionVoteVisibility, setDivisionVoteVisibility] = useState('live');
  
  // Fight creation state
  const [newFight, setNewFight] = useState({
    title: '',
    description: '',
    character1: null,
    character2: null,
    category: 'Main Event',
    featured: false,
    voteVisibility: 'live'
  });

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const { t } = useLanguage();

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
  }, [seasonConfigs, fallbackSeasons]);

  const orderedSeasons = useMemo(() => sortDivisionSeasons(mergedSeasons), [mergedSeasons]);

  const showNotification = useCallback((message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

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
        showNotification('Brak uprawnie moderatora', 'error');
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
      const [fightsRes, postsRes, deletedPostsRes, usersRes, charactersRes, betsRes, feedbackRes, tournamentsRes, nicknameLogsRes, moderationLogsRes, reportsQueueRes] = await Promise.all([
        axios.get('/api/posts/official'),
        axios.get('/api/posts'),
        axios.get('/api/posts/deleted', {
          headers: { 'x-auth-token': token }
        }),
        axios.get('/api/moderation/users', {
          headers: { 'x-auth-token': token }
        }),
        axios.get('/api/characters'),
        axios.get('/api/betting/moderator/all', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: [] })), // Fallback if betting not available
        axios.get('/api/feedback', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: [] })), // Fallback if feedback not available
        axios.get('/api/tournaments').catch(() => ({ data: [] })), // Fallback if tournaments not available
        axios.get('/api/profile/nickname-logs', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: [] })),
        axios.get('/api/moderation/logs', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: [] })),
        axios.get('/api/moderation/reports-queue', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: { counts: {}, queue: [], total: 0 } }))
      ]);

      setFights(fightsRes.data.fights || fightsRes.data);
      setPosts(postsRes.data.posts || postsRes.data);
      setDeletedPosts(deletedPostsRes.data.posts || []);
      setUsers(usersRes.data);
      setCharacters(charactersRes.data);
      setBets(betsRes.data || []);
      setFeedback(feedbackRes.data || []);
      setTournaments(tournamentsRes.data || []);
      setNicknameLogs(nicknameLogsRes.data || []);
      setModerationLogs(moderationLogsRes.data || []);
      setReportsQueue(reportsQueueRes.data || { counts: {}, queue: [], total: 0 });
      
      // Fetch divisions data
      await Promise.all([fetchSeasons()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Bd podczas adowania danych', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchSeasons, showNotification, token]);

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
        moderatorCreated: true,
        voteVisibility: newFight.voteVisibility
      };

      await axios.post('/api/posts', fightData, {
        headers: { 'x-auth-token': token }
      });

      showNotification('Oficjalna walka zostaa utworzona!', 'success');
      setNewFight({
        title: '',
        description: '',
        character1: null,
        character2: null,
        category: 'Main Event',
        featured: false,
        voteVisibility: 'live'
      });
      
      fetchData();
    } catch (error) {
      console.error('Error creating fight:', error);
      showNotification('Bd podczas tworzenia walki', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = (postId) => {
    setPostToDelete(postId);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const confirmDeletePost = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      showNotification('Type DELETE to confirm.', 'error');
      return;
    }

    try {
      await axios.delete(`/api/posts/${postToDelete}`, {
        headers: { 'x-auth-token': token }
      });

      showNotification('Post deleted', 'success');
      fetchData();
      setShowDeleteModal(false);
      setPostToDelete(null);
      setDeleteConfirmText('');
    } catch (error) {
      console.error('Error deleting post:', error);
      showNotification('Error deleting post', 'error');
    }
  };

  const handleRestorePost = (post) => {
    setPostToRestore(post);
    setRestoreConfirmText('');
    setShowRestorePostModal(true);
  };

  const confirmRestorePost = async () => {
    if (!postToRestore?.id) return;
    if (restoreConfirmText.trim().toUpperCase() !== 'RESTORE') {
      showNotification('Type RESTORE to confirm.', 'error');
      return;
    }

    try {
      await axios.post(
        `/api/posts/${postToRestore.id}/restore`,
        {},
        { headers: { 'x-auth-token': token } }
      );
      showNotification('Post restored successfully', 'success');
      setShowRestorePostModal(false);
      setPostToRestore(null);
      setRestoreConfirmText('');
      fetchData();
    } catch (error) {
      console.error('Error restoring post:', error);
      showNotification(error.response?.data?.msg || 'Error restoring post', 'error');
    }
  };

  const handleSuspendUser = (targetUser) => {
    setUserToSuspend(targetUser);
    setSuspendType('time');
    setSuspendHours(24);
    setSuspendReason('');
    setSuspendConfirmText('');
    setShowSuspendModal(true);
  };

  const confirmSuspendUser = async () => {
    if (!userToSuspend?.id) return;
    if (!suspendReason.trim()) {
      showNotification('Suspension reason is required', 'error');
      return;
    }
    if (suspendConfirmText.trim().toUpperCase() !== 'SUSPEND') {
      showNotification('Type SUSPEND to confirm.', 'error');
      return;
    }

    try {
      await axios.post(
        `/api/moderation/users/${userToSuspend.id}/suspend`,
        {
          type: suspendType,
          reason: suspendReason.trim(),
          durationHours: suspendType === 'time' ? Number(suspendHours) : undefined
        },
        { headers: { 'x-auth-token': token } }
      );
      showNotification('User suspended', 'success');
      setShowSuspendModal(false);
      setUserToSuspend(null);
      setSuspendConfirmText('');
      fetchData();
    } catch (error) {
      console.error('Error suspending user:', error);
      showNotification(error.response?.data?.msg || 'Error suspending user', 'error');
    }
  };

  const handleUnsuspendUser = (targetUser) => {
    setUserToUnsuspend(targetUser);
    setUnsuspendConfirmText('');
    setShowUnsuspendModal(true);
  };

  const confirmUnsuspendUser = async () => {
    if (!userToUnsuspend?.id) return;
    if (unsuspendConfirmText.trim().toUpperCase() !== 'UNBAN') {
      showNotification('Type UNBAN to confirm.', 'error');
      return;
    }

    try {
      await axios.post(
        `/api/moderation/users/${userToUnsuspend.id}/unsuspend`,
        {},
        { headers: { 'x-auth-token': token } }
      );
      showNotification('User suspension removed', 'success');
      setShowUnsuspendModal(false);
      setUserToUnsuspend(null);
      setUnsuspendConfirmText('');
      fetchData();
    } catch (error) {
      console.error('Error unsuspending user:', error);
      showNotification(error.response?.data?.msg || 'Error removing suspension', 'error');
    }
  };
  const handleFeaturePost = async (postId, featured) => {
    try {
      await axios.put(`/api/posts/${postId}`, 
        { featured: !featured },
        { headers: { 'x-auth-token': token } }
      );
      
      showNotification(
        !featured ? 'Post zosta wyrniony' : 'Post przesta by wyrniony', 
        'success'
      );
      fetchData();
    } catch (error) {
      console.error('Error featuring post:', error);
      showNotification('Bd podczas zmiany statusu postu', 'error');
    }
  };

  const handleSettleBet = async (betId, result) => {
    try {
      await axios.post(`/api/betting/moderator/settle/${betId}`,
        { result },
        { headers: { 'x-auth-token': token } }
      );
      
      showNotification('Zakad zosta rozliczony', 'success');
      fetchData();
    } catch (error) {
      console.error('Error settling bet:', error);
      showNotification('Bd podczas rozliczania zakadu', 'error');
    }
  };

  const handleRefundBet = async (betId) => {
    try {
      await axios.post(`/api/betting/moderator/refund/${betId}`, {}, {
        headers: { 'x-auth-token': token }
      });
      
      showNotification('Zakad zosta zwrcony', 'success');
      fetchData();
    } catch (error) {
      console.error('Error refunding bet:', error);
      showNotification('Bd podczas zwracania zakadu', 'error');
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
    return `${amount} `;
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

  // Division Management Functions
  const handleCreateTitleFight = async (divisionId, challengerId) => {
    try {
      await axios.post(`/api/divisions/${divisionId}/title-fight`,
        { challengerId, voteVisibility: divisionVoteVisibility },
        { headers: { 'x-auth-token': token } }
      );
      
      showNotification('Walka o tytu zostaa utworzona!', 'success');
      fetchData();
    } catch (error) {
      console.error('Error creating title fight:', error);
      showNotification('Bd podczas tworzenia walki o tytu', 'error');
    }
  };

  const handleCreateContenderMatch = async (divisionId, fighter1Id, fighter2Id) => {
    try {
      await axios.post(`/api/divisions/${divisionId}/contender-match`,
        { fighter1Id, fighter2Id, voteVisibility: divisionVoteVisibility },
        { headers: { 'x-auth-token': token } }
      );
      
      showNotification('Walka pretendentw zostaa utworzona!', 'success');
      fetchData();
    } catch (error) {
      console.error('Error creating contender match:', error);
      showNotification('Bd podczas tworzenia walki pretendentw', 'error');
    }
  };

  const handleDeleteTournament = async (tournamentId) => {
    try {
      await axios.delete(`/api/tournaments/${tournamentId}`, {
        headers: { 'x-auth-token': token }
      });
      
      showNotification('Tournament deleted successfully', 'success');
      setShowDeleteTournamentModal(false);
      setTournamentToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting tournament:', error);
      showNotification(error.response?.data?.msg || 'Error deleting tournament', 'error');
    }
  };

  if (loading && fights.length === 0) {
    return (
      <div className="moderator-panel">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Loading moderator panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="moderator-panel">
      <div className="panel-header">
        <h1>Moderator Panel</h1>
        <p>Manage VersusVerseVault content and community.</p>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
          <button onClick={() => setNotification(null)}>x</button>
        </div>
      )}

      <div className="panel-tabs">
        <button
          className={`tab-btn ${activeTab === 'fights' ? 'active' : ''}`}
          onClick={() => setActiveTab('fights')}
        >Official Fights</button>
        <button
          className={`tab-btn ${activeTab === 'divisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('divisions')}
        >Divisions and Seasons</button>
        <button
          className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >Manage Posts</button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >Users</button>
        <button
          className={`tab-btn ${activeTab === 'betting' ? 'active' : ''}`}
          onClick={() => setActiveTab('betting')}
        >Betting</button>
        <button
          className={`tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >Reports</button>
        <button
          className={`tab-btn ${activeTab === 'tournaments' ? 'active' : ''}`}
          onClick={() => setActiveTab('tournaments')}
        >Tournaments</button>
        <button
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'fights' && (
          <div className="fights-section">
            <div className="create-fight-card">
              <h3> {t('moderatorPanel.createFight')}</h3>
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
                  <div className="form-group">
                    <label>{t('voteVisibility') || 'Vote visibility'}</label>
                    <select
                      value={newFight.voteVisibility}
                      onChange={(e) => setNewFight({ ...newFight, voteVisibility: e.target.value })}
                    >
                      <option value="live">{t('showLiveVotes') || 'Show live votes'}</option>
                      <option value="final">{t('hideVotesUntilEnd') || 'Hide votes until the end'}</option>
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
                  {loading ? ` ${t('moderatorPanel.creating')}` : ` ${t('moderatorPanel.createFightBtn')}`}
                </button>
              </form>
            </div>

            <div className="existing-fights">
              <h3> {t('moderatorPanel.existingFights')}</h3>
              <div className="fights-grid">
                {fights.map(fight => (
                  <div key={fight.id} className="fight-card">
                    <div className="fight-header">
                      <h4>{fight.title}</h4>
                      <div className="fight-badges">
                        <span className="badge badge-official"> {t('moderatorPanel.official')}</span>
                        {fight.featured && <span className="badge badge-featured"> {t('moderatorPanel.featuredBadge')}</span>}
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
                        <span> {fight.likes?.length || 0}</span>
                        <span> {(fight.fight?.votes?.teamA || 0) + (fight.fight?.votes?.teamB || 0)}</span>
                        <span> {fight.comments?.length || 0}</span>
                      </div>
                      <div className="fight-meta">
                        <span className="fight-date">{formatDate(fight.createdAt)}</span>
                        <span className="fight-status">{fight.fight?.status === 'active' ? ` ${t('moderatorPanel.active')}` : ` ${t('moderatorPanel.finished')}`}</span>
                      </div>
                    </div>
                    <div className="fight-actions">
                      <button 
                        onClick={() => handleFeaturePost(fight.id, fight.featured)}
                        className="feature-btn"
                      >
                        {fight.featured ? ` ${t('moderatorPanel.removeFeature')}` : ` ${t('moderatorPanel.featurePost')}`}
                      </button>
                      <button 
                        onClick={() => handleDeletePost(fight.id)}
                        className="delete-btn"
                      >
                         {t('moderatorPanel.deletePost')}
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
              <h3> {t('moderatorPanel.divisionsSystem')}</h3>
              <p>{t('moderatorPanel.divisionsManagement')}</p>
            </div>

            {/* Full DivisionsPage Categories View - with Schedule Management Overlay */}
            <div className="divisions-page-embed">
              <div className="division-categories">
                {orderedSeasons.map((season) => (
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
                            {season.status === 'active' ? ' Aktywny' : 
                             season.status === 'scheduled' ? ' Zaplanowany' : 
                             ' Zablokowany'}
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
                              <span className="date-icon"></span>
                              <div className="date-info">
                                <span className="date-label">{t('moderatorPanel.start')}</span>
                                <span className="date-value">{new Date(season.startAt).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                            </div>
                            <div className="scheduled-date-item">
                              <span className="date-icon"></span>
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
                               {t('moderatorPanel.remove')}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartSeasonNow(season.id); }}
                              className="schedule-btn start"
                              title="Start teraz"
                            >
                              
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEndSeasonNow(season.id); }}
                              className="schedule-btn end"
                              title="Koniec teraz"
                            >
                              
                            </button>
                          </div>
                        </>
                      ) : (
                        // Display date inputs for scheduling
                        <>
                          <div className="schedule-fields">
                            <label className="schedule-field">
                              <span className="field-label"> Start</span>
                              <input
                                type="datetime-local"
                                value={season.startAt ? season.startAt.slice(0, 16) : ''}
                                onChange={(e) => updateSeasonField(season.id, 'startAt', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </label>
                            <label className="schedule-field">
                              <span className="field-label"> Koniec</span>
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
                              
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartSeasonNow(season.id); }}
                              className="schedule-btn start"
                              title="Start teraz"
                            >
                              
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEndSeasonNow(season.id); }}
                              className="schedule-btn end"
                              title="Koniec teraz"
                            >
                              
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
                     Powrt do kategorii
                  </button>
                  <div className="division-detail-info-mod">
                    <h2>{seasonConfigs.find(s => s.id === selectedSeasonId)?.name || 'Dywizja'}</h2>
                    <p>{seasonConfigs.find(s => s.id === selectedSeasonId)?.description || 'Zarzdzaj dywizj'}</p>
                  </div>
                </div>

                {/* Champion Section */}
                {divisionOverview.champions[selectedSeasonId] && (
                  <div className="champion-display-mod">
                    <div className="champion-badge-mod">
                      <span className="champion-icon"></span>
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
                    <h4> Aktywne Walki</h4>
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
                              {fight.fightType === 'title' ? ' Title Fight' :
                               fight.fightType === 'contender' ? ' Contender Match' :
                               ' Official Fight'}
                            </span>
                            {fight.votesHidden || fight.fight?.votesHidden ? (
                              <span className="fight-votes-mod hidden">{t('votesHiddenUntilEnd') || 'Votes hidden until the end'}</span>
                            ) : (
                              <span className="fight-votes-mod"> {fight.votes?.length || 0} votes</span>
                            )}
                            {fight.endTime && (
                              <span className="fight-timer-mod"> {new Date(fight.endTime).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Moderator Actions for Division */}
                <div className="division-vote-visibility">
                  <label>{t('voteVisibility') || 'Vote visibility'}</label>
                  <select
                    value={divisionVoteVisibility}
                    onChange={(e) => setDivisionVoteVisibility(e.target.value)}
                  >
                    <option value="live">{t('showLiveVotes') || 'Show live votes'}</option>
                    <option value="final">{t('hideVotesUntilEnd') || 'Hide votes until the end'}</option>
                  </select>
                </div>
                <div className="division-management-actions">
                  <button
                    onClick={() => {
                      const challengerId = prompt('ID pretendenta do walki o tytu:');
                      if (challengerId) handleCreateTitleFight(selectedSeasonId, challengerId);
                    }}
                    className="manage-btn title-fight-btn-mod"
                  >
                     Stwrz Walk o Tytu
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
                     Stwrz Walk Pretendentw
                  </button>
                </div>

                {/* Division Stats */}
                <div className="division-stats-display-mod">
                  <div className="stat-box-mod">
                    <span className="stat-icon-mod"></span>
                    <span className="stat-label-mod">Aktywne Zespoy</span>
                    <span className="stat-value-mod">{divisionOverview.stats[selectedSeasonId]?.activeTeams || 0}</span>
                  </div>
                  <div className="stat-box-mod">
                    <span className="stat-icon-mod"></span>
                    <span className="stat-label-mod">Oficjalne Walki</span>
                    <span className="stat-value-mod">{divisionOverview.stats[selectedSeasonId]?.totalOfficialFights || 0}</span>
                  </div>
                  <div className="stat-box-mod">
                    <span className="stat-icon-mod"></span>
                    <span className="stat-label-mod">rednie Gosy</span>
                    <span className="stat-value-mod">{divisionOverview.stats[selectedSeasonId]?.averageVotes || 0}</span>
                  </div>
                  <div className="stat-box-mod">
                    <span className="stat-icon-mod"></span>
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
            <h3>Posts</h3>
            <div className="posts-subsection">
              <h4>Active posts</h4>
              <div className="posts-list">
                {posts.map((post) => (
                  <div key={post.id} className="post-card">
                    <div className="post-header">
                      <div className="post-info">
                        <h4>{post.title}</h4>
                        <p className="post-meta">
                          Author: {post.author?.username || 'Unknown'}  {formatDate(post.createdAt)}  Type: {post.type}
                        </p>
                      </div>
                      <div className="post-stats">
                        <span> {post.likes?.length || 0}</span>
                        <span> {post.comments?.length || 0}</span>
                      </div>
                    </div>
                    <div className="post-content">
                      <p>{post.content ? `${post.content.substring(0, 150)}...` : 'No content'}</p>
                    </div>
                    <div className="post-actions">
                      <button
                        onClick={() => handleFeaturePost(post.id, post.featured)}
                        className="feature-btn"
                      >
                        {post.featured ? 'Remove feature' : 'Feature post'}
                      </button>
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="delete-btn"
                      >
                        Delete post
                      </button>
                    </div>
                  </div>
                ))}
                {posts.length === 0 && <p className="empty-state">No active posts.</p>}
              </div>
            </div>

            <div className="posts-subsection">
              <h4>Deleted posts (Undo)</h4>
              <div className="posts-list">
                {deletedPosts.map((post) => (
                  <div key={`deleted-${post.id}`} className="post-card deleted-post-card">
                    <div className="post-header">
                      <div className="post-info">
                        <h4>{post.title}</h4>
                        <p className="post-meta">
                          Deleted: {formatDate(post?.moderation?.deleted?.deletedAt || post.updatedAt)}
                        </p>
                        {post?.moderation?.deleted?.reason && (
                          <p className="post-meta">Reason: {post.moderation.deleted.reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="post-actions">
                      <button
                        onClick={() => handleRestorePost(post)}
                        className="feature-btn"
                      >
                        Restore post
                      </button>
                    </div>
                  </div>
                ))}
                {deletedPosts.length === 0 && <p className="empty-state">No deleted posts.</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-section">
            <div className="users-header">
              <h3>User moderation</h3>
              <div className="user-search-bar">
                <input
                  type="text"
                  placeholder="Search by username or id"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="user-search-input"
                />
                {userSearchQuery && (
                  <button
                    onClick={() => setUserSearchQuery('')}
                    className="clear-search-btn"
                  >
                    
                  </button>
                )}
              </div>
            </div>

            <div className="users-grid">
              {users
                .filter((user) =>
                  (user.username || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                  String(user.id || '').includes(userSearchQuery)
                )
                .map((user) => {
                  const suspension = user.suspension;
                  const suspended = Boolean(suspension);
                  const suspensionText = suspended
                    ? suspension.type === 'time'
                      ? `Time ban until ${formatDate(suspension.until)}`
                      : 'Soft ban active'
                    : 'No active suspension';

                  return (
                    <div key={user.id} className="user-card moderation-user-card">
                      <img
                        {...getOptimizedImageProps(placeholderImages.userSmall, { size: 60 })}
                        alt={user.username}
                        className="user-avatar"
                      />
                      <div className="user-info">
                        <h4>{user.displayName || user.username}</h4>
                        <p>@{user.username}</p>
                        <p>Role: {user.role || 'user'}</p>
                        <p className={suspended ? 'suspension-active' : 'suspension-none'}>{suspensionText}</p>
                      </div>
                      <div className="user-actions moderation-user-actions">
                        <button
                          onClick={() => navigate(`/profile/${user.id}`)}
                          className="view-btn"
                        >
                          View profile
                        </button>
                        {suspended ? (
                          <button
                            onClick={() => handleUnsuspendUser(user)}
                            className="feature-btn"
                          >
                            Remove ban
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspendUser(user)}
                            className="delete-btn"
                          >
                            Suspend user
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              {users.filter((user) =>
                (user.username || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                String(user.id || '').includes(userSearchQuery)
              ).length === 0 && (
                <div className="no-users-found">
                  <p>No users found for this filter.</p>
                </div>
              )}
            </div>

            <div className="users-grid" style={{ marginTop: '18px' }}>
              <div className="user-card" style={{ width: '100%' }}>
                <div className="user-info" style={{ width: '100%' }}>
                  <h4>Nickname change log</h4>
                  {nicknameLogs.length === 0 ? (
                    <p>No nickname changes yet.</p>
                  ) : (
                    nicknameLogs.slice(0, 25).map((entry) => (
                      <p key={entry.id || `${entry.userId}-${entry.changedAt}`}>
                        <strong>{entry.nextDisplayName}</strong> (was: {entry.previousDisplayName}) - @{entry.username}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'betting' && (
          <div className="betting-section">
            <h3> {t('moderatorPanel.bettingManagement')}</h3>
            
            <div className="betting-stats">
              <div className="stat-card">
                <div className="stat-icon"></div>
                <div className="stat-info">
                  <h4>{bets.length}</h4>
                  <p>{t('moderatorPanel.totalBets')}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"></div>
                <div className="stat-info">
                  <h4>{bets.filter(bet => bet.status === 'pending').length}</h4>
                  <p>{t('moderatorPanel.pendingBets')}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"></div>
                <div className="stat-info">
                  <h4>{bets.filter(bet => bet.status === 'won').length}</h4>
                  <p>{t('moderatorPanel.wonBets')}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon"></div>
                <div className="stat-info">
                  <h4>{bets.filter(bet => bet.status === 'lost').length}</h4>
                  <p>{t('moderatorPanel.lostBets')}</p>
                </div>
              </div>
            </div>

            <div className="bets-list">
              <h4> {t('moderatorPanel.allBets')}</h4>
              {bets.length > 0 ? (
                <div className="bets-grid">
                  {bets.map(bet => (
                    <div key={bet._id} className="bet-card">
                      <div className="bet-header">
                        <div className="bet-info">
                          <h5>{bet.type === 'single' ? ` ${t('moderatorPanel.singleBet')}` : ` ${t('moderatorPanel.parlayBet')}`}</h5>
                          <span className={`bet-status status-${bet.status}`}>
                            {bet.status === 'pending' && ` ${t('moderatorPanel.betStatus.pending')}`}
                            {bet.status === 'won' && ` ${t('moderatorPanel.betStatus.won')}`}
                            {bet.status === 'lost' && ` ${t('moderatorPanel.betStatus.lost')}`}
                            {bet.status === 'refunded' && ` ${t('moderatorPanel.betStatus.refunded')}`}
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
                                   {fight.fightTitle} - {fight.selectedTeam} ({fight.odds})
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
                            <span className="insurance-badge"> {t('moderatorPanel.betDetails.insured')}</span>
                          </div>
                        )}
                      </div>

                      {bet.status === 'pending' && (
                        <div className="bet-actions">
                          <button
                            onClick={() => handleSettleBet(bet._id, 'won')}
                            className="settle-btn win-btn"
                          >
                             {t('moderatorPanel.betActions.markWon')}
                          </button>
                          <button
                            onClick={() => handleSettleBet(bet._id, 'lost')}
                            className="settle-btn lose-btn"
                          >
                             {t('moderatorPanel.betActions.markLost')}
                          </button>
                          <button
                            onClick={() => handleRefundBet(bet._id)}
                            className="refund-btn"
                          >
                             {t('moderatorPanel.betActions.refund')}
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
              <h3> {t('moderatorPanel.feedbackManagement')}</h3>
              <p>
                Pending: {reportsQueue.counts?.pending || 0} | Reviewed:{' '}
                {reportsQueue.counts?.reviewed || 0} | Resolved:{' '}
                {reportsQueue.counts?.resolved || 0}
              </p>
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
                            <p><strong>{t('moderatorPanel.imageSource')}:</strong></p>
                            <div className="image-source-display">
                              {item.characterImage.startsWith('data:') ? (
                                <span className="image-type-badge"> {t('moderatorPanel.uploadedFile')}</span>
                              ) : (
                                <span className="image-type-badge"> {t('moderatorPanel.imageUrl')}</span>
                              )}
                              {!item.characterImage.startsWith('data:') && (
                                <a href={item.characterImage} target="_blank" rel="noopener noreferrer" className="image-url-link">
                                  {item.characterImage}
                                </a>
                              )}
                            </div>
                            <img 
                              src={item.characterImage} 
                              alt={item.characterName} 
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const errorMsg = document.createElement('div');
                                errorMsg.className = 'image-load-error';
                                errorMsg.textContent = ' Failed to load image';
                                e.target.parentElement.appendChild(errorMsg);
                              }} 
                            />
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
                               {t('moderatorPanel.approveCharacter')}
                            </button>
                          )}
                          <button
                            onClick={() => handleUpdateFeedback(item.id, 'reviewed')}
                            className="feedback-btn reviewed-btn"
                          >
                             {t('moderatorPanel.markAsReviewed')}
                          </button>
                          <button
                            onClick={() => handleUpdateFeedback(item.id, 'resolved')}
                            className="feedback-btn resolved-btn"
                          >
                             {t('moderatorPanel.markAsResolved')}
                          </button>
                          <button
                            onClick={() => handleUpdateFeedback(item.id, 'dismissed')}
                            className="feedback-btn dismissed-btn"
                          >
                             {t('moderatorPanel.markAsDismissed')}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteFeedback(item.id)}
                        className="feedback-btn delete-btn"
                      >
                         {t('moderatorPanel.deleteFeedback')}
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

        {activeTab === 'tournaments' && (
          <div className="tournaments-management">
            <h2> Tournament Management</h2>
            <p className="section-description">Manage all tournaments - delete recruiting or active tournaments</p>
            
            <div className="tournaments-grid">
              {tournaments.length === 0 ? (
                <div className="no-tournaments">
                  <p>No tournaments found</p>
                </div>
              ) : (
                tournaments.map(tournament => {
                  const statusEmoji = tournament.status === 'recruiting' ? '' : 
                                     tournament.status === 'active' ? '' : '';
                  const statusClass = `status-${tournament.status}`;
                  
                  return (
                    <div key={tournament.id} className="tournament-card">
                      <div className="tournament-header">
                        <h3>{statusEmoji} {tournament.name}</h3>
                        <span className={`tournament-status ${statusClass}`}>
                          {tournament.status.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="tournament-info">
                        <p><strong>Creator:</strong> {tournament.creatorName || 'Unknown'}</p>
                        <p><strong>Participants:</strong> {tournament.participants?.length || 0} / {tournament.maxParticipants || 'N/A'}</p>
                        <p><strong>Team Size:</strong> {tournament.settings?.teamSize || 1}</p>
                        <p><strong>Created:</strong> {new Date(tournament.createdAt).toLocaleDateString()}</p>
                        
                        {tournament.settings?.allowedTiers && tournament.settings.allowedTiers.length > 0 && (
                          <div className="tournament-tiers">
                            <strong>Tiers:</strong>
                            <div className="tiers-list">
                              {tournament.settings.allowedTiers.map(tier => (
                                <span key={tier} className="tier-badge-small">{tier}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="tournament-actions">
                        <button
                          onClick={() => {
                            setTournamentToDelete(tournament);
                            setShowDeleteTournamentModal(true);
                          }}
                          className="btn-delete-tournament"
                        >
                           Delete Tournament
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="users-section">
            <div className="users-header">
              <h3>Moderation audit</h3>
            </div>
            <div className="users-grid">
              <div className="user-card" style={{ width: '100%' }}>
                <div className="user-info" style={{ width: '100%' }}>
                  <h4>Recent moderator/admin actions</h4>
                  {moderationLogs.length === 0 ? (
                    <p>No actions logged yet.</p>
                  ) : (
                    moderationLogs.slice(0, 120).map((entry) => (
                      <p key={entry.id || `${entry.actorId}-${entry.createdAt}`}>
                        <strong>{entry.action}</strong> by @{entry.actorUsername} on {entry.targetType}:{' '}
                        {entry.targetId || '-'} ({new Date(entry.createdAt).toLocaleString()})
                      </p>
                    ))
                  )}
                </div>
              </div>
              <div className="user-card" style={{ width: '100%' }}>
                <div className="user-info" style={{ width: '100%' }}>
                  <h4>Reports queue (pending + reviewed)</h4>
                  <p>
                    Pending: {reportsQueue.counts?.pending || 0} | Reviewed:{' '}
                    {reportsQueue.counts?.reviewed || 0} | Resolved:{' '}
                    {reportsQueue.counts?.resolved || 0}
                  </p>
                  {reportsQueue.queue?.length ? (
                    reportsQueue.queue.slice(0, 50).map((entry) => (
                      <p key={entry.id}>
                        <strong>{entry.status}</strong> [{entry.type}] {entry.title}
                      </p>
                    ))
                  ) : (
                    <p>No open reports in queue.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Post Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setPostToDelete(null);
          setDeleteConfirmText('');
        }}
        title="Delete post"
        type="warning"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeletePost}
        confirmButtonType="danger"
      >
        <p>This is a soft-delete action. You can restore this post later.</p>
        <p>Type <strong>DELETE</strong> to confirm:</p>
        <input
          type="text"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          className="moderation-confirm-input"
          placeholder="DELETE"
        />
      </Modal>

      {/* Restore Post Confirmation Modal */}
      <Modal
        isOpen={showRestorePostModal}
        onClose={() => {
          setShowRestorePostModal(false);
          setPostToRestore(null);
          setRestoreConfirmText('');
        }}
        title="Restore post"
        type="info"
        confirmText="Restore"
        cancelText="Cancel"
        onConfirm={confirmRestorePost}
      >
        <p>Restore <strong>{postToRestore?.title || 'this post'}</strong>?</p>
        <p>Type <strong>RESTORE</strong> to confirm:</p>
        <input
          type="text"
          value={restoreConfirmText}
          onChange={(e) => setRestoreConfirmText(e.target.value)}
          className="moderation-confirm-input"
          placeholder="RESTORE"
        />
      </Modal>

      {/* Suspend User Confirmation Modal */}
      <Modal
        isOpen={showSuspendModal}
        onClose={() => {
          setShowSuspendModal(false);
          setUserToSuspend(null);
          setSuspendConfirmText('');
        }}
        title="Suspend user"
        type="warning"
        confirmText="Suspend"
        cancelText="Cancel"
        onConfirm={confirmSuspendUser}
        confirmButtonType="danger"
      >
        <p>User: <strong>{userToSuspend?.displayName || userToSuspend?.username}</strong></p>

        <label className="moderation-field-label" htmlFor="suspend-type">Suspension type</label>
        <select
          id="suspend-type"
          value={suspendType}
          onChange={(e) => setSuspendType(e.target.value)}
          className="moderation-confirm-input"
        >
          <option value="time">Time ban</option>
          <option value="soft">Soft ban</option>
        </select>

        {suspendType === 'time' && (
          <>
            <label className="moderation-field-label" htmlFor="suspend-hours">Duration (hours)</label>
            <input
              id="suspend-hours"
              type="number"
              min="1"
              value={suspendHours}
              onChange={(e) => setSuspendHours(e.target.value)}
              className="moderation-confirm-input"
              placeholder="24"
            />
          </>
        )}

        <label className="moderation-field-label" htmlFor="suspend-reason">Reason</label>
        <input
          id="suspend-reason"
          type="text"
          value={suspendReason}
          onChange={(e) => setSuspendReason(e.target.value)}
          className="moderation-confirm-input"
          placeholder="Explain why this action is needed"
        />

        <p>Type <strong>SUSPEND</strong> to confirm:</p>
        <input
          type="text"
          value={suspendConfirmText}
          onChange={(e) => setSuspendConfirmText(e.target.value)}
          className="moderation-confirm-input"
          placeholder="SUSPEND"
        />
      </Modal>

      {/* Unsuspend User Confirmation Modal */}
      <Modal
        isOpen={showUnsuspendModal}
        onClose={() => {
          setShowUnsuspendModal(false);
          setUserToUnsuspend(null);
          setUnsuspendConfirmText('');
        }}
        title="Remove suspension"
        type="info"
        confirmText="Unban"
        cancelText="Cancel"
        onConfirm={confirmUnsuspendUser}
      >
        <p>Remove suspension for <strong>{userToUnsuspend?.displayName || userToUnsuspend?.username}</strong>?</p>
        <p>Type <strong>UNBAN</strong> to confirm:</p>
        <input
          type="text"
          value={unsuspendConfirmText}
          onChange={(e) => setUnsuspendConfirmText(e.target.value)}
          className="moderation-confirm-input"
          placeholder="UNBAN"
        />
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

      {/* Delete Tournament Confirmation Modal */}
      <Modal
        isOpen={showDeleteTournamentModal}
        onClose={() => {
          setShowDeleteTournamentModal(false);
          setTournamentToDelete(null);
        }}
        title="Confirm Tournament Deletion"
        type="warning"
        confirmText="Delete Tournament"
        cancelText="Cancel"
        onConfirm={() => handleDeleteTournament(tournamentToDelete?.id)}
        confirmButtonType="danger"
      >
        <p>Are you sure you want to delete tournament <strong>"{tournamentToDelete?.name}"</strong>?</p>
        <p>This action cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default ModeratorPanel;



