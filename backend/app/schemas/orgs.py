# backend/app/schemas/orgs.py
from pydantic import BaseModel
from typing import List, Optional

class OrgOut(BaseModel):
    org: dict
    license: dict | None
    features: List[str]
    requests_count: int
