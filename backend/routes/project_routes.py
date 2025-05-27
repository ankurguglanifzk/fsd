from flask import Blueprint, request, jsonify, current_app as app
from models import db, Project, User # Make sure Task model is available if you need more complex task serialization
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from utils import role_required, get_current_user_from_session # Ensure role_required is correctly implemented

project_routes = Blueprint('project_routes', __name__)

# --- Helper Functions ---
def parse_date_string_to_date_obj(date_string, field_name="date"):
    """
    Parses a date string in YYYY-MM-DD format to a date object.
    Handles potential time part if present.
    """
    if not date_string:
        return None
    try:
        return datetime.strptime(date_string.split('T')[0], '%Y-%m-%d').date()
    except ValueError:
        raise ValueError(f"Invalid date format for {field_name}. Use YYYY-MM-DD.")

def serialize_project(project, include_tasks=False):
    """
    Serializes a Project object to a dictionary.
    Optionally includes a simplified list of its tasks.
    """
    if not project:
        return None
    
    project_data = {
        "ProjectID": project.ProjectID,
        "ProjectName": project.ProjectName,
        "Description": project.Description,
        "StartDate": project.StartDate.isoformat() if project.StartDate else None,
        "EndDate": project.EndDate.isoformat() if project.EndDate else None,
        "OwnerUserID": project.OwnerUserID,
        "OwnerUsername": project.owner.Username if project.owner else None, # Assumes 'owner' relationship exists on Project model
        "CreatedAt": project.CreatedAt.isoformat() if project.CreatedAt else None,
        "UpdatedAt": project.UpdatedAt.isoformat() if project.UpdatedAt else None,
        "tasks": [] # Initialize tasks as an empty list
    }

    if include_tasks and hasattr(project, 'tasks') and project.tasks: # Check if 'tasks' attribute exists
        # Simple local serializer for tasks within project details
        def serialize_task_simple(task):
            return {
                "TaskID": task.TaskID,
                "Description": task.Description,
                "Status": task.Status,
                "DueDate": task.DueDate.isoformat() if task.DueDate else None,
                # Include more task details if needed by the frontend here
                "OwnerUsername": task.owner.Username if task.owner else None, # Assumes 'owner' on Task
                "AssignedToUsername": task.assignee.Username if task.assignee else None, # Assumes 'assignee' on Task
            }
        project_data["tasks"] = [serialize_task_simple(t) for t in project.tasks] # Assumes project.tasks is the relationship
    return project_data

# --- Project Routes ---

