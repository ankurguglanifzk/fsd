import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import './LoginPage.css';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');

    if (errorParam === 'unauthorized_user') {
      setError('Your Google account is not authorized to access this app.');
    } else if (errorParam === 'inactive_user') {
      setError('Your account is inactive. Please contact the administrator.');
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
      const res = await fetch('http://localhost:5000/api/v1/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          Username: username.trim(),
          Password: password,
          RememberMe: rememberMe,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Login failed');
      }

      const userData = await res.json();
      console.log('Login API response:', userData);
      login(userData);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:5000/api/v1/users/login/google';
  };

  return (
    <div className="login-page-container">
      <Header />
      <main className="login-content-wrapper">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">Task Tracker</h1>
            <p className="login-subtitle">Welcome! Please sign in.</p>
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
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
