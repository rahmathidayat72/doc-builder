from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.core.config import settings
from app.core.middleware import is_allowed_origin
from app.core.rate_limiter import get_client_ip, rate_limiter
from app.core.security import (
    LEGACY_SESSION_COOKIE_NAME,
    SESSION_COOKIE_NAME,
    session_manager,
)
from app.services.auth_service import auth_service
from app.services.bot_challenge import bot_challenge_service
from app.services.brevo import brevo_service

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


class ChallengeResponse(BaseModel):
    challenge_token: str
    question: str
    expires_in: int


class LoginInitRequest(BaseModel):
    email: str
    password: str


class LoginInitResponse(BaseModel):
    step: str = "challenge_required"
    challenge_token: str
    question: str
    expires_in: int
    email: str
    user_id: str


class LoginVerifyRequest(BaseModel):
    challenge_token: str
    challenge_answer: int | str


class ChallengeRefreshRequest(BaseModel):
    challenge_token: str


class LoginRequest(BaseModel):
    email: str
    password: str
    challenge_token: str
    challenge_answer: int | str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: str


class AuthResponse(BaseModel):
    success: bool
    user: dict[str, Any]
    csrf_token: str


# --- Multi-User Endpoints ---


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest, request: Request, response: Response):
    """Mendaftarkan akun pengguna baru dan mengirimkan email verifikasi akun."""
    rate_limiter.enforce(
        f"reg:{get_client_ip(request)}",
        max_requests=5,
        window_seconds=300,
        detail="Terlalu banyak pendaftaran akun. Silakan coba beberapa saat lagi.",
    )
    user, verification_token = auth_service.register_user(
        email=req.email,
        password=req.password,
        name=req.name,
    )

    # Kirim email verifikasi akun via Brevo
    brevo_service.send_verification_email(
        email=user.email,
        name=user.name,
        raw_token=verification_token,
        base_url=settings.PUBLIC_BASE_URL,
    )

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    raw_token, csrf_token, _ = auth_service.create_session(
        user.id, ip_address=client_ip, user_agent=user_agent
    )

    _set_session_cookie(response, raw_token)
    user_dict = user.to_dict()
    if not settings.IS_PRODUCTION:
        user_dict["debug_verification_token"] = verification_token

    return AuthResponse(success=True, user=user_dict, csrf_token=csrf_token)


@router.post("/verify-email")
def verify_email(req: VerifyEmailRequest):
    """Memverifikasi alamat email pengguna menggunakan token single-use (TTL 15 menit)."""
    user = auth_service.verify_email_with_token(req.token)
    return {
        "success": True,
        "message": "Alamat email berhasil diverifikasi. Akun Anda kini aktif.",
        "user": user.to_dict(),
    }


@router.post("/resend-verification")
def resend_verification(req: ResendVerificationRequest, request: Request):
    """Mengirim ulang tautan verifikasi email jika akun belum diverifikasi."""
    rate_limiter.enforce(
        f"resend:{get_client_ip(request)}",
        max_requests=3,
        window_seconds=300,
        detail="Terlalu banyak permintaan kirim ulang. Harap tunggu beberapa saat.",
    )
    result = auth_service.resend_verification_token(req.email)
    payload: dict[str, Any] = {
        "success": True,
        "message": (
            "Jika alamat email terdaftar dan belum diverifikasi, tautan verifikasi baru telah dikirimkan."
        ),
    }
    if result is not None:
        user, raw_token = result
        brevo_service.send_verification_email(
            email=user.email,
            name=user.name,
            raw_token=raw_token,
            base_url=settings.PUBLIC_BASE_URL,
        )
        if not settings.IS_PRODUCTION:
            payload["debug_verification_token"] = raw_token

    return payload


@router.post("/challenge", response_model=ChallengeResponse)
def create_bot_challenge():
    """Menghasilkan soal tantangan matematika SD kelas 1 untuk verifikasi anti-bot sebelum login."""
    return bot_challenge_service.generate_challenge()


@router.post("/login-init", response_model=LoginInitResponse)
def login_init(req: LoginInitRequest, request: Request):
    """Tahap 1: Verifikasi email dan kata sandi terlebih dahulu.
    Soal matematika SD hanya di-generate jika kredensial terbukti benar.
    """
    rate_limiter.enforce(
        f"login_init:{get_client_ip(request)}",
        max_requests=10,
        window_seconds=60,
        detail="Terlalu banyak percobaan masuk. Silakan tunggu 1 menit.",
    )
    user = auth_service.authenticate_user(email=req.email, password=req.password)
    if settings.IS_PRODUCTION and not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Alamat email belum diverifikasi. Silakan periksa email Anda atau minta tautan verifikasi baru.",
        )
    ch = bot_challenge_service.generate_challenge(user_id=user.id)
    return LoginInitResponse(
        step="challenge_required",
        challenge_token=ch["challenge_token"],
        question=ch["question"],
        expires_in=ch["expires_in"],
        email=user.email,
        user_id=user.id,
    )


@router.post("/login-challenge-refresh", response_model=ChallengeResponse)
def refresh_login_challenge(req: ChallengeRefreshRequest):
    """Menghasilkan soal matematika baru untuk token yang sedang aktif."""
    parts = req.challenge_token.split(".")
    user_id = parts[2] if len(parts) == 4 else ""
    return bot_challenge_service.generate_challenge(user_id=user_id)