@project_routes.route('/', methods=['POST'])
@role_required('admin') # Only admins can create projects
def create_project():
    current_user = get_current_user_from_session()
    # role_required decorator handles authentication, but an explicit check is fine too
    # No need to check current_user again if role_required guarantees it.

    data = request.json
    if not data:
        return jsonify({"message": "No input data"}), 400

    project_name = data.get('ProjectName')
    if not project_name:
        return jsonify({"message": "ProjectName is required"}), 400

    # Admin can set owner, otherwise defaults to current admin user
    owner_user_id = data.get('OwnerUserID', current_user.UserID)
    if owner_user_id: # If an ID is provided (even if default)
        if not User.query.get(owner_user_id):
            return jsonify({"message": f"Owner user ID {owner_user_id} not found."}), 404
    else: # Should not happen if defaulting to current_user.UserID, but as a safeguard
        return jsonify({"message": "OwnerUserID is required."}), 400


    try:
        start_date_str = data.get('StartDate')
        end_date_str = data.get('EndDate')
        
        start_date = parse_date_string_to_date_obj(start_date_str, 'StartDate') if start_date_str else None
        end_date = parse_date_string_to_date_obj(end_date_str, 'EndDate') if end_date_str else None

        if start_date and end_date and start_date > end_date:
            return jsonify({"message": "StartDate cannot be after EndDate."}), 400

        new_project = Project(
            ProjectName=project_name,
            Description=data.get('Description'),
            StartDate=start_date,
            EndDate=end_date,
            OwnerUserID=owner_user_id
        )
        db.session.add(new_project)
        db.session.commit()
        app.logger.info(f"Project '{new_project.ProjectName}' (ID: {new_project.ProjectID}) created by admin {current_user.Username}.")
        return jsonify(serialize_project(new_project, include_tasks=False)), 201

    except ValueError as ve: # From parse_date_string_to_date_obj
        app.logger.warning(f"ValueError creating project: {str(ve)}")
        return jsonify({"message": str(ve)}), 400
    except IntegrityError as e:
        db.session.rollback()
        app.logger.error(f"IntegrityError creating project: {e.orig}")
        return jsonify({"message": "Database integrity error. Project name might already exist or invalid foreign key.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Unexpected error creating project: {e}", exc_info=True)
        return jsonify({"message": "Unexpected error creating project.", "error": str(e)}), 500


@project_routes.route('/', methods=['GET'])
def list_projects():
    # Assuming all authenticated users can list projects.
    # Add @role_required decorator if listing should be restricted.
    current_user = get_current_user_from_session()
    if not current_user:
        return jsonify({"message": "Authentication required"}), 401
        
    try:
        projects = Project.query.order_by(Project.ProjectName).all()
        return jsonify([serialize_project(p, include_tasks=False) for p in projects]), 200
    except Exception as e:
        app.logger.error(f"Error listing projects: {e}", exc_info=True)
        return jsonify({"message": "Failed to retrieve projects.", "error": str(e)}), 500

@project_routes.route('/<int:project_id>', methods=['GET'])
def get_project(project_id):
    # Assuming all authenticated users can view a specific project.
    current_user = get_current_user_from_session()
    if not current_user:
        return jsonify({"message": "Authentication required"}), 401

    project = Project.query.get_or_404(project_id, description=f"Project ID {project_id} not found.")
    return jsonify(serialize_project(project, include_tasks=True)), 200 # Include tasks for detail view

@project_routes.route('/<int:project_id>', methods=['PUT'])
@role_required('admin') # Only admins can update projects
def update_project(project_id):
    project = Project.query.get_or_404(project_id, description=f"Project ID {project_id} not found.")
    current_user = get_current_user_from_session() # For logging

    data = request.json
    if not data:
        return jsonify({"message": "No input data for update"}), 400

    try:
        updated_fields = []
        if 'ProjectName' in data:
            project.ProjectName = data['ProjectName']
            updated_fields.append('ProjectName')
        if 'Description' in data: # Allows setting description to empty string or null
            project.Description = data.get('Description')
            updated_fields.append('Description')
        if 'StartDate' in data: # Allows setting StartDate to null
            project.StartDate = parse_date_string_to_date_obj(data.get('StartDate'), 'StartDate')
            updated_fields.append('StartDate')
        if 'EndDate' in data: # Allows setting EndDate to null
            project.EndDate = parse_date_string_to_date_obj(data.get('EndDate'), 'EndDate')
            updated_fields.append('EndDate')

        # Validate dates after attempting to parse both
        if project.StartDate and project.EndDate and project.StartDate > project.EndDate:
            return jsonify({"message": "StartDate cannot be after EndDate."}), 400

        if 'OwnerUserID' in data:
            owner_user_id = data.get('OwnerUserID')
            if owner_user_id: # If a new owner ID is provided
                if not User.query.get(owner_user_id):
                    return jsonify({"message": f"New owner user ID {owner_user_id} not found."}), 404
                project.OwnerUserID = owner_user_id
            else: # If null or empty string is sent, implying unassigning owner
                  # This might be disallowed by business logic or DB constraints if OwnerUserID is not nullable
                project.OwnerUserID = None # Ensure Project.OwnerUserID is nullable in your model if this is allowed
            updated_fields.append('OwnerUserID')

        if not updated_fields:
            return jsonify({"message": "No valid fields provided for update."}), 400

        db.session.commit()
        app.logger.info(f"Project '{project.ProjectName}' (ID: {project.ProjectID}) updated by admin {current_user.Username}. Fields: {', '.join(updated_fields)}")
        return jsonify(serialize_project(project, include_tasks=True)), 200 # Return full updated project
    except ValueError as ve: # From parse_date_string_to_date_obj
        app.logger.warning(f"ValueError updating project {project_id}: {str(ve)}")
        return jsonify({"message": str(ve)}), 400
    except IntegrityError as e:
        db.session.rollback()
        app.logger.error(f"IntegrityError updating project {project_id}: {e.orig}")
        return jsonify({"message": "Database integrity error. Project name might already exist or invalid foreign key.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error updating project {project_id}: {e}", exc_info=True)
        return jsonify({"message": "Unexpected error updating project.", "error": str(e)}), 500

@project_routes.route('/<int:project_id>', methods=['DELETE'])
@role_required('admin') # Only admins can delete projects
def delete_project(project_id):
    project = Project.query.get_or_404(project_id, description=f"Project ID {project_id} not found.")
    current_user = get_current_user_from_session() # For logging
    try:
        # Assuming 'ondelete=CASCADE' is set on the Task.ProjectID ForeignKey for tasks
        # If not, tasks associated with this project might need to be handled manually or will raise an error
        db.session.delete(project)
        db.session.commit()
        app.logger.info(f"Project '{project.ProjectName}' (ID: {project.ProjectID}) deleted by admin {current_user.Username}.")
        return jsonify({"message": "Project and its associated tasks deleted successfully"}), 200
    except Exception as e: # Catch broad exceptions, could be FK constraint if cascade isn't set
        db.session.rollback()
        app.logger.error(f"Error deleting project {project_id}: {e}", exc_info=True)
        # Check if it's an integrity error related to foreign key constraints
        if isinstance(e, IntegrityError):
             return jsonify({"message": "Could not delete project due to existing related data (e.g., tasks). Ensure cascading deletes are configured or remove related data first.", "error": str(e.orig)}), 400
        return jsonify({"message": "Unexpected error deleting project.", "error": str(e)}), 500

