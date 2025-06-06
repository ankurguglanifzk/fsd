from flask import Blueprint, request, jsonify, current_app
from models import db, Project, User, Task
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from utils import jwt_required, role_required

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
        "OwnerUsername": project.owner.Username if project.owner else None, 
        "CreatedAt": project.CreatedAt.isoformat() if project.CreatedAt else None,
        "UpdatedAt": project.UpdatedAt.isoformat() if project.UpdatedAt else None,
        "tasks": [] 
    }

    if include_tasks and hasattr(project, 'tasks') and project.tasks: 
        def serialize_task_simple(task):
            return {
                "TaskID": task.TaskID,
                "Description": task.Description,
                "Status": task.Status,
                "DueDate": task.DueDate.isoformat() if task.DueDate else None,
                "OwnerUsername": task.owner.Username if task.owner else None, 
                "AssignedToUsername": task.assignee.Username if task.assignee else None, 
            }
        project_data["tasks"] = [serialize_task_simple(t) for t in project.tasks] 
    return project_data

# --- Project Routes (Updated with JWT) ---

@project_routes.route('/', methods=['POST'])
@jwt_required
@role_required('admin')
def create_project(current_user):
    """
    Creates a new project. Only accessible by admins.
    The `current_user` object is injected by the @jwt_required decorator.
    """
    data = request.json
    if not data:
        return jsonify({"message": "No input data"}), 400

    project_name = data.get('ProjectName')
    if not project_name:
        return jsonify({"message": "ProjectName is required"}), 400

    # Default to the authenticated user if OwnerUserID is not provided
    owner_user_id = data.get('OwnerUserID', current_user.UserID)
    
    if not User.query.get(owner_user_id):
        return jsonify({"message": f"Owner user ID {owner_user_id} not found."}), 404

    try:
        start_date_str = data.get('StartDate')
        end_date_str = data.get('EndDate')
        
        start_date = parse_date_string_to_date_obj(start_date_str, 'StartDate')
        end_date = parse_date_string_to_date_obj(end_date_str, 'EndDate')

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
        return jsonify(serialize_project(new_project, include_tasks=False)), 201

    except ValueError as ve: 
        return jsonify({"message": str(ve)}), 400
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": "Database integrity error. Project name might already exist.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Unexpected error creating project.", "error": str(e)}), 500


@project_routes.route('/', methods=['GET'])
@jwt_required
def list_projects(current_user):
    """Lists all projects. Requires any valid JWT."""
    try:
        projects = Project.query.order_by(Project.ProjectName).all()
        return jsonify([serialize_project(p, include_tasks=False) for p in projects]), 200
    except Exception as e:
        return jsonify({"message": "Failed to retrieve projects.", "error": str(e)}), 500

@project_routes.route('/<int:project_id>', methods=['GET'])
@jwt_required
def get_project(current_user, project_id):
    """Gets a single project by its ID. Requires any valid JWT."""
    project = Project.query.get_or_404(project_id, description=f"Project ID {project_id} not found.")
    return jsonify(serialize_project(project, include_tasks=True)), 200

@project_routes.route('/<int:project_id>', methods=['PUT'])
@jwt_required
@role_required('admin') 
def update_project(current_user, project_id):
    """Updates a project. Only accessible by admins."""
    project = Project.query.get_or_404(project_id, description=f"Project ID {project_id} not found.")
    
    data = request.json
    if not data:
        return jsonify({"message": "No input data for update"}), 400

    try:
        updated_fields = []
        if 'ProjectName' in data:
            project.ProjectName = data['ProjectName']
            updated_fields.append('ProjectName')
        if 'Description' in data: 
            project.Description = data.get('Description')
            updated_fields.append('Description')
        if 'StartDate' in data: 
            project.StartDate = parse_date_string_to_date_obj(data.get('StartDate'), 'StartDate')
            updated_fields.append('StartDate')
        if 'EndDate' in data: 
            project.EndDate = parse_date_string_to_date_obj(data.get('EndDate'), 'EndDate')
            updated_fields.append('EndDate')

        if project.StartDate and project.EndDate and project.StartDate > project.EndDate:
            return jsonify({"message": "StartDate cannot be after EndDate."}), 400

        if 'OwnerUserID' in data:
            owner_user_id = data.get('OwnerUserID')
            if not User.query.get(owner_user_id):
                return jsonify({"message": f"New owner user ID {owner_user_id} not found."}), 404
            project.OwnerUserID = owner_user_id
            updated_fields.append('OwnerUserID')

        if not updated_fields:
            return jsonify({"message": "No valid fields provided for update."}), 400

        db.session.commit()
        return jsonify(serialize_project(project, include_tasks=True)), 200 
    except ValueError as ve: 
        return jsonify({"message": str(ve)}), 400
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": "Database integrity error. Project name might already exist.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Unexpected error updating project.", "error": str(e)}), 500

@project_routes.route('/<int:project_id>', methods=['DELETE'])
@jwt_required
@role_required('admin')
def delete_project(current_user, project_id):
    """Deletes a project. Only accessible by admins."""
    project = Project.query.get_or_404(project_id, description=f"Project ID {project_id} not found.")
    
    try:
        # Assuming 'ondelete=CASCADE' is set on the Task.ProjectID ForeignKey
        db.session.delete(project)
        db.session.commit()
        
        return jsonify({"message": "Project and its associated tasks deleted successfully"}), 200
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": "Could not delete project due to existing related data (e.g., tasks).", "error": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Unexpected error deleting project.", "error": str(e)}), 500
