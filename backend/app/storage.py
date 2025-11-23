# backend/app/storage.py
from __future__ import annotations

import os
import time
import uuid
from typing import Dict, Tuple, List, Optional

from .models import (
    Organization,
    Company,
    License,
    Session,
    MetricCounters,
    Ticket,
    TicketMessage,
    HelpdeskConversation,
    HelpdeskMessage,
    ProjectBackupJob,
)


# ───────────────────────── In-memory state ─────────────────────────

ORGS: Dict[str, Organization] = {}
COMPANIES: Dict[str, Company] = {}
SESSIONS: Dict[str, Session] = {}
METRICS: Dict[str, MetricCounters] = {}
TICKETS: Dict[str, Ticket] = {}
HELPDESK_CONVERSATIONS: Dict[str, HelpdeskConversation] = {}
BACKUP_JOBS: Dict[str, ProjectBackupJob] = {}


# ───────────────────────── Init defaults ─────────────────────────

def init_defaults() -> None:
    """Seed one default org + company if empty."""
    if ORGS:
        return

    now = int(time.time())
    org_id = "org_tng_100"
    license_obj = License(
        plan="monthly",
        active=True,
        current_period_end=now + 365 * 24 * 3600,
    )
    org = Organization(
        org_id=org_id,
        name="TenneT Test Org (TNG-100)",
        contact_email="admin@example.com",
        license=license_obj,
        features={
            "projects.backup": True,
            "ai.helpdesk": True,
        },
    )
    ORGS[org_id] = org
    METRICS[org_id] = MetricCounters()

    company_id = "comp_tng_100"
    comp = Company(
        company_id=company_id,
        org_id=org_id,
        name="TNG-100",
        code="TNG-100",
        base_url=os.environ.get(
            "TNG100_RIB_HOST",
            "https://jbi-ribdach.rib40.cloud/itwo40/services",
        ),
        rib_company_code=os.environ.get("TNG100_RIB_COMPANY", "999"),
        allowed_users=[],  # empty list = all users allowed
        ai_api_key=None,
    )
    COMPANIES[company_id] = comp


init_defaults()


# ───────────────────────── Sessions ─────────────────────────

def save_session(sess: Session) -> None:
    SESSIONS[sess.token] = sess


def get_session(token: str) -> Optional[Session]:
    return SESSIONS.get(token)


def delete_session(token: str) -> None:
    if token in SESSIONS:
        del SESSIONS[token]


# ───────────────────────── Orgs & companies ─────────────────────────

def get_org_and_company_by_code(code: str) -> Tuple[Organization, Company]:
    code_lower = code.lower()
    for comp in COMPANIES.values():
        if comp.code.lower() == code_lower:
            org = ORGS[comp.org_id]
            return org, comp
    raise KeyError(f"Company code not found: {code}")


def create_org_and_company(
    *,
    name: str,
    contact_email: Optional[str],
    contact_phone: Optional[str],
    notes: Optional[str],
    plan: str,
    current_period_end: int,
    base_url: str,
    rib_company_code: str,
    code: str,
    allowed_users: Optional[List[str]] = None,
) -> Tuple[Organization, Company]:
    now = int(time.time())
    org_id = f"org_{uuid.uuid4().hex[:10]}"
    company_id = f"comp_{uuid.uuid4().hex[:10]}"

    lic = License(
        plan=plan,
        active=True,
        current_period_end=current_period_end or (now + 365 * 24 * 3600),
    )

    org = Organization(
        org_id=org_id,
        name=name,
        contact_email=contact_email,
        contact_phone=contact_phone,
        notes=notes,
        license=lic,
        features={
            "projects.backup": True,
            "ai.helpdesk": True,
        },
    )
    ORGS[org_id] = org
    METRICS[org_id] = MetricCounters()

    comp = Company(
        company_id=company_id,
        org_id=org_id,
        name=code,
        code=code,
        base_url=base_url,
        rib_company_code=rib_company_code,
        allowed_users=allowed_users or [],
        ai_api_key=None,
    )
    COMPANIES[company_id] = comp
    return org, comp


