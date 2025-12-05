# backend/app/db.py
from __future__ import annotations

import os
import json
import time
from typing import List

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Boolean,
    Text,
    ForeignKey,
)
from sqlalchemy import text as sql_text
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session

# ---------------------- Engine & Session ----------------------

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ribooster.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------- ORM Models ----------------------


class DBOrganization(Base):
    __tablename__ = "organizations"

    org_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    contact_email = Column(String)
    contact_phone = Column(String)
    notes = Column(Text)

    license_plan = Column(String, default="monthly")
    license_active = Column(Boolean, default=True)
    license_current_period_end = Column(Integer, nullable=False)

    features_json = Column(Text, default="{}")

    companies = relationship("DBCompany", back_populates="org", cascade="all, delete-orphan")


class DBCompany(Base):
    __tablename__ = "companies"

    company_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, ForeignKey("organizations.org_id"), nullable=False, index=True)

    name = Column(String, nullable=False)
    code = Column(String, nullable=False, unique=True, index=True)
    base_url = Column(String, nullable=False)
    rib_company_code = Column(String, nullable=False)

    allowed_users_json = Column(Text, default="[]")
    ai_api_key = Column(String)
    features_json = Column(Text, default="{}")

    org = relationship("DBOrganization", back_populates="companies")


class DBTicket(Base):
    __tablename__ = "tickets"

    ticket_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, ForeignKey("organizations.org_id"), nullable=False, index=True)
    company_id = Column(String, ForeignKey("companies.company_id"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)

    subject = Column(String, nullable=False)
    priority = Column(String, default="normal")
    status = Column(String, default="open")

    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)

    messages = relationship(
        "DBTicketMessage",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="DBTicketMessage.timestamp",
    )


class DBTicketMessage(Base):
    __tablename__ = "ticket_messages"

    message_id = Column(String, primary_key=True, index=True)
    ticket_id = Column(String, ForeignKey("tickets.ticket_id"), nullable=False, index=True)
    timestamp = Column(Integer, nullable=False)
    sender = Column(String, nullable=False)  # "user" or "admin"
    text = Column(Text, nullable=False)

    ticket = relationship("DBTicket", back_populates="messages")


class DBHelpdeskConversation(Base):
    __tablename__ = "helpdesk_conversations"

    conversation_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, ForeignKey("organizations.org_id"), nullable=False, index=True)
    company_id = Column(String, ForeignKey("companies.company_id"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)

    messages = relationship(
        "DBHelpdeskMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="DBHelpdeskMessage.timestamp",
    )


class DBHelpdeskMessage(Base):
    __tablename__ = "helpdesk_messages"

    message_id = Column(String, primary_key=True, index=True)
    conversation_id = Column(
        String, ForeignKey("helpdesk_conversations.conversation_id"), nullable=False, index=True
    )
    timestamp = Column(Integer, nullable=False)
    sender = Column(String, nullable=False)  # "user" or "ai"
    text = Column(Text, nullable=False)

    conversation = relationship("DBHelpdeskConversation", back_populates="messages")


class DBSession(Base):
    """Durable backend sessions so tokens survive process restarts."""

    __tablename__ = "sessions"

    token = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    username = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    org_id = Column(String, index=True)
    company_id = Column(String, index=True)
    created_at = Column(Integer, nullable=False)
    expires_at = Column(Integer, nullable=False)
    rib_session_json = Column(Text)


class DBBackupJob(Base):
    __tablename__ = "backup_jobs"

    job_id = Column(String, primary_key=True, index=True)
    org_id = Column(String, ForeignKey("organizations.org_id"), nullable=False, index=True)
    company_id = Column(String, ForeignKey("companies.company_id"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)

    project_id = Column(String, nullable=False)
    project_name = Column(String, nullable=False)

    status = Column(String, default="pending")
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)

    log_json = Column(Text, default="[]")
    options_json = Column(Text, default="{}")


class DBPayment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    org_id = Column(String, ForeignKey("organizations.org_id"), nullable=False, index=True)
    created_at = Column(Integer, nullable=False)
    currency = Column(String, default="EUR")
    amount_cents = Column(Integer, nullable=False)
    description = Column(String)
    period_start = Column(Integer)
    period_end = Column(Integer)
    external_id = Column(String)  # e.g. Stripe invoice id


class DBUserLog(Base):
    __tablename__ = "user_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(Integer, nullable=False)
    user_id = Column(String, nullable=False, index=True)
    org_id = Column(String, index=True)
    company_id = Column(String, index=True)
    action = Column(String, nullable=False)
    details_json = Column(Text, default="{}")


# ---------------------- init + seed ----------------------


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    # lightweight migration for features_json on companies (SQLite only)
    if engine.dialect.name == "sqlite":
        with engine.connect() as conn:
            cols = conn.execute(sql_text("PRAGMA table_info(companies)")).fetchall()
            col_names = {c[1] for c in cols}
            if "features_json" not in col_names:
                conn.execute(sql_text("ALTER TABLE companies ADD COLUMN features_json TEXT DEFAULT '{}'"))
                conn.commit()


def seed_default_org_company(db: Session) -> None:
    from sqlalchemy import select

    # if there is already at least 1 org, do nothing
    exists = db.execute(select(DBOrganization.org_id)).first()
    if exists:
        return

    now = int(time.time())
    org_id = "org_tng_100"
    company_id = "comp_tng_100"

    features = {
        "projects.backup": True,
        "ai.helpdesk": True,
        "textsql": True,
    }

    org = DBOrganization(
        org_id=org_id,
        name="TenneT Test Org (TNG-100)",
        contact_email="admin@example.com",
        contact_phone=None,
        notes=None,
        license_plan="monthly",
        license_active=True,
        license_current_period_end=now + 365 * 24 * 3600,
        features_json=json.dumps(features),
    )

    base_url = os.environ.get(
        "TNG100_RIB_HOST",
        "https://tng-linkdigital.rib40.cloud/itwo40/services",
    )
    rib_company_code = os.environ.get("TNG100_RIB_COMPANY", "1000")

    comp = DBCompany(
        company_id=company_id,
        org_id=org_id,
        name="TNG-100",
        code="TNG-100",
        base_url=base_url,
        rib_company_code=rib_company_code,
        allowed_users_json=json.dumps([]),
        ai_api_key=None,
        features_json=json.dumps(features),
    )

    db.add(org)
    db.add(comp)
    db.commit()
