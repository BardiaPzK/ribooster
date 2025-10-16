# backend/app/models/setting.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String, Text, PrimaryKeyConstraint
from app.core.db import Base

class OrgSetting(Base):
    __tablename__ = "org_settings"
    org_id: Mapped[int] = mapped_column(Integer, nullable=False)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    value_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    __table_args__ = (PrimaryKeyConstraint("org_id", "key"),)
