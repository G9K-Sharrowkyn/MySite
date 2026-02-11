import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../auth/AuthContext';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import './AdminPanel.css';

const PRIMARY_ADMIN_EMAIL = 'ak4maaru@gmail.com';
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isPrimaryAdmin = (email) => normalizeEmail(email) === PRIMARY_ADMIN_EMAIL;

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

  const [characters, setCharacters] = useState([]);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [charactersError, setCharactersError] = useState('');
  const [characterSearch, setCharacterSearch] = useState('');
  const [characterDraft, setCharacterDraft] = useState(null);
  const [characterBusy, setCharacterBusy] = useState(false);
  const [characterImageBusy, setCharacterImageBusy] = useState(false);
  const [characterDeleteArmed, setCharacterDeleteArmed] = useState(false);
  const [characterDeleteConfirmName, setCharacterDeleteConfirmName] = useState('');
  const [adminAccess, setAdminAccess] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkAdminAccess = async () => {
      if (!token) {
        if (!cancelled) {
          setAdminAccess(false);
          setAdminCheckLoading(false);
        }
        return;
      }

      if (user?.role === 'admin' || isPrimaryAdmin(user?.email)) {
        if (!cancelled) {
          setAdminAccess(true);
          setAdminCheckLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setAdminCheckLoading(true);
      }

      try {
        const response = await axios.get('/api/profile/me', {
          headers: { 'x-auth-token': token }
        });
        const isAdmin =
          response?.data?.role === 'admin' ||
          isPrimaryAdmin(response?.data?.email);
        if (!cancelled) {
          setAdminAccess(Boolean(isAdmin));
        }
      } catch (_error) {
        if (!cancelled) {
          setAdminAccess(false);
        }
      } finally {
        if (!cancelled) {
          setAdminCheckLoading(false);
        }
      }
    };

    checkAdminAccess();
    return () => {
      cancelled = true;
    };
  }, [token, user?.role, user?.email]);

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

  const fetchCharacters = useCallback(async () => {
    try {
      const response = await axios.get('/api/characters', {
        params: { _: Date.now() },
        headers: token ? { 'x-auth-token': token } : undefined
      });
      setCharacters(Array.isArray(response.data) ? response.data : []);
      setCharactersError('');
    } catch (err) {
      console.error('Error fetching characters:', err);
      setCharactersError('Failed to load characters.');
    } finally {
      setCharactersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !adminAccess) {
      setAlertsLoading(false);
      setUsersLoading(false);
      setCharactersLoading(false);
      return;
    }

    fetchAlerts();
    fetchUsers();
    fetchCharacters();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [token, adminAccess, fetchAlerts, fetchUsers, fetchCharacters]);

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

  const filteredCharacters = (Array.isArray(characters) ? characters : []).filter((entry) => {
    if (!characterSearch.trim()) return true;
    const query = characterSearch.trim().toLowerCase();
    const name = String(entry?.name || '').toLowerCase();
    const baseName = String(entry?.baseName || '').toLowerCase();
    const universe = String(entry?.universe || '').toLowerCase();
    const tags = Array.isArray(entry?.tags) ? entry.tags.join(' ').toLowerCase() : '';
    return (
      name.includes(query) ||
      baseName.includes(query) ||
      universe.includes(query) ||
      tags.includes(query)
    );
  });

  const openCharacterDraft = (entry) => {
    const safe = entry || {};
    setCharacterDeleteArmed(false);
    setCharacterDeleteConfirmName('');
    setCharacterDraft({
      id: safe.id || '',
      name: safe.name || '',
      baseName: safe.baseName || '',
      universe: safe.universe || '',
      tags: Array.isArray(safe.tags) ? safe.tags.join(', ') : '',
      image: safe.image || ''
    });
  };

  const newCharacterDraft = () => {
    setCharacterDeleteArmed(false);
    setCharacterDeleteConfirmName('');
    setCharacterDraft({
      id: '',
      name: '',
      baseName: '',
      universe: 'Other',
      tags: '',
      image: ''
    });
  };

  const uploadCharacterImage = async (file) => {
    if (!token || !file) return null;
    const form = new FormData();
    form.append('image', file);
    setCharacterImageBusy(true);
    try {
      const res = await axios.post('/api/characters/upload', form, {
        headers: { 'x-auth-token': token }
      });
      return res.data?.path || null;
    } catch (err) {
      console.error('Error uploading character image:', err);
      setCharactersError(err?.response?.data?.msg || 'Failed to upload character image.');
      return null;
    } finally {
      setCharacterImageBusy(false);
    }
  };

  const saveCharacterDraft = async () => {
    if (!token || !characterDraft) return;
    if (!String(characterDraft.name || '').trim()) {
      setCharactersError('Character name is required.');
      return;
    }
    if (!String(characterDraft.image || '').trim()) {
      setCharactersError('Character image is required.');
      return;
    }

    setCharacterBusy(true);
    setCharactersError('');
    try {
      const payload = {
        id: characterDraft.id || undefined,
        name: characterDraft.name,
        baseName: characterDraft.baseName,
        universe: characterDraft.universe,
        tags: characterDraft.tags,
        image: characterDraft.image
      };

      if (characterDraft.id) {
        await axios.put(`/api/characters/${encodeURIComponent(characterDraft.id)}`, payload, {
          headers: { 'x-auth-token': token }
        });
      } else {
        const createRes = await axios.post('/api/characters', payload, {
          headers: { 'x-auth-token': token }
        });
        const created = createRes.data;
        setCharacterDraft((prev) => (prev ? { ...prev, id: created?.id || prev.id } : prev));
      }

      await fetchCharacters();
    } catch (err) {
      console.error('Error saving character:', err);
      setCharactersError(err?.response?.data?.msg || 'Failed to save character.');
    } finally {
      setCharacterBusy(false);
    }
  };

  const confirmDeleteCharacter = async () => {
    if (!token || !characterDraft?.id) {
      return;
    }

    const expectedName = String(characterDraft.name || '').trim();
    const typedName = String(characterDeleteConfirmName || '').trim();
    if (!expectedName || typedName.toLowerCase() !== expectedName.toLowerCase()) {
      setCharactersError('Type the exact character name to confirm deletion.');
      return;
    }

    setCharacterBusy(true);
    setCharactersError('');
    try {
      await axios.delete(`/api/characters/${encodeURIComponent(characterDraft.id)}`, {
        headers: { 'x-auth-token': token },
        data: {
          confirmPhrase: 'DELETE',
          confirmName: expectedName
        }
      });

      setCharacterDraft(null);
      setCharacterDeleteArmed(false);
      setCharacterDeleteConfirmName('');
      await fetchCharacters();
    } catch (err) {
      console.error('Error deleting character:', err);
      setCharactersError(err?.response?.data?.msg || 'Failed to delete character.');
    } finally {
      setCharacterBusy(false);
    }
  };

  if (adminCheckLoading) {
    return (
      <div className="admin-panel access-denied">
        <h2>Checking access...</h2>
      </div>
    );
  }

  if (!token || !adminAccess) {
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
        <button
          type="button"
          className={`admin-tab ${activeTab === 'characters' ? 'active' : ''}`}
          onClick={() => setActiveTab('characters')}
        >
          Characters
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

      {activeTab === 'characters' && (
        <div className="admin-characters-panel">
          <div className="admin-characters-toolbar">
            <input
              type="text"
              value={characterSearch}
              onChange={(event) => setCharacterSearch(event.target.value)}
              placeholder="Search characters..."
            />
            <button type="button" className="admin-refresh" onClick={fetchCharacters}>
              Refresh
            </button>
            <button type="button" className="admin-refresh" onClick={newCharacterDraft}>
              Add character
            </button>
          </div>

          {charactersLoading && <div className="admin-status">Loading characters...</div>}
          {!charactersLoading && charactersError && (
            <div className="admin-status error">{charactersError}</div>
          )}

          {!charactersLoading && !charactersError && filteredCharacters.length === 0 && (
            <div className="admin-status">No characters match this search.</div>
          )}

          {!charactersLoading && filteredCharacters.length > 0 && (
            <div className="admin-character-grid">
              {filteredCharacters.slice(0, 200).map((entry) => (
                <button
                  key={entry.id || entry.name}
                  type="button"
                  className="admin-character-card"
                  onClick={() => openCharacterDraft(entry)}
                  title="Edit character"
                >
                  <img
                    {...getOptimizedImageProps(entry.image || '/logo512.png', { size: 56 })}
                    alt={entry.name}
                    className="admin-character-thumb"
                  />
                  <div className="admin-character-meta">
                    <strong>{entry.name}</strong>
                    <span>{entry.universe || 'Other'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {characterDraft && (
            <div className="admin-character-editor">
              <div className="admin-character-editor-header">
                <h2>{characterDraft.id ? 'Edit character' : 'Add character'}</h2>
                <button
                  type="button"
                  className="admin-delete"
                  onClick={() => {
                    setCharacterDraft(null);
                    setCharacterDeleteArmed(false);
                    setCharacterDeleteConfirmName('');
                  }}
                >
                  Close
                </button>
              </div>

              <div className="admin-character-form">
                <label>
                  Name *
                  <input
                    value={characterDraft.name}
                    onChange={(e) =>
                      setCharacterDraft((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Base name
                  <input
                    value={characterDraft.baseName}
                    onChange={(e) =>
                      setCharacterDraft((prev) => ({ ...prev, baseName: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Universe
                  <input
                    value={characterDraft.universe}
                    onChange={(e) =>
                      setCharacterDraft((prev) => ({ ...prev, universe: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Tags (comma separated)
                  <input
                    value={characterDraft.tags}
                    onChange={(e) =>
                      setCharacterDraft((prev) => ({ ...prev, tags: e.target.value }))
                    }
                  />
                </label>

                <div className="admin-character-image-row">
                  <div className="admin-character-image-preview">
                    <img
                      {...getOptimizedImageProps(characterDraft.image || '/logo512.png', { size: 120 })}
                      alt="Character"
                    />
                  </div>
                  <div className="admin-character-image-actions">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const uploaded = await uploadCharacterImage(file);
                        if (uploaded) {
                          setCharacterDraft((prev) => ({ ...prev, image: uploaded }));
                        }
                      }}
                    />
                    <div className="admin-character-image-hint">
                      {characterImageBusy ? 'Uploading...' : 'Upload a new image (webp optimized).'} 
                    </div>
                    <label>
                      Image path
                      <input
                        value={characterDraft.image}
                        onChange={(e) =>
                          setCharacterDraft((prev) => ({ ...prev, image: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="admin-character-actions">
                  {characterDraft.id && (
                    <button
                      type="button"
                      className="admin-delete"
                      disabled={characterBusy}
                      onClick={() => {
                        setCharacterDeleteArmed((prev) => !prev);
                        setCharacterDeleteConfirmName('');
                        setCharactersError('');
                      }}
                    >
                      {characterDeleteArmed ? 'Cancel delete' : 'Delete character'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-refresh"
                    disabled={characterBusy}
                    onClick={saveCharacterDraft}
                  >
                    {characterBusy ? 'Saving...' : 'Save'}
                  </button>
                </div>

                {characterDraft.id && characterDeleteArmed && (
                  <div className="admin-character-delete-confirm">
                    <p>
                      Type <strong>{characterDraft.name}</strong> to confirm deletion.
                    </p>
                    <input
                      value={characterDeleteConfirmName}
                      onChange={(event) => setCharacterDeleteConfirmName(event.target.value)}
                      placeholder="Type exact character name"
                    />
                    <button
                      type="button"
                      className="admin-delete"
                      disabled={characterBusy}
                      onClick={confirmDeleteCharacter}
                    >
                      {characterBusy ? 'Deleting...' : 'Confirm delete'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
