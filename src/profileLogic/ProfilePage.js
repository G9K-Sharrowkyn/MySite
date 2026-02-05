import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  replacePlaceholderUrl,
  placeholderImages,
  getOptimizedImageProps,
  normalizeAssetUrl
} from '../utils/placeholderImage';
import { ChampionUsername, getChampionTitle } from '../utils/championUtils';
import { useLanguage } from '../i18n/LanguageContext';
import ImageUpload from '../ImageUpload/ImageUpload';
import ProfileBackgroundUpload from './ProfileBackgroundUpload';
import UserBadges from './UserBadges';
import PostCard from '../postLogic/PostCard';
import UserHoverMenu from '../shared/UserHoverMenu';
import './ProfilePage.css';

const ProfilePage = () => {
  const { userId } = useParams();
  const { t } = useLanguage();

  // Initialize profile state from localStorage if available
  const storedProfile = localStorage.getItem('cachedProfile');
  const initialProfile = storedProfile ? JSON.parse(storedProfile) : null;
  const normalizeDescription = useCallback((value) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.toLowerCase() === 'nodescription') return '';
    return trimmed;
  }, []);

  const [profile, setProfile] = useState(initialProfile);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(
    normalizeDescription(initialProfile?.description)
  );
  const [displayName, setDisplayName] = useState(
    initialProfile?.displayName || initialProfile?.username || ''
  );
  const [profilePicture, setProfilePicture] = useState(initialProfile?.profilePicture || '');
  const [backgroundImage, setBackgroundImage] = useState(initialProfile?.profile?.backgroundImage || '');
  const [loading, setLoading] = useState(initialProfile === null); // only true if no profile yet
  const [error, setError] = useState(null);
  const [posts, setPosts] = useState([]);
  const [contentFilter, setContentFilter] = useState('all');
  const [fightFilter, setFightFilter] = useState('division');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [friendStatus, setFriendStatus] = useState({ status: 'unknown', requestId: null });
  const [blockStatus, setBlockStatus] = useState({ blocked: false, blockedBy: false });
  const isEditingRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  const currentUserId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  const actualUserId = userId === 'me' ? currentUserId : userId;
  const resolvedUserId =
    profile?.id ||
    profile?._id ||
    profile?.userId ||
    (userId === 'me' ? currentUserId : null);
  const isOwner = Boolean(currentUserId && resolvedUserId && currentUserId === resolvedUserId);


  const fetchComments = useCallback(async (id) => {
    try {
      const res = await axios.get(`/api/comments/user/${id}`);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Błąd podczas pobierania komentarzy:', err);
    }
  }, []);

  const fetchUserPosts = useCallback(async (id) => {
    try {
      const response = await axios.get(`/api/posts/user/${id}`);
      const postsWithImages = response.data.map(post => ({
        ...post,
        author: {
          ...post.author,
          profilePicture: replacePlaceholderUrl(post.author?.profilePicture)
        }
      }));
      setPosts(postsWithImages);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  }, []);

  const fetchProfile = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (userId === 'me') {
        // Use the authenticated /api/profile/me endpoint
        const token = localStorage.getItem('token');
        if (!token) {
          setError(t('profileNotFound') || 'Cannot find your profile. Please log in again.');
          setLoading(false);
          return;
        }
        res = await axios.get('/api/profile/me', {
          headers: {
            'x-auth-token': token,
          },
        });
      } else {
        // Use the public /api/profile/:userId endpoint
        res = await axios.get(`/api/profile/${id}`);
      }
        const normalizedDescription = normalizeDescription(res.data.description);
        setProfile({ ...res.data, description: normalizedDescription });
        if (!isEditingRef.current) {
          setDescription(normalizedDescription);
          setDisplayName(res.data.displayName || res.data.username || '');
          setProfilePicture(res.data.profilePicture || '');
          setBackgroundImage(res.data.profile?.backgroundImage || '');
        }
        const resolvedId = res.data?.id || res.data?._id || id;
        if (resolvedId) {
          fetchComments(resolvedId);
          fetchUserPosts(resolvedId);
        }
      if (userId === 'me' && res.data?.username) {
        navigate(`/profile/${res.data.username}`, { replace: true });
      }
      setLoading(false);
      // Update localStorage cache
      localStorage.setItem('cachedProfile', JSON.stringify(res.data));
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError(t('profileFetchError') || 'Error loading profile or profile does not exist.');
      setLoading(false);
    }
  }, [fetchComments, fetchUserPosts, navigate, normalizeDescription, t, userId]);

  const fetchFriends = useCallback(async (idOrUsername) => {
    try {
      const response = await axios.get(`/api/friends/user/${encodeURIComponent(idOrUsername)}`);
      setFriends(response.data?.friends || []);
    } catch (error) {
      setFriends([]);
    }
  }, []);

  const fetchRelationStatus = useCallback(async (targetId) => {
    if (!token || !targetId || isOwner) return;
    try {
      const [friendRes, blockRes] = await Promise.all([
        axios.get(`/api/friends/status/${encodeURIComponent(targetId)}`, {
          headers: { 'x-auth-token': token }
        }),
        axios.get(`/api/blocks/status/${encodeURIComponent(targetId)}`, {
          headers: { 'x-auth-token': token }
        })
      ]);
      setFriendStatus(friendRes.data || { status: 'none' });
      setBlockStatus(blockRes.data || { blocked: false, blockedBy: false });
    } catch (_error) {
      setFriendStatus({ status: 'unknown', requestId: null });
      setBlockStatus({ blocked: false, blockedBy: false });
    }
  }, [isOwner, token]);

  const fetchMyFriendRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/friends/requests', {
        headers: { 'x-auth-token': token }
      });
      setFriendRequests(res.data || { incoming: [], outgoing: [] });
    } catch (_error) {
      setFriendRequests({ incoming: [], outgoing: [] });
    }
  }, [token]);
  useEffect(() => {
    if (!actualUserId) {
      setError(t('profileNotFound') || 'Cannot find your profile. Please log in again.');
      setLoading(false);
      return;
    }
    fetchProfile(actualUserId);
  }, [actualUserId, fetchProfile, t]);

  useEffect(() => {
    const idOrUsername = profile?.username || actualUserId;
    if (idOrUsername) {
      fetchFriends(idOrUsername);
    }
  }, [actualUserId, fetchFriends, profile?.username]);

  useEffect(() => {
    if (!resolvedUserId) return;
    fetchRelationStatus(resolvedUserId);
  }, [fetchRelationStatus, resolvedUserId]);

  useEffect(() => {
    if (isOwner) {
      fetchMyFriendRequests();
    }
  }, [fetchMyFriendRequests, isOwner]);



