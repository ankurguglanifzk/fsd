# auth.py
from authlib.integrations.flask_client import OAuth
from flask import current_app as app # To access app.config

oauth = OAuth()

def init_oauth(current_flask_app):
    """Initializes OAuth providers."""
    # Make sure to call this function from your app factory (create_app in app.py)
    # Example: auth.init_oauth(app)

    # Check if already initialized to prevent re-registering
    if 'google' not in oauth._clients:
        oauth.register(
            name='google',
            client_id=current_flask_app.config.get('GOOGLE_CLIENT_ID') or ('8701416899-ca78l8pqbem0b2jfa2votu3tl02ai48j.apps.googleusercontent.com'),
            client_secret=current_flask_app.config.get('GOOGLE_CLIENT_SECRET') or ('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'),
            server_metadata_url='https://accounts.google.com/.well-known/openid-configuration', # OpenID Connect discovery
            client_kwargs={
                'scope': 'openid email profile' # Scopes you want to request
            }
        )
    oauth.init_app(current_flask_app)

