# backend/app/models/user.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer
from app.core.db import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    org_id: Mapped[int | None] = mapped_column(Integer, nullable=True)  # None for admin user
    created_at: Mapped[int] = mapped_column(Integer, nullable=False)
