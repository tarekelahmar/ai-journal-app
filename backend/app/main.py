"""
Journal App — FastAPI entry point.

Standalone wellness journal: chat, patterns, life domains, milestones, sparkline.
No biomarker / wearable dependencies.
"""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import logging
from dotenv import load_dotenv

load_dotenv(override=True)

from app.config.settings import get_settings
from app.config.rate_limiting import setup_rate_limiting
from app.core.database import init_db
from app.core.logging import configure_logging, get_logger
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.metrics import MetricsMiddleware

# Journal routers (all use make_v1_router with prefix baked in, except auth)
from app.api.v1.checkins import router as checkins_router
from app.api.v1.journal import router as journal_router
from app.api.v1.journal_chat import router as journal_chat_router
from app.api.v1.life_domains import router as life_domains_router
from app.api.v1.milestones import router as milestones_router
from app.api.v1.domain_checkins import router as domain_checkins_router
from app.api.v1.preferences import router as preferences_router
from app.api.v1.audit import router as audit_router
from app.api.v1 import auth
from app.api.v1.users import router as users_router
from app.api.v1.actions import router as actions_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.system import router as system_router, public_router as system_public_router
from app.api.v1.auth_mode import auth_mode_router

settings = get_settings()

configure_logging()
log = get_logger(__name__)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    from app.config.environment import get_env_mode, get_mode_config
    from app.api.auth_mode import get_auth_mode

    env_mode = get_env_mode()
    config = get_mode_config()
    auth_mode = get_auth_mode()

    logger.info(f"Environment mode: {env_mode.value}")
    logger.info(f"Auth mode: {auth_mode}")

    # Fail hard if production is misconfigured
    if env_mode.value == "production" and auth_mode != "private":
        error_msg = f"CRITICAL: Production mode requires AUTH_MODE=private, got {auth_mode}"
        logger.critical(error_msg)
        raise ValueError(error_msg)

    init_db()
    logger.info("Database ready")

    yield

    logger.info(f"Shutting down {settings.APP_NAME}...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered wellness journal — chat, patterns, life domains",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(RequestIdMiddleware)
app.add_middleware(MetricsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_CREDENTIALS,
    allow_methods=settings.CORS_METHODS,
    allow_headers=settings.CORS_HEADERS,
)

if settings.ENABLE_RATE_LIMITING:
    app = setup_rate_limiting(app)
    logger.info("Rate limiting enabled")

# ── Routers ──────────────────────────────────────────────────────────────────
# Most use make_v1_router() with prefix already set; just include directly.
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users_router)
app.include_router(checkins_router)
app.include_router(journal_router)
app.include_router(journal_chat_router)
app.include_router(life_domains_router)
app.include_router(milestones_router)
app.include_router(domain_checkins_router)
app.include_router(actions_router)
app.include_router(analytics_router)
app.include_router(preferences_router)
app.include_router(audit_router)
app.include_router(system_router)
app.include_router(system_public_router)
app.include_router(auth_mode_router)


# ── Root & health ────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "message": "Journal App API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "debug": settings.DEBUG, "database": "connected"}


# ── Error handlers ───────────────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation error",
            "detail": exc.errors() if settings.DEBUG else "Invalid request data",
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {exc}",
        exc_info=True,
        extra={"path": request.url.path, "method": request.method},
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An error occurred",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
