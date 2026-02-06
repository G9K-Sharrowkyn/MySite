import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  replacePlaceholderUrl,
  placeholderImages,
  getOptimizedImageProps,
  preloadImage,
  preloadCharacterImage
} from '../utils/placeholderImage';
import { normalizeReactionSummary } from '../utils/reactionSummary';
import { ChampionUsername } from '../utils/championUtils';
import CreatePost from './CreatePost';
import ReactionMenu from './ReactionMenu';
import BettingPanel from '../economy/BettingPanel';
import { getUserDisplayName } from '../utils/userDisplay';
import './PostCard.css';
import { useLanguage } from '../i18n/LanguageContext';
import FightTimer from './FightTimer';
import { AuthContext } from '../auth/AuthContext';

let cachedCharacters = null;
let cachedCharactersPromise = null;

const loadCharactersOnce = async () => {
  if (cachedCharacters) {
    return cachedCharacters;
  }
  if (!cachedCharactersPromise) {
    cachedCharactersPromise = axios
      .get('/api/characters')
      .then((response) => {
        cachedCharacters = response.data || [];
        return cachedCharacters;
      })
      .catch(() => {
        cachedCharacters = [];
        return cachedCharacters;
      });
  }
  return cachedCharactersPromise;
};

const normalizeTag = (value) => {
  const cleaned = String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const compact = cleaned.replace(/\s+/g, '');
  if (compact === 'dragonballz' || cleaned === 'dragon ball z') return 'dbz';
  if (compact === 'dragonballgt' || cleaned === 'dragon ball gt') return 'dbgt';
  if (compact === 'dragonballsuper' || cleaned === 'dragon ball super') return 'dbs';
  if (compact === 'dragonballheroes' || cleaned === 'dragon ball heroes') return 'dbh';
  return cleaned;
};

const extractTags = (value) => {
  const tags = [];
  const regex = /\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(String(value || '')))) {
    tags.push(normalizeTag(match[1]));
  }
  return tags;
};

