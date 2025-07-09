import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './EnhancedProfile.css';

const EnhancedProfile = ({ userId, currentUser, isOwnProfile }) => {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [profileComments, setProfileComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [divisionRecords, setDivisionRecords] = useState([]);
  const [fightHistory, setFightHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const tabs = {
    overview: { name: 'Overview', icon: '👤' },
    divisions: { name: 'Divisions', icon: '🏆' },
    fights: { name: 'Fight History', icon: '⚔️' },
    achievements: { name: 'Achievements', icon: '🏅' },
    comments: { name: 'Comments', icon: '💬' }
  };

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchProfileComments();
      fetchDivisionRecords();
      fetchFightHistory();
    }
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`/api/users/${userId}/profile`);
      const userData = response.data;
      
      setProfile(userData);
      setEditData({
        bio: userData.bio || '',
        location: userData.location || '',
        favoriteUniverse: userData.favoriteUniverse || '',
        website: userData.website || '',
        birthDate: userData.birthDate || '',
        interests: userData.interests || []
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setLoading(false);
    }
  };

  const fetchProfileComments = async () => {
    try {
      const response = await axios.get(`/api/users/${userId}/profile-comments`);
      setProfileComments(response.data || []);
    } catch (error) {
      console.error('Error fetching profile comments:', error);
    }
  };

  const fetchDivisionRecords = async () => {
    try {
      const response = await axios.get(`/api/users/${userId}/division-records`);
      setDivisionRecords(response.data || []);
    } catch (error) {
      console.error('Error fetching division records:', error);
    }
  };

  const fetchFightHistory = async () => {
    try {
      const response = await axios.get(`/api/users/${userId}/fight-history`);
      setFightHistory(response.data || []);
    } catch (error) {
      console.error('Error fetching fight history:', error);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await axios.put(`/api/users/${userId}/profile`, editData);
      setProfile(prev => ({ ...prev, ...editData }));
      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile.');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    try {
      const response = await axios.post(`/api/users/${userId}/profile-comments`, {
        authorId: currentUser.id,
        content: newComment.trim(),
        timestamp: new Date()
      });

      setProfileComments(prev => [response.data, ...prev]);
      setNewComment('');
      
      // Trigger achievement for social interaction
      if (window.checkAchievement) {
        window.checkAchievement('SOCIAL_INTERACTION', 1);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getTotalRecord = () => {
    return divisionRecords.reduce(
      (total, division) => ({
        wins: total.wins + division.wins,
        losses: total.losses + division.losses
      }),
      { wins: 0, losses: 0 }
    );
  };

  const getWinPercentage = () => {
    const record = getTotalRecord();
    const total = record.wins + record.losses;
    return total > 0 ? Math.round((record.wins / total) * 100) : 0;
  };

  const getChampionshipDivisions = () => {
    return divisionRecords.filter(division => division.isChampion);
  };

  const OverviewTab = () => (
    <div className="overview-tab">
      <div className="profile-stats">
        <div className="stat-card">
          <span className="stat-number">{getTotalRecord().wins}</span>
          <span className="stat-label">Total Wins</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{getTotalRecord().losses}</span>
          <span className="stat-label">Total Losses</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{getWinPercentage()}%</span>
          <span className="stat-label">Win Rate</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{getChampionshipDivisions().length}</span>
          <span className="stat-label">Championships</span>
        </div>
      </div>

      <div className="profile-info-section">
        <h3>About {profile?.username}</h3>
        {isEditing ? (
          <div className="edit-form">
            <div className="form-group">
              <label>Bio</label>
              <textarea
                value={editData.bio}
                onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell us about yourself..."
                rows={4}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={editData.location}
                  onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Your location"
                />
              </div>
              <div className="form-group">
                <label>Favorite Universe</label>
                <select
                  value={editData.favoriteUniverse}
                  onChange={(e) => setEditData(prev => ({ ...prev, favoriteUniverse: e.target.value }))}
                >
                  <option value="">Select Universe</option>
                  <option value="Dragon Ball">Dragon Ball</option>
                  <option value="Marvel">Marvel</option>
                  <option value="DC">DC</option>
                  <option value="Anime">Anime</option>
                  <option value="Gaming">Gaming</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Website</label>
              <input
                type="url"
                value={editData.website}
                onChange={(e) => setEditData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://your-website.com"
              />
            </div>
            <div className="form-actions">
              <button onClick={handleSaveProfile} className="save-btn">Save Changes</button>
              <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="profile-info">
            <div className="info-item">
              <span className="info-label">Bio:</span>
              <span className="info-value">{profile?.bio || 'No bio available'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Location:</span>
              <span className="info-value">{profile?.location || 'Not specified'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Favorite Universe:</span>
              <span className="info-value">{profile?.favoriteUniverse || 'Not specified'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Joined:</span>
              <span className="info-value">{formatDate(profile?.createdAt)}</span>
            </div>
            {profile?.website && (
              <div className="info-item">
                <span className="info-label">Website:</span>
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="info-link">
                  {profile.website}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const DivisionsTab = () => (
    <div className="divisions-tab">
      <div className="divisions-header">
        <h3>Division Records</h3>
        <p>Official records in each division</p>
      </div>
      
      <div className="division-records">
        {divisionRecords.map(division => (
          <div key={division.id} className={`division-record ${division.isChampion ? 'champion' : ''}`}>
            <div className="division-info">
              <div className="division-name">
                {division.icon} {division.name}
                {division.isChampion && <span className="champion-crown">👑</span>}
              </div>
              <div className="team-fighters">
                {division.team?.fighters.map(fighter => (
                  <img key={fighter.id} src={fighter.image} alt={fighter.name} />
                ))}
              </div>
            </div>
            
            <div className="record-stats">
              <div className="record-item">
                <span className="record-number wins">{division.wins}</span>
                <span className="record-label">Wins</span>
              </div>
              <div className="record-item">
                <span className="record-number losses">{division.losses}</span>
                <span className="record-label">Losses</span>
              </div>
              <div className="record-item">
                <span className="record-number">
                  {division.wins + division.losses > 0 
                    ? Math.round((division.wins / (division.wins + division.losses)) * 100)
                    : 0}%
                </span>
                <span className="record-label">Win Rate</span>
              </div>
            </div>
            
            {division.isChampion && (
              <div className="championship-info">
                <span className="title-holder">🏆 CHAMPION</span>
                <span className="title-since">Since {formatDate(division.titleWonDate)}</span>
                <span className="title-defenses">{division.titleDefenses || 0} defenses</span>
              </div>
            )}
          </div>
        ))}
        
        {divisionRecords.length === 0 && (
          <div className="no-divisions">
            <p>No division records yet. Join a division to start competing!</p>
          </div>
        )}
      </div>
    </div>
  );

  const FightsTab = () => (
    <div className="fights-tab">
      <div className="fights-header">
        <h3>Fight History</h3>
        <p>Recent official fights and results</p>
      </div>
      
      <div className="fight-history">
        {fightHistory.map(fight => (
          <div key={fight.id} className={`fight-record ${fight.result}`}>
            <div className="fight-date">
              {formatDate(fight.date)}
            </div>
            
            <div className="fight-info">
              <div className="opponent-info">
                <img src={fight.opponent.avatar} alt={fight.opponent.username} />
                <span className="opponent-name">{fight.opponent.username}</span>
              </div>
              
              <div className="fight-details">
                <span className="division-name">{fight.division.name}</span>
                <span className="fight-type">
                  {fight.isTitle ? '👑 Title Fight' : 'Official Fight'}
                </span>
              </div>
              
              <div className="fight-result">
                <span className={`result-badge ${fight.result}`}>
                  {fight.result === 'win' ? 'W' : 'L'}
                </span>
                <span className="vote-info">
                  {fight.userVotes} - {fight.opponentVotes}
                </span>
              </div>
            </div>
            
            {fight.isTitle && fight.result === 'win' && (
              <div className="title-won">
                🏆 Won {fight.division.name} Championship
              </div>
            )}
          </div>
        ))}
        
        {fightHistory.length === 0 && (
          <div className="no-fights">
            <p>No fight history yet. Participate in official fights to build your record!</p>
          </div>
        )}
      </div>
    </div>
  );

  const CommentsTab = () => (
    <div className="comments-tab">
      <div className="comments-header">
        <h3>Profile Comments</h3>
        <p>What others are saying</p>
      </div>
      
      {currentUser && !isOwnProfile && (
        <div className="comment-input">
          <div className="user-avatar">
            <img src={currentUser.avatar} alt={currentUser.username} />
          </div>
          <div className="input-area">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={`Write something on ${profile?.username}'s profile...`}
              rows={3}
            />
            <button 
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="post-comment-btn"
            >
              Post Comment
            </button>
          </div>
        </div>
      )}
      
      <div className="comments-list">
        {profileComments.map(comment => (
          <div key={comment.id} className="profile-comment">
            <div className="comment-avatar">
              <img src={comment.author.avatar} alt={comment.author.username} />
            </div>
            <div className="comment-content">
              <div className="comment-header">
                <span className="comment-author">{comment.author.username}</span>
                {comment.author.isModerator && <span className="mod-badge">MOD</span>}
                <span className="comment-time">{formatDate(comment.createdAt)}</span>
              </div>
              <p className="comment-text">{comment.content}</p>
              <div className="comment-actions">
                <button className="like-btn">👍 {comment.likes || 0}</button>
                <button className="reply-btn">Reply</button>
              </div>
            </div>
          </div>
        ))}
        
        {profileComments.length === 0 && (
          <div className="no-comments">
            <p>No comments yet. Be the first to leave a comment!</p>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="enhanced-profile">
      <div className={`profile-header ${profile?.isChampion ? 'champion-profile' : ''}`}>
        <div className="profile-background">
          {profile?.isChampion && <div className="champion-effects"></div>}
        </div>
        
        <div className="profile-main-info">
          <div className="profile-avatar">
            <img src={profile?.avatar} alt={profile?.username} />
            {profile?.isChampion && <div className="champion-ring"></div>}
          </div>
          
          <div className="profile-details">
            <h1 className={`username ${profile?.isChampion ? 'champion-name' : ''}`}>
              {profile?.username}
              {profile?.isChampion && <span className="champion-crown">👑</span>}
            </h1>
            
            {profile?.isChampion && (
              <div className="champion-titles">
                {getChampionshipDivisions().map(division => (
                  <span key={division.id} className="title-badge">
                    {division.name} Champion
                  </span>
                ))}
              </div>
            )}
            
            <div className="profile-badges">
              {profile?.isModerator && <span className="role-badge moderator">🛡️ Moderator</span>}
              {profile?.isVerified && <span className="role-badge verified">✅ Verified</span>}
              <span className="join-date">Joined {formatDate(profile?.createdAt)}</span>
            </div>
            
            <div className="quick-stats">
              <span className="stat-item">
                <strong>{getTotalRecord().wins}W - {getTotalRecord().losses}L</strong>
                <small>Overall Record</small>
              </span>
              <span className="stat-item">
                <strong>{getChampionshipDivisions().length}</strong>
                <small>Championships</small>
              </span>
              <span className="stat-item">
                <strong>{profile?.totalFights || 0}</strong>
                <small>Total Fights</small>
              </span>
            </div>
          </div>
          
          <div className="profile-actions">
            {isOwnProfile ? (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="edit-profile-btn"
              >
                {isEditing ? 'Cancel Edit' : 'Edit Profile'}
              </button>
            ) : (
              <div className="social-actions">
                <button className="follow-btn">
                  👥 Follow
                </button>
                <button className="message-btn">
                  💬 Message
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="profile-navigation">
        {Object.entries(tabs).map(([key, tab]) => (
          <button
            key={key}
            className={`nav-tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-name">{tab.name}</span>
          </button>
        ))}
      </div>

      <div className="profile-content">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'divisions' && <DivisionsTab />}
        {activeTab === 'fights' && <FightsTab />}
        {activeTab === 'comments' && <CommentsTab />}
      </div>
    </div>
  );
};

export default EnhancedProfile;