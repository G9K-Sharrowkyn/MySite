import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { replacePlaceholderUrl, placeholderImages, getOptimizedImageProps } from '../utils/placeholderImage';
import { ChampionUsername, getChampionTitle } from '../utils/championUtils';
import { useLanguage } from '../i18n/LanguageContext';
import ImageUpload from '../ImageUpload/ImageUpload';
import ProfileBackgroundUpload from './ProfileBackgroundUpload';
import UserBadges from './UserBadges';
import PostCard from '../postLogic/PostCard';
import './ProfilePage.css';

const ProfilePage = () => {
  const { userId } = useParams();
  const { t, lang } = useLanguage();

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
  const [profilePicture, setProfilePicture] = useState(initialProfile?.profilePicture || '');
  const [backgroundImage, setBackgroundImage] = useState(initialProfile?.profile?.backgroundImage || '');
  const [loading, setLoading] = useState(initialProfile === null); // only true if no profile yet
  const [error, setError] = useState(null);
  const [posts, setPosts] = useState([]);
  const [contentFilter, setContentFilter] = useState('all');
  const navigate = useNavigate();

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
        setDescription(normalizedDescription);
        setProfilePicture(res.data.profilePicture || '');
        setBackgroundImage(res.data.profile?.backgroundImage || '');
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
  useEffect(() => {
    if (!actualUserId) {
      setError(t('profileNotFound') || 'Cannot find your profile. Please log in again.');
      setLoading(false);
      return;
    }
    fetchProfile(actualUserId);
  }, [actualUserId, fetchProfile, t]);



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
      <div className={`profile-header ${isChampion ? 'champion-profile-background' : ''}`}
           style={backgroundImage ? {
             backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(${backgroundImage})`,
             backgroundSize: 'cover',
             backgroundPosition: 'center'
           } : {}}>
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
          {championTitle && (
            <p className="champion-title-display">{championTitle}</p>
          )}
          <p className="profile-rank">
            {t('points') || 'Points'}: {profile.points || 0} | {t('rank') || 'Rank'}: {profile.rank}
          </p>
          <div className="fight-stats-vertical">
            <div className="stats-category official-stats">
              <h4 className="stats-category-title">
                {lang === 'pl' ? 'Oficjalne (Dywizje)' : lang === 'de' ? 'Offiziell (Divisionen)' : 'Official (Divisions)'}
              </h4>
              <div className="stats-row">
                  <span className="stat-item">
                    <span className="stat-label">{t('wins') || 'Wins'}:</span>
                    <span className="stat-value official">{profile.stats?.officialStats?.fightsWon || 0}</span>
                  </span>
                  <span className="stat-item">
                    <span className="stat-label">{t('losses') || 'Losses'}:</span>
                    <span className="stat-value official">{profile.stats?.officialStats?.fightsLost || 0}</span>
                  </span>
                  <span className="stat-item">
                    <span className="stat-label">{t('draws') || 'Draws'}:</span>
                    <span className="stat-value official">{profile.stats?.officialStats?.fightsDrawn || 0}</span>
                  </span>
              </div>
            </div>
            <div className="stats-category unofficial-stats">
              <h4 className="stats-category-title">
                {lang === 'pl' ? 'Nieoficjalne (Społeczność)' : lang === 'de' ? 'Inoffiziell (Community)' : 'Unofficial (Community)'}
              </h4>
              <div className="stats-row">
                  <span className="stat-item">
                    <span className="stat-label">{t('wins') || 'Wins'}:</span>
                    <span className="stat-value unofficial">{profile.stats?.unofficialStats?.fightsWon || 0}</span>
                  </span>
                  <span className="stat-item">
                    <span className="stat-label">{t('losses') || 'Losses'}:</span>
                    <span className="stat-value unofficial">{profile.stats?.unofficialStats?.fightsLost || 0}</span>
                  </span>
                  <span className="stat-item">
                    <span className="stat-label">{t('draws') || 'Draws'}:</span>
                    <span className="stat-value unofficial">{profile.stats?.unofficialStats?.fightsDrawn || 0}</span>
                  </span>
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
              <Link 
                to={`/messages?to=${resolvedUserId}&username=${profile.username}`} 
                className="send-message-btn"
              >
                {t('sendMessage') || 'Send Message'}
              </Link>
            )}
          </div>
        </div>
      </div>

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
        <h3>{t('fightHistory') || 'Fight History'}:</h3>
        {profile.fights && profile.fights.length > 0 ? (
          <div className="fights-list">
            {profile.fights.slice(0, 10).map(fight => (
              <div key={fight.id} className="fight-item">
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
            ))}
            {profile.fights.length > 10 && (
              <p className="more-fights">... {t('andMore') || 'and'} {profile.fights.length - 10} {t('moreFights') || 'more fights'}</p>
            )}
          </div>
        ) : (
          <p>{t('noFightHistory') || 'No fight history.'}</p>
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
                        alt={comment.authorUsername}
                        className="author-avatar"
                      />
                      <strong>{comment.authorUsername}</strong>
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
