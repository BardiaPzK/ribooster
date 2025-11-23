"""
backend/app/storage.py

Simple JSON-backed in-memory store.
Keeps organizations, companies, sessions, metrics, tickets, helpdesk, backup jobs.

Data is persisted to state.json so admin changes survive restarts.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Dict, Optional, List, Tuple

from .models import (
    Organization,
    Company,
    Session,
    RIBSession,
    MetricCounters,
    Ticket,
    HelpdeskConversation,
    ProjectBackupJob,
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
STATE_FILE = DATA_DIR / "state.json"


# ───────────────────────── In-memory state ─────────────────────────

ORGS: Dict[str, Organization] = {}
COMPANIES: Dict[str, Company] = {}
SESSIONS: Dict[str, Session] = {}
METRICS: Dict[str, MetricCounters] = {}
TICKETS: Dict[str, Ticket] = {}
HELPDESK_CONVERSATIONS: Dict[str, HelpdeskConversation] = {}
BACKUP_JOBS: Dict[str, ProjectBackupJob] = {}

# mapping ribooster company code → company_id
COMPANY_BY_CODE: Dict[str, str] = {}


# ───────────────────────── Persistence helpers ─────────────────────────


def _default_state() -> dict:
    """
    Provide default organizations/companies so admin has something to start with.
    You can edit these defaults directly in this file.
    """
    now = int(time.time())
    in_30_days = now + 30 * 24 * 3600

    demo_org_id = "org_demo"
    tng_org_id = "org_tng"

    demo_org = Organization(
        org_id=demo_org_id,
        name="Demo Org",
        contact_email="demo@example.com",
        license={"plan": "monthly", "active": True, "current_period_end": in_30_days},
        features={
            "projects.backup": True,
            "ai.helpdesk": True,
        },
    )
    tng_org = Organization(
        org_id=tng_org_id,
        name="TransnetBW (example)",
        contact_email="contact@transnetbw.example",
        license={"plan": "yearly", "active": True, "current_period_end": in_30_days},
        features={
            "projects.backup": True,
            "ai.helpdesk": True,
        },
    )

    demo_company = Company(
        company_id="cmp_demo_jbi_999",
        org_id=demo_org_id,
        code="JBI-999",
        base_url="https://jbi-ribdach.rib40.cloud/itwo40/services",
        rib_company_code="999",
        allowed_users=["Bardia.pazoki@julius-berger.com"],  
    )
    tng_company = Company(
        company_id="cmp_tng_1000",
        org_id=tng_org_id,
        code="TNG-100",
        base_url="https://tng-linkdigital.rib40.cloud/itwo40/services",
        rib_company_code="1000",
        allowed_users=["API"], 
    )

    state = {
        "orgs": {demo_org_id: demo_org.model_dump(), tng_org_id: tng_org.model_dump()},
        "companies": {
            demo_company.company_id: demo_company.model_dump(),
            tng_company.company_id: tng_company.model_dump(),
        },
        "sessions": {},
        "metrics": {
            demo_org_id: MetricCounters().model_dump(),
            tng_org_id: MetricCounters().model_dump(),
        },
        "tickets": {},
        "helpdesk_conversations": {},
        "backup_jobs": {},
    }
    return state


def load_state() -> None:
    global ORGS, COMPANIES, SESSIONS, METRICS, TICKETS, HELPDESK_CONVERSATIONS, BACKUP_JOBS, COMPANY_BY_CODE

    if not STATE_FILE.exists():
        data = _default_state()
        STATE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

    try:
        raw = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        raw = _default_state()

    ORGS = {k: Organization(**v) for k, v in raw.get("orgs", {}).items()}
    COMPANIES = {k: Company(**v) for k, v in raw.get("companies", {}).items()}
    SESSIONS = {k: Session(**v) for k, v in raw.get("sessions", {}).items()}
    METRICS = {
        k: MetricCounters(**v)
        for k, v in raw.get("metrics", {}).items()
    }
    TICKETS = {k: Ticket(**v) for k, v in raw.get("tickets", {}).items()}
    HELPDESK_CONVERSATIONS = {
        k: HelpdeskConversation(**v) for k, v in raw.get("helpdesk_conversations", {}).items()
    }
    BACKUP_JOBS = {
        k: ProjectBackupJob(**v) for k, v in raw.get("backup_jobs", {}).items()
    }

    # rebuild company code index
    COMPANY_BY_CODE = {}
    for cid, c in COMPANIES.items():
        COMPANY_BY_CODE[c.code.lower()] = cid

    # ensure metrics for all orgs
    for oid in ORGS.keys():
        if oid not in METRICS:
            METRICS[oid] = MetricCounters()

    save_state()


def save_state() -> None:
    data = {
        "orgs": {k: v.model_dump() for k, v in ORGS.items()},
        "companies": {k: v.model_dump() for k, v in COMPANIES.items()},
        "sessions": {k: v.model_dump() for k, v in SESSIONS.items()},
        "metrics": {k: v.model_dump() for k, v in METRICS.items()},
        "tickets": {k: v.model_dump() for k, v in TICKETS.items()},
        "helpdesk_conversations": {
            k: v.model_dump() for k, v in HELPDESK_CONVERSATIONS.items()
        },
        "backup_jobs": {k: v.model_dump() for k, v in BACKUP_JOBS.items()},
    }
    STATE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


# ───────────────────────── Lookup helpers ─────────────────────────


def get_org_and_company_by_code(code: str) -> Tuple[Organization, Company]:
    cid = COMPANY_BY_CODE.get(code.lower())
    if not cid:
        raise KeyError("Unknown company code")
    company = COMPANIES[cid]
    org = ORGS[company.org_id]
    return org, company


def get_session(token: str) -> Optional[Session]:
    return SESSIONS.get(token)


def save_session(sess: Session) -> None:
    SESSIONS[sess.token] = sess
    save_state()


def delete_session(token: str) -> None:
    if token in SESSIONS:
        del SESSIONS[token]
        save_state()


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
    org_id = f"org_{uuid.uuid4().hex[:8]}"
    company_id = f"cmp_{uuid.uuid4().hex[:8]}"

    org = Organization(
        org_id=org_id,
        name=name,
        contact_email=contact_email,
        contact_phone=contact_phone,
        notes=notes,
        license={
            "plan": plan,
            "active": True,
            "current_period_end": current_period_end,
        },
        features={},
    )
    company = Company(
        company_id=company_id,
        org_id=org_id,
        code=code,
        base_url=base_url,
        rib_company_code=rib_company_code,
        allowed_users=allowed_users or [],
    )

    ORGS[org_id] = org
    COMPANIES[company_id] = company
    COMPANY_BY_CODE[code.lower()] = company_id
    METRICS.setdefault(org_id, MetricCounters())
    save_state()
    return org, company


def update_org(org: Organization) -> None:
    ORGS[org.org_id] = org
    if org.org_id not in METRICS:
        METRICS[org.org_id] = MetricCounters()
    save_state()


def update_company(company: Company) -> None:
    COMPANIES[company.company_id] = company
    COMPANY_BY_CODE[company.code.lower()] = company.company_id
    save_state()


# ───────────────────────── Metrics ─────────────────────────


def record_request(org_id: Optional[str], route: str, feature: Optional[str] = None) -> None:
    if not org_id:
        return
    mc = METRICS.setdefault(org_id, MetricCounters())
    mc.total_requests += 1
    mc.per_route[route] = mc.per_route.get(route, 0) + 1
    if feature:
        mc.per_feature[feature] = mc.per_feature.get(feature, 0) + 1
    METRICS[org_id] = mc
    save_state()


def record_rib_call(org_id: Optional[str], feature: str) -> None:
    if not org_id:
        return
    mc = METRICS.setdefault(org_id, MetricCounters())
    mc.total_rib_calls += 1
    feat = feature or "unknown"
    mc.rib_calls_by_feature[feat] = mc.rib_calls_by_feature.get(feat, 0) + 1
    METRICS[org_id] = mc
    save_state()


# ───────────────────────── Tickets ─────────────────────────


def create_ticket(
    *,
    org_id: str,
    company_id: Optional[str],
    user_id: Optional[str],
    subject: str,
    priority: str,
    text: str,
) -> Ticket:
    now = int(time.time())
    ticket_id = f"tkt_{uuid.uuid4().hex[:10]}"
    msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:10]}",
        "timestamp": now,
        "sender": "user",
        "text": text,
    }
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
    save_state()
    return t


def add_ticket_message(ticket_id: str, sender: str, text: str) -> Ticket:
    now = int(time.time())
    t = TICKETS[ticket_id]
    t.messages.append(
        {
            "message_id": f"msg_{uuid.uuid4().hex[:10]}",
            "timestamp": now,
            "sender": sender,
            "text": text,
        }  # type: ignore[arg-type]
    )
    t.updated_at = now
    TICKETS[ticket_id] = t
    save_state()
    return t


# ───────────────────────── Helpdesk ─────────────────────────


def get_user_conversations(org_id: str, company_id: str, user_id: str) -> List[HelpdeskConversation]:
    return [
        c for c in HELPDESK_CONVERSATIONS.values()
        if c.org_id == org_id and c.company_id == company_id and c.user_id == user_id
    ]


def get_conversation(conv_id: str) -> HelpdeskConversation:
    return HELPDESK_CONVERSATIONS[conv_id]


def save_conversation(conv: HelpdeskConversation) -> None:
    HELPDESK_CONVERSATIONS[conv.conversation_id] = conv
    save_state()


def create_conversation(org_id: str, company_id: str, user_id: str) -> HelpdeskConversation:
    now = int(time.time())
    conv = HelpdeskConversation(
        conversation_id=f"conv_{uuid.uuid4().hex[:10]}",
        org_id=org_id,
        company_id=company_id,
        user_id=user_id,
        created_at=now,
        updated_at=now,
        messages=[],
    )
    HELPDESK_CONVERSATIONS[conv.conversation_id] = conv
    save_state()
    return conv


# ───────────────────────── Backup jobs ─────────────────────────


def create_backup_job(
    *,
    org_id: str,
    company_id: str,
    user_id: str,
    project_id: str,
    project_name: str,
    options: Dict[str, bool],
) -> ProjectBackupJob:
    now = int(time.time())
    job = ProjectBackupJob(
        job_id=f"job_{uuid.uuid4().hex[:10]}",
        org_id=org_id,
        company_id=company_id,
        user_id=user_id,
        project_id=project_id,
        project_name=project_name,
        options=options,
        status="pending",
        log=["Job created"],
        created_at=now,
        updated_at=now,
        download_path=None,
    )
    BACKUP_JOBS[job.job_id] = job
    save_state()
    return job


def save_backup_job(job: ProjectBackupJob) -> None:
    BACKUP_JOBS[job.job_id] = job
    save_state()


# ───────────────────────── Init ─────────────────────────

# Load on import
load_state()
