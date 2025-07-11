// src/pages/Admin/UserManagementPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import UserList from '../../User/UserList'; 
import CreateUserModal from '../../User/CreateUserModal';
import EditUserModal from '../../User/EditUserModal'; 
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api'; 
import './UserManagementPage.css'; 

const UserManagementPage = () => {
  const { user } = useAuth(); 
  const isAdmin = user?.roles?.includes('admin');

  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [allSystemRoles, setAllSystemRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);

  
  // Only users with the admin role can see and interact with this page.
  // This effect correctly redirects non-admins.
  useEffect(() => {
    if (user === undefined) return; 
    if (!isAdmin) {
      console.warn("User Management: Access denied. User is not an admin.");
      navigate('/dashboard'); 
    }
  }, [user, isAdmin, navigate]);

  //  Fetch Users
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await api.get('/users/'); 
      setUsers(response.data || []);
    } catch (err) {
      setError(`Failed to fetch users: ${err.response?.data?.message || err.message}`);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]); 

  // Fetch Roles
  const fetchAllSystemRoles = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get('/users/roles'); 
      setAllSystemRoles(response.data || []);
    } catch (err) {
      setError(prevError => `${prevError} Failed to fetch roles: ${err.response?.data?.message || err.message}`.trim());
      setAllSystemRoles([]);
    }
  }, [isAdmin]); 
  //Run on initial load
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchAllSystemRoles();
    }
  }, [isAdmin, fetchUsers, fetchAllSystemRoles]); 

  // Create user
  const handleCreateUser = async (userData) => {
    if (!isAdmin) throw new Error("Permission denied.");
    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/users/', userData);
      setShowCreateModal(false);
      fetchUsers(); 
    } catch (err) {
      setError(`Failed to create user: ${err.response?.data?.message || err.message}`);
      throw err; 
    } finally {
      setIsSubmitting(false);
    }
  };
  // Edit User modal 
  const handleOpenEditModal = (userForEdit) => {
    setUserToEdit(userForEdit);
    setShowEditModal(true);
  };
  // Update User
  const handleUpdateUser = async (userId, userData) => {
    if (!isAdmin) throw new Error("Permission denied.");
    setIsSubmitting(true);
    setError('');
    try {
      await api.put(`/users/${userId}`, userData);
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
  // Delete User
  const handleDeleteUser = async (userId) => {
    if (!isAdmin) {
        setError("Permission denied to delete user.");
        return;
    }
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      setIsLoading(true); 
      setError('');
      try {
        await api.delete(`/users/${userId}`);
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