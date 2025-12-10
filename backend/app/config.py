# backend/app/config.py
"""
Simple config.
Organizations/companies are managed in the database; no built-in seed data.
"""

from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings


BASE_DIR = Path(__file__).resolve().parents[2]  # /app (container root)
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATA_FILE = DATA_DIR / "ribooster_state.json"


class Settings(BaseSettings):
    # App
    APP_NAME: str = "ribooster"
    SECRET_KEY: str = "change-me-later"
    ENV: str = "dev"

    # Admin login
    ADMIN_ACCESS_CODE: str = "Admin"
    ADMIN_USERS: dict[str, str] = {}

    # Session
    SESSION_TTL_SECONDS: int = 8 * 60 * 60  # 8h

    class Config:
        env_prefix = "RIBOOSTER_"


settings = Settings()


# ---- Default seed data (none) ----
DEFAULT_ORGS: list[dict] = []
DEFAULT_COMPANIES: list[dict] = []
