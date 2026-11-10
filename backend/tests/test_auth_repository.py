from __future__ import annotations

import time
from pathlib import Path

from sqlalchemy import create_engine

from app.db.repositories.auth_repository import AuthRepository
from app.services.auth_service import AuthService


def test_auth_repository_user_and_session_lifecycle(tmp_path: Path) -> None:
    db_file = tmp_path / "test_repo.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    repo = AuthRepository.from_engine(engine)

    now = time.time()
    user = repo.create_user_with_token(
        user_id="user-123",
        email="repo_user@example.com",
        password_hash="argon2_hashed_secret",
        name="Repo User",
        email_verified=False,
        token_hash="tok-hash-1",
        token_type="email_verification",
        token_expires_at=now + 3600,
        now=now,
    )

    assert user.id == "user-123"
    assert user.email == "repo_user@example.com"
    assert user.has_password is True

    # Get user by id & email
    assert repo.get_user_by_id("user-123") is not None
    assert repo.get_user_by_email("repo_user@example.com") is not None
    assert repo.get_user_by_email("nonexistent@example.com") is None

    # Update password
    repo.update_user_password("user-123", "new_argon2_hash", now + 10)
    updated = repo.get_user_by_id("user-123")
    assert updated is not None
    assert updated.password_hash == "new_argon2_hash"

    # Session CRUD
    repo.create_session(
        token_hash="sess-hash-1",
        user_id="user-123",
        csrf_token="csrf-token-1",
        ip_address="127.0.0.1",
        user_agent="TestAgent",
        created_at=now,
        expires_at=now + 86400,
    )
    sess_res = repo.get_session_with_user("sess-hash-1")
    assert sess_res is not None
    sess_user, csrf_token, exp = sess_res
    assert sess_user.id == "user-123"
    assert csrf_token == "csrf-token-1"
    assert exp > now

    # Revoke session
    repo.revoke_session("sess-hash-1")
    assert repo.get_session_with_user("sess-hash-1") is None

    # Delete user cascading
    repo.delete_user("user-123")
    assert repo.get_user_by_id("user-123") is None

    engine.dispose()


def test_auth_repository_google_oauth_and_reset_token(tmp_path: Path) -> None:
    db_file = tmp_path / "test_oauth_repo.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    repo = AuthRepository.from_engine(engine)

    now = time.time()
    user = repo.create_google_user(
        user_id="g-user-1",
        email="google@example.com",
        name="Google Account",
        email_verified=True,
        provider_user_id="google-sub-42",
        now=now,
    )
    assert user.has_password is False

    # Lookup by provider user id
    found = repo.get_user_by_google_oauth("google-sub-42")
    assert found is not None
    assert found.id == "g-user-1"

    # Check OAuth account list
    accounts = repo.get_oauth_accounts_for_user("g-user-1")
    assert len(accounts) == 1
    assert accounts[0]["provider"] == "google"

    # Password reset token lifecycle
    repo.create_password_reset_token(
        user_id="g-user-1",
        token_hash="reset-hash-abc",
        created_at=now,
        expires_at=now + 900,
    )
    token_row = repo.get_password_reset_token("reset-hash-abc")
    assert token_row is not None
    user_id, used_at, expires_at = token_row
    assert user_id == "g-user-1"
    assert used_at is None
    assert expires_at > now

    consumed_user = repo.consume_password_reset_token(
        user_id="g-user-1",
        new_hash="new_password_hash_after_reset",
        token_hash="reset-hash-abc",
        now=now + 50,
    )
    assert consumed_user.has_password is True

    # Token cannot be consumed twice (used_at is not None)
    after_token = repo.get_password_reset_token("reset-hash-abc")
    assert after_token is not None
    assert after_token[1] is not None

    engine.dispose()


def test_auth_service_dependency_injection_with_repository(tmp_path: Path) -> None:
    db_file = tmp_path / "test_di.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    repo = AuthRepository.from_engine(engine)
    svc = AuthService(repository=repo)

    user, token = svc.register_user("di_user@example.com", "SecurePass123", "DI Tester")
    assert user.email == "di_user@example.com"
    assert len(token) >= 32

    auth_user = svc.authenticate_user("di_user@example.com", "SecurePass123")
    assert auth_user.id == user.id

    engine.dispose()
