from fastapi import FastAPI
from app.routes import health, auth

app = FastAPI(title="ribooster-backend")

app.include_router(health.router, prefix="", tags=["health"])
app.include_router(auth.router,   prefix="/auth", tags=["auth"])