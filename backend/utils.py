# utils.py

import os
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify
from models import User

# --- JWT Configuration ---
# In a real app, use a strong, securely stored secret key from environment variables
SECRET_KEY = os.environ.get('SECRET_KEY', 'a-very-secure-secret-key-for-development')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # Token valid for 24 hours

def create_access_token(identity_data):
    """
    Generates a new JWT access token containing the user's identity.
    
    :param identity_data: Dictionary with data to encode (e.g., user_id, roles).
    :return: A signed JWT string.
    """
    to_encode = identity_data.copy()
    # Set the token's expiration time
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    
    # Encode the payload with the secret key and algorithm
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def jwt_required(f):
    """
    Decorator to protect routes by requiring a valid JWT in the 'Authorization' header.
    It verifies the token and injects the corresponding user object into the decorated function.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        # Extract token from 'Authorization: Bearer <token>' header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]

        if not token:
            return jsonify({"message": "Authorization token is missing!"}), 401

        try:
            # Decode the token to get the payload
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get('user_id')
            if user_id is None:
                raise jwt.InvalidTokenError("Token payload is missing 'user_id'.")
            
            # Fetch the user from the database to ensure they exist and are active
            current_user = User.query.filter_by(UserID=user_id, IsActive=True).first()
            if current_user is None:
                return jsonify({"message": "User not found or account is inactive."}), 401

        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired. Please log in again."}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({"message": "Invalid token. Please log in again.", "error": str(e)}), 401
        
        # Pass the validated user object to the decorated route function
        kwargs['current_user'] = current_user
        return f(*args, **kwargs)

    return decorated_function

def role_required(*required_roles):
    """
    Decorator to check if a user has at least one of the required roles.
    This decorator MUST be placed *after* the @jwt_required decorator on a route.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # 'current_user' is expected to be in kwargs, passed by @jwt_required
            current_user = kwargs.get('current_user')
            if not current_user:
                 # This should not be reached if @jwt_required is used correctly
                return jsonify({"message": "User context not found. Ensure @jwt_required is used."}), 500

            try:
                user_role_names = {role.RoleName for role in current_user.roles}
            except Exception as e:
                return jsonify({"message": "Could not determine user roles.", "error": str(e)}), 500

            # Grant access if the user is an admin
            if 'admin' in user_role_names:
                return f(*args, **kwargs)

            # Check if the user has any of the other required roles
            if not any(role in user_role_names for role in required_roles):
                return jsonify({
                    "message": "Access forbidden: You do not have the required permissions.",
                    "required_roles": list(required_roles),
                    "your_roles": list(user_role_names)
                }), 403
            
            # If authorized, proceed to the actual route function
            return f(*args, **kwargs)
        return wrapper
    return decorator