const normalizeBaseName = (value) =>
  String(value || '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeFullName = (value) =>
  String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const PostCard = ({ post, onUpdate, eagerImages = false, prefetchImages = false }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [hasLoadedComments, setHasLoadedComments] = useState(false);
  const [showBetting, setShowBetting] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const shareVersionRef = useRef(null);
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
  const reactionSeed =
    Array.isArray(post.reactionsSummary) && post.reactionsSummary.length > 0
      ? post.reactionsSummary
      : post.reactions;
  const [reactions, setReactions] = useState(() =>
    normalizeReactionSummary(reactionSeed)
  );
  const [characters, setCharacters] = useState(cachedCharacters || []);
  const [pollVote, setPollVote] = useState(null);

  const { user } = useContext(AuthContext);
  const currentUserId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  const canModerate = user?.role === 'admin' || user?.role === 'moderator';
  const imageLazy = !eagerImages;
  const imagePriority = eagerImages ? 'high' : undefined;
  const imageDecoding = eagerImages ? 'sync' : 'async';
  const bettingEligible = (() => {
    if (post.type !== 'fight' || !post.fight) return false;
    const lockTimeValue = post.fight.lockTime;
    if (!lockTimeValue) return false;
    const lockTime = new Date(lockTimeValue);
    if (Number.isNaN(lockTime.getTime())) return false;
    if (post.fight.status && post.fight.status !== 'active') return false;
    return new Date() < lockTime;
  })();

  useEffect(() => {
    shareVersionRef.current = null;
  }, [post?.id]);

  const getShareVersion = () => {
    if (!shareVersionRef.current) {
      shareVersionRef.current = String(Date.now());
    }
    return shareVersionRef.current;
  };

  const buildPostUrl = () => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/post/${post.id}`;
  };

  const buildShareUrl = () => {
    if (!post?.id) return '';
    if (typeof window === 'undefined') return '';
    const versionToken = getShareVersion();
    return `${window.location.origin}/post/${post.id}?v=${encodeURIComponent(versionToken)}`;
  };

  const getShareText = () => {
    if (post.type === 'fight' && post.fight) {
      return `${post.fight.teamA || 'Team A'} vs ${post.fight.teamB || 'Team B'}`;
    }
    if (post.title) return post.title;
    if (post.content) return post.content.slice(0, 120);
    return 'Check this post';
  };

  const handleShareClick = async () => {
    const url = buildShareUrl();
    if (!url) return;
    const shareData = {
      title: post.title || 'Post',
      text: getShareText(),
      url
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        console.error('Share canceled or failed:', error);
      }
    }

    setShareFeedback('');
    setShowShareMenu((prev) => !prev);
  };

  const handleCopyLink = async () => {
    const url = buildPostUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setShareFeedback(t('copied') || 'Skopiowano');
    } catch (error) {
      console.error('Copy failed:', error);
      setShareFeedback(t('copyFailed') || 'Nie udało się skopiować');
    }
    setShowShareMenu(false);
    setTimeout(() => setShareFeedback(''), 2000);
  };

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
    if (post.type === 'fight' && currentUserId) {
      setUserVote(normalizeVoteTeam(post.fight?.myVote));
    }
  }, [post, currentUserId]);

  useEffect(() => {
    setComments([]);
    setHasLoadedComments(false);
  }, [post.id]);

  useEffect(() => {
    const nextSeed =
      Array.isArray(post.reactionsSummary) && post.reactionsSummary.length > 0
        ? post.reactionsSummary
        : post.reactions;
    setReactions(normalizeReactionSummary(nextSeed));
  }, [post.id, post.reactionsSummary, post.reactions]);

  useEffect(() => {
    let isMounted = true;
    if (cachedCharacters && cachedCharacters.length) {
      setCharacters(cachedCharacters);
      return () => {
        isMounted = false;
      };
    }
    loadCharactersOnce().then((data) => {
      if (isMounted) {
        setCharacters(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const getCharacterByName = useCallback((name) => {
    if (!name) return null;
    const normalized = normalizeFullName(name);
    const base = normalizeBaseName(name);
    const tags = extractTags(name);

    let match = characters.find(
      (character) => normalizeFullName(character.name) === normalized
    );
    if (match) return match;

    const baseMatches = characters.filter((character) => {
      const candidateBase = normalizeBaseName(character.baseName || character.name);
      return candidateBase === base;
    });
    if (!baseMatches.length) return null;

    if (tags.length) {
      match = baseMatches.find((character) => {
        const characterTags = Array.isArray(character.tags)
          ? character.tags.map(normalizeTag)
          : [];
        return tags.every((tag) => characterTags.includes(tag));
      });
      if (match) return match;
    }

    return baseMatches[0];
  }, [characters]);

  useEffect(() => {
    if (!prefetchImages && !eagerImages) return;
    const authorImage =
      replacePlaceholderUrl(post.author?.profilePicture) ||
      '/placeholder-character.png';
    preloadImage(authorImage);

    if (post.image) {
      preloadImage(replacePlaceholderUrl(post.image));
    }

    if (post.type === 'fight' && characters.length) {
      const teamAList = (post.fight?.teamA || '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      const teamBList = (post.fight?.teamB || '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
      [...teamAList, ...teamBList].forEach((name) => {
        const character = getCharacterByName(name);
        if (character?.image) {
          preloadCharacterImage(character.image);
        }
      });
    }
  }, [prefetchImages, eagerImages, post, characters, getCharacterByName]);

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/comments/post/${post.id}`);
      const payload = Array.isArray(response.data)
        ? response.data
        : response.data?.comments || [];
      setComments(payload);
      setHasLoadedComments(true);
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
      username: getUserDisplayName(comment)
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
        const updatedPost = await axios.get(`/api/posts/${post.id}`, {
          headers: { 'x-auth-token': token }
        });
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
      if (post.fight?.votesHidden) return 0;
      return (post.fight.votes.teamA || 0) + (post.fight.votes.teamB || 0) + (post.fight.votes.draw || 0);
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

  const renderTeamPanel = (teamList, teamLabel, isSelected, votes, teamKey) => {
    const isVoted = userVote === teamKey;
    const votesHidden = Boolean(post.fight?.votesHidden);
    const totalVotes = votesHidden ? 0 : getTotalVotes();
    const votePercentage = votesHidden ? 0 : getVotePercentage(votes, totalVotes);
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
                          {...getOptimizedImageProps(
                            replacePlaceholderUrl(char?.image) || placeholderImages.character,
                            {
                              size: 360,
                              lazy: imageLazy,
                              fetchPriority: imagePriority,
                              decoding: imageDecoding
                            }
                          )}
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
                          {...getOptimizedImageProps(
                            replacePlaceholderUrl(char?.image) || placeholderImages.character,
                            {
                              size: 280,
                              lazy: imageLazy,
                              fetchPriority: imagePriority,
                              decoding: imageDecoding
                            }
                          )}
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
                      {...getOptimizedImageProps(
                        replacePlaceholderUrl(char?.image) || placeholderImages.character,
                        {
                          size: 280,
                          lazy: imageLazy,
                          fetchPriority: imagePriority,
                          decoding: imageDecoding
                        }
                      )}
                      alt={name}
                      className="team-image-large"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="team-vote-panel">
          {votesHidden ? (
            <div className="team-vote-hidden">{t('votesHiddenUntilEnd') || 'Votes hidden until the end'}</div>
          ) : (
            <>
              <div className="team-vote-count">{votes} {t('votes') || 'votes'}</div>
              <div className="team-vote-percent">{votePercentage}%</div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderFightVoting = () => {
    const teamAVotes = post.fight.votes?.teamA || 0;
    const teamBVotes = post.fight.votes?.teamB || 0;
    const drawVotes = post.fight.votes?.draw || 0;
    const canVote = post.fight.status !== 'locked' && post.fight.status !== 'completed';
    const votesHidden = Boolean(post.fight?.votesHidden);

    const teamAList = (post.fight.teamA || '').split(',').map(n => n.trim()).filter(Boolean);
    const teamBList = (post.fight.teamB || '').split(',').map(n => n.trim()).filter(Boolean);

    return (
      <div className="voting-section fight-voting" onClick={e => e.stopPropagation()}>
        <div className="fight-voting-panels">
          <div className="fight-voting-panel-col">
            {renderTeamPanel(
              teamAList,
              post.fight.teamA || 'Team A',
              userVote === 'A',
              teamAVotes,
              'A'
            )}
          </div>

          <div className="fight-voting-panel-col">
            {renderTeamPanel(
              teamBList,
              post.fight.teamB || 'Team B',
              userVote === 'B',
              teamBVotes,
              'B'
            )}
          </div>
        </div>

        {canVote && (
          <div className={`fight-voting-buttons${userVote ? ' has-voted' : ''}`}>
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

        <div className={`fight-draw-count${votesHidden ? ' hidden' : ''}`}>
          {votesHidden
            ? t('votesHiddenUntilEnd') || 'Votes hidden until the end'
            : `${t('draw') || 'Draw'}: ${drawVotes} ${t('votes') || 'votes'}`}
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
    if (!showComments && !hasLoadedComments) {
      fetchComments();
    }
  };

  const toggleBetting = () => {
    setShowBetting((prev) => !prev);
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



  const handleTranslateComment = async (commentId, text) => {
    setTranslatingComments(prev => ({ ...prev, [commentId]: true }));
    
    try {
      const response = await axios.post('/api/translate', { text });
      
      if (response.data && response.data.translatedText) {
        setTranslatedComments(prev => ({ 
          ...prev, 
          [commentId]: response.data.translatedText 
        }));
      } else {
        // Fallback if translation fails
        setTranslatedComments(prev => ({ 
          ...prev, 
          [commentId]: `[${t('translationFailed') || 'Translation failed'}]` 
        }));
      }
    } catch (error) {
      console.error('Translation error:', error);
      setTranslatedComments(prev => ({ 
        ...prev, 
        [commentId]: `[${t('translationFailed') || 'Translation failed'}]` 
      }));
    } finally {
      setTranslatingComments(prev => ({ ...prev, [commentId]: false }));
    }
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

  const commentThreads = buildCommentThreads(comments);
  const parsedCommentCount = Number(post.commentCount);
  const baseCommentCount = Number.isFinite(parsedCommentCount)
    ? parsedCommentCount
    : Array.isArray(post.comments)
      ? post.comments.length
      : 0;
  const displayCommentCount = hasLoadedComments ? comments.length : baseCommentCount;

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
            {...getOptimizedImageProps(
              replacePlaceholderUrl(post.author?.profilePicture) || '/placeholder-character.png',
              { size: 50, lazy: imageLazy, decoding: imageDecoding }
            )} 
            alt={getUserDisplayName(post.author)} 
            className="author-avatar"
          />
          <div className="author-info">
            <ChampionUsername user={post.author} />
            <span className="post-meta">
              {post.author?.rank || 'Mortal'} • {formatTimeAgo(post.createdAt)}
            </span>
            {post.isOfficial && post.type === 'fight' && (
              <span className="official-fight-badge">Official Fight</span>
            )}
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
              <img
                {...getOptimizedImageProps(replacePlaceholderUrl(post.image), {
                  preferFull: true,
                  size: 600,
                  lazy: imageLazy,
                  fetchPriority: imagePriority,
                  decoding: imageDecoding
                })}
                alt="Post content"
              />
            </div>
          </Link>
        )}
        
        {renderVotingSection()}
      </div>

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
          <span className="action-text">{displayCommentCount}</span>
        </button>
        
        <button 
          className={`action-btn react-btn ${userReaction ? 'reacted' : ''}`}
          onClick={handleReactionClick}
        >
          <span className="action-icon">{userReaction ? userReaction.icon : '😀'}</span>
          <span className="action-text">{t('react')}</span>
        </button>
        
        {bettingEligible && (
          <button
            className={`action-btn betting-btn ${showBetting ? 'active' : ''}`}
            onClick={toggleBetting}
          >
            <span className="action-icon">$</span>
            <span className="action-text">{t('betting') || 'Betting'}</span>
          </button>
        )}
        
        <div className="share-wrapper">
          <button
            className="action-btn share-btn"
            onClick={handleShareClick}
            type="button"
          >
            <span className="action-icon">🔗</span>
            <span className="action-text">{t('share') || 'Udostępnij'}</span>
          </button>

          {showShareMenu && (
            <div
              className="share-menu"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="share-option"
                type="button"
                onClick={handleCopyLink}
              >
                {t('copyLink') || 'Kopiuj link'}
              </button>
              <a
                className="share-option"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(buildShareUrl())}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowShareMenu(false)}
              >
                Facebook
              </a>
              <a
                className="share-option"
                href={`https://www.reddit.com/submit?url=${encodeURIComponent(buildShareUrl())}&title=${encodeURIComponent(post.title || '')}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowShareMenu(false)}
              >
                Reddit
              </a>
              <a
                className="share-option"
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(buildShareUrl())}&text=${encodeURIComponent(post.title || '')}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowShareMenu(false)}
              >
                X
              </a>
              <a
                className="share-option"
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(buildShareUrl())}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowShareMenu(false)}
              >
                LinkedIn
              </a>
              {shareFeedback && (
                <div className="share-feedback">{shareFeedback}</div>
              )}
            </div>
          )}
        </div>

        {currentUserId === post.author?.id && (
          <button className="action-btn edit-btn" onClick={handleEditToggle}>
            <span className="action-icon">E</span>
            <span className="action-text">{t('edit')}</span>
          </button>
        )}
        {(currentUserId === post.author?.id || canModerate) && (
          <button className="action-btn delete-btn" onClick={handleDelete}>
            <span className="action-text">{t('delete')}</span>
          </button>
        )}
      </div>
      {post.type === 'fight' && post.fight && showBetting && bettingEligible && (
        <div className="betting-inline" onClick={(e) => e.stopPropagation()}>
          <BettingPanel
            fightId={post.id}
            fightTitle={post.title}
            teamA={post.fight.teamA || 'Team A'}
            teamB={post.fight.teamB || 'Team B'}
            bettingEndsAt={post.fight.lockTime}
          />
        </div>
      )}

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
                          {...getOptimizedImageProps(
                            replacePlaceholderUrl(root.authorAvatar) ||
                              placeholderImages.userSmall,
                            { size: 32, lazy: imageLazy, decoding: imageDecoding }
                          )}
                          alt={getUserDisplayName(root)}
                          className="comment-avatar"
                        />
                        <strong>{getUserDisplayName(root)}</strong>
                      </Link>
                      <span className="comment-time">{formatTimeAgo(root.createdAt)}</span>
                    </div>
                    <p className="comment-text">{root.text}</p>
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
                      <button
                        className="comment-action comment-translate-btn"
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
                                {...getOptimizedImageProps(
                                  replacePlaceholderUrl(reply.authorAvatar) ||
                                    placeholderImages.userSmall,
                                  { size: 32, lazy: imageLazy, decoding: imageDecoding }
                                )}
                                alt={getUserDisplayName(reply)}
                                className="comment-avatar"
                              />
                              <strong>{getUserDisplayName(reply)}</strong>
                            </Link>
                            <span className="comment-time">
                              {formatTimeAgo(reply.createdAt)}
                            </span>
                          </div>
                          <p className="comment-text">{reply.text}</p>
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
                            <button
                              className="comment-action comment-translate-btn"
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
