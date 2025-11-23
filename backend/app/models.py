"""
backend/app/models.py

Domain models for ribooster:
- Organizations, Companies, Licenses, Sessions
- Metrics
- Tickets (user <-> admin)
- Helpdesk (user <-> AI)
- Project backup jobs
"""

from __future__ import annotations

from typing import Dict, List, Optional, Literal
from pydantic import BaseModel, Field


# ───────────────────────── License / Features ─────────────────────────


class License(BaseModel):
    plan: Literal["monthly", "yearly"] = "monthly"
    active: bool = True
    current_period_end: int  # unix timestamp seconds


class Organization(BaseModel):
    org_id: str
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    license: License
    # feature flags like: "projects.backup", "ai.helpdesk"
    features: Dict[str, bool] = Field(default_factory=dict)


class Company(BaseModel):
    company_id: str
    org_id: str
    # ribooster company code used on login form (e.g. "TNG-100")
    code: str
    # RIB base URL (…/itwo40/services)
    base_url: str
    # RIB company code (e.g. "999", "1000")
    rib_company_code: str
    # list of allowed RIB usernames
    allowed_users: List[str] = Field(default_factory=list)
    # optional API key for AI services, specific to this company
    ai_api_key: Optional[str] = None


# ───────────────────────── Sessions ─────────────────────────


class RIBSession(BaseModel):
    access_token: str
    secure_client_role: str
    host: str
    company_code: str
    exp_ts: int  # unix seconds


class Session(BaseModel):
    token: str
    user_id: str
    org_id: str
    company_id: Optional[str] = None
    username: str
    display_name: str
    is_admin: bool = False
    rib_session: Optional[RIBSession] = None
    created_at: int
    expires_at: int


# ───────────────────────── Metrics ─────────────────────────


class MetricCounters(BaseModel):
    total_requests: int = 0
    # per route (e.g. "auth.login", "admin.orgs.list")
    per_route: Dict[str, int] = Field(default_factory=dict)
    # per feature (e.g. "projects.backup", "ai.helpdesk")
    per_feature: Dict[str, int] = Field(default_factory=dict)
    # total RIB API calls
    total_rib_calls: int = 0
    # per RIB feature
    rib_calls_by_feature: Dict[str, int] = Field(default_factory=dict)


# ───────────────────────── Tickets (user <-> admin) ─────────────────────────


class TicketMessage(BaseModel):
    message_id: str
    timestamp: int
    sender: Literal["user", "admin"]
    text: str


class Ticket(BaseModel):
    ticket_id: str
    org_id: str
    company_id: Optional[str] = None
    user_id: Optional[str] = None
    subject: str
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    status: Literal["open", "in_progress", "done"] = "open"
    created_at: int
    updated_at: int
    messages: List[TicketMessage] = Field(default_factory=list)


# ───────────────────────── Helpdesk (user <-> AI) ─────────────────────────


class HelpdeskMessage(BaseModel):
    message_id: str
    timestamp: int
    sender: Literal["user", "ai"]
    text: str


class HelpdeskConversation(BaseModel):
    conversation_id: str
    org_id: str
    company_id: str
    user_id: str
    created_at: int
    updated_at: int
    messages: List[HelpdeskMessage] = Field(default_factory=list)


# ───────────────────────── Project Backup ─────────────────────────


class ProjectBackupJob(BaseModel):
    job_id: str
    org_id: str
    company_id: str
    user_id: str
    project_id: str
    project_name: str
    options: Dict[str, bool] = Field(default_factory=dict)
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    log: List[str] = Field(default_factory=list)
    created_at: int
    updated_at: int
    download_path: Optional[str] = None
