import json
from typing import Optional, Dict

from .models import Session as SessionModel, MetricCounters, RIBSession
from .db import SessionLocal, DBSession, DBMetricCounter


def _session_to_db(sess: SessionModel) -> DBSession:
    rib_json = json.dumps(sess.rib_session.dict()) if sess.rib_session else None
    return DBSession(
        token=sess.token,
        user_id=sess.user_id,
        username=sess.username,
        display_name=sess.display_name,
        is_admin=sess.is_admin,
        org_id=sess.org_id,
        company_id=sess.company_id,
        created_at=sess.created_at,
        expires_at=sess.expires_at,
        rib_session_json=rib_json,
    )


def _session_from_db(row: DBSession) -> SessionModel:
    rib = None
    if row.rib_session_json:
        try:
            rib = RIBSession(**json.loads(row.rib_session_json))
        except Exception:
            rib = None
    return SessionModel(
        token=row.token,
        user_id=row.user_id,
        username=row.username,
        display_name=row.display_name,
        is_admin=row.is_admin,
        org_id=row.org_id,
        company_id=row.company_id,
        created_at=row.created_at,
        expires_at=row.expires_at,
        rib_session=rib,
    )


def save_session(sess: SessionModel) -> None:
    """Store / update a backend session in the DB so it survives restarts."""
    db = SessionLocal()
    try:
        existing = db.query(DBSession).filter(DBSession.token == sess.token).first()
        if existing:
            db.delete(existing)
            db.flush()
        db.add(_session_to_db(sess))
        db.commit()
    finally:
        db.close()


def get_session(token: str) -> Optional[SessionModel]:
    """Return a backend session for a token, or None."""
    db = SessionLocal()
    try:
        row = db.query(DBSession).filter(DBSession.token == token).first()
        if not row:
            return None
        return _session_from_db(row)
    finally:
        db.close()


def delete_session(token: str) -> None:
    """Remove a backend session."""
    db = SessionLocal()
    try:
        row = db.query(DBSession).filter(DBSession.token == token).first()
        if row:
            db.delete(row)
            db.commit()
    finally:
        db.close()


def record_request(org_id: str, endpoint: str, feature: str | None = None) -> None:
    """Persist a generic backend request for metrics."""
    db = SessionLocal()
    try:
        mc = db.query(DBMetricCounter).filter(DBMetricCounter.org_id == org_id).first()
        if not mc:
            mc = DBMetricCounter(org_id=org_id, total_requests=0, total_rib_calls=0, per_feature_json="{}")
            db.add(mc)
            db.flush()

        mc.total_requests = (mc.total_requests or 0) + 1

        # update per-feature counters
        per_feature: Dict[str, int] = {}
        if mc.per_feature_json:
            try:
                per_feature = json.loads(mc.per_feature_json) or {}
            except Exception:
                per_feature = {}

        if feature:
            per_feature[feature] = per_feature.get(feature, 0) + 1

        mc.per_feature_json = json.dumps(per_feature)
        db.commit()
    finally:
        db.close()


def record_rib_call(org_id: str, endpoint: str) -> None:
    """Persist that we called the RIB Web API on behalf of an org."""
    db = SessionLocal()
    try:
        mc = db.query(DBMetricCounter).filter(DBMetricCounter.org_id == org_id).first()
        if not mc:
            mc = DBMetricCounter(org_id=org_id, total_requests=0, total_rib_calls=0, per_feature_json="{}")
            db.add(mc)
            db.flush()

        mc.total_rib_calls = (mc.total_rib_calls or 0) + 1
        db.commit()
    finally:
        db.close()


def get_metrics(org_id: str) -> MetricCounters:
    """Return persisted metrics for an org (defaults to zeroes)."""
    db = SessionLocal()
    try:
        mc = db.query(DBMetricCounter).filter(DBMetricCounter.org_id == org_id).first()
        if not mc:
            return MetricCounters()

        per_feature: Dict[str, int] = {}
        if mc.per_feature_json:
            try:
                per_feature = json.loads(mc.per_feature_json) or {}
            except Exception:
                per_feature = {}

        return MetricCounters(
            total_requests=mc.total_requests or 0,
            total_rib_calls=mc.total_rib_calls or 0,
            per_feature=per_feature,
        )
    finally:
        db.close()
