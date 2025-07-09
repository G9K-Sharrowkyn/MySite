import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './VotingSystem.css';

const VotingSystem = ({ fight, user, onVoteComplete }) => {
  const [voteResults, setVoteResults] = useState({});
  const [userVote, setUserVote] = useState(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [voting, setVoting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [recentVoters, setRecentVoters] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [trending, setTrending] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (fight?.id) {
      fetchVoteResults();
      fetchComments();
      checkUserVote();
    }
  }, [fight?.id, user?.id]);

  const fetchVoteResults = async () => {
    try {
      const response = await axios.get(`/api/fights/${fight.id}/votes`);
      const results = response.data;
      
      setVoteResults({
        character1: results.character1Votes || 0,
        character2: results.character2Votes || 0
      });
      
      setTotalVotes((results.character1Votes || 0) + (results.character2Votes || 0));
      setRecentVoters(results.recentVoters || []);
      setTrending(results.totalVotes > 100 && results.hourlyVotes > 20);
    } catch (error) {
      console.error('Error fetching vote results:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/api/fights/${fight.id}/comments`);
      setComments(response.data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const checkUserVote = async () => {
    try {
      const response = await axios.get(`/api/fights/${fight.id}/user-vote/${user?.id}`);
      setUserVote(response.data.vote || null);
    } catch (error) {
      console.error('Error checking user vote:', error);
    }
  };

  const handleVote = async (characterChoice) => {
    if (!user) {
      alert('Please log in to vote!');
      return;
    }

    if (userVote) {
      alert('You have already voted on this fight!');
      return;
    }

    setVoting(true);

    try {
      await axios.post(`/api/fights/${fight.id}/vote`, {
        userId: user.id,
        characterChoice, // 'character1' or 'character2'
        timestamp: new Date()
      });

      // Update local state immediately for better UX
      setUserVote(characterChoice);
      setVoteResults(prev => ({
        ...prev,
        [characterChoice]: prev[characterChoice] + 1
      }));
      setTotalVotes(prev => prev + 1);

      // Trigger achievement check
      if (window.checkAchievement) {
        window.checkAchievement('VOTING', 1);
      }

      if (onVoteComplete) {
        onVoteComplete(characterChoice);
      }

      // Show results after voting
      setShowResults(true);
    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('Failed to submit vote. Please try again.');
    } finally {
      setVoting(false);
    }
  };

  const handleComment = async () => {
    if (!newComment.trim() || !user) return;

    try {
      const response = await axios.post(`/api/fights/${fight.id}/comments`, {
        userId: user.id,
        content: newComment.trim(),
        timestamp: new Date()
      });

      setComments(prev => [...prev, response.data]);
      setNewComment('');

      // Trigger achievement check
      if (window.checkAchievement) {
        window.checkAchievement('COMMENTING', 1);
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const getVotePercentage = (character) => {
    if (totalVotes === 0) return 0;
    return Math.round((voteResults[character] / totalVotes) * 100);
  };

  const getWinner = () => {
    if (voteResults.character1 > voteResults.character2) return 'character1';
    if (voteResults.character2 > voteResults.character1) return 'character2';
    return 'tie';
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="voting-system">
      {/* Fight Header */}
      <div className="fight-header">
        <div className="fight-title">
          <h2>{fight.title || `${fight.character1?.name} vs ${fight.character2?.name}`}</h2>
          {trending && <span className="trending-badge">🔥 TRENDING</span>}
          {fight.isOfficial && <span className="official-badge">⭐ OFFICIAL</span>}
        </div>
        
        <div className="fight-stats">
          <div className="stat-item">
            <span className="stat-number">{totalVotes}</span>
            <span className="stat-label">Total Votes</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{comments.length}</span>
            <span className="stat-label">Comments</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{formatTimeAgo(fight.createdAt)}</span>
            <span className="stat-label">Posted</span>
          </div>
        </div>
      </div>

      {/* Characters Display */}
      <div className="characters-battle">
        <div className={`character-side left ${userVote === 'character1' ? 'voted' : ''}`}>
          <div className="character-card" onClick={() => handleVote('character1')}>
            <div className="character-image">
              <img src={fight.character1?.image} alt={fight.character1?.name} />
              {userVote === 'character1' && <div className="vote-overlay">✓ YOUR VOTE</div>}
            </div>
            <div className="character-info">
              <h3>{fight.character1?.name}</h3>
              <p className="character-universe">{fight.character1?.universe}</p>
            </div>
            
            {(showResults || userVote) && (
              <div className="vote-results">
                <div className="vote-bar">
                  <div 
                    className="vote-fill character1"
                    style={{ width: `${getVotePercentage('character1')}%` }}
                  ></div>
                </div>
                <div className="vote-stats">
                  <span className="vote-count">{voteResults.character1} votes</span>
                  <span className="vote-percentage">{getVotePercentage('character1')}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="vs-divider">
          <div className="vs-text">VS</div>
          <div className="vote-action">
            {!userVote && !voting && (
              <div className="vote-prompt">
                <p>👆 Click to Vote 👆</p>
                <small>Who would win this fight?</small>
              </div>
            )}
            {voting && (
              <div className="voting-indicator">
                <div className="spinner"></div>
                <p>Submitting vote...</p>
              </div>
            )}
            {userVote && (
              <div className="vote-success">
                <p>✅ Vote submitted!</p>
                <button onClick={() => setShowResults(!showResults)}>
                  {showResults ? 'Hide' : 'Show'} Results
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`character-side right ${userVote === 'character2' ? 'voted' : ''}`}>
          <div className="character-card" onClick={() => handleVote('character2')}>
            <div className="character-image">
              <img src={fight.character2?.image} alt={fight.character2?.name} />
              {userVote === 'character2' && <div className="vote-overlay">✓ YOUR VOTE</div>}
            </div>
            <div className="character-info">
              <h3>{fight.character2?.name}</h3>
              <p className="character-universe">{fight.character2?.universe}</p>
            </div>
            
            {(showResults || userVote) && (
              <div className="vote-results">
                <div className="vote-bar">
                  <div 
                    className="vote-fill character2"
                    style={{ width: `${getVotePercentage('character2')}%` }}
                  ></div>
                </div>
                <div className="vote-stats">
                  <span className="vote-count">{voteResults.character2} votes</span>
                  <span className="vote-percentage">{getVotePercentage('character2')}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Voters */}
      {recentVoters.length > 0 && (
        <div className="recent-voters">
          <h4>Recent Voters</h4>
          <div className="voters-list">
            {recentVoters.slice(0, 10).map(voter => (
              <div key={voter.id} className="voter-item">
                <img src={voter.avatar} alt={voter.username} />
                <span className="voter-name">{voter.username}</span>
                <span className="voter-choice">
                  voted for {voter.choice === 'character1' ? fight.character1?.name : fight.character2?.name}
                </span>
                <span className="voter-time">{formatTimeAgo(voter.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Winner Declaration */}
      {totalVotes >= 10 && (showResults || userVote) && (
        <div className="winner-section">
          {getWinner() === 'tie' ? (
            <div className="tie-result">
              <h3>🤝 It's a Tie!</h3>
              <p>Both characters are equally matched according to the community!</p>
            </div>
          ) : (
            <div className="winner-result">
              <h3>🏆 Community Winner</h3>
              <div className="winner-character">
                <img 
                  src={getWinner() === 'character1' ? fight.character1?.image : fight.character2?.image} 
                  alt="Winner" 
                />
                <span className="winner-name">
                  {getWinner() === 'character1' ? fight.character1?.name : fight.character2?.name}
                </span>
                <span className="winner-margin">
                  with {Math.abs(getVotePercentage('character1') - getVotePercentage('character2'))}% margin
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comments Section */}
      <div className="comments-section">
        <h4>💬 Discussion ({comments.length})</h4>
        
        {user && (
          <div className="comment-input">
            <div className="user-avatar">
              <img src={user.avatar} alt={user.username} />
            </div>
            <div className="input-area">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts on this fight..."
                rows={3}
              />
              <div className="comment-actions">
                <button 
                  onClick={handleComment}
                  disabled={!newComment.trim()}
                  className="post-comment-btn"
                >
                  Post Comment
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="comments-list">
          {comments.map(comment => (
            <div key={comment.id} className="comment-item">
              <div className="comment-avatar">
                <img src={comment.user?.avatar} alt={comment.user?.username} />
              </div>
              <div className="comment-content">
                <div className="comment-header">
                  <span className="comment-author">{comment.user?.username}</span>
                  {comment.user?.isModerator && <span className="mod-badge">MOD</span>}
                  <span className="comment-time">{formatTimeAgo(comment.createdAt)}</span>
                </div>
                <p className="comment-text">{comment.content}</p>
                <div className="comment-actions">
                  <button className="like-btn">
                    👍 {comment.likes || 0}
                  </button>
                  <button className="reply-btn">Reply</button>
                  <button className="report-btn">Report</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {comments.length === 0 && (
          <div className="no-comments">
            <p>🤔 No comments yet. Be the first to share your opinion!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VotingSystem;