# backend/app/main.py
"""
Application entrypoint for ribooster (production).
- FastAPI app at root (/), reverse-proxied as /api by the frontend container.
- Routers: /health, /auth, /admin, /analytics, /billing, /tickets
- CORS enabled from env
- DB auto-creates tables on startup (Alembic optional later)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import init_logging
from app.core.db import Base, engine
from app.middleware.activity import ActivityMiddleware

from app.routes import health, auth, admin, analytics, billing, tickets

def create_app() -> FastAPI:
    init_logging(settings.LOG_LEVEL)

    app = FastAPI(
        title="ribooster",
        version="1.0.0",
        description="Automation & add-ons hub on top of RIB 4.0 (Azure, prod).",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ALLOW_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

    # Activity/metrics
    app.add_middleware(ActivityMiddleware)

    # Routes
    app.include_router(health.router, tags=["health"])
    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(admin.router, prefix="/admin", tags=["admin"])
    app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
    app.include_router(billing.router, prefix="/billing", tags=["billing"])
    app.include_router(tickets.router, prefix="/tickets", tags=["tickets"])

    @app.on_event("startup")
    def on_startup() -> None:
        # Create tables if not existing; you can switch to Alembic later
        Base.metadata.create_all(bind=engine)

    return app

app = create_app()
