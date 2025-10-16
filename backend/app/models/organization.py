# backend/app/models/organization.py
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Integer
from app.core.db import Base

class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    company_code: Mapped[str] = mapped_column(String(50), nullable=False)
    access_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    created_at: Mapped[int] = mapped_column(Integer, nullable=False)
    created_by_source: Mapped[str] = mapped_column(String(50), default="admin")
    created_by_name: Mapped[str] = mapped_column(String(100), default="admin")
    contact_email: Mapped[str | None] = mapped_column(String(200))
    contact_phone: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(String(1000))
    deactivated: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_ts: Mapped[int | None] = mapped_column(Integer)

    license = relationship("License", back_populates="org", uselist=False)
