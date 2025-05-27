# routes/task_routes.py

from flask import Blueprint, request, jsonify, current_app as app
from models import db, Task, User, Project, Role
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from utils import role_required, get_current_user_from_session

task_routes = Blueprint('task_routes', __name__)

def parse_date_string_to_date_obj(date_string, field_name="date"):
    if not date_string: return None
    try:
        return datetime.strptime(date_string.split('T')[0], '%Y-%m-%d').date()
    except ValueError:
        raise ValueError(f"Invalid date format for {field_name}. Use YYYY-MM-DD.")

ALLOWED_TASK_STATUSES = ['new', 'in-progress', 'blocked', 'completed', 'not started']

def serialize_task(task):
    """Helper function to serialize a Task object."""
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

@task_routes.route('/', methods=['POST'])
def create_task():
    current_user = get_current_user_from_session()
    if not current_user:
        return jsonify({"message": "Authentication required"}), 401

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
        due_date_str = data.get('DueDate')
        due_date = parse_date_string_to_date_obj(due_date_str, 'DueDate') if due_date_str else None

        if not Project.query.get(project_id):
            return jsonify({"message": f"Project ID {project_id} not found."}), 404

        if assigned_to_user_id:
            assigned_user = User.query.get(assigned_to_user_id)
            if not assigned_user:
                return jsonify({"message": f"Assigned User ID {assigned_to_user_id} not found."}), 404

            read_only_role = Role.query.filter_by(RoleName='read_only_user').first()
            if not read_only_role:
                app.logger.error("Role 'read_only_user' not found in database.")
                return jsonify({"message": "Server configuration error: 'read_only_user' role missing."}), 500

            # --- MODIFIED: Check if the user has the 'read_only_user' role ---
            can_be_assigned = any(
                role.RoleID == read_only_role.RoleID
                for role in assigned_user.roles
            )

            if not can_be_assigned:
                app.logger.warning(f"User {assigned_user.Username} (ID: {assigned_to_user_id}) does not have 'read_only_user' role. Cannot assign task.")
                return jsonify({"message": f"User '{assigned_user.Username}' cannot be assigned tasks. Must have 'read_only_user' role."}), 403
            # --- END MODIFICATION ---

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
        
        app.logger.info(f"Task created successfully: {new_task.TaskID}, AssignedTo: {new_task.AssignedToUserID}")
        return jsonify(serialize_task(new_task)), 201

    except ValueError as ve:
        app.logger.error(f"ValueError creating task: {str(ve)}")
        return jsonify({"message": str(ve)}), 400
    except IntegrityError as e:
        db.session.rollback()
        app.logger.error(f"IntegrityError creating task: {str(e.orig)}")
        return jsonify({"message": "DB integrity error. Check constraints.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Unexpected error creating task: {e}", exc_info=True)
        return jsonify({"message": "Unexpected error creating task.", "error": str(e)}), 500

# GET / and GET /<int:task_id> remain unchanged

@task_routes.route('/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id, description=f"Task ID {task_id} not found.")
    data = request.json
    if not data: return jsonify({"message": "No input data for update"}), 400

    current_user = get_current_user_from_session()
    if not current_user: return jsonify({"message": "Authentication required"}), 401

    user_roles_query = current_user.roles # Use .all() if needed later, but direct relationship works
    user_roles = [role.RoleName for role in user_roles_query]

    can_update = (
        task.OwnerUserID == current_user.UserID or
        task.AssignedToUserID == current_user.UserID or
        'admin' in user_roles or
        'task_creator' in user_roles
    )
    if not can_update:
        return jsonify({"message": "Not authorized to update this task."}), 403

    try:
        updated_fields = []
        if 'Description' in data:
            task.Description = data['Description']
            updated_fields.append('Description')
        if 'DueDate' in data:
            due_date_str = data.get('DueDate')
            task.DueDate = parse_date_string_to_date_obj(due_date_str, 'DueDate') if due_date_str else None
            updated_fields.append('DueDate')
        if 'Status' in data:
            status = data['Status']
            if status not in ALLOWED_TASK_STATUSES:
                return jsonify({"message": f"Invalid status '{status}'. Allowed: {', '.join(ALLOWED_TASK_STATUSES)}"}), 400
            task.Status = status
            updated_fields.append('Status')
        
        if 'OwnerUserID' in data and data['OwnerUserID'] != task.OwnerUserID :
             if 'admin' in user_roles:
                 new_owner_id = data.get('OwnerUserID')
                 if new_owner_id and not User.query.get(new_owner_id): return jsonify({"message": f"New Owner User ID {new_owner_id} not found."}), 404
                 task.OwnerUserID = new_owner_id
                 updated_fields.append('OwnerUserID')
             else:
                 return jsonify({"message": "Not authorized to change task owner."}), 403

        if 'AssignedToUserID' in data:
            assignee_id = data.get('AssignedToUserID') 
            if assignee_id:
                assigned_user = User.query.get(assignee_id)
                if not assigned_user:
                    return jsonify({"message": f"Assigned User ID {assignee_id} not found."}), 404
                
                read_only_role = Role.query.filter_by(RoleName='read_only_user').first()
                if not read_only_role:
                     return jsonify({"message": "Server configuration error: 'read_only_user' role missing."}), 500

                # --- MODIFIED: Check if the user has the 'read_only_user' role ---
                can_be_assigned = any(
                    role.RoleID == read_only_role.RoleID
                    for role in assigned_user.roles
                )
                if not can_be_assigned:
                    return jsonify({"message": f"User '{assigned_user.Username}' cannot be assigned tasks. Must have 'read_only_user' role."}), 403
                # --- END MODIFICATION ---
                task.AssignedToUserID = assignee_id
            else: 
                task.AssignedToUserID = None
            updated_fields.append('AssignedToUserID')

        if 'ProjectID' in data and data['ProjectID'] != task.ProjectID: 
            if 'admin' in user_roles or 'task_creator' in user_roles: 
                new_project_id = data.get('ProjectID')
                if new_project_id is None: return jsonify({"message": "ProjectID cannot be null when updating."}), 400
                if not Project.query.get(new_project_id): return jsonify({"message": f"New Project ID {new_project_id} not found."}), 404
                task.ProjectID = new_project_id
                updated_fields.append('ProjectID')
            else:
                 return jsonify({"message": "Not authorized to change task's project."}), 403
        
        if not updated_fields:
            return jsonify({"message": "No valid fields provided for update."}), 400

        db.session.commit()
        app.logger.info(f"Task {task_id} updated. Fields: {', '.join(updated_fields)}")
        return jsonify(serialize_task(task)), 200
        
    except ValueError as ve:
        db.session.rollback()
        return jsonify({"message": str(ve)}), 400
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": "DB integrity error during update.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error updating task {task_id}: {e}", exc_info=True)
        return jsonify({"message": "Unexpected error during update.", "error": str(e)}), 500

# DELETE /<int:task_id>, POST /<int:task_id>/complete, GET /my, GET /owned remain unchanged
# routes/task_routes.py

from flask import Blueprint, request, jsonify, current_app as app
from models import db, Task, User, Project, Role # Added Role
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from utils import role_required, get_current_user_from_session

task_routes = Blueprint('task_routes', __name__)

def parse_date_string_to_date_obj(date_string, field_name="date"):
    if not date_string: return None
    try:
        # Ensure the input string is parsed correctly if it includes time
        return datetime.strptime(date_string.split('T')[0], '%Y-%m-%d').date()
    except ValueError:
        raise ValueError(f"Invalid date format for {field_name}. Use YYYY-MM-DD.")

ALLOWED_TASK_STATUSES = ['new', 'in-progress', 'blocked', 'completed', 'not started']

def serialize_task(task):
    """Helper function to serialize a Task object."""
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

@task_routes.route('/', methods=['POST'])
def create_task():
    current_user = get_current_user_from_session()
    if not current_user:
        return jsonify({"message": "Authentication required"}), 401

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

    # OwnerUserID defaults to current user (creator)
    owner_user_id = current_user.UserID
    assigned_to_user_id = data.get('AssignedToUserID')

    try:
        due_date_str = data.get('DueDate')
        due_date = parse_date_string_to_date_obj(due_date_str, 'DueDate') if due_date_str else None
        app.logger.info(f"Parsed DueDate: {due_date} from string: {due_date_str}")

        if not Project.query.get(project_id):
            return jsonify({"message": f"Project ID {project_id} not found."}), 404

        owner_user = User.query.get(owner_user_id) # Should always exist if current_user does
        if not owner_user:
             app.logger.error(f"Consistency error: Creator User ID {owner_user_id} not found for user {current_user.Username}.")
             return jsonify({"message": f"Owner User ID {owner_user_id} (creator) not found."}), 500

        if assigned_to_user_id:
            assigned_user = User.query.get(assigned_to_user_id)
            if not assigned_user:
                return jsonify({"message": f"Assigned User ID {assigned_to_user_id} not found."}), 404

            read_only_role = Role.query.filter_by(RoleName='read_only_user').first()

            if not read_only_role:
                app.logger.error("Role 'read_only_user' not found in database.")
                return jsonify({"message": "Server configuration error: 'read_only_user' role missing."}), 500

            # --- MODIFIED: Check if the user has ONLY the 'read_only_user' role for assignment ---
            can_be_assigned = any(
                role.RoleID == read_only_role.RoleID
                for role in assigned_user.roles
            )

            if not can_be_assigned:
                app.logger.warning(f"User {assigned_user.Username} (ID: {assigned_to_user_id}) does not have 'read_only_user' role. Cannot assign task.")
                return jsonify({"message": f"User '{assigned_user.Username}' cannot be assigned tasks. Must have 'read_only_user' role."}), 403
            # --- END MODIFICATION ---

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
        
        app.logger.info(f"Task created successfully: {new_task.TaskID}, DueDate: {new_task.DueDate}, AssignedTo: {new_task.AssignedToUserID}")
        return jsonify(serialize_task(new_task)), 201

    except ValueError as ve:
        app.logger.error(f"ValueError creating task: {str(ve)}")
        return jsonify({"message": str(ve)}), 400
    except IntegrityError as e:
        db.session.rollback()
        app.logger.error(f"IntegrityError creating task: {str(e.orig)}")
        return jsonify({"message": "DB integrity error. Check constraints.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Unexpected error creating task: {e}", exc_info=True)
        return jsonify({"message": "Unexpected error creating task.", "error": str(e)}), 500

@task_routes.route('/', methods=['GET'])
def list_tasks():
    try:
        query = Task.query
        project_id_filter = request.args.get('project_id', type=int)
        if project_id_filter:
            project = Project.query.get(project_id_filter)
            if not project:
                 return jsonify({"message": f"Project ID {project_id_filter} not found."}), 404
            query = query.filter(Task.ProjectID == project_id_filter)
        
        tasks = query.order_by(Task.CreatedAt.desc()).all()
        return jsonify([serialize_task(t) for t in tasks]), 200
    except Exception as e:
        app.logger.error(f"Error listing tasks: {e}", exc_info=True)
        return jsonify({"message": "Failed to retrieve tasks.", "error": str(e)}), 500

@task_routes.route('/<int:task_id>', methods=['GET'])
def get_task(task_id):
    task = Task.query.get_or_404(task_id, description=f"Task ID {task_id} not found.")
    return jsonify(serialize_task(task)), 200

@task_routes.route('/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id, description=f"Task ID {task_id} not found.")
    data = request.json
    if not data: return jsonify({"message": "No input data for update"}), 400

    current_user = get_current_user_from_session()
    if not current_user: return jsonify({"message": "Authentication required"}), 401

    user_roles_query = current_user.roles # Use .all() if needed later, but direct relationship works
    user_roles = [role.RoleName for role in user_roles_query]
    
    can_update = (
        task.OwnerUserID == current_user.UserID or
        task.AssignedToUserID == current_user.UserID or
        'admin' in user_roles or
        'task_creator' in user_roles
    )
    if not can_update:
        return jsonify({"message": "Not authorized to update this task."}), 403

    try:
        updated_fields = []
        if 'Description' in data:
            task.Description = data['Description']
            updated_fields.append('Description')
        if 'DueDate' in data: # Allows setting DueDate to null
            due_date_str = data.get('DueDate')
            task.DueDate = parse_date_string_to_date_obj(due_date_str, 'DueDate') if due_date_str else None
            updated_fields.append('DueDate')
        if 'Status' in data:
            status = data['Status']
            if status not in ALLOWED_TASK_STATUSES:
                return jsonify({"message": f"Invalid status '{status}'. Allowed: {', '.join(ALLOWED_TASK_STATUSES)}"}), 400
            task.Status = status
            updated_fields.append('Status')
        
        if 'OwnerUserID' in data:
            if 'admin' in user_roles or task.OwnerUserID == current_user.UserID : # Example restriction
                new_owner_id = data.get('OwnerUserID')
                if new_owner_id and not User.query.get(new_owner_id):
                    return jsonify({"message": f"New Owner User ID {new_owner_id} not found."}), 404
                task.OwnerUserID = new_owner_id
                updated_fields.append('OwnerUserID')
            else:
                return jsonify({"message": "Not authorized to change task owner."}), 403

        if 'AssignedToUserID' in data:
            assignee_id = data.get('AssignedToUserID') # Can be None to unassign
            if assignee_id:
                assigned_user = User.query.get(assignee_id)
                if not assigned_user:
                    return jsonify({"message": f"Assigned User ID {assignee_id} not found."}), 404
                
                read_only_role = Role.query.filter_by(RoleName='read_only_user').first()

                if not read_only_role:
                     return jsonify({"message": "Server configuration error: 'read_only_user' role missing."}), 500

                # --- MODIFIED: Check if the user has ONLY the 'read_only_user' role for assignment ---
                can_be_assigned = any(
                    role.RoleID == read_only_role.RoleID
                    for role in assigned_user.roles
                )
                if not can_be_assigned:
                    return jsonify({"message": f"User '{assigned_user.Username}' cannot be assigned tasks. Must have 'read_only_user' role."}), 403
                # --- END MODIFICATION ---
                task.AssignedToUserID = assignee_id
            else: # Unassigning
                task.AssignedToUserID = None
            updated_fields.append('AssignedToUserID')

        if 'ProjectID' in data: # Changing project should be handled carefully
            if 'admin' in user_roles or 'task_creator' in user_roles: # Example restriction
                new_project_id = data.get('ProjectID')
                if new_project_id is None: return jsonify({"message": "ProjectID cannot be null when updating."}), 400
                if not Project.query.get(new_project_id): return jsonify({"message": f"New Project ID {new_project_id} not found."}), 404
                task.ProjectID = new_project_id
                updated_fields.append('ProjectID')
            else:
                 return jsonify({"message": "Not authorized to change task's project."}), 403
        
        if not updated_fields:
            return jsonify({"message": "No valid fields provided for update."}), 400

        db.session.commit()
        app.logger.info(f"Task {task_id} updated. Fields: {', '.join(updated_fields)}")
        return jsonify(serialize_task(task)), 200
        
    except ValueError as ve:
        db.session.rollback()
        return jsonify({"message": str(ve)}), 400
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": "DB integrity error during update.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error updating task {task_id}: {e}", exc_info=True)
        return jsonify({"message": "Unexpected error during update.", "error": str(e)}), 500

@task_routes.route('/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Task.query.get_or_404(task_id, description=f"Task ID {task_id} not found.")
    current_user = get_current_user_from_session()
    if not current_user: return jsonify({"message": "Authentication required"}), 401

    user_roles_query = current_user.roles # Use .all() if needed later, but direct relationship works
    user_roles = [role.RoleName for role in user_roles_query]

    can_delete = (
        task.OwnerUserID == current_user.UserID or
        'admin' in user_roles or
        'task_creator' in user_roles
    )
    if not can_delete:
        return jsonify({"message": "Not authorized to delete this task."}), 403

    try:
        db.session.delete(task)
        db.session.commit()
        app.logger.info(f"Task {task_id} deleted by user {current_user.Username}")
        return jsonify({"message": "Task deleted successfully"}), 200 # Or 204 No Content
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting task {task_id}: {e}", exc_info=True)
        return jsonify({"message": "Unexpected error deleting task.", "error": str(e)}), 500

@task_routes.route('/<int:task_id>/complete', methods=['POST'])
def mark_task_as_complete_endpoint(task_id):
    task = Task.query.get_or_404(task_id, description=f"Task ID {task_id} not found.")
    auth_user = get_current_user_from_session()
    if not auth_user: return jsonify({'message': 'Authentication required'}), 401

    can_complete = False
    if task.AssignedToUserID == auth_user.UserID: can_complete = True
    if task.OwnerUserID == auth_user.UserID: can_complete = True 

    user_roles_query = auth_user.roles # Use .all() if needed later, but direct relationship works
    user_roles = [role.RoleName for role in user_roles_query]
    if 'admin' in user_roles or 'task_creator' in user_roles: can_complete = True

    if not can_complete:
         return jsonify({'message': 'Not authorized to complete this task'}), 403

    if task.Status == 'completed':
        return jsonify({"message": "Task is already completed.", "task": serialize_task(task)}), 200


    task.Status = 'completed'
    db.session.commit()
    app.logger.info(f"Task {task_id} marked as complete by user {auth_user.Username}")
    return jsonify(serialize_task(task)), 200

@task_routes.route('/my', methods=['GET']) # Get tasks assigned to the current user
def get_my_assigned_tasks_endpoint():
    auth_user = get_current_user_from_session()
    if not auth_user:
        return jsonify({'message': 'Authentication required'}), 401

    tasks = Task.query.filter_by(AssignedToUserID=auth_user.UserID).order_by(Task.DueDate.asc().nullslast(), Task.CreatedAt.desc()).all()
    return jsonify([serialize_task(t) for t in tasks]), 200

@task_routes.route('/owned', methods=['GET'])
def get_my_owned_tasks_endpoint():
    auth_user = get_current_user_from_session()
    if not auth_user:
        return jsonify({'message': 'Authentication required'}), 401
    tasks = Task.query.filter_by(OwnerUserID=auth_user.UserID).order_by(Task.CreatedAt.desc()).all()
    return jsonify([serialize_task(t) for t in tasks]), 200