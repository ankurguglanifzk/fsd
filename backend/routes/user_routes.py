# routes/user_routes.py

from flask import Blueprint, request, jsonify,redirect, url_for,session, current_app as app
from models import db, User, Role, UserRole 
from werkzeug.security import generate_password_hash # check_password_hash is in User model
from sqlalchemy.exc import IntegrityError
from utils import role_required, get_current_user_from_session # Use helper from utils.py
from auth import oauth
import os

# Ensure this blueprint name 'user_routes' matches the import in app.py
user_routes = Blueprint('user_routes', __name__)

# --- Helper Function to get roles from DB ---
def get_all_role_names():
    """Fetches all role names from the database."""
    try:
        roles = Role.query.all()
        return {role.RoleName for role in roles}
    except Exception as e:
        return set() # Return an empty set on error, handled in routes

# --- Authentication ---
@user_routes.route('/login', methods=['POST']) # Full path will be /api/v1/users/login
def login():
    data = request.get_json()
    if not data or 'Username' not in data or 'Password' not in data:
        return jsonify({'message': 'Username and Password are required'}), 400

    user = User.query.filter_by(Username=data['Username']).first()
    
    if not user or not user.check_password(data['Password']):
        return jsonify({'message': 'Invalid username or password'}), 401
    
    if not user.IsActive:
        return jsonify({'message': 'User account is inactive'}), 401

    session.clear() 
    session['user_id'] = user.UserID
    session['username'] = user.Username 

    user_roles = [role.RoleName for role in user.roles.all()]
    session['roles'] = user_roles
    
    user_roles_data = [role.RoleName for role in user.roles.all()]
    return jsonify({
        'message': 'Login successful', 
        'UserID': user.UserID,
        'Username': user.Username,
        'FullName': user.FullName,
        'Email': user.Email,
        'IsActive': user.IsActive,
        'roles': user_roles_data
    }), 200

