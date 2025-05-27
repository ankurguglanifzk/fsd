// src/components/EditTaskModal.js
import React, { useState, useEffect } from 'react';
// Assuming you'll reuse or adapt styles from CreateTaskModal.css or CreateProjectModal.css
import './CreateTaskModal.css'; 

// Define allowed statuses, ideally this should come from a shared config or props
const ALLOWED_TASK_STATUSES = ['new', 'in-progress', 'blocked', 'completed', 'not started'];

export default function EditTaskModal({ isOpen, onClose, task, onUpdate, users, currentProject }) {
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('new');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && task) {
      setDescription(task.Description || '');
      // Ensure DueDate is handled correctly, providing a '' default if null/undefined
      setDueDate(task.DueDate ? task.DueDate.split('T')[0] : '');
      setStatus(task.Status || 'new');
      // Ensure AssignedToUserID is handled correctly, providing a '' default if null/undefined
      setAssignedToUserId(task.AssignedToUserID || '');
      setError('');
      setLoading(false);
    }
  }, [isOpen, task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // --- MODIFIED: Added checks for required fields ---
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (!dueDate) {
        setError('Due Date is required.');
        return;
    }
    if (!assignedToUserId) {
        setError('Assign To user is required.');
        return;
    }
    // --- END MODIFICATION ---

    const taskDataToUpdate = {
      Description: description.trim(),
      DueDate: dueDate, // Now required, send the value
      Status: status,
      AssignedToUserID: assignedToUserId, // Now required, send the value
      ProjectID: task.ProjectID || currentProject?.ProjectID, // Ensure ProjectID is included
    };

    setLoading(true);
    try {
      await onUpdate(task.TaskID, taskDataToUpdate);
      // No need to call onClose here if Dashboard's handleUpdateTask does it
    } catch (err) {
      setError(err.message || 'Failed to update task.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Edit Task: {description.substring(0,30)}{description.length > 30 ? "..." : ""}</h3>
        {error && <p className="error-message" style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-task-description">Description:</label>
            <textarea
              id="edit-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-task-dueDate">Due Date:</label>
            <input
              id="edit-task-dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required // --- MODIFIED: Add required ---
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-task-status">Status:</label>
            <select
              id="edit-task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {ALLOWED_TASK_STATUSES.map(sVal => (
                <option key={sVal} value={sVal}>
                  {sVal.charAt(0).toUpperCase() + sVal.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="edit-task-assignedTo">Assign To:</label>
            <select
              id="edit-task-assignedTo"
              value={assignedToUserId || ''}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              required // --- MODIFIED: Add required ---
            >
              <option value="">-- Select User --</option> {/* --- MODIFIED: Update default option --- */}
              {Array.isArray(users) && users.map(u => (
                <option key={u.UserID} value={u.UserID}>
                  {u.FullName || u.Username}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="submit" disabled={loading} className="button-primary">
              {loading ? 'Updating...' : 'Update Task'}
            </button>
            <button type="button" onClick={onClose} className="button-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}