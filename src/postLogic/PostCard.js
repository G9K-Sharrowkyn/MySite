import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { replacePlaceholderUrl, placeholderImages } from '../utils/placeholderImage';
import { ChampionUsername } from '../utils/championUtils';
import CreatePost from './CreatePost';
import ReactionMenu from './ReactionMenu';
import './PostCard.css';
import { useLanguage } from '../i18n/LanguageContext';
import HoloCard from '../shared/HoloCard';
import FightTimer from './FightTimer';

const PostCard = ({ post, onUpdate }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [userVote, setUserVote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const { currentLanguage, t } = useLanguage();
  const [translatedContent, setTranslatedContent] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedComments, setTranslatedComments] = useState({});
  const [translatingComments, setTranslatingComments] = useState({});
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [userReaction, setUserReaction] = useState(null);
  const [commentReactionTarget, setCommentReactionTarget] = useState(null);
  const [reactions, setReactions] = useState(post.reactions || []);
  const [characters, setCharacters] = useState([]);
  const [pollVote, setPollVote] = useState(null);

  const currentUserId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');

  const normalizeVoteTeam = (team) => {
    if (!team) return null;
    const value = String(team).toLowerCase();
    if (['a', 'teama', 'team a', 'fighter1', 'fighterone'].includes(value)) return 'A';
    if (['b', 'teamb', 'team b', 'fighter2', 'fightertwo'].includes(value)) return 'B';
    if (['draw', 'tie'].includes(value)) return 'draw';
    return team;
  };

  useEffect(() => {
    // Check if user voted in fight
    if (post.type === 'fight' && post.fight?.votes?.voters && currentUserId) {
      const vote = post.fight.votes.voters.find(v => v.userId === currentUserId);
      setUserVote(normalizeVoteTeam(vote?.team));
    }

    // Fetch character list for mapping names to images
    const fetchCharacters = async () => {
      try {
        const response = await axios.get('/api/characters');
        setCharacters(response.data);
      } catch (err) {
        // Ignore error, fallback to name only
      }
    };
    fetchCharacters();
  }, [post, currentUserId]);

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/comments/post/${post.id}`);
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const buildCommentThreads = (allComments) => {
    const commentList = Array.isArray(allComments) ? allComments : [];
    const commentsById = new Map(
      commentList.map((comment) => [comment.id, comment])
    );
    const rootCache = new Map();

    const resolveRootId = (comment) => {
      const commentId = comment?.id;
      if (!commentId) return null;
      if (rootCache.has(commentId)) return rootCache.get(commentId);

      let current = comment;
      const visited = new Set([commentId]);
      let rootId = null;

      while (current?.parentId) {
        const parentId = current.parentId;
        if (!parentId || visited.has(parentId)) break;
        const parent = commentsById.get(parentId);
        if (!parent) {
          rootId = comment.threadId || commentId;
          break;
        }
        visited.add(parentId);
        current = parent;
      }

      if (!rootId) {
        rootId = current?.id || comment.threadId || commentId;
      }

      rootCache.set(commentId, rootId);
      return rootId;
    };

    const threads = new Map();
    commentList.forEach((comment) => {
      const rootId = resolveRootId(comment);
      if (!rootId) return;
      if (!threads.has(rootId)) {
        threads.set(rootId, { id: rootId, root: null, replies: [] });
      }
      threads.get(rootId).replies.push(comment);
    });

    const threadList = Array.from(threads.values()).map((thread) => {
      const sorted = [...thread.replies].sort(
        (a, b) =>
          new Date(a.createdAt || a.timestamp || 0) -
          new Date(b.createdAt || b.timestamp || 0)
      );
      let rootIndex = sorted.findIndex(
        (comment) => comment.id === thread.id && !comment.parentId
      );
      if (rootIndex === -1) {
        rootIndex = sorted.findIndex((comment) => comment.id === thread.id);
      }
      const root =
        rootIndex >= 0 ? sorted.splice(rootIndex, 1)[0] : sorted.shift() || null;
      return { ...thread, root, replies: sorted };
    });

    return threadList.sort(
      (a, b) =>
        new Date(a.root?.createdAt || a.root?.timestamp || 0) -
        new Date(b.root?.createdAt || b.root?.timestamp || 0)
    );
  };

  const toggleThread = (threadId) => {
    setExpandedThreads((prev) => ({
      ...prev,
      [threadId]: !prev[threadId]
    }));
  };

  const handleReplyClick = (comment, threadId) => {
    setExpandedThreads((prev) => ({
      ...prev,
      [threadId]: true
    }));
    setReplyingTo({
      id: comment.id,
      threadId,
      username: comment.authorUsername
    });
    const mention = comment?.authorUsername ? `@${comment.authorUsername} ` : '';
    setReplyText(mention);
  };

  const handleReplyCancel = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  const handleReplySubmit = async (e, threadId, fallbackParentId) => {
    e.preventDefault();
    if (!token || !replyText.trim()) return;

    const parentId =
      replyingTo && replyingTo.threadId === threadId
        ? replyingTo.id
        : fallbackParentId;

    try {
      await axios.post(
        `/api/comments/post/${post.id}`,
        { text: replyText, parentId },
        { headers: { 'x-auth-token': token } }
      );
      setReplyText('');
      setReplyingTo(null);
      fetchComments();
    } catch (error) {
      console.error('Error adding reply:', error);
    }
  };

  const handleCommentReactionClick = (commentId) => {
    if (!token) return;
    setCommentReactionTarget(commentId);
  };

  const handleCommentReactionSelect = async (reaction) => {
    if (!token || !commentReactionTarget) return;

    try {
      const response = await axios.post(
        `/api/comments/${commentReactionTarget}/reaction`,
        {
          reactionId: reaction.id,
          reactionIcon: reaction.icon,
          reactionName: reaction.name
        },
        { headers: { 'x-auth-token': token } }
      );

      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentReactionTarget
            ? {
                ...comment,
                reactions: response.data.reactions || [],
                userReaction: reaction
              }
            : comment
        )
      );
      setCommentReactionTarget(null);
    } catch (error) {
      console.error('Error adding comment reaction:', error);
    }
  };

  const handleVote = async (team) => {
    if (!token) return;
    try {
      await axios.post(`/api/posts/${post.id}/fight-vote`, { team }, {
        headers: { 'x-auth-token': token }
      });
      setUserVote(normalizeVoteTeam(team));
      // Refresh post data
      if (onUpdate) {
        const updatedPost = await axios.get(`/api/posts/${post.id}`);
        onUpdate(updatedPost.data);
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handlePollVote = async (optionIndex) => {
    if (!token || pollVote !== null) return;
    
    try {
      await axios.post(`/api/posts/${post.id}/poll-vote`, { 
        optionIndex 
      }, {
        headers: { 'x-auth-token': token }
      });
      
      setPollVote(optionIndex);
      // Refresh post data
      if (onUpdate) {
        const updatedPost = await axios.get(`/api/posts/${post.id}`);
        onUpdate(updatedPost.data);
      }
    } catch (error) {
      console.error('Error voting in poll:', error);
    }
  };

  const getVotePercentage = (votes, totalVotes) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const getTotalVotes = () => {
    if (post.type === 'fight' && post.fight?.votes) {
      return (post.fight.votes.teamA || 0) + (post.fight.votes.teamB || 0);
    }
    if (post.poll?.votes?.voters) {
      return post.poll.votes.voters.length;
    }
    return 0;
  };

  const renderVotingSection = () => {
    if (post.type === 'fight' && post.fight) {
      return renderFightVoting();
    }
    if (post.poll && post.poll.options) {
      return renderPollVoting();
    }
    return null;
  };

  // Helper to get character object by name
  const getCharacterByName = (name) => {
    if (!name) return null;
    return characters.find(c => c.name === name);
  };

  const renderTeamPanel = (teamList, teamLabel, isSelected, onVote, votes, teamKey) => {
    const isVoted = userVote === teamKey;
    // New: multiline layout for 3 or 4 characters
    const multiline = teamList.length === 3 || teamList.length === 4;
    let rows = [];
    if (teamList.length === 4) {
      rows = [teamList.slice(0, 2), teamList.slice(2, 4)];
    } else if (teamList.length === 3) {
      rows = [teamList.slice(0, 2), teamList.slice(2)];
    }
    return (
      <div className="team-column">
        <div className={`team-zone${isVoted ? ' sparkly' : ''}${multiline ? ' team-zone-multiline' : ''}`}> 
          {multiline ? (
            <>
              <div className="team-row">
                {rows[0].map((name, idx) => {
                  const char = getCharacterByName(name);
                  return (
                    <div key={idx} className="character-panel">
                      <div className="character-name-simple">{name}</div>
                      <div className={`character-frame${!isVoted ? ' not-chosen' : ''}`}>
                        <img
                          src={replacePlaceholderUrl(char?.image) || placeholderImages.character}
                          alt={name}
                          className="team-image-large"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="team-row team-row-bottom{teamList.length === 3 ? ' team-row-single' : ''}">
                {rows[1].map((name, idx) => {
                  const char = getCharacterByName(name);
                  return (
                    <div key={idx} className="character-panel">
                      <div className="character-name-simple">{name}</div>
                      <div className={`character-frame${!isVoted ? ' not-chosen' : ''}`}>
                        <img
                          src={replacePlaceholderUrl(char?.image) || placeholderImages.character}
                          alt={name}
                          className="team-image-large"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            teamList.map((name, idx) => {
              const char = getCharacterByName(name);
              return (
                <div key={idx} className="character-panel">
                  <div className="character-name-simple">{name}</div>
                  <div className={`character-frame${!isVoted ? ' not-chosen' : ''}`}>
                    <img
                      src={replacePlaceholderUrl(char?.image) || placeholderImages.character}
                      alt={name}
                      className="team-image-large"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderFightVoting = () => {
    const teamAVotes = post.fight.votes?.teamA || 0;
    const teamBVotes = post.fight.votes?.teamB || 0;
    const drawVotes = post.fight.votes?.draw || 0;

    const teamAList = (post.fight.teamA || '').split(',').map(n => n.trim()).filter(Boolean);
    const teamBList = (post.fight.teamB || '').split(',').map(n => n.trim()).filter(Boolean);

    return (
      <div className="voting-section fight-voting">
        <div className={`fight-vote-row-3col${userVote ? ' has-voted' : ''}`}>
          {/* Team A column */}
          <div className="team-vote-col">
            {renderTeamPanel(
              teamAList,
              post.fight.teamA || 'Team A',
              userVote === 'A',
              () => handleVote('A'),
              teamAVotes,
              'A'
            )}
          </div>

          {/* Draw column */}
          <div className="draw-vote-col">
          </div>

          {/* Team B column */}
          <div className="team-vote-col">
            {renderTeamPanel(
              teamBList,
              post.fight.teamB || 'Team B',
              userVote === 'B',
              () => handleVote('B'),
              teamBVotes,
              'B'
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPollVoting = () => {
    const totalVotes = getTotalVotes();
    const options = post.poll.options || [];

    return (
      <div className="voting-section poll-voting">
        <h4 className="voting-title">📊 {t('poll') || 'Poll'}</h4>
        
        <div className="vote-options">
          {options.map((option, index) => {
            const optionVotes = post.poll.votes?.voters?.filter(v => v.optionIndex === index).length || 0;
            const optionPercentage = getVotePercentage(optionVotes, totalVotes);
            const isVoted = pollVote === index;

            return (
              <div key={index} className={`vote-option ${isVoted ? 'voted' : ''} ${pollVote !== null ? 'disabled' : ''}`}>
                <div className="vote-option-content">
                  <div className="vote-option-header">
                    <h5 className="vote-option-title">{option}</h5>
                    {isVoted && <span className="vote-check">✅</span>}
                  </div>
                  
                  <div className="vote-progress-container">
                    <div className="vote-progress-bar">
                      <div 
                        className="vote-progress-fill poll-fill"
                        style={{ width: `${optionPercentage}%` }}
                      ></div>
                    </div>
                    <div className="vote-stats">
                      <span className="vote-count">{optionVotes}</span>
                      <span className="vote-percentage">{optionPercentage}%</span>
                    </div>
                  </div>
                  
                  <button
                    className={`vote-button poll-btn ${isVoted ? 'voted' : ''}`}
                    onClick={() => handlePollVote(index)}
                    disabled={pollVote !== null}
                  >
                    {isVoted ? t('voted') || 'Voted!' : t('vote') || 'Vote!'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="voting-footer">
          <span className="total-votes">
            🗳️ {totalVotes} {t('totalVotes') || 'total votes'}
          </span>
          {pollVote !== null && (
            <span className="user-vote-status">
              ✅ {t('youVotedFor') || 'You voted for'} <strong>{options[pollVote]}</strong>
            </span>
          )}
        </div>
      </div>
    );
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

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!token) return;

    try {
      await axios.delete(`/api/posts/${post.id}`, {
        headers: { 'x-auth-token': token }
      });
      if (onUpdate) {
        onUpdate(post.id, true); // notify parent to refresh posts after deletion
      }
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handlePostUpdated = (updatedPost) => {
    setIsEditing(false);
    if (onUpdate) {
      onUpdate(updatedPost);
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

  // Show translate button for all languages when content is in a different language
  const needsTranslation = () => {
    if (!post.content) return false;
    
    // Check if content contains characters from different languages
    const hasPolishChars = /[ąćęłńóśźż]/i.test(post.content);
    const hasSpanishChars = /[áéíóúñü]/i.test(post.content);
    
    // For English UI: show translate if content has Polish or Spanish characters
    if (currentLanguage === 'en' && (hasPolishChars || hasSpanishChars)) return true;
    
    // For Polish UI: show translate if content has Spanish characters or is clearly English
    if (currentLanguage === 'pl') {
      if (hasSpanishChars) return true;
      // Check if content is clearly English (contains English words but no Polish chars)
      if (/[a-z]/i.test(post.content) && !hasPolishChars) return true;
    }
    
    // For Spanish UI: show translate if content has Polish characters or is clearly English
    if (currentLanguage === 'es') {
      if (hasPolishChars) return true;
      // Check if content is clearly English (contains English words but no Spanish chars)
      if (/[a-z]/i.test(post.content) && !hasSpanishChars) return true;
    }
    
    return false;
  };

  const handleTranslate = async () => {
    setIsTranslating(true);
    // Simulate translation (replace with real API call)
    setTimeout(() => {
      setTranslatedContent(`[${t('translated') || 'Translated'}] ${post.content}`);
      setIsTranslating(false);
    }, 1000);
  };

  const needsCommentTranslation = (text) => {
    if (!text) return false;
    
    // Check if content contains characters from different languages
    const hasPolishChars = /[ąćęłńóśźż]/i.test(text);
    const hasSpanishChars = /[áéíóúñü]/i.test(text);
    
    // For English UI: show translate if content has Polish or Spanish characters
    if (currentLanguage === 'en' && (hasPolishChars || hasSpanishChars)) return true;
    
    // For Polish UI: show translate if content has Spanish characters or is clearly English
    if (currentLanguage === 'pl') {
      if (hasSpanishChars) return true;
      // Check if content is clearly English (contains English words but no Polish chars)
      if (/[a-z]/i.test(text) && !hasPolishChars) return true;
    }
    
    // For Spanish UI: show translate if content has Polish characters or is clearly English
    if (currentLanguage === 'es') {
      if (hasPolishChars) return true;
      // Check if content is clearly English (contains English words but no Spanish chars)
      if (/[a-z]/i.test(text) && !hasSpanishChars) return true;
    }
    
    return false;
  };

  const handleTranslateComment = (commentId, text) => {
    setTranslatingComments(prev => ({ ...prev, [commentId]: true }));
    setTimeout(() => {
      setTranslatedComments(prev => ({ ...prev, [commentId]: `[${t('translated') || 'Translated'}] ${text}` }));
      setTranslatingComments(prev => ({ ...prev, [commentId]: false }));
    }, 1000);
  };

  const handleReactionSelect = async (reaction) => {
    if (!token) return;
    
    try {
      const response = await axios.post(`/api/posts/${post.id}/reaction`, { 
        reactionId: reaction.id,
        reactionIcon: reaction.icon,
        reactionName: reaction.name
      }, {
        headers: { 'x-auth-token': token }
      });
      
      setUserReaction(reaction);
      setReactions(response.data.reactions);
      setShowReactionMenu(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleReactionClick = () => {
    if (!token) {
      alert(t('mustBeLoggedInToVote') || 'You must be logged in to react!');
      return;
    }
    setShowReactionMenu(true);
  };

  // SparkleOverlay component
  const SparkleOverlay = ({ count = 7 }) => {
    const [sparkles, setSparkles] = useState([]);

    useEffect(() => {
      // Generate random sparkles
      const newSparkles = Array.from({ length: count }).map((_, i) => {
        const angle = Math.random() * 2 * Math.PI;
        const radius = 90 + Math.random() * 30; // px from center
        const x = 50 + Math.cos(angle) * radius;
        const y = 50 + Math.sin(angle) * radius;
        const delay = Math.random() * 1.2;
        return { id: i, x, y, delay };
      });
      setSparkles(newSparkles);
    }, [count]);

    return (
      <div className="sparkle-overlay">
        {sparkles.map(s => (
          <div
            key={s.id}
            className="sparkle"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
    );
  };

  const commentThreads = buildCommentThreads(comments);

  if (isEditing) {
    return (
      <div className="post-card editing">
        <CreatePost 
          initialData={post} 
          onPostUpdated={handlePostUpdated} 
          onCancel={handleEditToggle}
        />
      </div>
    );
  }

  return (
    <div className={`post-card ${post.isOfficial ? 'official' : ''}`}>
      <div className="post-header">
        <Link to={`/profile/${post.author?.id}`} className="author-link">
          <img 
            src={replacePlaceholderUrl(post.author?.profilePicture) || '/placeholder-character.png'} 
            alt={post.author?.username} 
            className="author-avatar"
          />
          <div className="author-info">
            <ChampionUsername user={post.author} />
            <span className="post-meta">
              {post.author?.rank || 'Rookie'} • {formatTimeAgo(post.createdAt)}
            </span>
          </div>
        </Link>
        <div className="post-meta">
          <span className="post-type">{getPostTypeIcon(post.type)}</span>
          <span className="post-time">{formatTimeAgo(post.createdAt)}</span>
          {post.type === 'fight' && post.fight && (
            <FightTimer 
              lockTime={post.fight.lockTime} 
              status={post.fight.status} 
            />
          )}
        </div>
      </div>

      <div className="post-content" style={{ cursor: 'pointer' }}>
        <Link to={`/post/${post.id}`} className="post-title-link">
          <h3 className="post-title">{post.title}</h3>
        </Link>
        <p className="post-text">{post.content}</p>
        {needsTranslation() && (
          <button className="translate-btn" onClick={handleTranslate} disabled={isTranslating}>
            {isTranslating ? t('loading') : t('translate') || 'Translate'}
          </button>
        )}
        {translatedContent && (
          <p className="post-text translated">{translatedContent}</p>
        )}
        
        {post.image && (
          <Link to={`/post/${post.id}`} className="post-image-link">
            <div className="post-image">
              <img src={replacePlaceholderUrl(post.image)} alt="Post content" />
            </div>
          </Link>
        )}
        
        {renderVotingSection()}
      </div>

      {/* Fight Voting Actions - New frame for fight voting buttons */}
      {post.type === 'fight' && post.fight && post.fight.status !== 'locked' && post.fight.status !== 'completed' && (
        <div className={`fight-voting-actions${userVote ? ' has-voted' : ''}`} onClick={e => e.stopPropagation()}>
          <button
            className={`animated-vote-btn team-a${userVote === 'A' ? ' voted' : ''}`}
            onClick={() => handleVote('A')}
          >
            {userVote === 'A' ? t('voted') || 'Voted!' : t('vote') || 'Vote!'}
          </button>
          
          <button
            className={`animated-vote-btn draw${userVote === 'draw' ? ' voted' : ''}`}
            onClick={() => handleVote('draw')}
          >
            {t('draw')}
          </button>
          
          <button
            className={`animated-vote-btn team-b${userVote === 'B' ? ' voted' : ''}`}
            onClick={() => handleVote('B')}
          >
            {userVote === 'B' ? t('voted') || 'Voted!' : t('vote') || 'Vote!'}
          </button>
        </div>
      )}

      {/* Fight Results - Show when fight is locked */}
      {post.type === 'fight' && post.fight && (post.fight.status === 'locked' || post.fight.status === 'completed') && (
        <div className="fight-results-section">
          <div className="fight-result-header">
            <h4>⚔️ Fight Results</h4>
            <span className="fight-status-badge locked">Fight Ended</span>
          </div>
          <div className="fight-result-content">
            {post.fight.winnerTeam === 'draw' ? (
              <div className="result-draw">
                <span className="draw-icon">🤝</span>
                <h3>It's a Draw!</h3>
              </div>
            ) : (
              <div className="result-winner">
                <span className="winner-icon">🏆</span>
                <h3>Winner: {post.fight.winnerTeam === 'teamA' ? post.fight.teamA : post.fight.teamB}</h3>
              </div>
            )}
            <div className="final-votes-display">
              <div className="vote-stat">
                <span className="team-label">Team A</span>
                <span className="vote-count">{post.fight.finalVotes?.teamA || post.fight.votes?.teamA || 0} votes</span>
              </div>
              <div className="vote-stat">
                <span className="team-label">Team B</span>
                <span className="vote-count">{post.fight.finalVotes?.teamB || post.fight.votes?.teamB || 0} votes</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="post-actions" onClick={e => e.stopPropagation()}>
        <button 
          className="action-btn comment-btn"
          onClick={toggleComments}
        >
          <span className="action-icon">💬</span>
          <span className="action-text">{comments.length}</span>
        </button>
        
        <button 
          className={`action-btn react-btn ${userReaction ? 'reacted' : ''}`}
          onClick={handleReactionClick}
        >
          <span className="action-icon">{userReaction ? userReaction.icon : '😀'}</span>
          <span className="action-text">{t('react')}</span>
        </button>
        
        <button className="action-btn share-btn">
          <span className="action-icon">📤</span>
          <span className="action-text">{t('share')}</span>
        </button>

        {currentUserId === post.author?.id && (
          <>
            <button className="action-btn edit-btn" onClick={handleEditToggle}>
              <span className="action-icon">✏️</span>
              <span className="action-text">{t('edit')}</span>
            </button>
            <button className="action-btn delete-btn" onClick={handleDelete}>
              <span className="action-icon">🗑️</span>
              <span className="action-text">{t('delete')}</span>
            </button>
          </>
        )}
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{t('confirmDelete')}</h3>
            <p>{t('confirmDeletePost')}</p>
            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={handleDeleteCancel}>{t('cancel')}</button>
              <button className="btn btn-delete" onClick={handleDeleteConfirm}>{t('delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reactions Display */}
      {reactions.length > 0 && (
        <div className="reactions-display">
          <div className="reactions-list">
            {reactions.map((reaction, index) => (
              <div key={index} className="reaction-item">
                <span className="reaction-icon">{reaction.icon}</span>
                <span className="reaction-count">{reaction.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showComments && (
        <div className="comments-section" onClick={e => e.stopPropagation()}>
          {token && (
            <form onSubmit={handleCommentSubmit} className="comment-form">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t('writeComment')}
                className="comment-input"
              />
              <button type="submit" className="comment-submit">
                {t('send') || 'Send'}
              </button>
            </form>
          )}
          
          <div className="comments-list">
            {commentThreads.map((thread) => {
              if (!thread.root) return null;
              const root = thread.root;
              const threadId = thread.id;
              const replies = thread.replies || [];
              const isExpanded = Boolean(expandedThreads[threadId]);
              const replyCount = replies.length;

              return (
                <div key={threadId} className="comment-thread">
                  <div
                    className={`comment-item comment-root${isExpanded ? ' expanded' : ''}`}
                    onClick={() => toggleThread(threadId)}
                  >
                    <div className="comment-header">
                      <Link
                        to={`/profile/${root.authorId}`}
                        className="comment-author"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <img
                          src={
                            replacePlaceholderUrl(root.authorAvatar) ||
                            placeholderImages.userSmall
                          }
                          alt={root.authorUsername}
                          className="comment-avatar"
                        />
                        <strong>{root.authorUsername}</strong>
                      </Link>
                      <span className="comment-time">{formatTimeAgo(root.createdAt)}</span>
                    </div>
                    <p className="comment-text">{root.text}</p>
                    {needsCommentTranslation(root.text) && (
                      <button
                        className="translate-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTranslateComment(root.id, root.text);
                        }}
                        disabled={translatingComments[root.id]}
                      >
                        {translatingComments[root.id]
                          ? t('loading')
                          : t('translate') || 'Translate'}
                      </button>
                    )}
                    {translatedComments[root.id] && (
                      <p className="comment-text translated">
                        {translatedComments[root.id]}
                      </p>
                    )}
                    {root.reactions?.length > 0 && (
                      <div
                        className="comment-reactions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {root.reactions.map((reaction, index) => (
                          <div key={index} className="comment-reaction-item">
                            <span className="reaction-icon">{reaction.icon}</span>
                            <span className="reaction-count">{reaction.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="comment-actions">
                      <button
                        className="comment-action comment-reply-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReplyClick(root, threadId);
                        }}
                      >
                        {t('reply') || 'Reply'}
                      </button>
                      <button
                        className={`comment-action comment-react-btn${
                          root.userReaction ? ' reacted' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCommentReactionClick(root.id);
                        }}
                      >
                        {root.userReaction && (
                          <span className="comment-action-icon">
                            {root.userReaction.icon}
                          </span>
                        )}
                        <span className="comment-action-text">{t('react') || 'React'}</span>
                      </button>
                      {replyCount > 0 && (
                        <button
                          className="comment-action comment-toggle"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleThread(threadId);
                          }}
                        >
                          {isExpanded
                            ? `Hide replies (${replyCount})`
                            : `View replies (${replyCount})`}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && replyCount > 0 && (
                    <div className="comment-replies">
                      {replies.map((reply) => (
                        <div key={reply.id} className="comment-item comment-reply">
                          <div className="comment-header">
                            <Link
                              to={`/profile/${reply.authorId}`}
                              className="comment-author"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <img
                                src={
                                  replacePlaceholderUrl(reply.authorAvatar) ||
                                  placeholderImages.userSmall
                                }
                                alt={reply.authorUsername}
                                className="comment-avatar"
                              />
                              <strong>{reply.authorUsername}</strong>
                            </Link>
                            <span className="comment-time">
                              {formatTimeAgo(reply.createdAt)}
                            </span>
                          </div>
                          <p className="comment-text">{reply.text}</p>
                          {needsCommentTranslation(reply.text) && (
                            <button
                              className="translate-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTranslateComment(reply.id, reply.text);
                              }}
                              disabled={translatingComments[reply.id]}
                            >
                              {translatingComments[reply.id]
                                ? t('loading')
                                : t('translate') || 'Translate'}
                            </button>
                          )}
                          {translatedComments[reply.id] && (
                            <p className="comment-text translated">
                              {translatedComments[reply.id]}
                            </p>
                          )}
                          {reply.reactions?.length > 0 && (
                            <div
                              className="comment-reactions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {reply.reactions.map((reaction, index) => (
                                <div key={index} className="comment-reaction-item">
                                  <span className="reaction-icon">{reaction.icon}</span>
                                  <span className="reaction-count">{reaction.count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="comment-actions">
                            <button
                              className="comment-action comment-reply-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplyClick(reply, threadId);
                              }}
                            >
                              {t('reply') || 'Reply'}
                            </button>
                            <button
                              className={`comment-action comment-react-btn${
                                reply.userReaction ? ' reacted' : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCommentReactionClick(reply.id);
                              }}
                            >
                              {reply.userReaction && (
                                <span className="comment-action-icon">
                                  {reply.userReaction.icon}
                                </span>
                              )}
                              <span className="comment-action-text">
                                {t('react') || 'React'}
                              </span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {replyingTo && replyingTo.threadId === threadId && token && (
                    <form
                      className="comment-reply-form"
                      onSubmit={(e) => handleReplySubmit(e, threadId, root.id)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Reply to ${replyingTo.username || 'comment'}`}
                        className="comment-input"
                      />
                      <div className="comment-reply-actions">
                        <button type="submit" className="comment-reply-submit">
                          {t('reply') || 'Reply'}
                        </button>
                        <button
                          type="button"
                          className="comment-reply-cancel"
                          onClick={handleReplyCancel}
                        >
                          {t('cancel') || 'Cancel'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
            {commentThreads.length === 0 && (
              <div className="no-comments">
                {t('noComments') || 'No comments yet. Be the first to comment!'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reaction Menu */}
      {showReactionMenu && (
        <ReactionMenu
          onReactionSelect={handleReactionSelect}
          onClose={() => setShowReactionMenu(false)}
        />
      )}

      {commentReactionTarget && (
        <ReactionMenu
          onReactionSelect={handleCommentReactionSelect}
          onClose={() => setCommentReactionTarget(null)}
        />
      )}
    </div>
  );
};

export default PostCard;
