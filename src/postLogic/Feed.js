import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import PostCard from './PostCard';
import CreatePost from './CreatePost';
import TagFilter from '../tags/TagFilter';
import OnboardingChecklist from '../onboarding/OnboardingChecklist';
import { replacePlaceholderUrl } from '../utils/placeholderImage';
import { useLanguage } from '../i18n/LanguageContext';
import './Feed.css';

const Feed = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState('createdAt');
  const [filters, setFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [visibleIndexes, setVisibleIndexes] = useState(new Set());
  const observerRef = useRef(null);
  const postNodesRef = useRef(new Map());
  const urlDrivenFiltersRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const character = params.get('character');

    if (character) {
      urlDrivenFiltersRef.current = true;
      setFilters({ character: [character] });
      setShowFilters(true);
      setPage(1);
      return;
    }

    if (urlDrivenFiltersRef.current) {
      urlDrivenFiltersRef.current = false;
      setFilters({});
      setPage(1);
    }
  }, [location.search]);

  const fetchPosts = async (
    pageNum = 1,
    sort = 'createdAt',
    reset = false,
    currentFilters = {},
    postCategory = 'all'
  ) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const authConfig = token ? { headers: { 'x-auth-token': token } } : undefined;
      
      // Sprawdź czy są aktywne filtry
      const hasActiveFilters = Object.keys(currentFilters).length > 0 &&
        Object.values(currentFilters).some(filterArray => filterArray.length > 0);
      
      const normalizedCategory = postCategory && postCategory !== 'all' ? postCategory : null;
      let response;
      if (hasActiveFilters) {
        // Użyj API filtrowania tagów
        response = await axios.post('/api/tags/filter-posts', {
          ...currentFilters,
          postCategory: normalizedCategory || 'all',
          sortBy: sort,
          page: pageNum,
          limit: 10
        }, authConfig);
        
        // Dostosuj format odpowiedzi do oczekiwanego
        response.data = {
          posts: response.data.posts,
          currentPage: pageNum,
          totalPages: Math.ceil(response.data.count / 10)
        };
      } else {
        // Użyj standardowego API postów
        const params = new URLSearchParams({
          page: pageNum,
          limit: 10,
          sortBy: sort
        });
        if (normalizedCategory) {
          params.set('category', normalizedCategory);
        }
        response = await axios.get(`/api/posts?${params.toString()}`, authConfig);
      }
      
      const newPosts = response.data.posts.map(post => ({
        ...post,
        author: {
          ...post.author,
          profilePicture: replacePlaceholderUrl(post.author?.profilePicture)
        }
      }));
      
      if (reset) {
        setVisibleIndexes(new Set());
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      
      setHasMore(response.data.currentPage < response.data.totalPages);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(1, sortBy, true, filters, categoryFilter);
    setPage(1);
  }, [sortBy, filters, categoryFilter]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleIndexes((prev) => {
          const next = new Set(prev);
          let changed = false;
          entries.forEach((entry) => {
            const indexAttr = entry.target?.dataset?.postIndex;
            const index = Number(indexAttr);
            if (!Number.isFinite(index)) return;
            if (entry.isIntersecting) {
              if (!next.has(index)) {
                next.add(index);
                changed = true;
              }
            } else if (next.has(index)) {
              next.delete(index);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      },
      { root: null, rootMargin: '600px 0px', threshold: 0.01 }
    );

    observerRef.current = observer;
    postNodesRef.current.forEach((node) => {
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  const setPostRef = useCallback(
    (index) => (node) => {
      const observer = observerRef.current;
      const prevNode = postNodesRef.current.get(index);
      if (prevNode && observer) {
        observer.unobserve(prevNode);
      }
      if (node) {
        postNodesRef.current.set(index, node);
        if (observer) {
          observer.observe(node);
        }
      } else {
        postNodesRef.current.delete(index);
      }
    },
    []
  );

  const eagerIndexes = useMemo(() => {
    const range = new Set();
    if (!posts.length) return range;
    if (visibleIndexes.size === 0) {
      // Only eager-load first 2 posts for better LCP
      const initialCount = Math.min(posts.length, 2);
      for (let i = 0; i < initialCount; i += 1) {
        range.add(i);
      }
      return range;
    }
    visibleIndexes.forEach((index) => {
      for (let offset = -2; offset <= 2; offset += 1) {
        const candidate = index + offset;
        if (candidate >= 0 && candidate < posts.length) {
          range.add(candidate);
        }
      }
    });
    return range;
  }, [visibleIndexes, posts.length]);

  const prefetchIndexes = useMemo(() => {
    const range = new Set();
    if (!posts.length) return range;
    if (visibleIndexes.size === 0) {
      // Only eager-load first 2 posts for better LCP
      const initialCount = Math.min(posts.length, 2);
      for (let i = 0; i < initialCount; i += 1) {
        range.add(i);
      }
      return range;
    }
    visibleIndexes.forEach((index) => {
      for (let offset = -4; offset <= 4; offset += 1) {
        const candidate = index + offset;
        if (candidate >= 0 && candidate < posts.length) {
          range.add(candidate);
        }
      }
    });
    return range;
  }, [visibleIndexes, posts.length]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, sortBy, false, filters, categoryFilter);
  };

  const handlePostCreated = () => {
    fetchPosts(1, sortBy, true, filters, categoryFilter);
    setPage(1);
  };

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

const handlePostUpdate = (updatedPost, isDeleted) => {
    if (isDeleted) {
      setPosts(prev => prev.filter(post => post.id !== updatedPost));
    } else {
      setPosts(prev => prev.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      ));
    }
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
  };

  const handleCategoryChange = (value) => {
    setCategoryFilter(value);
    setPage(1);
  };

  return (
    <div className="feed-container">
      <div className="feed-header">
        <h1>🌟 {t('feed')}</h1>
        <div className="beta-warning">
          <span className="beta-icon">⚠️</span>
          <span className="beta-text">
            {t('betaWarning') || 'This is a beta version. Bugs may occur. Please report any issues using the feedback button in the bottom-left corner.'}
          </span>
        </div>
        <div className="feed-controls">
          <div className="sort-controls">
            <button
              className={sortBy === 'createdAt' ? 'active' : ''}
              onClick={() => handleSortChange('createdAt')}
            >
              🕒 {t('newest')}
            </button>
            <button
              className={sortBy === 'likes' ? 'active' : ''}
              onClick={() => handleSortChange('likes')}
            >
              🔥 {t('popular')}
            </button>
          </div>
          <div className="category-controls">
            <span className="category-label">
              {t('filterByCategory') || 'Filter by category'}
            </span>
            <div className="category-buttons">
              <button
                className={`category-btn ${categoryFilter === 'all' ? 'active' : ''}`}
                onClick={() => handleCategoryChange('all')}
              >
                {t('all') || 'All'}
              </button>
              <button
                className={`category-btn ${categoryFilter === 'question' ? 'active' : ''}`}
                onClick={() => handleCategoryChange('question')}
              >
                {t('categoryQuestion') || 'Question'}
              </button>
              <button
                className={`category-btn ${categoryFilter === 'discussion' ? 'active' : ''}`}
                onClick={() => handleCategoryChange('discussion')}
              >
                {t('categoryDiscussion') || 'Discussion'}
              </button>
              <button
                className={`category-btn ${categoryFilter === 'article' ? 'active' : ''}`}
                onClick={() => handleCategoryChange('article')}
              >
                {t('categoryArticle') || 'Article'}
              </button>
              <button
                className={`category-btn ${categoryFilter === 'fight' ? 'active' : ''}`}
                onClick={() => handleCategoryChange('fight')}
              >
                {t('fight') || 'Fight'}
              </button>
            </div>
          </div>
          <div className="filter-controls">
            <button
              className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              🏷️ {t('filters')}
              {Object.keys(filters).length > 0 &&
                Object.values(filters).some(f => f.length > 0) && (
                <span className="filter-count">
                  ({Object.values(filters).reduce((total, f) => total + f.length, 0)})
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <TagFilter
          onFiltersChange={handleFiltersChange}
          activeFilters={filters}
        />
      )}

      <OnboardingChecklist />
      <div id="create-post">
        <CreatePost onPostCreated={handlePostCreated} />
      </div>

      <div className="posts-feed" id="feed-list">
        {posts.map((post, index) => (
          <div key={post.id} ref={setPostRef(index)} data-post-index={index}>
            <PostCard 
              post={post} 
              onUpdate={handlePostUpdate}
              eagerImages={eagerIndexes.has(index)}
              prefetchImages={prefetchIndexes.has(index)}
            />
          </div>
        ))}
        
        {!loading && hasMore && (
          <button className="load-more-btn" onClick={handleLoadMore}>
            📄 {t('loadMorePosts')}
          </button>
        )}
        
        {!loading && !hasMore && posts.length > 0 && (
          <div className="end-of-feed">
            <p>🎉 {t('allCaughtUp')}</p>
          </div>
        )}
        
        {!loading && posts.length === 0 && (
          <div className="empty-feed">
            <h3>🌟 {t('noPosts')}</h3>
            <p>{t('beFirstToPost')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;
