import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header'; // Assuming Header component exists
import './LoginPage.css'; // Assuming LoginPage.css exists

export default function LoginPage() { // Changed to named export if that's the intention
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth(); // Assuming useAuth provides a login function
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');

    if (errorParam === 'unauthorized_user') {
      setError('Your Google account is not authorized to access this app.');
    } else if (errorParam === 'inactive_user') {
      setError('Your account is inactive. Please contact the administrator.');
    } else if (errorParam === 'google_auth_failed') {
      setError('Google authentication failed. Please try again.');
    } else if (errorParam === 'google_user_info_failed') {
      setError('Failed to retrieve user information from Google.');
    } else if (errorParam === 'unauthorized_domain') {
      setError('Login with this Google account domain is not allowed.');
    } else if (errorParam === 'default_role_missing') {
      setError('System configuration error. Please contact support.');
    } else if (errorParam === 'user_creation_failed') {
      setError('Failed to create user account with Google. Please try again or contact support.');
    }


  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username.trim() || !password) {
      setError('Username and Password are required.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/v1/users/login', { // Ensure this matches your API endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important for cookies/session
        body: JSON.stringify({
          Username: username.trim(),
          Password: password,
          // RememberMe: rememberMe, // Backend needs to handle this if desired
        }),
      });

      const responseData = await response.json(); // Always try to parse JSON

      if (!response.ok) {
        throw new Error(responseData.message || `Login failed with status: ${response.status}`);
      }

      console.log('Login API response:', responseData);
      login(responseData); // Pass the user data to your auth context's login function
      // Navigation to dashboard will likely be handled by AuthContext or App router
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true); // Optionally show loading state
    // Redirect to your backend endpoint that initiates Google OAuth
    window.location.href = 'http://localhost:5000/api/v1/users/login/google';
  };

  return (
    <div className="login-page-container">
      <Header /> {/* Assuming Header is a general site header */}
      <main className="login-content-wrapper">
        <div className="login-card">
          <div className="login-header">
            {/* You can add a logo here if you have one */}
            {/* <img src="/path-to-your-logo.png" alt="Task Tracker Logo" className="login-app-logo" /> */}
            <h1 className="login-title">Welcome! Please sign in</h1>
            {/* <p className="login-subtitle">Access your Task Tracker dashboard</p> */}
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="login-username" className="form-label">Username</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input"
                placeholder="your_username"
                required
                autoFocus
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password" className="form-label">Password</label>
              <div className="password-input-container">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="remember-me-container">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="remember-me-checkbox"
                disabled={isLoading}
              />
              <label htmlFor="remember-me" className="remember-me-label">
                Remember me
              </label>
              {/* Optional: Forgot password link */}
              {/* <a href="/forgot-password" className="forgot-password-link">Forgot password?</a> */}
            </div>

            {error && (
              <div className="error-message-container">
                <AlertTriangle size={18} className="error-icon" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="submit-button"
            >
              {isLoading ? <Loader2 size={24} className="loading-icon" /> : 'Sign In'}
            </button>
          </form>

          <div className="oauth-divider">
            <span>OR</span>
          </div>

          <div className="google-login-container">
            <button
              className="google-login-button"
              onClick={handleGoogleLogin}
              aria-label="Continue with Google"
              disabled={isLoading}
            >
              <img
                src="https://developers.google.com/identity/images/g-logo.png" // Standard Google logo
                alt="Google logo"
                className="google-icon"
              />
              Continue with Google
            </button>
          </div>
        </div>

        <footer className="login-footer">
          Task Tracker App &copy; {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}
