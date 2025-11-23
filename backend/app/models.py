# backend/app/models.py
from __future__ import annotations

from typing import Dict, List, Optional, Literal, Any
from pydantic import BaseModel, Field


# ───────────────────────── Core domain models ─────────────────────────

class License(BaseModel):
    plan: Literal["monthly", "yearly"] = "monthly"
    active: bool = True
    current_period_end: int


class Organization(BaseModel):
    org_id: str
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    license: License
    # feature flags like: {"projects.backup": True, "ai.helpdesk": True}
    features: Dict[str, bool] = Field(default_factory=dict)


class Company(BaseModel):
    company_id: str
    org_id: str
    name: str
    code: str  # company code used for login (e.g. "TNG-100")
    base_url: str  # RIB host URL
    rib_company_code: str  # RIB company code (e.g. "999")
    allowed_users: List[str] = Field(default_factory=list)
    # OpenAI API key used for helpdesk etc.
    ai_api_key: Optional[str] = None


# ───────────────────────── RIB session & backend session ─────────────────────────

class RIBSession(BaseModel):
    access_token: str
    exp_ts: int
    secure_client_role: Optional[str] = None
    host: str
    company_code: str
    username: str


class Session(BaseModel):
    token: str
    user_id: str
    username: str
    display_name: str
    is_admin: bool = False
    org_id: Optional[str] = None
    company_id: Optional[str] = None
    created_at: int
    expires_at: int
    rib_session: Optional[RIBSession] = None


# ───────────────────────── Metrics ─────────────────────────

class MetricCounters(BaseModel):
    total_requests: int = 0
    total_rib_calls: int = 0
    per_feature: Dict[str, int] = Field(default_factory=dict)


# ───────────────────────── Tickets ─────────────────────────

class TicketMessage(BaseModel):
    message_id: str
    timestamp: int
    sender: Literal["user", "admin"]
    text: str


class Ticket(BaseModel):
    ticket_id: str
    org_id: str
    company_id: str
    user_id: str
    subject: str
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    status: Literal["open", "in_progress", "done"] = "open"
    created_at: int
    updated_at: int
    messages: List[TicketMessage] = Field(default_factory=list)


# ───────────────────────── Helpdesk ─────────────────────────

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


# ───────────────────────── Project backup ─────────────────────────

class ProjectBackupJob(BaseModel):
    job_id: str
    org_id: str
    company_id: str
    user_id: str
    project_id: str
    project_name: str
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    created_at: int
    updated_at: int
    log: List[str] = Field(default_factory=list)
    options: Dict[str, Any] = Field(default_factory=dict)