const handleCommentSubmit = async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  if (!resolvedUserId) return;
  if (!token) {
    console.error('Musisz być zalogowany, aby dodać komentarz.');
    return;
  }
  try {
    await axios.post(`/api/comments/user/${resolvedUserId}`, 
      { 
        text: newComment,
        userId: resolvedUserId
      }, 
      {
        headers: {
          'x-auth-token': token,
          },
        }
    );
    setNewComment('');
    await fetchComments(resolvedUserId);
  } catch (err) {
    console.error('Błąd podczas dodawania komentarza:', err.response?.data);
  }
};

  const handleCommentDelete = async (commentId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await axios.delete(`/api/comments/${commentId}`, {
        headers: {
          'x-auth-token': token,
        },
      });
      await fetchComments(resolvedUserId);
    } catch (err) {
      console.error('Błąd podczas usuwania komentarza:', err.response?.data);
    }
  };


  const handleFilterChange = (filter) => {
    setContentFilter(filter);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Musisz być zalogowany, aby edytować profil.');
      return;
    }
    try {
      await axios.put('/api/profile/me', { 
        displayName,
        description, 
        profilePicture,
        backgroundImage 
      }, {
        headers: {
          'x-auth-token': token,
        },
      });
      setIsEditing(false);
      fetchProfile(resolvedUserId || currentUserId);
    } catch (err) {
      console.error('Błąd podczas aktualizacji profilu:', err.response?.data);
    }
  };

  const sendFriendRequest = async () => {
    if (!token || !resolvedUserId) return;
    try {
      await axios.post('/api/friends/requests', { toUserId: resolvedUserId }, {
        headers: { 'x-auth-token': token }
      });
      await fetchRelationStatus(resolvedUserId);
    } catch (_error) {}
  };

  const acceptFriendRequest = async (requestId) => {
    if (!token || !requestId) return;
    try {
      await axios.post(`/api/friends/requests/${encodeURIComponent(requestId)}/accept`, {}, {
        headers: { 'x-auth-token': token }
      });
      await fetchMyFriendRequests();
      await fetchRelationStatus(resolvedUserId);
      await fetchFriends(profile?.username || actualUserId);
    } catch (_error) {}
  };

  const declineFriendRequest = async (requestId) => {
    if (!token || !requestId) return;
    try {
      await axios.post(`/api/friends/requests/${encodeURIComponent(requestId)}/decline`, {}, {
        headers: { 'x-auth-token': token }
      });
      await fetchMyFriendRequests();
      await fetchRelationStatus(resolvedUserId);
    } catch (_error) {}
  };

  const removeFriend = async () => {
    if (!token || !resolvedUserId) return;
    try {
      await axios.delete(`/api/friends/${encodeURIComponent(resolvedUserId)}`, {
        headers: { 'x-auth-token': token }
      });
      await fetchRelationStatus(resolvedUserId);
      await fetchFriends(profile?.username || actualUserId);
    } catch (_error) {}
  };

  const blockUser = async () => {
    if (!token || !resolvedUserId) return;
    try {
      await axios.post(`/api/blocks/${encodeURIComponent(resolvedUserId)}`, {}, {
        headers: { 'x-auth-token': token }
      });
      await fetchRelationStatus(resolvedUserId);
      await fetchFriends(profile?.username || actualUserId);
    } catch (_error) {}
  };

  const unblockUser = async () => {
    if (!token || !resolvedUserId) return;
    try {
      await axios.delete(`/api/blocks/${encodeURIComponent(resolvedUserId)}`, {
        headers: { 'x-auth-token': token }
      });
      await fetchRelationStatus(resolvedUserId);
    } catch (_error) {}
  };

  const handleBackgroundUpdate = (newBackgroundPath) => {
    setBackgroundImage(newBackgroundPath);
    setProfile(prev => ({
      ...prev,
      profile: {
        ...prev.profile,
        backgroundImage: newBackgroundPath
      }
    }));
  };

  const isChampion = profile?.divisions && Object.values(profile.divisions).some(d => d.isChampion);
  const championTitle = getChampionTitle(profile?.divisions);
  const normalizedDescription = normalizeDescription(profile?.description);
  const normalizedBackgroundImage = normalizeAssetUrl(backgroundImage);
  const hasDescription = Boolean(normalizedDescription);
  const divisionEntries = useMemo(() => {
    if (!profile?.divisions) return [];
    return Object.entries(profile.divisions)
      .map(([divisionId, division]) => {
        const team = division?.team || {};
        const displayCharacter =
          division?.selectedCharacter ||
          team.mainCharacter ||
          team.fighters?.[0] ||
          team.secondaryCharacter ||
          team.fighters?.[1] ||
          null;
        return { divisionId, division, displayCharacter };
      })
      .filter((entry) => entry.displayCharacter);
  }, [profile?.divisions]);
  const hasDivisions = divisionEntries.length > 0;
  const hasComments = comments.length > 0;

  const postCategoryCounts = useMemo(() => {
    return posts.reduce((acc, post) => {
      const category = post.category || post.type;
      if (!category) return acc;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
  }, [posts]);

  const displayedPosts = useMemo(() => {
    if (contentFilter === 'all') return posts;
    return posts.filter((post) => {
      const category = post.category || post.type;
      return category === contentFilter;
    });
  }, [posts, contentFilter]);

  useEffect(() => {
    if (contentFilter === 'all') return;
    if (!postCategoryCounts[contentFilter]) {
      setContentFilter('all');
    }
  }, [contentFilter, postCategoryCounts]);

  if (loading && profile === null) return <div className="profile-page"><p>{t('loadingProfile') || 'Loading profile...'}</p></div>;
  if (error) return <div className="profile-page"><p style={{color: 'red'}}>{error}</p><button onClick={() => navigate('/login')}>{t('loginAgain') || 'Log in again'}</button></div>;

  return (
    <div className="profile-page">
      {normalizedBackgroundImage && (
        <div className="profile-background-banner"
             style={{
               backgroundImage: `url(${normalizedBackgroundImage})`,
               backgroundSize: 'cover',
               backgroundPosition: 'center'
             }}>
        </div>
      )}
      
      <div className={`profile-header ${isChampion ? 'champion-profile-background' : ''}`}>
        <img
          {...getOptimizedImageProps(
            replacePlaceholderUrl(profile.profilePicture) || placeholderImages.user,
            { size: 150 }
          )}
          alt={t('profilePicture') || 'Profile picture'}
          className="profile-picture"
        />
        <div className="profile-info">
          <h2>
            <ChampionUsername user={profile} showCrown={true} />
          </h2>
          {profile?.displayName && profile?.username && profile.displayName !== profile.username && (
            <p className="profile-handle">@{profile.username}</p>
          )}
          {championTitle && (
            <p className="champion-title-display">{championTitle}</p>
          )}
          <p className="profile-rank">
            {t('points') || 'Points'}: {profile.points || 0} | {t('rank') || 'Rank'}: {profile.rank}
          </p>
          
          <div className="fight-stats-cards">
            <div className="stats-card official-card">
              <h4 className="stats-card-title">
                {t('officialDivisions') || 'Official (Divisions)'}
              </h4>
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-number official">{profile.stats?.officialStats?.fightsWon || 0}</div>
                  <div className="stat-label-bottom">{t('wins') || 'Wins'}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number official">{profile.stats?.officialStats?.fightsLost || 0}</div>
                  <div className="stat-label-bottom">{t('losses') || 'Losses'}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number official">{profile.stats?.officialStats?.fightsDrawn || 0}</div>
                  <div className="stat-label-bottom">{t('draws') || 'Draws'}</div>
                </div>
              </div>
            </div>
            
            <div className="stats-card unofficial-card">
              <h4 className="stats-card-title">
                {t('unofficialCommunity') || 'Unofficial (Community)'}
              </h4>
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-number unofficial">{profile.stats?.unofficialStats?.fightsWon || 0}</div>
                  <div className="stat-label-bottom">{t('wins') || 'Wins'}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number unofficial">{profile.stats?.unofficialStats?.fightsLost || 0}</div>
                  <div className="stat-label-bottom">{t('losses') || 'Losses'}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number unofficial">{profile.stats?.unofficialStats?.fightsDrawn || 0}</div>
                  <div className="stat-label-bottom">{t('draws') || 'Draws'}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="profile-actions">
            {isOwner && (
              <button onClick={() => setIsEditing(!isEditing)} className="edit-profile-btn">
                {isEditing
                  ? (t('cancelEdit') || 'Cancel')
                  : (t('editProfile') || 'Edit Profile')}
              </button>
            )}
            {!isOwner && resolvedUserId && (
              <>
                <Link 
                  to={`/messages/${resolvedUserId}`}
                  className="send-message-btn"
                >
                  Message me!
                </Link>

                {!blockStatus.blockedBy && (
                  <div className="friend-actions">
                    {blockStatus.blocked ? (
                      <button className="friend-btn secondary" onClick={unblockUser}>
                        Unblock
                      </button>
                    ) : (
                      <button className="friend-btn danger" onClick={blockUser}>
                        Block
                      </button>
                    )}

                    {!blockStatus.blocked && (
                      <>
                        {friendStatus.status === 'friends' && (
                          <button className="friend-btn secondary" onClick={removeFriend}>
                            Remove friend
                          </button>
                        )}
                        {friendStatus.status === 'none' && (
                          <button className="friend-btn primary" onClick={sendFriendRequest}>
                            Add friend
                          </button>
                        )}
                        {friendStatus.status === 'outgoing' && (
                          <button className="friend-btn secondary" disabled>
                            Request sent
                          </button>
                        )}
                        {friendStatus.status === 'incoming' && (
                          <>
                            <button
                              className="friend-btn primary"
                              onClick={() => acceptFriendRequest(friendStatus.requestId)}
                            >
                              Accept
                            </button>
                            <button
                              className="friend-btn secondary"
                              onClick={() => declineFriendRequest(friendStatus.requestId)}
                            >
                              Decline
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="friends-card">
        <div className="friends-card-header">
          <h3>Friends</h3>
          <span className="friends-count">{friends.length}</span>
        </div>
        {friends.length === 0 ? (
          <p className="friends-empty">No friends yet.</p>
        ) : (
          <div className="friends-grid">
            {friends.slice(0, 24).map((f) => (
              <UserHoverMenu key={f.id} user={f}>
                <Link to={`/profile/${encodeURIComponent(f.username)}`} className="friend-tile">
                  <img
                    {...getOptimizedImageProps(replacePlaceholderUrl(f.profilePicture) || placeholderImages.userSmall, { size: 48 })}
                    alt={f.displayName || f.username}
                  />
                  <span>{f.displayName || f.username}</span>
                </Link>
              </UserHoverMenu>
            ))}
          </div>
        )}
      </div>

      {isOwner && (
        <div className="friends-card">
          <div className="friends-card-header">
            <h3>Friend requests</h3>
            <span className="friends-count">{friendRequests.incoming.length}</span>
          </div>
          {friendRequests.incoming.length === 0 ? (
            <p className="friends-empty">No incoming requests.</p>
          ) : (
            <div className="friend-requests">
              {friendRequests.incoming.slice(0, 20).map((req) => (
                <div key={req.id} className="friend-request-row">
                  <Link to={`/profile/${encodeURIComponent(req.from.username)}`} className="friend-request-user">
                    {req.from.displayName || req.from.username}
                  </Link>
                  <div className="friend-request-actions">
                    <button className="friend-btn primary" onClick={() => acceptFriendRequest(req.id)}>Accept</button>
                    <button className="friend-btn secondary" onClick={() => declineFriendRequest(req.id)}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isEditing && isOwner ? (
        <form onSubmit={handleProfileUpdate} className="edit-profile-form">
          <ProfileBackgroundUpload 
            currentBackground={backgroundImage}
            onBackgroundUpdate={handleBackgroundUpdate}
          />
          <div className="form-group">
            <label>{t('profilePicture') || 'Profile picture'}:</label>
            <ImageUpload 
              currentImage={profilePicture}
              onImageChange={setProfilePicture}
              className="profile-picture"
            />
          </div>
          <div className="form-group">
            <label>Nick:</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="form-group">
            <label>{t('description') || 'Description'}:</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
          </div>
          <button type="submit" className="btn-primary">{t('saveChanges') || 'Save Changes'}</button>
        </form>
        ) : (
          hasDescription && (
            <div className="profile-details">
              <h3>{t('description') || 'Description'}:</h3>
              <p>{normalizedDescription}</p>
            </div>
          )
        )}

      {resolvedUserId && (
        <UserBadges
          userId={resolvedUserId}
          isOwner={isOwner}
        />
      )}

      <div className="profile-posts">
        <div className="posts-header">
          <h3>{t('posts') || 'Posts'}:</h3>
          <div className="content-filter-buttons">
            <button
              className={`filter-btn ${contentFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleFilterChange('all')}
            >
              {t('all') || 'All'}
            </button>
            {postCategoryCounts.fight > 0 && (
              <button
                className={`filter-btn ${contentFilter === 'fight' ? 'active' : ''}`}
                onClick={() => handleFilterChange('fight')}
              >
                {t('fights') || 'Fights'}
              </button>
            )}
            {postCategoryCounts.discussion > 0 && (
              <button
                className={`filter-btn ${contentFilter === 'discussion' ? 'active' : ''}`}
                onClick={() => handleFilterChange('discussion')}
              >
                {t('discussions') || 'Discussions'}
              </button>
            )}
            {postCategoryCounts.article > 0 && (
              <button
                className={`filter-btn ${contentFilter === 'article' ? 'active' : ''}`}
                onClick={() => handleFilterChange('article')}
              >
                {t('articles') || 'Articles'}
              </button>
            )}
          </div>
        </div>
        <div className="posts-grid">
          {displayedPosts.length > 0 ? (
            displayedPosts.map(post => (
              <div key={post.id} className="profile-post-link">
                <PostCard 
                  post={post}
                  onUpdate={(updatedPost) => {
                    setPosts(prevPosts => 
                      prevPosts.map(p => p.id === updatedPost.id ? updatedPost : p)
                    );
                  }}
                  showEditDelete={isOwner || profile.role === 'moderator'}
                  onDelete={async (postId) => {
                    if (!token) return;
                    try {
                      await axios.delete(`/api/posts/${postId}`, {
                        headers: { 'x-auth-token': token }
                      });
                      setPosts(prevPosts => prevPosts.filter(p => p.id !== postId));
                    } catch (error) {
                      console.error('Error deleting post:', error);
                    }
                  }}
                />
              </div>
            ))
          ) : (
            <p className="no-posts-message">
              {contentFilter === 'all' && (t('noPosts') || 'No posts.')}
              {contentFilter === 'fight' && (t('noFightPosts') || 'No fights.')}
              {contentFilter === 'discussion' && (t('noDiscussionPosts') || 'No discussions.')}
              {contentFilter === 'article' && (t('noArticlePosts') || 'No articles.')}
            </p>
          )}
        </div>
      </div>

      {hasDivisions && (
        <div className="profile-divisions">
          <h3>{t('teamsInDivisions') || 'Teams in Divisions'}:</h3>
          <div className="divisions-grid">
            {divisionEntries.map(({ divisionId, division, displayCharacter }) => {
              const divisionName = division.divisionName || division.name || divisionId;
              return (
                <div key={divisionId} className="division-card">
                  <h4>{divisionName}</h4>
                  <div className="division-character">
                    <img 
                      {...getOptimizedImageProps(
                        replacePlaceholderUrl(displayCharacter.image) ||
                          placeholderImages.character,
                        { size: 80 }
                      )}
                      alt={displayCharacter.name} 
                      className="character-image" 
                    />
                    <p className="character-name">{displayCharacter.name}</p>
                    <p className="character-stats">
                      Wins: {division.wins || 0} | Losses: {division.losses || 0}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="profile-fights">
        <div className="fight-tabs">
          <button 
            className={`fight-tab ${fightFilter === 'division' ? 'active' : ''}`}
            onClick={() => setFightFilter('division')}
          >
            {t('divisionFightHistory') || 'Division Fight History'}
          </button>
          <button 
            className={`fight-tab ${fightFilter === 'unofficial' ? 'active' : ''}`}
            onClick={() => setFightFilter('unofficial')}
          >
            {t('unofficialFightHistory') || 'Unofficial Fight History'}
          </button>
        </div>

        {fightFilter === 'division' && (
          <div className="fights-list">
            {profile.fights && profile.fights.filter(f => f.source === 'division').length > 0 ? (
              profile.fights.filter(f => f.source === 'division').slice(0, 10).map(fight => (
                <Link 
                  key={fight.id} 
                  to={`/post/${fight.id}`}
                  className="fight-item-link"
                >
                  <div className="fight-item">
                    <div className="fight-participants">
                      <span className={fight.winnerId === profile.id ? 'winner' : 'participant'}>
                        {fight.fighter1 || (t('unknown') || 'Unknown')}
                      </span>
                      <span className="vs">vs</span>
                      <span className={fight.winnerId === profile.id ? 'winner' : 'participant'}>
                        {fight.fighter2 || (t('unknown') || 'Unknown')}
                      </span>
                    </div>
                    <div className="fight-result">
                      {fight.winnerId === profile.id ? `🏆 ${t('victory') || 'Victory'}` :
                       fight.winner === 'draw' ? `🤝 ${t('draw') || 'Draw'}` : `❌ ${t('defeat') || 'Defeat'}`}
                    </div>
                    <div className="fight-date">
                      {new Date(fight.createdAt || fight.date).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p>{t('noDivisionFights') || 'No division fights yet.'}</p>
            )}
          </div>
        )}

        {fightFilter === 'unofficial' && (
          <div className="fights-list">
            {profile.fights && profile.fights.filter(f => f.source === 'fight').length > 0 ? (
              profile.fights.filter(f => f.source === 'fight').slice(0, 10).map(fight => (
                <Link 
                  key={fight.id} 
                  to={`/post/${fight.id}`}
                  className="fight-item-link"
                >
                  <div className="fight-item">
                    <div className="fight-participants">
                      <span className={fight.winnerId === profile.id ? 'winner' : 'participant'}>
                        {fight.fighter1 || (t('unknown') || 'Unknown')}
                      </span>
                      <span className="vs">vs</span>
                      <span className={fight.winnerId === profile.id ? 'winner' : 'participant'}>
                        {fight.fighter2 || (t('unknown') || 'Unknown')}
                      </span>
                    </div>
                    <div className="fight-result">
                      {fight.winnerId === profile.id ? `🏆 ${t('victory') || 'Victory'}` :
                       fight.winner === 'draw' ? `🤝 ${t('draw') || 'Draw'}` : `❌ ${t('defeat') || 'Defeat'}`}
                    </div>
                    <div className="fight-date">
                      {new Date(fight.createdAt || fight.date).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p>{t('noUnofficialFights') || 'No unofficial fights yet.'}</p>
            )}
          </div>
        )}
      </div>

      {hasComments && (
      <div className="comments-section">
        <h3>{t('comments') || 'Comments'}:</h3>
        {!isOwner && (
          <form onSubmit={handleCommentSubmit} className="add-comment-form">
            <textarea
              placeholder={t('addCommentPlaceholder') || 'Add a comment...'}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              required
              maxLength={500}
            ></textarea>
            <div className="comment-controls">
              <span className="char-count">{newComment.length}/500</span>
              <button type="submit" className="btn-primary" disabled={!newComment.trim()}>
                {t('addComment') || 'Add Comment'}
              </button>
            </div>
          </form>
        )}
        <div className="comments-list">
          {comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id} className="comment-item">
                <div className="comment-header">
                  <div className="comment-author">
                    <Link to={`/profile/${comment.authorId}`}>
                      <img
                        {...getOptimizedImageProps(
                          replacePlaceholderUrl(comment.authorAvatar) || placeholderImages.userSmall,
                          { size: 24 }
                        )}
                        alt={comment.authorDisplayName || comment.authorUsername}
                        className="author-avatar"
                      />
                      <strong>{comment.authorDisplayName || comment.authorUsername}</strong>
                    </Link>
                  </div>
                  <span className="comment-date">
                    {new Date(comment.timestamp).toLocaleString()}
                  </span>
                  {(currentUserId === comment.authorId || profile.role === 'moderator') && (
                    <button
                      onClick={() => handleCommentDelete(comment.id)}
                      className="delete-comment-btn"
                      title={t('deleteComment') || 'Delete comment'}
                    >
                      🗑️
                    </button>
                  )}
                </div>
                <p className="comment-text">{comment.text}</p>
              </div>
            ))
          ) : (
            <p>{t('noComments') || 'No comments.'}</p>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default ProfilePage;
