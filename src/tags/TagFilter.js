import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './TagFilter.css';

const TagFilter = ({ onFiltersChange, activeFilters = {} }) => {
  const { t } = useLanguage();
  const [tags, setTags] = useState({
    universe: [],
    character: [],
    power_tier: [],
    genre: []
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [trendingTags, setTrendingTags] = useState([]);

  // Pobierz tagi pogrupowane według kategorii
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await axios.get('/api/tags/categories');
        setTags(response.data.categories);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching tags:', error);
        setLoading(false);
      }
    };

    fetchTags();
  }, []);

  // Pobierz trending tagi
  useEffect(() => {
    const fetchTrendingTags = async () => {
      try {
        const response = await axios.get('/api/tags/trending?limit=8');
        setTrendingTags(response.data.tags);
      } catch (error) {
        console.error('Error fetching trending tags:', error);
      }
    };

    fetchTrendingTags();
  }, []);

  // Wyszukiwanie tagów
  useEffect(() => {
    const searchTags = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const response = await axios.get(`/api/tags/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(response.data.tags);
      } catch (error) {
        console.error('Error searching tags:', error);
        setSearchResults([]);
      }
    };

    const debounceTimer = setTimeout(searchTags, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleFilterToggle = (category, tagName) => {
    const currentFilters = activeFilters[category] || [];
    const newFilters = currentFilters.includes(tagName)
      ? currentFilters.filter(tag => tag !== tagName)
      : [...currentFilters, tagName];

    onFiltersChange({
      ...activeFilters,
      [category]: newFilters
    });
  };

  const handleSearchFilterAdd = (tag) => {
    const category = tag.category;
    const currentFilters = activeFilters[category] || [];
    
    if (!currentFilters.includes(tag.name)) {
      onFiltersChange({
        ...activeFilters,
        [category]: [...currentFilters, tag.name]
      });
    }
    
    setSearchQuery('');
    setSearchResults([]);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const clearCategoryFilters = (category) => {
    const newFilters = { ...activeFilters };
    delete newFilters[category];
    onFiltersChange(newFilters);
  };

  const getActiveFilterCount = () => {
    return Object.values(activeFilters).reduce((total, filters) => total + filters.length, 0);
  };

  const getCategoryIcon = (category) => {
    const icons = {
      universe: '🌍',
      character: '👤',
      power_tier: '⚡',
      genre: '🎭'
    };
    return icons[category] || '🏷️';
  };

  const getCategoryName = (category) => {
    const names = {
      universe: t('tags.universes'),
      character: t('tags.characters'),
      power_tier: t('tags.powerTiers'),
      genre: t('tags.genres')
    };
    return names[category] || category;
  };

  const getTagColor = (category) => {
    const colors = {
      universe: '#007bff',
      character: '#28a745',
      power_tier: '#dc3545',
      genre: '#ffc107'
    };
    return colors[category] || '#6c757d';
  };

  if (loading) {
    return (
      <div className="tag-filter-loading">
        <div className="spinner"></div>
        <p>{t('loadingFilters')}</p>
      </div>
    );
  }

  return (
    <div className="tag-filter-container">
      {/* Header z licznikiem aktywnych filtrów */}
      <div className="filter-header">
        <h3>
          🏷️ {t('filterPosts')}
          {getActiveFilterCount() > 0 && (
            <span className="active-count">({getActiveFilterCount()})</span>
          )}
        </h3>
        <div className="filter-actions">
          <button
            className="toggle-advanced-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '📋 ' + t('simpleView') : '🔧 ' + t('advancedView')}
          </button>
          {getActiveFilterCount() > 0 && (
            <button className="clear-all-btn" onClick={clearAllFilters}>
              🗑️ {t('clearAll')}
            </button>
          )}
        </div>
      </div>

      {/* Wyszukiwanie tagów */}
      <div className="tag-search">
        <div className="search-input-container">
          <input
            type="text"
            placeholder={t('searchTags')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="tag-search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map(tag => (
              <button
                key={tag._id}
                className="search-result-tag"
                style={{ borderColor: getTagColor(tag.category) }}
                onClick={() => handleSearchFilterAdd(tag)}
              >
                {getCategoryIcon(tag.category)} {tag.name}
                <span className="tag-count">({tag.postCount})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Trending tagi */}
      {trendingTags.length > 0 && (
        <div className="trending-tags">
          <h4>🔥 {t('trendingTags')}</h4>
          <div className="trending-tags-list">
            {trendingTags.map(tag => (
              <button
                key={tag._id}
                className={`trending-tag ${
                  activeFilters[tag.category]?.includes(tag.name) ? 'active' : ''
                }`}
                style={{ borderColor: getTagColor(tag.category) }}
                onClick={() => handleFilterToggle(tag.category, tag.name)}
              >
                {getCategoryIcon(tag.category)} {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtry według kategorii */}
      <div className="category-filters">
        {Object.entries(tags).map(([category, categoryTags]) => (
          <div key={category} className="filter-category">
            <div className="category-header">
              <h4>
                {getCategoryIcon(category)} {getCategoryName(category)}
                {activeFilters[category]?.length > 0 && (
                  <span className="category-count">({activeFilters[category].length})</span>
                )}
              </h4>
              {activeFilters[category]?.length > 0 && (
                <button
                  className="clear-category-btn"
                  onClick={() => clearCategoryFilters(category)}
                >
                  ✕
                </button>
              )}
            </div>
            
            <div className={`category-tags ${showAdvanced ? 'expanded' : 'collapsed'}`}>
              {categoryTags
                .slice(0, showAdvanced ? categoryTags.length : 6)
                .map(tag => (
                  <button
                    key={tag._id}
                    className={`filter-tag ${
                      activeFilters[category]?.includes(tag.name) ? 'active' : ''
                    }`}
                    style={{ 
                      borderColor: getTagColor(category),
                      backgroundColor: activeFilters[category]?.includes(tag.name) 
                        ? getTagColor(category) + '20' 
                        : 'transparent'
                    }}
                    onClick={() => handleFilterToggle(category, tag.name)}
                  >
                    {tag.name}
                    <span className="tag-count">({tag.postCount})</span>
                  </button>
                ))}
              
              {!showAdvanced && categoryTags.length > 6 && (
                <button
                  className="show-more-btn"
                  onClick={() => setShowAdvanced(true)}
                >
                  +{categoryTags.length - 6} {t('more')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Aktywne filtry */}
      {getActiveFilterCount() > 0 && (
        <div className="active-filters">
          <h4>🎯 {t('activeFilters')}</h4>
          <div className="active-filters-list">
            {Object.entries(activeFilters).map(([category, filters]) =>
              filters.map(filter => (
                <span
                  key={`${category}-${filter}`}
                  className="active-filter-tag"
                  style={{ backgroundColor: getTagColor(category) }}
                >
                  {getCategoryIcon(category)} {filter}
                  <button
                    className="remove-filter-btn"
                    onClick={() => handleFilterToggle(category, filter)}
                  >
                    ✕
                  </button>
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TagFilter;