import React from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Added Link
import './Header.css';
import { useAuth } from '../../contexts/AuthContext';

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

// Placeholder User Management Icon (Optional)
const UserManagementIcon = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 016-6h6a6 6 0 016 6v1h-3M18 18h3m-1.5-1.5V21m-3.182-6.325a4.001 4.001 0 00-5.636 0M17 10a1 1 0 11-2 0 1 1 0 012 0z" />
  </svg>
);


const Header = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout: contextLogout } = useAuth(); // Get user object

  const isAdmin = user?.roles?.includes('admin'); // Check if user is admin

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
        // Optionally, still log out on frontend if API fails but contextLogout is available
        // contextLogout?.();
        // navigate('/login');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Optionally, still log out on frontend if API fails but contextLogout is available
      // contextLogout?.();
      // navigate('/login');
    }
  };

  // Removed handleNewButtonClick as it's being replaced by User Management link

  return (
    <div className="app-header">
      <div className="logo-container">
        <img
          src="./task-tracker.png" // Ensure this path is correct from your public folder
          alt="Task Tracker Logo"
          className="header-logo"
        />
      </div>

      <div className="header-title">Task Tracker</div>

      {isAuthenticated && (
        <div className="header-actions">
          {/* Conditionally render User Management Link for Admins */}
          {isAdmin && (
            <Link to="/admin/user-management" className="header-button user-management-button" aria-label="User Management">
              <UserManagementIcon className="header-icon" /> {/* Optional Icon */}
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
