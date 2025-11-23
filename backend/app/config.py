# backend/app/config.py
"""
Simple config + default seed data.
You can edit DEFAULT_ORGS and DEFAULT_COMPANIES directly here.
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
    ADMIN_USERS: dict[str, str] = {
        "admin": "admin",
    }

    # Session
    SESSION_TTL_SECONDS: int = 8 * 60 * 60  # 8h

    class Config:
        env_prefix = "RIBOOSTER_"


settings = Settings()


# ---- Default seed data (editable) ----

# Organizations (per customer)
# org_id must be unique; access_code is what user types in login "Company Code" field.
DEFAULT_ORGS = [
    {
        "org_id": "org_tng",
        "name": "TransnetBW Sample",
        "access_code": "TNG-100",
        "contact_email": "admin@tng-sample.local",
        "contact_phone": "",
        "notes": "Sample organization; you can edit this in config.py.",
        "deactivated": False,
        "created_by": "system",
        "created_at": 1710000000,
        "license": {
            "plan": "monthly",
            "active": True,
            "current_period_end": 1893456000,  # 2030-01-01
        },
        "features": [
            "projects.backup",
            "ai.helpdesk",
        ],
        "last_login_ts": None,
    }
]

# Companies (mapping access_code -> RIB base_url + company_code)
# For now: 1 company per org. You can add more later if needed.
DEFAULT_COMPANIES = [
    {
        "company_id": "cmp_tng_1",
        "org_id": "org_tng",
        "code": "TNG-100",  # must match Org.access_code
        "base_url": "https://tng-linkdigital.rib40.cloud/itwo40/services",
        "rib_company_code": "1000",
        "allowed_users": [
            "API",
        ],
    }
]
