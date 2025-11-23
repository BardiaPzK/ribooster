# backend/app/main.py

"""
FastAPI entrypoint for ribooster.

Focus:
- Login (Admin + Org/RIB users)
- Organizations & companies management (admin)
- Metrics overview
- Tickets
- Helpdesk AI backend
- Simple project list + backup job structure

Static frontend is served from /app (Vite build).

IMPORTANT:
- Admin login: CompanyCode = "Admin", username= "admin", password= "admin"
- User login: CompanyCode = ribooster company code (e.g. "JBI-999", "TNG-100"),
  RIB username/password are forwarded to the RIB server.
"""

from __future__ import annotations

import os
import time
import uuid
from typing import List, Optional, Literal, Dict, Any

import requests
from fastapi import FastAPI, HTTPException, Depends, Header, Body, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .models import (
    License,
    Organization,
    Company,
    Session,          # session model from models.py
    RIBSession,
    MetricCounters,
    Ticket,
    HelpdeskConversation,
    HelpdeskMessage,
    ProjectBackupJob,
)
from . import storage
from .rib_client import Auth, AuthCfg, auth_from_rib_session, ProjectApi
from .ai_helpdesk import run_helpdesk_completion


from dataclasses import asdict



# ───────────────────────── App setup ─────────────────────────

app = FastAPI(title="ribooster API", version="0.2.0")

