# routes/user_routes.py

from flask import Blueprint, request, jsonify
from models import db, User, Role, UserRole
from werkzeug.security import generate_password_hash
from sqlalchemy.exc import IntegrityError
from utils import jwt_required, role_required, create_access_token
import os

# --- CORRECTED IMPORTS ---
# These are required to verify the Google ID token
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
# The 'from auth import oauth' line has been removed as it's for the old flow

user_routes = Blueprint('user_routes', __name__)

def get_all_role_names():
    """Fetches all role names from the database."""
    try:
        roles = Role.query.all()
        return {role.RoleName for role in roles}
    except Exception:
        return set()

# --- Authentication (MODIFIED for JWT) ---
@user_routes.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'Username' not in data or 'Password' not in data:
        return jsonify({'message': 'Username and Password are required'}), 400

    user = User.query.filter_by(Username=data['Username']).first()
    
    if not user or not user.check_password(data['Password']):
        return jsonify({'message': 'Invalid username or password'}), 401
    
    if not user.IsActive:
        return jsonify({'message': 'User account is inactive'}), 401

    identity_data = {
        "user_id": user.UserID,
        "username": user.Username,
        "roles": [role.RoleName for role in user.roles]
    }
    access_token = create_access_token(identity_data=identity_data)
    
    user_data = {
        'UserID': user.UserID,
        'Username': user.Username,
        'FullName': user.FullName,
        'Email': user.Email,
        'IsActive': user.IsActive,
        'roles': [role.RoleName for role in user.roles]
    }

    return jsonify({
        'message': 'Login successful',
        'user': user_data,
        'access_token': access_token
    }), 200

@user_routes.route('/google/verify-token', methods=['POST'])
def verify_google_token():
    """
    Receives a Google ID token from the frontend, verifies it,
    and returns an application-specific access token.
    """
    data = request.get_json()
    token = data.get('token')
    if not token:
        return jsonify({'message': 'No token provided'}), 400

    google_client_id = os.environ.get('GOOGLE_CLIENT_ID') 
    if not google_client_id:
        return jsonify({'message': 'Server configuration error: GOOGLE_CLIENT_ID not set'}), 500

    try:
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(token, grequests.Request(), google_client_id)
        
        email = idinfo['email']
        domain = email.split('@')[-1]

        if domain.lower() != "tigeranalytics.com":
            return jsonify({'message': 'Login with this Google account domain is not allowed.'}), 403

        user = User.query.filter_by(Email=email).first()

        if not user:
            default_role = Role.query.filter_by(RoleName='read_only_user').first()
            if not default_role:
                 return jsonify({'message': 'System configuration error: Default role missing'}), 500
            
            username_candidate = email.split('@')[0]
            temp_username = username_candidate
            counter = 1
            while User.query.filter_by(Username=temp_username).first():
                temp_username = f"{username_candidate}{counter}"
                counter += 1

            user = User(
                Username=temp_username,
                Email=email,
                FullName=idinfo.get('name'),
                PasswordHash=generate_password_hash(os.urandom(16).hex())
            )
            db.session.add(user)
            db.session.flush()

            user_role = UserRole(UserID=user.UserID, RoleID=default_role.RoleID)
            db.session.add(user_role)
            db.session.commit()

        if not user.IsActive:
            return jsonify({'message': 'User account is inactive'}), 401
        
        identity_data = {
            "user_id": user.UserID,
            "username": user.Username,
            "roles": [role.RoleName for role in user.roles]
        }
        access_token = create_access_token(identity_data=identity_data)
        
        user_data = {
            'UserID': user.UserID,
            'Username': user.Username,
            'FullName': user.FullName,
            'Email': user.Email,
            'IsActive': user.IsActive,
            'roles': [role.RoleName for role in user.roles]
        }

        return jsonify({
            'message': 'Google login successful',
            'access_token': access_token,
            'user': user_data
        }), 200

    except ValueError:
        return jsonify({'message': 'Invalid Google token'}), 401
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'An unexpected server error occurred.', "error": str(e)}), 500

@user_routes.route('/logout', methods=['POST'])
def logout():
    return jsonify({'message': 'Logout successful. Please clear the token on the client-side.'}), 200

@user_routes.route('/me', methods=['GET'])
@jwt_required
def get_current_user_info(current_user):
    user = current_user
    if not user:
        return jsonify({'message': 'User not found.'}), 404
    
    return jsonify({
        'UserID': user.UserID,
        'Username': user.Username,
        'FullName': user.FullName,
        'Email': user.Email,
        'IsActive': user.IsActive,
        'CreatedAt': user.CreatedAt.isoformat() if user.CreatedAt else None,
        'roles': [role.RoleName for role in user.roles]
    }), 200

