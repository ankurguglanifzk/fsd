// src/components/TaskTable.js
import React from 'react';
import './TaskTable.css';

const ALLOWED_TASK_STATUSES = ['new', 'in-progress', 'blocked', 'completed', 'not started'];

const TaskTable = ({
  selectedProject,
  tasksLoading,
  handleCompleteTask,
  handleDeleteTask,
  handleUpdateTaskStatus,
  onStartEditTask,
  currentUser, // Receive the currentUser prop
}) => {
  if (!selectedProject) {
    return <p className="info-message">Select a project to view tasks.</p>;
  }

  const tasks = selectedProject.tasks || [];

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
    status ? `status-card-${status.toLowerCase().replace(/\s+/g, '-')}` : '';

  return (
    <div className="task-card-container">
      {tasksLoading && tasks.length === 0 && <p className="info-message">Loading tasks...</p>}
      
      {!tasksLoading && tasks.length === 0 && (
        <div className="no-tasks-container">
          <img
            src="./task.png"
            alt="No tasks"
            className="no-tasks-image"
          />
          <p className="info-message">No tasks found in this project.</p>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="task-card-list">
          {tasks.map((task) => {
            const userRoles = new Set(currentUser?.roles || []);
            const canDelete = 
                userRoles.has('admin') || 
                userRoles.has('task_creator') || 
                task.OwnerUserID === currentUser?.UserID;
            
            const canEdit =
                userRoles.has('admin') ||
                userRoles.has('task_creator') ||
                task.OwnerUserID === currentUser?.UserID ||
                task.AssignedToUserID === currentUser?.UserID;

            return (
              <div key={task.TaskID} className={`task-card ${getStatusClass(task.Status)}`}>
                <div className="task-card-header">
                  <h4 title={task.Description} className="task-card-description">
                    {task.Description.length > 50 ? task.Description.substring(0, 47) + "..." : task.Description}
                  </h4>
                  <button
                      onClick={() => onStartEditTask(task)}
                      className="task-card-action-button task-card-edit-button"
                      title={canEdit ? "Edit Task" : "You do not have permission to edit"}
                      disabled={tasksLoading || !canEdit}
                  >
                      Edit ✏️
                  </button>
                </div>

                <div className="task-card-body">
                  <div className="task-card-detail">
                    <strong>Due Date:</strong> {formatDate(task.DueDate)}
                  </div>
                  <div className="task-card-detail">
                    <strong>Owner:</strong> {task.OwnerUsername || 'N/A'}
                  </div>
                  <div className="task-card-detail">
                    <strong>Assigned To:</strong> {task.AssignedToUsername || 'N/A'}
                  </div>
                  <div className="task-card-detail task-card-status-container">
                    <strong>Status:</strong>
                    <select
                      value={task.Status}
                      onChange={(e) => handleUpdateTaskStatus(task.TaskID, e.target.value)}
                      disabled={tasksLoading || !canEdit}
                      className="task-card-status-dropdown"
                    >
                      {ALLOWED_TASK_STATUSES.map(statusValue => (
                        <option key={statusValue} value={statusValue}>
                          {statusValue.charAt(0).toUpperCase() + statusValue.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="task-card-actions">
                  {task.Status !== 'completed' && (
                    <button
                      onClick={() => handleCompleteTask(task.TaskID)}
                      className="task-card-action-button task-card-complete-button"
                      disabled={tasksLoading}
                      title="Mark as Complete"
                    >
                      Complete ✓
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteTask(task.TaskID)}
                    className="task-card-action-button task-card-delete-button"
                    disabled={tasksLoading || !canDelete}
                    title={canDelete ? "Delete Task" : "You do not have permission to delete"}
                  >
                    Delete 🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
};

export default TaskTable;