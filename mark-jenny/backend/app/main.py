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
    print("=== STARTUP: lifespan started ===")
    init_db()
    print("=== STARTUP: init_db completed ===")
    yield
    print("=== SHUTDOWN ===")


# Fallback: explicit startup event in case lifespan isn't triggered
@app.on_event("startup")
async def startup_event():
    print("=== STARTUP: explicit startup event ===")
    init_db()
    print("=== STARTUP: explicit init_db completed ===")


# Fallback: lazy seed on first request (guaranteed to run)
@app.middleware("http")
async def ensure_seed(request, call_next):
    global _seed_done
    if not _seed_done:
        print("=== LAZY SEED: first request, running init_db ===")
        init_db()
        _seed_done = True
        print("=== LAZY SEED: completed ===")
    return await call_next(request)


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


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
