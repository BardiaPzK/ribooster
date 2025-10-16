# backend/app/services/analytics.py
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.analytics import RibCounter

def record_rib_call(db: Session, org_id: int, feature: str, method: str = "GET") -> None:
    feature = (feature or "unknown").lower()
    method = (method or "GET").upper()
    row = db.get(RibCounter, {"org_id": org_id, "feature": feature, "method": method})
    if not row:
        # emulate composite PK lookup
        q = select(RibCounter).where(
            RibCounter.org_id == org_id,
            RibCounter.feature == feature,
            RibCounter.method == method
        )
        row = db.scalars(q).first()
    if not row:
        row = RibCounter(org_id=org_id, feature=feature, method=method, count=1)
        db.add(row)
    else:
        row.count += 1
    db.commit()
