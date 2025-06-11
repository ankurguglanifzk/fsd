import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import Header from "../Header/Header";
import "./LoginPage.css";

export default function LoginPage() {
    // Form fields
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);

    // UI state
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    //  Authentication functions from context
    const { login, googleLogin } = useAuth();
    const navigate = useNavigate();
    // Ref to hold the Google login button container
    const googleButtonRef = useRef(null);
    // Google OAuth callback handler
    const handleGoogleCallback = useCallback(async (response) => {
        setIsLoading(true);
        setError("");
        console.log("Received Google credential:", response.credential);

        try {
            const result = await googleLogin(response.credential);

            // Added a check to ensure the result object is valid
            if (result && result.success) {
                navigate("/dashboard");
            } else {
                setError(result?.message || "An unknown error occurred during Google login.");
            }
        } catch (err) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, [googleLogin, navigate]);

    // Initialize the Google Sign-In button
    useEffect(() => {
        const initializeGoogleButton = () => {
            if (window.google && googleButtonRef.current) {
                try {
                    window.google.accounts.id.initialize({
                        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
                        callback: handleGoogleCallback,
                    });

                    window.google.accounts.id.renderButton(
                        googleButtonRef.current,
                        { theme: "outline", size: "large", text: "continue_with", width: "300" }
                    );
                } catch (error) {
                    console.error("Error initializing Google Sign-In:", error);
                    setError("Could not load Google Sign-In. Please try again later.");
                }
            }
        };

        if (window.google) {
            initializeGoogleButton();
        } else {
            // Dynamically load the Google script
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.onload = initializeGoogleButton;
            script.onerror = () => {
                 console.error("Failed to load Google Sign-In script.");
                 setError("Could not load Google Sign-In script. Please check your connection.");
            }
            document.body.appendChild(script);

            return () => {
                document.body.removeChild(script);
            };
        }
    }, [handleGoogleCallback]);

    // Handle traditional form login
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        if (!username.trim() || !password) {
            setError("Username and Password are required.");
            setIsLoading(false);
            return;
        }

        try {
            const result = await login(username.trim(), password);

            if (result && result.success) {
                navigate("/dashboard");
            } else {
                setError(result?.message || "Login failed. Please check your credentials.");
            }
        } catch (err)
 {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
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
                            <label htmlFor="login-username" className="form-label">
                                Username
                            </label>
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
                            <label htmlFor="login-password" className="form-label">
                                Password
                            </label>
                            <div className="password-input-container">
                                <input
                                    id="login-password"
                                    type={showPassword ? "text" : "password"}
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
                                    aria-label={showPassword ? "Hide password" : "Show password"}
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
                            {isLoading ? (
                                <Loader2 size={24} className="loading-icon" />
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    {/* --- OAuth Section --- */}
                    <div className="oauth-divider">
                        <span>OR</span>
                    </div>

                    <div className="google-login-container" style={{ display: 'flex', justifyContent: 'center', height: '40px' }}>
                         <div ref={googleButtonRef}></div>
                    </div>
                </div>
                <footer className="login-footer">
                    Task Tracker App &copy; {new Date().getFullYear()}
                </footer>
            </main>
        </div>
    );
}
