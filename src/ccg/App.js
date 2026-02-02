import React, { useContext, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import { setAuthToken } from './api';
import Profile from './pages/Profile';
import Collection from './pages/Collection';
import Lobby from './pages/Lobby';
import PlayGame from './pages/PlayGame';
import Navbar from './components/Navbar';
import ImageTest from './components/ImageTest';
import Shop from './pages/Shop';
import Decks from './pages/Decks';
import Crafting from './pages/Crafting';
import './styles/index.css';

function CcgApp() {
  const { user, token, loading } = useContext(AuthContext);

  useEffect(() => {
    setAuthToken(token || null);
  }, [token]);

  if (loading) {
    return <div className="ccg-root min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="ccg-root min-h-screen">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-6">
        <Routes>
          <Route index element={<Navigate to="lobby" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route path="collection" element={<Collection />} />
          <Route path="lobby" element={<Lobby user={user} />} />
          <Route path="test-images" element={<ImageTest />} />
          <Route path="game/:roomId" element={<PlayGame user={user} />} />
          <Route path="shop" element={<Shop />} />
          <Route path="decks" element={<Decks />} />
          <Route path="crafting" element={<Crafting />} />
        </Routes>
      </div>
    </div>
  );
}

export default CcgApp;
