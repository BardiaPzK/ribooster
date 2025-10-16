# backend/app/models/session.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, Boolean
from app.core.db import Base

class Session(Base):
    __tablename__ = "sessions"
    token: Mapped[str] = mapped_column(String(200), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    org_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[int] = mapped_column(Integer, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
