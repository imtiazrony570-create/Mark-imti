from sqlalchemy import inspect
from app.db.base import engine, Base
from app.models import *
from app.core.config import get_settings

settings = get_settings()


def _seed_default_provider_and_model(db) -> None:
    """Seed all free-tier providers with sensible default models so the user
    only needs to paste their API keys in /ai."""
    from app.models.agent import ModelProviderConfig, ModelProvider
    from app.models.user import User
    from app.core.security import get_password_hash

    # Ensure there's at least one user (the master admin)
    admin = db.query(User).filter(User.email == "kevin.clientmanager@gmail.com").first()
    if not admin:
        admin = User(
            email="kevin.clientmanager@gmail.com",
            hashed_password=get_password_hash("Masteradmin"),
            full_name="Kevin Client Manager",
            is_active=True,
            is_superuser=True,
        )
        db.add(admin)
        db.flush()

    # All free-tier providers with sensible default models
    FREE_PROVIDERS = [
        # (provider, default_model, is_default, description)
        (ModelProvider.GROQ, "llama-3.3-70b-versatile", True,
         "Unlimited free, no card, fastest inference, great code/reasoning"),
        (ModelProvider.OPENROUTER, "google/gemini-2.5-flash:free", False,
         "Free :free models, one key for 100+ models"),
        (ModelProvider.NVIDIA, "meta/llama-3.3-70b-instruct", False,
         "Free tier, strong open models"),
        (ModelProvider.CEREBRAS, "llama-3.3-70b", False,
         "Free tier, very fast inference"),
        (ModelProvider.FIREWORKS, "accounts/fireworks/models/llama-v3p3-70b-instruct", False,
         "Free tier credits on signup"),
        (ModelProvider.HUGGINGFACE, "meta-llama/Llama-3.3-70B-Instruct", False,
         "Free tier, open models via router"),
    ]

    for provider, default_model, is_default, _desc in FREE_PROVIDERS:
        cfg = db.query(ModelProviderConfig).filter(
            ModelProviderConfig.user_id == admin.id,
            ModelProviderConfig.provider == provider,
        ).first()

        if not cfg:
            cfg = ModelProviderConfig(
                user_id=admin.id,
                provider=provider,
                is_default=is_default,
                config={"model": default_model},
            )
            db.add(cfg)
        else:
            cfg.is_default = is_default
            cfg.config = {"model": default_model}

    # Ensure user settings point to the primary default (Groq)
    from app.models.user_settings import UserSettings
    prefs = db.query(UserSettings).filter(UserSettings.user_id == admin.id).first()
    if not prefs:
        prefs = UserSettings(
            user_id=admin.id,
            default_model="llama-3.3-70b-versatile",
            default_provider="GROQ",
        )
        db.add(prefs)
    else:
        prefs.default_model = "llama-3.3-70b-versatile"
        prefs.default_provider = "GROQ"

    db.commit()


def init_db() -> None:
    """Initialize database tables (creates any missing ones, keeps existing data)."""
    # create_all with checkfirst=True only adds missing tables — safe on existing DBs
    Base.metadata.create_all(bind=engine, checkfirst=True)
    print("Database tables ensured successfully!")
    # The Imti/Mark agent roster is product data, not user data: seed it on every
    # boot so the Agents page always shows the real crew instead of an empty list.
    try:
        from app.db.base import SessionLocal
        from app.services.agent_roster import ensure_roster
        db = SessionLocal()
        try:
            created = ensure_roster(db)
            if created:
                print(f"Agent roster ensured ({created} new agent(s))!")
            _seed_default_provider_and_model(db)
            print("Default providers seeded: Groq (default), OpenRouter, NVIDIA, Cerebras, Fireworks, Hugging Face.")
        finally:
            db.close()
    except Exception as exc:  # never block startup on seeding
        print(f"Seed skipped: {type(exc).__name__}: {exc}")


def drop_db() -> None:
    """Drop all database tables."""
    print("Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    print("Database tables dropped!")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "drop":
        drop_db()
    else:
        init_db()