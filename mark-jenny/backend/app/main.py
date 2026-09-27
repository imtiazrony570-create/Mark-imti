from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import get_settings
from app.db.init_db import init_db
from app.api.v1.api import api_router

settings = get_settings()

_seed_done = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="MARK-IMTI - Autonomous AI Operating Platform",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
    lifespan=lifespan,
)

cors_origins = list(settings.CORS_ORIGINS)
if settings.FRONTEND_URL and settings.FRONTEND_URL not in cors_origins:
    cors_origins.append(settings.FRONTEND_URL.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.core.rate_limit import rate_limit_middleware
app.middleware("http")(rate_limit_middleware)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.middleware("http")
async def ensure_seeded_once(request, call_next):
    """Run init_db() on the first request if the lifespan hook never fired.

    Some ASGI servers skip the lifespan entirely, which previously left the
    database without tables and without the seeded agent roster. Runs at most
    once per process and never blocks the response on failure.
    """
    global _seed_done
    if not _seed_done:
        _seed_done = True
        try:
            init_db()
        except Exception as exc:  # seeding must never break requests
            print(f"init_db skipped: {type(exc).__name__}: {exc}")
    return await call_next(request)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
