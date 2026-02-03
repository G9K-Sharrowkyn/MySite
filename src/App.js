import React, { useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider, AuthContext } from './auth/AuthContext';
import Header from './Header';
import TournamentPage from './tournamentLogic/TournamentPage';
import Register from './logLogic/Register';
import Login from './logLogic/Login';
import ModeratorPanel from './moderatorLogic/ModeratorPanel';
import AdminPanel from './adminLogic/AdminPanel';
import AdminDivisionsPage from './moderatorLogic/AdminDivisionsPage';
import ProfilePage from './profileLogic/ProfilePage';
import MessagesPage from './messagesLogic/MessagesPage';
import ConversationChat from './messagesLogic/ConversationChat';
import LeaderboardPage from './leaderboardLogic/LeaderboardPage';
import FeedPage from './feedLogic/FeedPage';
import Home from './Home';
import CreateFightPage from './fightLogic/CreateFightPage';
import FightDetailPage from './fightLogic/FightDetailPage';
import NotificationsPage from './notificationLogic/NotificationsPage';
import DivisionsPage from './divisionsLogic/DivisionsPage';
import PostPage from './postLogic/PostPage';
import AccountSettings from './auth/AccountSettings';
import ForgotPassword from './auth/ForgotPassword';
import ResetPassword from './auth/ResetPassword';
import GlobalChatSystem from './chat/GlobalChatSystem';
import FeedbackButton from './shared/FeedbackButton';
import CcgApp from './ccg/App';
import SpeedRacingPage from './speedRacing/SpeedRacingPage';
import CookieConsent from './legal/CookieConsent';
import LegalPolicyPage from './legal/LegalPolicyPage';
import LegalQuickLinks from './legal/LegalQuickLinks';
import './App.css';

const ModeratorRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  const isModerator = user?.role === 'moderator' || user?.role === 'admin';

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isModerator) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppContent() {
  const { user, loading } = useContext(AuthContext);
  const isLoggedIn = !!user;
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Check for app updates every 5 minutes
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/index.html', { 
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const html = await response.text();
        
        // Store initial version on first load
        const storedVersion = localStorage.getItem('app-version');
        const currentVersion = html.substring(0, 1000); // Use first 1KB as version fingerprint
        
        if (!storedVersion) {
          localStorage.setItem('app-version', currentVersion);
        } else if (storedVersion !== currentVersion) {
          setUpdateAvailable(true);
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };

    // Check on mount
    checkForUpdates();
    
    // Check every 5 minutes
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Auto-reload when update is available
  useEffect(() => {
    if (updateAvailable) {
      const timer = setTimeout(() => {
        localStorage.removeItem('app-version');
        window.location.reload(true);
      }, 3000); // Wait 3 seconds before reloading
      
      return () => clearTimeout(timer);
    }
  }, [updateAvailable]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="App">
      {updateAvailable && (
        <div className="update-banner">
          🔄 New version available! Updating in 3 seconds...
        </div>
      )}
      <Header isLoggedIn={isLoggedIn} setIsLoggedIn={() => {}} />
      <Routes>
        <Route path="/" element={isLoggedIn ? <Navigate to="/feed" replace /> : <Home />} />
        <Route path="/register" element={<Register setIsLoggedIn={() => {}} />} />
        <Route path="/login" element={<Login setIsLoggedIn={() => {}} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/settings" element={<AccountSettings />} />
        <Route path="/moderator" element={<ModeratorPanel />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/divisions" element={<AdminDivisionsPage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:userId" element={<ConversationChat />} />
        <Route path="/divisions" element={<DivisionsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/create-fight" element={<CreateFightPage />} />
        <Route path="/fight/:fightId" element={<FightDetailPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/tournaments" element={<TournamentPage />} />
        <Route path="/post/:postId" element={<PostPage />} />
        <Route
          path="/privacy-policy"
          element={<LegalPolicyPage endpoint="/api/privacy/policy" title="Privacy Policy" />}
        />
        <Route
          path="/terms"
          element={<LegalPolicyPage endpoint="/api/privacy/terms" title="Terms of Service" />}
        />
        <Route
          path="/cookie-policy"
          element={<LegalPolicyPage endpoint="/api/privacy/cookies" title="Cookie Policy" />}
        />
        <Route
          path="/ccg/*"
          element={(
            <ModeratorRoute>
              <CcgApp />
            </ModeratorRoute>
          )}
        />
        <Route
          path="/speed-racing"
          element={(
            <ModeratorRoute>
              <SpeedRacingPage />
            </ModeratorRoute>
          )}
        />
      </Routes>
      {/* Global Chat System - only show when logged in */}
      {isLoggedIn && <GlobalChatSystem />}
      {/* Feedback Button - always visible */}
      <FeedbackButton />
      <LegalQuickLinks />
      <CookieConsent />
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
