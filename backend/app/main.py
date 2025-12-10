# backend/app/main.py
"""
FastAPI entrypoint for ribooster.

Features:
- Admin login (companyCode = "Admin", credentials from env ADMIN_USERNAME/ADMIN_PASSWORD)
- Org / company management in DB (SQLite by default)
- Metrics per org (in memory)
- Org user login via RIB 4.0 (JWT)
- Tickets (user + admin), stored in DB
- AI Helpdesk (conversation + messages), stored in DB
- Simple RIB projects list + backup job records (DB)

Static frontend (Vite build) is served from /app.
"""

# ← no more "from __future__" here

import base64
import json
import os
import time
import uuid
from dataclasses import dataclass
from typing import Dict, Any, List, Optional, Literal

import requests
from fastapi import FastAPI, HTTPException, Depends, Header, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as SASession
from sqlalchemy import select

from .models import (
    License,
    Organization,
    Company,
    Session as SessionModel,
    RIBSession,
    MetricCounters,
    HelpdeskConversation,
    HelpdeskMessage,
)
from . import storage
from .rib_client import Auth, AuthCfg, auth_from_rib_session, ProjectApi
from .ai_helpdesk import run_helpdesk_completion
from .db import (
    get_db,
    init_db,
    DBOrganization,
    DBCompany,
    DBTicket,
    DBTicketMessage,
    DBHelpdeskConversation,
    DBHelpdeskMessage,
    DBBackupJob,
    DBPayment,
    DBUserLog,
    DBTextSqlLog,
    seed_default_org_company,
)







def _normalize_allowed_users(raw: Optional[str]) -> list[str]:
    """
    Take a comma-separated string or JSON list from the DB and normalize to
    lowercase usernames without empty entries.
    """
    if not raw:
        return []
    if isinstance(raw, str) and raw.strip().startswith("["):
        # Looks like JSON list
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                return [str(u).strip().lower() for u in data if str(u).strip()]
        except Exception:
            pass
    # fallback: comma separated
    return [u.strip().lower() for u in raw.split(",") if u.strip()]



# ---------------------------------------------------------
# FIX: Create the FastAPI app BEFORE any routes
# ---------------------------------------------------------

app = FastAPI(title="ribooster API", version="0.4.0")

