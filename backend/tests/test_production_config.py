from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_production_validation_fails_on_default_secrets() -> None:
    """Mode produksi wajib fail-fast jika parameter rahasia masih memakai default."""
    s = Settings(
        IS_PRODUCTION=True,
        ENVIRONMENT="production",
        BOT_CHALLENGE_SECRET="satukit-bot-challenge-secret-local-2026",
        SHORTENER_ADMIN_HMAC_SECRET="satukit-shortener-secret-local",
        DATABASE_URL="postgresql+psycopg://satukit_user:satukit_pass@127.0.0.1:5432/satukit",
        PUBLIC_BASE_URL="http://localhost:5173",
    )
    with pytest.raises(ValueError) as exc:
        s.validate_production()
    err_msg = str(exc.value)
    assert "BOT_CHALLENGE_SECRET" in err_msg
    assert "SHORTENER_ADMIN_HMAC_SECRET" in err_msg
    assert "DATABASE_URL" in err_msg
    assert "PUBLIC_BASE_URL" in err_msg


def test_production_validation_passes_with_strong_settings() -> None:
    """Mode produksi sukses jika rahasia kuat, HTTPS, dan kredensial aman."""
    s = Settings(
        IS_PRODUCTION=True,
        ENVIRONMENT="production",
        BOT_CHALLENGE_SECRET="very-strong-secret-key-production-32bytes-entropy",
        SHORTENER_ADMIN_HMAC_SECRET="strong-shortener-secret-production-random-987",
        DATABASE_URL="postgresql+psycopg://satukit_user:StrongRandomPass123!@127.0.0.1:5432/satukit",
        PUBLIC_BASE_URL="https://satukit.id",
    )
    # Tidak melempar exception
    s.validate_production()


def test_docs_and_openapi_disabled_when_docs_disabled() -> None:
    """Ketika DOCS_ENABLED=False, endpoint /docs dan /openapi.json harus 404."""
    from app.core.config import settings

    orig_docs = settings.DOCS_ENABLED
    try:
        settings.DOCS_ENABLED = False
        app = create_app()
        test_client = TestClient(app)
        res_docs = test_client.get("/docs")
        assert res_docs.status_code == 404
        res_openapi = test_client.get("/openapi.json")
        assert res_openapi.status_code == 404
    finally:
        settings.DOCS_ENABLED = orig_docs


def test_trusted_host_middleware_blocks_bad_host() -> None:
    """Host header tidak terdaftar ditolak oleh TrustedHostMiddleware."""
    from app.core.config import settings

    orig_hosts = settings.TRUSTED_HOSTS
    try:
        settings.TRUSTED_HOSTS = ["satukit.id", "localhost"]
        app = create_app()
        test_client = TestClient(app)
        # Host valid
        res_ok = test_client.get("/api/health", headers={"host": "satukit.id"})
        assert res_ok.status_code == 200
        # Host jahat
        res_bad = test_client.get("/api/health", headers={"host": "evil-domain.com"})
        assert res_bad.status_code == 400
    finally:
        settings.TRUSTED_HOSTS = orig_hosts
