import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import { sortDivisionSeasons } from '../utils/divisionOrder';
import './AdminDivisionsPage.css';

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

const AdminDivisionsPage = () => {
  const [seasons, setSeasons] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [overview, setOverview] = useState({
    stats: {},
    champions: {},
    titleFights: {},
    activeFights: {},
    championshipHistory: {}
  });
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [notification, setNotification] = useState(null);

  const { t } = useLanguage();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

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

  const mergedSeasons = useMemo(() => {
    if (seasons.length === 0) {
      return fallbackSeasons.map((season) => ({ ...season, status: 'locked' }));
    }

    const fallbackMap = new Map(fallbackSeasons.map((item) => [item.id, item]));
    return seasons.map((season) => {
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
        image: season.bannerImage || fallback.image,
        accent: season.accentColor || fallback.accent || '#6c757d'
      };
    });
  }, [seasons, fallbackSeasons]);

  const orderedSeasons = useMemo(() => sortDivisionSeasons(mergedSeasons), [mergedSeasons]);

  const showNotification = useCallback((message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const fetchSeasons = useCallback(async () => {
    try {
      const response = await axios.get('/api/divisions/seasons');
      setSeasons(response.data || []);
    } catch (error) {
      console.error('Error fetching seasons:', error);
      setSeasons([]);
    }
  }, []);

  const fetchDivisions = useCallback(async () => {
    try {
      const response = await axios.get('/api/divisions');
      setDivisions(response.data || []);
    } catch (error) {
      console.error('Error fetching divisions:', error);
      setDivisions([]);
    }
  }, []);

  const fetchDivisionOverview = useCallback(async () => {
    try {
      const response = await axios.get('/api/divisions/overview');
      setOverview({
        stats: response.data.stats || {},
        champions: response.data.champions || {},
        titleFights: response.data.titleFights || {},
        activeFights: response.data.activeFights || {},
        championshipHistory: response.data.championshipHistory || {}
      });
    } catch (error) {
      console.error('Error fetching division overview:', error);
      setOverview({ stats: {}, champions: {}, titleFights: {}, activeFights: {}, championshipHistory: {} });
    }
  }, []);

  const checkAdminAccess = useCallback(async () => {
    try {
      const response = await axios.get('/api/profile/me', {
        headers: { 'x-auth-token': token }
      });
      
      if (response.data.role !== 'moderator' && response.data.role !== 'admin') {
        showNotification('Brak uprawnień administratora', 'error');
        navigate('/');
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/login');
    }
  }, [navigate, showNotification, token]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const load = async () => {
      await checkAdminAccess();
      await Promise.all([
        fetchSeasons(),
        fetchDivisions(),
        fetchDivisionOverview()
      ]);
    };

    load();
  }, [token, navigate, fetchSeasons, fetchDivisions, fetchDivisionOverview, checkAdminAccess]);

  const selectedSeason = mergedSeasons.find((season) => season.id === selectedSeasonId) || null;
  const selectedDivisionData = divisions.find((division) => division.id === selectedSeasonId) || null;
  const divisionStats = selectedSeasonId ? overview.stats[selectedSeasonId] || {} : {};
  const divisionChampion = selectedSeasonId ? overview.champions[selectedSeasonId] : null;
  const divisionActiveFights = selectedSeasonId ? overview.activeFights[selectedSeasonId] || [] : [];

  const handleCategorySelect = (season) => {
    setSelectedSeasonId(season.id);
  };

  const handleCreateTitleFight = async (divisionId) => {
    const challengerId = prompt('ID pretendenta do walki o tytuł:');
    if (!challengerId) return;
    const voteVisibility = prompt('Vote visibility (live/final):', 'live') || 'live';

    try {
      await axios.post(
        '/api/divisions/moderator/create-title-fight',
        { divisionId, challengerId, voteVisibility },
        { headers: { 'x-auth-token': token } }
      );
      showNotification('Walka o tytuł została stworzona', 'success');
      await fetchDivisionOverview();
    } catch (error) {
      console.error('Error creating title fight:', error);
      showNotification(error.response?.data?.msg || 'Błąd podczas tworzenia walki', 'error');
    }
  };

  const handleCreateContenderMatch = async (divisionId) => {
    const fighter1Id = prompt('ID zawodnika 1:');
    const fighter2Id = prompt('ID zawodnika 2:');
    if (!fighter1Id || !fighter2Id) return;
    const voteVisibility = prompt('Vote visibility (live/final):', 'live') || 'live';

    try {
      await axios.post(
        '/api/divisions/moderator/create-contender-match',
        { divisionId, fighter1Id, fighter2Id, voteVisibility },
        { headers: { 'x-auth-token': token } }
      );
      showNotification('Walka pretendentów została stworzona', 'success');
      await fetchDivisionOverview();
    } catch (error) {
      console.error('Error creating contender match:', error);
      showNotification(error.response?.data?.msg || 'Błąd podczas tworzenia walki', 'error');
    }
  };

  const handleLockExpiredFights = async () => {
    try {
      await axios.post(
        '/api/divisions/moderator/lock-expired',
        {},
        { headers: { 'x-auth-token': token } }
      );
      showNotification('Wygasłe walki zostały zablokowane', 'success');
      await fetchDivisionOverview();
    } catch (error) {
      console.error('Error locking expired fights:', error);
      showNotification('Błąd podczas blokowania walk', 'error');
    }
  };

  return (
    <div className="admin-divisions-page">
      <div className="admin-divisions-header">
        <h1>🛡️ Zarządzanie Dywizjami</h1>
        <p>Panel administratora dla systemu dywizji</p>
        <button onClick={handleLockExpiredFights} className="lock-expired-btn">
          🔒 Zablokuj wygasłe walki
        </button>
      </div>

      {notification && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {!selectedSeason && (
        <>
          <div className="admin-division-categories">
            {orderedSeasons.map((season) => (
              <button
                key={season.id}
                type="button"
                className={`admin-category-banner ${season.status !== 'active' ? 'locked' : ''}`}
                style={{
                  '--banner-color': season.accent,
                  '--banner-image': `url("${season.image}")`,
                  '--banner-position': '50% 0%',
                  '--banner-pos-y': '0%'
                }}
                onClick={() => handleCategorySelect(season)}
              >
                <div className="admin-category-image" aria-hidden="true" />
                <div className="admin-category-content">
                  <div className="admin-category-title">
                    <span className="admin-category-name">{season.name}</span>
                    <span className="admin-category-status">{season.status === 'active' ? '✅ Aktywny' : season.status === 'scheduled' ? '📅 Zaplanowany' : '🔒 Zablokowany'}</span>
                  </div>
                  <p className="admin-category-description">{season.description}</p>
                  <div className="admin-category-actions">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateTitleFight(season.id);
                      }}
                      className="admin-action-btn title-fight"
                    >
                      👑 Walka o Tytuł
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateContenderMatch(season.id);
                      }}
                      className="admin-action-btn contender-match"
                    >
                      🥊 Walka Pretendentów
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selectedSeason && (
        <>
          <div className="admin-category-header">
            <button
              type="button"
              className="admin-category-back"
              onClick={() => setSelectedSeasonId(null)}
            >
              ← Powrót do kategorii
            </button>
            <div className="admin-category-header-info">
              <h2>{selectedSeason.name}</h2>
              <p>{selectedSeason.description}</p>
            </div>
          </div>

          {selectedDivisionData && (
            <div className="admin-division-detail">
              <div className="admin-division-card">
                <div className="admin-division-header">
                  <div className="admin-division-icon">{selectedDivisionData.icon || '🏅'}</div>
                  <div className="admin-division-info">
                    <h3>{selectedDivisionData.name}</h3>
                    <p>{selectedDivisionData.description}</p>
                  </div>
                </div>

                {divisionChampion && (
                  <div className="admin-champion-section">
                    <div className="admin-champion-badge">
                      <span className="admin-champion-icon">👑</span>
                      <span className="admin-champion-title">Aktualny Mistrz</span>
                    </div>
                    <div className="admin-champion-info">
                      <div className="admin-champion-avatar">
                        <img
                          {...getOptimizedImageProps(
                            divisionChampion.profilePicture || '/placeholder-character.png',
                            { size: 60 }
                          )}
                          alt={divisionChampion.username}
                          className="admin-champion-image"
                        />
                      </div>
                      <div className="admin-champion-details">
                        <h4 className="admin-champion-name">{divisionChampion.username}</h4>
                        <p className="admin-champion-title-text">{divisionChampion.title}</p>
                        <div className="admin-champion-stats">
                          <span>Wins: {divisionChampion.stats?.wins || 0}</span>
                          <span>Rank: {divisionChampion.stats?.rank || 'Unknown'}</span>
                          <span>Points: {divisionChampion.stats?.points || 0}</span>
                        </div>
                        <div className="admin-champion-team">
                          <span className="admin-team-label">Team:</span>
                          <div className="admin-champion-characters">
                            <span>{divisionChampion.team?.mainCharacter?.name}</span>
                            <span className="admin-vs-separator">vs</span>
                            <span>{divisionChampion.team?.secondaryCharacter?.name}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {divisionActiveFights.length > 0 && (
                  <div className="admin-active-fights-section">
                    <h4 className="admin-active-fights-title">🔥 Aktywne Walki</h4>
                    <div className="admin-active-fights-list">
                      {divisionActiveFights.slice(0, 5).map((fight) => (
                        <div key={fight._id || fight.id} className="admin-active-fight-item">
                          <div className="admin-fight-participants">
                            <span className="admin-participant">{fight.character1?.name}</span>
                            <span className="admin-vs-text">vs</span>
                            <span className="admin-participant">{fight.character2?.name}</span>
                          </div>
                          <div className="admin-fight-info">
                            <span className="admin-fight-type">
                              {fight.fightType === 'title'
                                ? '👑 Title Fight'
                                : fight.fightType === 'contender'
                                  ? '🥊 Contender Match'
                                  : '⚔️ Official Fight'}
                            </span>
                            {fight.votesHidden || fight.fight?.votesHidden ? (
                              <span className="admin-fight-votes hidden">Votes hidden until the end</span>
                            ) : (
                              <span className="admin-fight-votes">🗳️ {fight.votes?.length || 0} votes</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="admin-division-actions">
                  <button
                    onClick={() => handleCreateTitleFight(selectedDivisionData.id)}
                    className="admin-action-btn-large title-fight"
                  >
                    👑 Stwórz Walkę o Tytuł
                  </button>
                  <button
                    onClick={() => handleCreateContenderMatch(selectedDivisionData.id)}
                    className="admin-action-btn-large contender-match"
                  >
                    🥊 Stwórz Walkę Pretendentów
                  </button>
                </div>

                <div className="admin-division-stats">
                  <div className="stat-item">
                    <span className="stat-icon">👥</span>
                    <span className="stat-label">Aktywne Zespoły</span>
                    <span className="stat-value">{divisionStats.activeTeams || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">⚔️</span>
                    <span className="stat-label">Oficjalne Walki</span>
                    <span className="stat-value">{divisionStats.totalOfficialFights || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">🗳️</span>
                    <span className="stat-label">Średnie Głosy</span>
                    <span className="stat-value">{divisionStats.averageVotes || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-icon">🔥</span>
                    <span className="stat-label">Aktywne Walki</span>
                    <span className="stat-value">{divisionActiveFights.length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminDivisionsPage;
