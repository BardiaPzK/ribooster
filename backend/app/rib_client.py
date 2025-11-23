# backend/app/rib_client.py
"""
Minimal RIB 4.0 login client.
Used only for login and fetching basic user info.
"""

from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass
from typing import Optional

import httpx


@dataclass
class RibLoginResult:
    token: str
    exp_ts: int
    secure_client_role: str
    display_name: str


def _jwt_exp_epoch(jwt: str) -> int:
    try:
        payload = jwt.split(".")[1]
        decoded = base64.urlsafe_b64decode(payload + "===")
        obj = json.loads(decoded.decode("utf-8"))
        return int(obj.get("exp", 0))
    except Exception:
        return 0


def rib_login(
    *,
    base_url: str,
    rib_company_code: str,
    username: str,
    password: str,
    timeout: float = 30.0,
) -> RibLoginResult:
    """
    Login to RIB 4.0 and return RIB JWT + exp + secureClientRolePart + display name.
    Raises httpx.HTTPError or RuntimeError on error.
    """
    # RIB logon
    logon_url = f"{base_url}/basics/api/2.0/logon"
    company_check_url = (
        f"{base_url}/basics/publicapi/company/1.0/"
        f"checkcompanycode?requestedSignedInCompanyCode={rib_company_code}"
    )
    userinfo_url = f"{base_url}/basics/api/1.0/userinfo"

    with httpx.Client(timeout=timeout) as client:
        logon_resp = client.post(logon_url, json={"username": username, "password": password})
        logon_resp.raise_for_status()
        token = logon_resp.text.strip().strip('"')

        # secureClientRolePart
        r2 = client.get(company_check_url, headers={"Authorization": f"Bearer {token}"})
        r2.raise_for_status()
        role_part = r2.json().get("secureClientRolePart")
        if not role_part:
            raise RuntimeError("secureClientRolePart missing from RIB response")

        # user info (display name)
        ctx_headers = {
            "Authorization": f"Bearer {token}",
            "Client-Context": json.dumps(
                {
                    "dataLanguageId": 1,
                    "language": "en",
                    "culture": "en-gb",
                    "secureClientRole": role_part,
                }
            ),
        }
        r3 = client.get(userinfo_url, headers=ctx_headers)
        r3.raise_for_status()
        userinfo = r3.json()
        display_name = (
            userinfo.get("UserName")
            or userinfo.get("LogonName")
            or username
        )

    exp_ts = _jwt_exp_epoch(token)
    if not exp_ts:
        # Fallback: 2h from now
        exp_ts = int(time.time()) + 2 * 60 * 60

    return RibLoginResult(
        token=token,
        exp_ts=exp_ts,
        secure_client_role=role_part,
        display_name=display_name,
    )
