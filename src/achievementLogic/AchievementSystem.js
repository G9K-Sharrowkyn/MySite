import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './AchievementSystem.css';

const AchievementSystem = ({ userId, onAchievementUnlocked }) => {
  const [achievements, setAchievements] = useState([]);
  const [userProgress, setUserProgress] = useState({});
  const [streaks, setStreaks] = useState({});
  const [newAchievement, setNewAchievement] = useState(null);
  const { t } = useLanguage();

  // Achievement definitions
  const achievementTypes = {
    // Fighting achievements
    FIRST_FIGHT: {
      id: 'first_fight',
      name: t('firstFightAchievement') || 'First Blood',
      description: t('firstFightDesc') || 'Create your first fight',
      icon: '⚔️',
      reward: { xp: 50, points: 10 },
      rarity: 'common'
    },
    FIGHT_CREATOR: {
      id: 'fight_creator',
      name: t('fightCreatorAchievement') || 'Fight Master',
      description: t('fightCreatorDesc') || 'Create 10 fights',
      icon: '👑',
      reward: { xp: 200, points: 50 },
      rarity: 'rare',
      requirement: 10
    },
    TOURNAMENT_WINNER: {
      id: 'tournament_winner',
      name: t('tournamentWinnerAchievement') || 'Champion',
      description: t('tournamentWinnerDesc') || 'Win your first tournament',
      icon: '🏆',
      reward: { xp: 500, points: 100 },
      rarity: 'legendary'
    },
    
    // Social achievements
    POPULAR_POST: {
      id: 'popular_post',
      name: t('popularPostAchievement') || 'Viral',
      description: t('popularPostDesc') || 'Get 100 likes on a post',
      icon: '🔥',
      reward: { xp: 150, points: 30 },
      rarity: 'uncommon',
      requirement: 100
    },
    COMMENT_KING: {
      id: 'comment_king',
      name: t('commentKingAchievement') || 'Chatterbox',
      description: t('commentKingDesc') || 'Write 50 comments',
      icon: '💬',
      reward: { xp: 100, points: 20 },
      rarity: 'common',
      requirement: 50
    },
    
    // Streak achievements
    DAILY_STREAK_7: {
      id: 'daily_streak_7',
      name: t('weekStreakAchievement') || 'Week Warrior',
      description: t('weekStreakDesc') || 'Log in for 7 consecutive days',
      icon: '📅',
      reward: { xp: 200, points: 40 },
      rarity: 'uncommon',
      requirement: 7
    },
    DAILY_STREAK_30: {
      id: 'daily_streak_30',
      name: t('monthStreakAchievement') || 'Dedication',
      description: t('monthStreakDesc') || 'Log in for 30 consecutive days',
      icon: '🎯',
      reward: { xp: 1000, points: 200 },
      rarity: 'legendary',
      requirement: 30
    },
    
    // Special achievements
    BETA_TESTER: {
      id: 'beta_tester',
      name: t('betaTesterAchievement') || 'Beta Legend',
      description: t('betaTesterDesc') || 'One of the first 100 users',
      icon: '🌟',
      reward: { xp: 500, points: 100 },
      rarity: 'legendary'
    },
    MODERATOR_FRIEND: {
      id: 'moderator_friend',
      name: t('moderatorFriendAchievement') || 'Mod Squad',
      description: t('moderatorFriendDesc') || 'Receive a message from a moderator',
      icon: '🛡️',
      reward: { xp: 100, points: 25 },
      rarity: 'rare'
    }
  };

  useEffect(() => {
    if (userId) {
      fetchUserAchievements();
      fetchUserProgress();
      fetchStreaks();
    }
  }, [userId]);

  const fetchUserAchievements = async () => {
    try {
      const response = await axios.get(`/api/achievements/user/${userId}`);
      setAchievements(response.data);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  };

  const fetchUserProgress = async () => {
    try {
      const response = await axios.get(`/api/achievements/progress/${userId}`);
      setUserProgress(response.data);
    } catch (error) {
      console.error('Error fetching progress:', error);
    }
  };

  const fetchStreaks = async () => {
    try {
      const response = await axios.get(`/api/achievements/streaks/${userId}`);
      setStreaks(response.data);
    } catch (error) {
      console.error('Error fetching streaks:', error);
    }
  };

  const checkAchievement = async (type, value = 1) => {
    const achievement = achievementTypes[type];
    if (!achievement) return;

    const currentProgress = userProgress[achievement.id] || 0;
    const newProgress = currentProgress + value;

    // Check if achievement is unlocked
    if (achievement.requirement && newProgress >= achievement.requirement && currentProgress < achievement.requirement) {
      await unlockAchievement(achievement);
    } else if (!achievement.requirement && currentProgress === 0) {
      await unlockAchievement(achievement);
    }

    // Update progress
    setUserProgress(prev => ({
      ...prev,
      [achievement.id]: newProgress
    }));
  };

  const unlockAchievement = async (achievement) => {
    try {
      await axios.post('/api/achievements/unlock', {
        userId,
        achievementId: achievement.id,
        reward: achievement.reward
      });

      setNewAchievement(achievement);
      if (onAchievementUnlocked) {
        onAchievementUnlocked(achievement);
      }

      // Auto-hide after 5 seconds
      setTimeout(() => setNewAchievement(null), 5000);
    } catch (error) {
      console.error('Error unlocking achievement:', error);
    }
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return '#6c757d';
      case 'uncommon': return '#28a745';
      case 'rare': return '#007bff';
      case 'epic': return '#6f42c1';
      case 'legendary': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getProgressPercentage = (achievementId) => {
    const achievement = Object.values(achievementTypes).find(a => a.id === achievementId);
    const progress = userProgress[achievementId] || 0;
    
    if (!achievement.requirement) return 100;
    return Math.min((progress / achievement.requirement) * 100, 100);
  };

  const AchievementPopup = ({ achievement }) => (
    <div className="achievement-popup">
      <div className="achievement-popup-content">
        <div className="achievement-icon-large">{achievement.icon}</div>
        <div className="achievement-info">
          <h3>{t('achievementUnlocked') || 'Achievement Unlocked!'}</h3>
          <h4>{achievement.name}</h4>
          <p>{achievement.description}</p>
          <div className="achievement-rewards">
            <span>+{achievement.reward.xp} XP</span>
            <span>+{achievement.reward.points} {t('points')}</span>
          </div>
        </div>
        <button onClick={() => setNewAchievement(null)}>✕</button>
      </div>
    </div>
  );

  // Expose achievement checking function
  window.checkAchievement = checkAchievement;

  return (
    <div className="achievement-system">
      {newAchievement && <AchievementPopup achievement={newAchievement} />}
      
      <div className="achievements-grid">
        {Object.values(achievementTypes).map(achievement => {
          const isUnlocked = achievements.some(a => a.achievementId === achievement.id);
          const progress = getProgressPercentage(achievement.id);
          
          return (
            <div 
              key={achievement.id} 
              className={`achievement-card ${isUnlocked ? 'unlocked' : 'locked'}`}
              style={{ '--rarity-color': getRarityColor(achievement.rarity) }}
            >
              <div className="achievement-icon">{achievement.icon}</div>
              <div className="achievement-details">
                <h4>{achievement.name}</h4>
                <p>{achievement.description}</p>
                {achievement.requirement && (
                  <div className="achievement-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span>{userProgress[achievement.id] || 0}/{achievement.requirement}</span>
                  </div>
                )}
                <div className="achievement-reward">
                  <span>+{achievement.reward.xp} XP</span>
                  <span>+{achievement.reward.points} {t('points')}</span>
                </div>
              </div>
              <div className={`rarity-badge ${achievement.rarity}`}>
                {achievement.rarity.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AchievementSystem;