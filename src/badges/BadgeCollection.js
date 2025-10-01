import React, { useState, useEffect } from 'react';
import BadgeDisplay from './BadgeDisplay';
import './BadgeCollection.css';

const BadgeCollection = ({ userId, showAll = false, size = 'medium' }) => {
  const [badges, setBadges] = useState([]);
  const [userBadges, setUserBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rarity');

  useEffect(() => {
    fetchBadges();
  }, [userId]);

  const fetchBadges = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Pobierz wszystkie odznaki
      const badgesResponse = await fetch('/api/badges/all', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!badgesResponse.ok) {
        throw new Error('Failed to fetch badges');
      }
      
      const badgesData = await badgesResponse.json();
      setBadges(badgesData);

      // Pobierz odznaki użytkownika
      const userBadgesResponse = await fetch(`/api/badges/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!userBadgesResponse.ok) {
        throw new Error('Failed to fetch user badges');
      }
      
      const userBadgesData = await userBadgesResponse.json();
      setUserBadges(userBadgesData);
      
    } catch (err) {
      console.error('Error fetching badges:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCombinedBadges = () => {
    return badges.map(badge => {
      const userBadge = userBadges.find(ub => ub.badgeId === badge._id);
      return {
        badge,
        userBadge,
        isEarned: !!userBadge?.earnedAt
      };
    });
  };

  const getFilteredBadges = () => {
    let combined = getCombinedBadges();

    // Filtrowanie
    if (filter === 'earned') {
      combined = combined.filter(item => item.isEarned);
    } else if (filter === 'unearned') {
      combined = combined.filter(item => !item.isEarned);
    } else if (filter !== 'all') {
      combined = combined.filter(item => item.badge.category === filter);
    }

    // Jeśli nie pokazujemy wszystkich, pokaż tylko zdobyte
    if (!showAll) {
      combined = combined.filter(item => item.isEarned);
    }

    // Sortowanie
    combined.sort((a, b) => {
      if (sortBy === 'rarity') {
        const rarityOrder = { mythic: 6, legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
        return rarityOrder[b.badge.rarity] - rarityOrder[a.badge.rarity];
      } else if (sortBy === 'earned') {
        if (a.isEarned && !b.isEarned) return -1;
        if (!a.isEarned && b.isEarned) return 1;
        if (a.isEarned && b.isEarned) {
          return new Date(b.userBadge.earnedAt) - new Date(a.userBadge.earnedAt);
        }
        return 0;
      } else if (sortBy === 'category') {
        return a.badge.category.localeCompare(b.badge.category);
      }
      return 0;
    });

    return combined;
  };

  const getStats = () => {
    const combined = getCombinedBadges();
    const earned = combined.filter(item => item.isEarned).length;
    const total = combined.length;
    
    const byCategory = combined.reduce((acc, item) => {
      const category = item.badge.category;
      if (!acc[category]) {
        acc[category] = { total: 0, earned: 0 };
      }
      acc[category].total++;
      if (item.isEarned) {
        acc[category].earned++;
      }
      return acc;
    }, {});

    return { earned, total, byCategory };
  };

  const getCategoryDisplayName = (category) => {
    const names = {
      fighting: 'Walki',
      social: 'Społeczność',
      achievement: 'Osiągnięcia',
      division: 'Dywizje',
      championship: 'Mistrzostwa',
      betting: 'Zakłady',
      special: 'Specjalne',
      milestone: 'Kamienie milowe',
      community: 'Społeczność'
    };
    return names[category] || category;
  };

  if (loading) {
    return (
      <div className="badge-collection-loading">
        <div className="loading-spinner"></div>
        <p>Ładowanie odznak...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="badge-collection-error">
        <p>Błąd podczas ładowania odznak: {error}</p>
        <button onClick={fetchBadges} className="retry-button">
          Spróbuj ponownie
        </button>
      </div>
    );
  }

  const filteredBadges = getFilteredBadges();
  const stats = getStats();
  const categories = [...new Set(badges.map(b => b.category))];

  return (
    <div className="badge-collection">
      {showAll && (
        <div className="badge-collection-header">
          <div className="badge-stats">
            <h3>Kolekcja Odznak</h3>
            <div className="stats-summary">
              <span className="stat-item">
                <strong>{stats.earned}</strong> / {stats.total} zdobyte
              </span>
              <span className="completion-percentage">
                ({Math.round((stats.earned / stats.total) * 100)}%)
              </span>
            </div>
          </div>

          <div className="badge-controls">
            <div className="filter-controls">
              <select 
                value={filter} 
                onChange={(e) => setFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">Wszystkie</option>
                <option value="earned">Zdobyte</option>
                <option value="unearned">Niezdobyte</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {getCategoryDisplayName(category)}
                  </option>
                ))}
              </select>
            </div>

            <div className="sort-controls">
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="rarity">Rzadkość</option>
                <option value="earned">Zdobyte</option>
                <option value="category">Kategoria</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {showAll && (
        <div className="category-stats">
          {Object.entries(stats.byCategory).map(([category, data]) => (
            <div key={category} className="category-stat">
              <span className="category-name">
                {getCategoryDisplayName(category)}
              </span>
              <span className="category-progress">
                {data.earned}/{data.total}
              </span>
              <div className="category-bar">
                <div 
                  className="category-fill"
                  style={{ width: `${(data.earned / data.total) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`badges-grid ${size}`}>
        {filteredBadges.length === 0 ? (
          <div className="no-badges">
            <p>
              {filter === 'earned' 
                ? 'Nie zdobyto jeszcze żadnych odznak w tej kategorii.'
                : filter === 'unearned'
                ? 'Wszystkie odznaki w tej kategorii zostały zdobyte!'
                : 'Brak odznak do wyświetlenia.'
              }
            </p>
          </div>
        ) : (
          filteredBadges.map(({ badge, userBadge }) => (
            <BadgeDisplay
              key={badge._id}
              badge={badge}
              userBadge={userBadge}
              size={size}
              showTooltip={true}
            />
          ))
        )}
      </div>

      {!showAll && filteredBadges.length > 0 && (
        <div className="badge-collection-footer">
          <p className="earned-count">
            Zdobyte odznaki: {stats.earned} / {stats.total}
          </p>
        </div>
      )}
    </div>
  );
};

export default BadgeCollection;