import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import './ProfilePage.css';

const ProfilePage = () => {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [profilePicture, setProfilePicture] = useState('');

  const currentUserId = localStorage.getItem('userId');

  useEffect(() => {
    const idToFetch = userId === 'me' ? localStorage.getItem('userId') : userId;
    if (idToFetch) {
      fetchProfile(idToFetch);
      fetchComments(idToFetch);
    }
  }, [userId]);

  const fetchProfile = async (id) => {
    try {
      const res = await axios.get(`/api/profile/${id}`);
      setProfile(res.data);
      setDescription(res.data.description || '');
      setProfilePicture(res.data.profilePicture || '');
    } catch (err) {
      console.error('Błąd podczas pobierania profilu:', err);
    }
  };

  const fetchComments = async (id) => {
    try {
      const res = await axios.get(`/api/comments/user/${id}`);
      setComments(res.data);
    } catch (err) {
      console.error('Błąd podczas pobierania komentarzy:', err);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Musisz być zalogowany, aby dodać komentarz.');
      return;
    }
    try {
      await axios.post(`/api/comments/user/${userId}`, { text: newComment }, {
        headers: {
          'x-auth-token': token,
        },
      });
      setNewComment('');
      fetchComments(userId);
    } catch (err) {
      console.error('Błąd podczas dodawania komentarza:', err.response?.data);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Musisz być zalogowany, aby edytować profil.');
      return;
    }
    try {
      await axios.put('/api/profile/me', { description, profilePicture }, {
        headers: {
          'x-auth-token': token,
        },
      });
      setIsEditing(false);
      fetchProfile(currentUserId);
    } catch (err) {
      console.error('Błąd podczas aktualizacji profilu:', err.response?.data);
    }
  };

  if (!profile) {
    return <div className="profile-page">Ładowanie profilu...</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <img src={profile.profilePicture || 'https://via.placeholder.com/150'} alt="Profilowe" className="profile-picture" />
        <h2>{profile.username}</h2>
        <p>Punkty: {profile.points || 0} (Ranga: {profile.rank})</p>
        {currentUserId === userId && (
          <button onClick={() => setIsEditing(!isEditing)} className="edit-profile-btn">
            {isEditing ? 'Anuluj edycję' : 'Edytuj profil'}
          </button>
        )}
        {currentUserId !== userId && (
          <Link to={`/messages?to=${userId}`} className="send-message-btn">Wyślij wiadomość</Link>
        )}
      </div>

      {isEditing && currentUserId === userId ? (
        <form onSubmit={handleProfileUpdate} className="edit-profile-form">
          <div className="form-group">
            <label>Opis:</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
          </div>
          <div className="form-group">
            <label>Link do zdjęcia profilowego:</label>
            <input type="text" value={profilePicture} onChange={(e) => setProfilePicture(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">Zapisz zmiany</button>
        </form>
      ) : (
        <div className="profile-details">
          <h3>Opis:</h3>
          <p>{profile.description || 'Brak opisu.'}</p>
        </div>
      )}

      <div className="profile-characters">
        <h3>Postacie:</h3>
        {profile.characters && profile.characters.length > 0 ? (
          <ul>
            {profile.characters.map(char => (
              <li key={char.id}>{char.name}</li>
            ))}
          </ul>
        ) : (
          <p>Brak postaci.</p>
        )}
      </div>

      <div className="profile-fights">
        <h3>Historia walk:</h3>
        {profile.fights && profile.fights.length > 0 ? (
          <ul>
            {profile.fights.map(fight => (
              <li key={fight.id}>{fight.fighter1} vs {fight.fighter2} ({fight.category})</li>
            ))}
          </ul>
        ) : (
          <p>Brak historii walk.</p>
        )}
      </div>

      <div className="comments-section">
        <h3>Komentarze:</h3>
        <form onSubmit={handleCommentSubmit} className="add-comment-form">
          <textarea
            placeholder="Dodaj komentarz..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            required
          ></textarea>
          <button type="submit" className="btn-primary">Dodaj komentarz</button>
        </form>
        <div className="comments-list">
          {comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id} className="comment-item">
                <p><strong><Link to={`/profile/${comment.authorId}`}>{comment.authorUsername}</Link></strong> ({new Date(comment.timestamp).toLocaleString()}):</p>
                <p>{comment.text}</p>
              </div>
            ))
          ) : (
            <p>Brak komentarzy.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
