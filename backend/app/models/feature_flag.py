# backend/app/models/feature_flag.py
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, PrimaryKeyConstraint
from app.core.db import Base

class FeatureFlag(Base):
    __tablename__ = "feature_flags"
    org_id: Mapped[int] = mapped_column(Integer, nullable=False)
    feature_key: Mapped[str] = mapped_column(String(100), nullable=False)
    __table_args__ = (PrimaryKeyConstraint("org_id", "feature_key"),)
