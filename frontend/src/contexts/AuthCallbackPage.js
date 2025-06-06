import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext'; // Ensure path is correct

/**
 * This component's sole purpose is to handle the redirect from the OAuth provider.
 * It grabs the token from the URL, stores it, and then redirects to the dashboard.
 */
const AuthCallbackPage = () => {
  const { checkAuthStatus } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Get the token from the URL query parameter.
    const token = searchParams.get('token');

    if (token) {
      console.log("OAuth Callback: Token found, saving to localStorage.");
      // Store the token from the URL into local storage.
      localStorage.setItem('access_token', token);
      
      // Notify the AuthContext to re-check the user's status with the new token.
      // This will fetch the user's data and update the global state.
      checkAuthStatus().then(() => {
        // After auth status is checked and user is set, navigate to the dashboard.
        navigate('/dashboard');
      });

    } else {
      console.error("OAuth Callback: No token found in URL. Redirecting to login.");
      // If for some reason the token is missing, redirect back to the login page with an error.
      navigate('/login?error=oauth_failed');
    }
  }, [searchParams, navigate, checkAuthStatus]);

  // Render a simple loading message while the redirect and state update happens.
  return (
    <div style={{ textAlign: 'center', marginTop: '5rem' }}>
      <h2>Authenticating...</h2>
      <p>Please wait, you are being redirected.</p>
    </div>
  );
};

export default AuthCallbackPage;