# CORS
origins = [
    "http://localhost:5173",
    "https://ribooster-webapp.azurewebsites.net",
    "https://ribooster-webapp.azurewebsites.net/app",
    "https://app.ribooster.com",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# ROUTES CAN START NOW
# ---------------------------------------------------------

@app.get("/", include_in_schema=False)
async def root_redirect():
    return RedirectResponse(url="/app/")

@app.on_event("startup")
def _startup_event() -> None:
    init_db()
    from .db import SessionLocal
    db = SessionLocal()
    try:
        seed_default_org_company(db)
    finally:
        db.close()



# ───────────────────────── Static Frontend ─────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend-dist")

if os.path.isdir(FRONTEND_DIR):

    # Serve asset files
    app.mount(
        "/app/assets",
        StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")),
        name="assets",
    )

    # Serve index.html for all /app routes
    @app.get("/app", include_in_schema=False)
    @app.get("/app/", include_in_schema=False)
    @app.get("/app/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str = ""):
        index_file = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        return {"detail": "index.html not found"}


# ───────────────────────── Auth helpers ─────────────────────────

ADMIN_ACCESS_CODE = "Admin"
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

DEFAULT_SERVICE_FLAGS = {
    "projects.backup": True,
    "ai.helpdesk": True,
    "textsql": True,
}


class LoginRequest(BaseModel):
    company_code: str
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    is_admin: bool
    username: str
    display_name: str
    org_id: Optional[str] = None
    org_name: Optional[str] = None
    company_id: Optional[str] = None
    company_code: Optional[str] = None
    rib_exp_ts: Optional[int] = None
    rib_role: Optional[str] = None


def _jwt_payload(tok: str) -> Dict[str, Any]:
    try:
        parts = tok.split(".")
        if len(parts) < 2:
            return {}
        payload_b64 = parts[1]
        padding = (-len(payload_b64)) % 4
        if padding:
            payload_b64 += "=" * padding
        return json.loads(base64.urlsafe_b64decode(payload_b64.encode("ascii")).decode("utf-8"))
    except Exception:
        return {}


def _display_from_jwt(tok: str, fallback: str) -> str:
    pl = _jwt_payload(tok)
    for k in ("given_name", "name", "unique_name", "preferred_username", "email", "sub"):
        v = pl.get(k)
        if isinstance(v, str) and v.strip():
            if k == "name" and " " in v:
                return v.split(" ")[0].strip()
            return v.strip()
    return fallback


@dataclass
class SessionCtx:
    token: str
    user_id: str
    username: str
    display_name: str
    is_admin: bool
    org_id: Optional[str] = None
    company_id: Optional[str] = None


def _session_from_token(token: str) -> SessionCtx:
    s = storage.get_session(token)
    if not s:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    now = int(time.time())
    if s.expires_at and s.expires_at < now:
        storage.delete_session(token)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    # Sliding refresh: extend session validity for active users.
    # This keeps admins/org users logged in while they actively use the app,
    # and naturally expires stale sessions after the configured TTL.
    ttl = 8 * 3600
    refresh_threshold = 20 * 60  # refresh if less than 20 minutes remaining
    remaining = s.expires_at - now if s.expires_at else ttl
    if remaining < refresh_threshold:
        s.expires_at = now + ttl
        storage.save_session(s)

    return SessionCtx(
        token=s.token,
        user_id=s.user_id,
        username=s.username,
        display_name=s.display_name,
        is_admin=s.is_admin,
        org_id=s.org_id,
        company_id=s.company_id,
    )


def require_session(Authorization: Optional[str] = Header(None)) -> SessionCtx:
    if not Authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")
    parts = Authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Authorization header")
    token = parts[1]
    return _session_from_token(token)


def require_admin(ctx: SessionCtx = Depends(require_session)) -> SessionCtx:
    if not ctx.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return ctx


def require_org_user(ctx: SessionCtx = Depends(require_session)) -> SessionCtx:
    if ctx.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Org user required")
    if not ctx.org_id or not ctx.company_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing org/company on session")
    return ctx


# ───────────────────────── DB ↔ Pydantic helpers ─────────────────────────

def _org_from_db(o: DBOrganization) -> Organization:
    # Always start from the default feature set so missing keys stay enabled
    # unless they are explicitly disabled at the org level. This keeps per-company
    # feature toggles authoritative while preventing accidental org-level blocks
    # when the JSON column is empty.
    feats: Dict[str, bool] = dict(DEFAULT_SERVICE_FLAGS)
    if o.features_json:
        try:
            feats.update(json.loads(o.features_json))
        except Exception:
            feats = dict(DEFAULT_SERVICE_FLAGS)
    lic = License(
        plan=o.license_plan or "monthly",
        active=bool(o.license_active),
        current_period_end=o.license_current_period_end,
    )
    return Organization(
        org_id=o.org_id,
        name=o.name,
        contact_email=o.contact_email,
        contact_phone=o.contact_phone,
        notes=o.notes,
        license=lic,
        features=feats,
    )


def _company_from_db(db_company: DBCompany) -> Company:
    allowed_users: list[str] = []
    raw = db_company.allowed_users_json

    if raw:
        try:
            data = json.loads(raw)
            if isinstance(data, list):
                allowed_users = [str(u).strip().lower() for u in data if str(u).strip()]
        except Exception:
            allowed_users = _normalize_allowed_users(raw)

    company_id = getattr(db_company, "company_id", None) or getattr(db_company, "id", None)

    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Company record missing primary key",
        )

    features: Dict[str, bool] = dict(DEFAULT_SERVICE_FLAGS)
    raw_features = getattr(db_company, "features_json", None)

    if isinstance(raw_features, dict):
        features = {**features, **raw_features}
    elif isinstance(raw_features, str) and raw_features.strip():
        try:
            parsed = json.loads(raw_features)
        except Exception:
            parsed = {}

        if isinstance(parsed, dict):
            features = {**features, **parsed}

    # Build license from company-level fields; auto-disable if expired
    now = int(time.time())
    plan = getattr(db_company, "license_plan", None) or "trial"
    active = getattr(db_company, "license_active", True)
    current_period_end = getattr(db_company, "license_current_period_end", None)
    if not current_period_end:
        current_period_end = _license_end(plan, now)
    if current_period_end and current_period_end < now:
        active = False
    license = License(plan=plan, active=bool(active), current_period_end=current_period_end)

    return Company(
        company_id=str(company_id),
        org_id=str(db_company.org_id),
        name=db_company.name,
        code=db_company.code,
        base_url=db_company.base_url,
        rib_company_code=db_company.rib_company_code,
        allowed_users=allowed_users,
        license=license,
        ai_api_key=db_company.ai_api_key,
        features=features,
    )


def _username_from_user_id(uid: str) -> str:
    if not uid:
        return ""
    parts = str(uid).split(":")
    return parts[-1] if parts else uid


def _license_end(plan: str, start_ts: int) -> int:
    if plan == "yearly":
        return start_ts + 365 * 24 * 3600
    if plan == "monthly":
        return start_ts + 30 * 24 * 3600
    # trial default 14 days
    return start_ts + 14 * 24 * 3600


def _payment_from_db(p: DBPayment) -> "PaymentOut":
    return PaymentOut(
        id=p.id,
        org_id=p.org_id,
        company_id=getattr(p, "company_id", None),
        created_at=p.created_at,
        currency=p.currency,
        amount_cents=p.amount_cents,
        description=p.description,
        period_start=p.period_start,
        period_end=p.period_end,
        external_id=p.external_id,
    )


def _backup_from_db(b: DBBackupJob) -> "BackupJobOut":
    log = []
    options = {}
    if b.log_json:
        try:
            log = json.loads(b.log_json)
        except Exception:
            log = []
    if b.options_json:
        try:
            options = json.loads(b.options_json)
        except Exception:
            options = {}
    return BackupJobOut(
        job_id=b.job_id,
        org_id=b.org_id,
        company_id=b.company_id,
        user_id=b.user_id,
        project_id=b.project_id,
        project_name=b.project_name,
        status=b.status,
        created_at=b.created_at,
        updated_at=b.updated_at,
        log=log,
        options=options,
    )


def _get_org_company_by_code(db: SASession, code: str):
    stmt = (
        select(DBOrganization, DBCompany)
        .join(DBCompany, DBCompany.org_id == DBOrganization.org_id)
        .where(DBCompany.code == code)  # << FIX HERE
    )
    row = db.execute(stmt).first()
    if not row:
        raise HTTPException(404, "Unknown company code")
    return row[0], row[1]



def _ensure_feature(ctx: SessionCtx, feature_key: str, db: SASession) -> None:
    if not ctx.org_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Org missing")
    company_features: Dict[str, bool] = {}
    comp = None
    if ctx.company_id:
        comp = db.query(DBCompany).filter(DBCompany.company_id == ctx.company_id).first()
        if comp and getattr(comp, "features_json", None):
            try:
                company_features = json.loads(comp.features_json) or {}
            except Exception:
                company_features = {}
        if company_features and not company_features.get(feature_key, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Feature not enabled for company",
            )
    if not comp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company not found")

    # License check at company level
    now = int(time.time())
    license_active = getattr(comp, "license_active", True)
    license_end = getattr(comp, "license_current_period_end", None)
    if license_end and license_end < now:
        license_active = False
        comp.license_active = False
        db.commit()
    if not license_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company code license inactive",
        )

    # org feature flags still apply
    org = db.query(DBOrganization).filter(DBOrganization.org_id == ctx.org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Org not found")
    feats: Dict[str, bool] = dict(DEFAULT_SERVICE_FLAGS)
    if org.features_json:
        try:
            feats.update(json.loads(org.features_json))
        except Exception:
            feats = dict(DEFAULT_SERVICE_FLAGS)
    if not feats.get(feature_key, False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Feature not enabled for org",
        )


# ───────────────────────── Health ─────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "time": int(time.time())}


# ───────────────────────── Auth / Login ─────────────────────────

@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: SASession = Depends(get_db)):
    company_code = payload.company_code.strip()
    username = payload.username.strip()
    password = payload.password

    if not company_code or not username or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing fields")

    now = int(time.time())

    # ─── Admin login ───────────────────────────────────────
    if company_code.lower() == ADMIN_ACCESS_CODE.lower():
        if not ADMIN_USERNAME or not ADMIN_PASSWORD:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Admin credentials not configured",
            )
        if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

        sess = SessionModel(
            token=uuid.uuid4().hex + uuid.uuid4().hex,
            user_id=f"admin:{username}",
            username=username,
            display_name="ribooster admin",
            is_admin=True,
            org_id=None,
            company_id=None,
            created_at=now,
            expires_at=now + 8 * 3600,
            rib_session=None,
        )
        storage.save_session(sess)
        return LoginResponse(
            token=sess.token,
            is_admin=True,
            username=username,
            display_name="ribooster admin",
        )

    # ─── Org user login via RIB ────────────────────────────
    org_row, company_row = _get_org_company_by_code(db, company_code)
    org = _org_from_db(org_row)
    company = _company_from_db(company_row)

    # optional allowed users check
    if company.allowed_users:
        allowed = [u.lower() for u in company.allowed_users]
        if username.lower() not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not allowed for this company code",
            )

    # Company-level license check
    comp_row = db.query(DBCompany).filter(DBCompany.company_id == company.company_id).first()
    lic_plan = getattr(comp_row, "license_plan", "trial")
    lic_active = getattr(comp_row, "license_active", True)
    lic_end = getattr(comp_row, "license_current_period_end", None)
    if lic_end and lic_end < now:
        lic_active = False
        comp_row.license_active = False
        db.commit()
    if not lic_active or (lic_end and lic_end < now):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="License inactive or expired")



    def _rib_login_error(exc: Exception) -> None:
        """Map any RIB auth failure to a concise, professional message."""

        text = ""
        if isinstance(exc, requests.HTTPError) and exc.response is not None:
            try:
                text = exc.response.text or ""
            except Exception:
                text = ""
        else:
            text = str(exc) or ""

        lowered = text.lower()
        if "invalid_grant" in lowered or "invalid username" in lowered or "invalid password" in lowered:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="RIB login failed: Invalid username/password. Please try again.",
            ) from exc

        if "scheduled environment access notice" in lowered:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "RIB login failed: The target RIB 4.0 environment is currently "
                    "not available outside its scheduled access window. "
                    "Please try again later or contact your RIB implementation manager."
                ),
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "RIB login failed: We couldn't sign you in to the RIB server right now. "
                "Please verify your credentials and try again, or contact support if the issue persists."
            ),
        ) from exc

    # RIB login
    auth = Auth(AuthCfg(host=company.base_url, company=company.rib_company_code))
    try:
        rib_sess = auth.login(username, password)
    except Exception as e:
        _rib_login_error(e)

    display_name = _display_from_jwt(rib_sess.access_token, username)

    backend_sess = SessionModel(
        token=uuid.uuid4().hex + uuid.uuid4().hex,
        user_id=f"{org.org_id}:{username}",
        username=username,
        display_name=display_name,
        is_admin=False,
        org_id=org.org_id,
        company_id=company.company_id,
        created_at=now,
        expires_at=now + 8 * 3600,
        rib_session=RIBSession(
            access_token=rib_sess.access_token,
            exp_ts=rib_sess.exp_ts,
            secure_client_role=rib_sess.secure_client_role,
            host=company.base_url,
            company_code=company.rib_company_code,
            username=username,
        ),
    )
    storage.save_session(backend_sess)
    storage.record_request(org.org_id, "auth.login")

    return LoginResponse(
        token=backend_sess.token,
        is_admin=False,
        username=username,
        display_name=display_name,
        org_id=org.org_id,
        org_name=org.name,
        company_id=company.company_id,
        company_code=company.code,
        rib_exp_ts=rib_sess.exp_ts,
        rib_role=rib_sess.secure_client_role,
    )


