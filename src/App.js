import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider } from './auth/AuthContext';
import Header from './Header';
import TournamentPage from './tournamentLogic/TournamentPage';
import Register from './logLogic/Register';
import Login from './logLogic/Login';
import ModeratorPanel from './moderatorLogic/ModeratorPanel';
import ProfilePage from './profileLogic/ProfilePage';
import MessagesPage from './messagesLogic/MessagesPage';
import CharacterSelectionPage from './characterLogic/CharacterSelectionPage';
import LeaderboardPage from './leaderboardLogic/LeaderboardPage';
import FeedPage from './feedLogic/FeedPage';
import Home from './Home';
import CreateFightPage from './fightLogic/CreateFightPage';
import FightDetailPage from './fightLogic/FightDetailPage';
import NotificationsPage from './notificationLogic/NotificationsPage';
import DivisionsPage from './divisionsLogic/DivisionsPage';
import PostPage from './postLogic/PostPage';
import GlobalChatSystem from './chat/GlobalChatSystem';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  return (
    <AuthProvider>
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
            {/* Global Chat System - only show when logged in */}
            {isLoggedIn && <GlobalChatSystem />}
          </div>
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;