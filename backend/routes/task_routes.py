from flask import Blueprint, request, jsonify, current_app
from models import db, Task, User, Project, Role
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from utils import jwt_required, role_required

task_routes = Blueprint('task_routes', __name__)

# --- Helper Functions ---

def parse_date_string_to_date_obj(date_string, field_name="date"):
    """Helper function to parse a date string into a date object."""
    if not date_string:
        return None
    try:
        return datetime.strptime(date_string.split('T')[0], '%Y-%m-%d').date()
    except ValueError:
        raise ValueError(f"Invalid date format for {field_name}. Use YYYY-MM-DD.")

ALLOWED_TASK_STATUSES = ['new', 'in-progress', 'blocked', 'completed', 'not started']

def serialize_task(task):
    """Helper function to serialize a Task object into a dictionary."""
    if not task:
        return None
    return {
        "TaskID": task.TaskID,
        "Description": task.Description,
        "DueDate": task.DueDate.isoformat() if task.DueDate else None,
        "Status": task.Status,
        "OwnerUserID": task.OwnerUserID,
        "OwnerUsername": task.owner.Username if task.owner else None,
        "AssignedToUserID": task.AssignedToUserID,
        "AssignedToUsername": task.assignee.Username if task.assignee else None,
        "ProjectID": task.ProjectID,
        "ProjectName": task.project.ProjectName if task.project else None,
        "CreatedAt": task.CreatedAt.isoformat() if task.CreatedAt else None,
        "UpdatedAt": task.UpdatedAt.isoformat() if task.UpdatedAt else None
    }

# --- Task Routes ---

@task_routes.route('/', methods=['POST'])
@jwt_required
def create_task(current_user):
    """Creates a new task. The owner is the authenticated user."""
    data = request.json
    if not data:
        return jsonify({"message": "No input data"}), 400

    description = data.get('Description')
    project_id = data.get('ProjectID')

    if not description:
        return jsonify({"message": "Description is required"}), 400
    if project_id is None:
        return jsonify({"message": "ProjectID is required"}), 400

    status = data.get('Status', 'new')
    if status not in ALLOWED_TASK_STATUSES:
        return jsonify({"message": f"Invalid status '{status}'. Allowed: {', '.join(ALLOWED_TASK_STATUSES)}"}), 400

    owner_user_id = current_user.UserID
    assigned_to_user_id = data.get('AssignedToUserID')

    try:
        due_date = parse_date_string_to_date_obj(data.get('DueDate'), 'DueDate')

        if not Project.query.get(project_id):
            return jsonify({"message": f"Project ID {project_id} not found."}), 404

        if assigned_to_user_id:
            assigned_user = User.query.get(assigned_to_user_id)
            if not assigned_user:
                return jsonify({"message": f"Assigned User ID {assigned_to_user_id} not found."}), 404
            
            user_roles = {role.RoleName for role in assigned_user.roles}
            if 'read_only_user' not in user_roles:
                 return jsonify({"message": f"Tasks can only be assigned to users with the 'Read-Only User' role. User '{assigned_user.Username}' does not have this role."}), 403

        new_task = Task(
            Description=description,
            DueDate=due_date,
            Status=status,
            OwnerUserID=owner_user_id,
            AssignedToUserID=assigned_to_user_id,
            ProjectID=project_id
        )
        db.session.add(new_task)
        db.session.commit()

        return jsonify(serialize_task(new_task)), 201

    except ValueError as ve:
        return jsonify({"message": str(ve)}), 400
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": "DB integrity error. Check constraints.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Unexpected error creating task.", "error": str(e)}), 500

