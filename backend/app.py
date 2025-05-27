# app.py

from flask import Flask, jsonify 
from flask_cors import CORS
from config import Config 
from datetime import datetime

from models import db, populate_roles 

from routes.user_routes import user_routes 
from routes.project_routes import project_routes
from routes.task_routes import task_routes

from auth import init_oauth
 # Import the init_oauth function

def create_app(config_class=Config):
    """Application factory function."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    init_oauth(app) # Initialize OAuth with the app instance
    
    CORS(
        app,
        resources={r"/api/v1/*": {"origins": "http://localhost:3000"}}, 
        supports_credentials=True, 
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"]
    )

    app.register_blueprint(user_routes, url_prefix='/api/v1/users')
    app.register_blueprint(project_routes, url_prefix='/api/v1/projects')
    app.register_blueprint(task_routes, url_prefix='/api/v1/tasks')

    with app.app_context():
        db.create_all() 
        db_name = app.config.get('DB_NAME', 'tasktrackerapp_local_db')
        print(f"Database tables checked/created in '{db_name}'.")
        
        if callable(populate_roles):
            populate_roles()
        else:
            print("'populate_roles' function not found or not callable in models.py. Skipping role population.")

    @app.route('/') 
    def hello_world():
        return "Hello, Flask Task Tracker API is alive!"

    @app.route('/api/v1/health') 
    def health_check():
        try:
            return jsonify({"status": "healthy", "message": "API is up and running!", "timestamp": datetime.utcnow().isoformat() + "Z"}), 200
        except Exception as e:
            app.logger.error(f"Health check failed: {e}") 
            return jsonify({"status": "unhealthy", "message": "API is having issues.", "error": str(e)}), 500
            
    return app

app = create_app()

if __name__ == '__main__':
    # For Google OAuth callback to work with http locally, you might need this for testing:
    # os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1' 
    # But ensure your redirect URIs in Google Cloud Console are http://localhost:5000/...
    app.run(debug=app.config.get('DEBUG', True), host='0.0.0.0', port=5000)
