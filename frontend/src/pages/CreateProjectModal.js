import React, { useState } from 'react';
// Assuming you have some CSS for modal-overlay, modal-content etc.
// import './CreateProjectModal.css';

// Add 'onCreate' to the props
export default function CreateProjectModal({ isOpen, onClose, currentUserId, onCreate }) {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }
    // --- MODIFIED: Added check for Description ---
    if (!description.trim()) {
        setError('Description is required');
        return;
    }
    // --- END MODIFICATION ---
    if (!startDate || !endDate) {
      setError('Start and end dates are required');
      return;
    }
    if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
      setError('Invalid date format');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date cannot be after end date');
      return;
    }

    setError('');
    setLoading(true);

    const projectData = {
      ProjectName: projectName.trim(),
      Description: description.trim(),
      StartDate: startDate,
      EndDate: endDate,
      OwnerUserID: currentUserId,
    };

    try {
      const jsonBody = JSON.stringify(projectData);
      console.log('Sending project data:', jsonBody);

      const response = await fetch('http://localhost:5000/api/v1/projects/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Correctly included!
        body: jsonBody,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Project creation failed');
      }

      console.log('Project created:', result);
      
      if (onCreate) {
        onCreate(); // Call the refresh function passed from Dashboard
      }

      onClose(); // Close modal after success

      // Reset form
      setProjectName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Create New Project</h3>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          {/* Project Name Input */}
          <div className="form-group"> {/* Added for structure */}
            <label htmlFor="projectName">Project Name:</label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Description Input */}
          <div className="form-group">
            <label htmlFor="description">Description:</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required // --- MODIFIED: Added required attribute ---
            />
          </div>

          {/* Start Date Input */}
          <div className="form-group">
            <label htmlFor="startDate">Start Date:</label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          {/* End Date Input */}
          <div className="form-group">
            <label htmlFor="endDate">End Date:</label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="submit" disabled={loading} className="button-primary"> {/* Added class */}
              {loading ? 'Creating...' : 'Create Project'}
            </button>
            <button type="button" onClick={onClose} className="button-secondary">Cancel</button> {/* Added class */}
          </div>
        </form>
      </div>
    </div>
  );
}