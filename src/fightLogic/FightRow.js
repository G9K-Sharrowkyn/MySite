import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FightRow.css';

const FightRow = ({ fight }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const fetchComments = async () => {
    try {
      const res = await axios.get(`/api/comments/fight/${fight.id}`);
      const payload = res.data;
      setComments(payload?.comments || payload || []);
    } catch (err) {
      console.error('Błąd podczas pobierania komentarzy:', err);
    }
  };

  useEffect(() => {
    fetchComments();
  }, []);

  const submitComment = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await axios.post(`/api/comments/fight/${fight.id}`, { text: newComment }, { headers: { 'x-auth-token': token } });
      setNewComment('');
      fetchComments();
    } catch (err) {
      console.error('Błąd podczas dodawania komentarza:', err);
    }
  };

  return (
    <div className="fight-row">
      <div className="fighter-block user1-block">
        <div className="user-info">{fight.user1}</div>
        <div className="fighter-name">{fight.fighter1}</div>
        <div className="record">Rekord: {fight.user1Record} (Ogólny: {fight.overallRecord1})</div>
        <div className="fighter-image placeholder"></div>
      </div>
      <div className="vs-text">VS</div>
      <div className="fighter-block user2-block">
        <div className="user-info">{fight.user2}</div>
        <div className="fighter-name">{fight.fighter2}</div>
        <div className="record">Rekord: {fight.user2Record} (Ogólny: {fight.overallRecord2})</div>
        <div className="fighter-image placeholder"></div>
      </div>
      <div className="fight-comments">
        <form onSubmit={submitComment} className="add-comment-form">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Dodaj komentarz"
          />
          <button type="submit">Wyślij</button>
        </form>
        <div className="comments-list">
          {comments.map((c) => (
            <div key={c.id} className="comment-item">
              <strong>{c.authorUsername}</strong>: {c.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FightRow;

