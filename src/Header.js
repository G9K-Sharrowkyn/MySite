import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Header.css';

const Header = ({ isLoggedIn, setIsLoggedIn }) => {
  const navigate = useNavigate();
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
    // Check if user is moderator
    const userId = localStorage.getItem('userId');
    setIsModerator(userId === 'MODERATOR-UNIQUE-ID-1234');
  }, [setIsLoggedIn]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setIsLoggedIn(false);
    navigate('/login'); // Przekieruj na stronę logowania po wylogowaniu
  };

  return (
    <header className="app-header">
      <nav>
        <ul>
          <li><Link to="/">Turnieje</Link></li>
          {isLoggedIn ? (
            <>
              <li><Link to="/profile/me">Mój Profil</Link></li>
              <li><Link to="/messages">Wiadomości</Link></li>
              <li><Link to="/characters">Postacie</Link></li>
              {isModerator && <li><Link to="/moderator">Panel Moderatora</Link></li>}
              <li><Link to="/leaderboard">Ranking</Link></li>
              <li><button onClick={handleLogout} className="logout-button">Wyloguj</button></li>
            </>
          ) : (
            <>
              <li><Link to="/register">Rejestracja</Link></li>
              <li><Link to="/login">Logowanie</Link></li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
};

export default Header;
