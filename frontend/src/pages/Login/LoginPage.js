import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom'; // Import useNavigate
import { AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../Header/Header'; 
import './LoginPage.css'; 

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Get the login function from our JWT-aware AuthContext
  const { login } = useAuth(); 
  const location = useLocation();
  const navigate = useNavigate(); // Hook for navigation

  // This useEffect for handling Google OAuth errors is correct and remains unchanged.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      // (Your existing error handling logic is good)
      const errorMessages = {
        unauthorized_user: 'Your Google account is not authorized to access this app.',
        inactive_user: 'Your account is inactive. Please contact the administrator.',
        google_auth_failed: 'Google authentication failed. Please try again.',
        google_user_info_failed: 'Failed to retrieve user information from Google.',
        unauthorized_domain: 'Login with this Google account domain is not allowed.',
        default_role_missing: 'System configuration error. Please contact support.',
        user_creation_failed: 'Failed to create user account with Google. Please try again.',
      };
      setError(errorMessages[errorParam] || 'An unknown error occurred during Google login.');
    }
  }, [location]);

  // --- SUBMIT HANDLER IS NOW CORRECTED ---
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
      // The AuthContext's login function now handles the API call.
      // We just pass the credentials and await the result.
      const result = await login(username.trim(), password);

      if (result.success) {
        // On success, navigate to the dashboard.
        navigate('/dashboard'); 
      } else {
        // If the context's login function returns an error, display it.
        setError(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      // Catch any unexpected errors during the process.
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    window.location.href = 'http://localhost:5000/api/v1/users/login/google';
  };

  return (
    <div className="login-page-container">
      <Header />
      <main className="login-content-wrapper">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">Welcome! Please sign in</h1>
          </div>
          
          <form onSubmit={handleSubmit} className="login-form">
            {/* --- Username Input --- */}
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

            {/* --- Password Input --- */}
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

            {/* --- Remember Me & Error Display --- */}
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
            </div>

            {error && (
              <div className="error-message-container">
                <AlertTriangle size={18} className="error-icon" />
                <span>{error}</span>
              </div>
            )}

            {/* --- Submit Button --- */}
            <button
              type="submit"
              disabled={isLoading}
              className="submit-button"
            >
              {isLoading ? <Loader2 size={24} className="loading-icon" /> : 'Sign In'}
            </button>
          </form>

          {/* --- OAuth Section --- */}
          <div className="oauth-divider"><span>OR</span></div>
          <div className="google-login-container">
            <button
              className="google-login-button"
              onClick={handleGoogleLogin}
              aria-label="Continue with Google"
              disabled={isLoading}
            >
              <img
                src="https://developers.google.com/identity/images/g-logo.png"
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