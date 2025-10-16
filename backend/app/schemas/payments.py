# backend/app/schemas/payments.py
from pydantic import BaseModel

class PurchaseRequest(BaseModel):
    org_id: int
    plan: str = "monthly"
    provider: str = "stripe"
