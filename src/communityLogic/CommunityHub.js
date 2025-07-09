import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './CommunityHub.css';

const CommunityHub = ({ user }) => {
  const [activeTab, setActiveTab] = useState('discussions');
  const [discussions, setDiscussions] = useState([]);
  const [topDebates, setTopDebates] = useState([]);
  const [characterRankings, setCharacterRankings] = useState([]);
  const [communityPolls, setCommunityPolls] = useState([]);
  const [newDiscussion, setNewDiscussion] = useState({ title: '', content: '', category: 'general' });
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const tabs = {
    discussions: { name: 'Discussions', icon: '💬', count: discussions.length },
    debates: { name: 'Hot Debates', icon: '🔥', count: topDebates.length },
    rankings: { name: 'Character Rankings', icon: '👑', count: characterRankings.length },
    polls: { name: 'Community Polls', icon: '🗳️', count: communityPolls.length }
  };

  const categories = {
    general: { name: 'General Discussion', icon: '💭', color: '#6c757d' },
    powerScaling: { name: 'Power Scaling', icon: '⚡', color: '#ffd700' },
    versus: { name: 'Versus Debates', icon: '⚔️', color: '#ff6b6b' },
    universeAnalysis: { name: 'Universe Analysis', icon: '🌍', color: '#4ecdc4' },
    theories: { name: 'Theories & Lore', icon: '🧠', color: '#9b59b6' },
    tournaments: { name: 'Tournament Talk', icon: '🏆', color: '#f39c12' }
  };

  useEffect(() => {
    fetchCommunityData();
  }, []);

  const fetchCommunityData = async () => {
    try {
      const [discussionsRes, debatesRes, rankingsRes, pollsRes] = await Promise.all([
        axios.get('/api/community/discussions'),
        axios.get('/api/community/hot-debates'),
        axios.get('/api/community/character-rankings'),
        axios.get('/api/community/polls')
      ]);

      setDiscussions(discussionsRes.data || []);
      setTopDebates(debatesRes.data || []);
      setCharacterRankings(rankingsRes.data || []);
      setCommunityPolls(pollsRes.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching community data:', error);
      setLoading(false);
    }
  };

  const handleCreateDiscussion = async () => {
    if (!newDiscussion.title.trim() || !newDiscussion.content.trim() || !user) return;

    try {
      const response = await axios.post('/api/community/discussions', {
        ...newDiscussion,
        userId: user.id,
        timestamp: new Date()
      });

      setDiscussions(prev => [response.data, ...prev]);
      setNewDiscussion({ title: '', content: '', category: 'general' });
      
      // Trigger achievement
      if (window.checkAchievement) {
        window.checkAchievement('SOCIAL_INTERACTION', 1);
      }
    } catch (error) {
      console.error('Error creating discussion:', error);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const DiscussionsTab = () => (
    <div className="discussions-tab">
      {user && (
        <div className="create-discussion">
          <h3>🎤 Start a Discussion</h3>
          <div className="discussion-form">
            <div className="form-row">
              <input
                type="text"
                placeholder="Discussion title..."
                value={newDiscussion.title}
                onChange={(e) => setNewDiscussion(prev => ({ ...prev, title: e.target.value }))}
                className="title-input"
              />
              <select
                value={newDiscussion.category}
                onChange={(e) => setNewDiscussion(prev => ({ ...prev, category: e.target.value }))}
                className="category-select"
              >
                {Object.entries(categories).map(([key, cat]) => (
                  <option key={key} value={key}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="What's on your mind? Share your thoughts, theories, or questions..."
              value={newDiscussion.content}
              onChange={(e) => setNewDiscussion(prev => ({ ...prev, content: e.target.value }))}
              rows={4}
              className="content-input"
            />
            <div className="form-actions">
              <button 
                onClick={handleCreateDiscussion}
                disabled={!newDiscussion.title.trim() || !newDiscussion.content.trim()}
                className="create-btn"
              >
                📝 Create Discussion
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="discussions-list">
        {discussions.map(discussion => (
          <div key={discussion.id} className="discussion-card">
            <div className="discussion-header">
              <div className="category-badge" style={{ backgroundColor: categories[discussion.category]?.color }}>
                {categories[discussion.category]?.icon} {categories[discussion.category]?.name}
              </div>
              <span className="discussion-time">{formatTimeAgo(discussion.createdAt)}</span>
            </div>
            
            <h4 className="discussion-title">{discussion.title}</h4>
            <p className="discussion-preview">{discussion.content.substring(0, 200)}...</p>
            
            <div className="discussion-footer">
              <div className="discussion-author">
                <img src={discussion.user?.avatar} alt={discussion.user?.username} />
                <span>{discussion.user?.username}</span>
                {discussion.user?.isModerator && <span className="mod-badge">MOD</span>}
              </div>
              
              <div className="discussion-stats">
                <span className="stat-item">
                  💬 {discussion.replyCount || 0} replies
                </span>
                <span className="stat-item">
                  👍 {discussion.likes || 0} likes
                </span>
                <span className="stat-item">
                  👀 {discussion.views || 0} views
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const DebatesTab = () => (
    <div className="debates-tab">
      <div className="debates-header">
        <h3>🔥 Hottest Community Debates</h3>
        <p>Join the most heated discussions in the community</p>
      </div>
      
      <div className="debates-list">
        {topDebates.map(debate => (
          <div key={debate.id} className="debate-card">
            <div className="debate-heat">
              <span className="heat-level">🔥</span>
              <span className="heat-score">{debate.heatScore || 85}</span>
            </div>
            
            <div className="debate-content">
              <h4>{debate.title}</h4>
              <div className="debate-sides">
                <div className="side pro">
                  <span className="side-label">Pro:</span>
                  <span className="side-count">{debate.proCount || 0} votes</span>
                </div>
                <div className="vs">VS</div>
                <div className="side con">
                  <span className="side-label">Con:</span>
                  <span className="side-count">{debate.conCount || 0} votes</span>
                </div>
              </div>
              
              <div className="debate-footer">
                <span className="debate-participants">
                  👥 {debate.participantCount || 0} participants
                </span>
                <span className="debate-time">
                  ⏰ {formatTimeAgo(debate.lastActivity)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const RankingsTab = () => (
    <div className="rankings-tab">
      <div className="rankings-header">
        <h3>👑 Community Character Rankings</h3>
        <p>See how the community ranks their favorite characters</p>
      </div>
      
      <div className="ranking-categories">
        {['Overall Power', 'Combat Skills', 'Intelligence', 'Popularity'].map(category => (
          <div key={category} className="ranking-category">
            <h4>{category}</h4>
            <div className="ranking-list">
              {[1, 2, 3, 4, 5].map(rank => (
                <div key={rank} className="ranking-item">
                  <span className="rank-number">#{rank}</span>
                  <img src={`/characters/placeholder.jpg`} alt="Character" />
                  <div className="character-info">
                    <span className="character-name">Character {rank}</span>
                    <span className="character-universe">Universe</span>
                  </div>
                  <div className="ranking-score">
                    <span className="score">{100 - rank * 5}%</span>
                    <span className="votes">({1000 - rank * 100} votes)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const PollsTab = () => (
    <div className="polls-tab">
      <div className="polls-header">
        <h3>🗳️ Community Polls</h3>
        <p>Vote on important community questions</p>
      </div>
      
      <div className="polls-list">
        {communityPolls.map(poll => (
          <div key={poll.id} className="poll-card">
            <div className="poll-header">
              <h4>{poll.question}</h4>
              <span className="poll-status">
                {poll.isActive ? '🟢 Active' : '🔴 Closed'}
              </span>
            </div>
            
            <div className="poll-options">
              {poll.options?.map((option, index) => (
                <div key={index} className="poll-option">
                  <div className="option-bar">
                    <div 
                      className="option-fill"
                      style={{ width: `${(option.votes / poll.totalVotes) * 100}%` }}
                    ></div>
                  </div>
                  <div className="option-info">
                    <span className="option-text">{option.text}</span>
                    <span className="option-percentage">
                      {Math.round((option.votes / poll.totalVotes) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="poll-footer">
              <span className="total-votes">📊 {poll.totalVotes} total votes</span>
              <span className="poll-time">⏰ {formatTimeAgo(poll.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="community-loading">
        <div className="loading-spinner"></div>
        <p>Loading community content...</p>
      </div>
    );
  }

  return (
    <div className="community-hub">
      <div className="community-header">
        <h1>🌟 Community Hub</h1>
        <p>Connect with fellow geeks, share theories, and debate your favorite characters</p>
        
        <div className="community-stats">
          <div className="stat-card">
            <span className="stat-number">1,234</span>
            <span className="stat-label">Active Members</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">5,678</span>
            <span className="stat-label">Discussions</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">12,345</span>
            <span className="stat-label">Comments</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">98,765</span>
            <span className="stat-label">Votes Cast</span>
          </div>
        </div>
      </div>

      <div className="community-tabs">
        {Object.entries(tabs).map(([key, tab]) => (
          <button
            key={key}
            className={`tab-button ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-name">{tab.name}</span>
            <span className="tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="community-content">
        {activeTab === 'discussions' && <DiscussionsTab />}
        {activeTab === 'debates' && <DebatesTab />}
        {activeTab === 'rankings' && <RankingsTab />}
        {activeTab === 'polls' && <PollsTab />}
      </div>

      <div className="community-sidebar">
        <div className="trending-topics">
          <h4>🔥 Trending Topics</h4>
          <div className="topics-list">
            {['#PowerScaling', '#DragonBallSuper', '#MarvelVsDC', '#AnimeDebates', '#Comics'].map(topic => (
              <span key={topic} className="trending-topic">{topic}</span>
            ))}
          </div>
        </div>
        
        <div className="active-users">
          <h4>👥 Most Active Users</h4>
          <div className="users-list">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="active-user">
                <img src={`/avatars/user${i}.jpg`} alt={`User ${i}`} />
                <div className="user-info">
                  <span className="username">User{i}</span>
                  <span className="user-points">{1000 - i * 100} points</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityHub;