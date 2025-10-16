# backend/app/schemas/analytics.py
from pydantic import BaseModel
from typing import Dict

class OrgAnalyticsRow(BaseModel):
    org_id: int
    org_name: str
    total: int
    by_feature: Dict[str, int]
    by_method: Dict[str, int]
