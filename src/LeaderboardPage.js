import React, { useEffect, useState } from 'react';
import { useLanguage } from './i18n/LanguageContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './LeaderboardPage.css';

const LeaderboardPage = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [rankingType, setRankingType] = useState('experience');
  const [loading, setLoading] = useState(true);
  const [userAchievements, setUserAchievements] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  
  const { t } = useLanguage();
  const currentUserId = localStorage.getItem('userId');
  const navigate = useNavigate();

  useEffect(() => {
    fetchLeaderboard();
  }, [rankingType]);

  useEffect(() => {
    if (currentUserId) {
      fetchUserAchievements();
    }
  }, [currentUserId]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/stats/leaderboard?type=${rankingType}&limit=50`);
      setLeaderboard(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLoading(false);
    }
  };

  const fetchUserAchievements = async () => {
    try {
      const response = await axios.get(`/api/stats/user/${currentUserId}/achievements`);
      setUserAchievements(response.data);
    } catch (error) {
      console.error('Error fetching user achievements:', error);
    }
  };

  const fetchUserDetails = async (userId) => {
    try {
      const [statsResponse, achievementsResponse] = await Promise.all([
        axios.get(`/api/stats/user/${userId}`),
        axios.get(`/api/stats/user/${userId}/achievements`)
      ]);
      
      setSelectedUser({
        stats: statsResponse.data,
        achievements: achievementsResponse.data
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  const getRankingTypeLabel = (type) => {
    switch (type) {
      case 'experience':
        return t('experience') || 'Experience';
      case 'points':
        return t('points') || 'Points';
      case 'achievements':
        return t('achievements') || 'Achievements';
      case 'fights':
        return t('fights') || 'Fights';
      default:
        return t('experience') || 'Experience';
    }
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getAchievementIcon = (type) => {
    switch (type) {
      case 'tournament':
        return '🏆';
      case 'fight':
        return '⚔️';
      case 'vote':
        return '🗳️';
      case 'post':
        return '📝';
      case 'comment':
        return '💬';
      case 'streak':
        return '🔥';
      case 'division':
        return '👑';
      default:
        return '🏅';
    }
  };

  const renderUserDetails = () => {
    if (!selectedUser) return null;

    const { stats, achievements } = selectedUser;
    const earnedAchievements = achievements.filter(a => a.earned);
    const unearnedAchievements = achievements.filter(a => !a.earned);

    return (
      <div className="user-details-modal">
        <div className="user-details-content">
          <div className="user-details-header">
            <h2>{stats.username}</h2>
            <button 
              className="close-btn"
              onClick={() => setSelectedUser(null)}
            >
              ✕
            </button>
          </div>

          <div className="user-stats-overview">
            <div className="stat-card">
              <h3>📊 {t('stats') || 'Stats'}</h3>
              <div className="stat-grid">
                <div className="stat-item">
                  <span className="stat-label">{t('level') || 'Level'}</span>
                  <span className="stat-value">{stats.level}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t('experience') || 'Experience'}</span>
                  <span className="stat-value">{stats.experience || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t('points') || 'Points'}</span>
                  <span className="stat-value">{stats.points || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t('achievements') || 'Achievements'}</span>
                  <span className="stat-value">{earnedAchievements.length}</span>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <h3>⚔️ {t('fights') || 'Fights'}</h3>
              <div className="stat-grid">
                <div className="stat-item">
                  <span className="stat-label">{t('total') || 'Total'}</span>
                  <span className="stat-value">{stats.fights?.total || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t('wins') || 'Wins'}</span>
                  <span className="stat-value">{stats.fights?.wins || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t('winRate') || 'Win Rate'}</span>
                  <span className="stat-value">{stats.fights?.winRate || 0}%</span>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <h3>📈 {t('activity') || 'Activity'}</h3>
              <div className="stat-grid">
                <div className="stat-item">
                  <span className="stat-label">{t('posts') || 'Posts'}</span>
                  <span className="stat-value">{stats.posts || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t('comments') || 'Comments'}</span>
                  <span className="stat-value">{stats.comments || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t('votes') || 'Votes'}</span>
                  <span className="stat-value">{stats.votes || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="achievements-section">
            <h3>🏅 {t('achievements') || 'Achievements'}</h3>
            
            <div className="achievements-grid">
              {earnedAchievements.map(achievement => (
                <div key={achievement.id} className="achievement-card earned">
                  <div className="achievement-icon">
                    {getAchievementIcon(achievement.type)}
                  </div>
                  <div className="achievement-info">
                    <h4>{achievement.name}</h4>
                    <p>{achievement.description}</p>
                    <div className="achievement-reward">
                      <span>+{achievement.reward.experience} XP</span>
                      <span>+{achievement.reward.points} {t('points') || 'Points'}</span>
                    </div>
                    <div className="achievement-date">
                      {new Date(achievement.awardedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {unearnedAchievements.length > 0 && (
              <div className="unearned-achievements">
                <h4>{t('upcomingAchievements') || 'Upcoming Achievements'}</h4>
                <div className="achievements-grid">
                  {unearnedAchievements.slice(0, 6).map(achievement => (
                    <div key={achievement.id} className="achievement-card unearned">
                      <div className="achievement-icon">
                        {getAchievementIcon(achievement.type)}
                      </div>
                      <div className="achievement-info">
                        <h4>{achievement.name}</h4>
                        <p>{achievement.description}</p>
                        <div className="achievement-progress">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{ width: `${Math.min((achievement.progress / achievement.requirement) * 100, 100)}%` }}
                            ></div>
                          </div>
                          <span>{achievement.progress}/{achievement.requirement}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="leaderboard-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>{t('loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <h1>🏆 {t('leaderboard') || 'Leaderboard'}</h1>
        <div className="ranking-filters">
          <button 
            className={`filter-btn ${rankingType === 'experience' ? 'active' : ''}`}
            onClick={() => setRankingType('experience')}
          >
            📊 {t('experience') || 'Experience'}
          </button>
          <button 
            className={`filter-btn ${rankingType === 'points' ? 'active' : ''}`}
            onClick={() => setRankingType('points')}
          >
            ⭐ {t('points') || 'Points'}
          </button>
          <button 
            className={`filter-btn ${rankingType === 'achievements' ? 'active' : ''}`}
            onClick={() => setRankingType('achievements')}
          >
            🏅 {t('achievements') || 'Achievements'}
          </button>
          <button 
            className={`filter-btn ${rankingType === 'fights' ? 'active' : ''}`}
            onClick={() => setRankingType('fights')}
          >
            ⚔️ {t('fights') || 'Fights'}
          </button>
        </div>
      </div>

      <div className="leaderboard-container">
        <div className="leaderboard-table">
          <div className="table-header">
            <div className="header-rank">{t('rank') || 'Rank'}</div>
            <div className="header-user">{t('user') || 'User'}</div>
            <div className="header-level">{t('level') || 'Level'}</div>
            <div className="header-value">{getRankingTypeLabel(rankingType)}</div>
            <div className="header-achievements">{t('achievements') || 'Achievements'}</div>
          </div>

          {leaderboard.map((user, index) => (
            <div 
              key={user.userId} 
              className={`leaderboard-row ${user.userId === currentUserId ? 'current-user' : ''}`}
              onClick={() => navigate(`/profile/${user.userId}`)}
            >
              <div className="rank">
                <span className="rank-icon">{getRankIcon(user.rank)}</span>
              </div>
              <div className="user-info">
                <span className="username">{user.username}</span>
                {user.userId === currentUserId && (
                  <span className="current-user-badge">👤 {t('you') || 'You'}</span>
                )}
              </div>
              <div className="level">
                <span className="level-badge">Lv.{user.level}</span>
              </div>
              <div className="value">
                {rankingType === 'experience' && (
                  <span>{user.stats.experience || 0} XP</span>
                )}
                {rankingType === 'points' && (
                  <span>{user.stats.points || 0} {t('points') || 'Points'}</span>
                )}
                {rankingType === 'achievements' && (
                  <span>{user.achievements} {t('achievements') || 'Achievements'}</span>
                )}
                {rankingType === 'fights' && (
                  <span>{user.stats.fights?.total || 0} {t('fights') || 'Fights'}</span>
                )}
              </div>
              <div className="achievements">
                <span className="achievement-count">
                  {user.achievements} 🏅
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedUser && renderUserDetails()}
    </div>
  );
};

export default LeaderboardPage;
