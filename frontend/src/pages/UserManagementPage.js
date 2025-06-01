// src/pages/Admin/UserManagementPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Corrected path
import UserList from '../User/UserList'; // Path based on uploaded UserManagementPage.js and image
import CreateUserModal from '../User/CreateUserModal'; // Path based on uploaded UserManagementPage.js and image
import EditUserModal from '../User/EditUserModal'; // Path based on uploaded UserManagementPage.js and image
import { useNavigate, Link } from 'react-router-dom'; // Import Link
import './UserManagementPage.css'; 


const API_BASE_USERS = "http://localhost:5000/api/v1/users";

const UserManagementPage = () => {
  const { user, apiFetch } = useAuth(); 
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

  useEffect(() => {
    if (user === undefined) return; 
    if (!isAdmin) {
      console.warn("User Management: Access denied. User is not an admin.");
      navigate('/dashboard'); 
    }
  }, [user, isAdmin, navigate]);


  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError('');
    try {
      if (typeof apiFetch !== 'function') {
        console.error("apiFetch is not a function. Check AuthContext.");
        setError("Configuration error: apiFetch not available.");
        setIsLoading(false);
        return;
      }
      const data = await apiFetch(`${API_BASE_USERS}/`); 
      setUsers(data || []);
    } catch (err) {
      setError(`Failed to fetch users: ${err.message}`);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, isAdmin]); 

  const fetchAllSystemRoles = useCallback(async () => {
    if (!isAdmin) return;
    try {
      if (typeof apiFetch !== 'function') {
        setError(prevError => `${prevError} Configuration error: apiFetch not available for roles.`.trim());
        return;
      }
      const data = await apiFetch(`${API_BASE_USERS}/roles`); 
      setAllSystemRoles(data || []);
    } catch (err) {
      setError(prevError => `${prevError} Failed to fetch roles: ${err.message}`.trim());
      setAllSystemRoles([]);
    }
  }, [apiFetch, isAdmin]); 

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
      if (typeof apiFetch !== 'function') throw new Error("apiFetch is not available.");
      await apiFetch(`${API_BASE_USERS}/`, { 
        method: 'POST',
        body: JSON.stringify(userData),
      });
      setShowCreateModal(false);
      fetchUsers(); 
    } catch (err) {
      setError(`Failed to create user: ${err.message}`);
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
      if (typeof apiFetch !== 'function') throw new Error("apiFetch is not available.");
      await apiFetch(`${API_BASE_USERS}/${userId}`, { 
        method: 'PUT',
        body: JSON.stringify(userData),
      });
      setShowEditModal(false);
      setUserToEdit(null);
      fetchUsers(); 
    } catch (err) {
      setError(`Failed to update user: ${err.message}`);
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
        if (typeof apiFetch !== 'function') throw new Error("apiFetch is not available.");
        await apiFetch(`${API_BASE_USERS}/${userId}`, { method: 'DELETE' });
        fetchUsers(); 
      } catch (err) {
        setError(`Failed to delete user: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  if (user === undefined ) { 
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
