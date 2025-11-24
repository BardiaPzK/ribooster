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
from dataclasses import dataclass
from typing import Dict, List

import requests

from .models import RIBSession


# ───────────────────────── Config ─────────────────────────


@dataclass
class AuthCfg:
    host: str   # e.g. "https://tng-linkdigital.rib40.cloud/itwo40/services"
    company: str  # e.g. "TNG-100" (RIB company code)


# ───────────────────────── Auth client ─────────────────────────


class Auth:
    """JWT login + header generator for RIB iTWO 4.0."""

    _LEEWAY_SEC = 300

    def __init__(self, cfg: AuthCfg, *, client_tag: str = "ribooster"):
        self.cfg = cfg
        self.sess = requests.Session()
        self.sess.headers.update({"X-Client-Tag": client_tag})

        self.token: str = ""
        self.role: str = ""
        self.exp_ts: int | None = None

    # ───────── login + headers ─────────

    def login(self, username: str, password: str) -> RIBSession:
        """
        Password-based login against /auth/connect/token.
        If this returns 401, usually one of:
          - wrong username / password
          - wrong client_id / scope
          - environment restricted (Scheduled Environment, etc.)
        """

        url = f"{self.cfg.host}/auth/connect/token"

        # IMPORTANT:
        # You MUST align client_id + scope with what Swagger uses for your server.
        # Check in browser devtools -> Network -> token request.
        data = {
            "username": username,
            "password": password,
            "client_id": "itwo",          # CHANGE HERE if Swagger uses a different one
            "grant_type": "password",
            "scope": "openid profile",    # CHANGE HERE to match Swagger if needed
        }

        try:
            resp = self.sess.post(
                url,
                data=data,               # form-encoded
                timeout=30,
            )
        except Exception as e:
            raise RuntimeError(f"RIB auth network error: {e}") from e

        # Better error messages: show full body for 4xx/5xx
        if resp.status_code != 200:
            body_text = resp.text.strip()
            # This will bubble up to FastAPI and you see it in your 401 message
            raise requests.HTTPError(
                f"RIB auth failed {resp.status_code} at {url} - body: {body_text[:500]}",
                response=resp,
            )

        body = resp.json()

        access_token = body.get("access_token")
        if not access_token:
            raise RuntimeError(f"RIB auth: access_token missing in response: {body}")

        # exp from payload or 'expires_in'
        exp_ts = self._exp_epoch(access_token)
        if "expires_in" in body:
            exp_ts = int(time.time()) + int(body["expires_in"])

        # Some servers send secureClientRole directly, some not.
        secure_client_role = body.get("secureClientRole")

        # Fill Auth fields so hdr() works for follow-up calls
        self.token = access_token
        self.exp_ts = exp_ts
        self.role = secure_client_role or ""

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
        Optional extra call to get secureClientRolePart if needed.
        Not used right now, but kept for future.
        """
        url = (
            f"{self.cfg.host}/basics/publicapi/company/1.0/"
            f"checkcompanycode?requestedSignedInCompanyCode={self.cfg.company}"
        )
        rsp = self.sess.get(
            url,
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=30,
        )
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
