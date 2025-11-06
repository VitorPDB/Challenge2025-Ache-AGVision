import os
import webbrowser
from waitress import serve

# Import the Flask app instance from your existing file
from app_final import app

if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5000"))
    start_path = os.environ.get("START_PATH", "/controle")  # open control page by default

    url = f"http://{host}:{port}{start_path if start_path.startswith('/') else '/'+start_path}"
    try:
        webbrowser.open(url)
    except Exception:
        pass

    # Production-ready WSGI server
    serve(app, host=host, port=port)