@user_routes.route('/login/google')
def login_google():
    redirect_uri = url_for('user_routes.google_callback', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

def get_predefined_role(role_name):
    """Fetch a Role object by RoleName from the DB."""
    try:
        role = Role.query.filter_by(RoleName=role_name).first()
        if not role:
            return role
    except Exception as e:
        return None



@user_routes.route('/google/callback')  # Path: /api/v1/users/google/callback
def google_callback():
    print("🔄 Google callback route hit.")
    try:
        token = oauth.google.authorize_access_token()
        print(token)
        user_info_response = oauth.google.get('https://openidconnect.googleapis.com/v1/userinfo')
        user_info_response.raise_for_status()
        user_info = user_info_response.json()
        print(user_info)
    except Exception as e:
        return redirect(f"http://localhost:3000/login?error=google_auth_failed&message={str(e)}")

    if not user_info or 'email' not in user_info:
        return redirect("http://localhost:3000/login?error=google_user_info_failed")

    email = user_info['email']
    domain = email.split('@')[-1]

    # ✅ Restrict to tigeranalytics.com domain
    if domain.lower() != "tigeranalytics.com":
        return redirect("http://localhost:3000/login?error=unauthorized_domain")

    full_name = user_info.get('name')
    username_candidate = email.split('@')[0]

    user = User.query.filter_by(Email=email).first()

    if not user:
        default_role = get_predefined_role('read_only_user')
        if not default_role:
            return redirect("http://localhost:3000/login?error=default_role_missing")

        try:
            temp_username = username_candidate
            counter = 1
            while User.query.filter_by(Username=temp_username).first():
                temp_username = f"{username_candidate}{counter}"
                counter += 1

            user = User(
                Username=temp_username,
                Email=email,
                FullName=full_name,
                PasswordHash=generate_password_hash(os.urandom(16))  # Secure dummy password
            )
            db.session.add(user)
            db.session.flush()  # Needed to get user.UserID before user_role

            user_role = UserRole(UserID=user.UserID, RoleID=default_role.RoleID)
            db.session.add(user_role)
            db.session.commit()
        except IntegrityError as e:
            db.session.rollback()
            return redirect("http://localhost:3000/login?error=user_creation_failed")
        except Exception as e:
            db.session.rollback()
            return redirect("http://localhost:3000/login?error=user_creation_failed")

    if not user.IsActive:
        return redirect("http://localhost:3000/login?error=inactive_user")

    # ✅ Log the user in
    session.clear()
    session['user_id'] = user.UserID
    session['username'] = user.Username
    session['roles'] = [role.RoleName for role in user.roles.all()]

    return redirect("http://localhost:3000/dashboard")

@user_routes.route('/logout', methods=['POST']) # Path: /api/v1/users/logout
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

@user_routes.route('/me', methods=['GET']) # Path: /api/v1/users/me
def get_current_user_info():
    user = get_current_user_from_session()
    if not user:
        return jsonify({'message': 'Unauthorized. No active session or user not found.'}), 401
    
    user_roles_data = [role.RoleName for role in user.roles.all()]
    return jsonify({
        'UserID': user.UserID,
        'Username': user.Username,
        'FullName': user.FullName,
        'Email': user.Email,
        'IsActive': user.IsActive,
        'CreatedAt': user.CreatedAt.isoformat() if user.CreatedAt else None,
        'roles': user_roles_data
    }), 200

# --- User Management (CRUD) ---
@user_routes.route('/', methods=['POST'])
@role_required('admin')
def create_user():
    data = request.json
    if not data:
        return jsonify({"message": "No input data provided"}), 400

    username = data.get('Username')
    password = data.get('Password')
    email = data.get('Email')
    full_name = data.get('FullName')
    role_names_to_assign = data.get('roles', [])

    if not username or not password:
        return jsonify({"message": "Username and Password are required"}), 400

    if not role_names_to_assign:
        return jsonify({"message": "At least one role must be assigned"}), 400

    allowed_roles = get_all_role_names()
    if not allowed_roles:
        return jsonify({"message": "Could not retrieve roles from the database. Cannot proceed."}), 500

    invalid_roles = [r for r in role_names_to_assign if r not in allowed_roles]
    if invalid_roles:
        # --- MODIFIED ERROR MESSAGE ---
        return jsonify({"message": f"Role(s) '{', '.join(invalid_roles)}' cannot be assigned. Please use roles from the available list: {', '.join(allowed_roles)}"}), 400
        # --- END MODIFICATION ---

    try:
        if User.query.filter_by(Username=username).first():
            return jsonify({"message": f"Username '{username}' already exists."}), 409
        if email and User.query.filter_by(Email=email).first():
            return jsonify({"message": f"Email '{email}' already exists."}), 409

        new_user = User(Username=username, FullName=full_name, Email=email)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.flush()

        assigned_roles_feedback = []
        for role_name in role_names_to_assign:
            role = Role.query.filter_by(RoleName=role_name).first()
            if role:
                user_role = UserRole(UserID=new_user.UserID, RoleID=role.RoleID)
                db.session.add(user_role)
                assigned_roles_feedback.append(role.RoleName)

        db.session.commit()

        return jsonify({
            "message": "User created successfully",
            "UserID": new_user.UserID,
            "Username": new_user.Username,
            "roles": assigned_roles_feedback
        }), 201

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": "Database integrity error.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "An unexpected error occurred.", "error": str(e)}), 500

@user_routes.route('/', methods=['GET'])
@role_required('admin') 
def list_users():
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
@role_required('admin') 
def get_user(user_id):
    user = User.query.get_or_404(user_id, description=f"User with ID {user_id} not found.")
    roles = [{"RoleID": r.RoleID, "RoleName": r.RoleName} for r in user.roles.all()]
    return jsonify({
        "UserID": user.UserID, "Username": user.Username, "FullName": user.FullName,
        "Email": user.Email, "IsActive": user.IsActive,
        "CreatedAt": user.CreatedAt.isoformat() if user.CreatedAt else None, "roles": roles
    }), 200

