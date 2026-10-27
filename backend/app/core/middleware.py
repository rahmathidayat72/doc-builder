import time
import uuid
from urllib.parse import urlparse

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core import audit
from app.core.config import settings
from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager

PUBLIC_PATHS = {"/api/health", "/api/auth/bootstrap", "/docs", "/openapi.json"}


def is_allowed_origin(origin: str) -> bool:
    """Memeriksa apakah origin berasal dari localhost/loopback yang terdaftar."""
    if not origin:
        return True
    if origin in settings.ALLOWED_ORIGINS:
        return True
    try:
        parsed = urlparse(origin)
        hostname = parsed.hostname
        if hostname in ("localhost", "127.0.0.1"):
            return True
    except Exception:
        return False
    return False


class SecurityMiddleware(BaseHTTPMiddleware):
    """Middleware penegakan keamanan localhost: Origin Allowlist, Session Cookie, dan CSRF."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        request_id = uuid.uuid4().hex
        started = time.perf_counter()

        def audit_denial(reason: str, status_code: int) -> None:
            audit.audit_logger.record(
                "security.denied",
                "denied",
                request_id=request_id,
                method=request.method,
                route=path,
                status=status_code,
                reason=reason,
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )

        # 1. Validasi Header Origin
        origin = request.headers.get("origin")
        if origin and not is_allowed_origin(origin):
            audit_denial("origin", 403)
            return JSONResponse(
                status_code=403,
                content={"success": False, "error": "Forbidden: Origin tidak tepercaya"},
            )

        # 2. Periksa Endpoint Terproteksi
        if path.startswith("/api") and path not in PUBLIC_PATHS:
            # Validasi Session Cookie
            session_cookie = request.cookies.get(SESSION_COOKIE_NAME)
            if not session_cookie or not session_manager.verify_session(session_cookie):
                audit_denial("session", 401)
                return JSONResponse(
                    status_code=401,
                    content={"success": False, "error": "Unauthorized: Sesi lokal tidak valid"},
                )

            # Validasi CSRF Token untuk operasi mutasi
            if request.method in ("POST", "PUT", "DELETE", "PATCH"):
                csrf_header = request.headers.get(CSRF_HEADER_NAME)
                if not csrf_header or not session_manager.verify_csrf(csrf_header):
                    audit_denial("csrf", 403)
                    return JSONResponse(
                        status_code=403,
                        content={"success": False, "error": "Forbidden: Token CSRF tidak valid"},
                    )

        try:
            response: Response = await call_next(request)
        except Exception as exc:
            audit.audit_logger.record(
                "api.error",
                "error",
                request_id=request_id,
                method=request.method,
                route=path,
                status=500,
                error_type=type(exc).__name__,
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )
            raise

        if path.startswith("/api") and path != "/api/health":
            audit.audit_logger.record(
                "api.request",
                "allowed",
                request_id=request_id,
                method=request.method,
                route=path,
                status=response.status_code,
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )
        return response
