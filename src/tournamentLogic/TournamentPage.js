import React, { useEffect, useState } from 'react';
import axios from 'axios';
import CreateTournamentForm from './CreateTournamentForm';
import JoinTournamentModal from './JoinTournamentModal';
import TournamentBracket from './TournamentBracket';
import Toast from './Toast';
import './TournamentPage.css';

const TournamentPage = () => {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joiningTournamentId, setJoiningTournamentId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState(null);
  const [toast, setToast] = useState(null);
  
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

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
      const response = await axios.get(`/api/tournaments/${tournamentId}`);
      setSelectedTournament(response.data);
    } catch (error) {
      console.error('Error fetching tournament details:', error);
    }
  };

  const handleTournamentCreated = () => {
    setShowCreateForm(false);
    fetchTournaments();
  };

  const handleJoinClick = (tournamentId) => {
    if (!token) {
      setToast({ message: 'Please log in to join tournaments', type: 'warning' });
      return;
    }
    setJoiningTournamentId(tournamentId);
    setShowJoinModal(true);
  };

  const handleJoinSuccess = () => {
    setShowJoinModal(false);
    setJoiningTournamentId(null);
    fetchTournaments();
    if (selectedTournament) {
      fetchTournamentDetails(selectedTournament.id);
    }
  };

  const handleDeleteClick = (tournamentId, tournamentTitle) => {
    setTournamentToDelete({ id: tournamentId, title: tournamentTitle });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!tournamentToDelete) return;

    try {
      await axios.delete(`/api/tournaments/${tournamentToDelete.id}`, {
        headers: { 'x-auth-token': token }
      });
      
      setShowDeleteModal(false);
      setTournamentToDelete(null);
      setToast({ message: 'Tournament deleted successfully', type: 'success' });
      fetchTournaments();
      if (selectedTournament?.id === tournamentToDelete.id) {
        setSelectedTournament(null);
      }
    } catch (error) {
      console.error('Error deleting tournament:', error);
      setToast({ message: error.response?.data?.msg || 'Error deleting tournament', type: 'error' });
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setTournamentToDelete(null);
  };

  const getStatusEmoji = (status) => {
    switch (status) {
      case 'recruiting': return '📢';
      case 'active': return '⚔️';
      case 'completed': return '🏆';
      default: return '📋';
    }
  };

  const getTimeRemaining = (recruitmentEndDate) => {
    const now = new Date();
    const end = new Date(recruitmentEndDate);
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatLocalDateTime = (isoString) => {
    if (!isoString) return 'TBA';
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const filteredTournaments = tournaments.filter(t => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const renderTournamentList = () => {
    return (
      <div className="tournaments-list">
        <div className="tournaments-header">
          <h1>🏆 Tournaments</h1>
          {token && !showCreateForm && (
            <button 
              className="create-tournament-btn"
              onClick={() => setShowCreateForm(true)}
            >
              ➕ Create Tournament
            </button>
          )}
        </div>

        {showCreateForm && (
          <CreateTournamentForm 
            onClose={() => setShowCreateForm(false)}
            onTournamentCreated={handleTournamentCreated}
          />
        )}

        <div className="filter-tabs">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={filter === 'recruiting' ? 'active' : ''}
            onClick={() => setFilter('recruiting')}
          >
            📢 Recruiting
          </button>
          <button 
            className={filter === 'active' ? 'active' : ''}
            onClick={() => setFilter('active')}
          >
            ⚔️ Active
          </button>
          <button 
            className={filter === 'completed' ? 'active' : ''}
            onClick={() => setFilter('completed')}
          >
            🏆 Completed
          </button>
        </div>

        {filteredTournaments.length === 0 ? (
          <div className="no-tournaments">
            <p>No tournaments found</p>
            {token && (
              <button 
                className="create-tournament-btn"
                onClick={() => setShowCreateForm(true)}
              >
                Create Tournament
              </button>
            )}
          </div>
        ) : (
          <div className="tournaments-grid">
            {filteredTournaments.map(tournament => {
              const isCreator = tournament.createdBy === userId;
              const isParticipant = tournament.participants?.some(p => p.userId === userId);
              
              return (
                <div key={tournament.id} className={`tournament-card ${tournament.status}`}>
                  <div className="tournament-card-header">
                    <h3>{tournament.title}</h3>
                    <span className={`status-badge ${tournament.status}`}>
                      {getStatusEmoji(tournament.status)} {tournament.status}
                    </span>
                  </div>
                  
                  <p className="tournament-description">{tournament.description}</p>
                  
                  <div className="tournament-meta">
                    <div className="meta-item">
                      <span className="meta-label">Participants:</span>
                      <span className="meta-value">{tournament.participants?.length || 0}/{tournament.maxParticipants}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Team Size:</span>
                      <span className="meta-value">{tournament.teamSize}</span>
                    </div>
                    {tournament.status === 'recruiting' && tournament.recruitmentEndDate && (
                      <>
                        <div className="meta-item">
                          <span className="meta-label">Starts In:</span>
                          <span className="meta-value">{getTimeRemaining(tournament.recruitmentEndDate)}</span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-label">Battle Time:</span>
                          <span className="meta-value">{formatLocalDateTime(tournament.recruitmentEndDate)}</span>
                        </div>
                      </>
                    )}
                    {tournament.status !== 'recruiting' && tournament.recruitmentEndDate && (
                      <div className="meta-item">
                        <span className="meta-label">Started:</span>
                        <span className="meta-value">{formatLocalDateTime(tournament.recruitmentEndDate)}</span>
                      </div>
                    )}
                  </div>

                  {tournament.allowedTiers && tournament.allowedTiers.length > 0 && (
                    <div className="tournament-tiers">
                      <span className="tiers-label">Allowed Tiers:</span>
                      <div className="tiers-list">
                        {tournament.allowedTiers.map(tier => (
                          <span key={tier} className="tier-badge">{tier}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="tournament-actions">
                    <button 
                      className="btn-view"
                      onClick={() => fetchTournamentDetails(tournament.id)}
                    >
                      👁️ View
                    </button>
                    
                    {tournament.status === 'recruiting' && !isParticipant && (
                      <button 
                        className="btn-join"
                        onClick={() => handleJoinClick(tournament.id)}
                        disabled={!token}
                      >
                        ⚔️ Join
                      </button>
                    )}
                    
                    {tournament.status === 'recruiting' && isCreator && (
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeleteClick(tournament.id, tournament.title)}
                      >
                        🗑️ Delete
                      </button>
                    )}
                    
                    {isParticipant && (
                      <span className="participant-badge">✓ Joined</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTournamentDetail = () => {
    if (!selectedTournament) return null;

    return (
      <div className="tournament-detail">
        <div className="tournament-detail-header">
          <button 
            className="back-btn"
            onClick={() => setSelectedTournament(null)}
          >
            ← Back
          </button>
          <h1>🏆 {selectedTournament.title}</h1>
          <span className={`status-badge ${selectedTournament.status}`}>
            {getStatusEmoji(selectedTournament.status)} {selectedTournament.status}
          </span>
        </div>

        <div className="tournament-info-section">
          <p className="tournament-full-description">{selectedTournament.description}</p>
          
          <div className="tournament-details-grid">
            <div className="detail-card">
              <span className="detail-label">Participants</span>
              <span className="detail-value">{selectedTournament.participants?.length || 0}/{selectedTournament.maxParticipants}</span>
            </div>
            <div className="detail-card">
              <span className="detail-label">Team Size</span>
              <span className="detail-value">{selectedTournament.teamSize}</span>
            </div>
            <div className="detail-card">
              <span className="detail-label">Battle Time</span>
              <span className="detail-value">{selectedTournament.battleTime}</span>
            </div>
            {selectedTournament.status === 'recruiting' && selectedTournament.recruitmentEndDate && (
              <div className="detail-card">
                <span className="detail-label">Recruitment Ends</span>
                <span className="detail-value">{getTimeRemaining(selectedTournament.recruitmentEndDate)}</span>
              </div>
            )}
          </div>

          {selectedTournament.allowedTiers && selectedTournament.allowedTiers.length > 0 && (
            <div className="allowed-tiers-section">
              <h3>Allowed Tiers</h3>
              <div className="tiers-list">
                {selectedTournament.allowedTiers.map(tier => (
                  <span key={tier} className="tier-badge large">{tier}</span>
                ))}
              </div>
            </div>
          )}

          {selectedTournament.excludedCharacters && selectedTournament.excludedCharacters.length > 0 && (
            <div className="excluded-characters-section">
              <h3>Excluded Characters ({selectedTournament.excludedCharacters.length})</h3>
              <p className="excluded-note">These characters cannot be selected in this tournament</p>
            </div>
          )}
        </div>

        {selectedTournament.status === 'recruiting' && (
          <div className="participants-section">
            <h3>Participants ({selectedTournament.participants?.length || 0})</h3>
            <div className="participants-grid">
              {selectedTournament.participants?.map(participant => (
                <div key={participant.userId} className="participant-card">
                  <div className="participant-name">{participant.username}</div>
                  <div className="participant-characters">
                    {participant.characters?.map(char => (
                      <span key={char.id} className="character-badge">{char.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(selectedTournament.status === 'active' || selectedTournament.status === 'completed') && (
          <TournamentBracket 
            tournamentId={selectedTournament.id} 
            status={selectedTournament.status}
          />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="tournament-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tournament-page">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showJoinModal && (
        <JoinTournamentModal 
          tournamentId={joiningTournamentId}
          onClose={() => setShowJoinModal(false)}
          onSuccess={handleJoinSuccess}
        />
      )}

      {showDeleteModal && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🗑️ Delete Tournament</h2>
              <button className="close-btn" onClick={cancelDelete}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this tournament?</p>
              <p className="tournament-name-highlight">"{tournamentToDelete?.title}"</p>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelDelete}>
                Cancel
              </button>
              <button className="btn-confirm-delete" onClick={confirmDelete}>
                Delete Tournament
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTournament ? renderTournamentDetail() : renderTournamentList()}
    </div>
  );
};

export default TournamentPage;
