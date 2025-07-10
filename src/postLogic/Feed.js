import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PostCard from './PostCard';
import { replacePlaceholderUrl } from '../utils/placeholderImage';
import './Feed.css';

const Feed = ({ user }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/posts');
      setPosts(response.data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="feed-loading">Loading posts...</div>;
  }

  if (error) {
    return <div className="feed-error">{error}</div>;
  }

  return (
    <div className="feed">
      {posts.length === 0 ? (
        <div className="no-posts">
          <h3>No posts yet</h3>
          <p>Be the first to create a fight!</p>
        </div>
      ) : (
        posts.map(post => (
          <PostCard key={post._id || post.id} post={post} user={user} onUpdate={fetchPosts} />
        ))
      )}
    </div>
  );
};

export default Feed;