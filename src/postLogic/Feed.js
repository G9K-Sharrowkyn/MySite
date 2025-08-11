import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PostCard from './PostCard';
import CreatePost from './CreatePost';
import TagFilter from './TagFilter';
import { replacePlaceholderUrl, placeholderImages } from '../utils/placeholderImage';
import { useLanguage } from '../i18n/LanguageContext';
import './Feed.css';

const Feed = () => {
  const { t } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState('createdAt');
  const [selectedTags, setSelectedTags] = useState([]);

  const fetchPosts = async (pageNum = 1, sort = 'createdAt', reset = false) => {
    try {
      setLoading(true);
      const tagsQuery = selectedTags.length > 0 ? `&tags=${selectedTags.join(',')}` : '';
      const response = await axios.get(`/api/posts?page=${pageNum}&limit=10&sortBy=${sort}${tagsQuery}`);
      const newPosts = response.data.posts.map(post => ({
        ...post,
        author: {
          ...post.author,
          profilePicture: replacePlaceholderUrl(post.author?.profilePicture)
        }
      }));
      
      if (reset) {
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
    fetchPosts(1, sortBy, true);
    setPage(1);
  }, [sortBy]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, sortBy, false);
  };

  const handlePostCreated = () => {
    fetchPosts(1, sortBy, true);
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

  const handleTagsChange = (tags) => {
    setSelectedTags(tags);
    fetchPosts(1, sortBy, true);
    setPage(1);
  };

  console.log('Rendering Feed component...');
  console.log('Posts:', posts);
  console.log('Loading:', loading);

  return (
    <div className="feed-container">
      <div className="feed-header">
        <h1>🌟 {t('feed')}</h1>
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
        </div>
      </div>

      <CreatePost onPostCreated={handlePostCreated} />

      <TagFilter onTagsChange={handleTagsChange} selectedTags={selectedTags} />

      <div className="posts-feed">
        {posts.map(post => (
          <PostCard 
            key={post.id} 
            post={post} 
            onUpdate={handlePostUpdate}
          />
        ))}
        
        {loading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>{t('loadingPosts')}</p>
          </div>
        )}
        
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