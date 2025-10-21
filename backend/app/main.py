# backend/app/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from app.core.config import settings
from app.core.logging import init_logging
from app.routes import health, auth

def create_app() -> FastAPI:
    init_logging(settings.LOG_LEVEL)
    app = FastAPI(title="ribooster-min", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ALLOW_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router, tags=["health"])
    app.include_router(auth.router, prefix="/auth", tags=["auth"])

    @app.exception_handler(Exception)
    async def unhandled_error(request: Request, exc: Exception):
        logging.exception("Unhandled server error on %s %s", request.method, request.url)
        return JSONResponse(status_code=500, content={"detail": "internal_error"})

    return app

app = create_app()
