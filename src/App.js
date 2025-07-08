import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import Header from './Header';
import TournamentPage from './TournamentPage';
import Register from './Register';
import Login from './Login';
import ModeratorPanel from './ModeratorPanel';
import ProfilePage from './ProfilePage';
import MessagesPage from './MessagesPage';
import CharacterSelectionPage from './CharacterSelectionPage';
import LeaderboardPage from './LeaderboardPage';
import FeedPage from './FeedPage';
import Home from './Home';
import CreateFightPage from './CreateFightPage';
import FightDetailPage from './FightDetailPage';
import NotificationsPage from './NotificationsPage';
import DivisionsPage from './components/Divisions/DivisionsPage';
import PostPage from './PostPage';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  return (
    <LanguageProvider>
      <Router>
        <div className="App">
          <Header isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
        <Routes>
          <Route path="/" element={isLoggedIn ? <Navigate to="/feed" replace /> : <Home />} />
          <Route path="/register" element={<Register setIsLoggedIn={setIsLoggedIn} />} />
          <Route path="/login" element={<Login setIsLoggedIn={setIsLoggedIn} />} />
          <Route path="/moderator" element={<ModeratorPanel />} />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/characters" element={<CharacterSelectionPage />} />
          <Route path="/divisions" element={<DivisionsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/create-fight" element={<CreateFightPage />} />
          <Route path="/fight/:fightId" element={<FightDetailPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/tournaments" element={<TournamentPage />} />
          <Route path="/post/:postId" element={<PostPage />} />
          </Routes>
        </div>
      </Router>
    </LanguageProvider>
  );
}

export default App;