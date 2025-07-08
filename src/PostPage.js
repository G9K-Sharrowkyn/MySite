import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { replacePlaceholderUrl, placeholderImages } from './utils/placeholderImage';
import './PostPage.css';

const PostPage = () => {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [userVote, setUserVote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentUserId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [postId]);

  const fetchPost = async () => {
    try {
      const response = await axios.get(`/api/posts/${postId}`);
      const postData = {
        ...response.data,
        author: {
          ...response.data.author,
          profilePicture: replacePlaceholderUrl(response.data.author?.profilePicture)
        }
      };
      setPost(postData);
      setLikesCount(postData.likes?.length || 0);
      setIsLiked(postData.likes?.some(like => like.userId === currentUserId));
      
      if (postData.type === 'fight' && postData.fight?.votes?.voters && currentUserId) {
        const vote = postData.fight.votes.voters.find(v => v.userId === currentUserId);
        setUserVote(vote?.team || null);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching post:', error);
      setError('Post not found or error loading post.');
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/comments/post/${postId}`);
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleLike = async () => {
    if (!token) return;
    
    try {
      const response = await axios.post(`/api/posts/${postId}/like`, {}, {
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
      await axios.post(`/api/posts/${postId}/fight-vote`, { team }, {
        headers: { 'x-auth-token': token }
      });
      
      setUserVote(team);
      fetchPost(); // Refresh post data to update vote counts
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!token || !newComment.trim()) return;
    
    try {
      await axios.post(`/api/comments/post/${postId}`, 
        { text: newComment }, 
        { headers: { 'x-auth-token': token } }
      );
      
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffInMinutes = Math.floor((now - postDate) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
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

  if (loading) return <div className="post-page loading">Loading...</div>;
  if (error) return <div className="post-page error">{error}</div>;
  if (!post) return <div className="post-page not-found">Post not found</div>;

  return (
    <div className="post-page">
      <div className="post-container">
        <div className="post-header">
          <div className="author-info">
            <Link to={`/profile/${post.author?.id}`} className="author-link">
              <img 
                src={post.author?.profilePicture || placeholderImages.userSmall} 
                alt={post.author?.username}
                className="author-avatar"
              />
              <div className="author-details">
                <span className="author-name">{post.author?.username || 'Anonymous'}</span>
                <span className="author-rank">{post.author?.rank || 'Rookie'}</span>
              </div>
            </Link>
          </div>
          <div className="post-meta">
            <span className="post-type">{getPostTypeIcon(post.type)}</span>
            <span className="post-time">{formatTimeAgo(post.createdAt)}</span>
          </div>
        </div>

        <div className="post-content">
          <h1 className="post-title">{post.title}</h1>
          <p className="post-text">{post.content}</p>
          
          {post.image && (
            <div className="post-image">
              <img src={replacePlaceholderUrl(post.image)} alt="Post content" />
            </div>
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
                  ✅ You voted for: <strong>{userVote === 'A' ? post.fight.teamA : post.fight.teamB}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="post-actions">
          <button 
            className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <span className="action-icon">{isLiked ? '❤️' : '🤍'}</span>
            <span className="action-text">{likesCount}</span>
          </button>
          
          <button className="action-btn share-btn">
            <span className="action-icon">📤</span>
            <span className="action-text">Share</span>
          </button>
        </div>

        <div className="comments-section">
          <h3>Comments ({comments.length})</h3>
          
          {token && (
            <form onSubmit={handleCommentSubmit} className="comment-form">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="comment-input"
              />
              <button type="submit" className="comment-submit" disabled={!newComment.trim()}>
                Post
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
            
            {comments.length === 0 && (
              <div className="no-comments">
                No comments yet. Be the first to comment!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostPage;
