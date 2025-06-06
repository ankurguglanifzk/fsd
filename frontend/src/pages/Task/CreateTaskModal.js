// src/components/CreateTaskModal.js
import React, { useState, useEffect } from 'react';
import './CreateTaskModal.css';

export default function CreateTaskModal({ isOpen, onClose, onSubmit, projectId, currentUser, users }) {
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
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

    // --- Required fields check ---
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (!dueDate) {
      setError('Due Date is required.');
      return;
    }
    if (!assignedTo) {
      setError('Assigned User is required.');
      return;
    }

    const taskData = {
      Description: description.trim(),
      DueDate: dueDate,
      AssignedToUserID: assignedTo,
      ProjectID: projectId,
      Status: 'new',
    };

    setLoading(true);
    try {
      await onSubmit(taskData);
      onClose();
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

        {/* Error Message */}
        {error && <p className="error-message" style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="task-description">Description:</label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="Enter task description"
            />
          </div>

          <div className="form-group">
            <label htmlFor="task-dueDate">Due Date:</label>
            <input
              id="task-dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="task-assignedTo">Assign To:</label>
            <select
              id="task-assignedTo"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              required
            >
              <option value="">-- Select User --</option>
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
            <button type="button" onClick={onClose} className="button-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
