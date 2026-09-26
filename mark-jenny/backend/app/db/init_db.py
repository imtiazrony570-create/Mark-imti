from sqlalchemy import inspect
from app.db.base import engine, Base
from app.models import *
from app.core.config import get_settings

settings = get_settings()


def _seed_default_provider_and_model(db) -> None:
    """Ensure Together AI is the default provider with a vision model, so chat works
    out of the box once the user adds a free Together AI key."""
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

    # Upsert Together AI as the default provider for this user
    cfg = db.query(ModelProviderConfig).filter(
        ModelProviderConfig.user_id == admin.id,
        ModelProviderConfig.provider == ModelProvider.TOGETHER,
    ).first()

    if not cfg:
        cfg = ModelProviderConfig(
            user_id=admin.id,
            provider=ModelProvider.TOGETHER,
            is_default=True,
            config={"model": "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo"},
        )
        db.add(cfg)
    else:
        cfg.is_default = True
        cfg.config = {"model": "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo"}

    # Ensure user settings point to this as default
    from app.models.user_settings import UserSettings
    prefs = db.query(UserSettings).filter(UserSettings.user_id == admin.id).first()
    if not prefs:
        prefs = UserSettings(
            user_id=admin.id,
            default_model="meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
            default_provider="TOGETHER",
        )
        db.add(prefs)
    else:
        prefs.default_model = "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo"
        prefs.default_provider = "TOGETHER"

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
            print("Default provider/model seeded (Together AI + vision model).")
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