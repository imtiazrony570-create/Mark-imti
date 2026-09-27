"""
Mark-Imti Configuration — NO .env FILE REQUIRED.
All config is managed through the Settings UI in the app.
Defaults work out of the box. API keys stored encrypted in credential_vault.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import Optional
import secrets
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Mark-Imti"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    # API
    API_V1_PREFIX: str = "/api/v1"

    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "sqlite:///./mark_imti.db"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    CORS_ORIGIN_REGEX: Optional[str] = r"https://.*\.(onrender\.com|vercel\.app|pages\.dev)"
    FRONTEND_URL: Optional[str] = None

    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 100 * 1024 * 1024  # 100MB

    # AI Models — cloud-first by default, with an explicit local/offline mode.
    DEFAULT_MODEL_PROVIDER: str = "openai"
    MODEL_RUNTIME_MODE: str = "cloud"  # cloud | local | hybrid
    CLOUD_MODEL_BASE_URL: Optional[str] = None  # OpenAI-compatible /v1 endpoint
    CLOUD_MODEL_API_KEY: Optional[str] = None
    CLOUD_MODEL_NAME: str = "gpt-4o-mini"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3:8b"
    LOCAL_MODEL_BASE_URL: Optional[str] = None  # Optional remote LAN Ollama/OpenAI endpoint
    LOCAL_MODEL_NAME: Optional[str] = None

    # Redis (optional, for multi-process/cloud)
    REDIS_URL: Optional[str] = None

    # Data directory for all app data (credentials, core laws, extensions, etc.)
    MARK_IMTI_DATA: str = os.environ.get("MARK_IMTI_DATA", ".")

    class Config:
        # NO env_file — all config through Settings UI, not .env files
        env_prefix = "MARK_IMTI_"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
