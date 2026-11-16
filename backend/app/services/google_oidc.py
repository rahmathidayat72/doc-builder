from __future__ import annotations

import base64
import hashlib
import secrets
from typing import Any
from urllib.parse import urlencode, urlparse

import requests
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import settings

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
ALLOWED_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


def generate_pkce_pair() -> tuple[str, str]:
    """Menghasilkan pasangan (code_verifier, code_challenge) untuk PKCE (RFC 7636)."""
    raw_verifier = secrets.token_urlsafe(64)
    # RFC 7636: unreserved characters, length 43-128
    code_verifier = raw_verifier[:128]
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return code_verifier, code_challenge


def validate_avatar_url(url: str | None) -> str | None:
    """Memvalidasi bahwa URL avatar berasal dari host Google resmi dan skema HTTPS."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if len(url) > 2048:
        return None
    try:
        parsed = urlparse(url)
    except Exception:
        return None

    if parsed.scheme != "https":
        return None
    if parsed.username or parsed.password:
        return None
    if parsed.port and parsed.port != 443:
        return None

    hostname = (parsed.hostname or "").lower()
    if hostname == "googleusercontent.com" or hostname.endswith(".googleusercontent.com"):
        return url
    return None


class GoogleOIDCService:
    """Layanan integrasi OpenID Connect Google (Authorization Code + PKCE)."""

    def get_redirect_uri(self, base_url: str | None = None) -> str:
        root = (base_url or settings.PUBLIC_BASE_URL).rstrip("/")
        return f"{root}/api/auth/google/callback"

    def build_authorization_url(
        self,
        state: str,
        nonce: str,
        code_challenge: str,
        redirect_uri: str,
        client_id: str | None = None,
    ) -> str:
        cid = client_id or settings.GOOGLE_CLIENT_ID
        if not cid:
            raise ValueError("GOOGLE_CLIENT_ID belum dikonfigurasi.")

        params = {
            "client_id": cid,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": "openid email profile",
            "state": state,
            "nonce": nonce,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "prompt": "select_account",
            "access_type": "online",
        }
        return f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}"

    def exchange_code_for_tokens(
        self,
        code: str,
        code_verifier: str,
        redirect_uri: str,
        client_id: str | None = None,
        client_secret: str | None = None,
        timeout: float = 10.0,
    ) -> dict[str, Any]:
        cid = client_id or settings.GOOGLE_CLIENT_ID
        csecret = client_secret or settings.GOOGLE_CLIENT_SECRET
        if not cid or not csecret:
            raise ValueError("Kredensial Google OAuth (client_id / client_secret) tidak lengkap.")

        payload = {
            "code": code,
            "client_id": cid,
            "client_secret": csecret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        }

        try:
            resp = requests.post(
                GOOGLE_TOKEN_ENDPOINT,
                data=payload,
                headers={"Accept": "application/json"},
                timeout=timeout,
            )
        except Exception as exc:
            raise RuntimeError(f"Gagal menghubungi server token Google: {exc}") from exc

        if resp.status_code != 200:
            is_json = resp.headers.get("content-type", "").startswith("application/json")
            err_data = resp.json() if is_json else {}
            err_desc = (
                err_data.get("error_description") or err_data.get("error") or resp.text[:100]
            )
            raise RuntimeError(f"Pertukaran kode Google gagal ({resp.status_code}): {err_desc}")

        data = resp.json()
        if not data.get("id_token"):
            raise RuntimeError("Respon token Google tidak memuat id_token.")
        return data

    def verify_id_token(
        self,
        id_token_jwt: str,
        expected_nonce: str,
        client_id: str | None = None,
    ) -> dict[str, Any]:
        cid = client_id or settings.GOOGLE_CLIENT_ID
        if not cid:
            raise ValueError("GOOGLE_CLIENT_ID belum dikonfigurasi.")

        request = google_requests.Request()
        try:
            id_info = id_token.verify_oauth2_token(id_token_jwt, request, audience=cid)
        except Exception as exc:
            raise ValueError(f"Verifikasi ID token Google gagal: {exc}") from exc

        iss = id_info.get("iss")
        if iss not in ALLOWED_ISSUERS:
            raise ValueError(f"Issuer ID token tidak sah: {iss}")

        token_nonce = id_info.get("nonce")
        if not token_nonce or token_nonce != expected_nonce:
            raise ValueError("Nonce ID token tidak cocok dengan transaksi autentikasi.")

        sub = id_info.get("sub")
        if not sub:
            raise ValueError("ID token tidak memuat klaim sub (provider_user_id).")

        email = id_info.get("email")
        if not email:
            raise ValueError("ID token tidak memuat alamat email pengguna.")

        email_verified = id_info.get("email_verified")
        if email_verified not in (True, "true", "True", 1):
            raise ValueError("Alamat email Google belum diverifikasi.")

        name = id_info.get("name") or id_info.get("given_name") or "Google User"
        picture = validate_avatar_url(id_info.get("picture"))

        return {
            "sub": str(sub),
            "email": str(email).strip().lower(),
            "name": str(name).strip(),
            "avatar_url": picture,
        }


# ponytail: singleton service for Google OIDC, mockable in test fixtures
google_oidc_service = GoogleOIDCService()
