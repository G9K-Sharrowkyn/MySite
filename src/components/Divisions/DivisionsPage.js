import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import TeamSelection from './TeamSelection';
import './DivisionsPage.css';

const DivisionsPage = () => {
  const [divisions, setDivisions] = useState([]);
  const [userDivisions, setUserDivisions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  
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
      // Ensure response.data is always an array
      const userDivs = Array.isArray(response.data) ? response.data : [];
      setUserDivisions(userDivs);
    } catch (error) {
      console.error('Error fetching user divisions:', error);
      setUserDivisions([]);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    const loadData = async () => {
      await fetchUserDivisions();
      setDivisions(divisionsData);
      setLoading(false);
    };
    
    loadData();
  }, [token, navigate, divisionsData, fetchUserDivisions]);

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
      alert('Successfully joined division!');

      // Refresh user divisions
      console.log('🔄 Refreshing user divisions...');
      await fetchUserDivisions();
      setShowTeamSelection(false);
      setSelectedDivision(null);
      console.log('✅ Division join process completed');
    } catch (error) {
      console.error('❌ Error joining division:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);
      alert(error.response?.data?.message || 'Error joining division. Please try again.');
    }
  };

  const handleLeaveDivision = async (divisionId) => {
    if (!window.confirm('Are you sure you want to leave this division?')) return;

    try {
      await axios.post('/api/divisions/leave', {
        divisionId: divisionId
      }, {
        headers: { 'x-auth-token': token }
      });

      await fetchUserDivisions();
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

              {isJoined && userTeam?.team ? (
                <div className="user-team">
                  <h4>Your Team:</h4>
                  <div className="team-characters">
                    <div className="team-character main">
                      <img 
                        src={userTeam.team.mainCharacter.image} 
                        alt={userTeam.team.mainCharacter.name}
                        className="character-image"
                      />
                      <span className="character-name">{userTeam.team.mainCharacter.name}</span>
                      <span className="character-role">Main</span>
                    </div>
                    <div className="team-character secondary">
                      <img 
                        src={userTeam.team.secondaryCharacter.image} 
                        alt={userTeam.team.secondaryCharacter.name}
                        className="character-image"
                      />
                      <span className="character-name">{userTeam.team.secondaryCharacter.name}</span>
                      <span className="character-role">Secondary</span>
                    </div>
                  </div>
                  <div className="team-stats">
                    <span>Wins: {userTeam.wins || 0}</span>
                    <span>Losses: {userTeam.losses || 0}</span>
                    <span>Win Rate: {((userTeam.wins || 0) / ((userTeam.wins || 0) + (userTeam.losses || 0)) * 100 || 0).toFixed(1)}%</span>
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
                      🔄 Change Team
                    </button>
                    <button 
                      className="leave-btn"
                      onClick={() => handleLeaveDivision(division.id)}
                    >
                      🚪 Leave Division
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
                <span>👥 Active Teams: {division.activeTeams || 0}</span>
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
    </div>
  );
};

export default DivisionsPage;