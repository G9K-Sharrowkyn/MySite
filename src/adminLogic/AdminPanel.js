import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../auth/AuthContext';
import './AdminPanel.css';

const AdminPanel = () => {
  const { user, token } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('alerts');
  const [notifications, setNotifications] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState('');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [roleActionError, setRoleActionError] = useState('');
  const [roleActionStatus, setRoleActionStatus] = useState('');
  const [roleActionUserId, setRoleActionUserId] = useState(null);

  const fetchAlerts = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const response = await axios.get('/api/notifications?type=moderation&limit=50', {
        headers: { 'x-auth-token': token }
      });
      setNotifications(response.data.notifications || []);
      setAlertsError('');
    } catch (err) {
      console.error('Error fetching moderation notifications:', err);
      setAlertsError('Failed to load moderation alerts.');
    } finally {
      setAlertsLoading(false);
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get('/api/profile/all', {
        headers: { 'x-auth-token': token }
      });
      setUsers(Array.isArray(response.data) ? response.data : []);
      setUsersError('');
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsersError('Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setAlertsLoading(false);
      setUsersLoading(false);
      return;
    }

    fetchAlerts();
    fetchUsers();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [token, user?.role, fetchAlerts, fetchUsers]);

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
      setAlertsError('Failed to delete post.');
    }
  };

  const handleRoleChange = async (targetUser) => {
    if (!token || !targetUser?.id) return;
    if (!adminPassword.trim()) {
      setRoleActionError('Enter your admin password first.');
      return;
    }

    const nextRole = targetUser.role === 'moderator' ? 'user' : 'moderator';
    setRoleActionUserId(targetUser.id);
    setRoleActionError('');
    setRoleActionStatus('');
    try {
      await axios.post(
        `/api/profile/${targetUser.id}/role`,
        { role: nextRole, adminPassword },
        { headers: { 'x-auth-token': token } }
      );
      setUsers((prev) =>
        prev.map((entry) =>
          entry.id === targetUser.id ? { ...entry, role: nextRole } : entry
        )
      );
      setRoleActionStatus(
        `${targetUser.username} is now ${nextRole === 'moderator' ? 'a moderator' : 'a regular user'}.`
      );
    } catch (err) {
      setRoleActionError(err?.response?.data?.msg || 'Failed to update role.');
    } finally {
      setRoleActionUserId(null);
    }
  };

  const filteredUsers = users
    .filter((entry) => entry.role !== 'admin')
    .filter((entry) => {
      if (!userSearch.trim()) return true;
      const query = userSearch.trim().toLowerCase();
      return (
        String(entry.username || '').toLowerCase().includes(query) ||
        String(entry.displayName || '').toLowerCase().includes(query) ||
        String(entry.email || '').toLowerCase().includes(query)
      );
    });

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
        <button className="admin-refresh" onClick={fetchAlerts} type="button">
          Refresh
        </button>
      </div>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          Moderation Alerts
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Moderator Roles
        </button>
      </div>

      {activeTab === 'alerts' && (
        <>
          {alertsLoading && <div className="admin-status">Loading alerts...</div>}
          {!alertsLoading && alertsError && <div className="admin-status error">{alertsError}</div>}

          {!alertsLoading && !alertsError && notifications.length === 0 && (
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
        </>
      )}

      {activeTab === 'roles' && (
        <div className="role-management-panel">
          <div className="role-controls">
            <input
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder="Admin password"
              autoComplete="current-password"
            />
            <input
              type="text"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search by username, display name or email"
            />
            <button type="button" className="admin-refresh" onClick={fetchUsers}>
              Refresh users
            </button>
          </div>

          {roleActionError && <div className="admin-status error">{roleActionError}</div>}
          {roleActionStatus && <div className="admin-status">{roleActionStatus}</div>}

          {usersLoading && <div className="admin-status">Loading users...</div>}
          {!usersLoading && usersError && <div className="admin-status error">{usersError}</div>}

          {!usersLoading && !usersError && (
            <div className="role-table">
              {filteredUsers.map((entry) => {
                const isPending = roleActionUserId === entry.id;
                return (
                  <div className="role-row" key={entry.id}>
                    <div className="role-user-meta">
                      <strong>{entry.displayName || entry.username}</strong>
                      <span>@{entry.username}</span>
                      <span>{entry.email}</span>
                    </div>
                    <div className="role-actions">
                      <span className={`role-badge role-${entry.role}`}>{entry.role || 'user'}</span>
                      <button
                        type="button"
                        className="admin-refresh"
                        disabled={isPending}
                        onClick={() => handleRoleChange(entry)}
                      >
                        {isPending
                          ? 'Saving...'
                          : entry.role === 'moderator'
                            ? 'Revoke moderator'
                            : 'Give moderator'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <div className="admin-status">No users match this search.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
