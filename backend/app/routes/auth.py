# backend/app/routes/auth.py
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.core.config import settings
from app.core.security import create_admin_token
import logging

router = APIRouter()

class LoginRequest(BaseModel):
    access_code: str
    username: str
    password: str

def _do_admin_login(access_code: str, username: str, password: str) -> dict:
    if (access_code or "").lower() != (settings.ADMIN_ACCESS_CODE or "admin").lower():
        raise HTTPException(status_code=403, detail="Invalid access code")
    if settings.ADMIN_USER_MAP.get(username) != password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_admin_token(username)
    return {
        "token": token,
        "is_admin": True,
        "username": username,
        "display_name": username,
        "org_id": None,
        "org_name": None,
    }

@router.post("/login")
def login(body: LoginRequest):
    logging.info("POST /auth/login for user=%s", body.username)
    return _do_admin_login(body.access_code, body.username, body.password)

# Plain query variant for quick testing from shells/browsers (no JSON parsing involved)
@router.get("/login-plain")
def login_plain(
    access_code: str = Query(...),
    username: str = Query(...),
    password: str = Query(...),
):
    logging.info("GET /auth/login-plain for user=%s", username)
    return _do_admin_login(access_code, username, password)
