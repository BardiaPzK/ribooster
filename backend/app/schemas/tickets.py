# backend/app/schemas/tickets.py
from pydantic import BaseModel
from typing import List

class TicketCreate(BaseModel):
    subject: str
    priority: str = "normal"
    body: str

class TicketMessageCreate(BaseModel):
    body: str

class TicketOut(BaseModel):
    id: int
    org_id: int
    subject: str
    priority: str
    status: str
    created_at: int
    updated_at: int
