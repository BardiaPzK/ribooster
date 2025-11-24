# backend/app/storage.py
from __future__ import annotations

from typing import Dict, Optional

from .models import Session as SessionModel, MetricCounters

# In-memory session storage (backend sessions, NOT RIB)
SESSIONS: Dict[str, SessionModel] = {}

# In-memory metrics per org
METRICS: Dict[str, MetricCounters] = {}


def save_session(sess: SessionModel) -> None:
    """Store / update a backend session."""
    SESSIONS[sess.token] = sess


def get_session(token: str) -> Optional[SessionModel]:
    """Return a backend session for a token, or None."""
    return SESSIONS.get(token)


def delete_session(token: str) -> None:
    """Remove a backend session."""
    if token in SESSIONS:
        del SESSIONS[token]


def record_request(org_id: str, endpoint: str, feature: str | None = None) -> None:
    """
    Record a generic backend request for metrics.
    Endpoint name is currently not stored, but feature counts are.
    """
    mc = METRICS.setdefault(org_id, MetricCounters())
    mc.total_requests += 1
    if feature:
        mc.per_feature[feature] = mc.per_feature.get(feature, 0) + 1


def record_rib_call(org_id: str, endpoint: str) -> None:
    """
    Record that we called the RIB Web API on behalf of an org.
    """
    mc = METRICS.setdefault(org_id, MetricCounters())
    mc.total_rib_calls += 1