@task_routes.route('/<int:task_id>', methods=['PUT'])
@jwt_required
def update_task(current_user, task_id):
    """Updates an existing task."""
    task = Task.query.get_or_404(task_id, description=f"Task ID {task_id} not found.")
    data = request.json
    if not data:
        return jsonify({"message": "No input data for update"}), 400

    # --- Authorization logic ---
    user_roles = {role.RoleName for role in current_user.roles}
    is_admin = 'admin' in user_roles
    is_creator = 'task_creator' in user_roles
    is_owner = task.OwnerUserID == current_user.UserID
    is_assignee = task.AssignedToUserID == current_user.UserID
    is_readonly = 'read_only_user' in user_roles

    # First, check for general permissions
    can_update_generally = is_admin or is_creator or is_owner or is_assignee
    
    # Then, check for the specific read-only case
    can_update_status_only = is_readonly and set(data.keys()) == {'Status'}

    if not (can_update_generally or can_update_status_only):
        return jsonify({"message": "You are not authorized to perform this update."}), 403
    

    try:
        # Admins and creators can update any of these fields
        if 'Description' in data: task.Description = data['Description']
        if 'DueDate' in data: task.DueDate = parse_date_string_to_date_obj(data.get('DueDate'), 'DueDate')
        if 'Status' in data:
            status = data['Status']
            if status not in ALLOWED_TASK_STATUSES:
                return jsonify({"message": f"Invalid status '{status}'."}), 400
            task.Status = status
        
        # More granular checks can remain if needed
        if 'AssignedToUserID' in data:
            new_assignee_id = data.get('AssignedToUserID')
            if new_assignee_id:
                assigned_user = User.query.get(new_assignee_id)
                if not assigned_user:
                    return jsonify({"message": f"Assigned User ID {new_assignee_id} not found."}), 404
                
                assignee_roles = {role.RoleName for role in assigned_user.roles}
                if 'read_only_user' not in assignee_roles:
                    return jsonify({"message": f"Tasks can only be assigned to users with the 'Read-Only User' role."}), 403
            task.AssignedToUserID = new_assignee_id

        if 'ProjectID' in data and (is_admin or is_creator):
            if not Project.query.get(data['ProjectID']):
                return jsonify({"message": f"Project ID {data['ProjectID']} not found."}), 404
            task.ProjectID = data['ProjectID']

        db.session.commit()
        return jsonify(serialize_task(task)), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Unexpected error during update.", "error": str(e)}), 500


@task_routes.route('/', methods=['GET'])
@jwt_required
def list_tasks(current_user):
    # ...
    try:
        query = Task.query
        project_id_filter = request.args.get('project_id', type=int)
        if project_id_filter:
            if not Project.query.get(project_id_filter):
                return jsonify({"message": f"Project ID {project_id_filter} not found."}), 404
            query = query.filter(Task.ProjectID == project_id_filter)

        tasks = query.order_by(Task.CreatedAt.desc()).all()
        return jsonify([serialize_task(t) for t in tasks]), 200
    except Exception as e:
        return jsonify({"message": "Failed to retrieve tasks.", "error": str(e)}), 500

@task_routes.route('/<int:task_id>', methods=['GET'])
@jwt_required
def get_task(current_user, task_id):
    # ...
    task = Task.query.get_or_404(task_id, description=f"Task ID {task_id} not found.")
    return jsonify(serialize_task(task)), 200


@task_routes.route('/<int:task_id>', methods=['DELETE'])
@jwt_required
def delete_task(current_user, task_id):
    task = Task.query.get_or_404(task_id, description=f"Task ID {task_id} not found.")
    
    user_roles = {role.RoleName for role in current_user.roles}
    if not (task.OwnerUserID == current_user.UserID or 'admin' in user_roles or 'task_creator' in user_roles):
        return jsonify({"message": "Not authorized to delete this task."}), 403

    try:
        db.session.delete(task)
        db.session.commit()
        return jsonify({"message": "Task deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Unexpected error deleting task.", "error": str(e)}), 500

@task_routes.route('/<int:task_id>/complete', methods=['POST'])
@jwt_required
def mark_task_as_complete_endpoint(current_user, task_id):
    # ...
    task = Task.query.get_or_404(task_id, description=f"Task ID {task_id} not found.")
    
    user_roles = {role.RoleName for role in current_user.roles}
    can_complete = (
        task.AssignedToUserID == current_user.UserID or
        task.OwnerUserID == current_user.UserID or
        'admin' in user_roles or
        'task_creator' in user_roles
    )
    if not can_complete:
        return jsonify({'message': 'Not authorized to complete this task'}), 403

    task.Status = 'completed'
    db.session.commit()
    return jsonify(serialize_task(task)), 200

@task_routes.route('/my', methods=['GET'])
@jwt_required
def get_my_assigned_tasks_endpoint(current_user):
    # ...
    tasks = Task.query.filter_by(AssignedToUserID=current_user.UserID).order_by(Task.DueDate.asc(), Task.CreatedAt.desc()).all()
    return jsonify([serialize_task(t) for t in tasks]), 200

@task_routes.route('/owned', methods=['GET'])
@jwt_required
def get_my_owned_tasks_endpoint(current_user):
    tasks = Task.query.filter_by(OwnerUserID=current_user.UserID).order_by(Task.CreatedAt.desc()).all()
    return jsonify([serialize_task(t) for t in tasks]), 200