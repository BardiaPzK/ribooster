# backend/app/core/config.py
from functools import lru_cache
from typing import List, Dict
import json
import os
from pydantic import Field
from pydantic_settings import BaseSettings

def _parse_list(raw: str | List[str] | None, default: List[str]) -> List[str]:
    if raw is None:
        return default
    if isinstance(raw, list):
        return raw
    s = raw.strip()
    if s.startswith("["):
        try:
            return list(json.loads(s))
        except Exception:
            pass
    return [p.strip() for p in s.split(",") if p.strip()]

def _ensure_sslmode(db_url: str) -> str:
    if "sslmode=" in db_url:
        return db_url
    sep = "&" if "?" in db_url else "?"
    return f"{db_url}{sep}sslmode=require"

class Settings(BaseSettings):
    APP_ENV: str = Field(default="prod")
    LOG_LEVEL: str = Field(default="INFO")

    API_SECRET: str = Field(default="change-me")
    SESSION_TTL: int = Field(default=7 * 24 * 3600)

    ADMIN_ACCESS_CODE: str = Field(default="admin")
    # CSV: username:password pairs
    ADMIN_USERS: str = Field(default="admin:admin,admin2:admin2")

    DATABASE_URL: str = Field(default="postgresql+psycopg2://user:pass@localhost:5432/ribooster?sslmode=require")

    CORS_ALLOW_ORIGINS: List[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])

    @property
    def ADMIN_USER_MAP(self) -> Dict[str, str]:
        out: Dict[str, str] = {}
        for pair in [p.strip() for p in (self.ADMIN_USERS or "").split(",") if p.strip()]:
            if ":" in pair:
                k, v = pair.split(":", 1)
                out[k.strip()] = v.strip()
        return out

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return _ensure_sslmode(self.DATABASE_URL)

    class Config:
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    # Allow DATABASE_URL without sslmode and force it in
    s = Settings()
    os.environ["DATABASE_URL"] = s.SQLALCHEMY_DATABASE_URI
    return s

settings = get_settings()
