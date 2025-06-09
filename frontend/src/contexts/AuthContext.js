// src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../api'; // Import the configured Axios instance

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const checkAuthStatus = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const response = await api.get('/api/v1/users/me');
        setUser(response.data);
      } catch (error) {
        console.error("Session check failed, token might be expired.", error);
        localStorage.removeItem('access_token');
        setUser(null);
      }
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback(async (username, password) => {
    setAuthLoading(true);
    try {
      const response = await api.post('/api/v1/users/login', { Username: username, Password: password });
      const { access_token, user: userData } = response.data;

      if (access_token && userData) {
        localStorage.setItem('access_token', access_token);
        setUser(userData);
        return { success: true };
      }
    } catch (error) {
      console.error("Login failed:", error);
      return { success: false, message: error.response?.data?.message || "Login failed." };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('access_token');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        authLoading,
        checkAuthStatus, // MODIFIED: Export the function
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};