import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

const normalizeUser = (data, fallbackId) => {
  if (!data) {
    return null;
  }

  return {
    id: data.id || data._id || fallbackId || null,
    username: data.username || '',
    email: data.email || '',
    profilePicture:
      data.profilePicture ||
      data.profile?.profilePicture ||
      data.profile?.avatar ||
      '',
    role: data.role || 'user'
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

    // Only fetch user if we have a token but no user data
    if (!user) {
      fetchUser(token);
    } else {
      setLoading(false);
    }
  }, [token]); // Removed user and fetchUser from dependencies to prevent infinite loops

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
