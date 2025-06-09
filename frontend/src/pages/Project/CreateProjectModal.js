import React, { useState } from "react";
import api from "../../api"; // Using the centralized api instance

// Add 'onCreate' to the props
export default function CreateProjectModal({
  isOpen,
  onClose,
  currentUserId,
  onCreate,
}) {
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // --- Start Validation ---
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (!startDate || !endDate) {
      setError("Start and end dates are required");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError("Start date cannot be after end date");
      return;
    }
    // --- End Validation ---

    setError("");
    setLoading(true);

    const projectData = {
      ProjectName: projectName.trim(),
      Description: description.trim(),
      StartDate: startDate,
      EndDate: endDate,
      OwnerUserID: currentUserId,
    };

    try {
      console.log("Sending project data:", projectData);

      // --- MODIFICATION: Use the 'api' instance instead of 'fetch' ---
      // This ensures the Axios request interceptor attaches the auth token.
      const response = await api.post('/api/v1/projects/', projectData);

      // With Axios, the response data is in the 'data' property.
      const result = response.data; 
      
      console.log("Project created:", result);

      if (onCreate) {
        onCreate(); // Call the refresh function passed from the parent component
      }

      onClose(); // Close modal after success

      // Reset form
      setProjectName("");
      setDescription("");
      setStartDate("");
      setEndDate("");

    } catch (err) {
      console.error("Error creating project:", err);
      // Axios provides more detailed error objects. We can get the server's
      // error message from err.response.data.message if it exists.
      const errorMessage = err.response?.data?.message || err.message || "Project creation failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Create New Project</h3>
        {error && <p className="error-message" style={{ color: 'red' }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          {/* Project Name Input */}
          <div className="form-group">
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
              required
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
            <button type="submit" disabled={loading} className="button-primary">
              {loading ? "Creating..." : "Create Project"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="button-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
