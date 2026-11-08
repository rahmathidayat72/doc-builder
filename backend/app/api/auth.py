from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.core.config import settings
from app.core.middleware import is_allowed_origin
from app.core.security import (
    LEGACY_SESSION_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    session_manager,
)
from app.services.auth_service import (
    AccountMergeRequiredError,
    auth_service,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_session_cookie(response: Response, token: str) -> None:
    """Menyetel cookie sesi dengan atribut keamanan HttpOnly dan SameSite=Lax."""
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        secure=settings.IS_PRODUCTION,
        max_age=settings.SESSION_TTL_DAYS * 86400,
    )


def _clear_session_cookie(response: Response) -> None:
    """Menghapus cookie sesi dari browser (termasuk legacy cookie)."""
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
    )
    response.delete_cookie(
        key=LEGACY_SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
    )


# --- Schemas ---


class BootstrapRequest(BaseModel):
    bootstrap_token: str | None = None


class BootstrapResponse(BaseModel):
    success: bool
    csrf_token: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    provider_user_id: str
    email: str
    name: str | None = None
    email_verified: bool = True


class LinkGoogleRequest(BaseModel):
    provider_user_id: str
    email: str
    current_password: str | None = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class AuthResponse(BaseModel):
    success: bool
    user: dict[str, Any]
    csrf_token: str


# --- Multi-User Endpoints ---


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest, request: Request, response: Response):
    """Mendaftarkan akun pengguna baru dan mengembalikan cookie sesi aktif."""
    user, _verification_token = auth_service.register_user(
        email=req.email,
        password=req.password,
        name=req.name,
    )

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    raw_token, csrf_token, _ = auth_service.create_session(
        user.id, ip_address=client_ip, user_agent=user_agent
    )

    _set_session_cookie(response, raw_token)
    return AuthResponse(success=True, user=user.to_dict(), csrf_token=csrf_token)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, request: Request, response: Response):
    """Masuk dengan email dan kata sandi, memverifikasi hash Argon2id."""
    user = auth_service.authenticate_user(email=req.email, password=req.password)

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    raw_token, csrf_token, _ = auth_service.create_session(
        user.id, ip_address=client_ip, user_agent=user_agent
    )

    _set_session_cookie(response, raw_token)
    return AuthResponse(success=True, user=user.to_dict(), csrf_token=csrf_token)


@router.post("/google", response_model=AuthResponse)
def google_auth(req: GoogleAuthRequest, request: Request, response: Response):
    """Menangani otentikasi Google OAuth dengan penegakan Anti-Auto-Merge (BRULE-013)."""
    try:
        user = auth_service.authenticate_or_register_google(
            provider_user_id=req.provider_user_id,
            email=req.email,
            name=req.name or "Google User",
            email_verified=req.email_verified,
        )
    except AccountMergeRequiredError:
        raise

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    raw_token, csrf_token, _ = auth_service.create_session(
        user.id, ip_address=client_ip, user_agent=user_agent
    )

    _set_session_cookie(response, raw_token)
    return AuthResponse(success=True, user=user.to_dict(), csrf_token=csrf_token)


@router.post("/link-google")
def link_google(req: LinkGoogleRequest, request: Request):
    """Menautkan akun Google ke user yang sedang aktif setelah verifikasi password sadar."""
    current_user = getattr(request.state, "current_user", None)
    if not current_user:
        raise HTTPException(status_code=401, detail="Harap masuk terlebih dahulu.")

    auth_service.link_google_account(
        user_id=current_user.id,
        provider_user_id=req.provider_user_id,
        email=req.email,
        current_password=req.current_password,
    )
    return {"success": True, "message": "Akun Google berhasil ditautkan."}


@router.post("/unlink-google")
def unlink_google(request: Request):
    """Memutuskan tautan akun Google (membutuhkan akun telah memiliki password lokal)."""
    current_user = getattr(request.state, "current_user", None)
    if not current_user:
        raise HTTPException(status_code=401, detail="Harap masuk terlebih dahulu.")

    auth_service.unlink_google_account(user_id=current_user.id)
    return {"success": True, "message": "Tautan akun Google berhasil diputuskan."}


