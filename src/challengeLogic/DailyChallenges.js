import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './DailyChallenges.css';

const DailyChallenges = ({ user }) => {
  const [challenges, setChallenges] = useState([]);
  const [, setUserProgress] = useState({});
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const { t } = useLanguage();


  const challengeTypes = useMemo(() => ({
    FIGHT_CREATION: {
      id: 'fight_creation',
      title: t('createFightsChallenge') || 'Fight Creator',
      description: t('createFightsDesc') || 'Create fights between characters',
      icon: '⚔️',
      color: '#ff6b6b',
      variants: [
        { goal: 1, reward: { xp: 100, coins: 50 }, description: 'Create 1 fight' },
        { goal: 3, reward: { xp: 300, coins: 150 }, description: 'Create 3 fights' },
        { goal: 5, reward: { xp: 600, coins: 300 }, description: 'Create 5 fights' }
      ]
    },
    VOTING: {
      id: 'voting',
      title: t('voteChallenge') || 'Democratic Fighter',
      description: t('voteDesc') || 'Vote on fights and discussions',
      icon: '🗳️',
      color: '#4ecdc4',
      variants: [
        { goal: 5, reward: { xp: 75, coins: 25 }, description: 'Vote on 5 fights' },
        { goal: 10, reward: { xp: 150, coins: 75 }, description: 'Vote on 10 fights' },
        { goal: 20, reward: { xp: 350, coins: 175 }, description: 'Vote on 20 fights' }
      ]
    },
    COMMENTING: {
      id: 'commenting',
      title: t('commentChallenge') || 'Community Voice',
      description: t('commentDesc') || 'Engage in discussions and debates',
      icon: '💬',
      color: '#45b7d1',
      variants: [
        { goal: 3, reward: { xp: 90, coins: 30 }, description: 'Post 3 comments' },
        { goal: 7, reward: { xp: 200, coins: 100 }, description: 'Post 7 comments' },
        { goal: 15, reward: { xp: 450, coins: 225 }, description: 'Post 15 comments' }
      ]
    },
    CHARACTER_SELECTION: {
      id: 'character_selection',
      title: t('characterExplorer') || 'Character Explorer',
      description: t('characterExplorerDesc') || 'Discover and use different characters',
      icon: '🦸',
      color: '#96ceb4',
      variants: [
        { goal: 3, reward: { xp: 80, coins: 40 }, description: 'Use 3 different characters' },
        { goal: 7, reward: { xp: 180, coins: 90 }, description: 'Use 7 different characters' },
        { goal: 12, reward: { xp: 350, coins: 175 }, description: 'Use 12 different characters' }
      ]
    },
    WIN_STREAK: {
      id: 'win_streak',
      title: t('winStreak') || 'Victory Streak',
      description: t('winStreakDesc') || 'Win consecutive fights',
      icon: '🏆',
      color: '#feca57',
      variants: [
        { goal: 3, reward: { xp: 150, coins: 75 }, description: 'Win 3 fights in a row' },
        { goal: 5, reward: { xp: 300, coins: 150 }, description: 'Win 5 fights in a row' },
        { goal: 7, reward: { xp: 500, coins: 250 }, description: 'Win 7 fights in a row' }
      ]
    },
    SOCIAL_INTERACTION: {
      id: 'social_interaction',
      title: t('socialButterfly') || 'Social Butterfly',
      description: t('socialButterflyDesc') || 'Interact with other users',
      icon: '🤝',
      color: '#ff9ff3',
      variants: [
        { goal: 2, reward: { xp: 70, coins: 35 }, description: 'React to 2 posts' },
        { goal: 5, reward: { xp: 140, coins: 70 }, description: 'React to 5 posts' },
        { goal: 10, reward: { xp: 300, coins: 150 }, description: 'React to 10 posts' }
      ]
    },
    TOURNAMENT_PARTICIPATION: {
      id: 'tournament_participation',
      title: t('tournamentWarrior') || 'Tournament Warrior',
      description: t('tournamentWarriorDesc') || 'Participate in tournaments',
      icon: '🏟️',
      color: '#54a0ff',
      variants: [
        { goal: 1, reward: { xp: 200, coins: 100 }, description: 'Join 1 tournament' },
        { goal: 2, reward: { xp: 450, coins: 225 }, description: 'Join 2 tournaments' },
        { goal: 3, reward: { xp: 750, coins: 375 }, description: 'Join 3 tournaments' }
      ]
    }
  }), [t]);

  const getTimeUntilMidnight = useCallback(() => {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime() - now.getTime();
  }, []);

  const generateDailyChallenges = useCallback(() => {
    const availableTypes = Object.values(challengeTypes);
    const selectedTypes = [];
    
    // Always include at least one easy challenge
    const easyTypes = availableTypes.filter(type => 
      ['VOTING', 'COMMENTING', 'SOCIAL_INTERACTION'].includes(type.id.toUpperCase())
    );
    selectedTypes.push(easyTypes[Math.floor(Math.random() * easyTypes.length)]);
    
    // Add medium difficulty challenges
    const mediumTypes = availableTypes.filter(type => 
      ['FIGHT_CREATION', 'CHARACTER_SELECTION'].includes(type.id.toUpperCase())
    );
    selectedTypes.push(mediumTypes[Math.floor(Math.random() * mediumTypes.length)]);
    
    // Add one hard challenge
    const hardTypes = availableTypes.filter(type => 
      ['WIN_STREAK', 'TOURNAMENT_PARTICIPATION'].includes(type.id.toUpperCase())
    );
    selectedTypes.push(hardTypes[Math.floor(Math.random() * hardTypes.length)]);
    
    // Generate challenge instances
    return selectedTypes.map((type, index) => {
      const variant = type.variants[Math.floor(Math.random() * type.variants.length)];
      return {
        id: `daily_${Date.now()}_${index}`,
        type: type.id,
        title: type.title,
        description: variant.description,
        icon: type.icon,
        color: type.color,
        goal: variant.goal,
        progress: 0,
        reward: variant.reward,
        difficulty: index === 0 ? 'easy' : index === 1 ? 'medium' : 'hard',
        timeLeft: getTimeUntilMidnight(),
        completed: false
      };
    });
  }, [challengeTypes, getTimeUntilMidnight]);

  const fetchDailyChallenges = useCallback(async () => {
    try {
      // Generate daily challenges based on current date
      const today = new Date().toDateString();
      const storedDate = localStorage.getItem('dailyChallengesDate');
      
      if (storedDate === today) {
        const storedChallenges = JSON.parse(localStorage.getItem('dailyChallenges') || '[]');
        if (storedChallenges.length > 0) {
          setChallenges(storedChallenges);
          setLoading(false);
          return;
        }
      }

      // Generate new challenges for today
      const todayChallenges = generateDailyChallenges();
      setChallenges(todayChallenges);
      
      localStorage.setItem('dailyChallenges', JSON.stringify(todayChallenges));
      localStorage.setItem('dailyChallengesDate', today);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching daily challenges:', error);
      setLoading(false);
    }
  }, [generateDailyChallenges]);

  const fetchUserProgress = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      const response = await axios.get(`/api/challenges/progress/${user?.id}`);
      setUserProgress(response.data.progress || {});
      setStreak(response.data.streak || 0);
    } catch (error) {
      console.error('Error fetching user progress:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDailyChallenges();
    fetchUserProgress();
  }, [fetchDailyChallenges, fetchUserProgress]);

  const formatTimeLeft = (milliseconds) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getProgressPercentage = (progress, goal) => {
    return Math.min((progress / goal) * 100, 100);
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return '#28a745';
      case 'medium': return '#ffc107';
      case 'hard': return '#dc3545';
      default: return '#6c757d';
    }
  };

  if (loading) {
    return (
      <div className="daily-challenges-loading">
        <div className="loading-spinner"></div>
        <p>Loading daily challenges...</p>
      </div>
    );
  }

  return (
    <div className="daily-challenges">
      <div className="challenges-header">
        <div className="header-content">
          <h1>📅 Daily Challenges</h1>
          <p>Complete challenges to earn XP, coins, and maintain your streak!</p>
          
          <div className="streak-display">
            <div className="streak-icon">🔥</div>
            <div className="streak-info">
              <span className="streak-number">{streak}</span>
              <span className="streak-label">Day Streak</span>
            </div>
          </div>
        </div>
        
        <div className="time-remaining">
          <div className="timer-icon">⏰</div>
          <div className="timer-text">
            <span>Resets in</span>
            <span className="time-value">{formatTimeLeft(challenges[0]?.timeLeft || 0)}</span>
          </div>
        </div>
      </div>

      <div className="challenges-grid">
        {challenges.map((challenge) => (
          <div 
            key={challenge.id} 
            className={`challenge-card ${challenge.completed ? 'completed' : ''} ${challenge.difficulty}`}
            style={{ '--challenge-color': challenge.color }}
            onClick={() => setSelectedChallenge(challenge)}
          >
            <div className="challenge-header">
              <div className="challenge-icon">{challenge.icon}</div>
              <div className="difficulty-badge" style={{ backgroundColor: getDifficultyColor(challenge.difficulty) }}>
                {challenge.difficulty}
              </div>
            </div>
            
            <div className="challenge-content">
              <h3>{challenge.title}</h3>
              <p>{challenge.description}</p>
              
              <div className="progress-section">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${getProgressPercentage(challenge.progress, challenge.goal)}%`,
                      backgroundColor: challenge.color
                    }}
                  ></div>
                </div>
                <span className="progress-text">
                  {challenge.progress} / {challenge.goal}
                </span>
              </div>
              
              <div className="challenge-rewards">
                <div className="reward-item">
                  <span className="reward-icon">⭐</span>
                  <span>{challenge.reward.xp} XP</span>
                </div>
                <div className="reward-item">
                  <span className="reward-icon">🪙</span>
                  <span>{challenge.reward.coins} Coins</span>
                </div>
              </div>
            </div>
            
            {challenge.completed && (
              <div className="completion-overlay">
                <div className="completion-icon">✅</div>
                <span>Completed!</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="weekly-bonus-preview">
        <h3>🎁 Weekly Bonus</h3>
        <p>Complete all daily challenges for 7 days to unlock exclusive rewards!</p>
        <div className="weekly-progress">
          <div className="weekly-days">
            {[1, 2, 3, 4, 5, 6, 7].map(day => (
              <div 
                key={day} 
                className={`day-indicator ${day <= streak ? 'completed' : ''}`}
              >
                {day}
              </div>
            ))}
          </div>
          {streak >= 7 && (
            <div className="weekly-reward-ready">
              <span>🏆 Weekly reward ready to claim!</span>
            </div>
          )}
        </div>
      </div>

      {/* Challenge Detail Modal */}
      {selectedChallenge && (
        <div className="challenge-modal" onClick={() => setSelectedChallenge(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedChallenge(null)}>×</button>
            
            <div className="modal-header">
              <div className="modal-icon">{selectedChallenge.icon}</div>
              <h2>{selectedChallenge.title}</h2>
              <div className="modal-difficulty" style={{ backgroundColor: getDifficultyColor(selectedChallenge.difficulty) }}>
                {selectedChallenge.difficulty}
              </div>
            </div>
            
            <div className="modal-body">
              <p>{selectedChallenge.description}</p>
              
              <div className="modal-progress">
                <h4>Progress</h4>
                <div className="progress-bar large">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${getProgressPercentage(selectedChallenge.progress, selectedChallenge.goal)}%`,
                      backgroundColor: selectedChallenge.color
                    }}
                  ></div>
                </div>
                <span className="progress-text large">
                  {selectedChallenge.progress} / {selectedChallenge.goal}
                </span>
              </div>
              
              <div className="modal-rewards">
                <h4>Rewards</h4>
                <div className="reward-list">
                  <div className="reward-item large">
                    <span className="reward-icon">⭐</span>
                    <span>{selectedChallenge.reward.xp} Experience Points</span>
                  </div>
                  <div className="reward-item large">
                    <span className="reward-icon">🪙</span>
                    <span>{selectedChallenge.reward.coins} Coins</span>
                  </div>
                </div>
              </div>
              
              {selectedChallenge.completed && (
                <div className="modal-completed">
                  <div className="completion-checkmark">✅</div>
                  <span>Challenge Completed!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyChallenges;



