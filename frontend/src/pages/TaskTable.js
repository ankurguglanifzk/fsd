// src/components/TaskTable.js
import React from 'react';
// import './TaskTable.css'; // Create or use existing styles for the table and buttons

const ALLOWED_TASK_STATUSES = ['new', 'in-progress', 'blocked', 'completed', 'not started'];

const TaskTable = ({
  selectedProject,
  tasksLoading,
  handleCompleteTask,
  handleDeleteTask,
  handleUpdateTaskStatus,
  onStartEditTask, // New prop to trigger edit task modal
  // isAdmin, // Pass if edit/delete task permissions depend on admin role specifically
  // currentUserRoles, // Pass current user's roles for more granular control
}) => {
  if (!selectedProject) {
    return <p className="info-message">Select a project to view tasks.</p>;
  }

  const tasks = selectedProject.tasks || []; // Ensure tasks is an array (lowercase 't')

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return isNaN(date.getTime())
      ? 'Invalid Date'
      : date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  };

  const getStatusClass = (status) =>
    status ? `status-${status.toLowerCase().replace(/\s+/g, '-')}` : '';

  return (
    <div className="task-table-container">
      {tasksLoading && tasks.length === 0 && <p className="info-message">Loading tasks...</p>}
      
      <table className="task-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Owner</th>
            <th>Assigned To</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <tr key={task.TaskID}>
                <td title={task.Description}>{task.Description}</td>
                <td>{formatDate(task.DueDate)}</td>
                <td className={getStatusClass(task.Status)}>
                  <select
                    value={task.Status}
                    onChange={(e) => handleUpdateTaskStatus(task.TaskID, e.target.value)}
                    disabled={tasksLoading}
                    className="status-dropdown"
                    style={{ 
                        padding: '5px', 
                        borderRadius: '4px', 
                        border: '1px solid #ccc',
                        backgroundColor: '#333',
                        color: '#e0e0e0'
                    }}
                  >
                    {ALLOWED_TASK_STATUSES.map(statusValue => (
                      <option key={statusValue} value={statusValue}>
                        {statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{task.OwnerUsername || 'N/A'}</td>
                <td>{task.AssignedToUsername || 'N/A'}</td>
                <td className="task-actions-cell">
                  {/* Edit Task Button */}
                  <button
                    onClick={() => onStartEditTask(task)}
                    className="task-action-button" // Style this button
                    title="Edit Task"
                    disabled={tasksLoading}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#3498db' }}
                  >
                    ✏️
                  </button>
                  {task.Status !== 'completed' && (
                    <button
                      onClick={() => handleCompleteTask(task.TaskID)}
                      className="task-action-button"
                      disabled={tasksLoading}
                      title="Mark as Complete"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#2ecc71' }}
                    >
                      ✓
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteTask(task.TaskID)}
                    className="task-delete-button"
                    disabled={tasksLoading}
                    title="Delete Task"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#e74c3c' }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="info-message" style={{textAlign: 'center'}}> 
                {tasksLoading ? "Loading tasks..." : "No tasks found in this project."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default TaskTable;
