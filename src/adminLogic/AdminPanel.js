import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../auth/AuthContext';
import './AdminPanel.css';

const AdminPanel = () => {
  const { user, token } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchModeration = async () => {
    if (!token) {
      return;
    }

    try {
      const response = await axios.get('/api/notifications?type=moderation&limit=50', {
        headers: { 'x-auth-token': token }
      });
      setNotifications(response.data.notifications || []);
      setError('');
    } catch (err) {
      console.error('Error fetching moderation notifications:', err);
      setError('Failed to load moderation alerts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setLoading(false);
      return;
    }

    fetchModeration();
    const interval = setInterval(fetchModeration, 10000);
    return () => clearInterval(interval);
  }, [token, user?.role]);

  const handleDeletePost = async (postId) => {
    if (!token || !postId) return;

    try {
      await axios.delete(`/api/posts/${postId}`, {
        headers: { 'x-auth-token': token }
      });
      setNotifications((prev) =>
        prev.filter((notification) => notification.data?.postId !== postId)
      );
    } catch (err) {
      console.error('Error deleting post:', err);
      setError('Failed to delete post.');
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="admin-panel access-denied">
        <h2>Access denied</h2>
        <p>This area is available to administrators only.</p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div>
          <h1>Admin Panel</h1>
          <p>Live moderation alerts for flagged language.</p>
        </div>
        <button className="admin-refresh" onClick={fetchModeration} type="button">
          Refresh
        </button>
      </div>

      {loading && <div className="admin-status">Loading alerts...</div>}
      {!loading && error && <div className="admin-status error">{error}</div>}

      {!loading && !error && notifications.length === 0 && (
        <div className="admin-status">No recent alerts.</div>
      )}

      <div className="admin-cards">
        {notifications.map((notification) => {
          const data = notification.data || {};
          const matches = Array.isArray(data.matches) ? data.matches : [];
          const canDelete = data.sourceType === 'post' && data.postId;

          return (
            <div key={notification.id} className="admin-card">
              <div className="admin-card-header">
                <div className="admin-card-title">{notification.title}</div>
                <div className="admin-card-time">
                  {new Date(notification.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="admin-card-content">{notification.content}</div>
              {matches.length > 0 && (
                <div className="admin-card-tags">
                  {matches.map((match) => (
                    <span key={match} className="admin-tag">
                      {match}
                    </span>
                  ))}
                </div>
              )}
              {data.text && <div className="admin-card-text">"{data.text}"</div>}
              <div className="admin-card-actions">
                {data.postId && (
                  <Link className="admin-link" to={`/post/${data.postId}`}>
                    View post
                  </Link>
                )}
                {canDelete && (
                  <button
                    className="admin-delete"
                    type="button"
                    onClick={() => handleDeletePost(data.postId)}
                  >
                    Delete post
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminPanel;
