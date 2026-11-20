from __future__ import annotations

import pytest

from app.core.config import settings
from app.services.google_oidc import (
    generate_pkce_pair,
    google_oidc_service,
    validate_avatar_url,
)


def test_generate_pkce_pair():
    verifier, challenge = generate_pkce_pair()
    assert 43 <= len(verifier) <= 128
    assert len(challenge) > 20
    assert "=" not in challenge


def test_validate_avatar_url():
    # Valid Google usercontent URLs
    assert (
        validate_avatar_url("https://lh3.googleusercontent.com/a/abc")
        == "https://lh3.googleusercontent.com/a/abc"
    )
    assert (
        validate_avatar_url("https://googleusercontent.com/photo.jpg")
        == "https://googleusercontent.com/photo.jpg"
    )

    # Invalid: non-google host, http, credentials, excessive length
    assert validate_avatar_url("http://lh3.googleusercontent.com/a/abc") is None
    assert validate_avatar_url("https://attacker.com/evil.jpg") is None
    assert validate_avatar_url("https://googleusercontent.com.attacker.com/img") is None
    assert validate_avatar_url("https://user:pass@lh3.googleusercontent.com/img") is None
    assert validate_avatar_url("javascript:alert(1)") is None
    assert validate_avatar_url(None) is None
    assert validate_avatar_url("   ") is None
    assert validate_avatar_url("https://lh3.googleusercontent.com/" + "a" * 2500) is None


