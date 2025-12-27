import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { placeholderImages, getOptimizedImageProps } from '../utils/placeholderImage';
import './FightDetailPage.css';

const FightDetailPage = () => {
  const { fightId } = useParams();
  const [fight, setFight] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [userVote, setUserVote] = useState(null);
  const [voteStats, setVoteStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFight();
    fetchComments();
    fetchUserVote();
    fetchUserData();
  }, [fightId]);

  const fetchFight = async () => {
    try {
      const response = await axios.get(`/api/fights/${fightId}`);
      setFight(response.data);
      setVoteStats(response.data.votes);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching fight:', error);
      setError('Nie można załadować walki');
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/comments/fight/${fightId}`);
      const payload = response.data;
      setComments(payload?.comments || payload || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchUserVote = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await axios.get(`/api/votes/fight/${fightId}/user`, {
        headers: { 'x-auth-token': token }
      });
      setUserVote(response.data.choice);
    } catch (error) {
      // User hasn't voted yet
      setUserVote(null);
    }
  };

  const fetchUserData = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await axios.get('/api/profile/me', {
        headers: { 'x-auth-token': token }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleVote = async (choice) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Musisz być zalogowany, aby głosować');
      navigate('/login');
      return;
    }

    if (fight.status !== 'active') {
      alert('Nie można głosować na zakończoną walkę');
      return;
    }

    try {
      await axios.post('/api/votes', {
        fightId: fight.id,
        choice
      }, {
        headers: { 'x-auth-token': token }
      });

      setUserVote(choice);
      fetchFight(); // Refresh fight data to get updated vote counts
    } catch (error) {
      console.error('Error voting:', error);
      alert('Błąd podczas głosowania');
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Musisz być zalogowany, aby komentować');
      navigate('/login');
      return;
    }

    if (!newComment.trim()) return;

    try {
      await axios.post(`/api/comments/fight/${fightId}`, {
        text: newComment
      }, {
        headers: { 'x-auth-token': token }
      });

      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Błąd podczas dodawania komentarza');
    }
  };

  const handleCommentLike = async (commentId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Musisz być zalogowany, aby polubić komentarz');
      return;
    }

    try {
      await axios.post(`/api/comments/${commentId}/like`, {}, {
        headers: { 'x-auth-token': token }
      });
      fetchComments();
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const getTimeRemaining = () => {
    if (!fight.endDate) return 'Brak limitu';
    
    const now = new Date();
    const endDate = new Date(fight.endDate);
    const timeDiff = endDate - now;

    if (timeDiff <= 0) return 'Zakończona';

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return <div className="fight-detail-page loading">Ładowanie walki...</div>;
  }

  if (error) {
    return (
      <div className="fight-detail-page error">
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="btn btn-primary">
          Wróć
        </button>
      </div>
    );
  }

  if (!fight) {
    return (
      <div className="fight-detail-page error">
        <p>Walka nie znaleziona</p>
        <button onClick={() => navigate(-1)} className="btn btn-primary">
          Wróć
        </button>
      </div>
    );
  }

  return (
    <div className="fight-detail-page">
      {/* Fight Header */}
      <div className="fight-header">
        <div className="fight-meta">
          <span className={`fight-type ${fight.type}`}>
            {fight.type === 'main' ? '🏆 Główna walka' : '🔥 Feed społeczności'}
          </span>
          <span className="fight-category">{fight.category}</span>
          <span className={`fight-status ${fight.status}`}>
            {fight.status === 'active' ? `⏰ ${getTimeRemaining()}` : '✅ Zakończona'}
          </span>
        </div>
        
        <h1>{fight.title}</h1>
        
        {fight.description && (
          <p className="fight-description">{fight.description}</p>
        )}

        <div className="fight-creator">
          Utworzona przez: <Link to={`/profile/${fight.createdBy}`}>{fight.createdByUsername}</Link>
          <span className="creation-date">
            {new Date(fight.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Fighters Section */}
      <div className="fighters-section">
        <div className="fighter fighter1">
          <div className="fighter-image">
            <img {...getOptimizedImageProps(fight.fighter1Image, { size: 200 })} alt={fight.fighter1} />
            {userVote === 'fighter1' && <div className="vote-indicator">✓ Zagłosowano</div>}
          </div>
          <h2>{fight.fighter1}</h2>
          <div className="vote-stats">
            <div className="vote-count">{voteStats.fighter1 || 0} głosów</div>
            <div className="vote-percentage">
              {voteStats.total > 0 ? 
                ((voteStats.fighter1 / voteStats.total) * 100).toFixed(1) : 0}%
            </div>
          </div>
          {fight.status === 'active' && (
            <button
              className={`vote-btn ${userVote === 'fighter1' ? 'voted' : ''}`}
              onClick={() => handleVote('fighter1')}
            >
              {userVote === 'fighter1' ? 'Zagłosowano' : 'Głosuj'}
            </button>
          )}
        </div>

        <div className="vs-section">
          <div className="vs-text">VS</div>
          <div className="total-votes">{voteStats.total || 0} głosów</div>
          
          {/* Vote Progress Bar */}
          {voteStats.total > 0 && (
            <div className="vote-progress">
              <div 
                className="progress-bar fighter1-bar"
                style={{ 
                  width: `${((voteStats.fighter1 || 0) / voteStats.total) * 100}%` 
                }}
              ></div>
              <div 
                className="progress-bar fighter2-bar"
                style={{ 
                  width: `${((voteStats.fighter2 || 0) / voteStats.total) * 100}%` 
                }}
              ></div>
            </div>
          )}
        </div>

        <div className="fighter fighter2">
          <div className="fighter-image">
            <img {...getOptimizedImageProps(fight.fighter2Image, { size: 200 })} alt={fight.fighter2} />
            {userVote === 'fighter2' && <div className="vote-indicator">✓ Zagłosowano</div>}
          </div>
          <h2>{fight.fighter2}</h2>
          <div className="vote-stats">
            <div className="vote-count">{voteStats.fighter2 || 0} głosów</div>
            <div className="vote-percentage">
              {voteStats.total > 0 ? 
                ((voteStats.fighter2 / voteStats.total) * 100).toFixed(1) : 0}%
            </div>
          </div>
          {fight.status === 'active' && (
            <button
              className={`vote-btn ${userVote === 'fighter2' ? 'voted' : ''}`}
              onClick={() => handleVote('fighter2')}
            >
              {userVote === 'fighter2' ? 'Zagłosowano' : 'Głosuj'}
            </button>
          )}
        </div>
      </div>

      {/* Winner Display */}
      {fight.status === 'ended' && fight.winner && (
        <div className="winner-section">
          {fight.winner === 'draw' ? (
            <div className="result-draw">🤝 Walka zakończona remisem!</div>
          ) : (
            <div className="result-winner">
              🏆 Zwycięzca: {fight.winner === 'fighter1' ? fight.fighter1 : fight.fighter2}
            </div>
          )}
        </div>
      )}

      {/* Comments Section */}
      <div className="comments-section">
        <h3>Komentarze ({comments.length})</h3>
        
        {user && (
          <form onSubmit={handleCommentSubmit} className="comment-form">
            <div className="comment-input">
              <img 
                {...getOptimizedImageProps(
                  user.profilePicture || placeholderImages.userSmall,
                  { size: 50 }
                )}
                alt="Your avatar" 
                className="comment-avatar"
              />
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Dodaj komentarz do tej walki..."
                rows="3"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!newComment.trim()}>
              Dodaj komentarz
            </button>
          </form>
        )}

        <div className="comments-list">
          {comments.length > 0 ? (
            comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <div className="comment-header">
                  <img 
                    {...getOptimizedImageProps(placeholderImages.userSmall, { size: 50 })}
                    alt={comment.authorUsername} 
                    className="comment-avatar"
                  />
                  <div className="comment-meta">
                    <Link to={`/profile/${comment.authorId}`} className="comment-author">
                      {comment.authorUsername}
                    </Link>
                    <span className="comment-date">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="comment-content">
                  {comment.text}
                </div>
                <div className="comment-actions">
                  <button 
                    className={`like-btn ${comment.likedBy?.includes(user?.id) ? 'liked' : ''}`}
                    onClick={() => handleCommentLike(comment.id)}
                  >
                    👍 {comment.likes || 0}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="no-comments">
              <p>Brak komentarzy. Bądź pierwszy!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FightDetailPage;
