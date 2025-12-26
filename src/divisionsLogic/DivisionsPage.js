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
import './DivisionsPage.css';

const DivisionsPage = () => {
  const [divisions, setDivisions] = useState([]);
  const [userDivisions, setUserDivisions] = useState({});
  const [divisionStats, setDivisionStats] = useState({});
  const [divisionChampions, setDivisionChampions] = useState({});
  const [divisionHistory, setDivisionHistory] = useState({});
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [divisionToLeave, setDivisionToLeave] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [titleFights, setTitleFights] = useState({});
  const [activeFights, setActiveFights] = useState({});
  
  const { t } = useLanguage();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const divisionsData = useMemo(() => [
    {
      id: 'regular',
      name: t('regularPeople'),
      description: 'Characters with normal human abilities',
      icon: '👤',
      color: '#6c757d',
      powerLevel: '1-10'
    },
    {
      id: 'metahuman',
      name: t('metahuman'),
      description: 'Enhanced humans with special abilities',
      icon: '🦸',
      color: '#28a745',
      powerLevel: '11-50'
    },
    {
      id: 'planetBusters',
      name: t('planetBusters'),
      description: 'Beings capable of destroying planets',
      icon: '🌍',
      color: '#fd7e14',
      powerLevel: '51-100'
    },
    {
      id: 'godTier',
      name: t('godTier'),
      description: 'God-like beings with immense power',
      icon: '⚡',
      color: '#6f42c1',
      powerLevel: '101-500'
    },
    {
      id: 'universalThreat',
      name: t('universalThreat'),
      description: 'Threats to entire universes',
      icon: '🌌',
      color: '#dc3545',
      powerLevel: '501-1000'
    },
    {
      id: 'omnipotent',
      name: t('omnipotent'),
      description: 'All-powerful beings beyond comprehension',
      icon: '✨',
      color: '#ffd700',
      powerLevel: '1000+'
    }
  ], [t]);

  const fetchUserDivisions = useCallback(async () => {
    try {
      const response = await axios.get('/api/divisions/user', {
        headers: { 'x-auth-token': token }
      });
      // Ensure response.data is always an object
      const userDivs = response.data && typeof response.data === 'object' ? response.data : {};
      setUserDivisions(userDivs);
    } catch (error) {
      console.error('Error fetching user divisions:', error);
      setUserDivisions({});
    }
  }, [token]);

  const fetchDivisionOverview = useCallback(async () => {
    try {
      const response = await axios.get('/api/divisions/overview');
      setDivisionStats(response.data.stats || {});
      setDivisionChampions(response.data.champions || {});
      setTitleFights(response.data.titleFights || {});
      setActiveFights(response.data.activeFights || {});
      setDivisionHistory(response.data.championshipHistory || {});
    } catch (error) {
      console.error('Error fetching division overview:', error);
      setDivisionStats({});
      setDivisionChampions({});
      setTitleFights({});
      setActiveFights({});
      setDivisionHistory({});
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
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

    setDivisions(divisionsData);
    
    const loadData = async () => {
      await Promise.all([
        fetchCurrentUser(),
        fetchUserDivisions(),
        fetchDivisionOverview()
      ]);
    };
    
    loadData();
  }, [token, navigate, divisionsData, fetchCurrentUser, fetchUserDivisions, fetchDivisionOverview]);

  const handleJoinDivision = (division) => {
    setSelectedDivision(division);
    setShowTeamSelection(true);
  };

  const handleTeamSelected = async (team) => {
    console.log('🎯 Division join process started');
    console.log('Selected division:', selectedDivision);
    console.log('Selected team:', team);
    console.log('Token:', token ? 'Present' : 'Missing');
    
    try {
      const requestData = {
        divisionId: selectedDivision.id,
        team: {
          mainCharacter: team.mainCharacter,
          secondaryCharacter: team.secondaryCharacter
        }
      };
      
      console.log('📤 Sending request to /api/divisions/join with data:', requestData);
      
      const response = await axios.post('/api/divisions/join', requestData, {
        headers: { 'x-auth-token': token }
      });
      
      console.log('✅ Division join successful:', response.data);
      setSuccessMessage(t('successfullyJoinedDivision'));
      setShowSuccessModal(true);

      // Refresh user divisions and stats
      console.log('🔄 Refreshing user divisions and stats...');
      await Promise.all([fetchUserDivisions(), fetchDivisionOverview()]);
      setShowTeamSelection(false);
      setSelectedDivision(null);
      console.log('✅ Division join process completed');
    } catch (error) {
      console.error('❌ Error joining division:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);
      setErrorMessage(error.response?.data?.message || t('errorJoiningDivision'));
      setShowErrorModal(true);
    }
  };

  const handleLeaveDivision = (divisionId) => {
    setDivisionToLeave(divisionId);
    setShowLeaveModal(true);
  };

  const confirmLeaveDivision = async () => {
    try {
      await axios.post('/api/divisions/leave', {
        divisionId: divisionToLeave
      }, {
        headers: { 'x-auth-token': token }
      });

      await Promise.all([fetchUserDivisions(), fetchDivisionOverview()]);
      setShowLeaveModal(false);
      setDivisionToLeave(null);
    } catch (error) {
      console.error('Error leaving division:', error);
      alert(error.response?.data?.message || 'Error leaving division. Please try again.');
    }
  };

  const isUserInDivision = (divisionId) => {
    return userDivisions && userDivisions[divisionId];
  };

  const getUserTeamInDivision = (divisionId) => {
    return userDivisions && userDivisions[divisionId];
  };

  if (showTeamSelection) {
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
        <p>Choose your division and select your team for official ranked battles</p>
      </div>

      <div className="divisions-grid">
        {divisions.map(division => {
          const userTeam = getUserTeamInDivision(division.id);
          const isJoined = isUserInDivision(division.id);

          return (
            <div 
              key={division.id} 
              className={`division-card ${isJoined ? 'joined' : ''}`}
              style={{ '--division-color': division.color }}
            >
              <div className="division-header">
                <div className="division-icon">{division.icon}</div>
                <div className="division-info">
                  <h3>{division.name}</h3>
                  <p className="division-description">{division.description}</p>
                  <span className="power-level">Power Level: {division.powerLevel}</span>
                </div>
              </div>

              {/* Champion Display */}
              {divisionChampions[division.id] && (
                <div className="champion-section">
                  <div className="champion-badge">
                    <span className="champion-icon">👑</span>
                    <span className="champion-title">{t('currentChampion')}</span>
                  </div>
                  <div className="champion-info">
                    <div className="champion-avatar">
                      <img 
                        src={divisionChampions[division.id].profilePicture || '/placeholder-character.png'} 
                        alt={divisionChampions[division.id].username}
                        className="champion-image"
                      />
                      <div className="champion-frame"></div>
                    </div>
                    <div className="champion-details">
                      <h4 className="champion-name">{divisionChampions[division.id].username}</h4>
                      <p className="champion-title-text">{divisionChampions[division.id].title}</p>
                      <div className="champion-stats">
                        <span>{t('wins')}: {divisionChampions[division.id].stats?.wins || 0}</span>
                        <span>{t('rank')}: {divisionChampions[division.id].stats?.rank || 'Unknown'}</span>
                        <span>{t('points')}: {divisionChampions[division.id].stats?.points || 0}</span>
                      </div>
                      <div className="champion-team">
                        <span className="team-label">{t('championTeam')}:</span>
                        <div className="champion-characters">
                          <span>{divisionChampions[division.id].team?.mainCharacter?.name}</span>
                          <span className="vs-separator">vs</span>
                          <span>{divisionChampions[division.id].team?.secondaryCharacter?.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Title Fight Notification */}
              {titleFights[division.id] && titleFights[division.id].length > 0 && (
                <TitleFightNotification
                  titleFights={titleFights[division.id]}
                  divisionName={division.name}
                  currentUser={currentUser}
                />
              )}

              {/* Active Fights Display */}
              {activeFights[division.id] && activeFights[division.id].length > 0 && (
                <div className="active-fights-section">
                  <h4 className="active-fights-title">🔥 {t('activeFights') || 'Active Fights'}</h4>
                  <div className="active-fights-list">
                    {activeFights[division.id].slice(0, 3).map(fight => (
                      <div key={fight._id} className="active-fight-item">
                        <div className="fight-participants">
                          <span className="participant">{fight.character1?.name}</span>
                          <span className="vs-text">vs</span>
                          <span className="participant">{fight.character2?.name}</span>
                        </div>
                        <div className="fight-info">
                          <span className="fight-type">
                            {fight.fightType === 'title' ? '👑 Title Fight' :
                             fight.fightType === 'contender' ? '🥊 Contender Match' :
                             '⚔️ Official Fight'}
                          </span>
                          <span className="fight-votes">🗳️ {fight.votes?.length || 0} votes</span>
                        </div>
                        <div className="fight-timer">
                          ⏰ {new Date(fight.endTime).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  {activeFights[division.id].length > 3 && (
                    <button
                      className="view-all-fights-btn"
                      onClick={() => navigate(`/divisions/${division.id}/fights`)}
                    >
                      {t('viewAllFights') || 'View All Fights'} ({activeFights[division.id].length})
                    </button>
                  )}
                </div>
              )}

              {/* Championship History */}
              <ChampionshipHistory
                divisionId={division.id}
                divisionName={division.name}
                initialHistory={divisionHistory[division.id]}
              />

              {/* Contender Matches */}
              {isJoined && (
                <ContenderMatches
                  divisionId={division.id}
                  currentUser={currentUser}
                />
              )}

              {isJoined && userTeam?.team ? (
                <div className="user-team">
                  <h4>{t('yourTeam')}:</h4>
                  <HoloCard>
                    <div className="team-field">
                      <div className="team-images">
                        <img 
                          src={userTeam.team.mainCharacter.image} 
                          alt={userTeam.team.mainCharacter.name}
                          className="team-image"
                          style={userTeam.team.secondaryCharacter ? {height: '50%'} : {height: '100%'}}
                        />
                        {userTeam.team.secondaryCharacter && (
                          <>
                            <div className="team-divider" />
                            <img 
                              src={userTeam.team.secondaryCharacter.image} 
                              alt={userTeam.team.secondaryCharacter.name}
                              className="team-image"
                              style={{height: '50%'}}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </HoloCard>
                  <div className="team-stats">
                    <span>{t('wins')}: {userTeam.wins || 0}</span>
                    <span>{t('losses')}: {userTeam.losses || 0}</span>
                    <span>{t('winRate')}: {((userTeam.wins || 0) / ((userTeam.wins || 0) + (userTeam.losses || 0)) * 100 || 0).toFixed(1)}%</span>
                  </div>
                </div>
              ) : null}

              <div className="division-actions">
                {isJoined ? (
                  <div className="joined-actions">
                    <button 
                      className="change-team-btn"
                      onClick={() => handleJoinDivision(division)}
                    >
                      🔄 {t('changeTeam')}
                    </button>
                    <button 
                      className="leave-btn"
                      onClick={() => handleLeaveDivision(division.id)}
                    >
                      🚪 {t('leaveDivision')}
                    </button>
                  </div>
                ) : (
                  <button 
                    className="join-btn"
                    onClick={() => handleJoinDivision(division)}
                  >
                    ⚔️ {t('joinDivision')}
                  </button>
                )}
              </div>

              <div className="division-participants">
                <span>👥 {t('activeTeams')}: {divisionStats[division.id]?.activeTeams || 0}</span>
                <span style={{ marginLeft: 16 }}>🥊 {t('officialFights') || 'Official Fights'}: {divisionStats[division.id]?.totalOfficialFights || 0}</span>
                <span style={{ marginLeft: 16 }}>🗳️ {t('averageVotes') || 'Avg. Votes/Fight'}: {divisionStats[division.id]?.averageVotes || 0}</span>
                <span style={{ marginLeft: 16 }}>⏰ {t('activeFights') || 'Active Fights'}: {activeFights[division.id]?.length || 0}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="divisions-info">
        <div className="info-card">
          <h3>🎯 How It Works</h3>
          <ul>
            <li>Join one or more divisions based on character power levels</li>
            <li>Select 2 characters for your team in each division</li>
            <li>Once selected, your characters are locked until you change your team</li>
            <li>Moderators create official ranked fights from active teams</li>
            <li>Win official fights to climb the rankings and earn prestige</li>
          </ul>
        </div>

        <div className="info-card">
          <h3>⚡ Division Rules</h3>
          <ul>
            <li>Each character can only be used by one player per division</li>
            <li>Official fights affect your overall ranking and stats</li>
            <li>You can change your team, but it will reset your division record</li>
            <li>Official fights have a 72-hour voting period with automatic closure</li>
            <li>Title fights are created by moderators for championship contention</li>
            <li>Contender matches determine who gets the next title shot</li>
          </ul>
        </div>
      </div>

      {/* Leave Division Confirmation Modal */}
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
        <p>Are you sure you want to leave this division? This action cannot be undone.</p>
      </Modal>

      {/* Success Modal */}
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

      {/* Error Modal */}
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
