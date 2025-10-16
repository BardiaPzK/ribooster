# backend/app/routes/auth.py
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.core.db import get_db
from app.core.config import settings
from app.core.security import save_session
from app.schemas.auth import LoginRequest, LoginResponse
from app.models.user import User
from app.models.organization import Organization
from app.models.license import License

router = APIRouter()

def _now() -> int: return int(time.time())

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    access = (payload.access_code or "").strip()
    uname = (payload.username or "").strip()
    pw = payload.password or ""

    is_admin_code = access.lower() == (settings.ADMIN_ACCESS_CODE or "admin").lower()

    if is_admin_code:
        # Admin console login
        if uname not in settings.ADMIN_USER_MAP or settings.ADMIN_USER_MAP[uname] != pw:
            raise HTTPException(status_code=401, detail="Invalid admin credentials")
        # Upsert admin 'user' with org_id=None
        q = select(User).where(User.username == uname, User.org_id.is_(None))
        u = db.scalars(q).first()
        if not u:
            u = User(username=uname, display_name=uname, org_id=None, created_at=_now())
            db.add(u)
            db.commit()
            db.refresh(u)
        token = save_session(db, u, is_admin=True)
        return LoginResponse(
            token=token,
            org_id=None,
            org_name=None,
            username=uname,
            display_name=u.display_name,
            is_admin=True,
        )

    # Organization login by access_code (org_code)
    q = select(Organization).where(Organization.access_code == access)
    org = db.scalars(q).first()
    if not org or org.deactivated:
        raise HTTPException(status_code=403, detail="Organization access disabled or not found")

    lic = db.get(License, org.id)
    if not lic or not lic.active or lic.current_period_end < _now():
        raise HTTPException(status_code=402, detail="License inactive or expired")

    if not uname or not pw:
        raise HTTPException(status_code=400, detail="Missing credentials")

    # TODO: integrate with RIB auth and populate rib_role/rib_exp_ts.
    # For now we accept provided username/password and create a local user record.
    q = select(User).where(User.username == uname, User.org_id == org.id)
    u = db.scalars(q).first()
    if not u:
        u = User(username=uname, display_name=uname, org_id=org.id, created_at=_now())
        db.add(u)
        db.commit()
        db.refresh(u)

    token = save_session(db, u, is_admin=False)
    org.last_login_ts = _now()
    db.commit()

    return LoginResponse(
        token=token,
        org_id=org.id,
        org_name=org.name,
        username=u.username,
        display_name=u.display_name,
        is_admin=False,
        rib_exp_ts=None,
        rib_role=None,
    )
