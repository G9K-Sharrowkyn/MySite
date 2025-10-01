import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { replacePlaceholderUrl, placeholderImages } from '../utils/placeholderImage';
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
  const [fighterProposals, setFighterProposals] = useState([]);
  const [proposalStats, setProposalStats] = useState({});
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [divisions, setDivisions] = useState([]);
  const [divisionStats, setDivisionStats] = useState({});
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  
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
  const currentUserId = localStorage.getItem('userId');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    checkModeratorAccess();
    fetchData();
  }, [token, navigate]);

  const checkModeratorAccess = async () => {
    try {
      const response = await axios.get('/api/profile/me', {
        headers: { 'x-auth-token': token }
      });
      
      if (response.data.role !== 'moderator') {
        showNotification('Brak uprawnień moderatora', 'error');
        navigate('/');
      }
    } catch (error) {
      console.error('Error checking moderator access:', error);
      navigate('/login');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fightsRes, postsRes, usersRes, charactersRes, betsRes, divisionsRes] = await Promise.all([
        axios.get('/api/posts/official'),
        axios.get('/api/posts'),
        axios.get('/api/profile/all'),
        axios.get('/api/characters'),
        axios.get('/api/betting/moderator/all', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: [] })), // Fallback if betting not available
        axios.get('/api/divisions/stats', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: {} })) // Fallback if divisions not available
      ]);

      setFights(fightsRes.data.fights || fightsRes.data);
      setPosts(postsRes.data.posts || postsRes.data);
      setUsers(usersRes.data);
      setCharacters(charactersRes.data);
      setBets(betsRes.data || []);
      setDivisionStats(divisionsRes.data || {});
      
      // Fetch fighter proposals and divisions data
      await Promise.all([
        fetchFighterProposals(),
        fetchDivisions()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Błąd podczas ładowania danych', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

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

  // Fighter Proposals Management
  const fetchFighterProposals = async () => {
    if (!token) return;
    
    setLoadingProposals(true);
    try {
      const [proposalsResponse, statsResponse] = await Promise.all([
        axios.get('/api/fighter-proposals/all?limit=50', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: { proposals: [] } })),
        axios.get('/api/fighter-proposals/stats', {
          headers: { 'x-auth-token': token }
        }).catch(() => ({ data: {} }))
      ]);

      setFighterProposals(proposalsResponse.data.proposals || []);
      setProposalStats(statsResponse.data || {});
    } catch (error) {
      console.error('Error fetching fighter proposals:', error);
    } finally {
      setLoadingProposals(false);
    }
  };

  // Divisions Management
  const fetchDivisions = async () => {
    if (!token) return;
    
    try {
      const response = await axios.get('/api/divisions', {
        headers: { 'x-auth-token': token }
      });
      setDivisions(response.data || []);
    } catch (error) {
      console.error('Error fetching divisions:', error);
    }
  };

  const handleApproveProposal = async (proposalId, notes = '') => {
    if (!window.confirm('Czy na pewno chcesz zatwierdzić tę propozycję?')) return;

    try {
      await axios.post(`/api/fighter-proposals/${proposalId}/approve`,
        { notes },
        { headers: { 'x-auth-token': token } }
      );
      
      alert('Propozycja została zatwierdzona i fighter dodany do bazy danych');
      fetchFighterProposals();
    } catch (error) {
      console.error('Error approving proposal:', error);
      alert('Błąd podczas zatwierdzania propozycji');
    }
  };

  const handleRejectProposal = async (proposalId, notes = '') => {
    const reason = window.prompt('Podaj powód odrzucenia propozycji:', notes);
    if (reason === null) return;

    try {
      await axios.post(`/api/fighter-proposals/${proposalId}/reject`,
        { notes: reason },
        { headers: { 'x-auth-token': token } }
      );
      
      alert('Propozycja została odrzucona');
      fetchFighterProposals();
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      alert('Błąd podczas odrzucania propozycji');
    }
  };

  const handleDeleteProposal = async (proposalId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę propozycję? Ta akcja jest nieodwracalna.')) return;

    try {
      await axios.delete(`/api/fighter-proposals/${proposalId}`, {
        headers: { 'x-auth-token': token }
      });
      
      alert('Propozycja została usunięta');
      fetchFighterProposals();
    } catch (error) {
      console.error('Error deleting proposal:', error);
      alert('Błąd podczas usuwania propozycji');
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pl-PL');
  };

  const formatCurrency = (amount) => {
    return `${amount} 🪙`;
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
          ⚔️ Walki Główne
        </button>
        <button
          className={`tab-btn ${activeTab === 'divisions' ? 'active' : ''}`}
          onClick={() => setActiveTab('divisions')}
        >
          🏆 Dywizje
        </button>
        <button
          className={`tab-btn ${activeTab === 'proposals' ? 'active' : ''}`}
          onClick={() => setActiveTab('proposals')}
        >
          🥊 Propozycje Fighterów
        </button>
        <button
          className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          📝 Zarządzaj Postami
        </button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Użytkownicy
        </button>
        <button
          className={`tab-btn ${activeTab === 'betting' ? 'active' : ''}`}
          onClick={() => setActiveTab('betting')}
        >
          💰 Zakłady
        </button>
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statystyki
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'fights' && (
          <div className="fights-section">
            <div className="create-fight-card">
              <h3>🌟 Stwórz Walkę Główną</h3>
              <form onSubmit={handleFightSubmit} className="fight-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Tytuł walki</label>
                    <input
                      type="text"
                      value={newFight.title}
                      onChange={(e) => setNewFight({...newFight, title: e.target.value})}
                      placeholder="np. Epicki pojedynek: Batman vs Superman"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Kategoria</label>
                    <select
                      value={newFight.category}
                      onChange={(e) => setNewFight({...newFight, category: e.target.value})}
                    >
                      <option value="Main Event">Main Event</option>
                      <option value="Co-Main Event">Co-Main Event</option>
                      <option value="Featured Fight">Featured Fight</option>
                      <option value="Special Event">Special Event</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Postać 1</label>
                    <CharacterSelector
                      characters={characters}
                      selectedCharacter={newFight.character1}
                      onSelect={(character) => setNewFight({...newFight, character1: character})}
                    />
                  </div>
                  <div className="vs-divider">VS</div>
                  <div className="form-group">
                    <label>Postać 2</label>
                    <CharacterSelector
                      characters={characters}
                      selectedCharacter={newFight.character2}
                      onSelect={(character) => setNewFight({...newFight, character2: character})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Opis walki</label>
                  <textarea
                    value={newFight.description}
                    onChange={(e) => setNewFight({...newFight, description: e.target.value})}
                    placeholder="Opisz tę epicką walkę..."
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
                    Wyróżnij na stronie głównej
                  </label>
                </div>

                <button type="submit" className="create-btn" disabled={loading}>
                  {loading ? '⏳ Tworzenie...' : '🚀 Stwórz Walkę'}
                </button>
              </form>
            </div>

            <div className="existing-fights">
              <h3>🎯 Istniejące Walki Oficjalne</h3>
              <div className="fights-grid">
                {fights.map(fight => (
                  <div key={fight.id} className="fight-card">
                    <div className="fight-header">
                      <h4>{fight.title}</h4>
                      <div className="fight-badges">
                        <span className="badge badge-official">🛡️ Oficjalna</span>
                        {fight.featured && <span className="badge badge-featured">⭐ Wyróżnione</span>}
                        {fight.category && <span className="badge badge-category">{fight.category}</span>}
                      </div>
                    </div>
                    <div className="fight-details">
                      <div className="fighters">
                        <span className="fighter">{fight.teamA}</span>
                        <span className="vs">VS</span>
                        <span className="fighter">{fight.teamB}</span>
                      </div>
                      <div className="fight-stats">
                        <span>👍 {fight.likes?.length || 0}</span>
                        <span>🗳️ {(fight.fight?.votes?.teamA || 0) + (fight.fight?.votes?.teamB || 0)}</span>
                        <span>💬 {fight.comments?.length || 0}</span>
                      </div>
                      <div className="fight-meta">
                        <span className="fight-date">{formatDate(fight.createdAt)}</span>
                        <span className="fight-status">{fight.fight?.status === 'active' ? '🟢 Aktywna' : '🔴 Zakończona'}</span>
                      </div>
                    </div>
                    <div className="fight-actions">
                      <button 
                        onClick={() => handleFeaturePost(fight.id, fight.featured)}
                        className="feature-btn"
                      >
                        {fight.featured ? '⭐ Usuń wyróżnienie' : '⭐ Wyróżnij'}
                      </button>
                      <button 
                        onClick={() => handleDeletePost(fight.id)}
                        className="delete-btn"
                      >
                        🗑️ Usuń
                      </button>
                    </div>
                  </div>
                ))}
                {fights.length === 0 && (
                  <div className="no-fights">
                    <p>Brak oficjalnych walk. Stwórz pierwszą walkę!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'divisions' && (
          <div className="divisions-section">
            <div className="divisions-header">
              <h3>🏆 Zarządzanie Dywizjami</h3>
              <button
                onClick={handleLockExpiredFights}
                className="lock-fights-btn"
              >
                🔒 Zablokuj wygasłe walki
              </button>
            </div>

            <div className="division-stats">
              <div className="stat-card">
                <div className="stat-icon">🏆</div>
                <div className="stat-info">
                  <h4>{divisionStats.totalDivisions || 0}</h4>
                  <p>Aktywnych Dywizji</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⚔️</div>
                <div className="stat-info">
                  <h4>{divisionStats.activeFights || 0}</h4>
                  <p>Aktywnych Walk</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👑</div>
                <div className="stat-info">
                  <h4>{divisionStats.titleFights || 0}</h4>
                  <p>Walk o Tytuł</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🥊</div>
                <div className="stat-info">
                  <h4>{divisionStats.contenderMatches || 0}</h4>
                  <p>Walk Pretendentów</p>
                </div>
              </div>
            </div>

            <div className="divisions-grid">
              {divisions.map(division => (
                <div key={division.id} className="division-card">
                  <div className="division-header">
                    <h4>{division.name}</h4>
                    <span className="division-tier">Tier {division.tier}</span>
                  </div>
                  
                  <div className="division-champion">
                    {division.currentChampion ? (
                      <div className="champion-info">
                        <span className="champion-label">👑 Mistrz:</span>
                        <span className="champion-name">{division.currentChampion.name}</span>
                        <span className="reign-duration">
                          ({Math.floor((new Date() - new Date(division.currentChampion.since)) / (1000 * 60 * 60 * 24))} dni)
                        </span>
                      </div>
                    ) : (
                      <div className="no-champion">
                        <span>🏆 Wakujący tytuł</span>
                      </div>
                    )}
                  </div>

                  <div className="division-stats-mini">
                    <span>📊 Średnie głosy: {division.averageVotes || 0}</span>
                    <span>🎯 Aktywne zespoły: {division.activeTeams || 0}</span>
                  </div>

                  <div className="division-actions">
                    <button
                      onClick={() => {
                        const challengerId = prompt('ID pretendenta do walki o tytuł:');
                        if (challengerId) handleCreateTitleFight(division.id, challengerId);
                      }}
                      className="title-fight-btn"
                    >
                      👑 Stwórz walkę o tytuł
                    </button>
                    <button
                      onClick={() => {
                        const fighter1 = prompt('ID pierwszego fightera:');
                        const fighter2 = prompt('ID drugiego fightera:');
                        if (fighter1 && fighter2) handleCreateContenderMatch(division.id, fighter1, fighter2);
                      }}
                      className="contender-match-btn"
                    >
                      🥊 Stwórz walkę pretendentów
                    </button>
                  </div>

                  {division.recentFights && division.recentFights.length > 0 && (
                    <div className="recent-fights">
                      <h5>Ostatnie walki:</h5>
                      {division.recentFights.slice(0, 3).map(fight => (
                        <div key={fight.id} className="recent-fight">
                          <span className="fight-teams">{fight.teamA} vs {fight.teamB}</span>
                          <span className={`fight-status ${fight.status}`}>
                            {fight.status === 'active' ? '🟢' : '🔴'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {divisions.length === 0 && (
              <div className="no-divisions">
                <p>Brak dywizji do wyświetlenia.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'proposals' && (
          <div className="proposals-section">
            <h3>🥊 Propozycje Fighterów</h3>
            
            <div className="proposal-stats">
              <div className="stat-card">
                <div className="stat-icon">📝</div>
                <div className="stat-info">
                  <h4>{proposalStats.total || 0}</h4>
                  <p>Wszystkich Propozycji</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-info">
                  <h4>{proposalStats.pending || 0}</h4>
                  <p>Oczekujących</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <h4>{proposalStats.approved || 0}</h4>
                  <p>Zatwierdzonych</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">❌</div>
                <div className="stat-info">
                  <h4>{proposalStats.rejected || 0}</h4>
                  <p>Odrzuconych</p>
                </div>
              </div>
            </div>

            <div className="proposals-list">
              {loadingProposals ? (
                <div className="loading">Ładowanie propozycji...</div>
              ) : fighterProposals.length > 0 ? (
                <div className="proposals-grid">
                  {fighterProposals.map(proposal => (
                    <div key={proposal._id} className="proposal-card">
                      <div className="proposal-header">
                        <h4>{proposal.name}</h4>
                        <span className={`proposal-status status-${proposal.status}`}>
                          {proposal.status === 'pending' && '⏳ Oczekująca'}
                          {proposal.status === 'approved' && '✅ Zatwierdzona'}
                          {proposal.status === 'rejected' && '❌ Odrzucona'}
                        </span>
                      </div>

                      <div className="proposal-details">
                        <div className="proposal-image">
                          {proposal.imageUrl && (
                            <img src={proposal.imageUrl} alt={proposal.name} />
                          )}
                        </div>
                        
                        <div className="proposal-info">
                          <div className="proposal-field">
                            <strong>Uniwersum:</strong> {proposal.universe}
                          </div>
                          <div className="proposal-field">
                            <strong>Opis:</strong> {proposal.description}
                          </div>
                          <div className="proposal-field">
                            <strong>Moce:</strong> {proposal.powers}
                          </div>
                          <div className="proposal-field">
                            <strong>Autor:</strong> {proposal.submittedBy?.username || 'Nieznany'}
                          </div>
                          <div className="proposal-field">
                            <strong>Data:</strong> {formatDate(proposal.createdAt)}
                          </div>
                          
                          {proposal.moderatorNotes && (
                            <div className="proposal-field">
                              <strong>Notatki moderatora:</strong> {proposal.moderatorNotes}
                            </div>
                          )}
                        </div>
                      </div>

                      {proposal.status === 'pending' && (
                        <div className="proposal-actions">
                          <button
                            onClick={() => handleApproveProposal(proposal._id)}
                            className="approve-btn"
                          >
                            ✅ Zatwierdź
                          </button>
                          <button
                            onClick={() => handleRejectProposal(proposal._id)}
                            className="reject-btn"
                          >
                            ❌ Odrzuć
                          </button>
                          <button
                            onClick={() => handleDeleteProposal(proposal._id)}
                            className="delete-btn"
                          >
                            🗑️ Usuń
                          </button>
                        </div>
                      )}

                      {proposal.status !== 'pending' && (
                        <div className="proposal-actions">
                          <button
                            onClick={() => handleDeleteProposal(proposal._id)}
                            className="delete-btn"
                          >
                            🗑️ Usuń
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-proposals">
                  <p>Brak propozycji fighterów do wyświetlenia.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="posts-section">
            <h3>📝 Wszystkie Posty</h3>
            <div className="posts-list">
              {posts.map(post => (
                <div key={post.id} className="post-card">
                  <div className="post-header">
                    <div className="post-info">
                      <h4>{post.title}</h4>
                      <p className="post-meta">
                        Autor: {post.author?.username || 'Nieznany'} • 
                        {formatDate(post.createdAt)} • 
                        Typ: {post.type}
                      </p>
                    </div>
                    <div className="post-stats">
                      <span>👍 {post.likes?.length || 0}</span>
                      <span>💬 {post.comments?.length || 0}</span>
                    </div>
                  </div>
                  <div className="post-content">
                    <p>{post.content.substring(0, 150)}...</p>
                  </div>
                  <div className="post-actions">
                    <button 
                      onClick={() => handleFeaturePost(post.id, post.featured)}
                      className="feature-btn"
                    >
                      {post.featured ? '⭐ Usuń wyróżnienie' : '⭐ Wyróżnij'}
                    </button>
                    <button 
                      onClick={() => handleDeletePost(post.id)}
                      className="delete-btn"
                    >
                      🗑️ Usuń
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-section">
            <h3>👥 Zarządzanie Użytkownikami</h3>
            <div className="users-grid">
              {users.map(user => (
                <div key={user.id} className="user-card">
                  <img 
                    src={placeholderImages.userSmall} 
                    alt={user.username}
                    className="user-avatar"
                  />
                  <div className="user-info">
                    <h4>{user.username}</h4>
                    <p>ID: {user.id}</p>
                  </div>
                  <div className="user-actions">
                    <button className="view-btn">👁️ Zobacz profil</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'betting' && (
          <div className="betting-section">
            <h3>💰 Zarządzanie Zakładami</h3>
            
            <div className="betting-stats">
              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <div className="stat-info">
                  <h4>{bets.length}</h4>
                  <p>Wszystkich Zakładów</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏳</div>
                <div className="stat-info">
                  <h4>{bets.filter(bet => bet.status === 'pending').length}</h4>
                  <p>Oczekujących</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <h4>{bets.filter(bet => bet.status === 'won').length}</h4>
                  <p>Wygranych</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">❌</div>
                <div className="stat-info">
                  <h4>{bets.filter(bet => bet.status === 'lost').length}</h4>
                  <p>Przegranych</p>
                </div>
              </div>
            </div>

            <div className="bets-list">
              <h4>🎲 Wszystkie Zakłady</h4>
              {bets.length > 0 ? (
                <div className="bets-grid">
                  {bets.map(bet => (
                    <div key={bet._id} className="bet-card">
                      <div className="bet-header">
                        <div className="bet-info">
                          <h5>{bet.type === 'single' ? '🎯 Pojedynczy' : '🎰 Parlay'}</h5>
                          <span className={`bet-status status-${bet.status}`}>
                            {bet.status === 'pending' && '⏳ Oczekujący'}
                            {bet.status === 'won' && '✅ Wygrany'}
                            {bet.status === 'lost' && '❌ Przegrany'}
                            {bet.status === 'refunded' && '🔄 Zwrócony'}
                          </span>
                        </div>
                        <div className="bet-amounts">
                          <div className="bet-amount">Stawka: {formatCurrency(bet.amount)}</div>
                          <div className="potential-winnings">
                            Potencjalna wygrana: {formatCurrency(bet.potentialWinnings)}
                          </div>
                        </div>
                      </div>

                      <div className="bet-details">
                        <div className="bet-user">
                          <strong>Użytkownik:</strong> {bet.userId?.username || bet.userId}
                        </div>
                        <div className="bet-date">
                          <strong>Data:</strong> {formatDate(bet.createdAt)}
                        </div>
                        
                        {bet.type === 'single' ? (
                          <div className="single-bet-details">
                            <div className="fight-info">
                              <strong>Walka:</strong> {bet.fightId?.title || 'Nieznana walka'}
                            </div>
                            <div className="selected-team">
                              <strong>Wybrana drużyna:</strong> {bet.selectedTeam}
                            </div>
                            <div className="odds">
                              <strong>Kursy:</strong> {bet.odds}
                            </div>
                          </div>
                        ) : (
                          <div className="parlay-bet-details">
                            <div className="parlay-fights">
                              <strong>Walki w parlay:</strong>
                              {bet.fights?.map((fight, index) => (
                                <div key={index} className="parlay-fight">
                                  • {fight.fightTitle} - {fight.selectedTeam} ({fight.odds})
                                </div>
                              ))}
                            </div>
                            <div className="total-odds">
                              <strong>Łączne kursy:</strong> {bet.totalOdds}
                            </div>
                          </div>
                        )}

                        {bet.insurance && (
                          <div className="insurance-info">
                            <span className="insurance-badge">🛡️ Ubezpieczony</span>
                          </div>
                        )}
                      </div>

                      {bet.status === 'pending' && (
                        <div className="bet-actions">
                          <button
                            onClick={() => handleSettleBet(bet._id, 'won')}
                            className="settle-btn win-btn"
                          >
                            ✅ Oznacz jako wygrany
                          </button>
                          <button
                            onClick={() => handleSettleBet(bet._id, 'lost')}
                            className="settle-btn lose-btn"
                          >
                            ❌ Oznacz jako przegrany
                          </button>
                          <button
                            onClick={() => handleRefundBet(bet._id)}
                            className="refund-btn"
                          >
                            🔄 Zwróć zakład
                          </button>
                        </div>
                      )}

                      {bet.status === 'won' && bet.actualWinnings && (
                        <div className="actual-winnings">
                          <strong>Rzeczywista wygrana:</strong> {formatCurrency(bet.actualWinnings)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-bets">
                  <p>Brak zakładów do wyświetlenia.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="stats-section">
            <h3>📊 Statystyki Platformy</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <h4>{users.length}</h4>
                  <p>Użytkowników</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📝</div>
                <div className="stat-info">
                  <h4>{posts.length}</h4>
                  <p>Postów</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⚔️</div>
                <div className="stat-info">
                  <h4>{posts.filter(p => p.type === 'fight').length}</h4>
                  <p>Walk</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎮</div>
                <div className="stat-info">
                  <h4>{characters.length}</h4>
                  <p>Postaci</p>
                </div>
              </div>
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
    </div>
  );
};

export default ModeratorPanel;