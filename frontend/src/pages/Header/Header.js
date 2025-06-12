import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Header.css';
import { useAuth } from '../../contexts/AuthContext';

// Logout Icon
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

// User Management Icon
const UserManagementIcon = ({ className }) => (
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
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 016-6h6a6 6 0 016 6v1h-3M18 18h3m-1.5-1.5V21m-3.182-6.325a4.001 4.001 0 00-5.636 0M17 10a1 1 0 11-2 0 1 1 0 012 0z"
    />
  </svg>
);

const Header = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout: contextLogout } = useAuth();
  const isAdmin = user?.roles?.includes('admin');

  const handleLogout = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/users/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        contextLogout?.();
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
          src="./task-tracker.png"
          alt="Task Tracker Logo"
          className="header-logo"
        />
        <div className="header-title">Task Tracker</div>
      </div>

      {isAuthenticated && (
        <div className="header-actions">
          {isAdmin && (
            <Link to="/admin/user-management" className="header-button user-management-button" aria-label="User Management">
              <UserManagementIcon className="logout-icon header-icon" />
              <span>Manage Users</span>
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="header-button logout-button"
            aria-label="Logout"
          >
            <LogoutIcon className="logout-icon header-icon" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Header;