def update_org(org: Organization) -> None:
    ORGS[org.org_id] = org


def update_company(company: Company) -> None:
    COMPANIES[company.company_id] = company


# ───────────────────────── Metrics ─────────────────────────

def record_request(org_id: str, endpoint: str, feature: Optional[str] = None) -> None:
    mc = METRICS.setdefault(org_id, MetricCounters())
    mc.total_requests += 1
    if feature:
        mc.per_feature[feature] = mc.per_feature.get(feature, 0) + 1


def record_rib_call(org_id: str, endpoint: str) -> None:
    mc = METRICS.setdefault(org_id, MetricCounters())
    mc.total_rib_calls += 1


# ───────────────────────── Tickets ─────────────────────────

def create_ticket(
    *,
    org_id: str,
    company_id: str,
    user_id: str,
    subject: str,
    priority: str,
    text: str,
) -> Ticket:
    now = int(time.time())
    ticket_id = f"t_{uuid.uuid4().hex[:10]}"
    msg = TicketMessage(
        message_id=f"m_{uuid.uuid4().hex[:10]}",
        timestamp=now,
        sender="user",
        text=text,
    )
    t = Ticket(
        ticket_id=ticket_id,
        org_id=org_id,
        company_id=company_id,
        user_id=user_id,
        subject=subject,
        priority=priority,
        status="open",
        created_at=now,
        updated_at=now,
        messages=[msg],
    )
    TICKETS[ticket_id] = t
    return t


def add_ticket_message(ticket_id: str, sender: str, text: str) -> Ticket:
    t = TICKETS[ticket_id]
    now = int(time.time())
    msg = TicketMessage(
        message_id=f"m_{uuid.uuid4().hex[:10]}",
        timestamp=now,
        sender=sender,  # "user" or "admin"
        text=text,
    )
    t.messages.append(msg)
    t.updated_at = now
    TICKETS[ticket_id] = t
    return t


# ───────────────────────── Helpdesk ─────────────────────────

def create_conversation(org_id: str, company_id: str, user_id: str) -> HelpdeskConversation:
    now = int(time.time())
    conv_id = f"c_{uuid.uuid4().hex[:10]}"
    conv = HelpdeskConversation(
        conversation_id=conv_id,
        org_id=org_id,
        company_id=company_id,
        user_id=user_id,
        created_at=now,
        updated_at=now,
        messages=[],
    )
    HELPDESK_CONVERSATIONS[conv_id] = conv
    return conv


def get_conversation(conv_id: str) -> HelpdeskConversation:
    return HELPDESK_CONVERSATIONS[conv_id]


def get_user_conversations(org_id: str, company_id: str, user_id: str) -> List[HelpdeskConversation]:
    return [
        c
        for c in HELPDESK_CONVERSATIONS.values()
        if c.org_id == org_id and c.company_id == company_id and c.user_id == user_id
    ]


def save_conversation(conv: HelpdeskConversation) -> None:
    HELPDESK_CONVERSATIONS[conv.conversation_id] = conv


# ───────────────────────── Backup jobs ─────────────────────────

def create_backup_job(
    *,
    org_id: str,
    company_id: str,
    user_id: str,
    project_id: str,
    project_name: str,
    options: Dict[str, object],
) -> ProjectBackupJob:
    now = int(time.time())
    job_id = f"b_{uuid.uuid4().hex[:10]}"
    job = ProjectBackupJob(
        job_id=job_id,
        org_id=org_id,
        company_id=company_id,
        user_id=user_id,
        project_id=project_id,
        project_name=project_name,
        status="pending",
        created_at=now,
        updated_at=now,
        log=[],
        options=options,
    )
    BACKUP_JOBS[job_id] = job
    return job


def save_backup_job(job: ProjectBackupJob) -> None:
    BACKUP_JOBS[job.job_id] = job
