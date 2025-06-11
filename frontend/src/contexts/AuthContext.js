// src/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../api'; 
//AuthContext is the context we’ll share.
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    //authLoading tracks whether auth-related actions are ongoing (to show loaders).
    const [authLoading, setAuthLoading] = useState(true);
    //function checkAuthStatus takes the new token and sends it to our own backend to be verified.
    const checkAuthStatus = useCallback(async () => {
        const token = localStorage.getItem('access_token');
        //Backend verifies the Google token, finds or creates a user profile, and sends back our application's own JWT. 
        if (token) {
            try {
                const response = await api.get('/users/me');
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
            //Calls the backend /users/login endpoint with credentials.
            const response = await api.post('/users/login', { Username: username, Password: password });
            const { access_token, user: userData } = response.data;

            if (access_token && userData) {
                localStorage.setItem('access_token', access_token);
                setUser(userData);
                return { success: true };
                //On success, saves the token and updates the user.
            }
            // Ensure we return a failure object if the payload is incomplete
            return { success: false, message: "Login failed: Incomplete server response." };
        } catch (error) {
            console.error("Login failed:", error);
            return { success: false, message: error.response?.data?.message || "Login failed." };
        } finally {
            setAuthLoading(false);
        }
    }, []);

    const googleLogin = useCallback(async (googleToken) => {
        setAuthLoading(true);
        try {
            //uses Google’s token to authenticate with  backend.
            const response = await api.post('/users/google/verify-token', { token: googleToken });
            const { access_token, user: userData } = response.data;

            if (access_token && userData) {
                localStorage.setItem('access_token', access_token);
                setUser(userData);
                return { success: true };
            }
            console.error("Google login succeeded but server response was incomplete.");
            return { success: false, message: "Login failed: Incomplete server response." };
        } catch (error) {
            console.error("Google Login failed:", error);
            return { success: false, message: error.response?.data?.message || "Google Login failed." };
        } finally {
            setAuthLoading(false);
        }
    }, []);


    //Clears the user’s data and removes the token.
    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('access_token');
    }, []);
    

    return (
        //Makes the user, login, googleLogin, logout, etc., available globally in  app
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                login,
                googleLogin,
                logout,
                authLoading,
                checkAuthStatus,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
// components can call useAuth() to access all auth-related state and methods easily
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
