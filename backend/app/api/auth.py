from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from app.core.security import SESSION_COOKIE_NAME, session_manager

router = APIRouter(prefix="/auth", tags=["Authentication"])


class BootstrapRequest(BaseModel):
    bootstrap_token: str


class BootstrapResponse(BaseModel):
    success: bool
    csrf_token: str


@router.post("/bootstrap", response_model=BootstrapResponse)
def bootstrap_session(req: BootstrapRequest, response: Response):
    """Menukarkan token bootstrap lokal menjadi Session Cookie HttpOnly dan CSRF token."""
    if not session_manager.verify_bootstrap(req.bootstrap_token):
        raise HTTPException(status_code=401, detail="Token bootstrap tidak valid")

    # Set Cookie Sesi Lokal (HttpOnly, SameSite=Strict)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_manager.session_token,
        httponly=True,
        samesite="strict",
        path="/",
        secure=False,  # Localhost menggunakan HTTP
    )

    return BootstrapResponse(success=True, csrf_token=session_manager.csrf_token)


@router.get("/session")
def check_session():
    """Memeriksa status keaktifan sesi (endpoint terproteksi)."""
    return {"authenticated": True, "environment": "localhost"}
