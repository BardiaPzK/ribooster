# backend/app/main.py
"""
FastAPI app for ribooster:
- /api/auth/login : Admin + RIB user login
- /api/auth/me    : Current session
- /api/admin/...  : Admin console (orgs, metrics)

Frontend (React/Vite) is served as static files under /app.
"""

from __future__ import annotations

import time
import uuid
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .config import settings, BASE_DIR
from .models import (
    LoginRequest,
    LoginResponse,
    MeResponse,
    Organization,
    Company,
    Session,
    CreateOrgRequest,
    UpdateOrgRequest,
    OrgListItem,
)
from .storage import (
    load_state,
    save_state,
    ORGS,
    COMPANIES,
    COMPANY_BY_CODE,
    METRICS,
    get_org_by_access_code,
    get_org,
    store_session,
    get_session,
    record_login_success,
    record_login_failed,
    record_route_hit,
    upsert_org_and_company,
    metrics_overview,
)
from .rib_client import rib_login


app = FastAPI(title=settings.APP_NAME)


# ---- CORS (for dev; in prod backend + frontend are same origin) ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # you can restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Static frontend (dist is copied to /app/frontend_dist in Dockerfile) ----

FRONTEND_DIST = BASE_DIR / "frontend_dist"
if FRONTEND_DIST.exists():
    app.mount("/app", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


@app.get("/", include_in_schema=False)
async def root():
    # Redirect root to frontend under /app
    return RedirectResponse(url="/app/")


# ---- Startup ----

@app.on_event("startup")
def on_startup() -> None:
    load_state()


# ---- Helpers ----

def _now() -> int:
    return int(time.time())


def _new_session_token() -> str:
    return uuid.uuid4().hex


def _session_timestamps() -> tuple[int, int]:
    now = _now()
    return now, now + settings.SESSION_TTL_SECONDS


def current_session(
    authorization: Optional[str] = Header(None),
) -> Session:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    sess = get_session(token)
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return sess


def current_admin(sess: Session = Depends(current_session)) -> Session:
    if not sess.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return sess


# ---- Auth endpoints ----

@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    """
    Login.
    - If company_code == 'Admin' (case-insensitive) → admin login.
    - Else → RIB login for the mapped company & org.
    """
    code = payload.company_code.strip()
    username = payload.username.strip()
    password = payload.password

    if not code or not username or not password:
        raise HTTPException(status_code=400, detail="Missing credentials")

    # Admin path
    if code.lower() == settings.ADMIN_ACCESS_CODE.lower():
        expected = settings.ADMIN_USERS.get(username)
        if not expected or expected != password:
            record_login_failed(org_id=None)
            raise HTTPException(status_code=401, detail="Invalid admin credentials")

        token = _new_session_token()
        created_at, expires_at = _session_timestamps()
        sess = Session(
            token=token,
            username=username,
            is_admin=True,
            org_id=None,
            company_id=None,
            created_at=created_at,
            expires_at=expires_at,
        )
        store_session(sess)

        return LoginResponse(
            token=token,
            is_admin=True,
            username=username,
            display_name="ribooster admin",
        )

    # Organization user path
    org_and_company = get_org_by_access_code(code)
    if not org_and_company:
        record_login_failed(org_id=None)
        raise HTTPException(status_code=404, detail="Unknown company code")

    org, company = org_and_company

    # License check
    now = _now()
    if org.license.current_period_end < now:
        org.license.active = False
        save_state()
    if not org.license.active or org.deactivated:
        record_login_failed(org_id=org.org_id)
        raise HTTPException(status_code=403, detail="Organization license inactive or access disabled")

    # Optional user whitelist
    if company.allowed_users and username not in company.allowed_users:
        record_login_failed(org_id=org.org_id)
        raise HTTPException(status_code=403, detail="User not allowed for this company")

    # RIB login
    try:
        result = rib_login(
            base_url=company.base_url,
            rib_company_code=company.rib_company_code,
            username=username,
            password=password,
        )
    except Exception as ex:  # httpx.HTTPError or RuntimeError
        record_login_failed(org_id=org.org_id)
        raise HTTPException(status_code=401, detail=f"RIB login failed: {ex}")

    # Create session
    token = _new_session_token()
    created_at, expires_at = _session_timestamps()
    sess = Session(
        token=token,
        username=username,
        is_admin=False,
        org_id=org.org_id,
        company_id=company.company_id,
        created_at=created_at,
        expires_at=expires_at,
        rib_token=result.token,
        rib_exp_ts=result.exp_ts,
        rib_role=result.secure_client_role,
        display_name=result.display_name,
    )
    store_session(sess)

    # Update org metadata
    org.last_login_ts = now
    record_login_success(org_id=org.org_id)
    record_route_hit(org_id=org.org_id, route_name="auth.login")
    save_state()

    return LoginResponse(
        token=token,
        is_admin=False,
        username=username,
        display_name=result.display_name,
        org_id=org.org_id,
        org_name=org.name,
        company_id=company.company_id,
        company_code=company.code,
        rib_exp_ts=result.exp_ts,
        rib_role=result.secure_client_role,
    )


@app.get("/api/auth/me", response_model=MeResponse)
def me(sess: Session = Depends(current_session)) -> MeResponse:
    """
    Return basic info about current session.
    """
    org_name = None
    company_code = None
    if sess.org_id:
        org = get_org(sess.org_id)
        if org:
            org_name = org.name
    if sess.company_id:
        company = COMPANIES.get(sess.company_id)
        if company:
            company_code = company.code

    if sess.org_id:
        record_route_hit(org_id=sess.org_id, route_name="auth.me")

    return MeResponse(
        username=sess.username,
        display_name=sess.display_name,
        is_admin=sess.is_admin,
        org_id=sess.org_id,
        org_name=org_name,
        company_id=sess.company_id,
        company_code=company_code,
        rib_exp_ts=sess.rib_exp_ts,
        rib_role=sess.rib_role,
    )


# ---- Admin endpoints ----

@app.get("/api/admin/orgs", response_model=list[OrgListItem])
def admin_list_orgs(_: Session = Depends(current_admin)) -> list[OrgListItem]:
    """
    List all organizations + their companies + metrics.
    """
    items: list[OrgListItem] = []
    for org in ORGS.values():
        # we assume one company per org for now
        company = next((c for c in COMPANIES.values() if c.org_id == org.org_id), None)
        if not company:
            continue
        metrics = METRICS.get(org.org_id)
        if not metrics:
            from .models import MetricCounters
            metrics = MetricCounters()
        items.append(
            OrgListItem(org=org, company=company, metrics=metrics)
        )
    return items


@app.post("/api/admin/orgs", response_model=OrgListItem)
def admin_create_org(payload: CreateOrgRequest, admin: Session = Depends(current_admin)) -> OrgListItem:
    """
    Create new org + company in one step.
    """
    # Check uniqueness of access_code
    if payload.access_code.lower() in COMPANY_BY_CODE:
        raise HTTPException(status_code=400, detail="access_code already exists")

    now = _now()
    org_id = f"org_{uuid.uuid4().hex[:8]}"
    company_id = f"cmp_{uuid.uuid4().hex[:8]}"

    from .models import License
    license_obj = License(
        plan=payload.plan,
        active=True,
        current_period_end=int(time.time()) + 30 * 24 * 60 * 60,  # 30 days from now
    )

    org = Organization(
        org_id=org_id,
        name=payload.name,
        access_code=payload.access_code,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        notes=payload.notes,
        created_by=admin.username,
        created_at=now,
        license=license_obj,
        features=[
            "projects.backup",
            "ai.helpdesk",
        ],
    )
    company = Company(
        company_id=company_id,
        org_id=org_id,
        code=payload.access_code,
        base_url=payload.base_url,
        rib_company_code=payload.rib_company_code,
        allowed_users=payload.allowed_users,
    )

    upsert_org_and_company(org=org, company=company)

    return OrgListItem(
        org=org,
        company=company,
        metrics=METRICS.get(org_id),
    )


@app.put("/api/admin/orgs/{org_id}", response_model=OrgListItem)
def admin_update_org(org_id: str, payload: UpdateOrgRequest, _: Session = Depends(current_admin)) -> OrgListItem:
    org = ORGS.get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Org not found")

    # Update scalar fields
    if payload.name is not None:
        org.name = payload.name
    if payload.contact_email is not None:
        org.contact_email = payload.contact_email
    if payload.contact_phone is not None:
        org.contact_phone = payload.contact_phone
    if payload.notes is not None:
        org.notes = payload.notes
    if payload.deactivated is not None:
        org.deactivated = payload.deactivated

    # License
    if payload.plan is not None:
        org.license.plan = payload.plan
    if payload.active is not None:
        org.license.active = payload.active
    if payload.current_period_end is not None:
        org.license.current_period_end = payload.current_period_end

    # Features
    if payload.features is not None:
        org.features = payload.features

    # Allowed users (company)
    company = next((c for c in COMPANIES.values() if c.org_id == org_id), None)
    if not company:
        raise HTTPException(status_code=500, detail="Company missing for org")
    if payload.allowed_users is not None:
        company.allowed_users = payload.allowed_users

    upsert_org_and_company(org=org, company=company)
    metrics = METRICS.get(org_id)
    return OrgListItem(org=org, company=company, metrics=metrics)


@app.get("/api/admin/metrics/overview")
def admin_metrics_overview(_: Session = Depends(current_admin)):
    """
    Simple analytics summary across orgs.
    """
    ov = metrics_overview()
    # Convert to primitive dict for frontend
    return ov.model_dump()
