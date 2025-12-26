import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { replacePlaceholderUrl, placeholderImages } from '../utils/placeholderImage';
import ReactionMenu from './ReactionMenu';
import './PostPage.css';

const PostPage = () => {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [expandedThreads, setExpandedThreads] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [commentReactionTarget, setCommentReactionTarget] = useState(null);
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [userReaction, setUserReaction] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [userVote, setUserVote] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const buildTeamEntries = (team) => {
    if (Array.isArray(team)) {
      return team
        .map((entry) => {
          if (typeof entry === 'string') {
            return { name: entry };
          }
          const name =
            entry?.name ||
            entry?.characterName ||
            entry?.character?.name ||
            entry?.character?.characterName ||
            '';
          const image =
            entry?.image ||
            entry?.characterImage ||
            entry?.customImage ||
            entry?.character?.image ||
            '';
          return name ? { name, image } : null;
        })
        .filter(Boolean);
    }
    if (typeof team === 'string') {
      return team
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ name }));
    }
    return [];
  };

  const getCharacterByName = (name) => {
    if (!name) return null;
    return characters.find((character) => character.name === name);
  };

  const resolveCharacterImage = (entry) => {
    if (entry?.image) {
      return replacePlaceholderUrl(entry.image) || entry.image;
    }
    const character = getCharacterByName(entry?.name);
    return replacePlaceholderUrl(character?.image) || placeholderImages.character;
  };

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [postId]);

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const response = await axios.get('/api/characters');
        setCharacters(response.data || []);
      } catch (error) {
        // Ignore error, fallback to placeholders
      }
    };
    fetchCharacters();
  }, []);

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
      setReactions(postData.reactions || []);
      
      if (postData.type === 'fight' && postData.fight?.votes?.voters && currentUserId) {
        const vote = postData.fight.votes.voters.find(
          (v) => String(v.userId) === String(currentUserId)
        );
        setUserVote(normalizeVoteTeam(vote?.team));
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
        `/api/comments/post/${postId}`,
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

  const handleReactionSelect = async (reaction) => {
    if (!token) return;

    try {
      const response = await axios.post(
        `/api/posts/${postId}/reaction`,
        {
          reactionId: reaction.id,
          reactionIcon: reaction.icon,
          reactionName: reaction.name
        },
        { headers: { 'x-auth-token': token } }
      );

      setUserReaction(reaction);
      setReactions(response.data.reactions || []);
      setShowReactionMenu(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleReactionClick = () => {
    if (!token) {
      alert('You must be logged in to react!');
      return;
    }
    setShowReactionMenu(true);
  };

  const handleVote = async (team) => {
    if (!token || userVote) return;
    
    try {
      await axios.post(`/api/posts/${postId}/fight-vote`, { team }, {
        headers: { 'x-auth-token': token }
      });
      
      setUserVote(normalizeVoteTeam(team));
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

  const teamAEntries = post?.fight ? buildTeamEntries(post.fight.teamA) : [];
  const teamBEntries = post?.fight ? buildTeamEntries(post.fight.teamB) : [];
  const teamAEntry = teamAEntries[0] || null;
  const teamBEntry = teamBEntries[0] || null;
  const commentThreads = buildCommentThreads(comments);

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
              <div className="fight-teams-symmetrical">
                <div className="team-column">
                  <div className={`team-zone${userVote === 'A' ? ' sparkly' : ''}`}>
                    <div className="team-names">
                      <span className="team-char-name-text">{post.fight.teamA}</span>
                    </div>
                    <div className="character-stack">
                      <div className={`character-frame${userVote === 'A' ? '' : ' not-chosen'}`}>
                        <img
                          src={resolveCharacterImage(teamAEntry)}
                          alt={teamAEntry?.name || post.fight.teamA}
                        />
                      </div>
                    </div>
                    <div className="team-vote-panel">
                      <div className="vote-count">{post.fight.votes?.teamA || 0} votes</div>
                    </div>
                  </div>
                </div>
                
                <div className="team-column">
                  <div className={`team-zone${userVote === 'B' ? ' sparkly' : ''}`}>
                    <div className="team-names">
                      <span className="team-char-name-text">{post.fight.teamB}</span>
                    </div>
                    <div className="character-stack">
                      <div className={`character-frame${userVote === 'B' ? '' : ' not-chosen'}`}>
                        <img
                          src={resolveCharacterImage(teamBEntry)}
                          alt={teamBEntry?.name || post.fight.teamB}
                        />
                      </div>
                    </div>
                    <div className="team-vote-panel">
                      <div className="vote-count">{post.fight.votes?.teamB || 0} votes</div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="voting-buttons-row">
                <button 
                  className={`vote-button team-a-btn ${userVote === 'A' ? 'voted' : ''}`}
                  onClick={() => handleVote('A')}
                  disabled={!!userVote}
                >
                  {userVote === 'A' ? 'Voted!' : 'Vote!'}
                </button>
                <button 
                  className={`vote-button draw-btn center-draw-btn ${userVote === 'draw' ? 'voted' : ''}`}
                  onClick={() => handleVote('draw')}
                  disabled={!!userVote}
                >
                  Draw
                </button>
                <button 
                  className={`vote-button team-b-btn ${userVote === 'B' ? 'voted' : ''}`}
                  onClick={() => handleVote('B')}
                  disabled={!!userVote}
                >
                  {userVote === 'B' ? 'Voted!' : 'Vote!'}
                </button>
              </div>
              
              {userVote && (
                <div className="vote-status">
                  ✅ You voted for: <strong>{userVote === 'A' ? post.fight.teamA : userVote === 'B' ? post.fight.teamB : 'Draw'}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="post-actions">
          <button
            className={`action-btn react-btn ${userReaction ? 'reacted' : ''}`}
            onClick={handleReactionClick}
          >
            <span className="action-icon">{userReaction ? userReaction.icon : '😀'}</span>
            <span className="action-text">React</span>
          </button>

          <button className="action-btn share-btn">
            <span className="action-icon">📤</span>
            <span className="action-text">Share</span>
          </button>
        </div>

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
                        Reply
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
                        <span className="comment-action-text">React</span>
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
                              Reply
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
                              <span className="comment-action-text">React</span>
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
                          Reply
                        </button>
                        <button
                          type="button"
                          className="comment-reply-cancel"
                          onClick={handleReplyCancel}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
            
            {commentThreads.length === 0 && (
              <div className="no-comments">
                No comments yet. Be the first to comment!
              </div>
            )}
          </div>
        </div>

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
    </div>
  );
};

export default PostPage;
