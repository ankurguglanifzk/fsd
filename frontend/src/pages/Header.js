import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';
import { useAuth } from '../contexts/AuthContext';

// SVG Logout Icon Component
const LogoutIcon = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

const Header = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout: contextLogout } = useAuth();

  const handleLogout = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/v1/users/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        contextLogout?.(); // Optional chaining in case it's undefined
        navigate('/login');
      } else {
        const errorData = await response.text();
        console.error('Logout API failed:', response.status, errorData);
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="app-header">
      <div className="logo-container">
        <img
          src="/task-tracker.png"
          alt="Task Tracker Logo"
          className="header-logo"
        />
      </div>

      <div className="header-title">Task Tracker</div>

      {isAuthenticated && (
        <button
          onClick={handleLogout}
          className="logout-button"
          aria-label="Logout"
        >
          <LogoutIcon className="logout-icon" />
          <span>Logout</span>
        </button>
      )}
    </div>
  );
};

export default Header;
