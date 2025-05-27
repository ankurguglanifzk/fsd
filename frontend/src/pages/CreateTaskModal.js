// src/components/CreateTaskModal.js (FIXED)
import React, { useState, useEffect } from 'react';
import './CreateTaskModal.css';

// Renamed props for clarity: onClose, onSubmit, projectId, currentUser, users
export default function CreateTaskModal({ isOpen, onClose, onSubmit, projectId, currentUser, users }) {
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setDueDate('');
      setAssignedTo('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    const taskData = {
      Description: description.trim(),
      DueDate: dueDate || null,
      AssignedToUserID: assignedTo || null,
      ProjectID: projectId,
      // OwnerUserID: currentUser?.UserID, // Backend gets owner from session, but can be set
      Status: 'new', // <-- FIX: Use 'new' as a default allowed status
    };

    setLoading(true);
    try {
      // Call the onSubmit function passed from Dashboard, which will handle the API call
      await onSubmit(taskData);
      onClose(); // Close modal on success
    } catch (err) {
      setError(err.message || "Failed to create task.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Create New Task</h3>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          {/* ... (form groups remain the same) ... */}
           <div className="form-group">
            <label htmlFor="task-description">Description:</label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="task-dueDate">Due Date:</label>
            <input
              id="task-dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="task-assignedTo">Assign To:</label>
            <select id="task-assignedTo" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">-- Unassigned --</option>
              {Array.isArray(users) && users.map((user) => (
                <option key={user.UserID} value={user.UserID}>
                  {user.FullName || user.Username} ({user.Username})
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="submit" disabled={loading} className="button-primary">
              {loading ? 'Creating...' : 'Create Task'}
            </button>
            {/* FIX: Use onClose prop for the Cancel button */}
            <button type="button" onClick={onClose} className="button-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}