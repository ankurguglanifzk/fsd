// src/pages/User/EditUserModal.js (or src/components/Admin/EditUserModal.js)
import React, { useState, useEffect } from 'react';
import './EditUserModal.css'; // Assuming a shared CSS file

const EditUserModal = ({ isOpen, onClose, userToEdit, onUpdateUser, allSystemRoles, isLoading: isSubmitting }) => {
  const [formData, setFormData] = useState({
    UserID: '',
    Username: '',
    Email: '',
    FullName: '',
    IsActive: true,
    RoleName: '', 
    Password: '', 
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && userToEdit) {
      setFormData({
        UserID: userToEdit.UserID || '',
        Username: userToEdit.Username || '',
        Email: userToEdit.Email || '',
        FullName: userToEdit.FullName || '',
        IsActive: userToEdit.IsActive !== undefined ? userToEdit.IsActive : true,
        RoleName: userToEdit.roles && userToEdit.roles.length > 0 ? userToEdit.roles[0].RoleName : '', 
        Password: '',
      });
      setError('');
    }
  }, [isOpen, userToEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    
    if (!formData.RoleName) { 
        setError('A role must be assigned.');
        return;
    }
    if (formData.Email && !/\S+@\S+\.\S+/.test(formData.Email)) {
        setError('Please enter a valid email address.');
        return;
    }

    const updateData = {
      FullName: formData.FullName.trim() || null,
      Email: formData.Email.trim() || null,
      IsActive: formData.IsActive,
      RoleName: formData.RoleName, 
    };

    if (formData.Password) { // Only include password if a new one is entered
      updateData.Password = formData.Password;
    }

    try {
      await onUpdateUser(formData.UserID, updateData);
    } catch (err) {
      setError(err.message || 'Failed to update user.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content user-modal-content">
        <h3>Edit User: {formData.Username}</h3>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-username">Username:</label>
            <input
              id="edit-username"
              type="text"
              value={formData.Username}
              readOnly
              className="form-input-readonly"
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-email">Email:</label>
            <input
              id="edit-email"
              type="email"
              name="Email"
              value={formData.Email}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-fullName">Full Name:</label>
            <input
              id="edit-fullName"
              type="text"
              name="FullName"
              value={formData.FullName}
              onChange={handleChange}
              disabled={isSubmitting}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="edit-password">New Password (optional):</label>
            <input
              id="edit-password"
              type="password"
              name="Password"
              value={formData.Password}
              onChange={handleChange}
              placeholder="Leave blank to keep current password"
              disabled={isSubmitting}
            />
          </div>
          

          <div className="form-group">
            <label>Role<span className="required-asterisk">*</span>:</label>
            <div className="roles-radio-group roles-inline"> {/* Added roles-inline for consistency */}
              {allSystemRoles && allSystemRoles.length > 0 ? (
                allSystemRoles.map((role) => (
                  <label htmlFor={`edit-role-${role.RoleID}`} key={role.RoleID} className="role-radio-label-inline"> {/* Added class */}
                    <input
                      type="radio"
                      id={`edit-role-${role.RoleID}`}
                      name="RoleName" 
                      value={role.RoleName}
                      checked={formData.RoleName === role.RoleName}
                      onChange={handleChange} 
                      disabled={isSubmitting}
                      className="role-radio-input-inline" /* Added class */
                    />
                     {role.RoleName}
                  </label>
                ))
              ) : (
                <p>No roles available or failed to load roles.</p>
              )}
            </div>
          </div>

          <div className="form-group form-group-checkbox">
            <input
              type="checkbox"
              id="edit-isActive"
              name="IsActive"
              checked={formData.IsActive}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            <label htmlFor="edit-isActive" className="checkbox-label">User is Active</label>
          </div>

          <div className="modal-actions">
            <button type="submit" className="button-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update User'}
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

export default EditUserModal;
