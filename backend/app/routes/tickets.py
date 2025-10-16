# backend/app/routes/tickets.py
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.core.db import get_db
from app.core.security import require_session
from app.models.ticket import Ticket, TicketMessage

router = APIRouter()

def _now() -> int: return int(time.time())

@router.get("")
def list_tickets(s=Depends(require_session), db: Session = Depends(get_db)):
    q = select(Ticket).where(Ticket.org_id == s.org_id).order_by(Ticket.updated_at.desc())
    rows = db.scalars(q).all()
    return [{
        "id": t.id,
        "org_id": t.org_id,
        "subject": t.subject,
        "priority": t.priority,
        "status": t.status,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    } for t in rows]

@router.post("")
def create_ticket(payload: dict, s=Depends(require_session), db: Session = Depends(get_db)):
    subject = (payload.get("subject") or "").strip()
    body = (payload.get("body") or "").strip()
    priority = (payload.get("priority") or "normal").strip()
    if not subject or not body:
        raise HTTPException(status_code=400, detail="Missing subject or body")
    t = Ticket(
        org_id=s.org_id,
        created_by_user_id=s.user_id,
        subject=subject,
        priority=priority,
        status="open",
        created_at=_now(),
        updated_at=_now(),
    )
    db.add(t); db.commit(); db.refresh(t)
    m = TicketMessage(ticket_id=t.id, ts=_now(), sender="user", body=body)
    db.add(m); db.commit()
    return {"id": t.id, "ok": True}

@router.post("/{ticket_id}/reply")
def reply(ticket_id: int, payload: dict, s=Depends(require_session), db: Session = Depends(get_db)):
    body = (payload.get("body") or "").strip()
    if not body: raise HTTPException(status_code=400, detail="Empty body")
    t = db.get(Ticket, ticket_id)
    if not t or t.org_id != s.org_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    m = TicketMessage(ticket_id=ticket_id, ts=_now(), sender="user", body=body)
    t.updated_at = _now()
    db.add(m); db.commit()
    return {"ok": True}