origins = ["*"]  # adjust later if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
ADMIN_USERS = {
    "admin": "admin",
    # add more if needed later
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

class OrgRowOut(BaseModel):
    org: Dict[str, Any]
    license: Dict[str, Any]
    features: List[str]
    requests_count: int


class SessionCtx(BaseModel):
    """
    Lightweight session context returned to frontend and used in dependencies.
    """
    token: str
    user_id: str
    org_id: Optional[str] = None
    company_id: Optional[str] = None
    username: str
    display_name: str
    is_admin: bool


def _jwt_payload(tok: str) -> Dict[str, Any]:
    import base64
    import json

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


def _session_from_token(token: str) -> SessionCtx:
    s = storage.get_session(token)
    if not s:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    now = int(time.time())
    if s.expires_at and s.expires_at < now:
        storage.delete_session(token)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return SessionCtx(
        token=s.token,
        user_id=s.user_id,
        org_id=s.org_id,
        company_id=s.company_id,
        username=s.username,
        display_name=s.display_name,
        is_admin=s.is_admin,
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


# ───────────────────────── Health ─────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "time": int(time.time())}


# ───────────────────────── Login ─────────────────────────

@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    company_code = payload.company_code.strip()
    username = payload.username.strip()
    password = payload.password

    if not company_code or not username or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing fields")

    # ─── Admin login ───────────────────────────────────────
    if company_code.lower() == ADMIN_ACCESS_CODE.lower():
        expected = ADMIN_USERS.get(username)
        if not expected or expected != password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

        now = int(time.time())
        sess = Session(
            token=uuid.uuid4().hex + uuid.uuid4().hex,
            user_id=f"admin-{username}",
            org_id="admin",
            company_id=None,
            username=username,
            display_name="ribooster admin",
            is_admin=True,
            rib_session=None,
            created_at=now,
            expires_at=now + 8 * 3600,
        )
        storage.save_session(sess)
        return LoginResponse(
            token=sess.token,
            is_admin=True,
            username=username,
            display_name="ribooster admin",
        )

    # ─── Org user login with RIB ───────────────────────────
    try:
        org, company = storage.get_org_and_company_by_code(company_code)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown company code")

    lic = org.license
    now = int(time.time())
    if not lic.active or lic.current_period_end < now:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="License inactive or expired")

    # optional allowed users check
    if company.allowed_users and username not in company.allowed_users:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not allowed for this company")

    # login to RIB
    auth = Auth(AuthCfg(host=company.base_url, company=company.rib_company_code))
    try:
        rib_sess = auth.login(username, password)
    except requests.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"RIB login failed: {e.response.text}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"RIB login failed: {e}",
        ) from e

    # derive display name from JWT if possible
    display_name = _display_from_jwt(rib_sess.access_token, username)

    # create backend session
    sess = Session(
        token=uuid.uuid4().hex + uuid.uuid4().hex,
        user_id=f"{org.org_id}:{username}",
        org_id=org.org_id,
        company_id=company.company_id,
        username=username,
        display_name=display_name,
        is_admin=False,
        rib_session=rib_sess,
        created_at=now,
        expires_at=now + 8 * 3600,
    )
    storage.save_session(sess)

    storage.record_request(org.org_id, "auth.login")

    return LoginResponse(
        token=sess.token,
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


# ───────────────────────── Auth / Me ─────────────────────────

@app.get("/api/auth/me")
def me(ctx: SessionCtx = Depends(require_session)):
    return ctx


# ───────────────────────── Admin: Orgs & Companies ─────────────────────────

class OrgListItem(BaseModel):
    org: Organization
    company: Company
    metrics: Optional[MetricCounters] = None  # allow None


class AdminCreateOrgRequest(BaseModel):
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    plan: Literal["monthly", "yearly"] = "monthly"
    current_period_end: int
    base_url: str
    rib_company_code: str
    company_code: str
    allowed_users: List[str] = Field(default_factory=list)


class AdminUpdateOrgRequest(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    plan: Optional[Literal["monthly", "yearly"]] = None
    active: Optional[bool] = None
    current_period_end: Optional[int] = None
    features: Optional[Dict[str, bool]] = None


class AdminUpdateCompanyRequest(BaseModel):
    base_url: Optional[str] = None
    rib_company_code: Optional[str] = None
    company_code: Optional[str] = None
    allowed_users: Optional[List[str]] = None
    ai_api_key: Optional[str] = None


@app.get("/api/admin/orgs", response_model=List[OrgRowOut])
def admin_list_orgs(ctx: SessionCtx = Depends(require_admin)):
    rows: List[OrgRowOut] = []
    now = int(time.time())

    for org in storage.ORGS.values():
        # Convert org to plain dict (support both pydantic v1/v2 and dataclasses)
        if hasattr(org, "model_dump"):
            org_dict = org.model_dump()
        elif hasattr(org, "dict"):
            org_dict = org.dict()
        else:
            org_dict = asdict(org)

        org_id = org_dict.get("org_id") or org_dict.get("id")
        if not org_id:
            # Skip anything weird
            continue

        # Try to reuse existing license on the org if present
        raw_license = org_dict.get("license")
        if isinstance(raw_license, dict):
            license_dict = {
                "org_id": raw_license.get("org_id") or org_id,
                "plan": raw_license.get("plan", "monthly"),
                "active": raw_license.get("active", True),
                "current_period_end": raw_license.get(
                    "current_period_end", now + 30 * 24 * 60 * 60
                ),
            }
        else:
            # Fallback: basic license stub
            license_dict = {
                "org_id": org_id,
                "plan": "monthly",
                "active": True,
                "current_period_end": now + 30 * 24 * 60 * 60,
            }

        # Features can be stored either as dict[str, bool] or as list[str]
        features_src = org_dict.get("features") or {}
        if isinstance(features_src, dict):
            feature_list = sorted(
                [name for name, enabled in features_src.items() if enabled]
            )
        elif isinstance(features_src, list):
            feature_list = features_src
        else:
            feature_list = []

        # Requests count from metrics, if you track it
        metrics = getattr(storage, "METRICS", {}).get(org_id)
        req_count = getattr(metrics, "total_requests", 0) if metrics is not None else 0

        rows.append(
            OrgRowOut(
                org=org_dict,
                license=license_dict,
                features=feature_list,
                requests_count=req_count,
            )
        )

    # Sort by org name for nicer display
    rows.sort(key=lambda r: (r.org.get("name") or "").lower())
    return rows



@app.post("/api/admin/orgs", response_model=OrgListItem)
def admin_create_org(payload: AdminCreateOrgRequest, ctx: SessionCtx = Depends(require_admin)):
    org, company = storage.create_org_and_company(
        name=payload.name,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        notes=payload.notes,
        plan=payload.plan,
        current_period_end=payload.current_period_end,
        base_url=payload.base_url,
        rib_company_code=payload.rib_company_code,
        code=payload.company_code,
        allowed_users=payload.allowed_users,
    )
    metrics = storage.METRICS.get(org.org_id, None)
    return OrgListItem(org=org, company=company, metrics=metrics)


@app.put("/api/admin/orgs/{org_id}", response_model=Organization)
def admin_update_org(org_id: str, payload: AdminUpdateOrgRequest, ctx: SessionCtx = Depends(require_admin)):
    org = storage.ORGS.get(org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Org not found")

    data = org.model_copy()
    if payload.name is not None:
        data.name = payload.name
    if payload.contact_email is not None:
        data.contact_email = payload.contact_email
    if payload.contact_phone is not None:
        data.contact_phone = payload.contact_phone
    if payload.notes is not None:
        data.notes = payload.notes
    if payload.plan is not None:
        data.license.plan = payload.plan
    if payload.current_period_end is not None:
        data.license.current_period_end = payload.current_period_end
    if payload.active is not None:
        data.license.active = payload.active
    if payload.features is not None:
        new_feats = dict(data.features)
        new_feats.update(payload.features)
        data.features = new_feats

    storage.update_org(data)
    return data


@app.put("/api/admin/companies/{company_id}", response_model=Company)
def admin_update_company(company_id: str, payload: AdminUpdateCompanyRequest, ctx: SessionCtx = Depends(require_admin)):
    comp = storage.COMPANIES.get(company_id)
    if not comp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")

    data = comp.model_copy()
    if payload.base_url is not None:
        data.base_url = payload.base_url
    if payload.rib_company_code is not None:
        data.rib_company_code = payload.rib_company_code
    if payload.company_code is not None:
        data.code = payload.company_code
    if payload.allowed_users is not None:
        data.allowed_users = payload.allowed_users
    if payload.ai_api_key is not None:
        data.ai_api_key = payload.ai_api_key

    storage.update_company(data)
    return data


# ───────────────────────── Admin: Metrics ─────────────────────────

class MetricsOverviewItem(BaseModel):
    org_id: str
    org_name: str
    total_requests: int
    total_rib_calls: int
    by_feature: Dict[str, int]


@app.get("/api/admin/metrics/overview", response_model=List[MetricsOverviewItem])
def admin_metrics_overview(ctx: SessionCtx = Depends(require_admin)):
    out: List[MetricsOverviewItem] = []
    for org_id, org in storage.ORGS.items():
        mc = storage.METRICS.get(org_id, MetricCounters())
        out.append(
            MetricsOverviewItem(
                org_id=org_id,
                org_name=org.name,
                total_requests=mc.total_requests,
                total_rib_calls=mc.total_rib_calls,
                by_feature=mc.per_feature,
            )
        )
    out.sort(key=lambda x: x.total_requests, reverse=True)
    return out


# ───────────────────────── Tickets (User side) ─────────────────────────

class CreateTicketRequest(BaseModel):
    subject: str
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    text: str


class TicketListItem(BaseModel):
    ticket_id: str
    subject: str
    priority: str
    status: str
    created_at: int
    updated_at: int


@app.get("/api/user/tickets", response_model=List[TicketListItem])
def user_list_tickets(ctx: SessionCtx = Depends(require_org_user)):
    items: List[TicketListItem] = []
    for t in storage.TICKETS.values():
        if t.org_id == ctx.org_id and t.user_id == ctx.user_id:
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
    items.sort(key=lambda x: x.updated_at, reverse=True)
    return items


@app.post("/api/user/tickets", response_model=Ticket)
def user_create_ticket(payload: CreateTicketRequest, ctx: SessionCtx = Depends(require_org_user)):
    t = storage.create_ticket(
        org_id=ctx.org_id,
        company_id=ctx.company_id,
        user_id=ctx.user_id,
        subject=payload.subject,
        priority=payload.priority,
        text=payload.text,
    )
    storage.record_request(ctx.org_id, "tickets.create")
    return t


@app.get("/api/user/tickets/{ticket_id}", response_model=Ticket)
def user_get_ticket(ticket_id: str, ctx: SessionCtx = Depends(require_org_user)):
    t = storage.TICKETS.get(ticket_id)
    if not t or t.org_id != ctx.org_id or t.user_id != ctx.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return t


class TicketReplyRequest(BaseModel):
    text: str


@app.post("/api/user/tickets/{ticket_id}/reply", response_model=Ticket)
def user_reply_ticket(ticket_id: str, payload: TicketReplyRequest, ctx: SessionCtx = Depends(require_org_user)):
    t = storage.TICKETS.get(ticket_id)
    if not t or t.org_id != ctx.org_id or t.user_id != ctx.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    t = storage.add_ticket_message(ticket_id, "user", payload.text)
    storage.record_request(ctx.org_id, "tickets.reply")
    return t


# ───────────────────────── Tickets (Admin side) ─────────────────────────

class AdminTicketUpdateRequest(BaseModel):
    status: Optional[Literal["open", "in_progress", "done"]] = None
    priority: Optional[Literal["low", "normal", "high", "urgent"]] = None
    text: Optional[str] = None


@app.get("/api/admin/tickets", response_model=List[Ticket])
def admin_list_tickets(ctx: SessionCtx = Depends(require_admin)):
    return sorted(storage.TICKETS.values(), key=lambda t: t.updated_at, reverse=True)


@app.post("/api/admin/tickets/{ticket_id}/reply", response_model=Ticket)
def admin_reply_ticket(ticket_id: str, payload: AdminTicketUpdateRequest, ctx: SessionCtx = Depends(require_admin)):
    t = storage.TICKETS.get(ticket_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if payload.text:
        t = storage.add_ticket_message(ticket_id, "admin", payload.text)

    if payload.status is not None:
        t.status = payload.status
    if payload.priority is not None:
        t.priority = payload.priority

    storage.TICKETS[ticket_id] = t
    storage.save_state()
    return t


# ───────────────────────── Helpdesk (AI Assistant) ─────────────────────────

class HelpdeskChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    text: str


class HelpdeskConversationOut(HelpdeskConversation):
    pass


def _ensure_feature(ctx: SessionCtx, feature_key: str) -> None:
    org = storage.ORGS.get(ctx.org_id or "")
    if not org:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Org missing")
    if not org.features.get(feature_key, False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Feature not enabled for org")


@app.get("/api/user/helpdesk/conversations", response_model=List[HelpdeskConversationOut])
def list_helpdesk_conversations(ctx: SessionCtx = Depends(require_org_user)):
    _ensure_feature(ctx, "ai.helpdesk")
    convs = storage.get_user_conversations(ctx.org_id, ctx.company_id, ctx.user_id)
    convs.sort(key=lambda c: c.updated_at, reverse=True)
    return convs


@app.post("/api/user/helpdesk/chat", response_model=HelpdeskConversationOut)
async def helpdesk_chat(payload: HelpdeskChatRequest, ctx: SessionCtx = Depends(require_org_user)):
    _ensure_feature(ctx, "ai.helpdesk")

    company = storage.COMPANIES.get(ctx.company_id or "")
    if not company:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company not found")
    if not company.ai_api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AI key not configured for this company")

    # load or create conversation
    if payload.conversation_id:
        if payload.conversation_id not in storage.HELPDESK_CONVERSATIONS:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        conv = storage.get_conversation(payload.conversation_id)
        if conv.org_id != ctx.org_id or conv.company_id != ctx.company_id or conv.user_id != ctx.user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conversation not owned by user")
    else:
        conv = storage.create_conversation(ctx.org_id, ctx.company_id, ctx.user_id)

    # add user message
    now = int(time.time())
    user_msg = HelpdeskMessage(
        message_id=f"msg_{uuid.uuid4().hex[:10]}",
        timestamp=now,
        sender="user",
        text=payload.text,
    )
    conv.messages.append(user_msg)

    # call AI backend
    try:
        answer = await run_helpdesk_completion(company.ai_api_key, conv, payload.text)
    except Exception as e:
        conv.messages.pop()
        conv.updated_at = int(time.time())
        storage.save_conversation(conv)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Helpdesk error: {e}")

    ai_msg = HelpdeskMessage(
        message_id=f"msg_{uuid.uuid4().hex[:10]}",
        timestamp=int(time.time()),
        sender="ai",
        text=answer,
    )
    conv.messages.append(ai_msg)
    conv.updated_at = int(time.time())
    storage.save_conversation(conv)

    storage.record_request(ctx.org_id, "helpdesk.chat", feature="ai.helpdesk")

    return conv


# ───────────────────────── Projects & Backup (simple) ─────────────────────────

class ProjectOut(BaseModel):
    id: str
    name: str


@app.get("/api/user/projects", response_model=List[ProjectOut])
def list_projects(ctx: SessionCtx = Depends(require_org_user)):
    _ensure_feature(ctx, "projects.backup")

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


@app.post("/api/user/projects/backup", response_model=ProjectBackupJob)
def start_backup(payload: BackupRequest, ctx: SessionCtx = Depends(require_org_user)):
    _ensure_feature(ctx, "projects.backup")

    job = storage.create_backup_job(
        org_id=ctx.org_id,
        company_id=ctx.company_id,
        user_id=ctx.user_id,
        project_id=payload.project_id,
        project_name=payload.project_name,
        options={
            "include_estimates": payload.include_estimates,
            "include_lineitems": payload.include_lineitems,
            "include_resources": payload.include_resources,
            "include_activities": payload.include_activities,
        },
    )

    job.status = "completed"
    job.log.append("Backup job placeholder completed (no real ZIP yet).")
    job.updated_at = int(time.time())
    storage.save_backup_job(job)

    storage.record_request(ctx.org_id, "projects.backup", feature="projects.backup")
    return job


@app.get("/api/user/projects/backup/{job_id}", response_model=ProjectBackupJob)
def get_backup_job(job_id: str, ctx: SessionCtx = Depends(require_org_user)):
    job = storage.BACKUP_JOBS.get(job_id)
    if not job or job.org_id != ctx.org_id or job.company_id != ctx.company_id or job.user_id != ctx.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job
