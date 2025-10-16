# backend/app/schemas/auth.py
from pydantic import BaseModel

class LoginRequest(BaseModel):
    access_code: str
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    org_id: int | None
    org_name: str | None
    username: str
    display_name: str
    is_admin: bool
    rib_exp_ts: int | None = None
    rib_role: str | None = None
