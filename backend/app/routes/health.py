from fastapi import APIRouter
import os

router = APIRouter()

@router.get("/health")
def health():
    return {"ok": True, "env": os.getenv("APP_ENV", "unknown")}