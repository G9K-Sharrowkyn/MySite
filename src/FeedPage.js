import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Notification from './Notification';
import './FeedPage.css';

const FeedPage = () => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({ title: '', content: '', type: 'discussion', teamA: '', teamB: '' });
  const [notification, setNotification] = useState(null);
  const [postComments, setPostComments] = useState({});
  const [newComments, setNewComments] = useState({});

  const fetchPosts = async () => {
    try {
      const res = await axios.get('/api/posts');
      const list = res.data.posts || res.data;
      setPosts(list);
    } catch (err) {
      console.error('Błąd podczas pobierania postów:', err);
    }
  };

  const fetchPostComments = async (postId) => {
    try {
      const res = await axios.get(`/api/comments/post/${postId}`);
      setPostComments(prev => ({ ...prev, [postId]: res.data }));
    } catch (err) {
      console.error('Błąd podczas pobierania komentarzy:', err);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    posts.forEach((p) => {
      fetchPostComments(p.id);
    });
  }, [posts]);

  const showNotification = (message, type) => setNotification({ message, type });
  const clearNotification = () => setNotification(null);

  const onChange = (e) => {
    setNewPost({ ...newPost, [e.target.name]: e.target.value });
  };

  const submitPost = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      showNotification('Musisz być zalogowany, aby dodać post.', 'error');
      return;
    }
    try {
      await axios.post('/api/posts', newPost, { headers: { 'x-auth-token': token } });
      setNewPost({ title: '', content: '', type: 'discussion', teamA: '', teamB: '' });
      showNotification('Post dodany!', 'success');
      fetchPosts();
    } catch (err) {
      console.error('Błąd podczas dodawania postu:', err.response?.data);
      showNotification(err.response?.data?.msg || 'Błąd dodawania postu', 'error');
    }
  };

  const likePost = async (id) => {
    const token = localStorage.getItem('token');
    if (!token) {
      showNotification('Musisz być zalogowany, aby polubić post.', 'error');
      return;
    }
    try {
      await axios.post(`/api/posts/${id}/like`, {}, { headers: { 'x-auth-token': token } });
      fetchPosts();
    } catch (err) {
      console.error('Błąd podczas lajkowania postu:', err.response?.data);
      showNotification(err.response?.data?.msg || 'Błąd lajkowania', 'error');
    }
  };

  const voteFight = async (postId, team) => {
    const token = localStorage.getItem('token');
    if (!token) {
      showNotification('Musisz być zalogowany, aby głosować.', 'error');
      return;
    }
    try {
      await axios.post(`/api/votes/fight/${postId}`, { postId, team }, { headers: { 'x-auth-token': token } });
      fetchPosts();
    } catch (err) {
      console.error('Błąd podczas głosowania:', err.response?.data);
      showNotification(err.response?.data?.msg || 'Błąd głosowania', 'error');
    }
  };

  const handleCommentChange = (postId, value) => {
    setNewComments(prev => ({ ...prev, [postId]: value }));
  };

  const submitComment = async (postId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      showNotification('Musisz być zalogowany, aby dodać komentarz.', 'error');
      return;
    }
    try {
      await axios.post(`/api/comments/post/${postId}`, { text: newComments[postId] }, { headers: { 'x-auth-token': token } });
      setNewComments(prev => ({ ...prev, [postId]: '' }));
      fetchPostComments(postId);
    } catch (err) {
      console.error('Błąd podczas dodawania komentarza:', err.response?.data);
      showNotification(err.response?.data?.msg || 'Błąd dodawania komentarza', 'error');
    }
  };

  return (
    <div className="feed-page">
      <h1>Tablica</h1>
      <Notification message={notification?.message} type={notification?.type} onClose={clearNotification} />
      <form onSubmit={submitPost} className="add-post-form">
        <input type="text" name="title" value={newPost.title} onChange={onChange} placeholder="Tytuł" required />
        <textarea name="content" value={newPost.content} onChange={onChange} placeholder="Treść" required />
        <select name="type" value={newPost.type} onChange={onChange}>
          <option value="discussion">Dyskusja</option>
          <option value="fight">Walka</option>
          <option value="image">Obraz</option>
          <option value="poll">Ankieta</option>
        </select>
        {newPost.type === 'fight' && (
          <>
            <input type="text" name="teamA" value={newPost.teamA} onChange={onChange} placeholder="Zespół A" />
            <input type="text" name="teamB" value={newPost.teamB} onChange={onChange} placeholder="Zespół B" />
          </>
        )}
        <button type="submit">Dodaj</button>
      </form>

      <div className="posts-list">
        {posts.map(post => (
          <div key={post.id} className="post-item">
            <h3>{post.title}</h3>
            <p className="author">{post.author?.username || 'Anonim'} - {new Date(post.createdAt).toLocaleString()}</p>
            <p>{post.content}</p>
            {post.type === 'fight' && post.fight && (
              <div className="fight-vote">
                <button onClick={() => voteFight(post.id, 'A')}>{post.fight.teamA || 'Zespół A'}</button>
                <button onClick={() => voteFight(post.id, 'B')}>{post.fight.teamB || 'Zespół B'}</button>
                <p>Głosy: A {post.fight.votes?.teamA || 0} | B {post.fight.votes?.teamB || 0}</p>
              </div>
            )}
            <div className="post-actions">
              <button onClick={() => likePost(post.id)}>Lubię to ({post.likes ? post.likes.length : 0})</button>
            </div>
            <div className="comments-section">
              <form onSubmit={(e) => { e.preventDefault(); submitComment(post.id); }} className="add-comment-form">
                <input
                  type="text"
                  value={newComments[post.id] || ''}
                  onChange={(e) => handleCommentChange(post.id, e.target.value)}
                  placeholder="Dodaj komentarz"
                />
                <button type="submit">Wyślij</button>
              </form>
              <div className="comments-list">
                {(postComments[post.id] || []).map((c) => (
                  <div key={c.id} className="comment-item">
                    <strong>{c.authorUsername}</strong>: {c.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeedPage;
