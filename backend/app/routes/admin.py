# backend/app/routes/admin.py
import json, time
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, delete
from app.core.db import get_db
from app.core.security import require_admin_session
from app.models.organization import Organization
from app.models.license import License
from app.models.feature_flag import FeatureFlag
from app.models.payment import Payment
from app.models.analytics import RibCounter
from app.models.setting import OrgSetting
from app.schemas.orgs import OrgOut
from app.services.licensing import activate_license as svc_activate, deactivate_license as svc_deactivate

router = APIRouter()

def _now() -> int: return int(time.time())

@router.get("/orgs")
def list_orgs(
    q: str = "",
    plan: Optional[str] = None,
    active: Optional[bool] = Query(None),
    sort: str = "name",
    _=Depends(require_admin_session),
    db: Session = Depends(get_db),
):
    # Build rows to match existing frontend expectations
    orgs = db.scalars(select(Organization)).all()
    out = []
    for org in orgs:
        lic = db.get(License, org.id)
        feats = db.scalars(select(FeatureFlag.feature_key).where(FeatureFlag.org_id == org.id)).all()
        # Filters
        if q and q.lower() not in f"{org.name} {org.base_url} {org.company_code}".lower():
            continue
        if plan and (not lic or lic.plan != plan):
            continue
        if active is not None:
            is_active = (not org.deactivated) and bool(lic and lic.active and lic.current_period_end > _now())
            if is_active != active:
                continue
        # Requests count
        total_req = db.scalar(select(func.coalesce(func.sum(RibCounter.count), 0)).where(RibCounter.org_id == org.id)) or 0
        out.append({
            "org": {
                "org_id": org.id,
                "name": org.name,
                "base_url": org.base_url,
                "company_code": org.company_code,
                "access_code": org.access_code,
                "created_by_source": org.created_by_source,
                "created_by_name": org.created_by_name,
                "contact_email": org.contact_email,
                "contact_phone": org.contact_phone,
                "notes": org.notes,
                "deactivated": org.deactivated,
                "last_login_ts": org.last_login_ts,
            },
            "license": {
                "org_id": org.id,
                "plan": lic.plan if lic else None,
                "active": bool(lic and lic.active and lic.current_period_end > _now()),
                "current_period_end": lic.current_period_end if lic else 0,
            } if lic else None,
            "features": sorted(feats),
            "requests_count": int(total_req),
        })
    if sort == "expires":
        out.sort(key=lambda r: (r["license"]["current_period_end"] if r["license"] else 0))
    elif sort == "requests":
        out.sort(key=lambda r: r["requests_count"], reverse=True)
    elif sort == "last_login":
        out.sort(key=lambda r: (r["org"]["last_login_ts"] or 0), reverse=True)
    else:
        out.sort(key=lambda r: r["org"]["name"].lower())
    return out

@router.post("/orgs")
def create_org_route(payload: dict, _=Depends(require_admin_session), db: Session = Depends(get_db)):
    name = (payload.get("name") or "").strip()
    base_url = (payload.get("base_url") or "").strip()
    company_code = (payload.get("company_code") or "").strip()
    if not name or not base_url or not company_code:
        raise HTTPException(status_code=400, detail="Missing required fields")
    # generate access code like AA-123
    import random, string
    def gen_code() -> str:
        return f"{''.join(random.choices(string.ascii_uppercase,k=2))}-{''.join(random.choices(string.digits,k=3))}"
    code = gen_code()
    while db.scalar(select(Organization).where(Organization.access_code == code)) is not None:
        code = gen_code()
    org = Organization(
        name=name, base_url=base_url, company_code=company_code,
        access_code=code, created_at=_now(), created_by_source="admin", created_by_name="admin",
        contact_email=payload.get("contact_email"), contact_phone=payload.get("contact_phone"),
        notes=payload.get("notes")
    )
    db.add(org)
    db.commit()
    # default license entry (inactive)
    if not db.get(License, org.id):
        db.add(License(org_id=org.id, plan="monthly", active=False, current_period_end=0))
        db.commit()
    return {
        "org_id": org.id, "name": org.name, "base_url": org.base_url,
        "company_code": org.company_code, "access_code": org.access_code
    }

