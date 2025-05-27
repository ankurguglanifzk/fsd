from app import app, db
from models import User, Role, UserRole
from werkzeug.security import generate_password_hash
from datetime import datetime

def create_user_with_role(username, password, fullname, email, role_name):
    try:
        hashed_pw = generate_password_hash(password)

        user = User(
            Username=username,
            PasswordHash=hashed_pw,
            FullName=fullname,
            Email=email,
            CreatedAt=datetime.utcnow(),
            IsActive=True
        )

        db.session.add(user)
        db.session.flush()  # To get UserID before commit

        role = Role.query.filter_by(RoleName=role_name).first()
        if not role:
            print(f"Role '{role_name}' not found!")
            db.session.rollback()
            return

        user_role = UserRole(UserID=user.UserID, RoleID=role.RoleID)
        db.session.add(user_role)
        db.session.commit()
        print(f"User '{username}' with role '{role_name}' created.")

    except Exception as e:
        db.session.rollback()
        print(f"Error creating user '{username}': {e}")

if __name__ == '__main__':
    with app.app_context():
        create_user_with_role('adminuser', 'Admin@123', 'Admin User', 'admin@example.com', 'admin')
        create_user_with_role('creatoruser', 'Creator@123', 'Task Creator', 'creator@example.com', 'task_creator')
        create_user_with_role('readonlyuser', 'ReadOnly@123', 'Read Only User', 'readonly@example.com', 'read_only_user')