@app.get("/api/auth/me")
def me(ctx: SessionCtx = Depends(require_session)):
    return {
        "token": ctx.token,
        "user_id": ctx.user_id,
        "username": ctx.username,
        "display_name": ctx.display_name,
        "is_admin": ctx.is_admin,
        "org_id": ctx.org_id,
        "company_id": ctx.company_id,
    }


@app.post("/api/auth/logout")
def logout(ctx: SessionCtx = Depends(require_session)):
    storage.delete_session(ctx.token)
    return {"ok": True}


# ───────────────────────── User context ─────────────────────────

class UserContext(BaseModel):
    org: Organization
    company: Company


@app.get("/api/user/context", response_model=UserContext)
def user_context(ctx: SessionCtx = Depends(require_org_user), db: SASession = Depends(get_db)):
    if not ctx.org_id or not ctx.company_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing org/company on session")
    o = db.query(DBOrganization).filter(DBOrganization.org_id == ctx.org_id).first()
    c = db.query(DBCompany).filter(DBCompany.company_id == ctx.company_id).first()
    if not o or not c:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Org or company not found")
    return UserContext(org=_org_from_db(o), company=_company_from_db(c))


# ───────────────────────── Admin: Orgs & Companies ─────────────────────────

class OrgListItem(BaseModel):
    org: Organization
    company: Optional[Company] = None
    companies: List[Company] = Field(default_factory=list)
    metrics: Optional[MetricCounters] = None


class AdminCreateOrgRequest(BaseModel):
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    base_url: str
    rib_company_code: str
    company_code: str
    allowed_users: List[str] = Field(default_factory=list)
    company_plan: Literal["trial", "monthly", "yearly"] = "trial"
    company_current_period_end: Optional[int] = None
    company_active: bool = True


