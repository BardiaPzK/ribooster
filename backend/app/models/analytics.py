# backend/app/models/analytics.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, PrimaryKeyConstraint
from app.core.db import Base

class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ts: Mapped[int] = mapped_column(Integer, nullable=False)
    route: Mapped[str] = mapped_column(String(300), default="")
    method: Mapped[str] = mapped_column(String(10), default="GET")
    status_code: Mapped[int] = mapped_column(Integer, default=200)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)

class RibCounter(Base):
    __tablename__ = "rib_counters"
    org_id: Mapped[int] = mapped_column(Integer, nullable=False)
    feature: Mapped[str] = mapped_column(String(100), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False, default="GET")
    count: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (PrimaryKeyConstraint("org_id", "feature", "method"),)
