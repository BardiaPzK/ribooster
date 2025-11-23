# backend/app/storage.py
"""
Simple in-memory store with JSON persistence.
You can still edit defaults in config.py; JSON is written on changes.
"""

from __future__ import annotations

import json
import time
from threading import Lock
from typing import Dict

from .config import DATA_FILE, DEFAULT_ORGS, DEFAULT_COMPANIES
from .models import Organization, Company, Session, MetricCounters, MetricsOverview


_lock = Lock()

ORGS: Dict[str, Organization] = {}
COMPANIES: Dict[str, Company] = {}        # company_id -> Company
COMPANY_BY_CODE: Dict[str, str] = {}      # access_code -> company_id
SESSIONS: Dict[str, Session] = {}
METRICS: Dict[str, MetricCounters] = {}   # org_id -> counters


def _now() -> int:
    return int(time.time())


def load_state() -> None:
    """Load state from JSON, or seed from defaults."""
    global ORGS, COMPANIES, COMPANY_BY_CODE, METRICS
    with _lock:
        if DATA_FILE.exists():
            raw = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        else:
            raw = {"orgs": DEFAULT_ORGS, "companies": DEFAULT_COMPANIES, "metrics": {}}

        ORGS = {o["org_id"]: Organization(**o) for o in raw.get("orgs", [])}
        COMPANIES = {c["company_id"]: Company(**c) for c in raw.get("companies", [])}
        COMPANY_BY_CODE = {c.code.lower(): c.company_id for c in COMPANIES.values()}

        METRICS = {
            org_id: MetricCounters(**m) for org_id, m in raw.get("metrics", {}).items()
        }


def save_state() -> None:
    """Persist state to JSON. Short + human readable."""
    with _lock:
        data = {
            "orgs": [o.model_dump() for o in ORGS.values()],
            "companies": [c.model_dump() for c in COMPANIES.values()],
            "metrics": {k: v.model_dump() for k, v in METRICS.items()},
        }
        DATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_org_by_access_code(code: str) -> tuple[Organization, Company] | None:
    """Find organization and company by ribooster login code like 'TNG-100'."""
    cid = COMPANY_BY_CODE.get(code.lower())
    if not cid:
        return None
    company = COMPANIES[cid]
    org = ORGS[company.org_id]
    return org, company


def get_org(org_id: str) -> Organization | None:
    return ORGS.get(org_id)


def upsert_org_and_company(
    *,
    org: Organization,
    company: Company,
) -> None:
    ORGS[org.org_id] = org
    COMPANIES[company.company_id] = company
    COMPANY_BY_CODE[company.code.lower()] = company.company_id
    if org.org_id not in METRICS:
        METRICS[org.org_id] = MetricCounters()
    save_state()


def record_login_success(org_id: str | None) -> None:
    if not org_id:
        return
    m = METRICS.setdefault(org_id, MetricCounters())
    m.logins_success += 1
    m.total_requests += 1
    save_state()


def record_login_failed(org_id: str | None) -> None:
    if not org_id:
        return
    m = METRICS.setdefault(org_id, MetricCounters())
    m.logins_failed += 1
    m.total_requests += 1
    save_state()


def record_route_hit(org_id: str | None, route_name: str) -> None:
    if not org_id:
        return
    m = METRICS.setdefault(org_id, MetricCounters())
    m.total_requests += 1
    m.by_route[route_name] = m.by_route.get(route_name, 0) + 1
    save_state()


def store_session(sess: Session) -> None:
    SESSIONS[sess.token] = sess


def get_session(token: str) -> Session | None:
    sess = SESSIONS.get(token)
    if not sess:
        return None
    if sess.expires_at <= _now():
        # Expired session – delete and return None
        SESSIONS.pop(token, None)
        return None
    return sess


def metrics_overview() -> MetricsOverview:
    total_orgs = len(ORGS)
    active_orgs = sum(1 for o in ORGS.values() if o.license.active and not o.deactivated)
    total_requests = sum(m.total_requests for m in METRICS.values())
    total_logins_success = sum(m.logins_success for m in METRICS.values())
    total_logins_failed = sum(m.logins_failed for m in METRICS.values())
    return MetricsOverview(
        total_orgs=total_orgs,
        active_orgs=active_orgs,
        total_requests=total_requests,
        total_logins_success=total_logins_success,
        total_logins_failed=total_logins_failed,
    )