@router.get("/me")
def get_current_user_profile(request: Request):
    """Mengembalikan profil pengguna terautentikasi dan daftar integrasi OAuth."""
    current_user = getattr(request.state, "current_user", None)
    csrf_token = getattr(request.state, "csrf_token", "")

    if current_user is None:
        # Mode guest / pengembang lokal
        return {
            "authenticated": True,
            "mode": "guest",
            "user": None,
            "csrf_token": csrf_token or session_manager.csrf_token,
        }

    oauth_accounts = auth_service.get_oauth_accounts_for_user(current_user.id)
    return {
        "authenticated": True,
        "mode": "user",
        "user": current_user.to_dict(),
        "csrf_token": csrf_token,
        "oauth_accounts": oauth_accounts,
    }


@router.post("/change-password")
def change_password(req: ChangePasswordRequest, request: Request):
    """Mengganti kata sandi pengguna."""
    current_user = getattr(request.state, "current_user", None)
    if not current_user:
        raise HTTPException(status_code=401, detail="Harap masuk terlebih dahulu.")

    auth_service.change_password(
        user_id=current_user.id,
        old_password=req.old_password,
        new_password=req.new_password,
    )
    return {"success": True, "message": "Kata sandi berhasil diperbarui."}


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    """Meminta token reset kata sandi (TTL 15 menit)."""
    result = auth_service.create_password_reset_token(req.email)
    payload: dict[str, Any] = {
        "success": True,
        "message": ("Jika alamat email terdaftar, instruksi reset kata sandi telah dikirimkan."),
    }
    # Dalam mode non-produksi/testing, sertakan token untuk verifikasi test otomatis
    if not settings.IS_PRODUCTION and result is not None:
        _user, reset_token = result
        payload["debug_reset_token"] = reset_token

    return payload


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    """Mereset kata sandi menggunakan token single-use."""
    auth_service.reset_password_with_token(raw_token=req.token, new_password=req.new_password)
    return {
        "success": True,
        "message": (
            "Kata sandi berhasil diperbarui. Silakan masuk kembali dengan kata sandi baru Anda."
        ),
    }


@router.post("/logout")
def logout(request: Request, response: Response):
    """Keluar dan mencabut token sesi dari database serta browser."""
    session_cookie = request.cookies.get(SESSION_COOKIE_NAME) or request.cookies.get(
        LEGACY_SESSION_COOKIE_NAME
    )
    if session_cookie:
        auth_service.revoke_session(session_cookie)

    _clear_session_cookie(response)
    return {"success": True, "message": "Berhasil keluar."}


@router.delete("/me")
def delete_account(request: Request, response: Response):
    """Menghapus akun pengguna dan seluruh data terkait secara permanen."""
    current_user = getattr(request.state, "current_user", None)
    if not current_user:
        raise HTTPException(status_code=401, detail="Harap masuk terlebih dahulu.")

    auth_service.delete_user_account(current_user.id)
    _clear_session_cookie(response)
    return {"success": True, "message": "Akun Anda berhasil dihapus secara permanen."}


# --- Backward Compatible Endpoints ---


@router.post("/bootstrap", response_model=BootstrapResponse)
def bootstrap_session(req: BootstrapRequest, request: Request, response: Response):
    """Menukarkan token bootstrap lokal menjadi Session Cookie HttpOnly dan CSRF token."""
    if req.bootstrap_token:
        if not session_manager.verify_bootstrap(req.bootstrap_token):
            raise HTTPException(status_code=401, detail="Token bootstrap tidak valid")
    else:
        origin = request.headers.get("origin")
        if origin and not is_allowed_origin(origin):
            raise HTTPException(status_code=403, detail="Forbidden: Origin tidak tepercaya")

    # Set Cookie Sesi Lokal (HttpOnly, SameSite=Lax)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_manager.session_token,
        httponly=True,
        samesite="lax",
        path="/",
        secure=False,
    )

    return BootstrapResponse(success=True, csrf_token=session_manager.csrf_token)


@router.get("/bootstrap", response_model=BootstrapResponse)
def bootstrap_session_get(request: Request, response: Response):
    origin = request.headers.get("origin")
    if origin and not is_allowed_origin(origin):
        raise HTTPException(status_code=403, detail="Forbidden: Origin tidak tepercaya")

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_manager.session_token,
        httponly=True,
        samesite="lax",
        path="/",
        secure=False,
    )

    return BootstrapResponse(success=True, csrf_token=session_manager.csrf_token)


@router.get("/session")
def check_session():
    """Memeriksa status keaktifan sesi (endpoint terproteksi)."""
    return {"authenticated": True, "environment": "localhost"}
