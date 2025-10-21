import time, jwt
from fastapi import Depends, Header, HTTPException, status
from app.core.config import settings

ALGO = "HS256"

def now() -> int: return int(time.time())

def create_admin_token(username: str) -> str:
    payload = {
        "sub": username,
        "is_admin": True,
        "iat": now(),
        "exp": now() + 7*24*3600,
    }
    return jwt.encode(payload, settings.API_SECRET, algorithm=ALGO)

def require_admin(Authorization: str | None = Header(None)) -> dict:
    if not Authorization or not Authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = Authorization.split()[1]
    try:
        data = jwt.decode(token, settings.API_SECRET, algorithms=[ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if not data.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return data
