# routes/user_routes.py

from flask import Blueprint, request, jsonify, redirect, url_for
from models import db, User, Role, UserRole
from werkzeug.security import generate_password_hash
from sqlalchemy.exc import IntegrityError
# MODIFIED: Import JWT functions and remove session-based user retrieval
from utils import jwt_required, role_required, create_access_token
from auth import oauth
import os

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

    # MODIFIED: Generate JWT instead of using sessions
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

@user_routes.route('/login/google')
def login_google():
    redirect_uri = url_for('user_routes.google_callback', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

def get_predefined_role(role_name):
    """Fetch a Role object by RoleName from the DB."""
    try:
        return Role.query.filter_by(RoleName=role_name).first()
    except Exception:
        return None

@user_routes.route('/google/callback')
def google_callback():
    try:
        token = oauth.google.authorize_access_token()
        user_info_response = oauth.google.get('https://openidconnect.googleapis.com/v1/userinfo')
        user_info_response.raise_for_status()
        user_info = user_info_response.json()
    except Exception as e:
        return redirect(f"http://localhost:3000/login?error=google_auth_failed&message={str(e)}")

    if not user_info or 'email' not in user_info:
        return redirect("http://localhost:3000/login?error=google_user_info_failed")

    email = user_info['email']
    domain = email.split('@')[-1]

    if domain.lower() != "tigeranalytics.com":
        return redirect("http://localhost:3000/login?error=unauthorized_domain")

    user = User.query.filter_by(Email=email).first()

    if not user:
        default_role = get_predefined_role('read_only_user')
        if not default_role:
            return redirect("http://localhost:3000/login?error=default_role_missing")

        try:
            username_candidate = email.split('@')[0]
            temp_username = username_candidate
            counter = 1
            while User.query.filter_by(Username=temp_username).first():
                temp_username = f"{username_candidate}{counter}"
                counter += 1
            
            user = User(
                Username=temp_username,
                Email=email,
                FullName=user_info.get('name'),
                PasswordHash=generate_password_hash(os.urandom(16))
            )
            db.session.add(user)
            db.session.flush()

            user_role = UserRole(UserID=user.UserID, RoleID=default_role.RoleID)
            db.session.add(user_role)
            db.session.commit()
        except Exception:
            db.session.rollback()
            return redirect("http://localhost:3000/login?error=user_creation_failed")

    if not user.IsActive:
        return redirect("http://localhost:3000/login?error=inactive_user")

    # MODIFIED: Generate JWT and redirect to a frontend callback route with the token
    identity_data = {
        "user_id": user.UserID,
        "username": user.Username,
        "roles": [role.RoleName for role in user.roles]
    }
    access_token = create_access_token(identity_data=identity_data)
    
    # Redirect to a route on your frontend that can handle the token
    return redirect(f"http://localhost:3000/auth/callback?token={access_token}")

@user_routes.route('/logout', methods=['POST'])
def logout():
    # For JWT, logout is primarily a client-side action (deleting the token).
    # This endpoint can be used for blocklisting tokens if implemented.
    return jsonify({'message': 'Logout successful. Please clear the token on the client-side.'}), 200

@user_routes.route('/me', methods=['GET'])
@jwt_required  # MODIFIED: Protect with JWT
def get_current_user_info(current_user):
    # MODIFIED: The user object is now injected by the @jwt_required decorator
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

# --- User Management (CRUD - MODIFIED to use JWT) ---
@user_routes.route('/', methods=['POST'])
@jwt_required  # NEW: Add JWT protection
@role_required('admin')
def create_user(current_user):
    # ... function logic remains the same ...
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
@jwt_required # NEW: Add JWT protection for listing users
def list_users(current_user):
    # ... function logic remains the same ...
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
@jwt_required  # NEW: Add JWT protection
@role_required('admin')
def get_user(current_user, user_id):
    # ... function logic remains the same ...
    user = User.query.get_or_404(user_id)
    roles = [{"RoleID": r.RoleID, "RoleName": r.RoleName} for r in user.roles]
    return jsonify({
        "UserID": user.UserID, "Username": user.Username, "FullName": user.FullName,
        "Email": user.Email, "IsActive": user.IsActive,
        "CreatedAt": user.CreatedAt.isoformat() if user.CreatedAt else None, "roles": roles
    }), 200

@user_routes.route('/<int:user_id>', methods=['PUT'])
@jwt_required  # NEW: Add JWT protection
@role_required('admin')
def update_user(current_user, user_id):
    # ... function logic remains the same ...
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
@jwt_required  # NEW: Add JWT protection
@role_required('admin')
def delete_user(current_user, user_id):
    # ... function logic remains the same ...
    user = User.query.get_or_404(user_id)
    try:
        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "User deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Unexpected error.", "error": str(e)}), 500

@user_routes.route('/roles', methods=['GET'])
@jwt_required # NEW: Add JWT protection
def list_all_system_roles(current_user):
    # ... function logic remains the same ...
    try:
        roles = Role.query.all()
        return jsonify([{"RoleID": r.RoleID, "RoleName": r.RoleName, "Description": r.Description} for r in roles]), 200
    except Exception as e:
        return jsonify({"message": "Failed to retrieve roles.", "error": str(e)}), 500