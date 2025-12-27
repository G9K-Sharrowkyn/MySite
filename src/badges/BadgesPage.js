import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import BadgeCollection from './BadgeCollection';
import './BadgesPage.css';

const BadgesPage = () => {
  const { user } = useAuth();
  const [userBadges, setUserBadges] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('earned');
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalAvailable: 0,
    completionPercentage: 0,
    rareCount: 0,
    epicCount: 0,
    legendaryCount: 0,
    mythicCount: 0
  });

  const calculateStats = useCallback((earned, available) => {
    const totalEarned = earned.length;
    const totalAvailable = available.length;
    const completionPercentage =
      totalAvailable > 0 ? Math.round((totalEarned / totalAvailable) * 100) : 0;
    
    const rareCount = earned.filter(badge => badge.badge.rarity === 'rare').length;
    const epicCount = earned.filter(badge => badge.badge.rarity === 'epic').length;
    const legendaryCount = earned.filter(badge => badge.badge.rarity === 'legendary').length;
    const mythicCount = earned.filter(badge => badge.badge.rarity === 'mythic').length;
    
    setStats({
      totalEarned,
      totalAvailable,
      completionPercentage,
      rareCount,
      epicCount,
      legendaryCount,
      mythicCount
    });
  }, []);

  const fetchBadgesData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Pobierz odznaki użytkownika
      const userResponse = await fetch('/api/badges/user', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!userResponse.ok) {
        throw new Error('Błąd podczas pobierania odznak użytkownika');
      }
      
      const userData = await userResponse.json();
      setUserBadges(userData.badges || []);
      
      // Pobierz wszystkie dostępne odznaki
      const allResponse = await fetch('/api/badges/all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!allResponse.ok) {
        throw new Error('Błąd podczas pobierania wszystkich odznak');
      }
      
      const allData = await allResponse.json();
      setAllBadges(allData.badges || []);
      
      // Oblicz statystyki
      calculateStats(userData.badges || [], allData.badges || []);
      
    } catch (err) {
      console.error('Błąd podczas pobierania odznak:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  useEffect(() => {
    if (user) {
      fetchBadgesData();
    }
  }, [user, fetchBadgesData]);

  const getFilteredBadges = () => {
    if (activeTab === 'earned') {
      return userBadges;
    } else {
      // Pokaż wszystkie odznaki z informacją o tym, które są zdobyte
      return allBadges.map(badge => {
        const earnedBadge = userBadges.find(ub => ub.badge._id === badge._id);
        return earnedBadge || { badge, earned: false };
      });
    }
  };

  if (!user) {
    return (
      <div className="badges-page">
        <div className="badges-container">
          <div className="login-required">
            <h2>Zaloguj się, aby zobaczyć odznaki</h2>
            <p>Musisz być zalogowany, aby przeglądać swoje odznaki i osiągnięcia.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="badges-page">
        <div className="badges-container">
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Ładowanie odznak...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="badges-page">
        <div className="badges-container">
          <div className="error-state">
            <h2>Błąd</h2>
            <p>{error}</p>
            <button onClick={fetchBadgesData} className="retry-btn">
              Spróbuj ponownie
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="badges-page">
      <div className="badges-container">
        {/* Header */}
        <div className="badges-page-header">
          <h1>Moje Odznaki</h1>
          <p>Zdobywaj odznaki za swoje osiągnięcia na platformie!</p>
        </div>

        {/* Stats Section */}
        <div className="badges-stats">
          <div className="stat-card main-stat">
            <div className="stat-number">{stats.totalEarned}</div>
            <div className="stat-label">Zdobyte Odznaki</div>
            <div className="stat-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${stats.completionPercentage}%` }}
                ></div>
              </div>
              <span className="progress-text">
                {stats.completionPercentage}% ({stats.totalEarned}/{stats.totalAvailable})
              </span>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-number rare">{stats.rareCount}</div>
            <div className="stat-label">Rzadkie</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-number epic">{stats.epicCount}</div>
            <div className="stat-label">Epickie</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-number legendary">{stats.legendaryCount}</div>
            <div className="stat-label">Legendarne</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-number mythic">{stats.mythicCount}</div>
            <div className="stat-label">Mityczne</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="badges-tabs">
          <button 
            className={`tab-btn ${activeTab === 'earned' ? 'active' : ''}`}
            onClick={() => setActiveTab('earned')}
          >
            Zdobyte ({stats.totalEarned})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Wszystkie ({stats.totalAvailable})
          </button>
        </div>

        {/* Badges Collection */}
        <div className="badges-content">
          <BadgeCollection 
            badges={getFilteredBadges()}
            showProgress={activeTab === 'all'}
            showEarnedOnly={activeTab === 'earned'}
          />
        </div>
      </div>
    </div>
  );
};

export default BadgesPage;
