from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.core.middleware import is_allowed_origin
from app.core.security import SESSION_COOKIE_NAME, session_manager

router = APIRouter(prefix="/auth", tags=["Authentication"])


class BootstrapRequest(BaseModel):
    bootstrap_token: str | None = None


class BootstrapResponse(BaseModel):
    success: bool
    csrf_token: str


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
        secure=False,  # Localhost menggunakan HTTP
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
