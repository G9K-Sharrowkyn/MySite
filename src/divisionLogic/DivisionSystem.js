import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './DivisionSystem.css';

const DivisionSystem = ({ user, isModerator }) => {
  const [divisions, setDivisions] = useState([]);
  const [userTeams, setUserTeams] = useState({});
  const [activeFights, setActiveFights] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [registrationMode, setRegistrationMode] = useState(false);
  const [selectedFighters, setSelectedFighters] = useState([]);
  const [availableCharacters, setAvailableCharacters] = useState([]);
  const { t } = useLanguage();

  // Division definitions with unique character rosters
  const divisionTemplates = {
    dragonball: {
      name: 'Dragon Ball Division',
      description: 'The most powerful warriors in the multiverse',
      icon: '🐉',
      color: '#ff6b6b',
      characters: [
        { id: 'goku', name: 'Goku', image: '/characters/goku.jpg', universe: 'Dragon Ball' },
        { id: 'vegeta', name: 'Vegeta', image: '/characters/vegeta.jpg', universe: 'Dragon Ball' },
        { id: 'frieza', name: 'Frieza', image: '/characters/frieza.jpg', universe: 'Dragon Ball' },
        { id: 'cell', name: 'Cell', image: '/characters/cell.jpg', universe: 'Dragon Ball' },
        { id: 'majin_buu', name: 'Majin Buu', image: '/characters/buu.jpg', universe: 'Dragon Ball' },
        { id: 'broly', name: 'Broly', image: '/characters/broly.jpg', universe: 'Dragon Ball' },
        { id: 'jiren', name: 'Jiren', image: '/characters/jiren.jpg', universe: 'Dragon Ball' },
        { id: 'beerus', name: 'Beerus', image: '/characters/beerus.jpg', universe: 'Dragon Ball' },
        { id: 'whis', name: 'Whis', image: '/characters/whis.jpg', universe: 'Dragon Ball' },
        { id: 'zeno', name: 'Zeno', image: '/characters/zeno.jpg', universe: 'Dragon Ball' }
      ]
    },
    marvel: {
      name: 'Marvel Division',
      description: 'Earth\'s Mightiest Heroes and Villains',
      icon: '🦸‍♂️',
      color: '#4ecdc4',
      characters: [
        { id: 'hulk', name: 'Hulk', image: '/characters/hulk.jpg', universe: 'Marvel' },
        { id: 'thor', name: 'Thor', image: '/characters/thor.jpg', universe: 'Marvel' },
        { id: 'ironman', name: 'Iron Man', image: '/characters/ironman.jpg', universe: 'Marvel' },
        { id: 'captain_america', name: 'Captain America', image: '/characters/cap.jpg', universe: 'Marvel' },
        { id: 'spiderman', name: 'Spider-Man', image: '/characters/spiderman.jpg', universe: 'Marvel' },
        { id: 'thanos', name: 'Thanos', image: '/characters/thanos.jpg', universe: 'Marvel' },
        { id: 'galactus', name: 'Galactus', image: '/characters/galactus.jpg', universe: 'Marvel' },
        { id: 'wolverine', name: 'Wolverine', image: '/characters/wolverine.jpg', universe: 'Marvel' },
        { id: 'deadpool', name: 'Deadpool', image: '/characters/deadpool.jpg', universe: 'Marvel' },
        { id: 'doctor_strange', name: 'Doctor Strange', image: '/characters/strange.jpg', universe: 'Marvel' }
      ]
    },
    dc: {
      name: 'DC Division',
      description: 'The Justice League and their greatest foes',
      icon: '🦇',
      color: '#45b7d1',
      characters: [
        { id: 'superman', name: 'Superman', image: '/characters/superman.jpg', universe: 'DC' },
        { id: 'batman', name: 'Batman', image: '/characters/batman.jpg', universe: 'DC' },
        { id: 'wonder_woman', name: 'Wonder Woman', image: '/characters/wonderwoman.jpg', universe: 'DC' },
        { id: 'flash', name: 'The Flash', image: '/characters/flash.jpg', universe: 'DC' },
        { id: 'green_lantern', name: 'Green Lantern', image: '/characters/greenlantern.jpg', universe: 'DC' },
        { id: 'aquaman', name: 'Aquaman', image: '/characters/aquaman.jpg', universe: 'DC' },
        { id: 'joker', name: 'Joker', image: '/characters/joker.jpg', universe: 'DC' },
        { id: 'lex_luthor', name: 'Lex Luthor', image: '/characters/lexluthor.jpg', universe: 'DC' },
        { id: 'darkseid', name: 'Darkseid', image: '/characters/darkseid.jpg', universe: 'DC' },
        { id: 'doomsday', name: 'Doomsday', image: '/characters/doomsday.jpg', universe: 'DC' }
      ]
    },
    anime: {
      name: 'Anime Division',
      description: 'Legendary warriors from anime universes',
      icon: '🗾',
      color: '#96ceb4',
      characters: [
        { id: 'naruto', name: 'Naruto', image: '/characters/naruto.jpg', universe: 'Naruto' },
        { id: 'sasuke', name: 'Sasuke', image: '/characters/sasuke.jpg', universe: 'Naruto' },
        { id: 'luffy', name: 'Luffy', image: '/characters/luffy.jpg', universe: 'One Piece' },
        { id: 'zoro', name: 'Zoro', image: '/characters/zoro.jpg', universe: 'One Piece' },
        { id: 'ichigo', name: 'Ichigo', image: '/characters/ichigo.jpg', universe: 'Bleach' },
        { id: 'aizen', name: 'Aizen', image: '/characters/aizen.jpg', universe: 'Bleach' },
        { id: 'saitama', name: 'Saitama', image: '/characters/saitama.jpg', universe: 'One Punch Man' },
        { id: 'genos', name: 'Genos', image: '/characters/genos.jpg', universe: 'One Punch Man' },
        { id: 'eren', name: 'Eren Yeager', image: '/characters/eren.jpg', universe: 'Attack on Titan' },
        { id: 'levi', name: 'Levi', image: '/characters/levi.jpg', universe: 'Attack on Titan' }
      ]
    }
  };

  useEffect(() => {
    fetchDivisions();
    fetchUserTeams();
    fetchActiveFights();
  }, []);

  const fetchDivisions = async () => {
    try {
      const response = await axios.get('/api/divisions');
      setDivisions(response.data || Object.values(divisionTemplates));
    } catch (error) {
      console.error('Error fetching divisions:', error);
      setDivisions(Object.values(divisionTemplates));
    }
  };

  const fetchUserTeams = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`/api/divisions/user-teams/${user.id}`);
      setUserTeams(response.data || {});
    } catch (error) {
      console.error('Error fetching user teams:', error);
    }
  };

  const fetchActiveFights = async () => {
    try {
      const response = await axios.get('/api/divisions/active-fights');
      setActiveFights(response.data || []);
    } catch (error) {
      console.error('Error fetching active fights:', error);
    }
  };

  const handleJoinDivision = (division) => {
    setSelectedDivision(division);
    setRegistrationMode(true);
    
    // Get available characters (not picked by other users)
    const takenCharacters = division.registeredTeams?.flatMap(team => team.fighters) || [];
    const available = division.characters.filter(char => 
      !takenCharacters.some(taken => taken.id === char.id)
    );
    setAvailableCharacters(available);
    setSelectedFighters([]);
  };

  const handleCharacterSelect = (character) => {
    if (selectedFighters.length < 2 && !selectedFighters.find(f => f.id === character.id)) {
      setSelectedFighters([...selectedFighters, character]);
    }
  };

  const handleCharacterDeselect = (character) => {
    setSelectedFighters(selectedFighters.filter(f => f.id !== character.id));
  };

  const confirmTeamRegistration = async () => {
    if (selectedFighters.length !== 2 || !selectedDivision) return;

    try {
      await axios.post('/api/divisions/register-team', {
        userId: user.id,
        divisionId: selectedDivision.id,
        fighters: selectedFighters
      });

      setUserTeams(prev => ({
        ...prev,
        [selectedDivision.id]: {
          fighters: selectedFighters,
          record: { wins: 0, losses: 0 },
          isChampion: false
        }
      }));

      setRegistrationMode(false);
      setSelectedDivision(null);
      setSelectedFighters([]);
      
      // Show success notification
      alert(`Successfully registered team for ${selectedDivision.name}!`);
    } catch (error) {
      console.error('Error registering team:', error);
      alert('Failed to register team. Please try again.');
    }
  };

  const createOfficialFight = async (team1, team2, divisionId, isTitle = false) => {
    if (!isModerator) return;

    try {
      await axios.post('/api/divisions/create-fight', {
        team1,
        team2,
        divisionId,
        isTitle,
        duration: 72, // 72 hours
        createdBy: user.id
      });

      fetchActiveFights();
      alert('Official fight created successfully!');
    } catch (error) {
      console.error('Error creating fight:', error);
      alert('Failed to create fight.');
    }
  };

  const getUserRecord = (userId, divisionId) => {
    return userTeams[divisionId]?.record || { wins: 0, losses: 0 };
  };

  const getDivisionChampion = (divisionId) => {
    return divisions.find(d => d.id === divisionId)?.champion || null;
  };

  const formatTimeRemaining = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff <= 0) return 'Fight Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  return (
    <div className="division-system">
      <div className="division-header">
        <h1>🏆 Division System</h1>
        <p>Join official divisions and fight for championship glory!</p>
        
        <div className="system-stats">
          <div className="stat-item">
            <span className="stat-number">{divisions.length}</span>
            <span className="stat-label">Active Divisions</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{activeFights.length}</span>
            <span className="stat-label">Live Fights</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{Object.keys(userTeams).length}</span>
            <span className="stat-label">Your Teams</span>
          </div>
        </div>
      </div>

      {/* Active Official Fights */}
      {activeFights.length > 0 && (
        <div className="active-fights-section">
          <h2>🔥 Live Official Fights</h2>
          <div className="fights-grid">
            {activeFights.map(fight => (
              <div key={fight.id} className={`official-fight-card ${fight.isTitle ? 'title-fight' : ''}`}>
                {fight.isTitle && (
                  <div className="title-fight-banner">
                    👑 CHAMPIONSHIP FIGHT 👑
                  </div>
                )}
                
                <div className="fight-timer">
                  ⏰ {formatTimeRemaining(fight.endTime)}
                </div>
                
                <div className="teams-display">
                  <div className="team-side">
                    <div className="team-fighters">
                      {fight.team1.fighters.map(fighter => (
                        <img key={fighter.id} src={fighter.image} alt={fighter.name} />
                      ))}
                    </div>
                    <div className="team-info">
                      <span className="team-owner">{fight.team1.owner.username}</span>
                      <span className="team-record">
                        {getUserRecord(fight.team1.owner.id, fight.divisionId).wins}W - 
                        {getUserRecord(fight.team1.owner.id, fight.divisionId).losses}L
                      </span>
                    </div>
                    <div className="vote-count">{fight.team1Votes || 0} votes</div>
                  </div>
                  
                  <div className="vs-official">
                    <span>VS</span>
                    <div className="division-badge">{fight.division.name}</div>
                  </div>
                  
                  <div className="team-side">
                    <div className="team-fighters">
                      {fight.team2.fighters.map(fighter => (
                        <img key={fighter.id} src={fighter.image} alt={fighter.name} />
                      ))}
                    </div>
                    <div className="team-info">
                      <span className="team-owner">{fight.team2.owner.username}</span>
                      <span className="team-record">
                        {getUserRecord(fight.team2.owner.id, fight.divisionId).wins}W - 
                        {getUserRecord(fight.team2.owner.id, fight.divisionId).losses}L
                      </span>
                    </div>
                    <div className="vote-count">{fight.team2Votes || 0} votes</div>
                  </div>
                </div>
                
                <div className="fight-actions">
                  <button className="vote-btn team1" onClick={() => voteInOfficialFight(fight.id, 'team1')}>
                    Vote Team 1
                  </button>
                  <button className="vote-btn team2" onClick={() => voteInOfficialFight(fight.id, 'team2')}>
                    Vote Team 2
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divisions Overview */}
      <div className="divisions-grid">
        {divisions.map(division => {
          const userTeam = userTeams[division.id];
          const champion = getDivisionChampion(division.id);
          
          return (
            <div key={division.id} className="division-card" style={{ '--division-color': division.color }}>
              <div className="division-header">
                <div className="division-icon">{division.icon}</div>
                <h3>{division.name}</h3>
                <p>{division.description}</p>
              </div>
              
              {champion && (
                <div className="champion-section">
                  <div className="champion-crown">👑</div>
                  <div className="champion-info">
                    <span className="champion-label">Current Champion</span>
                    <span className="champion-name">{champion.username}</span>
                    <div className="champion-team">
                      {champion.team.fighters.map(fighter => (
                        <img key={fighter.id} src={fighter.image} alt={fighter.name} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="division-stats">
                <div className="stat">
                  <span>{division.totalFighters || 20}</span>
                  <label>Fighters</label>
                </div>
                <div className="stat">
                  <span>{division.registeredTeams?.length || 0}</span>
                  <label>Teams</label>
                </div>
                <div className="stat">
                  <span>{division.completedFights || 0}</span>
                  <label>Fights</label>
                </div>
              </div>
              
              {userTeam ? (
                <div className="user-team-info">
                  <h4>Your Team</h4>
                  <div className="team-fighters">
                    {userTeam.fighters.map(fighter => (
                      <div key={fighter.id} className="fighter-card">
                        <img src={fighter.image} alt={fighter.name} />
                        <span>{fighter.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="team-record">
                    <span className="wins">{userTeam.record.wins}W</span>
                    <span className="losses">{userTeam.record.losses}L</span>
                    {userTeam.isChampion && <span className="champion-badge">👑 CHAMPION</span>}
                  </div>
                </div>
              ) : (
                <div className="join-division">
                  <p>Choose 2 fighters to represent you in this division</p>
                  <button 
                    className="join-btn"
                    onClick={() => handleJoinDivision(division)}
                    disabled={!user}
                  >
                    Join Division
                  </button>
                </div>
              )}
              
              {isModerator && (
                <div className="moderator-controls">
                  <button className="mod-btn" onClick={() => openFightCreator(division.id)}>
                    Create Fight
                  </button>
                  <button className="mod-btn title" onClick={() => openTitleFightCreator(division.id)}>
                    Title Fight
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Team Registration Modal */}
      {registrationMode && selectedDivision && (
        <div className="registration-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Join {selectedDivision.name}</h3>
              <button onClick={() => setRegistrationMode(false)}>×</button>
            </div>
            
            <div className="fighter-selection">
              <h4>Select 2 Fighters ({selectedFighters.length}/2)</h4>
              <div className="fighters-grid">
                {availableCharacters.map(character => (
                  <div 
                    key={character.id} 
                    className={`fighter-option ${selectedFighters.find(f => f.id === character.id) ? 'selected' : ''}`}
                    onClick={() => 
                      selectedFighters.find(f => f.id === character.id) 
                        ? handleCharacterDeselect(character)
                        : handleCharacterSelect(character)
                    }
                  >
                    <img src={character.image} alt={character.name} />
                    <span>{character.name}</span>
                    {selectedFighters.find(f => f.id === character.id) && (
                      <div className="selected-overlay">✓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="selected-team">
              <h4>Your Team</h4>
              <div className="team-preview">
                {selectedFighters.map(fighter => (
                  <div key={fighter.id} className="selected-fighter">
                    <img src={fighter.image} alt={fighter.name} />
                    <span>{fighter.name}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="confirm-btn"
                onClick={confirmTeamRegistration}
                disabled={selectedFighters.length !== 2}
              >
                Confirm Team Registration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DivisionSystem;