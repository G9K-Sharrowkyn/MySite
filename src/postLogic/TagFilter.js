import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './TagFilter.css';

const TagFilter = ({ onTagsChange, selectedTags = [] }) => {
  const [popularTags, setPopularTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [showAllTags, setShowAllTags] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const [popularRes, allRes] = await Promise.all([
        axios.get('/api/posts/tags/popular?limit=10'),
        axios.get('/api/posts/tags/all')
      ]);
      
      setPopularTags(popularRes.data || []);
      setAllTags(allRes.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tags:', error);
      setLoading(false);
    }
  };

  const handleTagClick = (tag) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearAllTags = () => {
    onTagsChange([]);
  };

  const getTagIcon = (tag) => {
    const iconMap = {
      'dragon-ball': '🐉',
      'anime': '🎌',
      'dc': '🦇',
      'marvel': '🕷️',
      'comics': '📚',
      'naruto': '🍥',
      'superman': '🦸',
      'batman': '🦇',
      'goku': '🐉',
      'spider-man': '🕸️',
      'hulk': '💚',
      'thor': '⚡',
      'iron man': '🤖'
    };
    return iconMap[tag.toLowerCase()] || '🏷️';
  };

  const filteredTags = showAllTags 
    ? allTags.filter(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    : popularTags.map(pt => pt.tag);

  if (loading) return <div className="tag-filter-loading">Loading tags...</div>;

  return (
    <div className="tag-filter">
      <div className="tag-filter-header">
        <h3>🏷️ Filter by Tags</h3>
        {selectedTags.length > 0 && (
          <button className="clear-tags-btn" onClick={clearAllTags}>
            Clear All ({selectedTags.length})
          </button>
        )}
      </div>

      {selectedTags.length > 0 && (
        <div className="selected-tags">
          <span className="selected-label">Selected:</span>
          {selectedTags.map(tag => (
            <span 
              key={tag} 
              className="tag selected"
              onClick={() => handleTagClick(tag)}
            >
              {getTagIcon(tag)} {tag}
              <span className="remove-icon">×</span>
            </span>
          ))}
        </div>
      )}

      <div className="tag-list">
        {showAllTags ? (
          <>
            <div className="tag-search">
              <input
                type="text"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="tag-search-input"
              />
            </div>
            <div className="all-tags-grid">
              {filteredTags.map(tag => (
                <span
                  key={tag}
                  className={`tag ${selectedTags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => handleTagClick(tag)}
                >
                  {getTagIcon(tag)} {tag}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="popular-tags">
            {popularTags.map(({ tag, count }) => (
              <span
                key={tag}
                className={`tag popular ${selectedTags.includes(tag) ? 'selected' : ''}`}
                onClick={() => handleTagClick(tag)}
              >
                {getTagIcon(tag)} {tag}
                <span className="tag-count">{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <button 
        className="toggle-tags-btn"
        onClick={() => setShowAllTags(!showAllTags)}
      >
        {showAllTags ? '📊 Show Popular Tags' : '🗂️ Show All Tags'}
      </button>

      <div className="tag-categories">
        <h4>Quick Filters:</h4>
        <div className="category-buttons">
          <button 
            className="category-btn"
            onClick={() => onTagsChange(['anime', 'dragon-ball', 'naruto'])}
          >
            🎌 Anime
          </button>
          <button 
            className="category-btn"
            onClick={() => onTagsChange(['dc', 'marvel', 'comics'])}
          >
            📚 Comics
          </button>
          <button 
            className="category-btn"
            onClick={() => onTagsChange(['goku', 'vegeta', 'broly'])}
          >
            🐉 Dragon Ball
          </button>
          <button 
            className="category-btn"
            onClick={() => onTagsChange(['superman', 'batman', 'joker'])}
          >
            🦇 DC Heroes
          </button>
          <button 
            className="category-btn"
            onClick={() => onTagsChange(['spider-man', 'iron man', 'hulk', 'thor'])}
          >
            🕷️ Marvel Heroes
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagFilter; 