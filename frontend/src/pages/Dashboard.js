// src/pages/Dashboard.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import ProjectList from "../pages/Project/ProjectList";
import TaskTable from "../pages/Task/TaskTable";
import CreateProjectModal from "../pages/Project/CreateProjectModal";
import CreateTaskModal from "../pages/Task/CreateTaskModal";
import EditProjectModal from "../pages/Project/EditProjectModal";
import EditTaskModal from "../pages/Task/EditTaskModel"; 
import { useAuth } from "../contexts/AuthContext";
import api from '../api'; 
import "./Dashboard.css";

export default function Dashboard() {
    const { user } = useAuth();
    
    // State for data
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [allUsers, setAllUsers] = useState([]);

    // State for UI management
    const [loading, setLoading] = useState(false);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [error, setError] = useState("");
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
    const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
    const [showEditProjectModal, setShowEditProjectModal] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [showEditTaskModal, setShowEditTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);

    // --- Grasp values for roles ---
    const userRoles = useMemo(() => new Set(user?.roles || []), [user]);
    const isAdmin = userRoles.has("admin");
    const canCreateTasks = isAdmin || userRoles.has("task_creator");

    // Filters users to show only those with the “read_only_user” role 
    const assignableUsers = useMemo(() => {
        return allUsers.filter(u => u.roles?.some(r => r.RoleName === "read_only_user"));
    }, [allUsers]);

    // --- Data Fetching Callbacks ---
    const fetchProjects = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get('/projects/');
            setProjects(response.data);
        } catch (err) {
            setError(`Failed to load projects: ${err.response?.data?.message || err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAllUsers = useCallback(async () => {
        if (!canCreateTasks) return; 

        try {
            const response = await api.get('/users/');
            setAllUsers(response.data);
        } catch (err) {
            setError(`Failed to load user list: ${err.response?.data?.message || err.message}`);
        }
    }, [canCreateTasks]);

    const fetchProjectDetails = useCallback(async (project) => {
        if (!project?.ProjectID) {
            setSelectedProject(null);
            return;
        }
        setTasksLoading(true);
        setError("");
        setSelectedProject(prev => ({ ...prev, ...project, tasks: [] }));
        try {
            const response = await api.get(`/projects/${project.ProjectID}`);
            setSelectedProject(response.data);
        } catch (err) {
            setError(`Failed to load details for ${project.ProjectName}: ${err.response?.data?.message || err.message}`);
            setSelectedProject({ ...project, tasks: [] });
        } finally {
            setTasksLoading(false);
        }
    }, []);

    // Initial data fetch
    // When the component mounts (or when user changes), it loads projects & users.
    useEffect(() => {
        if (user?.UserID) {
            fetchProjects();
            fetchAllUsers();
        }
    }, [user, fetchProjects, fetchAllUsers]);
    
    // --- CRUD Handlers ---
    // For Project
    const handleProjectCreated = useCallback(() => {
        fetchProjects();
        setShowCreateProjectModal(false);
    }, [fetchProjects]);

    const handleUpdateProject = async (projectId, projectData) => {
        try {
            await api.put(`/projects/${projectId}`, projectData);
            await fetchProjects();
            if (selectedProject?.ProjectID === projectId) {
                await fetchProjectDetails({ ...selectedProject, ...projectData });
            }
            setShowEditProjectModal(false);
        } catch (err) {
            setError(`Update failed: ${err.response?.data?.message || err.message}`);
            throw err;
        }
    };
    
    const handleDeleteProject = async (projectId) => {
        if (window.confirm("Delete this project and all its tasks? This cannot be undone.")) {
            try {
                await api.delete(`/projects/${projectId}`);
                if (selectedProject?.ProjectID === projectId) setSelectedProject(null);
                await fetchProjects();
            } catch (err) {
                setError(`Delete failed: ${err.response?.data?.message || err.message}`);
            }
        }
    };
    // For Tasks
    const handleCreateTask = async (taskData) => {
        if (!selectedProject?.ProjectID) throw new Error("A project must be selected.");
        try {
            await api.post('/tasks/', { ...taskData, ProjectID: selectedProject.ProjectID });
            await fetchProjectDetails(selectedProject);
            setShowCreateTaskModal(false);
        } catch (err) {
            setError(`Creation failed: ${err.response?.data?.message || err.message}`);
            throw err;
        }
    };

    const handleUpdateTask = async (taskId, taskData) => {
        try {
            await api.put(`/tasks/${taskId}`, taskData);
            await fetchProjectDetails(selectedProject);
            setShowEditTaskModal(false);
        } catch (err) {
            setError(`Update failed: ${err.response?.data?.message || err.message}`);
            throw err;
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (window.confirm("Are you sure you want to delete this task?")) {
            try {
                await api.delete(`/tasks/${taskId}`);
                await fetchProjectDetails(selectedProject);
            } catch (err) {
                setError(`Delete failed: ${err.response?.data?.message || err.message}`);
            }
        }
    };
    
    const handleCompleteTask = async (taskId) => {
        try {
            await api.post(`/tasks/${taskId}/complete`);
            await fetchProjectDetails(selectedProject);
        } catch (err) {
            setError(`Could not mark task as complete: ${err.response?.data?.message || err.message}`);
        }
    };

    const handleUpdateTaskStatus = async (taskId, newStatus) => {
        try {
            await api.put(`/tasks/${taskId}`, { Status: newStatus });
            await fetchProjectDetails(selectedProject);
        } catch (err) {
            setError(`Could not update task status: ${err.response?.data?.message || err.message}`);
        }
    };

    return (
        <div className="dashboard-container">
            <div className="content-area">
                <div className="sidebar">
                    {user && (
                        <div className="welcome-message-container">
                            <p className="welcome-text">Welcome, <span className="username-text">{user.Username}</span></p>
                            <p className="role-text">Role: {user.roles?.join(", ")}</p>
                        </div>
                    )}
                    <h2 className="sidebar-title">Projects</h2>
                    {isAdmin && (
                        <button onClick={() => setShowCreateProjectModal(true)} className="project-create-button">
                            + Create New Project
                        </button>
                    )}
                    <ProjectList
                        projects={projects}
                        loading={loading}
                        selectedProject={selectedProject}
                        onSelect={fetchProjectDetails}
                        onStartEdit={(project) => { setEditingProject(project); setShowEditProjectModal(true); }}
                        onDelete={handleDeleteProject}
                        isAdmin={isAdmin}
                    />
                </div>

                <div className="main-content">
                    {error && <p className="error-message">{error}</p>}
                    {selectedProject ? (
                        <>
                            <div className="project-details-header-compact">
                                <div className="project-details-line-one">
                                    <span className="project-name-compact">{selectedProject.ProjectName}</span>
                                    {selectedProject.Description && <span className="project-description-compact"> - {selectedProject.Description}</span>}
                                </div>
                                <div className="project-details-line-two">
                                    <span>Owner: {selectedProject.OwnerUsername || 'N/A'}</span>
                                    <span>|</span>
                                    <span>Start: {selectedProject.StartDate ? new Date(selectedProject.StartDate).toLocaleDateString() : "N/A"}</span>
                                    <span>|</span>
                                    <span>End: {selectedProject.EndDate ? new Date(selectedProject.EndDate).toLocaleDateString() : "N/A"}</span>
                                </div>
                            </div>
                            <div className="tasks-header">
                                <h2>Tasks</h2>
                                {canCreateTasks && <button onClick={() => setShowCreateTaskModal(true)} className="task-create-button">+ Add New Task</button>}
                            </div>
                            <TaskTable
                                selectedProject={selectedProject}
                                tasksLoading={tasksLoading}
                                onStartEditTask={(task) => { setEditingTask(task); setShowEditTaskModal(true); }}
                                handleCompleteTask={handleCompleteTask}
                                handleDeleteTask={handleDeleteTask}
                                handleUpdateTaskStatus={handleUpdateTaskStatus}
                                currentUser={user}
                            />
                        </>
                    ) : (
                        <div className="info-container">
                             <img
                            src="./task-tracker.png" 
                            alt="Task Tracker Logo"
                            className="header-logo"
                            />
                            <p className="info-message">{loading ? "Loading projects..." : "Select a project to begin."}</p>
                            {isAdmin && (
                            <button onClick={() => setShowCreateProjectModal(true)} className="project-create-button">
                                + Create New Project
                            </button>
                    )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <CreateProjectModal 
                isOpen={showCreateProjectModal} 
                onClose={() => setShowCreateProjectModal(false)} 
                onCreate={handleProjectCreated}
                users={allUsers}
            />
            <CreateTaskModal 
                isOpen={showCreateTaskModal} 
                onClose={() => setShowCreateTaskModal(false)} 
                onSubmit={handleCreateTask} 
                projectId={selectedProject?.ProjectID}
                users={assignableUsers}
            />
            <EditProjectModal 
                isOpen={showEditProjectModal} 
                onClose={() => setShowEditProjectModal(false)} 
                project={editingProject} 
                onUpdate={handleUpdateProject} 
                users={allUsers}
            />
            <EditTaskModal 
                isOpen={showEditTaskModal} 
                onClose={() => setShowEditTaskModal(false)} 
                task={editingTask} 
                onUpdate={handleUpdateTask} 
                users={assignableUsers}
                currentProject={selectedProject}
            />
        </div>
    );
}