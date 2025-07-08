import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { replacePlaceholderUrl, placeholderImages } from './utils/placeholderImage';
import CharacterSelector from './components/Feed/CharacterSelector';
import Modal from './components/Modal/Modal';
import './ModeratorPanel.css';

const ModeratorPanel = () => {
  const [activeTab, setActiveTab] = useState('fights');
  const [fights, setFights] = useState([]);
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [characters, setCharacters] = useState([]);
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
      const [fightsRes, postsRes, usersRes, charactersRes] = await Promise.all([
        axios.get('/api/posts/official'),
        axios.get('/api/posts'),
        axios.get('/api/profile/all'),
        axios.get('/api/characters')
      ]);

      setFights(fightsRes.data.fights || fightsRes.data);
      setPosts(postsRes.data.posts || postsRes.data);
      setUsers(usersRes.data);
      setCharacters(charactersRes.data);
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pl-PL');
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