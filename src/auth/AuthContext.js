import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const AuthContext = createContext();
const DEFAULT_AVATAR = '/logo192.png';
const PRIMARY_ADMIN_EMAIL = 'ak4maaru@gmail.com';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isPrimaryAdminUser = (data) =>
  normalizeEmail(data?.email) === PRIMARY_ADMIN_EMAIL;

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
    role: isPrimaryAdminUser(data) ? 'admin' : (data.role || 'user')
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const fetchUser = useCallback(
    async (authToken) => {
      if (!authToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get('/api/profile/me', {
          headers: { 'x-auth-token': authToken }
        });

        setUser(normalizeUser(response.data, response.data?.id));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user:', error);
        if (error.response?.status === 401) {
          logout();
        } else {
          setLoading(false);
        }
      }
    },
    [logout]
  );

  const login = useCallback(
    (authToken, userId, userData) => {
      localStorage.setItem('token', authToken);
      localStorage.setItem('userId', userId);
      setToken(authToken);

      const normalized = normalizeUser(userData, userId);
      if (normalized) {
        setUser(normalized);
        setLoading(false);
      } else {
        setUser(null);
        fetchUser(authToken);
      }
    },
    [fetchUser]
  );

  const updateUser = useCallback((userData) => {
    setUser((prev) => ({ ...(prev || {}), ...userData }));
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setUser(null);
      return;
    }

    if (!user) {
      fetchUser(token);
    } else {
      setLoading(false);
    }
  }, [fetchUser, token, user]);

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
