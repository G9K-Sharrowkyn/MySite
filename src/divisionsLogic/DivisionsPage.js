import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import TeamSelection from './TeamSelection';
import Modal from '../Modal/Modal';
import HoloCard from '../shared/HoloCard';
import './DivisionsPage.css';

const DivisionsPage = () => {
  const [divisions, setDivisions] = useState([]);
  const [userDivisions, setUserDivisions] = useState({});
  const [divisionStats, setDivisionStats] = useState({});
  const [divisionChampions, setDivisionChampions] = useState({});
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [divisionToLeave, setDivisionToLeave] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
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

  const fetchDivisionStats = useCallback(async () => {
    try {
      const statsPromises = divisionsData.map(division => 
        axios.get(`/api/divisions/${division.id}/stats`)
      );
      const statsResponses = await Promise.all(statsPromises);
      const stats = {};
      statsResponses.forEach((response, index) => {
        stats[divisionsData[index].id] = response.data;
      });
      setDivisionStats(stats);
    } catch (error) {
      console.error('Error fetching division stats:', error);
      setDivisionStats({});
    }
  }, [divisionsData]);

  const fetchDivisionChampions = useCallback(async () => {
    try {
      const championPromises = divisionsData.map(division => 
        axios.get(`/api/divisions/${division.id}/champion`)
      );
      const championResponses = await Promise.all(championPromises);
      const champions = {};
      championResponses.forEach((response, index) => {
        champions[divisionsData[index].id] = response.data.champion;
      });
      setDivisionChampions(champions);
    } catch (error) {
      console.error('Error fetching division champions:', error);
      setDivisionChampions({});
    }
  }, [divisionsData]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    const loadData = async () => {
      await fetchUserDivisions();
      await fetchDivisionStats();
      await fetchDivisionChampions();
      setDivisions(divisionsData);
      setLoading(false);
    };
    
    loadData();
  }, [token, navigate, divisionsData, fetchUserDivisions, fetchDivisionStats, fetchDivisionChampions]);

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
      await Promise.all([fetchUserDivisions(), fetchDivisionStats()]);
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

      await Promise.all([fetchUserDivisions(), fetchDivisionStats()]);
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

  if (loading) {
    return (
      <div className="divisions-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

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
            <li>Moderators schedule fights up to 7 days in advance</li>
            <li>Missing scheduled fights counts as a forfeit</li>
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