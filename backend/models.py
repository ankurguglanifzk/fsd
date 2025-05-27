# models.py

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func # For default timestamps
from werkzeug.security import generate_password_hash, check_password_hash # For password operations
from datetime import datetime # Keep for type hinting or if func.now()/utcnow() is not preferred everywhere

db = SQLAlchemy()

# Association table for the many-to-many relationship between Users and Roles
# This is an alternative way to define a many-to-many relationship without an explicit model class
# if UserRole doesn't have extra columns beyond UserID and RoleID.
# However, since our UserRole has an AssignedAt and its own PK, an explicit model is better.
# user_roles_table = db.Table('UserRoles',
#     db.Column('UserID', db.Integer, db.ForeignKey('Users.UserID'), primary_key=True),
#     db.Column('RoleID', db.Integer, db.ForeignKey('Roles.RoleID'), primary_key=True),
#     db.Column('AssignedAt', db.DateTime, default=func.now()) # Example of extra data
# )

class User(db.Model):
    __tablename__ = 'Users'

    UserID = db.Column(db.Integer, primary_key=True)
    Username = db.Column(db.String(100), unique=True, nullable=False)
    PasswordHash = db.Column(db.String(255), nullable=False)
    FullName = db.Column(db.String(255), nullable=True)
    Email = db.Column(db.String(120), unique=True, nullable=True)
    CreatedAt = db.Column(db.DateTime, nullable=False, default=func.now())
    IsActive = db.Column(db.Boolean, default=True, nullable=False)

    # Relationships
    projects_owned = db.relationship('Project', foreign_keys='Project.OwnerUserID', back_populates='owner', lazy='dynamic')
    tasks_owned = db.relationship('Task', foreign_keys='Task.OwnerUserID', back_populates='owner', lazy='dynamic')
    tasks_assigned = db.relationship('Task', foreign_keys='Task.AssignedToUserID', back_populates='assignee', lazy='dynamic')
    
    # Many-to-many relationship with Role through UserRole model
    roles = db.relationship('Role', secondary='UserRoles', back_populates='users', lazy='dynamic')
    # If using UserRole model directly for more complex queries:
    # user_role_associations = db.relationship('UserRole', back_populates='user', lazy='dynamic', cascade="all, delete-orphan")


    def set_password(self, password):
        self.PasswordHash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.PasswordHash, password)

    def __repr__(self):
        return f"<User {self.Username}>"

class Role(db.Model):
    __tablename__ = 'Roles'

    RoleID = db.Column(db.Integer, primary_key=True)
    RoleName = db.Column(db.String(100), unique=True, nullable=False) # e.g., 'admin', 'task_creator', 'read_only_user'
    Description = db.Column(db.String(255), nullable=True)

    # Many-to-many relationship with User through UserRole model
    users = db.relationship('User', secondary='UserRoles', back_populates='roles', lazy='dynamic')
    # If using UserRole model directly:
    # user_role_associations = db.relationship('UserRole', back_populates='role', lazy='dynamic', cascade="all, delete-orphan")


    def __repr__(self):
        return f"<Role {self.RoleName}>"

class UserRole(db.Model):
    __tablename__ = 'UserRoles' # Junction table with its own primary key and extra data

    UserRoleID = db.Column(db.Integer, primary_key=True, autoincrement=True)
    UserID = db.Column(db.Integer, db.ForeignKey('Users.UserID', ondelete='CASCADE'), nullable=False)
    RoleID = db.Column(db.Integer, db.ForeignKey('Roles.RoleID', ondelete='CASCADE'), nullable=False)
    
    AssignedAt = db.Column(db.DateTime, default=func.now())

    # Define a unique constraint for UserID and RoleID combination
    __table_args__ = (db.UniqueConstraint('UserID', 'RoleID', name='uq_user_role'),)

    # Optional: define relationships back to User and Role if you query UserRole directly often
    # user = db.relationship("User", back_populates="user_role_associations")
    # role = db.relationship("Role", back_populates="user_role_associations")


    def __repr__(self):
        return f"<UserRole UserID={self.UserID} RoleID={self.RoleID}>"


class Project(db.Model):
    __tablename__ = 'Projects'

    ProjectID = db.Column(db.Integer, primary_key=True)
    ProjectName = db.Column(db.String(150), nullable=False)
    Description = db.Column(db.Text, nullable=True)
    StartDate = db.Column(db.Date, nullable=True)
    EndDate = db.Column(db.Date, nullable=True)
    OwnerUserID = db.Column(db.Integer, db.ForeignKey('Users.UserID', name='fk_project_owner_user_id', ondelete='SET NULL'), nullable=True)
    CreatedAt = db.Column(db.DateTime, nullable=False, default=func.now())
    UpdatedAt = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())

    owner = db.relationship('User', foreign_keys=[OwnerUserID], back_populates='projects_owned')
    tasks = db.relationship('Task', back_populates='project', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project {self.ProjectName}>"

class Task(db.Model):
    __tablename__ = 'Tasks'

    TaskID = db.Column(db.Integer, primary_key=True)
    Description = db.Column(db.Text, nullable=False)
    DueDate = db.Column(db.Date, nullable=True)
    Status = db.Column(
        db.Enum('new', 'in-progress', 'blocked', 'completed', 'not started', name='task_status_enum'),
        default='new',
        nullable=False
    )
    OwnerUserID = db.Column(db.Integer, db.ForeignKey('Users.UserID', name='fk_task_owner_user_id', ondelete='SET NULL'), nullable=True)
    AssignedToUserID = db.Column(db.Integer, db.ForeignKey('Users.UserID', name='fk_task_assigned_user_id', ondelete='SET NULL'), nullable=True)
    ProjectID = db.Column(db.Integer, db.ForeignKey('Projects.ProjectID', name='fk_task_project_id', ondelete='CASCADE'), nullable=False)
    CreatedAt = db.Column(db.DateTime, nullable=False, default=func.now())
    UpdatedAt = db.Column(db.DateTime, nullable=False, default=func.now(), onupdate=func.now())

    project = db.relationship('Project', back_populates='tasks')
    owner = db.relationship('User', foreign_keys=[OwnerUserID], back_populates='tasks_owned')
    assignee = db.relationship('User', foreign_keys=[AssignedToUserID], back_populates='tasks_assigned')

    def __repr__(self):
        return f"<Task {self.TaskID} - {self.Description[:30]}>"

def populate_roles():
    """
    Populates the Roles table with default roles if they don't already exist.
    This function should be called within an application context.
    """
    default_roles = [
        {'RoleName': 'admin', 'Description': 'Administrator with full system access.'},
        {'RoleName': 'task_creator', 'Description': 'User who can create projects and tasks.'},
        {'RoleName': 'read_only_user', 'Description': 'User with read-only access, can mark tasks complete.'}
    ]
    try:
        for role_data in default_roles:
            role = Role.query.filter_by(RoleName=role_data['RoleName']).first()
            if not role:
                new_role = Role(RoleName=role_data['RoleName'], Description=role_data['Description'])
                db.session.add(new_role)
        db.session.commit()
        print("Default roles checked/populated.")
    except Exception as e:
        db.session.rollback()
        print(f"Error populating roles: {e}")

