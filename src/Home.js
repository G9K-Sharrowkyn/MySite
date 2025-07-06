import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { replacePlaceholderUrl, placeholderImages } from './utils/placeholderImage';
import { useLanguage } from './i18n/LanguageContext';
import './Home.css';

const Home = () => {
  const [officialFights, setOfficialFights] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    totalFights: 0,
    totalVotes: 0
  });

  const { t } = useLanguage();
  const isLoggedIn = !!localStorage.getItem('token');

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    try {
      const [postsRes, usersRes, officialFightsRes] = await Promise.all([
        axios.get('/api/posts?limit=20'),
        axios.get('/api/profile/leaderboard'),
        axios.get('/api/divisions').catch(() => ({ data: [] })) // Get official fights from divisions
      ]);

      const posts = postsRes.data.posts || postsRes.data;
      
      // Get official fights (moderator-created fights)
      const official = posts.filter(post => 
        post.type === 'fight' && post.isOfficial
      ).slice(0, 6);
      
      // Get recent community posts (non-official)
      const recent = posts.filter(post => !post.isOfficial).slice(0, 8);
      
      // Get top users
      const topUsersList = (usersRes.data || []).slice(0, 6);

      setOfficialFights(official);
      setRecentPosts(recent);
      setTopUsers(topUsersList);

      // Calculate stats
      const totalFights = posts.filter(p => p.type === 'fight').length;
      const totalVotes = posts.reduce((sum, post) => {
        if (post.type === 'fight' && post.fight?.votes) {
          return sum + (post.fight.votes.teamA || 0) + (post.fight.votes.teamB || 0);
        }
        return sum;
      }, 0);

      setStats({
        totalUsers: topUsersList.length,
        totalPosts: posts.length,
        totalFights,
        totalVotes
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching home data:', error);
      setLoading(false);
    }
  };

  const handleVote = async (postId, team) => {
    if (!isLoggedIn) {
      alert(t('mustBeLoggedInToVote') || 'You must be logged in to vote!');
      return;
    }

    try {
      await axios.post(`/api/votes/fight/${postId}`, { team }, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      
      // Refresh data to show updated votes
      fetchHomeData();
    } catch (error) {
      console.error('Error voting:', error);
      alert(t('voteError') || 'Error voting. You may have already voted.');
    }
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return t('now');
    if (diffInMinutes < 60) return `${diffInMinutes}${t('minutesAgo')}`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}${t('hoursAgo')}`;
    return `${Math.floor(diffInMinutes / 1440)}${t('daysAgo')}`;
  };

  const getPostTypeIcon = (type) => {
    switch (type) {
      case 'fight': return '⚔️';
      case 'image': return '🖼️';
      case 'poll': return '📊';
      default: return '💬';
    }
  };

  if (loading) {
    return (
      <div className="home-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-content">
            <div className="hero-text">
              <h1>🌟 {t('welcomeTitle')}</h1>
              <p className="hero-subtitle">
                {t('welcomeSubtitle')}
              </p>
              
              <div className="hero-stats">
                <div className="stat-item">
                  <span className="stat-number">{stats.totalUsers}</span>
                  <span className="stat-label">{t('geeks')}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{stats.totalFights}</span>
                  <span className="stat-label">{t('fights')}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{stats.totalVotes}</span>
                  <span className="stat-label">{t('votes')}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{stats.totalPosts}</span>
                  <span className="stat-label">{t('posts')}</span>
                </div>
              </div>

              {!isLoggedIn ? (
                <div className="hero-actions">
                  <Link to="/register" className="btn btn-primary btn-large">
                    🚀 {t('joinFree')}
                  </Link>
                  <Link to="/login" className="btn btn-outline btn-large">
                    🔑 {t('login')}
                  </Link>
                </div>
              ) : (
                <div className="hero-actions">
                  <Link to="/feed" className="btn btn-primary btn-large">
                    📱 {t('feed')}
                  </Link>
                  <Link to="/leaderboard" className="btn btn-outline btn-large">
                    🏆 {t('seeRanking')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Official Fights Section */}
      {officialFights.length > 0 && (
        <section className="official-fights-section">
          <div className="section-header">
            <h2>🏆 {t('officialFights')}</h2>
            <p>{t('officialFightsDesc')}</p>
          </div>
          
          <div className="official-fights-grid">
            {officialFights.map(fight => (
              <div key={fight.id} className="official-fight-card">
                <div className="fight-header">
                  <div className="fight-badges">
                    <span className="badge badge-official">🛡️ {t('official')}</span>
                  </div>
                  <span className="fight-time">{formatTimeAgo(fight.createdAt)}</span>
                </div>
                
                <h3 className="fight-title">{fight.title}</h3>
                <p className="fight-description">{fight.content}</p>
                
                <div className="fight-battle">
                  <button 
                    className="fighter-btn fighter-a"
                    onClick={() => handleVote(fight.id, 'A')}
                    disabled={!isLoggedIn}
                  >
                    <span className="fighter-name">{fight.teamA}</span>
                    <span className="vote-count">{fight.fight?.votes?.teamA || 0}</span>
                  </button>
                  
                  <div className="vs-divider">VS</div>
                  
                  <button 
                    className="fighter-btn fighter-b"
                    onClick={() => handleVote(fight.id, 'B')}
                    disabled={!isLoggedIn}
                  >
                    <span className="fighter-name">{fight.teamB}</span>
                    <span className="vote-count">{fight.fight?.votes?.teamB || 0}</span>
                  </button>
                </div>
                
                <div className="fight-stats">
                  <span>👍 {fight.likes?.length || 0}</span>
                  <span>💬 {fight.comments?.length || 0}</span>
                  <span>🗳️ {(fight.fight?.votes?.teamA || 0) + (fight.fight?.votes?.teamB || 0)}</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="section-footer">
            <Link to="/divisions" className="btn btn-primary">{t('divisions')}</Link>
          </div>
        </section>
      )}

      {/* Community Feed Section */}
      <section className="community-feed-section">
        <div className="section-header">
          <h2>🔥 {t('communityFeed')}</h2>
          <p>{t('latestFromCommunity')}</p>
        </div>
        
        <div className="activity-container">
          <div className="recent-posts">
            <h3>📱 {t('recentPosts')}</h3>
            <div className="posts-list">
              {recentPosts.slice(0, 6).map(post => (
                <Link key={post.id} to={`/post/${post.id}`} className="post-preview-link">
                  <div className="post-preview">
                    <div className="post-icon">{getPostTypeIcon(post.type)}</div>
                    <div className="post-info">
                      <h4>{post.title}</h4>
                      <p>{t('by')} {post.author?.username || t('anonymous')}</p>
                      <span className="post-time">{formatTimeAgo(post.createdAt)}</span>
                    </div>
                    <div className="post-stats">
                      <span>👍 {post.likes?.length || 0}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <Link to="/feed" className="view-all-link">{t('seeAllPosts')} →</Link>
          </div>

          <div className="top-users">
            <h3>🏅 {t('topPlayers')}</h3>
            <div className="users-list">
              {topUsers.map((user, index) => (
                <div key={user.id} className="user-preview">
                  <div className="user-rank">#{index + 1}</div>
                  <img 
                    src={replacePlaceholderUrl(user.profilePicture) || placeholderImages.userSmall}
                    alt={user.username}
                    className="user-avatar"
                  />
                  <div className="user-info">
                    <h4>{user.username}</h4>
                    <p>{user.rank}</p>
                    <span className="user-points">{user.points} {t('points')}</span>
                  </div>
                  <div className="user-stats">
                    <span>🏆 {user.victories}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/leaderboard" className="view-all-link">{t('seeFullRanking')} →</Link>
          </div>
        </div>
      </section>

      {/* Features Section - Only show when not logged in */}
      {!isLoggedIn && (
        <>
          <section className="features-section">
            <h2>🎮 {t('featuresTitle')}</h2>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">⚔️</div>
                <h3>{t('createFightsFeature')}</h3>
                <p>{t('createFightsDesc')}</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🗳️</div>
                <h3>{t('voteFeature')}</h3>
                <p>{t('voteDesc')}</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">💬</div>
                <h3>{t('discussFeature')}</h3>
                <p>{t('discussDesc')}</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🏆</div>
                <h3>{t('competeFeature')}</h3>
                <p>{t('competeDesc')}</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">👥</div>
                <h3>{t('communityFeature')}</h3>
                <p>{t('communityDesc')}</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎭</div>
                <h3>{t('charactersFeature')}</h3>
                <p>{t('charactersDesc')}</p>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="cta-section">
            <div className="cta-content">
              <h2>🚀 {t('readyForAdventure')}</h2>
              <p>{t('joinThousands')}</p>
              <div className="cta-actions">
                <Link to="/register" className="btn btn-primary btn-large">
                  ✨ {t('registerFree')}
                </Link>
                <Link to="/characters" className="btn btn-outline btn-large">
                  🎮 {t('seeCharacters')}
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Home;