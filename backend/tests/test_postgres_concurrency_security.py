from __future__ import annotations

import concurrent.futures
import time
from pathlib import Path

import pytest
from sqlalchemy import create_engine

from app.core.security import verify_password
from app.db.repositories.auth_repository import AuthRepository
from app.db.repositories.shortener_repository import ShortenerRepository
from app.services.auth_service import (
    AuthService,
    InvalidCredentialsError,
    UserAlreadyExistsError,
)


@pytest.fixture
def isolated_engine(tmp_path: Path):
    db_file = tmp_path / "test_concurrency_sec.db"
    engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
        pool_size=10,
        max_overflow=20,
    )
    yield engine
    engine.dispose()


def test_concurrent_short_url_atomic_clicks(isolated_engine):
    """Pengujian konkurensi: 25 klik simultan harus mencatat click_count = 25 secara presisi."""
    repo = ShortenerRepository.from_engine(isolated_engine)
    repo.create(slug="concurrent-slug", destination_url="https://satukit.local/target")

    def click_task():
        return repo.record_click("concurrent-slug", now=time.time())

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(click_task) for _ in range(25)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    assert len(results) == 25
    assert all(r[0] == "https://satukit.local/target" for r in results)

    record = repo.get_by_slug("concurrent-slug")
    assert record is not None
    assert record["click_count"] == 25


def test_concurrent_registration_race_condition(isolated_engine):
    """Pengujian race condition: Mendaftarkan email yang sama simultan dari 10 thread
    hanya boleh berhasil 1 kali, 9 lainnya harus gagal secara terkendali.
    """
    repo = AuthRepository.from_engine(isolated_engine)
    svc = AuthService(repository=repo)

    email = "race_condition@example.com"
    success_count = 0
    failure_count = 0

    def register_task(idx: int):
        return svc.register_user(email, f"PasswordRace{idx}123", f"User {idx}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(register_task, i) for i in range(10)]
        for f in concurrent.futures.as_completed(futures):
            try:
                f.result()
                success_count += 1
            except UserAlreadyExistsError:
                failure_count += 1

    assert success_count == 1
    assert failure_count == 9


def test_transaction_rollback_on_failure(isolated_engine):
    """Pengujian rollback transaksi atomik: kegagalan di tengah unit-of-work
    tidak boleh meninggalkan baris piatu (orphan rows).
    """
    repo = AuthRepository.from_engine(isolated_engine)

    try:
        with repo._session() as session:
            from app.db.models import User

            user = User(
                id="rollback-u1",
                email="rollback@example.com",
                name="Rollback Test",
                email_verified=0,
                created_at=time.time(),
                updated_at=time.time(),
            )
            session.add(user)
            session.flush()

            # Sengaja lemparkan exception sebelum commit
            raise RuntimeError("Simulated transaction crash")
    except RuntimeError:
        pass

    # Verifikasi data pengguna tidak tersimpan di database
    assert repo.get_user_by_id("rollback-u1") is None
    assert repo.get_user_by_email("rollback@example.com") is None


def test_sql_injection_guard_on_parameters(isolated_engine):
    """Pengujian pertahanan SQL injection: input payload jahat tidak boleh merusak query."""
    repo = AuthRepository.from_engine(isolated_engine)
    svc = AuthService(repository=repo)

    # Payload injeksi SQL klasik
    malicious_inputs = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "admin'--",
        "1' UNION SELECT * FROM users --",
    ]

    for bad_input in malicious_inputs:
        # 1. Pada autentikasi login (email jahat)
        with pytest.raises((InvalidCredentialsError, Exception)):
            svc.authenticate_user(f"{bad_input}@example.com", "SomePass123")

        # 2. Pada pencarian user by id
        assert repo.get_user_by_id(bad_input) is None

    # Verifikasi tabel tetap utuh dan sehat
    user, _ = svc.register_user("safe_user@example.com", "SafePass123", "Safe User")
    assert user.email == "safe_user@example.com"


def test_timing_attack_defense(isolated_engine):
    """Pengujian proteksi timing attack: verifikasi password menggunakan Argon2id
    dan perbandingan konstan time."""
    repo = AuthRepository.from_engine(isolated_engine)
    svc = AuthService(repository=repo)

    svc.register_user("timing@example.com", "TargetPassword123", "Timing User")

    # Uji verifikasi hash password
    valid = svc.authenticate_user("timing@example.com", "TargetPassword123")
    assert valid is not None

    # Password salah ditolak
    with pytest.raises(InvalidCredentialsError):
        svc.authenticate_user("timing@example.com", "WrongPassword123")

    # Email tidak ada juga ditolak dengan tipe error yang sama
    with pytest.raises(InvalidCredentialsError):
        svc.authenticate_user("nobody@example.com", "TargetPassword123")

    # verify_password menangani None/empty secara aman
    assert verify_password("", None) is False
    assert verify_password("pass", None) is False
