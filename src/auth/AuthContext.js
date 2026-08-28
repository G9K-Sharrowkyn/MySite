import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export const AuthContext = createContext();
const DEFAULT_AVATAR = '/logo192.png';
const SESSION_MARKER = 'cookie-session';

const normalizeUser = (data, fallbackId) => {
  if (!data) {
    return null;
  }

  return {
    id: data.id || data._id || fallbackId || null,
    username: data.username || '',
    displayName: data.displayName || data.profile?.displayName || data.username || '',
    email: data.email || '',
    emailVerified: Boolean(data.emailVerified),
    profilePicture:
      data.profilePicture ||
      data.profile?.profilePicture ||
      data.profile?.avatar ||
      DEFAULT_AVATAR,
    role: data.role || 'user'
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionGeneration = useRef(0);

  const clearSession = useCallback(() => {
    sessionGeneration.current += 1;
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    axios.post('/api/auth/logout').catch(() => {});
    clearSession();
  }, [clearSession]);

  const fetchUser = useCallback(
    async (expectedGeneration = sessionGeneration.current) => {
      try {
        const response = await axios.get('/api/profile/me');
        if (expectedGeneration !== sessionGeneration.current) return null;
        const normalized = normalizeUser(response.data, response.data?.id);
        setUser(normalized);
        localStorage.setItem('token', SESSION_MARKER);
        if (normalized?.id) localStorage.setItem('userId', normalized.id);
        setToken(SESSION_MARKER);
        setLoading(false);
        return normalized;
      } catch (error) {
        if (expectedGeneration !== sessionGeneration.current) return null;
        if (error.response?.status !== 401) {
          console.error('Error fetching user:', error);
        }
        clearSession();
        return null;
      }
    },
    [clearSession]
  );

  const login = useCallback(
    (_authToken, userId, userData) => {
      sessionGeneration.current += 1;
      localStorage.setItem('token', SESSION_MARKER);
      localStorage.setItem('userId', userId);
      setToken(SESSION_MARKER);

      const normalized = normalizeUser(userData, userId);
      if (normalized) {
        setUser(normalized);
        setLoading(false);
      } else {
        setUser(null);
        fetchUser();
      }
    },
    [fetchUser]
  );

  const updateUser = useCallback((userData) => {
    setUser((prev) => ({ ...(prev || {}), ...userData }));
  }, []);

  useEffect(() => {
    const bootstrapSession = async () => {
      const generation = sessionGeneration.current;
      const legacyToken = localStorage.getItem('token');
      try {
        if (legacyToken && legacyToken !== SESSION_MARKER) {
          await axios.post(
            '/api/auth/session',
            {},
            { headers: { 'x-auth-token': legacyToken } }
          );
        }
        await fetchUser(generation);
      } catch (_error) {
        if (generation === sessionGeneration.current) clearSession();
      }
    };
    bootstrapSession();
  }, [clearSession, fetchUser]);

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
