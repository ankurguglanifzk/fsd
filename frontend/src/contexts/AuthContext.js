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
            const response = await api.post('/users/login', { Username: username, Password: password });
            const { access_token, user: userData } = response.data;

            if (access_token && userData) {
                localStorage.setItem('access_token', access_token);
                setUser(userData);
                return { success: true };
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

    // --- MODIFIED FUNCTION ---
    const googleLogin = useCallback(async (googleToken) => {
        setAuthLoading(true);
        try {
            const response = await api.post('/users/google/verify-token', { token: googleToken });
            const { access_token, user: userData } = response.data;

            if (access_token && userData) {
                localStorage.setItem('access_token', access_token);
                setUser(userData);
                return { success: true };
            }
            // This is the crucial change: handle cases where the server response is 200 OK
            // but the expected data (token, user) is missing.
            console.error("Google login succeeded but server response was incomplete.");
            return { success: false, message: "Login failed: Incomplete server response." };
        } catch (error) {
            console.error("Google Login failed:", error);
            return { success: false, message: error.response?.data?.message || "Google Login failed." };
        } finally {
            setAuthLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('access_token');
        // Optionally, redirect to login page after logout
        // window.location.href = '/login';
    }, []);

    return (
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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
