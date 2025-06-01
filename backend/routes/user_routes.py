# routes/user_routes.py

from flask import Blueprint, request, jsonify,redirect, url_for,session, current_app as app
from models import db, User, Role, UserRole 
from werkzeug.security import generate_password_hash 
from sqlalchemy.exc import IntegrityError
from utils import role_required, get_current_user_from_session 
from auth import oauth
import os


user_routes = Blueprint('user_routes', __name__)

def get_all_role_names():
    """Fetches all role names from the database."""
    try:
        roles = Role.query.all()
        return {role.RoleName for role in roles}
    except Exception as e:
        return set() 

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
    # --- MODIFIED: Expect a single RoleName ---
    role_name_to_assign = data.get('RoleName')

    if not username or not password:
        return jsonify({"message": "Username and Password are required"}), 400

    # --- MODIFIED: Validate single RoleName ---
    if not role_name_to_assign or not isinstance(role_name_to_assign, str) or not role_name_to_assign.strip():
        return jsonify({"message": "A valid RoleName (non-empty string) must be assigned"}), 400

    allowed_roles = get_all_role_names()
    if not allowed_roles: # Should not happen if DB is okay
        return jsonify({"message": "Could not retrieve roles from the database. Cannot proceed."}), 500

    if role_name_to_assign not in allowed_roles:
        return jsonify({
            "message": f"Role '{role_name_to_assign}' cannot be assigned. Please use a role from the available list: {', '.join(allowed_roles)}"
        }), 400
    # --- END OF MODIFICATIONS for role validation ---

    try:
        if User.query.filter_by(Username=username).first():
            return jsonify({"message": f"Username '{username}' already exists."}), 409 # Conflict
        if email and User.query.filter_by(Email=email).first():
            return jsonify({"message": f"Email '{email}' already exists."}), 409 # Conflict

        new_user = User(Username=username, FullName=full_name, Email=email)
        new_user.set_password(password) # Hashes and sets the password
        db.session.add(new_user)
        db.session.flush() # Flush to get new_user.UserID before assigning role

        # --- MODIFIED: Assign single role ---
        assigned_role_feedback_name = None
        role_obj = Role.query.filter_by(RoleName=role_name_to_assign).first()
        if role_obj:
            user_role_link = UserRole(UserID=new_user.UserID, RoleID=role_obj.RoleID)
            db.session.add(user_role_link)
            assigned_role_feedback_name = role_obj.RoleName
        else:
            # This should not be reached if validation above is correct
            db.session.rollback()
            return jsonify({"message": f"Internal error: Role '{role_name_to_assign}' validated but not found during assignment."}), 500
        # --- END OF MODIFICATIONS for role assignment ---
        
        db.session.commit()

        return jsonify({
            "message": "User created successfully",
            "UserID": new_user.UserID,
            "Username": new_user.Username,
            # Return the single role assigned. Frontend might expect an array, adjust if needed.
            # For consistency with how 'roles' is often structured, returning as a list with one item:
            "roles": [{"RoleName": assigned_role_feedback_name}] if assigned_role_feedback_name else [] 
        }), 201

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({"message": "Database integrity error during user creation.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        # Log the exception e for server-side debugging
        print(f"Unexpected error during user creation: {e}")
        return jsonify({"message": "An unexpected error occurred while creating the user.", "error": str(e)}), 500

@user_routes.route('/', methods=['GET'])
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

    allowed_roles_names = get_all_role_names() # Fetch set of allowed role names
    if not allowed_roles_names:
         return jsonify({"message": "Could not retrieve roles from the database. Cannot proceed."}), 500

    try:
        if 'FullName' in data:
            user.FullName = data.get('FullName', user.FullName)

        if 'Email' in data:
            new_email = data.get('Email')
            # Check if email is changing and if the new email is already used by another user
            if new_email and new_email != user.Email and User.query.filter(User.Email == new_email, User.UserID != user_id).first():
                return jsonify({"message": f"Email '{new_email}' is already in use."}), 409
            user.Email = new_email

        if 'Password' in data and data['Password']: # Check if password is provided and not empty
            user.set_password(data['Password'])

        if 'IsActive' in data and isinstance(data['IsActive'], bool):
            user.IsActive = data['IsActive']

        # --- MODIFIED ROLE UPDATE LOGIC FOR SINGLE ROLE ---
        if 'RoleName' in data:
            new_role_name = data.get('RoleName')

            if not isinstance(new_role_name, str) or not new_role_name.strip():
                return jsonify({"message": "RoleName must be a non-empty string."}), 400

            if new_role_name not in allowed_roles_names:
                return jsonify({
                    "message": f"Role '{new_role_name}' cannot be assigned. Please use a role from the available list: {', '.join(allowed_roles_names)}"
                }), 400

            # Find the new role object
            role_to_assign = Role.query.filter_by(RoleName=new_role_name).first()
            if not role_to_assign:
                # This should ideally not happen if new_role_name is in allowed_roles_names
                return jsonify({"message": f"Role '{new_role_name}' not found in database roles."}), 404

            # Remove all existing role associations for this user
            UserRole.query.filter_by(UserID=user.UserID).delete()
            
            # Add the new single role association
            new_user_role_assoc = UserRole(UserID=user.UserID, RoleID=role_to_assign.RoleID)
            db.session.add(new_user_role_assoc)
            # --- END OF MODIFIED ROLE UPDATE LOGIC ---

        db.session.commit()
        # Fetch the updated user with roles to return
        updated_user_info = User.query.get(user_id)
        roles_data = [{"RoleID": r.RoleID, "RoleName": r.RoleName} for r in updated_user_info.roles]

        return jsonify({
            "message": "User updated successfully",
            "UserID": updated_user_info.UserID,
            "Username": updated_user_info.Username,
            "FullName": updated_user_info.FullName,
            "Email": updated_user_info.Email,
            "IsActive": updated_user_info.IsActive,
            "roles": roles_data # Return the updated roles
        }), 200

    except IntegrityError as e:
        db.session.rollback()
        # It's helpful to log the original error e.orig for debugging
        return jsonify({"message": "Database integrity error during update.", "error_detail": str(e.orig)}), 400
    except Exception as e:
        db.session.rollback()
        # Log the full exception e for debugging
        return jsonify({"message": "An unexpected error occurred during user update.", "error": str(e)}), 500


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