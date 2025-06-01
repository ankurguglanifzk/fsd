// src/pages/EditProjectModal.js
import React, { useState, useEffect } from 'react';
// import './CreateProjectModal.css'; // Reuse styles or create EditProjectModal.css

export default function EditProjectModal({ isOpen, onClose, project, onUpdate, users }) {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && project) {
      setProjectName(project.ProjectName || '');
      setDescription(project.Description || '');
      // Dates need to be in YYYY-MM-DD format for input type="date"
      setStartDate(project.StartDate ? project.StartDate.split('T')[0] : '');
      setEndDate(project.EndDate ? project.EndDate.split('T')[0] : '');
      setOwnerUserId(project.OwnerUserID || '');
      setError(''); // Clear previous errors when modal opens
      setLoading(false); // Reset loading state
    }
  }, [isOpen, project]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!projectName.trim()) {
      setError('Project name is required.');
      return;
    }
    // Optional: Add date validation if needed
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        setError('Start date cannot be after end date.');
        return;
    }

    const projectDataToUpdate = {
      ProjectName: projectName.trim(),
      Description: description.trim(),
      StartDate: startDate || null,
      EndDate: endDate || null,
      OwnerUserID: ownerUserId || null,
    };

    setLoading(true);
    try {
      // Call the onUpdate function passed from Dashboard.js
      await onUpdate(project.ProjectID, projectDataToUpdate);
      onClose(); // Close modal on successful update (handled by Dashboard)
    } catch (err) {
      // If onUpdate re-throws, catch it here
      setError(err.message || 'Failed to update project.');
    } finally {
      setLoading(false);
    }
  };

  // Ensure modal doesn't render if not open or no project data
  if (!isOpen || !project) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Edit Project: {project.ProjectName}</h3>
        {error && <p className="error-message" style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-projectName">Project Name:</label>
            <input
              id="edit-projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-description">Description:</label>
            <textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-startDate">Start Date:</label>
            <input
              id="edit-startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-endDate">End Date:</label>
            <input
              id="edit-endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-ownerUserId">Owner:</label>
            <select
              id="edit-ownerUserId"
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
            >
              <option value="">-- Select Owner --</option>
              {/* Ensure users prop is an array and each user has UserID and Username/FullName */}
              {Array.isArray(users) && users.map(u => (
                <option key={u.UserID} value={u.UserID}>
                  {u.FullName || u.Username}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="submit" disabled={loading} className="button-primary">
              {loading ? 'Updating...' : 'Update Project'}
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
