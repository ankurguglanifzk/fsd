// src/components/Admin/UserList.js
import React from 'react';
import './UserList.css'; // You'll need to create this CSS file

const UserList = ({ users, onEditUser, onDeleteUser, isLoading }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="user-list-container">
      <h2 className="user-list-title">Users</h2> {/* Added Header/Title */}

      {isLoading && (!users || users.length === 0) && (
        <p className="info-message">Loading users...</p>
      )}

      {!isLoading && (!users || users.length === 0) && (
        <p className="info-message">No users found.</p>
      )}

      {!isLoading && users && users.length > 0 && (
        <table className="user-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Active</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.UserID}>
                <td>{user.UserID}</td>
                <td>{user.Username}</td>
                <td>{user.FullName || 'N/A'}</td>
                <td>{user.Email || 'N/A'}</td>
                <td>
                  {user.roles && user.roles.length > 0
                    ? user.roles.map((role) => role.RoleName).join(', ')
                    : 'No roles'}
                </td>
                <td>
                  <span className={`status-badge ${user.IsActive ? 'status-active' : 'status-inactive'}`}>
                    {user.IsActive ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>{formatDate(user.CreatedAt)}</td>
                <td>
                  <button
                    onClick={() => onEditUser(user)}
                    className="action-button edit-button"
                    aria-label={`Edit user ${user.Username}`}
                    title="Edit User"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteUser(user.UserID)}
                    className="action-button delete-button"
                    aria-label={`Delete user ${user.Username}`}
                    title="Delete User"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UserList;
