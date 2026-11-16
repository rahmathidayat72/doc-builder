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
