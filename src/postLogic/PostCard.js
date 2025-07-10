import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import { replacePlaceholderUrl } from '../utils/placeholderImage';
import ReactionMenu from './ReactionMenu';
import './PostCard.css';

const PostCard = ({ post, user, onUpdate }) => {
  const { t } = useLanguage();
  const [comments, setComments] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount || 0);
  const [userVote, setUserVote] = useState(null);
  const [showReactions, setShowReactions] = useState(false);

  useEffect(() => {
    if (user && post.likes) {
      setLiked(post.likes.includes(user._id || user.id));
    }
  }, [post.likes, user]);

  const handleLike = async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/posts/${post._id || post.id}/like`, {}, {
        headers: { 'x-auth-token': token }
      });
      
      setLiked(!liked);
      setLikesCount(response.data.likes);
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleVote = async (team) => {
    if (!user || userVote) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/posts/${post._id || post.id}/fight-vote`, { team }, {
        headers: { 'x-auth-token': token }
      });
      
      setUserVote(team);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handlePollVote = async (optionIndex) => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/posts/${post._id || post.id}/poll-vote`, {
        optionIndex
      }, {
        headers: { 'x-auth-token': token }
      });
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error voting in poll:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/comments/post/${post._id || post.id}`);
      setComments(response.data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/comments/post/${post._id || post.id}`,
        { text: newComment },
        { headers: { 'x-auth-token': token } }
      );
      
      setNewComment('');
      setCommentsCount(prev => prev + 1);
      if (showComments) {
        fetchComments();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const toggleComments = () => {
    setShowComments(!showComments);
    if (!showComments) {
      fetchComments();
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="post-card">
      <div className="post-header">
        <div className="post-author">
          <img 
            src={replacePlaceholderUrl(post.author?.avatar || post.author?.profilePicture)} 
            alt={post.author?.username}
            className="author-avatar"
          />
          <div className="author-info">
            <Link to={`/profile/${post.author?._id || post.author?.id}`} className="author-name">
              {post.author?.username}
            </Link>
            <span className="post-time">{formatTimeAgo(post.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="post-content">
        <p>{post.content}</p>
        
        {post.fight && (
          <div className="fight-section">
            <div className="fight-teams">
              <div className="team">
                <h4>Team A</h4>
                {post.fight.teamA?.map(fighter => (
                  <div key={fighter._id || fighter.id} className="fighter">
                    <img src={replacePlaceholderUrl(fighter.image)} alt={fighter.name} />
                    <span>{fighter.name}</span>
                  </div>
                ))}
                <div className="vote-section">
                  <button 
                    className={`vote-btn ${userVote === 'A' ? 'voted' : ''}`}
                    onClick={() => handleVote('A')}
                    disabled={!user || userVote}
                  >
                    Vote ({post.fight.votesA || 0})
                  </button>
                </div>
              </div>

              <div className="vs-divider">VS</div>

              <div className="team">
                <h4>Team B</h4>
                {post.fight.teamB?.map(fighter => (
                  <div key={fighter._id || fighter.id} className="fighter">
                    <img src={replacePlaceholderUrl(fighter.image)} alt={fighter.name} />
                    <span>{fighter.name}</span>
                  </div>
                ))}
                <div className="vote-section">
                  <button 
                    className={`vote-btn ${userVote === 'B' ? 'voted' : ''}`}
                    onClick={() => handleVote('B')}
                    disabled={!user || userVote}
                  >
                    Vote ({post.fight.votesB || 0})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {post.poll && (
          <div className="poll-section">
            <h4>{post.poll.question}</h4>
            <div className="poll-options">
              {post.poll.options.map((option, index) => (
                <button
                  key={index}
                  className="poll-option"
                  onClick={() => handlePollVote(index)}
                  disabled={!user}
                >
                  <span>{option.text}</span>
                  <span className="vote-count">({option.votes || 0})</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="post-actions">
        <button 
          className={`action-btn ${liked ? 'liked' : ''}`}
          onClick={handleLike}
          disabled={!user}
        >
          ❤️ {likesCount}
        </button>
        
        <button className="action-btn" onClick={toggleComments}>
          💬 {commentsCount}
        </button>
        
        <button 
          className="action-btn"
          onClick={() => setShowReactions(!showReactions)}
        >
          😊 React
        </button>
      </div>

      {showReactions && (
        <ReactionMenu 
          postId={post._id || post.id}
          onClose={() => setShowReactions(false)}
        />
      )}

      {showComments && (
        <div className="comments-section">
          <div className="comments-list">
            {comments.map(comment => (
              <div key={comment._id || comment.id} className="comment">
                <img 
                  src={replacePlaceholderUrl(comment.author?.avatar)} 
                  alt={comment.author?.username}
                  className="comment-avatar"
                />
                <div className="comment-content">
                  <div className="comment-header">
                    <span className="comment-author">{comment.author?.username}</span>
                    <span className="comment-time">{formatTimeAgo(comment.createdAt)}</span>
                  </div>
                  <p className="comment-text">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>

          {user && (
            <form className="add-comment-form" onSubmit={handleAddComment}>
              <img 
                src={replacePlaceholderUrl(user.avatar || user.profilePicture)} 
                alt={user.username}
                className="user-avatar"
              />
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="comment-input"
              />
              <button type="submit" className="submit-comment">
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default PostCard;