@router.post("/orgs/{org_id}/deactivate")
def deactivate_org_route(org_id: int, _=Depends(require_admin_session), db: Session = Depends(get_db)):
    org = db.get(Organization, org_id)
    if not org: raise HTTPException(status_code=404, detail="Unknown org")
    org.deactivated = True
    db.commit()
    return {"ok": True}

@router.post("/orgs/{org_id}/activate_access")
def activate_org_route(org_id: int, _=Depends(require_admin_session), db: Session = Depends(get_db)):
    org = db.get(Organization, org_id)
    if not org: raise HTTPException(status_code=404, detail="Unknown org")
    org.deactivated = False
    db.commit()
    return {"ok": True}

@router.post("/orgs/{org_id}/license/deactivate")
def deactivate_license_route(org_id: int, _=Depends(require_admin_session), db: Session = Depends(get_db)):
    svc_deactivate(db, org_id)
    return {"ok": True}

@router.post("/orgs/{org_id}/features")
def toggle_features(org_id: int, payload: dict, _=Depends(require_admin_session), db: Session = Depends(get_db)):
    features = payload.get("features") or []
    enabled = bool(payload.get("enabled"))
    # add or delete rows
    for f in features:
        f = (f or "").strip()
        if not f: continue
        exists = db.scalars(select(FeatureFlag).where(FeatureFlag.org_id==org_id, FeatureFlag.feature_key==f)).first()
        if enabled and not exists:
            db.add(FeatureFlag(org_id=org_id, feature_key=f))
        if not enabled and exists:
            db.execute(delete(FeatureFlag).where(FeatureFlag.org_id==org_id, FeatureFlag.feature_key==f))
    db.commit()
    rows = db.scalars(select(FeatureFlag.feature_key).where(FeatureFlag.org_id == org_id)).all()
    return {"ok": True, "features": list(sorted(rows))}

@router.get("/orgs/{org_id}/payments")
def get_payments(org_id: int, _=Depends(require_admin_session), db: Session = Depends(get_db)):
    rows = db.scalars(select(Payment).where(Payment.org_id == org_id).order_by(Payment.created_at.desc())).all()
    return [
        {
            "payment_id": p.id, "org_id": p.org_id, "provider": p.provider, "plan": p.plan,
            "amount_cents": p.amount_cents, "currency": p.currency, "created_at": p.created_at, "note": p.note
        } for p in rows
    ]

@router.get("/orgs/{org_id}/settings")
def get_settings(org_id: int, _=Depends(require_admin_session), db: Session = Depends(get_db)):
    row = db.get(OrgSetting, {"org_id": org_id, "key": "openai_api_key"})
    if not row:
        from sqlalchemy import select
        row = db.scalars(select(OrgSetting).where(OrgSetting.org_id==org_id, OrgSetting.key=="openai_api_key")).first()
    return {"openai_api_key": "set"} if row else {}

@router.post("/orgs/{org_id}/settings")
def set_settings(org_id: int, payload: dict, _=Depends(require_admin_session), db: Session = Depends(get_db)):
    key = (payload.get("openai_api_key") or "").strip()
    if not key:
        return {}
    row = db.get(OrgSetting, {"org_id": org_id, "key": "openai_api_key"})
    if not row:
        from app.models.setting import OrgSetting
        row = OrgSetting(org_id=org_id, key="openai_api_key", value_json=json.dumps({"value":"stored"}))
        db.add(row)
    else:
        row.value_json = json.dumps({"value":"stored"})
    db.commit()
    return {"openai_api_key": "set"}

@router.post("/schema")
def upload_global_schema(file: UploadFile = File(...), _=Depends(require_admin_session), db: Session = Depends(get_db)):
    # Store the raw JSON into a special org_id=0 setting “global_schema”
    raw = file.file.read()
    try:
        json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON schema")
    row = db.get(OrgSetting, {"org_id": 0, "key": "global_schema"})
    if not row:
        from app.models.setting import OrgSetting
        row = OrgSetting(org_id=0, key="global_schema", value_json=raw.decode("utf-8"))
        db.add(row)
    else:
        row.value_json = raw.decode("utf-8")
    db.commit()
    return {"ok": True}
