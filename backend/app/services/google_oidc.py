from __future__ import annotations

import base64
import hashlib
import logging
import secrets
import time
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlencode, urlparse

import requests
from google.auth import exceptions as google_auth_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import settings

logger = logging.getLogger("satukit.google_oidc")

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
ALLOWED_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
TOKEN_VERIFY_ATTEMPTS = 2
TOKEN_CLOCK_SKEW_SECONDS = 300
MAX_CLOCK_SKEW_SECONDS = 3600
TOKEN_HTTP_TIMEOUT_SECONDS = 10.0


def _sanitize_error_text(text: str, limit: int = 200) -> str:
    """Membersihkan teks error dari newline dan membatasi panjang untuk keamanan log."""
    return " ".join(text.split())[:limit]


def _sanitize_verify_error(exc: Exception) -> str:
    """Merangkum alasan gagal verifikasi JWT tanpa membocorkan token atau segmen mentah."""
    msg = str(exc)
    if (
        "Wrong number of segments in token" in msg
        or "Can't parse segment" in msg
        or "segment should be a JSON object" in msg
    ):
        return "Struktur JWT ID token tidak valid."
    return _sanitize_error_text(msg) or type(exc).__name__


class _BoundedTimeoutRequest(google_requests.Request):
    """Adapter transport google-auth dengan timeout HTTP terbatas dan deteksi clock skew."""

    def __init__(
        self,
        session: requests.Session,
        timeout: float = TOKEN_HTTP_TIMEOUT_SECONDS,
        initial_skew_seconds: int = TOKEN_CLOCK_SKEW_SECONDS,
    ) -> None:
        super().__init__(session=session)
        self._default_timeout = timeout
        self.observed_clock_skew_seconds: int = initial_skew_seconds

    def __call__(
        self,
        url: str,
        method: str = "GET",
        body: Any = None,
        headers: Any = None,
        timeout: Any = None,
        **kwargs: Any,
    ) -> Any:
        effective_timeout = self._default_timeout if timeout is None else timeout
        response = super().__call__(
            url,
            method=method,
            body=body,
            headers=headers,
            timeout=effective_timeout,
            **kwargs,
        )
        self.observed_clock_skew_seconds = _compute_skew_from_headers(
            response.headers, self.observed_clock_skew_seconds
        )
        return response


def _compute_skew_from_headers(headers: Any, current_skew: int = TOKEN_CLOCK_SKEW_SECONDS) -> int:
    """Menghitung toleransi clock skew aman berdasarkan header Date dari server HTTPS Google."""
    try:
        if not headers:
            return current_skew
        date_hdr = headers.get("date") or headers.get("Date")
        if not date_hdr:
            return current_skew
        server_ts = parsedate_to_datetime(date_hdr).timestamp()
        drift = int(abs(server_ts - time.time())) + 120
        return min(MAX_CLOCK_SKEW_SECONDS, max(current_skew, drift))
    except Exception:
        return current_skew


class GoogleOIDCError(Exception):
    """Kesalahan dasar integrasi Google OpenID Connect."""


class GoogleOIDCTransientError(GoogleOIDCError):
    """Gangguan sementara: jaringan, timeout, atau metadata Google tidak tersedia."""


