from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.config import settings
from app.core.security import create_admin_token

router = APIRouter()

class LoginRequest(BaseModel):
    access_code: str
    username: str
    password: str

@router.post("/login")
def login(body: LoginRequest):
    # admin-only minimal flow
    if (body.access_code or "").lower() != (settings.ADMIN_ACCESS_CODE or "admin").lower():
        raise HTTPException(status_code=403, detail="Invalid access code")
    if settings.ADMIN_USER_MAP.get(body.username) != body.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_admin_token(body.username)
    return {
        "token": token,
        "is_admin": True,
        "username": body.username,
        "display_name": body.username,
        "org_id": None,
        "org_name": None
    }
