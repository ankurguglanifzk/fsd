import os
from sqlalchemy import create_engine
from urllib.parse import quote_plus
from sqlalchemy.exc import OperationalError
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

class Config:
    # Secret key for sessions
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a-default-dev-secret-key-please-change-for-prod'

    # SQLAlchemy settings
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = os.environ.get('SQLALCHEMY_ECHO', 'False').lower() == 'true'

    # MySQL DB credentials
    DB_USER = os.environ.get('DB_USER') or 'root'
    DB_PASSWORD = os.environ.get('DB_PASSWORD') or 'Root@123'
    DB_HOST = os.environ.get('DB_HOST') or 'localhost'
    DB_PORT = os.environ.get('DB_PORT') or '3306'
    DB_NAME = os.environ.get('DB_NAME') or 'tasktrackerapp_local_db'

    # Safe password encoding for URL
    PASSWORD_ENCODED = quote_plus(DB_PASSWORD)

    SQLALCHEMY_DATABASE_URI = (
        os.environ.get('DATABASE_URL') or
        f"mysql+mysqlconnector://{DB_USER}:{PASSWORD_ENCODED}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

    # Flask debug mode
    DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'

    # Google OAuth credentials
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID') or '8701416899-ca78l8pqbem0b2jfa2votu3tl02ai48j.apps.googleusercontent.com' # Replace with your actual Client ID
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET') or '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' # Replace with your actual Client Secret
    GOOGLE_DISCOVERY_URL = os.environ.get("GOOGLE_DISCOVERY_URL") or "https://accounts.google.com/.well-known/openid-configuration"

# --- Optional: Test DB connection directly ---
if __name__ == "__main__":
    try:
        engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
        connection = engine.connect()
        print("✅ Connection to database successful!")
        connection.close()
    except OperationalError as e:
        print("❌ Connection to database failed!")
        print(f"Error: {e}")