class GoogleOIDCInvalidTokenError(GoogleOIDCError, ValueError):
    """Token/kode Google ditolak atau klaimnya tidak valid."""


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

    def __init__(self) -> None:
        self._observed_clock_skew_seconds: int = TOKEN_CLOCK_SKEW_SECONDS

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
        except requests.exceptions.RequestException as exc:
            logger.warning("Gagal menghubungi server token Google (%s).", type(exc).__name__)
            raise GoogleOIDCTransientError("Gagal menghubungi server token Google.") from exc
        except Exception as exc:
            logger.warning(
                "Kesalahan tak terduga saat menghubungi server token Google (%s).",
                type(exc).__name__,
            )
            raise GoogleOIDCTransientError("Gagal menghubungi server token Google.") from exc

        self._observed_clock_skew_seconds = _compute_skew_from_headers(
            resp.headers, TOKEN_CLOCK_SKEW_SECONDS
        )

        if resp.status_code != 200:
            is_json = resp.headers.get("content-type", "").startswith("application/json")
            try:
                err_data = resp.json() if is_json else {}
            except ValueError:
                err_data = {}
            err_code = _sanitize_error_text(str(err_data.get("error") or "invalid_response"), 64)
            err_desc = _sanitize_error_text(str(err_data.get("error_description") or err_code))
            logger.warning(
                "Pertukaran kode Google gagal (HTTP %d, error=%s): %s",
                resp.status_code,
                err_code,
                err_desc,
            )
            raise GoogleOIDCInvalidTokenError(
                f"Pertukaran kode Google gagal ({resp.status_code}): {err_desc}"
            )

        try:
            data = resp.json()
        except ValueError as exc:
            logger.warning("Respon token Google bukan JSON yang valid.")
            raise GoogleOIDCInvalidTokenError("Respon token Google tidak valid.") from exc

        if not isinstance(data, dict) or not data.get("id_token"):
            logger.warning("Respon token Google tidak memuat id_token.")
            raise GoogleOIDCInvalidTokenError("Respon token Google tidak memuat id_token.")
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

        last_transport_error: Exception | None = None
        id_info: dict[str, Any] | None = None

        with requests.Session() as http_session:
            request = _BoundedTimeoutRequest(
                http_session,
                timeout=TOKEN_HTTP_TIMEOUT_SECONDS,
                initial_skew_seconds=self._observed_clock_skew_seconds,
            )

            for attempt in range(1, TOKEN_VERIFY_ATTEMPTS + 1):
                try:
                    try:
                        id_info = id_token.verify_oauth2_token(
                            id_token_jwt,
                            request,
                            audience=cid,
                            clock_skew_in_seconds=request.observed_clock_skew_seconds,
                        )
                    except TypeError:
                        # Kompatibilitas untuk stub/mock pengujian dengan 3 argumen posisional
                        id_info = id_token.verify_oauth2_token(id_token_jwt, request, audience=cid)
                    except Exception as first_exc:
                        if (
                            "Token used too early" in str(first_exc)
                            and request.observed_clock_skew_seconds > TOKEN_CLOCK_SKEW_SECONDS
                        ):
                            id_info = id_token.verify_oauth2_token(
                                id_token_jwt,
                                request,
                                audience=cid,
                                clock_skew_in_seconds=request.observed_clock_skew_seconds,
                            )
                        else:
                            raise
                    break
                except (
                    google_auth_exceptions.TransportError,
                    google_auth_exceptions.TimeoutError,
                    google_auth_exceptions.ResponseError,
                    requests.exceptions.RequestException,
                    OSError,
                ) as exc:
                    last_transport_error = exc
                    logger.warning(
                        "Verifikasi ID token Google gagal karena gangguan koneksi "
                        "(percobaan %d/%d): %s",
                        attempt,
                        TOKEN_VERIFY_ATTEMPTS,
                        type(exc).__name__,
                    )
                    if attempt < TOKEN_VERIFY_ATTEMPTS:
                        time.sleep(0.5)
                except Exception as exc:
                    safe_reason = _sanitize_verify_error(exc)
                    logger.warning(
                        "Verifikasi ID token Google ditolak (%s): %s",
                        type(exc).__name__,
                        safe_reason,
                    )
                    raise GoogleOIDCInvalidTokenError(
                        f"Verifikasi ID token Google gagal: {safe_reason}"
                    ) from exc

        if id_info is None:
            raise GoogleOIDCTransientError(
                "Verifikasi ID token Google gagal karena gangguan koneksi ke Google."
            ) from last_transport_error

        iss = id_info.get("iss")
        if iss not in ALLOWED_ISSUERS:
            raise GoogleOIDCInvalidTokenError(f"Issuer ID token tidak sah: {iss}")

        token_nonce = id_info.get("nonce")
        if not token_nonce or token_nonce != expected_nonce:
            raise GoogleOIDCInvalidTokenError(
                "Nonce ID token tidak cocok dengan transaksi autentikasi."
            )

        sub = id_info.get("sub")
        if not sub:
            raise GoogleOIDCInvalidTokenError("ID token tidak memuat klaim sub (provider_user_id).")

        email = id_info.get("email")
        if not email:
            raise GoogleOIDCInvalidTokenError("ID token tidak memuat alamat email pengguna.")

        email_verified = id_info.get("email_verified")
        if email_verified not in (True, "true", "True", 1):
            raise GoogleOIDCInvalidTokenError("Alamat email Google belum diverifikasi.")

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
