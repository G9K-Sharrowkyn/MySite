import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Header from './Header';
import TournamentPage from './TournamentPage';
import Register from './Register';
import Login from './Login';
import ModeratorPanel from './ModeratorPanel';
import ProfilePage from './ProfilePage';
import MessagesPage from './MessagesPage';
import CharacterSelectionPage from './CharacterSelectionPage';
import LeaderboardPage from './LeaderboardPage';
import Home from './Home';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  return (
    <Router>
      <div className="App">
        <Header isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register setIsLoggedIn={setIsLoggedIn} />} />
          <Route path="/login" element={<Login setIsLoggedIn={setIsLoggedIn} />} />
          <Route path="/moderator" element={<ModeratorPanel />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/profile/me" element={<ProfilePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/characters" element={<CharacterSelectionPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;