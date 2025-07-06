import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { replacePlaceholderUrl, placeholderImages } from '../../utils/placeholderImage';
import './PostCard.css';

const PostCard = ({ post, onUpdate }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [userVote, setUserVote] = useState(null);

  const currentUserId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');

  useEffect(() => {
    // Check if current user liked this post
    if (post.likes && currentUserId) {
      setIsLiked(post.likes.some(like => like.userId === currentUserId));
    }
    
    // Check if user voted in fight
    if (post.type === 'fight' && post.fight?.votes?.voters && currentUserId) {
      const vote = post.fight.votes.voters.find(v => v.userId === currentUserId);
      setUserVote(vote?.team || null);
    }
  }, [post, currentUserId]);

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/comments/post/${post.id}`);
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleLike = async () => {
    if (!token) return;
    
    try {
      const response = await axios.post(`/api/posts/${post.id}/like`, {}, {
        headers: { 'x-auth-token': token }
      });
      
      setIsLiked(response.data.isLiked);
      setLikesCount(response.data.likesCount);
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleVote = async (team) => {
    if (!token || userVote) return;
    
    try {
      await axios.post(`/api/votes/fight/${post.id}`, { team }, {
        headers: { 'x-auth-token': token }
      });
      
      setUserVote(team);
      // Refresh post data
      if (onUpdate) {
        const updatedPost = await axios.get(`/api/posts/${post.id}`);
        onUpdate(updatedPost.data);
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!token || !newComment.trim()) return;
    
    try {
      await axios.post(`/api/comments/post/${post.id}`, 
        { text: newComment }, 
        { headers: { 'x-auth-token': token } }
      );
      
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const toggleComments = () => {
    setShowComments(!showComments);
    if (!showComments && comments.length === 0) {
      fetchComments();
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffInMinutes = Math.floor((now - postDate) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Teraz';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const getPostTypeIcon = (type) => {
    switch (type) {
      case 'fight': return '⚔️';
      case 'image': return '🖼️';
      case 'poll': return '📊';
      default: return '💬';
    }
  };

  const getRankColor = (rank) => {
    const rankColors = {
      'Rookie': '#8B4513',
      'Novice': '#CD853F',
      'Fighter': '#32CD32',
      'Warrior': '#1E90FF',
      'Champion': '#9932CC',
      'Master': '#FF4500',
      'Grandmaster': '#DC143C',
      'Legend': '#FFD700',
      'Mythic': '#FF1493'
    };
    return rankColors[rank] || '#666';
  };

  return (
    <div className="post-card">
      <div className="post-header">
        <div className="author-info">
          <Link to={`/profile/${post.author?.id}`} className="author-link">
            <img 
              src={post.author?.profilePicture || placeholderImages.userSmall} 
              alt={post.author?.username}
              className="author-avatar"
            />
            <div className="author-details">
              <span className="author-name">{post.author?.username || 'Anonim'}</span>
              <span 
                className="author-rank"
                style={{ color: getRankColor(post.author?.rank) }}
              >
                {post.author?.rank || 'Rookie'}
              </span>
            </div>
          </Link>
        </div>
        <div className="post-meta">
          <span className="post-type">{getPostTypeIcon(post.type)}</span>
          <span className="post-time">{formatTimeAgo(post.createdAt)}</span>
        </div>
      </div>

      <div className="post-content" style={{ cursor: 'pointer' }}>
        <Link to={`/post/${post.id}`} className="post-title-link">
          <h3 className="post-title">{post.title}</h3>
        </Link>
        <p className="post-text">{post.content}</p>
        
        {post.image && (
          <Link to={`/post/${post.id}`} className="post-image-link">
            <div className="post-image">
              <img src={replacePlaceholderUrl(post.image)} alt="Post content" />
            </div>
          </Link>
        )}
        
        {post.type === 'fight' && post.fight && (
          <div className="fight-section">
            <div className="fight-teams">
              <button 
                className={`team-btn team-a ${userVote === 'A' ? 'voted' : ''}`}
                onClick={() => handleVote('A')}
                disabled={!!userVote}
              >
                <span className="team-name">{post.fight.teamA}</span>
                <span className="vote-count">{post.fight.votes?.teamA || 0}</span>
              </button>
              
              <div className="vs-divider">VS</div>
              
              <button 
                className={`team-btn team-b ${userVote === 'B' ? 'voted' : ''}`}
                onClick={() => handleVote('B')}
                disabled={!!userVote}
              >
                <span className="team-name">{post.fight.teamB}</span>
                <span className="vote-count">{post.fight.votes?.teamB || 0}</span>
              </button>
            </div>
            
            {userVote && (
              <div className="vote-status">
                ✅ Zagłosowałeś na: <strong>{userVote === 'A' ? post.fight.teamA : post.fight.teamB}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="post-actions" onClick={e => e.stopPropagation()}>
        <button 
          className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          <span className="action-icon">{isLiked ? '❤️' : '🤍'}</span>
          <span className="action-text">{likesCount}</span>
        </button>
        
        <button 
          className="action-btn comment-btn"
          onClick={toggleComments}
        >
          <span className="action-icon">💬</span>
          <span className="action-text">{comments.length}</span>
        </button>
        
        <button className="action-btn share-btn">
          <span className="action-icon">📤</span>
          <span className="action-text">Udostępnij</span>
        </button>
      </div>

      {showComments && (
        <div className="comments-section" onClick={e => e.stopPropagation()}>
          {token && (
            <form onSubmit={handleCommentSubmit} className="comment-form">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Napisz komentarz..."
                className="comment-input"
              />
              <button type="submit" className="comment-submit">
                📤
              </button>
            </form>
          )}
          
          <div className="comments-list">
            {comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <Link to={`/profile/${comment.authorId}`} className="comment-author">
                  <img 
                    src={placeholderImages.userSmall} 
                    alt={comment.authorUsername}
                    className="comment-avatar"
                  />
                  <strong>{comment.authorUsername}</strong>
                </Link>
                <p className="comment-text">{comment.text}</p>
                <span className="comment-time">
                  {formatTimeAgo(comment.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;