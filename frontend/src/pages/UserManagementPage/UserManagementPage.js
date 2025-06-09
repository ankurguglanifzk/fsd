// src/pages/Admin/UserManagementPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import UserList from '../../User/UserList'; 
import CreateUserModal from '../../User/CreateUserModal';
import EditUserModal from '../../User/EditUserModal'; 
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api'; // MODIFIED: Import the central api instance
import './UserManagementPage.css'; 

const UserManagementPage = () => {
  // MODIFIED: 'apiFetch' is no longer provided by the context.
  const { user } = useAuth(); 
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [allSystemRoles, setAllSystemRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);

  const isAdmin = user?.roles?.includes('admin');

  // This effect correctly redirects non-admins.
  useEffect(() => {
    if (user === undefined) return; 
    if (!isAdmin) {
      console.warn("User Management: Access denied. User is not an admin.");
      navigate('/dashboard'); 
    }
  }, [user, isAdmin, navigate]);

  // MODIFIED: All data fetching now uses the 'api' object.
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await api.get('/api/v1/users/'); 
      setUsers(response.data || []);
    } catch (err) {
      setError(`Failed to fetch users: ${err.response?.data?.message || err.message}`);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]); 

  const fetchAllSystemRoles = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get('/api/v1/users/roles'); 
      setAllSystemRoles(response.data || []);
    } catch (err) {
      setError(prevError => `${prevError} Failed to fetch roles: ${err.response?.data?.message || err.message}`.trim());
      setAllSystemRoles([]);
    }
  }, [isAdmin]); 

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchAllSystemRoles();
    }
  }, [isAdmin, fetchUsers, fetchAllSystemRoles]); 

  const handleCreateUser = async (userData) => {
    if (!isAdmin) throw new Error("Permission denied.");
    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/api/v1/users/', userData);
      setShowCreateModal(false);
      fetchUsers(); 
    } catch (err) {
      setError(`Failed to create user: ${err.response?.data?.message || err.message}`);
      throw err; 
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (userForEdit) => {
    setUserToEdit(userForEdit);
    setShowEditModal(true);
  };

  const handleUpdateUser = async (userId, userData) => {
    if (!isAdmin) throw new Error("Permission denied.");
    setIsSubmitting(true);
    setError('');
    try {
      await api.put(`/api/v1/users/${userId}`, userData);
      setShowEditModal(false);
      setUserToEdit(null);
      fetchUsers(); 
    } catch (err) {
      setError(`Failed to update user: ${err.response?.data?.message || err.message}`);
      throw err; 
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!isAdmin) {
        setError("Permission denied to delete user.");
        return;
    }
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      setIsLoading(true); 
      setError('');
      try {
        await api.delete(`/api/v1/users/${userId}`);
        fetchUsers(); 
      } catch (err) {
        setError(`Failed to delete user: ${err.response?.data?.message || err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  if (user === undefined) { 
    return <div className="loading-container"><p>Loading user data...</p></div>; 
  }
  if (!isAdmin) { 
    return <div className="loading-container"><p>Access Denied. Redirecting...</p></div>;
  }

  // The JSX structure remains the same
  return (
    <div className="user-management-page">
      <header className="ump-header">
        <Link to="/dashboard" className="button-secondary back-to-dashboard-button">
          &larr; Back to Dashboard 
        </Link>
        <h1>User Management</h1>
        <button onClick={() => setShowCreateModal(true)} className="button-primary">
          + Create New User
        </button>
      </header>

      {error && <p className="error-message global-error-message">{error}</p>}

      <UserList
        users={users}
        onEditUser={handleOpenEditModal}
        onDeleteUser={handleDeleteUser}
        isLoading={isLoading}
      />

      {showCreateModal && (
        <CreateUserModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreateUser={handleCreateUser}
          allSystemRoles={allSystemRoles}
          isLoading={isSubmitting}
        />
      )}

      {showEditModal && userToEdit && (
        <EditUserModal
          isOpen={showEditModal}
          onClose={() => { setShowEditModal(false); setUserToEdit(null); }}
          userToEdit={userToEdit}
          onUpdateUser={handleUpdateUser}
          allSystemRoles={allSystemRoles}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
};

export default UserManagementPage;