class AdminUpdateOrgRequest(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    features: Optional[Dict[str, bool]] = None


class AdminUpdateCompanyRequest(BaseModel):
    base_url: Optional[str] = None
    rib_company_code: Optional[str] = None
    company_code: Optional[str] = None
    allowed_users: Optional[List[str]] = None
    ai_api_key: Optional[str] = None
    features: Optional[Dict[str, bool]] = None
    plan: Optional[Literal["trial", "monthly", "yearly"]] = None
    active: Optional[bool] = None
    current_period_end: Optional[int] = None


class AdminCreateCompanyRequest(BaseModel):
    base_url: str
    rib_company_code: str
    company_code: str
    allowed_users: List[str] = Field(default_factory=list)
    ai_api_key: Optional[str] = None
    features: Dict[str, bool] = Field(default_factory=lambda: dict(DEFAULT_SERVICE_FLAGS))
    plan: Literal["trial", "monthly", "yearly"] = "trial"
    current_period_end: Optional[int] = None
    active: bool = True


class AdminPaymentRequest(BaseModel):
    payment_date: int  # epoch seconds
    plan: Literal["monthly", "yearly"] = "monthly"
    amount_cents: int = 0
    currency: str = "EUR"
    description: Optional[str] = None


@app.get("/api/admin/orgs", response_model=List[OrgListItem])
def admin_list_orgs(ctx: SessionCtx = Depends(require_admin), db: SASession = Depends(get_db)):
    out: List[OrgListItem] = []
    org_rows = db.query(DBOrganization).all()

    for org_row in org_rows:
        companies = (
            db.query(DBCompany)
            .filter(DBCompany.org_id == org_row.org_id)
            .order_by(DBCompany.code)
            .all()
        )
        org = _org_from_db(org_row)
        comps = [_company_from_db(c) for c in companies]
        metrics = storage.get_metrics(org.org_id)
        out.append(
            OrgListItem(
                org=org,
                company=comps[0] if comps else None,
                companies=comps,
                metrics=metrics,
            )
        )
    return out


@app.post("/api/admin/orgs", response_model=OrgListItem)
def admin_create_org(
    payload: AdminCreateOrgRequest,
    ctx: SessionCtx = Depends(require_admin),
    db: SASession = Depends(get_db),
):
    now = int(time.time())
    org_id = f"org_{uuid.uuid4().hex[:10]}"
    company_id = f"comp_{uuid.uuid4().hex[:10]}"

    # default features
    features = dict(DEFAULT_SERVICE_FLAGS)

    o = DBOrganization(
        org_id=org_id,
        name=payload.name,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        notes=payload.notes,
        license_plan="yearly",
        license_active=True,
        license_current_period_end=now + 365 * 24 * 3600,
        features_json=json.dumps(features),
    )

    plan = payload.company_plan or "trial"
    default_end = _license_end(plan, payload.company_current_period_end or now)

    allowed = payload.allowed_users or []
    c = DBCompany(
        company_id=company_id,
        org_id=org_id,
        name=payload.company_code,
        code=payload.company_code,
        base_url=payload.base_url,
        rib_company_code=payload.rib_company_code,
        allowed_users_json=json.dumps(allowed),
        ai_api_key=None,
        features_json=json.dumps(features),
        license_plan=plan,
        license_active=payload.company_active,
        license_current_period_end=default_end,
    )

    db.add(o)
    db.add(c)
    db.commit()
    db.refresh(o)
    db.refresh(c)

    org = _org_from_db(o)
    company = _company_from_db(c)
    metrics = storage.get_metrics(org.org_id)
    return OrgListItem(org=org, company=company, companies=[company], metrics=metrics)


@app.post("/api/admin/orgs/{org_id}/companies", response_model=Company)
def admin_create_company(
    org_id: str,
    payload: AdminCreateCompanyRequest,
    ctx: SessionCtx = Depends(require_admin),
    db: SASession = Depends(get_db),
):
    org = db.query(DBOrganization).filter(DBOrganization.org_id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Org not found")

    now = int(time.time())
    company_id = f"comp_{uuid.uuid4().hex[:10]}"
    plan = payload.plan or "trial"
    end_ts = payload.current_period_end or _license_end(plan, now)
    c = DBCompany(
        company_id=company_id,
        org_id=org_id,
        name=payload.company_code,
        code=payload.company_code,
        base_url=payload.base_url,
        rib_company_code=payload.rib_company_code,
        allowed_users_json=json.dumps(payload.allowed_users or []),
        ai_api_key=payload.ai_api_key,
        features_json=json.dumps(payload.features or DEFAULT_SERVICE_FLAGS),
        license_plan=plan,
        license_active=payload.active,
        license_current_period_end=end_ts,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _company_from_db(c)


@app.put("/api/admin/orgs/{org_id}", response_model=Organization)
def admin_update_org(
    org_id: str,
    payload: AdminUpdateOrgRequest,
    ctx: SessionCtx = Depends(require_admin),
    db: SASession = Depends(get_db),
):
    o = db.query(DBOrganization).filter(DBOrganization.org_id == org_id).first()
    if not o:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Org not found")

    if payload.name is not None:
        o.name = payload.name
    if payload.contact_email is not None:
        o.contact_email = payload.contact_email
    if payload.contact_phone is not None:
        o.contact_phone = payload.contact_phone
    if payload.notes is not None:
        o.notes = payload.notes
    if payload.features is not None:
        existing: Dict[str, bool] = {}
        if o.features_json:
            try:
                existing = json.loads(o.features_json)
            except Exception:
                existing = {}
        existing.update(payload.features)
        o.features_json = json.dumps(existing)

    db.commit()
    db.refresh(o)
    return _org_from_db(o)


@app.put("/api/admin/companies/{company_id}", response_model=Company)
def admin_update_company(
    company_id: str,
    payload: AdminUpdateCompanyRequest,
    ctx: SessionCtx = Depends(require_admin),
    db: SASession = Depends(get_db),
):
    c = db.query(DBCompany).filter(DBCompany.company_id == company_id).first()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    if payload.base_url is not None:
        c.base_url = payload.base_url
    if payload.rib_company_code is not None:
        c.rib_company_code = payload.rib_company_code
    if payload.company_code is not None:
        c.code = payload.company_code
        c.name = payload.company_code
    if payload.allowed_users is not None:
        c.allowed_users_json = json.dumps(payload.allowed_users)
    if payload.ai_api_key is not None:
        c.ai_api_key = payload.ai_api_key
    if payload.features is not None:
        existing: Dict[str, bool] = {}
        if getattr(c, "features_json", None):
            try:
                existing = json.loads(c.features_json)
            except Exception:
                existing = {}
        existing.update(payload.features)
        c.features_json = json.dumps(existing)
    if payload.plan is not None:
        c.license_plan = payload.plan
    if payload.active is not None:
        c.license_active = payload.active
    if payload.current_period_end is not None:
        c.license_current_period_end = payload.current_period_end

    db.commit()
    db.refresh(c)
    return _company_from_db(c)


@app.get("/api/admin/companies/{company_id}/payments", response_model=List[PaymentOut])
def admin_list_payments(
    company_id: str,
    ctx: SessionCtx = Depends(require_admin),
    db: SASession = Depends(get_db),
):
    payments = db.query(DBPayment).filter(DBPayment.company_id == company_id).order_by(DBPayment.created_at.desc()).all()
    return [_payment_from_db(p) for p in payments]


@app.post("/api/admin/companies/{company_id}/payments", response_model=PaymentOut)
def admin_create_payment(
    company_id: str,
    payload: AdminPaymentRequest,
    ctx: SessionCtx = Depends(require_admin),
    db: SASession = Depends(get_db),
):
    comp = db.query(DBCompany).filter(DBCompany.company_id == company_id).first()
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    start = payload.payment_date
    end = _license_end(payload.plan, start)
    pay = DBPayment(
        org_id=comp.org_id,
        company_id=company_id,
        created_at=int(time.time()),
        currency=payload.currency,
        amount_cents=payload.amount_cents,
        description=payload.description,
        period_start=start,
        period_end=end,
        external_id=None,
    )
    comp.license_plan = payload.plan
    comp.license_active = True
    comp.license_current_period_end = end

    db.add(pay)
    db.commit()
    db.refresh(pay)
    return _payment_from_db(pay)


# ───────────────────────── Admin: Metrics ─────────────────────────

class MetricsOverviewItem(BaseModel):
    org_id: str
    org_name: str
    total_requests: int
    total_rib_calls: int
    by_feature: Dict[str, int]


@app.get("/api/admin/metrics/overview", response_model=List[MetricsOverviewItem])
def admin_metrics_overview(ctx: SessionCtx = Depends(require_admin), db: SASession = Depends(get_db)):
    org_rows = db.query(DBOrganization).all()
    out: List[MetricsOverviewItem] = []
    for o in org_rows:
        org = _org_from_db(o)
        mc = storage.get_metrics(org.org_id)
        out.append(
            MetricsOverviewItem(
                org_id=org.org_id,
                org_name=org.name,
                total_requests=mc.total_requests,
                total_rib_calls=mc.total_rib_calls,
                by_feature=mc.per_feature,
            )
        )
    out.sort(key=lambda x: x.total_requests, reverse=True)
    return out


# ───────────────────────── Tickets (User + Admin) ─────────────────────────

class CreateTicketRequest(BaseModel):
    subject: str
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    text: str


class TicketMessageOut(BaseModel):
    message_id: str
    timestamp: int
    sender: str
    text: str


class TicketOut(BaseModel):
    ticket_id: str
    org_id: str
    company_id: str
    user_id: str
    org_name: Optional[str] = None
    company_code: Optional[str] = None
    username: Optional[str] = None
    subject: str
    priority: str
    status: str
    created_at: int
    updated_at: int
    messages: List[TicketMessageOut]


class TicketListItem(BaseModel):
    ticket_id: str
    subject: str
    priority: str
    status: str
    created_at: int
    updated_at: int


class PaymentOut(BaseModel):
    id: int
    org_id: str
    company_id: Optional[str] = None
    created_at: int
    currency: str
    amount_cents: int
    description: Optional[str] = None
    period_start: Optional[int] = None
    period_end: Optional[int] = None
    external_id: Optional[str] = None


@app.get("/api/user/tickets", response_model=List[TicketListItem])
def user_list_tickets(ctx: SessionCtx = Depends(require_org_user), db: SASession = Depends(get_db)):
    rows = (
        db.query(DBTicket)
        .filter(DBTicket.org_id == ctx.org_id, DBTicket.user_id == ctx.user_id)
        .order_by(DBTicket.updated_at.desc())
        .all()
    )
    items: List[TicketListItem] = []
    for t in rows:
        items.append(
            TicketListItem(
                ticket_id=t.ticket_id,
                subject=t.subject,
                priority=t.priority,
                status=t.status,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
        )
    return items


@app.post("/api/user/tickets", response_model=TicketOut)
def user_create_ticket(
    payload: CreateTicketRequest,
    ctx: SessionCtx = Depends(require_org_user),
    db: SASession = Depends(get_db),
):
    now = int(time.time())
    ticket_id = f"t_{uuid.uuid4().hex[:10]}"
    msg_id = f"m_{uuid.uuid4().hex[:10]}"

    t = DBTicket(
        ticket_id=ticket_id,
        org_id=ctx.org_id,
        company_id=ctx.company_id,
        user_id=ctx.user_id,
        subject=payload.subject,
        priority=payload.priority,
        status="open",
        created_at=now,
        updated_at=now,
    )
    m = DBTicketMessage(
        message_id=msg_id,
        ticket_id=ticket_id,
        timestamp=now,
        sender="user",
        text=payload.text,
    )
    db.add(t)
    db.add(m)
    db.commit()
    db.refresh(t)

    storage.record_request(ctx.org_id, "tickets.create")

    return TicketOut(
        ticket_id=t.ticket_id,
        org_id=t.org_id,
        company_id=t.company_id,
        user_id=t.user_id,
        org_name=None,
        company_code=None,
        username=_username_from_user_id(t.user_id),
        subject=t.subject,
        priority=t.priority,
        status=t.status,
        created_at=t.created_at,
        updated_at=t.updated_at,
        messages=[
            TicketMessageOut(
                message_id=m.message_id,
                timestamp=m.timestamp,
                sender=m.sender,
                text=m.text,
            )
        ],
    )


@app.get("/api/user/tickets/{ticket_id}", response_model=TicketOut)
def user_get_ticket(ticket_id: str, ctx: SessionCtx = Depends(require_org_user), db: SASession = Depends(get_db)):
    t = (
        db.query(DBTicket)
        .filter(DBTicket.ticket_id == ticket_id, DBTicket.org_id == ctx.org_id, DBTicket.user_id == ctx.user_id)
        .first()
    )
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    msgs = (
        db.query(DBTicketMessage)
        .filter(DBTicketMessage.ticket_id == ticket_id)
        .order_by(DBTicketMessage.timestamp)
        .all()
    )
    return TicketOut(
        ticket_id=t.ticket_id,
        org_id=t.org_id,
        company_id=t.company_id,
        user_id=t.user_id,
        org_name=None,
        company_code=None,
        username=_username_from_user_id(t.user_id),
        subject=t.subject,
        priority=t.priority,
        status=t.status,
        created_at=t.created_at,
        updated_at=t.updated_at,
        messages=[
            TicketMessageOut(
                message_id=m.message_id,
                timestamp=m.timestamp,
                sender=m.sender,
                text=m.text,
            )
            for m in msgs
        ],
    )


class TicketReplyRequest(BaseModel):
    text: str


@app.post("/api/user/tickets/{ticket_id}/reply", response_model=TicketOut)
def user_reply_ticket(
    ticket_id: str,
    payload: TicketReplyRequest,
    ctx: SessionCtx = Depends(require_org_user),
    db: SASession = Depends(get_db),
):
    t = (
        db.query(DBTicket)
        .filter(DBTicket.ticket_id == ticket_id, DBTicket.org_id == ctx.org_id, DBTicket.user_id == ctx.user_id)
        .first()
    )
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    now = int(time.time())
    m = DBTicketMessage(
        message_id=f"m_{uuid.uuid4().hex[:10]}",
        ticket_id=ticket_id,
        timestamp=now,
        sender="user",
        text=payload.text,
    )
    t.updated_at = now
    db.add(m)
    db.commit()

    org_name = None
    company_code = None
    try:
        org_name = db.query(DBOrganization.name).filter(DBOrganization.org_id == t.org_id).scalar()
        company_code = db.query(DBCompany.code).filter(DBCompany.company_id == t.company_id).scalar()
    except Exception:
        pass

    msgs = (
        db.query(DBTicketMessage)
        .filter(DBTicketMessage.ticket_id == ticket_id)
        .order_by(DBTicketMessage.timestamp)
        .all()
    )

    storage.record_request(ctx.org_id, "tickets.reply")

    return TicketOut(
        ticket_id=t.ticket_id,
        org_id=t.org_id,
        company_id=t.company_id,
        user_id=t.user_id,
        org_name=None,
        company_code=None,
        username=_username_from_user_id(t.user_id),
        subject=t.subject,
        priority=t.priority,
        status=t.status,
        created_at=t.created_at,
        updated_at=t.updated_at,
        messages=[
            TicketMessageOut(
                message_id=mm.message_id,
                timestamp=mm.timestamp,
                sender=mm.sender,
                text=mm.text,
            )
            for mm in msgs
        ],
    )


class AdminTicketUpdateRequest(BaseModel):
    status: Optional[Literal["open", "in_progress", "done"]] = None
    priority: Optional[Literal["low", "normal", "high", "urgent"]] = None
    text: Optional[str] = None


@app.get("/api/admin/tickets", response_model=List[TicketOut])
def admin_list_tickets(ctx: SessionCtx = Depends(require_admin), db: SASession = Depends(get_db)):
    tickets = db.query(DBTicket).order_by(DBTicket.updated_at.desc()).all()
    # Preload org/company names for display
    org_map = {o.org_id: o.name for o in db.query(DBOrganization).all()}
    company_map = {c.company_id: c.code for c in db.query(DBCompany).all()}
    out: List[TicketOut] = []
    for t in tickets:
        msgs = (
            db.query(DBTicketMessage)
            .filter(DBTicketMessage.ticket_id == t.ticket_id)
            .order_by(DBTicketMessage.timestamp)
            .all()
        )
        out.append(
            TicketOut(
                ticket_id=t.ticket_id,
                org_id=t.org_id,
                company_id=t.company_id,
                user_id=t.user_id,
                org_name=org_map.get(t.org_id),
                company_code=company_map.get(t.company_id),
                username=_username_from_user_id(t.user_id),
                subject=t.subject,
                priority=t.priority,
                status=t.status,
                created_at=t.created_at,
                updated_at=t.updated_at,
                messages=[
                    TicketMessageOut(
                        message_id=m.message_id,
                        timestamp=m.timestamp,
                        sender=m.sender,
                        text=m.text,
                    )
                    for m in msgs
                ],
            )
        )
    return out


@app.post("/api/admin/tickets/{ticket_id}/reply", response_model=TicketOut)
def admin_reply_ticket(
    ticket_id: str,
    payload: AdminTicketUpdateRequest,
    ctx: SessionCtx = Depends(require_admin),
    db: SASession = Depends(get_db),
):
    t = db.query(DBTicket).filter(DBTicket.ticket_id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    now = int(time.time())
    t.updated_at = now
    if payload.text:
        m = DBTicketMessage(
            message_id=f"m_{uuid.uuid4().hex[:10]}",
            ticket_id=ticket_id,
            timestamp=now,
            sender="admin",
            text=payload.text,
        )
        db.add(m)
        t.updated_at = now

    if payload.status is not None:
        t.status = payload.status
    if payload.priority is not None:
        t.priority = payload.priority

    db.commit()

    org_name = None
    company_code = None
    try:
        org_name = db.query(DBOrganization.name).filter(DBOrganization.org_id == t.org_id).scalar()
        company_code = db.query(DBCompany.code).filter(DBCompany.company_id == t.company_id).scalar()
    except Exception:
        pass

    msgs = (
        db.query(DBTicketMessage)
        .filter(DBTicketMessage.ticket_id == ticket_id)
        .order_by(DBTicketMessage.timestamp)
        .all()
    )

    storage.record_request(t.org_id, "tickets.admin.reply")

    return TicketOut(
        ticket_id=t.ticket_id,
        org_id=t.org_id,
        company_id=t.company_id,
        user_id=t.user_id,
        org_name=org_name,
        company_code=company_code,
        username=_username_from_user_id(t.user_id),
        subject=t.subject,
        priority=t.priority,
        status=t.status,
        created_at=t.created_at,
        updated_at=t.updated_at,
        messages=[
            TicketMessageOut(
                message_id=m.message_id,
                timestamp=m.timestamp,
                sender=m.sender,
                text=m.text,
            )
            for m in msgs
        ],
    )


# ───────────────────────── Helpdesk (AI Assistant) ─────────────────────────

class HelpdeskChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    text: str


class HelpdeskConversationOut(HelpdeskConversation):
    pass


@app.get("/api/user/helpdesk/conversations", response_model=List[HelpdeskConversationOut])
def list_helpdesk_conversations(ctx: SessionCtx = Depends(require_org_user), db: SASession = Depends(get_db)):
    _ensure_feature(ctx, "ai.helpdesk", db)

    conv_rows = (
        db.query(DBHelpdeskConversation)
        .filter(
            DBHelpdeskConversation.org_id == ctx.org_id,
            DBHelpdeskConversation.company_id == ctx.company_id,
            DBHelpdeskConversation.user_id == ctx.user_id,
        )
        .order_by(DBHelpdeskConversation.updated_at.desc())
        .all()
    )

    conversations: List[HelpdeskConversation] = []
    for c in conv_rows:
        msgs = (
            db.query(DBHelpdeskMessage)
            .filter(DBHelpdeskMessage.conversation_id == c.conversation_id)
            .order_by(DBHelpdeskMessage.timestamp)
            .all()
        )
        conversations.append(
            HelpdeskConversation(
                conversation_id=c.conversation_id,
                org_id=c.org_id,
                company_id=c.company_id,
                user_id=c.user_id,
                created_at=c.created_at,
                updated_at=c.updated_at,
                messages=[
                    HelpdeskMessage(
                        message_id=m.message_id,
                        timestamp=m.timestamp,
                        sender=m.sender,
                        text=m.text,
                    )
                    for m in msgs
                ],
            )
        )
    return conversations


@app.post("/api/user/helpdesk/chat", response_model=HelpdeskConversationOut)
async def helpdesk_chat(
    payload: HelpdeskChatRequest,
    ctx: SessionCtx = Depends(require_org_user),
    db: SASession = Depends(get_db),
):
    _ensure_feature(ctx, "ai.helpdesk", db)

    company = db.query(DBCompany).filter(DBCompany.company_id == ctx.company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company not found")
    if not company.ai_api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AI key not configured for this company")

    # load or create conversation
    if payload.conversation_id:
        c = (
            db.query(DBHelpdeskConversation)
            .filter(DBHelpdeskConversation.conversation_id == payload.conversation_id)
            .first()
        )
        if not c:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        if c.org_id != ctx.org_id or c.company_id != ctx.company_id or c.user_id != ctx.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conversation not owned by user")
    else:
        now = int(time.time())
        cid = f"conv_{uuid.uuid4().hex[:10]}"
        c = DBHelpdeskConversation(
            conversation_id=cid,
            org_id=ctx.org_id,
            company_id=ctx.company_id,
            user_id=ctx.user_id,
            created_at=now,
            updated_at=now,
        )
        db.add(c)
        db.commit()
        db.refresh(c)

    msgs = (
        db.query(DBHelpdeskMessage)
        .filter(DBHelpdeskMessage.conversation_id == c.conversation_id)
        .order_by(DBHelpdeskMessage.timestamp)
        .all()
    )
    conv = HelpdeskConversation(
        conversation_id=c.conversation_id,
        org_id=c.org_id,
        company_id=c.company_id,
        user_id=c.user_id,
        created_at=c.created_at,
        updated_at=c.updated_at,
        messages=[
            HelpdeskMessage(
                message_id=m.message_id,
                timestamp=m.timestamp,
                sender=m.sender,
                text=m.text,
            )
            for m in msgs
        ],
    )

    # add user message (both DB + in-memory conv)
    now = int(time.time())
    user_msg = HelpdeskMessage(
        message_id=f"msg_{uuid.uuid4().hex[:10]}",
        timestamp=now,
        sender="user",
        text=payload.text,
    )
    conv.messages.append(user_msg)
    db.add(
        DBHelpdeskMessage(
            message_id=user_msg.message_id,
            conversation_id=c.conversation_id,
            timestamp=now,
            sender="user",
            text=payload.text,
        )
    )
    c.updated_at = now
    db.commit()

    # call AI backend
    try:
        answer = await run_helpdesk_completion(company.ai_api_key, conv, payload.text)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Helpdesk error: {e}")

    ai_msg = HelpdeskMessage(
        message_id=f"msg_{uuid.uuid4().hex[:10]}",
        timestamp=int(time.time()),
        sender="ai",
        text=answer,
    )
    conv.messages.append(ai_msg)

    db.add(
        DBHelpdeskMessage(
            message_id=ai_msg.message_id,
            conversation_id=c.conversation_id,
            timestamp=ai_msg.timestamp,
            sender="ai",
            text=ai_msg.text,
        )
    )
    c.updated_at = int(time.time())
    db.commit()

    storage.record_request(ctx.org_id, "helpdesk.chat", feature="ai.helpdesk")

    return conv


# ───────────────────────── Projects & Backup ─────────────────────────

class ProjectOut(BaseModel):
    id: str
    name: str


@app.get("/api/user/projects", response_model=List[ProjectOut])
def list_projects(ctx: SessionCtx = Depends(require_org_user), db: SASession = Depends(get_db)):
    _ensure_feature(ctx, "projects.backup", db)

    sess = storage.get_session(ctx.token)
    if not sess or not sess.rib_session:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No RIB session in backend")

    auth = auth_from_rib_session(sess.rib_session)
    api = ProjectApi(auth)
    try:
        rows = api.all()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"RIB projects error: {e}")

    storage.record_rib_call(ctx.org_id, "projects.list")

    out: List[ProjectOut] = []
    for r in rows:
        pid = str(r.get("Id"))
        name = (r.get("ProjectName") or "").strip()
        out.append(ProjectOut(id=pid, name=name))
    return out


class BackupRequest(BaseModel):
    project_id: str
    project_name: str
    include_estimates: bool = True
    include_lineitems: bool = True
    include_resources: bool = True
    include_activities: bool = True


class BackupJobOut(BaseModel):
    job_id: str
    org_id: str
    company_id: str
    user_id: str
    project_id: str
    project_name: str
    status: str
    created_at: int
    updated_at: int
    log: List[str]
    options: Dict[str, Any]


@app.post("/api/user/projects/backup", response_model=BackupJobOut)
def start_backup(payload: BackupRequest, ctx: SessionCtx = Depends(require_org_user), db: SASession = Depends(get_db)):
    """
    For now this just creates a job record and marks it as completed immediately.
    Later you can replace this with a real async ZIP export.
    """
    _ensure_feature(ctx, "projects.backup", db)

    now = int(time.time())
    job_id = f"job_{uuid.uuid4().hex[:10]}"

    options = {
        "include_estimates": payload.include_estimates,
        "include_lineitems": payload.include_lineitems,
        "include_resources": payload.include_resources,
        "include_activities": payload.include_activities,
    }
    log = ["Backup job placeholder completed (no real ZIP yet)."]

    job = DBBackupJob(
        job_id=job_id,
        org_id=ctx.org_id,
        company_id=ctx.company_id,
        user_id=ctx.user_id,
        project_id=payload.project_id,
        project_name=payload.project_name,
        status="completed",
        created_at=now,
        updated_at=now,
        log_json=json.dumps(log),
        options_json=json.dumps(options),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    storage.record_request(ctx.org_id, "projects.backup", feature="projects.backup")

    return _backup_from_db(job)


@app.get("/api/user/projects/backup/{job_id}", response_model=BackupJobOut)
def get_backup_job(job_id: str, ctx: SessionCtx = Depends(require_org_user), db: SASession = Depends(get_db)):
    job = (
        db.query(DBBackupJob)
        .filter(
            DBBackupJob.job_id == job_id,
            DBBackupJob.org_id == ctx.org_id,
            DBBackupJob.company_id == ctx.company_id,
            DBBackupJob.user_id == ctx.user_id,
        )
        .first()
    )
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return _backup_from_db(job)




# Serve /app and /app/* correctly
frontend_dir = os.path.join(os.path.dirname(__file__), "../../frontend/dist")

if os.path.isdir(frontend_dir):
    app.mount("/app/assets", StaticFiles(directory=os.path.join(frontend_dir, "assets")), name="assets")

    @app.get("/app/{full_path:path}")
    async def frontend_app(full_path: str):
        index = os.path.join(frontend_dir, "index.html")
        return FileResponse(index)

    @app.get("/")
    async def root_redirect():
        index = os.path.join(frontend_dir, "index.html")
        return FileResponse(index)




from pydantic import BaseModel
import pyodbc

class TextSqlReq(BaseModel):
    db_host: str
    db_name: str
    db_user: str
    db_password: str
    question: str

@app.post("/api/user/textsql/run")
def textsql_run(
    body: TextSqlReq,
    user: SessionCtx = Depends(require_org_user),
    db: SASession = Depends(get_db)
):
    _ensure_feature(user, "textsql", db)
    # 1. Load org/company AI key
    company = db.query(DBCompany).filter(DBCompany.company_id == user.company_id).first()
    if not company or not company.ai_api_key:
        raise HTTPException(400, "AI not enabled for this company")

    # 2. Ask OpenAI for SQL
    sql_prompt = f"""
You are an expert SQL generator. Convert the question into a SQL Server SQL query.
The question: {body.question}

Return ONLY SQL, no explanation.
"""

    from openai import OpenAI
    client = OpenAI(api_key=company.ai_api_key)

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": sql_prompt}],
        )
        generated_sql = completion.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(500, f"SQL generation failed: {e}")

    # 3. Execute SQL against user database
    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={body.db_host};"
        f"DATABASE={body.db_name};"
        f"UID={body.db_user};"
        f"PWD={body.db_password};"
    )

    rows = []
    columns = []
    error_text = None

    try:
        import pyodbc
        conn = pyodbc.connect(conn_str)
        cur = conn.cursor()
        cur.execute(generated_sql)

        columns = [c[0] for c in cur.description]
        rows = [dict(zip(columns, r)) for r in cur.fetchall()]

        cur.close()
        conn.close()
    except Exception as e:
        error_text = str(e)

    # 4. Persist request/response for history
    now = int(time.time())
    try:
        db.add(
            DBTextSqlLog(
                org_id=user.org_id,
                company_id=user.company_id,
                user_id=user.user_id,
                question=body.question,
                generated_sql=generated_sql,
                error_text=error_text,
                rows_json=json.dumps(rows) if rows else None,
                created_at=now,
            )
        )
        db.commit()
    except Exception:
        db.rollback()

    if error_text:
        return {"sql": generated_sql, "error": error_text}

    return {
        "sql": generated_sql,
        "columns": columns,
        "rows": rows,
    }