# --- User Management (CRUD) ---
@user_routes.route('/', methods=['POST'])
@jwt_required
@role_required('admin')
def create_user(current_user):
    data = request.json
    if not data:
        return jsonify({"message": "No input data provided"}), 400

    username = data.get('Username')
    password = data.get('Password')
    email = data.get('Email')
    full_name = data.get('FullName')
    role_name_to_assign = data.get('RoleName')

    if not username or not password:
        return jsonify({"message": "Username and Password are required"}), 400

    if not role_name_to_assign or not isinstance(role_name_to_assign, str) or not role_name_to_assign.strip():
        return jsonify({"message": "A valid RoleName (non-empty string) must be assigned"}), 400

    allowed_roles = get_all_role_names()
    if role_name_to_assign not in allowed_roles:
        return jsonify({"message": f"Role '{role_name_to_assign}' is not a valid role."}), 400

    try:
        if User.query.filter_by(Username=username).first():
            return jsonify({"message": f"Username '{username}' already exists."}), 409
        if email and User.query.filter_by(Email=email).first():
            return jsonify({"message": f"Email '{email}' already exists."}), 409

        new_user = User(Username=username, FullName=full_name, Email=email)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.flush()

        role_obj = Role.query.filter_by(RoleName=role_name_to_assign).first()
        if role_obj:
            user_role_link = UserRole(UserID=new_user.UserID, RoleID=role_obj.RoleID)
            db.session.add(user_role_link)
        
        db.session.commit()

        return jsonify({
            "message": "User created successfully",
            "UserID": new_user.UserID,
            "Username": new_user.Username,
            "roles": [{"RoleName": role_obj.RoleName}] if role_obj else [] 
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "An unexpected error occurred while creating the user.", "error": str(e)}), 500

@user_routes.route('/', methods=['GET'])
@jwt_required
def list_users(current_user):
    try:
        users = User.query.all()
        users_data = []
        for u in users:
            roles = [{"RoleID": r.RoleID, "RoleName": r.RoleName} for r in u.roles]
            users_data.append({
                "UserID": u.UserID, "Username": u.Username, "FullName": u.FullName,
                "Email": u.Email, "IsActive": u.IsActive,
                "CreatedAt": u.CreatedAt.isoformat() if u.CreatedAt else None, "roles": roles
            })
        return jsonify(users_data), 200
    except Exception as e:
        return jsonify({"message": "Failed to retrieve users.", "error": str(e)}), 500

@user_routes.route('/<int:user_id>', methods=['GET'])
@jwt_required
@role_required('admin')
def get_user(current_user, user_id):
    user = User.query.get_or_404(user_id)
    roles = [{"RoleID": r.RoleID, "RoleName": r.RoleName} for r in user.roles]
    return jsonify({
        "UserID": user.UserID, "Username": user.Username, "FullName": user.FullName,
        "Email": user.Email, "IsActive": user.IsActive,
        "CreatedAt": user.CreatedAt.isoformat() if user.CreatedAt else None, "roles": roles
    }), 200

@user_routes.route('/<int:user_id>', methods=['PUT'])
@jwt_required
@role_required('admin')
def update_user(current_user, user_id):
    user = User.query.get_or_404(user_id)
    data = request.json
    if not data:
        return jsonify({"message": "No input data"}), 400
    
    try:
        if 'FullName' in data: user.FullName = data.get('FullName')
        if 'Email' in data: user.Email = data.get('Email')
        if 'Password' in data and data['Password']: user.set_password(data['Password'])
        if 'IsActive' in data: user.IsActive = data['IsActive']
        if 'RoleName' in data:
            new_role_name = data.get('RoleName')
            allowed_roles = get_all_role_names()
            if new_role_name not in allowed_roles:
                return jsonify({"message": f"Role '{new_role_name}' is not a valid role."}), 400
            
            role_to_assign = Role.query.filter_by(RoleName=new_role_name).first()
            if not role_to_assign:
                return jsonify({"message": f"Role '{new_role_name}' not found."}), 404
            
            UserRole.query.filter_by(UserID=user.UserID).delete()
            db.session.add(UserRole(UserID=user.UserID, RoleID=role_to_assign.RoleID))

        db.session.commit()
        return jsonify({"message": "User updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "An unexpected error occurred.", "error": str(e)}), 500

@user_routes.route('/<int:user_id>', methods=['DELETE'])
@jwt_required
@role_required('admin')
def delete_user(current_user, user_id):
    user = User.query.get_or_404(user_id)
    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Unexpected error.", "error": str(e)}), 500

@user_routes.route('/roles', methods=['GET'])
@jwt_required
def list_all_system_roles(current_user):
    try:
        roles = Role.query.all()
        return jsonify([{"RoleID": r.RoleID, "RoleName": r.RoleName, "Description": r.Description} for r in roles]), 200
    except Exception as e:
        return jsonify({"message": "Failed to retrieve roles.", "error": str(e)}), 500
