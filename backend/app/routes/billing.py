# backend/app/routes/billing.py
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.security import require_admin_session
from app.schemas.payments import PurchaseRequest
from app.services.licensing import activate_license
from app.models.payment import Payment
from app.models.organization import Organization

router = APIRouter()

def _now() -> int: return int(time.time())

@router.post("/purchase")
def purchase(body: PurchaseRequest, _=Depends(require_admin_session), db: Session = Depends(get_db)):
    org = db.get(Organization, body.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Unknown org")
    # activate license
    lic = activate_license(db, org.id, plan=body.plan)
    pay = Payment(org_id=org.id, provider=body.provider, plan=body.plan, amount_cents=0, currency="EUR", created_at=_now())
    db.add(pay)
    db.commit()
    return {"ok": True, "license": {"plan": lic.plan, "active": lic.active, "current_period_end": lic.current_period_end}}
