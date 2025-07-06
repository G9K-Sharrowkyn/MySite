import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { replacePlaceholderUrl, placeholderImages } from './utils/placeholderImage';
import ImageUpload from './components/ImageUpload/ImageUpload';
import PostCard from './components/Feed/PostCard';
import './ProfilePage.css';

const ProfilePage = () => {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [posts, setPosts] = useState([]);
  const navigate = useNavigate();

  const currentUserId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  const actualUserId = userId === 'me' ? currentUserId : userId;

  useEffect(() => {
    if (!actualUserId) {
      setError('Nie można znaleźć Twojego profilu. Zaloguj się ponownie.');
      setLoading(false);
      return;
    }
    fetchProfile(actualUserId);
    fetchComments(actualUserId);
    fetchUserPosts(actualUserId);
  }, [actualUserId]);

  const fetchProfile = async (id) => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (userId === 'me') {
        // Use the authenticated /api/profile/me endpoint
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Nie można znaleźć Twojego profilu. Zaloguj się ponownie.');
          setLoading(false);
          return;
        }
        res = await axios.get('/api/profile/me', {
          headers: {
            'x-auth-token': token,
          },
        });
      } else {
        // Use the public /api/profile/:userId endpoint
        res = await axios.get(`/api/profile/${id}`);
      }
      setProfile(res.data);
      setDescription(res.data.description || '');
      setProfilePicture(res.data.profilePicture || '');
      setLoading(false);
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError('Błąd podczas pobierania profilu lub profil nie istnieje.');
      setLoading(false);
    }
  };

  const fetchComments = async (id) => {
    try {
      const res = await axios.get(`/api/comments/user/${id}`);
      setComments(res.data);
    } catch (err) {
      console.error('Błąd podczas pobierania komentarzy:', err);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Musisz być zalogowany, aby dodać komentarz.');
      return;
    }
    try {
      await axios.post(`/api/comments/user/${actualUserId}`, 
        { 
          text: newComment,
          userId: actualUserId
        }, 
        {
          headers: {
            'x-auth-token': token,
          },
        }
      );
      setNewComment('');
      await fetchComments(actualUserId);
    } catch (err) {
      console.error('Błąd podczas dodawania komentarza:', err.response?.data);
    }
  };

  const handleCommentDelete = async (commentId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await axios.delete(`/api/comments/${commentId}`, {
        headers: {
          'x-auth-token': token,
        },
      });
      await fetchComments(actualUserId);
    } catch (err) {
      console.error('Błąd podczas usuwania komentarza:', err.response?.data);
    }
  };

  const fetchUserPosts = async (id) => {
    try {
      const response = await axios.get(`/api/posts/user/${id}`);
      const postsWithImages = response.data.map(post => ({
        ...post,
        author: {
          ...post.author,
          profilePicture: replacePlaceholderUrl(post.author?.profilePicture)
        }
      }));
      setPosts(postsWithImages);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Musisz być zalogowany, aby edytować profil.');
      return;
    }
    try {
      await axios.put('/api/profile/me', { description, profilePicture }, {
        headers: {
          'x-auth-token': token,
        },
      });
      setIsEditing(false);
      fetchProfile(currentUserId);
    } catch (err) {
      console.error('Błąd podczas aktualizacji profilu:', err.response?.data);
    }
  };

  if (loading) return <div className="profile-page"><p>Ładowanie profilu...</p></div>;
  if (error) return <div className="profile-page"><p style={{color: 'red'}}>{error}</p><button onClick={() => navigate('/login')}>Zaloguj się ponownie</button></div>;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <img src={replacePlaceholderUrl(profile.profilePicture) || placeholderImages.user} alt="Profilowe" className="profile-picture" />
        <div className="profile-info">
          <h2>{profile.username}</h2>
          <p className="profile-rank">Punkty: {profile.points || 0} | Ranga: {profile.rank}</p>
          <div className="fight-stats">
            <div className="stat-item">
              <span className="stat-label">Zwycięstwa:</span>
              <span className="stat-value">{profile.stats?.fightsWon || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Porażki:</span>
              <span className="stat-value">{profile.stats?.fightsLost || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Remisy:</span>
              <span className="stat-value">{profile.stats?.fightsDrawn || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Procent wygranych:</span>
              <span className="stat-value">{profile.stats?.winRate || 0}%</span>
            </div>
          </div>
          <div className="profile-actions">
            {userId === 'me' && (
              <button onClick={() => setIsEditing(!isEditing)} className="edit-profile-btn">
                {isEditing ? 'Anuluj edycję' : 'Edytuj profil'}
              </button>
            )}
            {userId !== 'me' && (
              <Link 
                to={`/messages?to=${actualUserId}&username=${profile.username}`} 
                className="send-message-btn"
              >
                Wyślij wiadomość
              </Link>
            )}
          </div>
        </div>
      </div>

      {isEditing && userId === 'me' ? (
        <form onSubmit={handleProfileUpdate} className="edit-profile-form">
          <div className="form-group">
            <label>Zdjęcie profilowe:</label>
            <ImageUpload 
              currentImage={profilePicture}
              onImageChange={setProfilePicture}
              className="profile-picture"
            />
          </div>
          <div className="form-group">
            <label>Opis:</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
          </div>
          <button type="submit" className="btn-primary">Zapisz zmiany</button>
        </form>
      ) : (
        <div className="profile-details">
          <h3>Opis:</h3>
          <p>{profile.description || 'Brak opisu.'}</p>
        </div>
      )}

      <div className="profile-posts">
        <h3>Posty:</h3>
        <div className="posts-grid">
          {posts.length > 0 ? (
            posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post}
                onUpdate={(updatedPost) => {
                  setPosts(prevPosts => 
                    prevPosts.map(p => p.id === updatedPost.id ? updatedPost : p)
                  );
                }}
                showEditDelete={userId === 'me' || profile.role === 'moderator'}
                onDelete={async (postId) => {
                  if (!token) return;
                  try {
                    await axios.delete(`/api/posts/${postId}`, {
                      headers: { 'x-auth-token': token }
                    });
                    setPosts(prevPosts => prevPosts.filter(p => p.id !== postId));
                  } catch (error) {
                    console.error('Error deleting post:', error);
                  }
                }}
              />
            ))
          ) : (
            <p>Brak postów.</p>
          )}
        </div>
      </div>

      <div className="profile-divisions">
        <h3>Drużyny w dywizjach:</h3>
        {profile.divisions && Object.keys(profile.divisions).length > 0 ? (
          <div className="divisions-grid">
            {Object.entries(profile.divisions).map(([divisionId, division]) => (
              <div key={divisionId} className="division-card">
                <h4>{division.divisionName}</h4>
                {division.selectedCharacter && (
                  <div className="division-character">
                    <img 
                      src={replacePlaceholderUrl(division.selectedCharacter.image) || placeholderImages.character} 
                      alt={division.selectedCharacter.name} 
                      className="character-image" 
                    />
                    <p className="character-name">{division.selectedCharacter.name}</p>
                    <p className="character-stats">
                      Wins: {division.wins || 0} | Losses: {division.losses || 0}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>
            Brak wybranych drużyn. 
            {userId === 'me' ? <Link to="/divisions">Dołącz do dywizji</Link> : ''}
          </p>
        )}
      </div>

      <div className="profile-fights">
        <h3>Historia walk:</h3>
        {profile.fights && profile.fights.length > 0 ? (
          <div className="fights-list">
            {profile.fights.slice(0, 10).map(fight => (
              <div key={fight.id} className="fight-item">
                <div className="fight-participants">
                  <span className={fight.winnerId === profile.id ? 'winner' : 'participant'}>
                    {fight.fighter1 || 'Nieznany'}
                  </span>
                  <span className="vs">vs</span>
                  <span className={fight.winnerId === profile.id ? 'winner' : 'participant'}>
                    {fight.fighter2 || 'Nieznany'}
                  </span>
                </div>
                <div className="fight-result">
                  {fight.winnerId === profile.id ? '🏆 Zwycięstwo' : 
                   fight.winner === 'draw' ? '🤝 Remis' : '❌ Porażka'}
                </div>
                <div className="fight-date">
                  {new Date(fight.createdAt || fight.date).toLocaleDateString()}
                </div>
              </div>
            ))}
            {profile.fights.length > 10 && (
              <p className="more-fights">... i {profile.fights.length - 10} więcej walk</p>
            )}
          </div>
        ) : (
          <p>Brak historii walk.</p>
        )}
      </div>

      <div className="comments-section">
        <h3>Komentarze:</h3>
        {userId !== 'me' && (
          <form onSubmit={handleCommentSubmit} className="add-comment-form">
            <textarea
              placeholder="Dodaj komentarz..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              required
              maxLength={500}
            ></textarea>
            <div className="comment-controls">
              <span className="char-count">{newComment.length}/500</span>
              <button type="submit" className="btn-primary" disabled={!newComment.trim()}>
                Dodaj komentarz
              </button>
            </div>
          </form>
        )}
        <div className="comments-list">
          {comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id} className="comment-item">
                <div className="comment-header">
                  <div className="comment-author">
                    <Link to={`/profile/${comment.authorId}`}>
                      <img 
                        src={replacePlaceholderUrl(comment.authorAvatar) || placeholderImages.userSmall} 
                        alt={comment.authorUsername} 
                        className="author-avatar"
                      />
                      <strong>{comment.authorUsername}</strong>
                    </Link>
                  </div>
                  <span className="comment-date">
                    {new Date(comment.timestamp).toLocaleString()}
                  </span>
                  {(currentUserId === comment.authorId || profile.role === 'moderator') && (
                    <button 
                      onClick={() => handleCommentDelete(comment.id)}
                      className="delete-comment-btn"
                      title="Usuń komentarz"
                    >
                      🗑️
                    </button>
                  )}
                </div>
                <p className="comment-text">{comment.text}</p>
              </div>
            ))
          ) : (
            <p>Brak komentarzy.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;