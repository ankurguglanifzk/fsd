// src/pages/Dashboard.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import Header from "./Header";
import ProjectList from "./ProjectList";
import TaskTable from "./TaskTable";
import CreateProjectModal from "./CreateProjectModal";
import CreateTaskModal from "./CreateTaskModal";
import EditProjectModal from "./EditProjectModal";
import EditTaskModal from "./EditTaskModel"; 
import { useAuth } from "../contexts/AuthContext";
import "./Dashboard.css";

const API_BASE_PROJECTS = "http://localhost:5000/api/v1/projects";
const API_BASE_TASKS = "http://localhost:5000/api/v1/tasks";
const API_BASE_USERS = "http://localhost:5000/api/v1/users";

export default function Dashboard() {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [loading, setLoading] = useState(false);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [error, setError] = useState("");
    const [allUsers, setAllUsers] = useState([]);

    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
    const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
    const [showEditProjectModal, setShowEditProjectModal] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const [showEditTaskModal, setShowEditTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);

    const isAdmin = user?.roles?.includes("admin");
    const isTaskCreator = user?.roles?.includes("task_creator");

    const canCreateTasks = useMemo(() => isAdmin || isTaskCreator, [isAdmin, isTaskCreator]);

    const projectOwnerOptionsForEditModal = useMemo(() => {
        return isAdmin && user ? [user] : [];
    }, [user, isAdmin]);

    // --- MODIFIED: Renamed and updated to only filter for read_only_user ---
    const readOnlyUsersForTaskAssignment = useMemo(() => {
        // Only allow assigning tasks to users with the 'read_only_user' role
        return allUsers.filter(u =>
            u.roles?.some(role => role.RoleName === "read_only_user")
        );
    }, [allUsers]);
    // --- END MODIFICATION ---

    const apiFetch = async (url, options = {}) => {
        options.credentials = "include";
        options.headers = {
            "Content-Type": "application/json",
            ...options.headers,
        };
        const res = await fetch(url, options);
        const text = await res.text();
        if (!res.ok) {
            try {
                const errData = JSON.parse(text);
                throw new Error(errData.message || `Request failed: ${res.status}`);
            } catch {
                throw new Error(text || `Request failed: ${res.status}`);
            }
        }
        if (res.status === 204 || !text) return { message: "Operation successful" };
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON response:", text, e);
            throw new Error("Invalid JSON response from server.");
        }
    };

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await apiFetch(`${API_BASE_PROJECTS}/`);
            setProjects(data);
        } catch (err) {
            setError(`Workspace Projects: ${err.message}`);
            setProjects([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAllUsers = useCallback(async () => {
        setError("");
        try {
            const data = await apiFetch(`${API_BASE_USERS}/`);
            setAllUsers(data);
        } catch (err) {
            setError(`Workspace Users: ${err.message}`);
            setAllUsers([]);
        }
    }, []);

    const fetchProjectDetails = useCallback(async (projectToSelect) => {
        if (!projectToSelect?.ProjectID) {
            setSelectedProject(null);
            return;
        }
        setTasksLoading(true);
        setError("");
        setSelectedProject(prev => ({ ...prev, ...projectToSelect, tasks: prev?.ProjectID === projectToSelect.ProjectID ? prev.tasks : [] }));
        try {
            const detailedProject = await apiFetch(`${API_BASE_PROJECTS}/${projectToSelect.ProjectID}`);
            setSelectedProject(detailedProject);
        } catch (err) {
            setError(`Workspace Project Details for ${projectToSelect.ProjectName}: ${err.message}`);
            setSelectedProject({ ...projectToSelect, tasks: [] });
        } finally {
            setTasksLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user?.UserID) {
            fetchProjects();
            fetchAllUsers();
        } else {
            setProjects([]);
            setSelectedProject(null);
            setAllUsers([]);
        }
    }, [user, fetchProjects, fetchAllUsers]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(""), 7000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleProjectCreated = () => {
        fetchProjects();
        setShowCreateProjectModal(false);
    };

    const handleOpenEditProjectModal = (project) => {
        if (!isAdmin) {
            setError("You do not have permission to edit projects.");
            return;
        }
        setEditingProject(project);
        setShowEditProjectModal(true);
    };

    const handleCloseEditProjectModal = () => {
        setEditingProject(null);
        setShowEditProjectModal(false);
    };

    const handleUpdateProject = async (projectId, projectData) => {
        if (!isAdmin) {
            setError("Permission denied: Cannot update project.");
            throw new Error("Permission denied: Cannot update project.");
        }
        setError("");
        setLoading(true);
        try {
            const updatedProjectDataFromAPI = await apiFetch(`${API_BASE_PROJECTS}/${projectId}`, {
                method: "PUT",
                body: JSON.stringify(projectData),
            });
            await fetchProjects();
            if (selectedProject?.ProjectID === projectId) {
                await fetchProjectDetails({ ...selectedProject, ...updatedProjectDataFromAPI });
            }
            handleCloseEditProjectModal();
        } catch (err) {
            setError(`Update Project: ${err.message}`);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProject = async (projectId) => {
        if (!isAdmin) {
            setError("You do not have permission to delete projects.");
            return;
        }
        if (window.confirm("Are you sure you want to delete this project and all its tasks? This action cannot be undone.")) {
            setError("");
            setLoading(true);
            try {
                await apiFetch(`${API_BASE_PROJECTS}/${projectId}`, { method: "DELETE" });
                if (selectedProject?.ProjectID === projectId) {
                    setSelectedProject(null);
                }
                await fetchProjects();
            } catch (err) {
                setError(`Delete Project: ${err.message}`);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleCreateTask = async (taskData) => {
        if (!canCreateTasks) {
            const errMsg = "You do not have permission to create tasks.";
            setError(errMsg);
            throw new Error(errMsg);
        }
        if (!selectedProject?.ProjectID) {
            const errMsg = "No project selected to add the task to.";
            setError(errMsg);
            throw new Error(errMsg);
        }
        setError("");
        setTasksLoading(true);
        try {
            await apiFetch(`${API_BASE_TASKS}/`, {
                method: "POST",
                body: JSON.stringify(taskData),
            });
            await fetchProjectDetails(selectedProject);
            setShowCreateTaskModal(false);
        } catch (err) {
            console.error("Dashboard: Failed to create task", err, "Data sent:", taskData);
            setError(`Create Task: ${err.message}`);
            throw err;
        } finally {
            setTasksLoading(false);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (window.confirm("Are you sure you want to delete this task?")) {
            setError("");
            if (!selectedProject) {
                setError("No project selected. Cannot delete task.");
                return;
            }
            setTasksLoading(true);
            try {
                await apiFetch(`${API_BASE_TASKS}/${taskId}`, { method: "DELETE" });
                await fetchProjectDetails(selectedProject);
            } catch (err) {
                setError(`Delete Task: ${err.message}`);
            } finally {
                setTasksLoading(false);
            }
        }
    };

    const handleUpdateTaskStatus = async (taskId, newStatus) => {
        setError("");
        if (!selectedProject) {
            setError("No project selected. Cannot update task status.");
            return;
        }
        setTasksLoading(true);
        try {
            await apiFetch(`${API_BASE_TASKS}/${taskId}`, {
                method: "PUT",
                body: JSON.stringify({ Status: newStatus }),
            });
            await fetchProjectDetails(selectedProject);
        } catch (err) {
            setError(`Update Task Status to ${newStatus}: ${err.message}`);
            await fetchProjectDetails(selectedProject);
        } finally {
            setTasksLoading(false);
        }
    };

    const handleCompleteTask = async (taskId) => {
        await handleUpdateTaskStatus(taskId, "completed");
    };

    const handleStartEditTask = (task) => {
        console.log("Starting edit for task:", task);
        setEditingTask(task);
        setShowEditTaskModal(true);
    };

    const handleCloseEditTaskModal = () => {
        setEditingTask(null);
        setShowEditTaskModal(false);
    };

    const handleUpdateTask = async (taskId, taskData) => {
        setError("");
        if (!selectedProject) {
            setError("No project selected. Cannot update task.");
            throw new Error("No project selected. Cannot update task.");
        }
        setTasksLoading(true);
        try {
            await apiFetch(`${API_BASE_TASKS}/${taskId}`, {
                method: "PUT",
                body: JSON.stringify(taskData),
            });
            await fetchProjectDetails(selectedProject); 
            handleCloseEditTaskModal(); 
        } catch (err) {
            setError(`Update Task: ${err.message}`);
            throw err; 
        } finally {
            setTasksLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            <Header />
            <div className="content-area">
                <div className="sidebar">
                    {user && (
                        <div className="welcome-message-container">
                            <p className="welcome-text">Welcome, <span className="username-text">{user.Username}</span></p>
                            <p className="role-text">Roles: {Array.isArray(user.roles) ? user.roles.join(", ") : "N/A"}</p>
                        </div>
                    )}
                    <h2 className="sidebar-title">Projects</h2>
                    {isAdmin && (
                        <button
                            onClick={() => setShowCreateProjectModal(true)}
                            className="project-create-button"
                            style={{ marginBottom: "1rem", width: "100%" }}
                        >
                            + Create New Project
                        </button>
                    )}
                    <ProjectList
                        projects={projects}
                        loading={loading}
                        selectedProject={selectedProject}
                        onSelect={fetchProjectDetails}
                        onStartEdit={handleOpenEditProjectModal}
                        onDelete={handleDeleteProject}
                        isAdmin={isAdmin}
                    />
                </div>

                <div className="main-content">
                    {error && <p className="error-message" style={{ color: "red", backgroundColor: "#ffebee", padding: "10px", borderRadius: "4px" }}>{error}</p>}

                    {selectedProject ? (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                                <h3 className="main-content-title" style={{ margin: 0 }}>
                                    {selectedProject.ProjectName || "Selected Project"} - Tasks
                                </h3>
                                <p><strong>Description:</strong> {selectedProject.Description || "No description available"}</p>
                                <p><strong>Owner:</strong> {selectedProject.OwnerUsername || 'N/A'}</p>
                                <p><strong>Start Date:</strong> {selectedProject.StartDate ? new Date(selectedProject.StartDate).toLocaleDateString() : "N/A"}</p>
                                <p><strong>End Date:</strong> {selectedProject.EndDate ? new Date(selectedProject.EndDate).toLocaleDateString() : "N/A"}</p>
                                {canCreateTasks && (
                                    <button
                                        className="task-create-button"
                                        onClick={() => setShowCreateTaskModal(true)}
                                        disabled={!selectedProject?.ProjectID}
                                    >
                                        + Add New Task
                                    </button>
                                )}
                            </div>
                            <TaskTable
                                selectedProject={selectedProject}
                                tasksLoading={tasksLoading}
                                handleCompleteTask={handleCompleteTask}
                                handleDeleteTask={handleDeleteTask}
                                handleUpdateTaskStatus={handleUpdateTaskStatus}
                                onStartEditTask={handleStartEditTask}
                            />
                            
                        </>
                    ) : (
                        !loading && <div className="info-container">
                        <img src="./project.png" alt="No project selected" className="info-image" />
                        <p className="info-message">Select a project to see its tasks or create a new one.</p>
                      </div>
                  
                    )}
                    {loading && !selectedProject && <p className="info-message">Loading projects...</p>}
                </div>
            </div>

            {isAdmin && showCreateProjectModal && (
                <CreateProjectModal
                    isOpen={showCreateProjectModal}
                    onClose={() => setShowCreateProjectModal(false)}
                    currentUserId={user?.UserID}
                    onCreate={handleProjectCreated}
                />
            )}

            {canCreateTasks && showCreateTaskModal && (
                <CreateTaskModal
                    isOpen={showCreateTaskModal}
                    onClose={() => setShowCreateTaskModal(false)}
                    onSubmit={handleCreateTask}
                    projectId={selectedProject?.ProjectID}
                    currentUser={user}
                    users={readOnlyUsersForTaskAssignment} 
                />
            )}

            {isAdmin && editingProject && (
                <EditProjectModal
                    isOpen={showEditProjectModal}
                    onClose={handleCloseEditProjectModal}
                    project={editingProject}
                    onUpdate={handleUpdateProject}
                    users={projectOwnerOptionsForEditModal}
                />
            )}

            {showEditTaskModal && editingTask && (
                <EditTaskModal
                    isOpen={showEditTaskModal}
                    onClose={handleCloseEditTaskModal}
                    task={editingTask}
                    onUpdate={handleUpdateTask}
                    users={readOnlyUsersForTaskAssignment} 
                    currentProject={selectedProject}
                />
            )}
        </div>
    );
}