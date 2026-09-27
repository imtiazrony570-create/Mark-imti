"""
Mark-Imti Configuration — NO .env FILE REQUIRED.
All config is managed through the Settings UI in the app.
Defaults work out of the box. API keys stored encrypted in credential_vault.

Every field accepts both the plain name (DATABASE_URL) and the legacy
MARK_IMTI_-prefixed name (MARK_IMTI_DATABASE_URL). Plain names come first so a
value set on a hosting platform always wins over the prefix.
"""
from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings
from typing import Optional
import secrets
import os


def _both(name: str) -> AliasChoices:
    return AliasChoices(name, f"MARK_IMTI_{name}")


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Mark-Imti"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    # API
    API_V1_PREFIX: str = "/api/v1"

    # Security
    # No random default: a per-boot random key invalidates every JWT and every
    # encrypted credential on restart, which looks like data loss.
    SECRET_KEY: str = Field(default="", validation_alias=_both("SECRET_KEY"))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = Field(
        default="sqlite:///./mark_imti.db", validation_alias=_both("DATABASE_URL")
    )

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    CORS_ORIGIN_REGEX: Optional[str] = Field(
        default=r"https://.*\.(onrender\.com|vercel\.app|pages\.dev)",
        validation_alias=_both("CORS_ORIGIN_REGEX"),
    )
    FRONTEND_URL: Optional[str] = Field(default=None, validation_alias=_both("FRONTEND_URL"))

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
        # No env_prefix either: hosting platforms (Render, Fly, HF Spaces,
        # Cloudflare) set plain names like DATABASE_URL, and a prefix silently
        # ignores them, which previously left the app on local SQLite even
        # though a Postgres URL had been configured. MARK_IMTI_* stays honoured
        # per-field through validation_alias.
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    s = Settings()
    # A stable per-installation key, so restarts do not invalidate sessions.
    # Set SECRET_KEY explicitly in production and it is used verbatim.
    if not s.SECRET_KEY:
        path = os.path.join(s.MARK_IMTI_DATA or ".", ".secret_key")
        try:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as fh:
                    s.SECRET_KEY = fh.read().strip()
            if not s.SECRET_KEY:
                s.SECRET_KEY = secrets.token_urlsafe(48)
                os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(s.SECRET_KEY)
        except OSError:
            # Read-only filesystem: keep the ephemeral key rather than crash.
            pass
    return s
