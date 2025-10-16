# backend/app/models/license.py
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Integer, ForeignKey
from app.core.db import Base

class License(Base):
    __tablename__ = "licenses"
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), primary_key=True)
    plan: Mapped[str] = mapped_column(String(20), default="monthly")
    active: Mapped[bool] = mapped_column(Boolean, default=False)
    current_period_end: Mapped[int] = mapped_column(Integer, default=0)

    org = relationship("Organization", back_populates="license")
