"""
backend/app/rib_client.py

Minimal RIB 4.0 HTTP client:
- JWT login (basics/api/2.0/logon)
- secureClientRolePart via checkcompanycode
- Simple project listing

Uses requests.Session with RIB standard headers.
"""

from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass
from typing import Dict, List

import requests

from .models import RIBSession


@dataclass
class AuthCfg:
    host: str
    company: str


class Auth:
    """JWT login + header generator."""

    _LEEWAY_SEC = 300

    def __init__(self, cfg: AuthCfg, *, client_tag: str = "ribooster"):
        self.cfg, self.sess = cfg, requests.Session()
        self.sess.headers.update({"X-Client-Tag": client_tag})
        self.token: str = ""
        self.role: str = ""
        self.exp_ts: int | None = None
        self._user: str | None = None
        self._pwd: str | None = None

    # ───────── login + headers ─────────

    def login(self, user: str, pwd: str) -> RIBSession:
        """Login, set token/role, return RIBSession."""
        self._user, self._pwd = user, pwd
        rsp = self.sess.post(
            f"{self.cfg.host}/basics/api/2.0/logon",
            json={"username": user, "password": pwd},
            timeout=30,
        )
        rsp.raise_for_status()
        self.token = rsp.text.strip('"')
        self.role = self._role()
        self.exp_ts = self._exp_epoch(self.token)
        return RIBSession(
            access_token=self.token,
            secure_client_role=self.role,
            host=self.cfg.host,
            company_code=self.cfg.company,
            exp_ts=int(self.exp_ts or 0),
        )

    def hdr(self) -> Dict[str, str]:
        """Headers for authenticated calls."""
        ctx = {
            "dataLanguageId": 1,
            "language": "en",
            "culture": "en-gb",
            "secureClientRole": self.role,
        }
        return {
            "Authorization": f"Bearer {self.token}",
            "Client-Context": json.dumps(ctx),
            "accept": "application/json",
            "Content-Type": "application/json",
        }

    # ───────── helpers ─────────

    def _role(self) -> str:
        url = (
            f"{self.cfg.host}/basics/publicapi/company/1.0/"
            f"checkcompanycode?requestedSignedInCompanyCode={self.cfg.company}"
        )
        rsp = self.sess.get(url, headers={"Authorization": f"Bearer {self.token}"}, timeout=30)
        rsp.raise_for_status()
        part = rsp.json().get("secureClientRolePart")
        if not part:
            raise RuntimeError("secureClientRolePart missing")
        return part

    @staticmethod
    def _exp_epoch(jwt: str) -> int:
        try:
            pay = base64.urlsafe_b64decode(jwt.split(".")[1] + "===").decode()
            return int(json.loads(pay)["exp"])
        except Exception:
            return int(time.time()) + 3600  # 1h fallback


# ───────────────────────── Simple Project API ─────────────────────────


class ProjectApi:
    """
    GET /project/publicapi/project/3.0 with paging.
    Only essentials for Project Backup & simple lists.
    """

    def __init__(self, auth: Auth):
        self.auth = auth
        self.url = f"{auth.cfg.host}/project/publicapi/project/3.0"

    def all(self) -> List[dict]:
        sess = self.auth.sess
        hdr = self.auth.hdr()
        out, skip, page = [], 0, 500
        while True:
            r = sess.get(
                f"{self.url}?$select=Id,ProjectName&$orderBy=ProjectName&$skip={skip}&$top={page}",
                headers=hdr,
                timeout=60,
            )
            r.raise_for_status()
            pl = r.json()
            chunk = pl.get("value", pl) if isinstance(pl, dict) else pl
            if not isinstance(chunk, list):
                chunk = []
            out.extend(chunk)
            if len(chunk) < page:
                break
            skip += page
        return out


def auth_from_rib_session(sess: RIBSession) -> Auth:
    """Build Auth from our stored RIB Session (no re-login)."""
    cfg = AuthCfg(host=sess.host, company=sess.company_code)
    a = Auth(cfg)
    a.token = sess.access_token
    a.role = sess.secure_client_role
    a.exp_ts = sess.exp_ts
    return a
