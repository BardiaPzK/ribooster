import json, os
from functools import lru_cache
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings

def _parse(raw: str | List[str] | None, default: List[str]) -> List[str]:
    if raw is None:
        return default
    if isinstance(raw, list):
        return raw
    s = raw.strip()
    if s.startswith("["):
        try: return list(json.loads(s))
        except: pass
    return [p.strip() for p in s.split(",") if p.strip()]

class Settings(BaseSettings):
    APP_ENV: str = Field(default="prod")
    LOG_LEVEL: str = Field(default="INFO")
    API_SECRET: str = Field(default="ribooster-secret-001")

    ADMIN_ACCESS_CODE: str = Field(default="admin")
    ADMIN_USERS: str = Field(default="admin:Torodi1992,admin2:Torodi1992")

    CORS_ALLOW_ORIGINS: List[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])

    WEBSITES_PORT: int = Field(default=80)

    @property
    def ADMIN_USER_MAP(self) -> dict[str, str]:
        out: dict[str, str] = {}
        for pair in [p.strip() for p in (self.ADMIN_USERS or "").split(",") if p.strip()]:
            if ":" in pair:
                k, v = pair.split(":", 1)
                out[k.strip()] = v.strip()
        return out

    class Config:
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