@user_routes.route('/<int:user_id>', methods=['PUT'])
@role_required('admin') 
def update_user(user_id):
    user = User.query.get_or_404(user_id, description=f"User with ID {user_id} not found.")
    data = request.json
    if not data:
        return jsonify({"message": "No input data"}), 400

    allowed_roles = get_all_role_names()
    if not allowed_roles:
         return jsonify({"message": "Could not retrieve roles from the database. Cannot proceed."}), 500

    try:
        if 'FullName' in data:
            user.FullName = data.get('FullName', user.FullName)

        if 'Email' in data:
            new_email = data.get('Email')
            if new_email and new_email != user.Email and User.query.filter(User.Email == new_email, User.UserID != user_id).first():
                return jsonify({"message": f"Email '{new_email}' is already in use."}), 409
            user.Email = new_email

        if 'Password' in data and data['Password']:
            user.set_password(data['Password'])

        if 'IsActive' in data and isinstance(data['IsActive'], bool):
            user.IsActive = data['IsActive']

        if 'roles' in data and isinstance(data.get('roles'), list):
            new_role_names = set(data['roles'])

            invalid_roles = new_role_names - allowed_roles
            if invalid_roles:
                # --- MODIFIED ERROR MESSAGE ---
                return jsonify({"message": f"Role(s) '{', '.join(invalid_roles)}' cannot be assigned. Please use roles from the available list: {', '.join(allowed_roles)}"}), 400
                # --- END MODIFICATION ---

            current_user_roles = UserRole.query.filter_by(UserID=user.UserID).all()
            current_role_ids = {ur.RoleID for ur in current_user_roles}

            roles_to_add_ids = []
            for role_name_to_add in new_role_names:
                role_obj = Role.query.filter_by(RoleName=role_name_to_add).first()
                if role_obj:
                    roles_to_add_ids.append(role_obj.RoleID)

            for role_id_to_add in roles_to_add_ids:
                if role_id_to_add not in current_role_ids:
                    db.session.add(UserRole(UserID=user.UserID, RoleID=role_id_to_add))

            for ur_assoc in current_user_roles:
                role_obj = Role.query.get(ur_assoc.RoleID)
                if role_obj and role_obj.RoleName not in new_role_names:
                    db.session.delete(ur_assoc)

        db.session.commit()
        return jsonify({"message": "User updated", "UserID": user.UserID}), 200

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": "Database integrity error.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Unexpected error.", "error": str(e)}), 500

@user_routes.route('/<int:user_id>', methods=['DELETE'])
@role_required('admin')
def delete_user(user_id):
    user = User.query.get_or_404(user_id, description=f"User with ID {user_id} not found.")
    try:
        db.session.delete(user) 
        db.session.commit()
        return jsonify({"message": "User deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Unexpected error.", "error": str(e)}), 500

@user_routes.route('/roles', methods=['GET'])
def list_all_system_roles():
    try:
        roles = Role.query.all()
        return jsonify([{"RoleID": r.RoleID, "RoleName": r.RoleName, "Description": r.Description} for r in roles]), 200
    except Exception as e:
        return jsonify({"message": "Failed to retrieve roles.", "error": str(e)}), 500

@user_routes.route('/<int:user_id>/roles', methods=['POST'])
@role_required('admin')
def assign_role_to_user(user_id):
    user = User.query.get_or_404(user_id, description=f"User with ID {user_id} not found.")
    data = request.json
    if not data or 'RoleName' not in data:
        return jsonify({"message": "RoleName is required"}), 400

    role_name_to_assign = data['RoleName']
    
    allowed_roles = get_all_role_names()
    if not allowed_roles:
         return jsonify({"message": "Could not retrieve roles from the database."}), 500

    if role_name_to_assign not in allowed_roles:
        # --- MODIFIED ERROR MESSAGE ---
        return jsonify({"message": f"The role '{role_name_to_assign}' cannot be assigned. Please use a role from the available list: {', '.join(allowed_roles)}"}), 400
        # --- END MODIFICATION ---

    role = Role.query.filter_by(RoleName=role_name_to_assign).first()
    if not role: 
        return jsonify({"message": f"Role '{role_name_to_assign}' not found in database (consistency issue)."}), 404
    
    existing_assignment = UserRole.query.filter_by(UserID=user.UserID, RoleID=role.RoleID).first()
    if existing_assignment:
        return jsonify({"message": f"User already has role '{role_name_to_assign}'."}), 409
    
    try:
        user_role = UserRole(UserID=user.UserID, RoleID=role.RoleID)
        db.session.add(user_role)
        db.session.commit()
        return jsonify({"message": f"Role '{role.RoleName}' assigned to user '{user.Username}'."}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to assign role.", "error": str(e)}), 500

@user_routes.route('/<int:user_id>/roles/<int:role_id_to_remove>', methods=['DELETE'])
@role_required('admin')
def remove_role_from_user(user_id, role_id_to_remove):
    user = User.query.get_or_404(user_id, description=f"User with ID {user_id} not found.")
    role = Role.query.get_or_404(role_id_to_remove, description=f"Role with ID {role_id_to_remove} not found.")
    association = UserRole.query.filter_by(UserID=user.UserID, RoleID=role.RoleID).first()
    if not association:
        return jsonify({"message": f"User does not have role '{role.RoleName}'."}), 404
    try:
        db.session.delete(association)
        db.session.commit()
        return jsonify({"message": f"Role '{role.RoleName}' removed from user '{user.Username}'."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Failed to remove role.", "error": str(e)}), 500