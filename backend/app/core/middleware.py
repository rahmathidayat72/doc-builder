from __future__ import annotations

import time
import uuid
from urllib.parse import urlparse

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core import audit
from app.core.config import settings
from app.core.security import (
    CSRF_HEADER_NAME,
    LEGACY_SESSION_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    session_manager,
    timing_safe_compare,
)
from app.services.auth_service import auth_service

PUBLIC_PATHS = {
    "/api/health",
    "/api/auth/bootstrap",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/login-init",
    "/api/auth/login-verify",
    "/api/auth/login-challenge-refresh",
    "/api/auth/challenge",
    "/api/auth/verify-email",
    "/api/auth/resend-verification",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/docs",
    "/openapi.json",
}


def is_allowed_origin(origin: str) -> bool:
    """Memeriksa apakah origin berasal dari origin yang terdaftar."""
    if not origin:
        return True
    if origin in settings.ALLOWED_ORIGINS:
        return True
    if not settings.IS_PRODUCTION:
        try:
            parsed = urlparse(origin)
            hostname = parsed.hostname
            if hostname in ("localhost", "127.0.0.1"):
                return True
        except Exception:
            return False
    return False


class SecurityMiddleware(BaseHTTPMiddleware):
    """Middleware penegakan keamanan: Origin Allowlist, Multi-User / Local Session, dan CSRF."""

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

        # Inisialisasi state konteks autentikasi
        request.state.current_user = None
        request.state.csrf_token = None

        # 1. Validasi Header Origin
        origin = request.headers.get("origin")
        if origin and not is_allowed_origin(origin):
            audit_denial("origin", 403)
            return JSONResponse(
                status_code=403,
                content={"success": False, "error": "Forbidden: Origin tidak tepercaya"},
            )

        # 2. Periksa Endpoint Terproteksi
        is_public = (
            path in PUBLIC_PATHS
            or path.startswith("/s/")
            or path.startswith("/api/s/")
            or path.startswith("/api/converter/")
        )
        if path.startswith("/api") and not is_public:
            session_cookie = request.cookies.get(SESSION_COOKIE_NAME) or request.cookies.get(
                LEGACY_SESSION_COOKIE_NAME
            )
            user_session = auth_service.validate_session(session_cookie) if session_cookie else None

            if user_session is not None:
                # Sesi pengguna terdaftar di basis data
                user, expected_csrf = user_session
                request.state.current_user = user
                request.state.csrf_token = expected_csrf

                if request.method in ("POST", "PUT", "DELETE", "PATCH"):
                    csrf_header = request.headers.get(CSRF_HEADER_NAME)
                    if not csrf_header or not timing_safe_compare(csrf_header, expected_csrf):
                        audit_denial("csrf", 403)
                        return JSONResponse(
                            status_code=403,
                            content={
                                "success": False,
                                "error": "Forbidden: Token CSRF tidak valid",
                            },
                        )

                # Penegakan verifikasi email di mode produksi untuk endpoint komputasi server
                if (
                    settings.IS_PRODUCTION
                    and not user.email_verified
                    and not (path.startswith("/api/auth/") or path == "/api/health")
                ):
                    audit_denial("unverified_email", 403)
                    return JSONResponse(
                        status_code=403,
                        content={
                            "success": False,
                            "error": (
                                "Forbidden: Alamat email belum diverifikasi. "
                                "Harap verifikasi email Anda sebelum menggunakan layanan "
                                "komputasi server."
                            ),
                        },
                    )
            elif (
                not settings.IS_PRODUCTION
                and session_cookie
                and session_manager.verify_session(session_cookie)
            ):
                # Fallback sesi lokal (pengujian lokal & guest mode dev)
                request.state.csrf_token = session_manager.csrf_token

                if request.method in ("POST", "PUT", "DELETE", "PATCH"):
                    csrf_header = request.headers.get(CSRF_HEADER_NAME)
                    if not csrf_header or not session_manager.verify_csrf(csrf_header):
                        audit_denial("csrf", 403)
                        return JSONResponse(
                            status_code=403,
                            content={
                                "success": False,
                                "error": "Forbidden: Token CSRF tidak valid",
                            },
                        )
            else:
                audit_denial("session", 401)
                return JSONResponse(
                    status_code=401,
                    content={
                        "success": False,
                        "error": "Unauthorized: Sesi tidak valid",
                    },
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