def test_build_authorization_url(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-cid.apps.googleusercontent.com")
    url = google_oidc_service.build_authorization_url(
        state="state123",
        nonce="nonce456",
        code_challenge="challenge789",
        redirect_uri="https://example.com/api/auth/google/callback",
    )
    assert "https://accounts.google.com/o/oauth2/v2/auth" in url
    assert "client_id=mock-cid.apps.googleusercontent.com" in url
    assert "state=state123" in url
    assert "nonce=nonce456" in url
    assert "code_challenge=challenge789" in url
    assert "code_challenge_method=S256" in url
    assert "prompt=select_account" in url


def test_verify_id_token_claim_validation(monkeypatch: pytest.MonkeyPatch):
    from google.oauth2 import id_token

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-cid.apps.googleusercontent.com")

    # 1. Nonce mismatch
    monkeypatch.setattr(
        id_token,
        "verify_oauth2_token",
        lambda token, req, audience: {
            "iss": "accounts.google.com",
            "sub": "123",
            "email": "test@example.com",
            "email_verified": True,
            "nonce": "different_nonce",
        },
    )
    with pytest.raises(ValueError, match="Nonce ID token tidak cocok"):
        google_oidc_service.verify_id_token("mock_jwt", expected_nonce="expected_nonce")

    # 2. Email unverified
    monkeypatch.setattr(
        id_token,
        "verify_oauth2_token",
        lambda token, req, audience: {
            "iss": "accounts.google.com",
            "sub": "123",
            "email": "test@example.com",
            "email_verified": False,
            "nonce": "correct_nonce",
        },
    )
    with pytest.raises(ValueError, match="Alamat email Google belum diverifikasi"):
        google_oidc_service.verify_id_token("mock_jwt", expected_nonce="correct_nonce")

    # 3. Invalid issuer
    monkeypatch.setattr(
        id_token,
        "verify_oauth2_token",
        lambda token, req, audience: {
            "iss": "rogue-issuer.com",
            "sub": "123",
            "email": "test@example.com",
            "email_verified": True,
            "nonce": "correct_nonce",
        },
    )
    with pytest.raises(ValueError, match="Issuer ID token tidak sah"):
        google_oidc_service.verify_id_token("mock_jwt", expected_nonce="correct_nonce")

    # 4. Valid token
    monkeypatch.setattr(
        id_token,
        "verify_oauth2_token",
        lambda token, req, audience: {
            "iss": "accounts.google.com",
            "sub": "sub-12345",
            "email": "user@example.com",
            "email_verified": True,
            "nonce": "correct_nonce",
            "name": "Test User",
            "picture": "https://lh3.googleusercontent.com/photo.jpg",
        },
    )
    res = google_oidc_service.verify_id_token("mock_jwt", expected_nonce="correct_nonce")
    assert res["sub"] == "sub-12345"
    assert res["email"] == "user@example.com"
    assert res["avatar_url"] == "https://lh3.googleusercontent.com/photo.jpg"


def test_verify_id_token_raises_transient_after_retries(monkeypatch: pytest.MonkeyPatch):
    """Gangguan transport dari Google harus diklasifikasikan sebagai transient dan dicoba ulang."""
    from google.auth.exceptions import TransportError
    from google.oauth2 import id_token

    from app.services.google_oidc import TOKEN_VERIFY_ATTEMPTS, GoogleOIDCTransientError

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-cid.apps.googleusercontent.com")
    calls = {"count": 0}

    def failing_verify(token, request, audience):
        calls["count"] += 1
        raise TransportError("certificate endpoint timed out")

    monkeypatch.setattr(id_token, "verify_oauth2_token", failing_verify)
    monkeypatch.setattr("app.services.google_oidc.time.sleep", lambda _seconds: None)

    with pytest.raises(GoogleOIDCTransientError):
        google_oidc_service.verify_id_token("mock_jwt", expected_nonce="nonce")

    assert calls["count"] == TOKEN_VERIFY_ATTEMPTS


def test_verify_id_token_retries_transient_then_succeeds(monkeypatch: pytest.MonkeyPatch):
    """Percobaan kedua harus berhasil saat gangguan pertama hanya sementara."""
    from google.auth.exceptions import TransportError
    from google.oauth2 import id_token

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-cid.apps.googleusercontent.com")
    calls = {"count": 0}

    def flaky_verify(token, request, audience):
        calls["count"] += 1
        if calls["count"] == 1:
            raise TransportError("temporary certificate fetch failure")
        return {
            "iss": "accounts.google.com",
            "sub": "sub-retry",
            "email": "retry@example.com",
            "email_verified": True,
            "nonce": "nonce",
            "name": "Retry User",
        }

    monkeypatch.setattr(id_token, "verify_oauth2_token", flaky_verify)
    monkeypatch.setattr("app.services.google_oidc.time.sleep", lambda _seconds: None)

    result = google_oidc_service.verify_id_token("mock_jwt", expected_nonce="nonce")

    assert result["sub"] == "sub-retry"
    assert calls["count"] == 2


def test_verify_id_token_raises_invalid_token_on_claim_mismatch(
    monkeypatch: pytest.MonkeyPatch,
):
    """Ketidakcocokan klaim harus diklasifikasikan sebagai token tidak valid."""
    from google.oauth2 import id_token

    from app.services.google_oidc import GoogleOIDCInvalidTokenError

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-cid.apps.googleusercontent.com")
    monkeypatch.setattr(
        id_token,
        "verify_oauth2_token",
        lambda token, request, audience: {
            "iss": "accounts.google.com",
            "sub": "sub-1",
            "email": "user@example.com",
            "email_verified": True,
            "nonce": "wrong",
        },
    )

    with pytest.raises(GoogleOIDCInvalidTokenError):
        google_oidc_service.verify_id_token("mock_jwt", expected_nonce="expected")


def test_exchange_code_classifies_network_failure_as_transient(
    monkeypatch: pytest.MonkeyPatch,
):
    """Kegagalan koneksi saat menukar kode harus menjadi transient, bukan token invalid."""
    import requests

    from app.services.google_oidc import GoogleOIDCTransientError

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-cid")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "mock-secret")

    def failing_post(*args, **kwargs):
        raise requests.exceptions.ConnectionError("network down")

    monkeypatch.setattr("app.services.google_oidc.requests.post", failing_post)

    with pytest.raises(GoogleOIDCTransientError):
        google_oidc_service.exchange_code_for_tokens(
            code="code",
            code_verifier="verifier",
            redirect_uri="http://localhost/api/auth/google/callback",
        )


def test_exchange_code_classifies_rejected_grant_as_invalid_token(
    monkeypatch: pytest.MonkeyPatch,
):
    """Respons non-200 dari Google harus diklasifikasikan sebagai token/kode ditolak."""
    from app.services.google_oidc import GoogleOIDCInvalidTokenError

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-cid")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "mock-secret")

    class FakeResponse:
        status_code = 400
        headers = {"content-type": "application/json"}
        text = "bad request"

        def json(self):
            return {"error": "invalid_grant", "error_description": "Bad Request"}

    monkeypatch.setattr(
        "app.services.google_oidc.requests.post", lambda *args, **kwargs: FakeResponse()
    )

    with pytest.raises(GoogleOIDCInvalidTokenError):
        google_oidc_service.exchange_code_for_tokens(
            code="code",
            code_verifier="verifier",
            redirect_uri="http://localhost/api/auth/google/callback",
        )


def test_verify_id_token_passes_clock_skew_tolerance(monkeypatch: pytest.MonkeyPatch):
    """Memastikan verify_id_token meneruskan toleransi clock skew untuk jam OS yang miring tipis."""
    from google.oauth2 import id_token

    from app.services.google_oidc import TOKEN_CLOCK_SKEW_SECONDS

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-cid.apps.googleusercontent.com")
    captured: dict[str, int] = {}

    def verify_with_skew(token, request, audience=None, clock_skew_in_seconds=0):
        captured["clock_skew"] = clock_skew_in_seconds
        return {
            "iss": "accounts.google.com",
            "sub": "sub-skew",
            "email": "skew@example.com",
            "email_verified": True,
            "nonce": "nonce-skew",
            "name": "Skew User",
        }

    monkeypatch.setattr(id_token, "verify_oauth2_token", verify_with_skew)

    res = google_oidc_service.verify_id_token("mock_jwt", expected_nonce="nonce-skew")
    assert res["sub"] == "sub-skew"
    assert captured["clock_skew"] == TOKEN_CLOCK_SKEW_SECONDS


def test_verify_id_token_treats_google_timeout_as_transient(monkeypatch: pytest.MonkeyPatch):
    """TimeoutError dari google-auth harus diretry dan diklasifikasikan sebagai transient."""
    from google.auth.exceptions import TimeoutError as GoogleTimeoutError
    from google.oauth2 import id_token

    from app.services.google_oidc import TOKEN_VERIFY_ATTEMPTS, GoogleOIDCTransientError

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-cid.apps.googleusercontent.com")
    calls = {"count": 0}

    def timeout_verify(token, request, audience=None, clock_skew_in_seconds=0):
        calls["count"] += 1
        raise GoogleTimeoutError("certs request timed out")

    monkeypatch.setattr(id_token, "verify_oauth2_token", timeout_verify)
    monkeypatch.setattr("app.services.google_oidc.time.sleep", lambda _seconds: None)

    with pytest.raises(GoogleOIDCTransientError):
        google_oidc_service.verify_id_token("mock_jwt", expected_nonce="nonce")

    assert calls["count"] == TOKEN_VERIFY_ATTEMPTS


def test_verify_id_token_sanitizes_malformed_jwt_without_leaking_token(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
):
    """Error format JWT tidak boleh membocorkan token mentah ke pesan exception atau log."""
    from google.auth.exceptions import MalformedError
    from google.oauth2 import id_token

    from app.services.google_oidc import GoogleOIDCInvalidTokenError

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "mock-cid.apps.googleusercontent.com")
    secret_like_token = "secret.payload.signature_token_value"

    def malformed_verify(token, request, audience=None, clock_skew_in_seconds=0):
        raise MalformedError(f"Wrong number of segments in token: {secret_like_token}")

    monkeypatch.setattr(id_token, "verify_oauth2_token", malformed_verify)

    with caplog.at_level("WARNING", logger="satukit.google_oidc"):
        with pytest.raises(GoogleOIDCInvalidTokenError) as exc_info:
            google_oidc_service.verify_id_token(secret_like_token, expected_nonce="nonce")

    assert secret_like_token not in str(exc_info.value)
    assert secret_like_token not in caplog.text


def test_compute_skew_from_headers_adapts_to_server_date(monkeypatch: pytest.MonkeyPatch):
    """Jika jam OS tertinggal dari Date header Google, skew otomatis menyesuaikan."""
    from email.utils import formatdate

    from app.services.google_oidc import TOKEN_CLOCK_SKEW_SECONDS, _compute_skew_from_headers

    fake_local_now = 1_794_971_990.0
    google_server_now = fake_local_now + 450.0  # selisih 7.5 menit
    monkeypatch.setattr("app.services.google_oidc.time.time", lambda: fake_local_now)

    headers = {"Date": formatdate(google_server_now, usegmt=True)}
    skew = _compute_skew_from_headers(headers, TOKEN_CLOCK_SKEW_SECONDS)

    assert skew >= 450 + 120
