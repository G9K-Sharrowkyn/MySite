import React, { lazy, Suspense, useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router';
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
import VerifyEmail from './auth/VerifyEmail';
import GlobalChatSystem from './chat/GlobalChatSystem';
import FeedbackButton from './shared/FeedbackButton';
import CookieConsent from './legal/CookieConsent';
import LegalPolicyPage from './legal/LegalPolicyPage';
import HelpPage from './legal/HelpPage';
import BuildVersion from './BuildVersion';
import './App.css';

const CcgApp = lazy(() => import('./ccg/App'));
const SwoopRacingPage = lazy(() => import('./swoopRacing/SwoopRacingPage'));
const TronArenaPage = lazy(() => import('./tronLogic/TronArenaPage'));

const RoleRoute = ({ children, roles }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppContent() {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();
  const isLoggedIn = !!user;
  const isSwoopRoute = location.pathname === '/swoop-racing';
  const updateAvailable = false;

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
      <Suspense fallback={<div className="loading">Loading...</div>}>
      <Routes>
        <Route path="/" element={isLoggedIn ? <Navigate to="/feed" replace /> : <Home />} />
        <Route path="/register" element={<Register setIsLoggedIn={() => {}} />} />
        <Route path="/login" element={<Login setIsLoggedIn={() => {}} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/settings" element={<AccountSettings />} />
        <Route
          path="/moderator"
          element={<RoleRoute roles={['moderator', 'admin']}><ModeratorPanel /></RoleRoute>}
        />
        <Route
          path="/admin"
          element={<RoleRoute roles={['admin']}><AdminPanel /></RoleRoute>}
        />
        <Route
          path="/admin/divisions"
          element={<RoleRoute roles={['admin']}><AdminDivisionsPage /></RoleRoute>}
        />
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
        <Route path="/help" element={<HelpPage />} />
        <Route
          path="/ccg/*"
          element={(
            <RoleRoute roles={['moderator', 'admin']}>
              <CcgApp />
            </RoleRoute>
          )}
        />
        <Route path="/speed-racing" element={<Navigate to="/swoop-racing" replace />} />
        <Route
          path="/swoop-racing"
          element={isLoggedIn ? <SwoopRacingPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/tron-arena"
          element={isLoggedIn ? <TronArenaPage /> : <Navigate to="/login" replace />}
        />
      </Routes>
      </Suspense>
      {/* Global Chat System - only show when logged in */}
      {isLoggedIn && !isSwoopRoute && <GlobalChatSystem />}
      {/* Feedback Button - always visible */}
      {!isSwoopRoute && <FeedbackButton />}
      <CookieConsent />
      {!isSwoopRoute && <BuildVersion />}
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