@router.post("/login-verify", response_model=AuthResponse)
def login_verify(req: LoginVerifyRequest, request: Request, response: Response):
    """Tahap 2: Verifikasi jawaban soal matematika anti-bot dan terbitkan sesi login."""
    rate_limiter.enforce(
        f"login_verify:{get_client_ip(request)}",
        max_requests=10,
        window_seconds=60,
        detail="Terlalu banyak percobaan jawaban anti-bot. Silakan tunggu 1 menit.",
    )
    is_valid, err_msg, user_id = bot_challenge_service.verify_challenge(
        token=req.challenge_token,
        answer_input=req.challenge_answer,
    )
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=err_msg or "Jawaban soal anti-bot salah atau token kedaluwarsa.",
        )

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="Token tantangan tidak terikat dengan kredensial pengguna yang valid.",
        )

    user = auth_service.repo.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan.")

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    raw_token, csrf_token, _ = auth_service.create_session(
        user.id, ip_address=client_ip, user_agent=user_agent
    )

    _set_session_cookie(response, raw_token)
    return AuthResponse(success=True, user=user.to_dict(), csrf_token=csrf_token)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, request: Request, response: Response):
    """Masuk dengan email, kata sandi, dan pembuktian jawaban anti-bot matematika SD Kelas 1."""
    rate_limiter.enforce(
        f"login:{get_client_ip(request)}",
        max_requests=10,
        window_seconds=60,
        detail="Terlalu banyak percobaan masuk. Silakan tunggu 1 menit.",
    )
    is_valid, err_msg, _ = bot_challenge_service.verify_challenge(
        token=req.challenge_token,
        answer_input=req.challenge_answer,
    )
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=err_msg or "Tantangan anti-bot tidak valid atau salah.",
        )

    user = auth_service.authenticate_user(email=req.email, password=req.password)

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    raw_token, csrf_token, _ = auth_service.create_session(
        user.id, ip_address=client_ip, user_agent=user_agent
    )

    _set_session_cookie(response, raw_token)
    return AuthResponse(success=True, user=user.to_dict(), csrf_token=csrf_token)


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
def forgot_password(req: ForgotPasswordRequest, request: Request):
    """Meminta token reset kata sandi (TTL 15 menit)."""
    rate_limiter.enforce(
        f"forgot:{get_client_ip(request)}",
        max_requests=5,
        window_seconds=300,
        detail="Terlalu banyak permintaan reset kata sandi. Harap tunggu beberapa saat.",
    )
    result = auth_service.create_password_reset_token(req.email)
    payload: dict[str, Any] = {
        "success": True,
        "message": ("Jika alamat email terdaftar, instruksi reset kata sandi telah dikirimkan."),
    }
    if result is not None:
        user, reset_token = result
        brevo_service.send_password_reset_email(
            email=user.email,
            name=user.name,
            raw_token=reset_token,
            base_url=settings.PUBLIC_BASE_URL,
        )
        if not settings.IS_PRODUCTION:
            payload["debug_reset_token"] = reset_token

    return payload


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, request: Request):
    """Mereset kata sandi menggunakan token single-use dan mencabut seluruh sesi aktif."""
    rate_limiter.enforce(
        f"reset:{get_client_ip(request)}",
        max_requests=5,
        window_seconds=300,
        detail="Terlalu banyak percobaan reset kata sandi. Harap tunggu beberapa saat.",
    )
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
    origin = request.headers.get("origin")
    if origin and not is_allowed_origin(origin):
        raise HTTPException(status_code=403, detail="Forbidden: Origin tidak tepercaya")

    if settings.IS_PRODUCTION:
        import secrets

        return BootstrapResponse(success=True, csrf_token=secrets.token_hex(16))

    if req.bootstrap_token:
        if not session_manager.verify_bootstrap(req.bootstrap_token):
            raise HTTPException(status_code=401, detail="Token bootstrap tidak valid")

    # Set Cookie Sesi Lokal (HttpOnly, SameSite=Lax)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_manager.session_token,
        httponly=True,
        samesite="lax",
        path="/",
        secure=settings.IS_PRODUCTION,
    )

    return BootstrapResponse(success=True, csrf_token=session_manager.csrf_token)


@router.get("/bootstrap", response_model=BootstrapResponse)
def bootstrap_session_get(request: Request, response: Response):
    origin = request.headers.get("origin")
    if origin and not is_allowed_origin(origin):
        raise HTTPException(status_code=403, detail="Forbidden: Origin tidak tepercaya")

    if settings.IS_PRODUCTION:
        import secrets

        return BootstrapResponse(success=True, csrf_token=secrets.token_hex(16))

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_manager.session_token,
        httponly=True,
        samesite="lax",
        path="/",
        secure=settings.IS_PRODUCTION,
    )

    return BootstrapResponse(success=True, csrf_token=session_manager.csrf_token)


@router.get("/session")
def check_session():
    """Memeriksa status keaktifan sesi (endpoint terproteksi)."""
    return {"authenticated": True, "environment": "localhost"}
