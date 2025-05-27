from functools import wraps
from flask import session, jsonify
from models import User, UserRole, Role

def get_current_user_from_session():
    user_id = session.get('user_id')
    if not user_id:
        return None
    return User.query.get(user_id)

def role_required(*roles):
    """
    Decorator to check if the user has at least one of the required roles.
    Usage:
        @role_required('admin')
        @role_required('admin', 'task_creator')
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user_id = session.get('user_id')
            if not user_id:
                return jsonify({"message": "User not authenticated"}), 401

            user = User.query.get(user_id)
            if not user:
                return jsonify({"message": "User not found"}), 404

            user_roles = [role.RoleName for role in user.roles.all()]
            if not any(role in user_roles for role in roles):
                return jsonify({"message": "Permission denied: Insufficient role"}), 403


            return func(*args, **kwargs)
        return wrapper
    return decorator

