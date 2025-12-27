import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './TournamentPage.css';

const TournamentPage = () => {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [brackets, setBrackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTournament, setNewTournament] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    maxParticipants: 32,
    tournamentType: 'single_elimination',
    divisionId: '',
    prizePool: 0,
    entryFee: 0,
    rules: ''
  });
  
  const { t } = useLanguage();
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await axios.get('/api/tournaments');
      setTournaments(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      setLoading(false);
    }
  };

  const fetchTournamentDetails = async (tournamentId) => {
    try {
      const [tournamentResponse, bracketsResponse] = await Promise.all([
        axios.get(`/api/tournaments/${tournamentId}`),
        axios.get(`/api/tournaments/${tournamentId}/brackets`)
      ]);
      
      setSelectedTournament(tournamentResponse.data);
      setBrackets(bracketsResponse.data.brackets || []);
    } catch (error) {
      console.error('Error fetching tournament details:', error);
    }
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post('/api/tournaments', newTournament, {
        headers: { 'x-auth-token': token }
      });
      
      setShowCreateForm(false);
      setNewTournament({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        maxParticipants: 32,
        tournamentType: 'single_elimination',
        divisionId: '',
        prizePool: 0,
        entryFee: 0,
        rules: ''
      });
      
      fetchTournaments();
    } catch (error) {
      console.error('Error creating tournament:', error);
      alert(error.response?.data?.msg || 'Error creating tournament');
    }
  };

  const handleJoinTournament = async (tournamentId) => {
    try {
      await axios.post(`/api/tournaments/${tournamentId}/join`, {
        characterId: 'default' // This should be selected by user
      }, {
        headers: { 'x-auth-token': token }
      });
      
      fetchTournaments();
      alert('Successfully joined tournament!');
    } catch (error) {
      console.error('Error joining tournament:', error);
      alert(error.response?.data?.msg || 'Error joining tournament');
    }
  };

  const handleStartTournament = async (tournamentId) => {
    try {
      await axios.post(`/api/tournaments/${tournamentId}/start`, {}, {
        headers: { 'x-auth-token': token }
      });
      
      fetchTournaments();
      if (selectedTournament?.id === tournamentId) {
        fetchTournamentDetails(tournamentId);
      }
      alert('Tournament started successfully!');
    } catch (error) {
      console.error('Error starting tournament:', error);
      alert(error.response?.data?.msg || 'Error starting tournament');
    }
  };

  const handleVote = async (tournamentId, matchId, winnerId) => {
    try {
      await axios.post(`/api/tournaments/${tournamentId}/matches/${matchId}/vote`, {
        winnerId
      }, {
        headers: { 'x-auth-token': token }
      });
      
      fetchTournamentDetails(tournamentId);
    } catch (error) {
      console.error('Error voting:', error);
      alert(error.response?.data?.msg || 'Error voting');
    }
  };

  const renderBracket = () => {
    if (!brackets.length) return <p>No brackets available</p>;

    return (
      <div className="tournament-brackets">
        {brackets.map((round, roundIndex) => (
          <div key={roundIndex} className="bracket-round">
            <h3>Round {round.round}</h3>
            <div className="round-matches">
              {round.matches.map((match, matchIndex) => (
                <div key={matchIndex} className={`bracket-match ${match.status}`}>
                  <div className="match-header">
                    <span className="match-id">Match {match.id}</span>
                    <span className="match-status">{match.status}</span>
                  </div>
                  
                  <div className="match-players">
                    <div className={`player ${match.winner === match.player1?.userId ? 'winner' : ''}`}>
                      {match.player1?.type === 'bye' ? (
                        <span className="bye-player">BYE</span>
                      ) : match.player1?.type === 'tbd' ? (
                        <span className="tbd-player">TBD</span>
                      ) : (
                        <>
                          <span className="player-name">{match.player1?.username || 'Unknown'}</span>
                          <span className="player-character">{match.player1?.characterName || ''}</span>
                        </>
                      )}
                    </div>
                    
                    <div className="match-vs">VS</div>
                    
                    <div className={`player ${match.winner === match.player2?.userId ? 'winner' : ''}`}>
                      {match.player2?.type === 'bye' ? (
                        <span className="bye-player">BYE</span>
                      ) : match.player2?.type === 'tbd' ? (
                        <span className="tbd-player">TBD</span>
                      ) : (
                        <>
                          <span className="player-name">{match.player2?.username || 'Unknown'}</span>
                          <span className="player-character">{match.player2?.characterName || ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {match.status === 'active' && (
                    <div className="match-voting">
                      <div className="vote-counts">
                        <span>{match.votes?.player1 || 0} votes</span>
                        <span>{match.votes?.player2 || 0} votes</span>
                      </div>
                      <div className="vote-buttons">
                        <button 
                          onClick={() => handleVote(selectedTournament.id, match.id, match.player1?.userId)}
                          disabled={!match.player1?.userId}
                        >
                          Vote Player 1
                        </button>
                        <button 
                          onClick={() => handleVote(selectedTournament.id, match.id, match.player2?.userId)}
                          disabled={!match.player2?.userId}
                        >
                          Vote Player 2
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {match.winner && (
                    <div className="match-winner">
                      🏆 Winner: {match.winner === match.player1?.userId ? 
                        match.player1?.username : match.player2?.username}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTournamentList = () => {
    return (
      <div className="tournaments-list">
        <div className="tournaments-header">
          <h1>🏆 {t('tournaments') || 'Tournaments'}</h1>
          {token && (
            <button 
              className="create-tournament-btn"
              onClick={() => setShowCreateForm(true)}
            >
              ➕ {t('createTournament') || 'Create Tournament'}
            </button>
          )}
        </div>

        {showCreateForm && (
          <div className="create-tournament-form">
            <h2>{t('createNewTournament') || 'Create New Tournament'}</h2>
            <form onSubmit={handleCreateTournament}>
              <div className="form-group">
                <label>{t('title') || 'Title'}:</label>
                <input
                  type="text"
                  value={newTournament.title}
                  onChange={(e) => setNewTournament({...newTournament, title: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>{t('description') || 'Description'}:</label>
                <textarea
                  value={newTournament.description}
                  onChange={(e) => setNewTournament({...newTournament, description: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>{t('startDate') || 'Start Date'}:</label>
                  <input
                    type="datetime-local"
                    value={newTournament.startDate}
                    onChange={(e) => setNewTournament({...newTournament, startDate: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>{t('endDate') || 'End Date'}:</label>
                  <input
                    type="datetime-local"
                    value={newTournament.endDate}
                    onChange={(e) => setNewTournament({...newTournament, endDate: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>{t('maxParticipants') || 'Max Participants'}:</label>
                  <select
                    value={newTournament.maxParticipants}
                    onChange={(e) => setNewTournament({...newTournament, maxParticipants: parseInt(e.target.value)})}
                  >
                    <option value={8}>8</option>
                    <option value={16}>16</option>
                    <option value={32}>32</option>
                    <option value={64}>64</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>{t('tournamentType') || 'Tournament Type'}:</label>
                  <select
                    value={newTournament.tournamentType}
                    onChange={(e) => setNewTournament({...newTournament, tournamentType: e.target.value})}
                  >
                    <option value="single_elimination">{t('singleElimination') || 'Single Elimination'}</option>
                    <option value="double_elimination">{t('doubleElimination') || 'Double Elimination'}</option>
                    <option value="round_robin">{t('roundRobin') || 'Round Robin'}</option>
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>{t('prizePool') || 'Prize Pool'}:</label>
                  <input
                    type="number"
                    value={newTournament.prizePool}
                    onChange={(e) => setNewTournament({...newTournament, prizePool: parseInt(e.target.value)})}
                    min="0"
                  />
                </div>
                
                <div className="form-group">
                  <label>{t('entryFee') || 'Entry Fee'}:</label>
                  <input
                    type="number"
                    value={newTournament.entryFee}
                    onChange={(e) => setNewTournament({...newTournament, entryFee: parseInt(e.target.value)})}
                    min="0"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>{t('rules') || 'Rules'}:</label>
                <textarea
                  value={newTournament.rules}
                  onChange={(e) => setNewTournament({...newTournament, rules: e.target.value})}
                />
              </div>
              
              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  {t('createTournament') || 'Create Tournament'}
                </button>
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowCreateForm(false)}
                >
                  {t('cancel') || 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="tournaments-grid">
          {tournaments.map(tournament => (
            <div key={tournament.id} className="tournament-card">
              <div className="tournament-header">
                <h3>{tournament.title}</h3>
                <span className={`tournament-status ${tournament.status}`}>
                  {tournament.status}
                </span>
              </div>
              
              <p className="tournament-description">{tournament.description}</p>
              
              <div className="tournament-stats">
                <span>👥 {tournament.participantCount || 0}/{tournament.maxParticipants}</span>
                <span>🏆 {tournament.prizePool || 0} points</span>
                <span>💰 {tournament.entryFee || 0} entry</span>
              </div>
              
              <div className="tournament-dates">
                <span>📅 {new Date(tournament.startDate).toLocaleDateString()}</span>
                <span>⏰ {new Date(tournament.endDate).toLocaleDateString()}</span>
              </div>
              
              <div className="tournament-actions">
                <button 
                  className="view-btn"
                  onClick={() => fetchTournamentDetails(tournament.id)}
                >
                  👁️ {t('view') || 'View'}
                </button>
                
                {tournament.status === 'upcoming' && tournament.canJoin && (
                  <button 
                    className="join-btn"
                    onClick={() => handleJoinTournament(tournament.id)}
                  >
                    ⚔️ {t('join') || 'Join'}
                  </button>
                )}
                
                {tournament.status === 'upcoming' && token && (
                  <button 
                    className="start-btn"
                    onClick={() => handleStartTournament(tournament.id)}
                  >
                    🚀 {t('start') || 'Start'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="tournament-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>{t('loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tournament-page">
      {selectedTournament ? (
        <div className="tournament-detail">
          <div className="tournament-detail-header">
            <button 
              className="back-btn"
              onClick={() => setSelectedTournament(null)}
            >
              ← {t('back') || 'Back'}
            </button>
            <h1>🏆 {selectedTournament.title}</h1>
          </div>
          
          <div className="tournament-info">
            <p>{selectedTournament.description}</p>
            <div className="tournament-meta">
              <span>Status: {selectedTournament.status}</span>
              <span>Participants: {selectedTournament.participantCount || 0}</span>
              <span>Prize Pool: {selectedTournament.prizePool || 0}</span>
            </div>
          </div>
          
          {selectedTournament.status === 'active' && renderBracket()}
          
          {selectedTournament.status === 'upcoming' && (
            <div className="tournament-participants">
              <h3>Participants</h3>
              <div className="participants-list">
                {selectedTournament.participants?.map(participant => (
                  <div key={participant.userId} className="participant">
                    <span>{participant.username}</span>
                    <span>{participant.characterName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        renderTournamentList()
      )}
    </div>
  );
};

export default TournamentPage;
