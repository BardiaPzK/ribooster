# backend/app/routes/analytics.py
from typing import Dict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.core.db import get_db
from app.core.security import require_admin_session
from app.models.analytics import RibCounter
from app.models.organization import Organization
from app.schemas.analytics import OrgAnalyticsRow

router = APIRouter()

@router.get("/stats")
def global_stats(_=Depends(require_admin_session), db: Session = Depends(get_db)):
    total_rib = db.scalar(select(func.coalesce(func.sum(RibCounter.count), 0))) or 0
    orgs_tracked = db.scalar(select(func.count(func.distinct(RibCounter.org_id)))) or 0
    # events total optional
    return {"total_events": None, "total_rib_requests": int(total_rib), "orgs_tracked": int(orgs_tracked)}

@router.get("/orgs")
def per_org_breakdown(_=Depends(require_admin_session), db: Session = Depends(get_db)) -> list[OrgAnalyticsRow]:
    rows = []
    orgs = db.scalars(select(Organization)).all()
    for o in orgs:
        by_feat: Dict[str,int] = {}
        by_method: Dict[str,int] = {}
        for rc in db.scalars(select(RibCounter).where(RibCounter.org_id == o.id)).all():
            by_feat[rc.feature] = by_feat.get(rc.feature, 0) + rc.count
            by_method[rc.method] = by_method.get(rc.method, 0) + rc.count
        total = sum(by_feat.values())
        if total == 0:  # still include with 0 to keep UI stable
            pass
        rows.append({
            "org_id": o.id,
            "org_name": o.name,
            "total": total,
            "by_feature": by_feat,
            "by_method": by_method,
        })
    rows.sort(key=lambda r: r["total"], reverse=True)
    return rows
