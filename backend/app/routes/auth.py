from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import os

router = APIRouter()

class LoginRequest(BaseModel):
    access_code: str
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

def _load_admin_users() -> dict[str, str]:
    """
    ADMIN_USERS format: "user1:pass1,user2:pass2"
    """
    raw = os.getenv("ADMIN_USERS", "") or ""
    pairs = [p.strip() for p in raw.split(",") if p.strip()]
    out: dict[str, str] = {}
    for pair in pairs:
        if ":" in pair:
            u, p = pair.split(":", 1)
            out[u.strip()] = p.strip()
    return out

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    # Access code guard
    expected_code = os.getenv("ADMIN_ACCESS_CODE", "")
    if not expected_code or body.access_code != expected_code:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access code")

    # Static admin users from env
    users = _load_admin_users()
    if body.username not in users or users[body.username] != body.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Return a simple token (no extra deps). Replace with JWT later if you like.
    return TokenResponse(access_token=f"admin:{body.username}")
