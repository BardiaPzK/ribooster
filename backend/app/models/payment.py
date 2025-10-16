# backend/app/models/payment.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer
from app.core.db import Base

class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    org_id: Mapped[int] = mapped_column(Integer, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="stripe")
    plan: Mapped[str] = mapped_column(String(20), default="monthly")
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="EUR")
    created_at: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500))
