// src/pages/User/CreateUserModal.js 
import React, { useState, useEffect } from 'react';
import './EditUserModal.css'; 

const CreateUserModal = ({ isOpen, onClose, onCreateUser, allSystemRoles, isLoading: isSubmitting }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRoleName, setSelectedRoleName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Reset form fields when modal opens
      setUsername('');
      setPassword('');
      setEmail('');
      setFullName('');
      setSelectedRoleName('');
      setError('');
    }
  }, [isOpen]);

  const handleRoleChange = (event) => {
    setSelectedRoleName(event.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Username and Password are required.');
      return;
    }
    // if (password !== confirmPassword) { // Removed password confirmation check
    //   setError('Passwords do not match.');
    //   return;
    // }
    if (!selectedRoleName) { 
      setError('A role must be assigned.');
      return;
    }
    if (email && !/\S+@\S+\.\S+/.test(email)) {
        setError('Please enter a valid email address.');
        return;
    }

    const userData = {
      Username: username.trim(),
      Password: password,
      Email: email.trim() || null,
      FullName: fullName.trim() || null,
      RoleName: selectedRoleName, 
    };

    try {
      await onCreateUser(userData);
    } catch (err) {
      setError(err.message || 'Failed to create user.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content user-modal-content">
        <h3>Create New User</h3>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username<span className="required-asterisk">*</span>:</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password<span className="required-asterisk">*</span>:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label htmlFor="fullName">Full Name:</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label>Role<span className="required-asterisk">*</span>:</label>
            <div className="roles-radio-group roles-inline"> 
              {allSystemRoles && allSystemRoles.length > 0 ? (
                allSystemRoles.map((role) => (
                  <label htmlFor={`role-${role.RoleID}`} key={role.RoleID} className="role-radio-label-inline">
                    <input
                      type="radio"
                      id={`role-${role.RoleID}`}
                      name="roleSelection" 
                      value={role.RoleName}
                      checked={selectedRoleName === role.RoleName}
                      onChange={handleRoleChange}
                      disabled={isSubmitting}
                      className="role-radio-input-inline"
                    />
                    {role.RoleName}
                  </label>
                ))
              ) : (
                <p>No roles available or failed to load roles.</p>
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button type="submit" className="button-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
            <button type="button" onClick={onClose} className="button-secondary" disabled={isSubmitting}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;
