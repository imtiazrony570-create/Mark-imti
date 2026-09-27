"""Launcher:  python main.py   (or  python -m uvicorn app.main:app --port 8000)"""
import os
import sys
import uvicorn

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Re-export the ASGI app so this module is a valid entrypoint for any ASGI
# server or PaaS that auto-detects `main:app` (e.g. FastAPI Cloud). Running this
# file as a script still starts uvicorn via the __main__ block below.
from app.main import app  # noqa: E402,F401

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    # reload=True would fork a watcher in production, which breaks on every
    # container host (Fly, HF Spaces, Render). Enable it only for local dev.
    reload = os.environ.get("RELOAD", "0") == "1"
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=reload,
        log_level=os.environ.get("LOG_LEVEL", "info"),
    )