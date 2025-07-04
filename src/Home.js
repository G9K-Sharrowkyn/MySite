import React, { useState } from 'react';
import api from './api';
import TournamentPage from './TournamentPage';
import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/api/profile/search?query=${searchQuery}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error('Błąd podczas wyszukiwania:', err);
      setSearchResults([]);
    }
  };

  return (
    <div className="home-page">
      <h1>Witaj na portalu!</h1>
      <p>Tutaj znajdziesz najnowsze turnieje i aktywności.</p>

      <div className="search-section">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Szukaj użytkowników..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit">Szukaj</button>
        </form>
        {searchResults.length > 0 && (
          <div className="search-results">
            <h3>Wyniki wyszukiwania:</h3>
            <ul>
              {searchResults.map(user => (
                <li key={user.id}>
                  <Link to={`/profile/${user.id}`}>
                    <img src={user.profilePicture || 'https://via.placeholder.com/50'} alt="Profilowe" className="search-profile-picture" />
                    {user.username}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <TournamentPage />
      {/* Tutaj można dodać więcej sekcji, np. najnowsze komentarze, popularne profile, itp. */}
    </div>
  );
};

export default Home;
