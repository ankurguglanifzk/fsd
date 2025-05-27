// src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);                // Full user info (from /me)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);  // Tracks loading state

  // On mount, try to fetch the current logged-in user's full data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/v1/users/me', {
          credentials: 'include',
        });

        if (!res.ok) throw new Error('Not authenticated');

        const userData = await res.json();
        console.log('AuthContext: Fetched current user:', userData);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        console.warn('AuthContext: No active session found or fetch error:', error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  const login = (userData) => {
    console.log('AuthContext: login called with userData:', userData);
    setUser(userData);          // Full user data passed from login API
    setIsAuthenticated(true);
  };

  const logout = () => {
    console.log('AuthContext: User logged out.');
    setUser(null);
    setIsAuthenticated(false);
    // You can also clear cookies/localStorage if needed here
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, login, logout, authLoading, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
