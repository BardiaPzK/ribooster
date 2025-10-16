# backend/app/core/security.py
"""
Simple bearer token sessions stored in DB.
Admin sessions are flagged with is_admin=True.
"""
from __future__ import annotations
import secrets, time
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.models.session import Session as SessionModel
from app.models.user import User
from app.core.config import settings

def create_session_token() -> str:
    return secrets.token_urlsafe(48)

def now() -> int:
    return int(time.time())

def save_session(db: Session, user: User, is_admin: bool) -> str:
    token = create_session_token()
    s = SessionModel(
        token=token,
        user_id=user.id,
        org_id=user.org_id,
        is_admin=is_admin,
        created_at=now(),
        expires_at=now() + settings.SESSION_TTL,
    )
    db.add(s)
    db.commit()
    return token

def _extract_bearer(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Authorization header")
    return parts[1].strip()

def require_session(Authorization: str | None = Header(None), db: Session = Depends(get_db)) -> SessionModel:
    token = _extract_bearer(Authorization)
    s = db.get(SessionModel, token)
    if not s:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    if s.expires_at and s.expires_at < now():
        db.delete(s)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return s

def require_admin_session(s: SessionModel = Depends(require_session)) -> SessionModel:
    if not s.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return s
