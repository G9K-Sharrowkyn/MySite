import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './CharacterRecommendations.css';

const CharacterRecommendations = ({ user, onCharacterSelect }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [userProfile, setUserProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const { t } = useLanguage();

  const categories = {
    all: { name: 'All Recommendations', icon: '🌟' },
    similar: { name: 'Similar to Your Favorites', icon: '❤️' },
    popular: { name: 'Trending Now', icon: '🔥' },
    powerful: { name: 'Most Powerful', icon: '💪' },
    underrated: { name: 'Hidden Gems', icon: '💎' },
    newToYou: { name: 'New Discoveries', icon: '🆕' },
    perfectMatch: { name: 'Perfect Matches', icon: '🎯' }
  };

  useEffect(() => {
    analyzeUserProfile();
    generateRecommendations();
  }, [user]);

  const analyzeUserProfile = async () => {
    try {
      // Analyze user's fighting history, character preferences, voting patterns
      const response = await axios.get(`/api/users/${user.id}/profile-analysis`);
      const analysis = response.data;

      const profile = {
        favoriteUniverses: analysis.mostUsedUniverses || [],
        preferredPowerLevels: analysis.preferredPowerRanges || [],
        fightingStyle: analysis.fightingPatterns || 'balanced',
        activityLevel: analysis.activityScore || 'moderate',
        preferredCharacterTypes: analysis.characterTypes || [],
        winRate: analysis.winPercentage || 50,
        diversityScore: analysis.universeDiversity || 0.5,
        socialEngagement: analysis.commentVoteRatio || 0.3,
        timeOfDayActivity: analysis.peakHours || [],
        recentTrends: analysis.recentPreferences || {}
      };

      setUserProfile(profile);
    } catch (error) {
      console.error('Error analyzing user profile:', error);
      // Fallback to basic profile
      setUserProfile({
        favoriteUniverses: ['Marvel', 'DC'],
        preferredPowerLevels: ['high', 'cosmic'],
        fightingStyle: 'balanced',
        activityLevel: 'moderate'
      });
    }
  };

  const generateRecommendations = async () => {
    try {
      const allCharacters = await fetchAllCharacters();
      const userBehavior = await fetchUserBehavior();
      
      const recommendations = {
        similar: generateSimilarRecommendations(allCharacters, userBehavior),
        popular: generatePopularRecommendations(allCharacters),
        powerful: generatePowerfulRecommendations(allCharacters),
        underrated: generateUnderratedRecommendations(allCharacters, userBehavior),
        newToYou: generateNewDiscoveries(allCharacters, userBehavior),
        perfectMatch: generatePerfectMatches(allCharacters, userBehavior)
      };

      setRecommendations(recommendations);
      setLoading(false);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      setLoading(false);
    }
  };

  const fetchAllCharacters = async () => {
    const response = await axios.get('/api/characters');
    return response.data.map(char => ({
      ...char,
      powerScore: calculatePowerScore(char),
      popularityScore: Math.random() * 100,
      compatibilityScore: 0
    }));
  };

  const fetchUserBehavior = async () => {
    const response = await axios.get(`/api/users/${user.id}/behavior`);
    return response.data;
  };

  const calculatePowerScore = (character) => {
    const universePowerMap = {
      'Dragon Ball': 95,
      'Marvel': 85,
      'DC': 85,
      'One Punch Man': 100,
      'Naruto': 80,
      'Bleach': 75,
      'One Piece': 70,
      'Pokemon': 60,
      'Gaming': 65
    };

    const basePower = universePowerMap[character.universe] || 50;
    const namePowerBoost = character.name.toLowerCase().includes('god') ? 20 : 0;
    const namePowerBoost2 = character.name.toLowerCase().includes('ultra') ? 15 : 0;
    
    return Math.min(100, basePower + namePowerBoost + namePowerBoost2 + Math.random() * 10);
  };

  const calculateCompatibilityScore = (character, userBehavior) => {
    let score = 0;

    // Universe preference (30% weight)
    if (userProfile.favoriteUniverses?.includes(character.universe)) {
      score += 30;
    }

    // Power level preference (25% weight)
    const charPowerLevel = getPowerCategory(character.powerScore);
    if (userProfile.preferredPowerLevels?.includes(charPowerLevel)) {
      score += 25;
    }

    // Usage frequency (20% weight)
    const usageCount = userBehavior.characterUsage?.[character.id] || 0;
    if (usageCount === 0) score += 20; // Bonus for new characters
    else if (usageCount < 3) score += 15; // Slight bonus for rarely used

    // Win rate with similar characters (15% weight)
    const similarCharWinRate = calculateSimilarCharacterWinRate(character, userBehavior);
    score += similarCharWinRate * 0.15;

    // Diversity bonus (10% weight)
    if (userProfile.diversityScore > 0.7 && !userProfile.favoriteUniverses?.includes(character.universe)) {
      score += 10;
    }

    return Math.min(100, score);
  };

  const getPowerCategory = (powerScore) => {
    if (powerScore >= 90) return 'cosmic';
    if (powerScore >= 75) return 'high';
    if (powerScore >= 50) return 'medium';
    return 'low';
  };

  const calculateSimilarCharacterWinRate = (character, userBehavior) => {
    // Calculate win rate with characters from the same universe
    const sameUniverseChars = userBehavior.fightResults?.filter(
      fight => fight.character?.universe === character.universe
    ) || [];
    
    if (sameUniverseChars.length === 0) return 50;
    
    const wins = sameUniverseChars.filter(fight => fight.won).length;
    return (wins / sameUniverseChars.length) * 100;
  };

  const generateSimilarRecommendations = (characters, userBehavior) => {
    const favoriteChars = userBehavior.mostUsedCharacters || [];
    const similarChars = [];

    favoriteChars.forEach(favChar => {
      const similar = characters.filter(char => 
        char.universe === favChar.universe && 
        char.id !== favChar.id &&
        !userBehavior.characterUsage?.[char.id]
      );
      similarChars.push(...similar.slice(0, 3));
    });

    return similarChars
      .map(char => ({
        ...char,
        compatibilityScore: calculateCompatibilityScore(char, userBehavior),
        reason: `Similar to your favorite ${char.universe} characters`
      }))
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 8);
  };

  const generatePopularRecommendations = (characters) => {
    return characters
      .map(char => ({
        ...char,
        reason: `Trending with ${Math.floor(char.popularityScore)}% popularity`
      }))
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 8);
  };

  const generatePowerfulRecommendations = (characters) => {
    return characters
      .map(char => ({
        ...char,
        reason: `Power Level: ${Math.floor(char.powerScore)}/100`
      }))
      .sort((a, b) => b.powerScore - a.powerScore)
      .slice(0, 8);
  };

  const generateUnderratedRecommendations = (characters, userBehavior) => {
    return characters
      .filter(char => 
        char.popularityScore < 40 && 
        char.powerScore > 60 &&
        !(userBehavior.characterUsage?.[char.id] > 0)
      )
      .map(char => ({
        ...char,
        compatibilityScore: calculateCompatibilityScore(char, userBehavior),
        reason: `Hidden gem with high potential`
      }))
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 8);
  };

  const generateNewDiscoveries = (characters, userBehavior) => {
    const usedCharacterIds = Object.keys(userBehavior.characterUsage || {});
    
    return characters
      .filter(char => !usedCharacterIds.includes(char.id.toString()))
      .map(char => ({
        ...char,
        compatibilityScore: calculateCompatibilityScore(char, userBehavior),
        reason: `New character to explore`
      }))
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 8);
  };

  const generatePerfectMatches = (characters, userBehavior) => {
    return characters
      .map(char => ({
        ...char,
        compatibilityScore: calculateCompatibilityScore(char, userBehavior),
        reason: `${Math.floor(calculateCompatibilityScore(char, userBehavior))}% match`
      }))
      .filter(char => char.compatibilityScore > 70)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, 8);
  };

  const handleCharacterClick = (character) => {
    // Track recommendation interaction
    trackRecommendationClick(character);
    
    if (onCharacterSelect) {
      onCharacterSelect(character);
    }
  };

  const trackRecommendationClick = async (character) => {
    try {
      await axios.post('/api/recommendations/track', {
        userId: user.id,
        characterId: character.id,
        category: selectedCategory,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error tracking recommendation:', error);
    }
  };

  const refreshRecommendations = () => {
    setLoading(true);
    generateRecommendations();
  };

  if (loading) {
    return (
      <div className="recommendations-loading">
        <div className="loading-spinner"></div>
        <p>Analyzing your preferences...</p>
      </div>
    );
  }

  const currentRecommendations = selectedCategory === 'all' 
    ? Object.values(recommendations).flat().slice(0, 12)
    : recommendations[selectedCategory] || [];

  return (
    <div className="character-recommendations">
      <div className="recommendations-header">
        <div className="header-content">
          <h1>🎯 Character Recommendations</h1>
          <p>Discover characters tailored to your fighting style and preferences</p>
          
          <div className="user-insights">
            <div className="insight-item">
              <span className="insight-icon">🌍</span>
              <div className="insight-text">
                <span className="insight-label">Favorite Universes</span>
                <span className="insight-value">
                  {userProfile.favoriteUniverses?.join(', ') || 'Exploring...'}
                </span>
              </div>
            </div>
            <div className="insight-item">
              <span className="insight-icon">⚡</span>
              <div className="insight-text">
                <span className="insight-label">Fighting Style</span>
                <span className="insight-value">{userProfile.fightingStyle || 'Balanced'}</span>
              </div>
            </div>
            <div className="insight-item">
              <span className="insight-icon">🏆</span>
              <div className="insight-text">
                <span className="insight-label">Win Rate</span>
                <span className="insight-value">{userProfile.winRate || 50}%</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="header-controls">
          <button className="refresh-button" onClick={refreshRecommendations}>
            🔄 Refresh
          </button>
          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              ⊞
            </button>
            <button 
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      <div className="category-tabs">
        {Object.entries(categories).map(([key, category]) => (
          <button
            key={key}
            className={`category-tab ${selectedCategory === key ? 'active' : ''}`}
            onClick={() => setSelectedCategory(key)}
          >
            <span className="tab-icon">{category.icon}</span>
            <span className="tab-name">{category.name}</span>
            {recommendations[key] && (
              <span className="tab-count">{recommendations[key].length}</span>
            )}
          </button>
        ))}
      </div>

      <div className={`recommendations-grid ${viewMode}`}>
        {currentRecommendations.map((character, index) => (
          <div 
            key={character.id} 
            className="recommendation-card"
            onClick={() => handleCharacterClick(character)}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="card-image">
              <img src={character.image} alt={character.name} />
              <div className="compatibility-badge">
                {Math.floor(character.compatibilityScore || character.powerScore || 75)}%
              </div>
            </div>
            
            <div className="card-content">
              <h3>{character.name}</h3>
              <div className="character-universe">{character.universe}</div>
              <div className="recommendation-reason">{character.reason}</div>
              
              <div className="character-stats">
                <div className="stat-item">
                  <span className="stat-icon">⚡</span>
                  <span className="stat-label">Power</span>
                  <div className="stat-bar">
                    <div 
                      className="stat-fill"
                      style={{ width: `${character.powerScore}%` }}
                    ></div>
                  </div>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">🔥</span>
                  <span className="stat-label">Popular</span>
                  <div className="stat-bar">
                    <div 
                      className="stat-fill popularity"
                      style={{ width: `${character.popularityScore}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="card-overlay">
              <button className="select-button">
                Select Character
              </button>
            </div>
          </div>
        ))}
      </div>

      {currentRecommendations.length === 0 && (
        <div className="no-recommendations">
          <div className="no-rec-icon">🤔</div>
          <h3>No recommendations available</h3>
          <p>Try fighting with more characters to improve our suggestions!</p>
          <button onClick={refreshRecommendations}>Refresh Recommendations</button>
        </div>
      )}

      <div className="recommendation-tips">
        <h3>💡 Tips for Better Recommendations</h3>
        <div className="tips-grid">
          <div className="tip-item">
            <span className="tip-icon">⚔️</span>
            <span>Fight with diverse characters to discover new favorites</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🗳️</span>
            <span>Vote on fights to help us understand your preferences</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">💬</span>
            <span>Comment on battles to show your engagement style</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🏆</span>
            <span>Participate in tournaments for advanced recommendations</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterRecommendations;