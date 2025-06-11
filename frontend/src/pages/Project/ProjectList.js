// src/components/ProjectList.js
import React from 'react';
// import './ProjectList.css'; // Make sure this file is imported and styled

const ProjectList = ({
  projects, // List of project 
  loading,
  selectedProject,// Currently selected project
  onSelect,//  Callback when a project is clicked
  onStartEdit,
  onDelete,
  isAdmin, // If true, shows edit/delete buttons
}) => {

  if (loading) {
    return <p className="info-message">Loading projects...</p>;
  }
  if (!projects || projects.length === 0) {
    return <p className="info-message">No projects yet. {isAdmin ? "Create one!" : ""}</p>;
  }

  return (
    <>
      <ul className="project-list">
        {projects.map((project) => {
          const isSelected = selectedProject?.ProjectID === project.ProjectID;
          return (
            <li
              key={project.ProjectID}
              onClick={() => onSelect(project)}
              className={`project-list-item ${isSelected ? 'selected' : ''}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(project);
              }}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                cursor: 'pointer',
                padding: '0.75rem 0.5rem',
                marginBlockEnd: '0.25rem'
              }}
            >
              <div 
                className="project-info" 
                title={project.ProjectName}
                style={{ 
                  flexGrow: 1, 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  marginRight: '0.5rem' 
                }}
              >
                {project.ProjectName}
              </div>
              <div 
                className="project-actions" 
                style={{ 
                  display: 'flex', 
                  gap: '0.5rem', 
                  flexShrink: 0 
                }}
              >
                {isAdmin && ( // Conditionally render Edit button
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); 
                      if (typeof onStartEdit === 'function') {
                          onStartEdit(project); 
                      } else {
                          console.error("onStartEdit prop is not a function in ProjectList", onStartEdit);
                      }
                    }}
                    className="project-edit-button" 
                    title="Edit Project Details"
                    aria-label={`Edit project ${project.ProjectName}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                  >
                    ✏️
                  </button>
                )}
                {isAdmin && ( // Conditionally render Delete button
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); 
                      onDelete(project.ProjectID);
                    }}
                    className="project-delete-button"
                    title="Delete Project"
                    aria-label={`Delete project ${project.ProjectName}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default ProjectList;
