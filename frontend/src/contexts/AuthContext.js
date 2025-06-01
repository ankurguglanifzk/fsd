// src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);                // Full user info (from /me)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);   // Tracks loading state

  // Define a reusable apiFetch utility
  const apiFetch = useCallback(async (url, options = {}) => {
    const defaultOptions = {
      credentials: 'include', // Essential for session cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    const finalOptions = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url, finalOptions);
      const responseText = await response.text(); // Get text first

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { message: responseText || `Request failed: ${response.status}` };
        }
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      if (response.status === 204 || !responseText) { // Handle No Content
        return { message: "Operation successful, no content returned." }; 
      }
      
      try {
        return JSON.parse(responseText); // Parse valid JSON
      } catch (e) {
          console.error("AuthContext: Failed to parse JSON response from apiFetch:", responseText, e);
          throw new Error("Invalid JSON response from server.");
      }
    } catch (error) {
      console.error('AuthContext: API Fetch Error:', error.message);
      throw error; // Re-throw to be caught by the calling component
    }
  }, []); // No dependencies needed if it's a generic fetch utility

  // On mount, try to fetch the current logged-in user's full data using apiFetch
  useEffect(() => {
    const fetchCurrentUser = async () => {
      setAuthLoading(true); // Ensure loading is true at the start of this attempt
      try {
        const userData = await apiFetch('http://localhost:5000/api/v1/users/me'); // Uses the new apiFetch
        console.log('AuthContext: Fetched current user:', userData);
        if (userData && userData.UserID) { // Check if actual user data was returned
            setUser(userData);
            setIsAuthenticated(true);
        } else {
            // This case might occur if /me returns 200 but empty/invalid data for a non-session
            setUser(null);
            setIsAuthenticated(false);
        }
      } catch (error) {
        console.warn('AuthContext: No active session found or fetch error for /me:', error.message);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };

    fetchCurrentUser();
  }, [apiFetch]); // apiFetch is now a dependency

  const login = (userData) => {
    // This function is called after LoginPage successfully logs in via its own API call.
    // It receives the full user data from the login API response.
    console.log('AuthContext: login called with userData:', userData);
    setUser(userData);
    setIsAuthenticated(true);
    setAuthLoading(false); // Ensure loading is false after login
  };

  const logout = useCallback(async () => {
    console.log('AuthContext: Attempting to logout user.');
    setAuthLoading(true);
    try {
      // Attempt to call the backend logout endpoint
      await apiFetch('http://localhost:5000/api/v1/users/logout', { method: 'POST' });
      console.log('AuthContext: Backend logout successful.');
    } catch (error) {
      console.error('AuthContext: Backend logout failed, proceeding with client-side logout:', error.message);
      // Still proceed with client-side logout even if backend call fails
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setAuthLoading(false);
      // Navigation to '/login' should be handled by the component calling logout
      // or by a route guard observing isAuthenticated.
    }
  }, [apiFetch]); // apiFetch is a dependency for logout

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        isAuthenticated, 
        login, 
        logout, 
        authLoading, 
        setUser, // Exposing setUser can be useful for profile updates etc.
        apiFetch  // <-- Now providing apiFetch
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined || context === null) { // Check for null as well
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
