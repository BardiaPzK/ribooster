# backend/app/models.py
"""
Pydantic models for orgs, companies, sessions, API payloads.
Short and simple so migration to a real DB is easy later.
"""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---- Domain models ----

class License(BaseModel):
    plan: Literal["monthly", "yearly"] = "monthly"
    active: bool = True
    current_period_end: int  # epoch seconds


class Organization(BaseModel):
    org_id: str
    name: str
    access_code: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    deactivated: bool = False
    created_by: str = "system"
    created_at: int
    license: License
    features: list[str] = Field(default_factory=list)
    last_login_ts: Optional[int] = None


class Company(BaseModel):
    company_id: str
    org_id: str
    code: str  # ribooster "Company Code" used on login screen, e.g. "TNG-100"
    base_url: str
    rib_company_code: str
    allowed_users: list[str] = Field(default_factory=list)


class Session(BaseModel):
    token: str
    username: str
    is_admin: bool
    org_id: Optional[str] = None
    company_id: Optional[str] = None
    created_at: int
    expires_at: int
    rib_token: Optional[str] = None
    rib_exp_ts: Optional[int] = None
    rib_role: Optional[str] = None
    display_name: Optional[str] = None


class MetricCounters(BaseModel):
    total_requests: int = 0
    logins_success: int = 0
    logins_failed: int = 0
    by_route: dict[str, int] = Field(default_factory=dict)


# ---- API payloads ----

class LoginRequest(BaseModel):
    company_code: str
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    is_admin: bool
    username: str
    display_name: Optional[str] = None
    org_id: Optional[str] = None
    org_name: Optional[str] = None
    company_id: Optional[str] = None
    company_code: Optional[str] = None
    rib_exp_ts: Optional[int] = None
    rib_role: Optional[str] = None


class MeResponse(BaseModel):
    username: str
    display_name: Optional[str]
    is_admin: bool
    org_id: Optional[str]
    org_name: Optional[str]
    company_id: Optional[str]
    company_code: Optional[str]
    rib_exp_ts: Optional[int]
    rib_role: Optional[str]


class CreateOrgRequest(BaseModel):
    name: str
    access_code: str
    base_url: str
    rib_company_code: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    plan: Literal["monthly", "yearly"] = "monthly"
    allowed_users: list[str] = Field(default_factory=list)


class UpdateOrgRequest(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    plan: Optional[Literal["monthly", "yearly"]] = None
    active: Optional[bool] = None
    current_period_end: Optional[int] = None
    deactivated: Optional[bool] = None
    features: Optional[list[str]] = None
    allowed_users: Optional[list[str]] = None


class OrgListItem(BaseModel):
    org: Organization
    company: Company
    metrics: MetricCounters


class MetricsOverview(BaseModel):
    total_orgs: int
    active_orgs: int
    total_requests: int
    total_logins_success: int
    total_logins_failed: int
