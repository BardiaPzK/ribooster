# backend/app/services/licensing.py
import time
from sqlalchemy.orm import Session
from app.models.license import License

def _period_end(plan: str) -> int:
    now = int(time.time())
    return now + (365*24*3600 if plan == "yearly" else 30*24*3600)

def activate_license(db: Session, org_id: int, plan: str = "monthly") -> License:
    lic = db.get(License, org_id)
    if not lic:
        lic = License(org_id=org_id, plan=plan, active=True, current_period_end=_period_end(plan))
        db.add(lic)
    else:
        lic.plan = plan or lic.plan
        lic.active = True
        lic.current_period_end = _period_end(lic.plan)
    db.commit()
    return lic

def deactivate_license(db: Session, org_id: int) -> None:
    lic = db.get(License, org_id)
    if lic:
        lic.active = False
        db.commit()
