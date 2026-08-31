import React, { lazy, Suspense, useContext } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider, AuthContext } from './auth/AuthContext';
import Header from './Header';
import FeedbackButton from './shared/FeedbackButton';
import CookieConsent from './legal/CookieConsent';
import BuildVersion from './BuildVersion';
import './App.css';

const TournamentPage = lazy(() => import('./tournamentLogic/TournamentPage'));
const Register = lazy(() => import('./logLogic/Register'));
const Login = lazy(() => import('./logLogic/Login'));
const ModeratorPanel = lazy(() => import('./moderatorLogic/ModeratorPanel'));
const AdminPanel = lazy(() => import('./adminLogic/AdminPanel'));
const AdminDivisionsPage = lazy(() => import('./moderatorLogic/AdminDivisionsPage'));
const ProfilePage = lazy(() => import('./profileLogic/ProfilePage'));
const MessagesPage = lazy(() => import('./messagesLogic/MessagesPage'));
const ConversationChat = lazy(() => import('./messagesLogic/ConversationChat'));
const LeaderboardPage = lazy(() => import('./leaderboardLogic/LeaderboardPage'));
const FeedPage = lazy(() => import('./feedLogic/FeedPage'));
const Home = lazy(() => import('./Home'));
const CreateFightPage = lazy(() => import('./fightLogic/CreateFightPage'));
const FightDetailPage = lazy(() => import('./fightLogic/FightDetailPage'));
const NotificationsPage = lazy(() => import('./notificationLogic/NotificationsPage'));
const DivisionsPage = lazy(() => import('./divisionsLogic/DivisionsPage'));
const PostPage = lazy(() => import('./postLogic/PostPage'));
const AccountSettings = lazy(() => import('./auth/AccountSettings'));
const ForgotPassword = lazy(() => import('./auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./auth/ResetPassword'));
const VerifyEmail = lazy(() => import('./auth/VerifyEmail'));
const LegalPolicyPage = lazy(() => import('./legal/LegalPolicyPage'));
const HelpPage = lazy(() => import('./legal/HelpPage'));
const GlobalChatSystem = lazy(() => import('./chat/GlobalChatSystem'));
const CcgApp = lazy(() => import('./ccg/App'));
const SwoopRacingPage = lazy(() => import('./swoopRacing/SwoopRacingPage'));
const TronArenaFramePage = lazy(() => import('./tronLogic/TronArenaFramePage'));
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
  const isTronRoute = location.pathname === '/tron-arena';
  const isEmbeddedTronRoute = location.pathname === '/tron-game';
  const isImmersiveGameRoute = isSwoopRoute || isTronRoute || isEmbeddedTronRoute;
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
      {!isEmbeddedTronRoute && (
        <Header isLoggedIn={isLoggedIn} setIsLoggedIn={() => {}} />
      )}
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
          element={isLoggedIn ? <TronArenaFramePage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/tron-game"
          element={isLoggedIn ? <TronArenaPage /> : <Navigate to="/login" replace />}
        />
      </Routes>
      </Suspense>
      {/* Global Chat System - only show when logged in */}
      <Suspense fallback={null}>
        {isLoggedIn && !isImmersiveGameRoute && <GlobalChatSystem />}
      </Suspense>
      {/* Feedback Button - always visible */}
      {!isImmersiveGameRoute && <FeedbackButton />}
      {!isEmbeddedTronRoute && <CookieConsent />}
      {!isImmersiveGameRoute && <BuildVersion />}
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
