"""
Lightweight RIB 4.0 client helpers.
"""

from __future__ import annotations

import base64
import json
import time
from dataclasses import dataclass
from typing import Dict, List

import requests

from .models import RIBSession


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


@dataclass
class AuthCfg:
    host: str  # e.g. "https://x.rib40.cloud/itwo40/services"
    company: str  # e.g. "xx-100"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class Auth:
    """
    RIB authentication using the stable endpoint:
        POST /basics/api/2.0/logon
    """

    def __init__(self, cfg: AuthCfg, client_tag: str = "ribooster"):
        self.cfg = cfg
        self.sess = requests.Session()
        self.sess.headers.update({"X-Client-Tag": client_tag})

        self.token = ""
        self.role = ""
        self.exp_ts: int | None = None

    def login(self, username: str, password: str) -> RIBSession:
        """
        Stable RIB login. Returns:
            - JWT token
            - secureClientRolePart
            - exp time
        """

        url = f"{self.cfg.host}/basics/api/2.0/logon"
        payload = {"username": username, "password": password}

        rsp = self.sess.post(url, json=payload, timeout=30)

        if rsp.status_code != 200:
            raise RuntimeError(
                f"RIB login failed {rsp.status_code} at {url}. Body: {rsp.text[:300]}"
            )

        # response is a quoted token string:  "eyJhbGciOi..."
        jwt_token = rsp.text.strip('"')

        if "." not in jwt_token:
            raise RuntimeError(f"Invalid JWT returned: {jwt_token}")

        self.token = jwt_token

        # secureClientRolePart
        self.role = self._fetch_role()

        # expiry
        self.exp_ts = self._decode_exp(jwt_token)

        return RIBSession(
            access_token=self.token,
            exp_ts=self.exp_ts,
            secure_client_role=self.role,
            host=self.cfg.host,
            company_code=self.cfg.company,
            username=username,
        )

    # -- role lookup --------------------------------------------------------

    def _fetch_role(self) -> str:
        url = (
            f"{self.cfg.host}/basics/publicapi/company/1.0/"
            f"checkcompanycode?requestedSignedInCompanyCode={self.cfg.company}"
        )
        rsp = self.sess.get(
            url,
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=30,
        )
        if rsp.status_code != 200:
            raise RuntimeError("secureClientRolePart lookup failed: " + rsp.text)

        part = rsp.json().get("secureClientRolePart")
        if not part:
            raise RuntimeError("secureClientRolePart missing in response")

        return part

    # -- headers for authenticated calls -----------------------------------

    def hdr(self) -> Dict[str, str]:
        ctx = {
            "dataLanguageId": 1,
            "language": "en",
            "culture": "en-gb",
            "secureClientRole": self.role,
        }
        return {
            "Authorization": f"Bearer {self.token}",
            "Client-Context": json.dumps(ctx),
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    # -- JWT decoding -------------------------------------------------------

    @staticmethod
    def _decode_exp(jwt_token: str) -> int:
        try:
            body = jwt_token.split(".")[1]
            decoded = base64.urlsafe_b64decode(body + "===").decode()
            return int(json.loads(decoded)["exp"])
        except Exception:
            return int(time.time()) + 3600  # fallback 1h


# ---------------------------------------------------------------------------
# Project API
# ---------------------------------------------------------------------------


class ProjectApi:
    def __init__(self, auth: Auth):
        self.auth = auth
        self.url = f"{auth.cfg.host}/project/publicapi/project/3.0"

    def all(self) -> List[dict]:
        """
        Fetch all projects (paged) with stable ordering and minimal fields.
        """
        sess = self.auth.sess
        hdr = self.auth.hdr()

        out: List[dict] = []
        skip, page = 0, 500

        while True:
            url = (
                f"{self.url}"
                f"?$select=Id,ProjectName"
                f"&$orderBy=ProjectName"
                f"&$skip={skip}&$top={page}"
            )
            rsp = sess.get(url, headers=hdr, timeout=60)
            rsp.raise_for_status()

            data = rsp.json()
            chunk = data.get("value", data) if isinstance(data, dict) else data
            if not isinstance(chunk, list):
                chunk = []

            out.extend(chunk)

            if len(chunk) < page:
                break

            skip += page

        return out


# ---------------------------------------------------------------------------
# Estimate / BOQ helpers
# ---------------------------------------------------------------------------


class EstHeaderApi:
    def __init__(self, auth: Auth):
        self.auth = auth
        self.url = f"{auth.cfg.host}/estimate/publicapi/estimate/header/2.0"

    def by_project(self, prj_id: int) -> List[dict]:
        rsp = self.auth.sess.get(
            f"{self.url}?$filter=PrjProjectFk eq {prj_id}",
            headers=self.auth.hdr(),
            timeout=60,
        )
        rsp.raise_for_status()
        payload = rsp.json()
        rows = payload.get("value", payload) if isinstance(payload, dict) else payload
        return rows if isinstance(rows, list) else []


class EstimateLineItemApi:
    PAGE = 500

    def __init__(self, auth: Auth):
        self.auth = auth
        self.url = f"{auth.cfg.host}/estimate/publicapi/estimate/lineitem/3.0"

    def by_header(self, hdr_id: int) -> List[dict]:
        sess, hdr = self.auth.sess, self.auth.hdr()
        out: List[dict] = []
        skip = 0
        while True:
            rsp = sess.get(
                f"{self.url}?$filter=EstHeaderId eq {hdr_id}&$skip={skip}&$top={self.PAGE}",
                headers=hdr,
                timeout=60,
            )
            rsp.raise_for_status()
            payload = rsp.json()
            chunk = payload.get("value", payload) if isinstance(payload, dict) else payload
            if not isinstance(chunk, list):
                chunk = []
            out.extend(chunk)
            if len(chunk) < self.PAGE:
                break
            skip += self.PAGE
        return out


class EstimateResourceApi:
    PAGE = 500

    def __init__(self, auth: Auth):
        self.auth = auth
        self.url = f"{auth.cfg.host}/estimate/publicapi/estimate/resource/1.0"

    def by_header(self, hdr_id: int) -> List[dict]:
        sess, hdr = self.auth.sess, self.auth.hdr()
        out: List[dict] = []
        skip = 0
        while True:
            rsp = sess.get(
                f"{self.url}?$filter=EstHeaderId eq {hdr_id}&$skip={skip}&$top={self.PAGE}",
                headers=hdr,
                timeout=60,
            )
            rsp.raise_for_status()
            payload = rsp.json()
            chunk = payload.get("value", payload) if isinstance(payload, dict) else payload
            if not isinstance(chunk, list):
                chunk = []
            out.extend(chunk)
            if len(chunk) < self.PAGE:
                break
            skip += self.PAGE
        return out


class LineItem2CostGrpApi:
    def __init__(self, auth: Auth):
        self.auth = auth
        self.url = f"{auth.cfg.host}/estimate/publicapi/estimate/LineItem2CostGrp/1.0"

    def items(self, hdr_id: int) -> List[dict]:
        rsp = self.auth.sess.get(
            f"{self.url}?$filter=EstHeaderFk eq {hdr_id}",
            headers=self.auth.hdr(),
            timeout=60,
        )
        rsp.raise_for_status()
        payload = rsp.json()
        rows = payload.get("value", payload) if isinstance(payload, dict) else payload
        return rows if isinstance(rows, list) else []


class BoqApi:
    PAGE = 500

    def __init__(self, auth: Auth):
        self.auth = auth
        self.url = f"{auth.cfg.host}/boq/publicapi/header/2.0"

    def headers(self, *, code_like: str | None = None, only_int: bool = False) -> List[dict]:
        sess, hdr = self.auth.sess, self.auth.hdr()
        out: List[dict] = []
        skip = 0
        while True:
            # No $select / $orderby: let server return the full BOQ header DTO
            url = f"{self.url}?$skip={skip}&$top={self.PAGE}"
            rsp = sess.get(url, headers=hdr, timeout=60)
            rsp.raise_for_status()
            payload = rsp.json()
            chunk = payload.get("value", payload) if isinstance(payload, dict) else payload
            if not isinstance(chunk, list):
                chunk = []
            out.extend(chunk)
            if len(chunk) < self.PAGE:
                break
            skip += self.PAGE

        # Best-effort mapping for UI; Code/Description may not exist on this DTO
        if code_like:
            out = [x for x in out if code_like in str(x.get("Code", ""))]
        if only_int:
            out = [x for x in out if str(x.get("Code", "")).isdigit()]

        return [
            {
                "Id": x.get("Id"),
                "Code": x.get("Code") or str(x.get("BoqHeaderId") or ""),
                "Description": x.get("BoqTypeDesc") or x.get("BoqStructureDesc") or "",
            }
            for x in out
        ]



class ActivityApi:
    def __init__(self, auth: Auth):
        self.auth = auth
        self.url = f"{auth.cfg.host}/scheduling/publicapi/activity/2.0"

    def by_project(self, prj_id: int) -> List[dict]:
        rsp = self.auth.sess.get(
            f"{self.url}?$filter=ProjectId eq {prj_id}",
            headers=self.auth.hdr(),
            timeout=60,
        )
        rsp.raise_for_status()
        payload = rsp.json()
        rows = payload.get("value", payload) if isinstance(payload, dict) else payload
        return rows if isinstance(rows, list) else []


class BoqItemApi:
    PAGE = 500

    def __init__(self, auth: Auth):
        self.auth = auth
        self.url = f"{auth.cfg.host}/boq/publicapi/structure/2.0"

    def all(self) -> List[dict]:
        sess, hdr = self.auth.sess, self.auth.hdr()
        out: List[dict] = []
        skip, page = 0, self.PAGE
        while True:
            rsp = sess.get(f"{self.url}?$skip={skip}&$top={page}", headers=hdr, timeout=60)
            rsp.raise_for_status()
            payload = rsp.json()
            chunk = payload.get("value", payload) if isinstance(payload, dict) else payload
            if not isinstance(chunk, list):
                chunk = []
            out.extend(chunk)
            if len(chunk) < page:
                break
            skip += page
        return out


# ---------------------------------------------------------------------------
# Session Builder
# ---------------------------------------------------------------------------


def auth_from_rib_session(sess: RIBSession) -> Auth:
    cfg = AuthCfg(host=sess.host, company=sess.company_code)
    a = Auth(cfg)
    a.token = sess.access_token
    a.role = sess.secure_client_role or ""
    a.exp_ts = sess.exp_ts
    return a
