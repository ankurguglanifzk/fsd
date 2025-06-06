# auth.py

from authlib.integrations.flask_client import OAuth
from flask import current_app

# Initialize the OAuth registry
oauth = OAuth()

def init_oauth(current_flask_app):
    """
    Initializes the OAuth client with providers like Google.
    This function is called from the application factory (create_app).
    """
    # Check if 'google' client is already registered to avoid duplication
    if 'google' not in oauth._clients:
        oauth.register(
            name='google',
            # It's best practice to load secrets from the environment/config
            client_id=current_flask_app.config.get('GOOGLE_CLIENT_ID'),
            client_secret=current_flask_app.config.get('GOOGLE_CLIENT_SECRET'),
            # The server_metadata_url automatically fetches the correct endpoints for authorization and tokens
            server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
            client_kwargs={
                # 'scope' defines what information the application is requesting from Google
                'scope': 'openid email profile'
            }
        )
    
    # Initialize the client with the Flask app instance
    oauth.init_app(current_flask_app)
