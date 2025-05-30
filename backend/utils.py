from functools import wraps
from flask import session, jsonify
from models import User # Assuming User model is in models.py

# Ensure you have a way to access User.roles.all() or similar
# For the mock, we'll assume User instances have a .roles attribute
# which is a list of objects, each having a .RoleName attribute.

def get_current_user_from_session():
    """
    Retrieves the current user object from the session.
    Returns the User object or None if not found or not authenticated.
    """
    user_id = session.get('user_id')
    if not user_id:
        return None
    # In a real app, User.query.get(user_id) would be used.
    # For this example, assuming User is correctly imported and configured with Flask-SQLAlchemy.
    try:
        user = User.query.get(user_id) # Make sure User model is correctly imported and configured
        return user
    except Exception as e:
        # Log this error in a real application
        print(f"Error fetching user from session: {e}")
        return None

def role_required(*required_roles): # Renamed roles to required_roles for clarity
    """
    Decorator to check if the user has at least one of the required roles.
    Usage:
        @role_required('admin')
        @role_required('admin', 'task_creator')
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            current_user = get_current_user_from_session()

            if not current_user:
                return jsonify({"message": "User not authenticated. Please log in."}), 401

            # Assuming current_user.roles is an association proxy or a list of Role objects
            # and each Role object has a RoleName attribute.
            # This requires your User model to have a relationship to Role, e.g., user.roles
            try:
                user_role_names = [role.RoleName for role in current_user.roles.all()] # Adjust if your model access is different
            except AttributeError: # Fallback if .roles.all() is not the way or roles is None
                user_role_names = []


            # Check if the user has ANY of the roles specified in required_roles
            if not any(role_name in user_role_names for role_name in required_roles):
                return jsonify({
                    "message": "Access forbidden: You do not have the required role(s).",
                    "required_roles": list(required_roles),
                    "your_roles": user_role_names
                }), 403 # 403 Forbidden is the correct status code

            # If all checks pass, execute the decorated function
            return func(*args, **kwargs)
        return wrapper
    return decorator
