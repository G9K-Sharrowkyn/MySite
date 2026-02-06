import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import PostCard from './PostCard';
import ChallengeResponse from './ChallengeResponse';
import ChallengeApproval from './ChallengeApproval';
import './PostPage.css';

const PostPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentUserId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');

  const fetchPost = useCallback(async () => {
    try {
      const response = await axios.get(
        `/api/posts/${postId}`,
        token ? { headers: { 'x-auth-token': token } } : undefined
      );
      setPost(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching post:', err);
      setError('Post not found or error loading post.');
      setLoading(false);
    }
  }, [postId, token]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handlePostUpdate = useCallback(
    (updatedPostOrId, deleted) => {
      if (deleted) {
        navigate('/');
        return;
      }
      if (updatedPostOrId && typeof updatedPostOrId === 'object') {
        setPost(updatedPostOrId);
      }
    },
    [navigate]
  );

  if (loading) return <div className="post-page loading">Loading...</div>;
  if (error) return <div className="post-page error">{error}</div>;
  if (!post) return <div className="post-page not-found">Post not found</div>;

  return (
    <div className="post-page">
      <div className="post-container">
        <PostCard post={post} onUpdate={handlePostUpdate} eagerImages prefetchImages />

        {post.type === 'fight' && post.fight?.fightMode === 'user_vs_user' && (
          <div className="challenge-section">
            <ChallengeResponse
              post={post}
              currentUserId={currentUserId}
              onResponse={fetchPost}
            />
            <ChallengeApproval
              post={post}
              currentUserId={currentUserId}
              onApproval={fetchPost}
            />
            {post.fight.status === 'pending_opponent' &&
              post.fight.opponentId !== currentUserId &&
              post.fight.challengerId !== currentUserId && (
                <div className="challenge-status-info pending">
                  <span className="status-icon">⏳</span>
                  <span>Oczekiwanie na odpowiedź {post.fight.opponentUsername}...</span>
                </div>
              )}
            {post.fight.status === 'pending_approval' &&
              post.fight.opponentId !== currentUserId &&
              post.fight.challengerId !== currentUserId && (
                <div className="challenge-status-info pending">
                  <span className="status-icon">✅</span>
                  <span>Oczekiwanie na zatwierdzenie przez {post.fight.challengerUsername}...</span>
                </div>
              )}
            {post.fight.status === 'rejected' && (
              <div className="challenge-status-info rejected">
                <span className="status-icon">❌</span>
                <span>Wyzwanie zostało odrzucone</span>
              </div>
            )}
            {post.fight.status === 'cancelled' && (
              <div className="challenge-status-info cancelled">
                <span className="status-icon">🚫</span>
                <span>Walka została anulowana</span>
              </div>
            )}
            {post.fight.status === 'expired' && (
              <div className="challenge-status-info expired">
                <span className="status-icon">⌛</span>
                <span>Wyzwanie wygasło</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PostPage;
