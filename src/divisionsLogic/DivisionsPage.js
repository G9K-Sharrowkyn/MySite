import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import TeamSelection from './TeamSelection';
import Modal from '../Modal/Modal';
import HoloCard from '../shared/HoloCard';
import ChampionshipHistory from './ChampionshipHistory';
import ContenderMatches from './ContenderMatches';
import TitleFightNotification from './TitleFightNotification';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import './DivisionsPage.css';

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

const DivisionsPage = () => {
  const [seasons, setSeasons] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [userDivisions, setUserDivisions] = useState({});
  const [overview, setOverview] = useState({
    stats: {},
    champions: {},
    titleFights: {},
    activeFights: {},
    championshipHistory: {}
  });
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [divisionToLeave, setDivisionToLeave] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);

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

  const fetchUserDivisions = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get('/api/divisions/user', {
        headers: { 'x-auth-token': token }
      });
      setUserDivisions(response.data && typeof response.data === 'object' ? response.data : {});
    } catch (error) {
      console.error('Error fetching user divisions:', error);
      setUserDivisions({});
    }
  }, [token]);

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

  const fetchCurrentUser = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get('/api/profile/me', {
        headers: { 'x-auth-token': token }
      });
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const load = async () => {
      await Promise.all([
        fetchSeasons(),
        fetchDivisions(),
        fetchDivisionOverview(),
        fetchUserDivisions(),
        fetchCurrentUser()
      ]);
    };

    load();
  }, [token, navigate, fetchSeasons, fetchDivisions, fetchDivisionOverview, fetchUserDivisions, fetchCurrentUser]);

  const selectedSeason = mergedSeasons.find((season) => season.id === selectedSeasonId) || null;
  const selectedDivisionData = divisions.find((division) => division.id === selectedSeasonId) || null;
  const divisionStats = selectedSeasonId ? overview.stats[selectedSeasonId] || {} : {};
  const divisionChampion = selectedSeasonId ? overview.champions[selectedSeasonId] : null;
  const divisionHistory = selectedSeasonId ? overview.championshipHistory[selectedSeasonId] : [];
  const divisionActiveFights = selectedSeasonId ? overview.activeFights[selectedSeasonId] || [] : [];
  const divisionTitleFights = selectedSeasonId ? overview.titleFights[selectedSeasonId] || [] : [];

  const isUserInDivision = (divisionId) => Boolean(userDivisions && userDivisions[divisionId]);
  const getUserTeamInDivision = (divisionId) => userDivisions && userDivisions[divisionId];

  const handleCategorySelect = (season) => {
    if (season.status !== 'active') return;
    const divisionFromList = divisions.find((entry) => entry.id === season.id);
    setSelectedSeasonId(season.id);
    setSelectedDivision(divisionFromList || season);
  };

  const handleJoinDivision = (division) => {
    setSelectedDivision(division);
    setShowTeamSelection(true);
  };

  const handleTeamSelected = async (team) => {
    if (!selectedDivision) return;
    try {
      await axios.post(
        '/api/divisions/join',
        {
          divisionId: selectedDivision.id,
          team: {
            mainCharacter: team.mainCharacter,
            secondaryCharacter: team.secondaryCharacter
          }
        },
        {
          headers: { 'x-auth-token': token }
        }
      );

      setSuccessMessage(t('successfullyJoinedDivision'));
      setShowSuccessModal(true);
      await Promise.all([fetchUserDivisions(), fetchDivisionOverview()]);
      setShowTeamSelection(false);
      setSelectedDivision(null);
    } catch (error) {
      console.error('Error joining division:', error);
      setErrorMessage(error.response?.data?.msg || t('errorJoiningDivision'));
      setShowErrorModal(true);
    }
  };

  const handleLeaveDivision = (divisionId) => {
    setDivisionToLeave(divisionId);
    setShowLeaveModal(true);
  };

  const confirmLeaveDivision = async () => {
    try {
      await axios.post(
        '/api/divisions/leave',
        { divisionId: divisionToLeave },
        { headers: { 'x-auth-token': token } }
      );

      await Promise.all([fetchUserDivisions(), fetchDivisionOverview()]);
      setShowLeaveModal(false);
      setDivisionToLeave(null);
    } catch (error) {
      console.error('Error leaving division:', error);
      setErrorMessage(error.response?.data?.msg || 'Error leaving division.');
      setShowErrorModal(true);
    }
  };

  if (showTeamSelection && selectedDivision) {
    return (
      <TeamSelection
        division={selectedDivision}
        onTeamSelected={handleTeamSelected}
        onCancel={() => {
          setShowTeamSelection(false);
          setSelectedDivision(null);
        }}
      />
    );
  }

  return (
    <div className="divisions-page">
      <div className="divisions-header">
        <h1>🏆 {t('divisions')}</h1>
        <p>{t('divisionsSubtitle')}</p>
      </div>

      {!selectedSeason && (
        <>
          <div className="division-categories">
            {mergedSeasons.map((season) => (
              <button
                key={season.id}
                type="button"
                className={`category-banner ${season.status !== 'active' ? 'locked' : ''}`}
                style={{
                  '--banner-color': season.accent,
                  '--banner-image': `url("${season.image}")`,
                  '--banner-position': '50% 0%',
                  '--banner-pos-y': '0%'
                }}
                onClick={() => handleCategorySelect(season)}
                disabled={season.status !== 'active'}
              >
                <div className="category-image" aria-hidden="true" />
                <div className="category-content">
                  <div className="category-title">
                    <span className="category-name">{season.name}</span>
                  </div>
                  <p className="category-description">{season.description}</p>
                  <div className="category-meta">
                    <span className="category-season">{season.status === 'active' ? t('seasonActive') : season.status === 'scheduled' ? t('seasonScheduled') : t('seasonLocked')}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selectedSeason && (
        <>
          <div className="category-header">
            <button
              type="button"
              className="category-back"
              onClick={() => setSelectedSeasonId(null)}
            >
              {t('backToCategories')}
            </button>
            <div className="category-header-info">
              <h2>{selectedSeason.name}</h2>
              <p>
                {selectedSeason.description} {t('seasonalDivisionDescription')}
              </p>
            </div>
          </div>

          {selectedDivisionData && (
            <div className="divisions-grid">
              <div
                className={`division-card ${isUserInDivision(selectedDivisionData.id) ? 'joined' : ''}`}
                style={{ '--division-color': selectedDivisionData.color || '#6c757d' }}
              >
                <div className="division-header">
                  <div className="division-icon">{selectedDivisionData.icon || '🏅'}</div>
                  <div className="division-info">
                    <h3>{selectedDivisionData.name}</h3>
                    <p className="division-description">{selectedDivisionData.description}</p>
                    {selectedDivisionData.powerLevel && (
                      <span className="power-level">Power Level: {selectedDivisionData.powerLevel}</span>
                    )}
                  </div>
                </div>

                {divisionChampion && (
                  <div className="champion-section">
                    <div className="champion-badge">
                      <span className="champion-icon">👑</span>
                      <span className="champion-title">{t('currentChampion')}</span>
                    </div>
                    <div className="champion-info">
                      <div className="champion-avatar">
                        <img
                          {...getOptimizedImageProps(
                            divisionChampion.profilePicture || '/placeholder-character.png',
                            { size: 60 }
                          )}
                          alt={divisionChampion.username}
                          className="champion-image"
                        />
                        <div className="champion-frame"></div>
                      </div>
                      <div className="champion-details">
                        <h4 className="champion-name">{divisionChampion.username}</h4>
                        <p className="champion-title-text">{divisionChampion.title}</p>
                        <div className="champion-stats">
                          <span>{t('wins')}: {divisionChampion.stats?.wins || 0}</span>
                          <span>{t('rank')}: {divisionChampion.stats?.rank || 'Unknown'}</span>
                          <span>{t('points')}: {divisionChampion.stats?.points || 0}</span>
                        </div>
                        <div className="champion-team">
                          <span className="team-label">{t('championTeam')}:</span>
                          <div className="champion-characters">
                            <span>{divisionChampion.team?.mainCharacter?.name}</span>
                            <span className="vs-separator">vs</span>
                            <span>{divisionChampion.team?.secondaryCharacter?.name}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {divisionTitleFights.length > 0 && (
                  <TitleFightNotification
                    titleFights={divisionTitleFights}
                    divisionName={selectedDivisionData.name}
                    currentUser={currentUser}
                  />
                )}

                {divisionActiveFights.length > 0 && (
                  <div className="active-fights-section">
                    <h4 className="active-fights-title">🔥 {t('activeFights') || 'Active Fights'}</h4>
                    <div className="active-fights-list">
                      {divisionActiveFights.slice(0, 3).map((fight) => (
                        <div key={fight._id || fight.id} className="active-fight-item">
                          <div className="fight-participants">
                            <span className="participant">{fight.character1?.name}</span>
                            <span className="vs-text">vs</span>
                            <span className="participant">{fight.character2?.name}</span>
                          </div>
                          <div className="fight-info">
                            <span className="fight-type">
                              {fight.fightType === 'title'
                                ? '👑 Title Fight'
                                : fight.fightType === 'contender'
                                  ? '🥊 Contender Match'
                                  : '⚔️ Official Fight'}
                            </span>
                          {fight.votesHidden || fight.fight?.votesHidden ? (
                            <span className="fight-votes hidden">{t('votesHiddenUntilEnd') || 'Votes hidden until the end'}</span>
                          ) : (
                            <span className="fight-votes">🗳️ {fight.votes?.length || 0} votes</span>
                          )}
                          </div>
                          <div className="fight-timer">⏰ {fight.endTime ? new Date(fight.endTime).toLocaleDateString() : ''}</div>
                        </div>
                      ))}
                    </div>
                    {divisionActiveFights.length > 3 && (
                      <button
                        className="view-all-fights-btn"
                        onClick={() => navigate(`/divisions/${selectedDivisionData.id}/fights`)}
                      >
                        {t('viewAllFights') || 'View All Fights'} ({divisionActiveFights.length})
                      </button>
                    )}
                  </div>
                )}

                <ChampionshipHistory
                  divisionId={selectedDivisionData.id}
                  divisionName={selectedDivisionData.name}
                  initialHistory={divisionHistory}
                />

                {isUserInDivision(selectedDivisionData.id) && (
                  <ContenderMatches divisionId={selectedDivisionData.id} currentUser={currentUser} />
                )}

                {isUserInDivision(selectedDivisionData.id) && getUserTeamInDivision(selectedDivisionData.id)?.team && (
                  <div className="user-team">
                    <h4>{t('yourTeam')}:</h4>
                    <HoloCard>
                      <div className="team-field">
                        <div className="team-images">
                          <img
                            {...getOptimizedImageProps(
                              getUserTeamInDivision(selectedDivisionData.id).team.mainCharacter.image,
                              { size: 180 }
                            )}
                            alt={getUserTeamInDivision(selectedDivisionData.id).team.mainCharacter.name}
                            className="team-image"
                            style={getUserTeamInDivision(selectedDivisionData.id).team.secondaryCharacter ? { height: '50%' } : { height: '100%' }}
                          />
                          {getUserTeamInDivision(selectedDivisionData.id).team.secondaryCharacter && (
                            <>
                              <div className="team-divider" />
                              <img
                                {...getOptimizedImageProps(
                                  getUserTeamInDivision(selectedDivisionData.id).team.secondaryCharacter.image,
                                  { size: 180 }
                                )}
                                alt={getUserTeamInDivision(selectedDivisionData.id).team.secondaryCharacter.name}
                                className="team-image"
                                style={{ height: '50%' }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </HoloCard>
                    <div className="team-stats">
                      <span>{t('wins')}: {getUserTeamInDivision(selectedDivisionData.id).wins || 0}</span>
                      <span>{t('losses')}: {getUserTeamInDivision(selectedDivisionData.id).losses || 0}</span>
                      <span>
                        {t('winRate')}: {(() => {
                          const wins = getUserTeamInDivision(selectedDivisionData.id).wins || 0;
                          const losses = getUserTeamInDivision(selectedDivisionData.id).losses || 0;
                          const total = wins + losses;
                          return total ? ((wins / total) * 100).toFixed(1) : '0.0';
                        })()}%
                      </span>
                    </div>
                  </div>
                )}

                <div className="division-actions">
                  {isUserInDivision(selectedDivisionData.id) ? (
                    <div className="joined-actions">
                      <button
                        className="change-team-btn"
                        onClick={() => handleJoinDivision(selectedDivisionData)}
                      >
                        🔄 {t('changeTeam')}
                      </button>
                      <button
                        className="leave-btn"
                        onClick={() => handleLeaveDivision(selectedDivisionData.id)}
                      >
                        🚪 {t('leaveDivision')}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="join-btn"
                      onClick={() => handleJoinDivision(selectedDivisionData)}
                    >
                      ⚔️ {t('joinDivision')}
                    </button>
                  )}
                </div>

                <div className="division-participants">
                  <span>👥 {t('activeTeams')}: {divisionStats.activeTeams || 0}</span>
                  <span style={{ marginLeft: 16 }}>🥊 {t('officialFights') || 'Official Fights'}: {divisionStats.totalOfficialFights || 0}</span>
                  <span style={{ marginLeft: 16 }}>🗳️ {t('averageVotes') || 'Avg. Votes/Fight'}: {divisionStats.averageVotes || 0}</span>
                  <span style={{ marginLeft: 16 }}>⏰ {t('activeFights') || 'Active Fights'}: {divisionActiveFights.length || 0}</span>
                </div>
              </div>
            </div>
          )}

          <div className="divisions-info">
            <div className="info-card">
              <h3>{t('divisionsHowItWorksTitle')}</h3>
              <ul>
                <li>{t('divisionsHowItWorks1')}</li>
                <li>{t('divisionsHowItWorks2')}</li>
                <li>{t('divisionsHowItWorks3')}</li>
                <li>{t('divisionsHowItWorks4')}</li>
                <li>{t('divisionsHowItWorks5')}</li>
              </ul>
            </div>

            <div className="info-card">
              <h3>{t('divisionsRulesTitle')}</h3>
              <ul>
                <li>{t('divisionsRule1')}</li>
                <li>{t('divisionsRule2')}</li>
                <li>{t('divisionsRule3')}</li>
                <li>{t('divisionsRule4')}</li>
                <li>{t('divisionsRule5')}</li>
                <li>{t('divisionsRule6')}</li>
              </ul>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title={t('warning') || 'Warning'}
        type="warning"
        confirmText={t('confirm') || 'Confirm'}
        cancelText={t('cancel') || 'Cancel'}
        onConfirm={confirmLeaveDivision}
        confirmButtonType="danger"
      >
        <p>{t('leaveDivisionConfirmText')}</p>
      </Modal>

      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={t('success') || 'Success'}
        type="success"
        confirmText={t('confirm') || 'OK'}
        onConfirm={() => setShowSuccessModal(false)}
        showCancelButton={false}
      >
        <p>{successMessage}</p>
      </Modal>

      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title={t('error') || 'Error'}
        type="error"
        confirmText={t('confirm') || 'OK'}
        onConfirm={() => setShowErrorModal(false)}
        showCancelButton={false}
      >
        <p>{errorMessage}</p>
      </Modal>
    </div>
  );
};

export default DivisionsPage;
