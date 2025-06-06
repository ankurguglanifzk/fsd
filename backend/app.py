# app.py

from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from datetime import datetime
import os
from models import db, populate_roles

from routes.user_routes import user_routes
from routes.project_routes import project_routes
from routes.task_routes import task_routes

from auth import init_oauth

def create_app(config_class=Config):
    """Application factory function."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize database and OAuth
    db.init_app(app)
    init_oauth(app)

    # Configure CORS to allow credentials and the Authorization header for JWT
    CORS(
        app,
        resources={r"/api/v1/*": {"origins": ["http://localhost:3000", "http://tasktrackjune.s3-website.ap-south-1.amazonaws.com", "http://tasktrack4june.s3-website-ap-southeast-2.amazonaws.com"]}},
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"]
    )

    # Register API blueprints
    app.register_blueprint(user_routes, url_prefix='/api/v1/users')
    app.register_blueprint(project_routes, url_prefix='/api/v1/projects')
    app.register_blueprint(task_routes, url_prefix='/api/v1/tasks')

    with app.app_context():
        # Create database tables if they don't exist
        db.create_all()
        db_name = app.config.get('DB_NAME', 'tasktrackerapp_local_db')
        print(f"Database tables checked/created in '{db_name}'.")

        # Populate the database with initial roles
        if callable(populate_roles):
            populate_roles()
        else:
            print("'populate_roles' function not found or not callable. Skipping role population.")

    # --- Basic Routes ---

    @app.route('/')
    def hello_world():
        return "Hello, Flask Task Tracker API is alive!"

    @app.route('/api/v1/health')
    def health_check():
        """Provides a simple health check endpoint."""
        try:
            # You could add a simple DB check here if needed, e.g., db.session.execute('SELECT 1')
            return jsonify({
                "status": "healthy",
                "message": "API is up and running!",
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }), 200
        except Exception as e:
            app.logger.error(f"Health check failed: {e}")
            return jsonify({
                "status": "unhealthy",
                "message": "API is having issues.",
                "error": str(e)
            }), 500
            
    return app

# Create the Flask app instance
app = create_app()

if __name__ == '__main__':
    # This environment variable is necessary for local testing of Google OAuth over HTTP.
    # It should be disabled in a production environment running HTTPS.
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
    app.run(debug=app.config.get('DEBUG', True), host='0.0.0.0', port=5000)
