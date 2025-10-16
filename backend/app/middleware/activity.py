# backend/app/middleware/activity.py
import time
from typing import Callable
from starlette.types import ASGIApp, Receive, Scope, Send
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.analytics import Event

class ActivityMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        start = time.perf_counter()
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                duration_ms = (time.perf_counter() - start) * 1000.0
                status = message.get("status", 0)
                try:
                    db: Session = SessionLocal()
                    ev = Event(
                        ts=int(time.time()),
                        route=scope.get("path", ""),
                        method=scope.get("method", ""),
                        status_code=status,
                        duration_ms=duration_ms,
                    )
                    db.add(ev)
                    db.commit()
                except Exception:
                    pass
                finally:
                    try: db.close()
                    except Exception: pass
            await send(message)
        await self.app(scope, receive, send_wrapper)
