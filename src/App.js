import React, { useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider, AuthContext } from './auth/AuthContext';
import Header from './Header';
import TournamentPage from './tournamentLogic/TournamentPage';
import Register from './logLogic/Register';
import Login from './logLogic/Login';
import ModeratorPanel from './moderatorLogic/ModeratorPanel';
import AdminPanel from './adminLogic/AdminPanel';
import ProfilePage from './profileLogic/ProfilePage';
import MessagesPage from './messagesLogic/MessagesPage';
import ConversationChat from './messagesLogic/ConversationChat';
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
import FeedbackButton from './shared/FeedbackButton';
import './App.css';

function AppContent() {
  const { user, loading } = useContext(AuthContext);
  const isLoggedIn = !!user;

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="App">
      <Header isLoggedIn={isLoggedIn} setIsLoggedIn={() => {}} />
      <Routes>
        <Route path="/" element={isLoggedIn ? <Navigate to="/feed" replace /> : <Home />} />
        <Route path="/register" element={<Register setIsLoggedIn={() => {}} />} />
        <Route path="/login" element={<Login setIsLoggedIn={() => {}} />} />
        <Route path="/moderator" element={<ModeratorPanel />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:userId" element={<ConversationChat />} />
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
      {/* Feedback Button - always visible */}
      <FeedbackButton />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <AppContent />
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
