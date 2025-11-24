"""
backend/app/rib_client.py

Minimal RIB 4.0 HTTP client:
- JWT login (basics/api/2.0/logon or auth/connect/token)
- secureClientRolePart via checkcompanycode
- Simple project listing

Uses requests.Session with RIB standard headers.
"""

from __future__ import annotations

import base64
import json
import time
from typing import Dict, List

import requests
from pydantic import BaseModel

from .models import RIBSession
from dataclasses import dataclass

@dataclass
class AuthCfg:
    host: str
    company: str


class Auth:
    """JWT login + header generator."""

    _LEEWAY_SEC = 300

    def __init__(self, cfg: AuthCfg, *, client_tag: str = "ribooster"):
        self.cfg = cfg
        self.sess = requests.Session()
        self.sess.headers.update({"X-Client-Tag": client_tag})
        self.token: str = ""
        self.role: str = ""
        self.exp_ts: int | None = None
        self._user: str | None = None
        self._pwd: str | None = None

    # ───────── login + headers ─────────

    def login(self, username: str, password: str) -> RIBSession:
        """
        Login against RIB 4.0 Identity endpoint.

        Expects:
        - auth/connect/token to return access_token, expires_in and (optionally) secureClientRole.
        - If secureClientRole is missing, falls back to checkcompanycode.
        """
        self._user = username
        self._pwd = password

        url = f"{self.cfg.host}/auth/connect/token"
        data = {
            "username": username,
            "password": password,
            "client_id": "itwo",
            "grant_type": "password",
            "scope": "openid profile",
        }

        resp = self.sess.post(url, data=data, timeout=60)
        resp.raise_for_status()
        body = resp.json()

        access_token = body["access_token"]
        # prefer server expires_in, fallback to JWT exp
        expires_in = int(body.get("expires_in", 0) or 0)
        if expires_in > 0:
            exp_ts = int(time.time()) + expires_in
        else:
            exp_ts = self._exp_epoch(access_token)

        secure_client_role = body.get("secureClientRole") or ""

        # If secureClientRole not present in token response, try company check
        if not secure_client_role:
            try:
                secure_client_role = self._role()
            except Exception:
                secure_client_role = ""

        # store on Auth instance for later headers
        self.token = access_token
        self.role = secure_client_role
        self.exp_ts = exp_ts

        return RIBSession(
            access_token=access_token,
            exp_ts=exp_ts,
            secure_client_role=secure_client_role,
            host=self.cfg.host,
            company_code=self.cfg.company,
            username=username,
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
        """
        Fetch secureClientRolePart for current token + company.
        """
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
        """
        Extract exp from JWT payload, fall back to +1h if anything fails.
        """
        try:
            payload_b64 = jwt.split(".")[1]
            padding = (-len(payload_b64)) % 4
            if padding:
                payload_b64 += "=" * padding
            pay = base64.urlsafe_b64decode(payload_b64.encode("ascii")).decode()
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
        out: List[dict] = []
        skip, page = 0, 500

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
    a.role = sess.secure_client_role or ""
    a.exp_ts = sess.exp_ts
    return a
