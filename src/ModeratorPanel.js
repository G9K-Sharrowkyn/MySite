import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Notification from './Notification';
import './ModeratorPanel.css';

const ModeratorPanel = () => {
  const [fights, setFights] = useState([]);
  const [notification, setNotification] = useState(null);
  const [newFight, setNewFight] = useState({
    category: '',
    user1: '',
    user2: '',
    fighter1: '',
    fighter2: '',
    user1Record: '',
    user2Record: '',
    overallRecord1: '',
    overallRecord2: '',
  });

  useEffect(() => {
    fetchFights();
  }, []);

  const fetchFights = async () => {
    try {
      const res = await axios.get('/api/fights');
      setFights(res.data);
    } catch (err) {
      console.error('Błąd podczas pobierania walk:', err);
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
  };

  const clearNotification = () => {
    setNotification(null);
  };

  const onChange = (e) => {
    setNewFight({ ...newFight, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token'); // Zakładamy, że token jest przechowywany w localStorage
    if (!token) {
      showNotification('Musisz być zalogowany jako moderator, aby dodać walkę.', 'error');
      return;
    }

    try {
      await axios.post('/api/fights', newFight, {
        headers: {
          'x-auth-token': token,
        },
      });
      showNotification('Walka dodana pomyślnie!', 'success');
      setNewFight({
        category: '',
        user1: '',
        user2: '',
        fighter1: '',
        fighter2: '',
        user1Record: '',
        user2Record: '',
        overallRecord1: '',
        overallRecord2: '',
      });
      fetchFights(); // Odśwież listę walk
    } catch (err) {
      console.error('Błąd podczas dodawania walki:', err.response.data);
      showNotification(err.response.data.msg || 'Błąd dodawania walki', 'error');
    }
  };

  const onDelete = async (id) => {
    const token = localStorage.getItem('token');
    if (!token) {
      showNotification('Musisz być zalogowany jako moderator, aby usunąć walkę.', 'error');
      return;
    }
    if (window.confirm('Czy na pewno chcesz usunąć tę walkę?')) {
      try {
        await axios.delete(`/api/fights/${id}`, {
          headers: {
            'x-auth-token': token,
          },
        });
        showNotification('Walka usunięta pomyślnie!', 'success');
        fetchFights();
      } catch (err) {
        console.error('Błąd podczas usuwania walki:', err.response.data);
        showNotification(err.response.data.msg || 'Błąd usuwania walki', 'error');
      }
    }
  };

  return (
    <div className="moderator-panel">
      <h1>Panel Moderatora</h1>
      <Notification message={notification?.message} type={notification?.type} onClose={clearNotification} />

      <h2>Dodaj nową walkę</h2>
      <form onSubmit={onSubmit} className="add-fight-form">
        <input type="text" name="category" value={newFight.category} onChange={onChange} placeholder="Kategoria (np. Main Card)" required />
        <input type="text" name="user1" value={newFight.user1} onChange={onChange} placeholder="Użytkownik 1" required />
        <input type="text" name="fighter1" value={newFight.fighter1} onChange={onChange} placeholder="Zawodnk 1" required />
        <input type="text" name="user1Record" value={newFight.user1Record} onChange={onChange} placeholder="Rekord Użytkownika 1" required />
        <input type="text" name="overallRecord1" value={newFight.overallRecord1} onChange={onChange} placeholder="Ogólny Rekord 1" required />
        <input type="text" name="user2" value={newFight.user2} onChange={onChange} placeholder="Użytkownik 2" required />
        <input type="text" name="fighter2" value={newFight.fighter2} onChange={onChange} placeholder="Zawodnk 2" required />
        <input type="text" name="user2Record" value={newFight.user2Record} onChange={onChange} placeholder="Rekord Użytkownika 2" required />
        <input type="text" name="overallRecord2" value={newFight.overallRecord2} onChange={onChange} placeholder="Ogólny Rekord 2" required />
        <button type="submit">Dodaj Walkę</button>
      </form>

      <h2>Zarządzaj walkami</h2>
      <div className="fight-list-moderator">
        {fights.map((fight) => (
          <div key={fight.id} className="fight-item-moderator">
            <span>{fight.category}: {fight.fighter1} vs {fight.fighter2}</span>
            <button onClick={() => onDelete(fight.id)} className="delete-btn">Usuń</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModeratorPanel;
