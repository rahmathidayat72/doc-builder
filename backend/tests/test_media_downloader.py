from __future__ import annotations

import socket
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Pastikan module app dapat di-import
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import SESSION_COOKIE_NAME
from app.db.session import DatabaseManager
from app.main import app
from app.services.auth_service import auth_service
from app.services.media_downloader import (
    ActiveJobExistsError,
    InvalidMediaUrlError,
    JobNotFoundError,
    JobNotReadyError,
    MediaJob,
    QueueFullError,
    QuotaExceededError,
    RateLimitExceededError,
    SsrBlockedError,
    is_safe_ip,
    media_downloader,
    validate_media_url,
)

client = TestClient(app, base_url="http://localhost:8000")


def create_test_user(user_id: str, email: str = "test@example.com") -> None:
    import app.db.session as session_mod
    with session_mod.db_manager.transaction() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?);",
            (user_id, email, "Test User", time.time(), time.time()),
        )


@pytest.fixture(autouse=True)
def fresh_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Menyediakan basis data SQLite baru dan bersih untuk setiap pengujian."""
    test_db = tmp_path / "test_media_downloader.db"
    mgr = DatabaseManager(test_db)
    mgr.init_db()

    # Monkeypatch db_manager di session dan auth_service
    import app.db.session as session_mod
    monkeypatch.setattr(session_mod, "db_manager", mgr)
    monkeypatch.setattr(auth_service, "db", mgr)

    # Monkeypatch workspace
    test_workspace = tmp_path / "temp_workspace"
    test_workspace.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(media_downloader, "workspace_root", test_workspace)
    media_downloader.mock_executor = None


def test_is_safe_ip():
    assert is_safe_ip("8.8.8.8") is True
    assert is_safe_ip("1.1.1.1") is True
    assert is_safe_ip("127.0.0.1") is False
    assert is_safe_ip("10.0.0.1") is False
    assert is_safe_ip("192.168.1.1") is False
    assert is_safe_ip("172.16.0.1") is False
    assert is_safe_ip("169.254.169.254") is False
    assert is_safe_ip("::1") is False
    assert is_safe_ip("invalid-ip") is False


def test_validate_media_url_youtube():
    # Valid
    p, u = validate_media_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ", resolve_dns=False)
    assert p == "youtube"
    assert u == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    p, u = validate_media_url("https://youtu.be/dQw4w9WgXcQ", resolve_dns=False)
    assert p == "youtube"
    assert u == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    p, u = validate_media_url("https://www.youtube.com/shorts/abcdefghijk", resolve_dns=False)
    assert p == "youtube"
    assert u == "https://www.youtube.com/shorts/abcdefghijk"

    # Playlist ditolak
    with pytest.raises(InvalidMediaUrlError, match="playlist"):
        validate_media_url("https://www.youtube.com/watch?v=123&list=PL123456", resolve_dns=False)

    # Non-HTTPS ditolak
    with pytest.raises(InvalidMediaUrlError, match="https://"):
        validate_media_url("http://www.youtube.com/watch?v=123", resolve_dns=False)


def test_validate_media_url_instagram():
    p, u = validate_media_url("https://www.instagram.com/p/C4sD123efg/", resolve_dns=False)
    assert p == "instagram"
    assert u == "https://www.instagram.com/p/C4sD123efg/"

    p, u = validate_media_url("https://instagram.com/reel/C4sD123efg", resolve_dns=False)
    assert p == "instagram"
    assert u == "https://www.instagram.com/p/C4sD123efg/"

    # Profil ditolak
    with pytest.raises(InvalidMediaUrlError, match="bukan profil"):
        validate_media_url("https://www.instagram.com/username/", resolve_dns=False)


def test_validate_media_url_tiktok():
    p, u = validate_media_url("https://www.tiktok.com/@creator/video/7123456789012345678", resolve_dns=False)
    assert p == "tiktok"
    assert u == "https://www.tiktok.com/@creator/video/7123456789012345678"

    p, u = validate_media_url("https://vm.tiktok.com/ZM8abcde/", resolve_dns=False)
    assert p == "tiktok"
    assert u == "https://vm.tiktok.com/ZM8abcde"

    # Live atau feed umum ditolak
    with pytest.raises(InvalidMediaUrlError, match="bukan profil"):
        validate_media_url("https://www.tiktok.com/@creator", resolve_dns=False)


def test_validate_media_url_ssrf_blocked(monkeypatch: pytest.MonkeyPatch):
    def fake_getaddrinfo(host, port, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    with pytest.raises(SsrBlockedError, match="alamat IP non-publik"):
        validate_media_url("https://www.youtube.com/watch?v=123", resolve_dns=True)


def test_media_download_manager_rules():
    user_id = "user_test_1"
    create_test_user(user_id, "user1@example.com")
    ip = "203.0.113.195"
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    # 1. Konfirmasi hak cipta wajib
    with pytest.raises(ValueError, match="hak cipta"):
        media_downloader.create_job(
            user_id=user_id,
            ip_address=ip,
            url=url,
            media_type="video",
            rights_confirmed=False,
        )

    # 2. Sukses membuat job
    job = media_downloader.create_job(
        user_id=user_id,
        ip_address=ip,
        url=url,
        media_type="video",
        rights_confirmed=True,
    )
    assert job["status"] == "queued"
    assert job["platform"] == "youtube"
    job_id = job["job_id"]

    # 3. User active job limit (user_active_count >= 1 ditolak)
    with pytest.raises(ActiveJobExistsError, match="sedang berjalan"):
        media_downloader.create_job(
            user_id=user_id,
            ip_address=ip,
            url="https://www.instagram.com/p/ABC12345/",
            media_type="video",
            rights_confirmed=True,
        )

    # 4. Batalkan job pertama
    cancelled = media_downloader.cancel_job(job_id=job_id, user_id=user_id)
    assert cancelled is True

    status_data = media_downloader.get_job(job_id=job_id, user_id=user_id)
    assert status_data["status"] == "cancelled"


def test_media_download_rate_limit_and_quota(monkeypatch: pytest.MonkeyPatch):
    user_id = "user_rate_limit"
    create_test_user(user_id, "rate@example.com")
    ip = "198.51.100.44"
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    # Buat 3 job berturut-turut (setelah membatalkan yang sebelumnya)
    for _ in range(3):
        j = media_downloader.create_job(
            user_id=user_id,
            ip_address=ip,
            url=url,
            media_type="video",
            rights_confirmed=True,
        )
        media_downloader.cancel_job(j["job_id"], user_id)

    # Job ke-4 dalam jam yang sama harus ditolak
    with pytest.raises(RateLimitExceededError, match="Batas 3 job per jam"):
        media_downloader.create_job(
            user_id=user_id,
            ip_address=ip,
            url=url,
            media_type="video",
            rights_confirmed=True,
        )


def test_media_downloader_worker_execution(tmp_path: Path):
    user_id = "user_worker_test"
    create_test_user(user_id, "worker@example.com")
    ip = "203.0.113.88"
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    # Definisikan mock executor yang membuat file MP4 sintetis
    mock_payload = b"\x00\x00\x00\x20ftypmp42" + b"\x00" * 1024

    def fake_executor(job: MediaJob, job_dir: Path):
        mp4_file = job_dir / "output.mp4"
        mp4_file.write_bytes(mock_payload)
        return True, "output.mp4", None, len(mock_payload), None

    media_downloader.mock_executor = fake_executor

    job = media_downloader.create_job(
        user_id=user_id,
        ip_address=ip,
        url=url,
        media_type="video",
        rights_confirmed=True,
    )
    job_id = job["job_id"]

    # Jalankan proses satu siklus secara langsung
    next_job = media_downloader._pick_next_job()
    assert next_job is not None
    assert next_job.id == job_id
    assert next_job.status == "running"

    media_downloader._process_job(next_job)

    # Periksa status succeeded
    res = media_downloader.get_job(job_id=job_id, user_id=user_id)
    assert res["status"] == "succeeded"
    assert res["file_size_bytes"] == len(mock_payload)
    assert res["filename"] == "output.mp4"

    # Klaim file unduhan
    file_path, filename = media_downloader.claim_file(job_id=job_id, user_id=user_id)
    assert file_path.is_file()
    assert filename == "output.mp4"

    # Klaim kedua kali harus gagal (single-use delivery)
    with pytest.raises(JobNotReadyError, match="sudah tidak tersedia"):
        media_downloader.claim_file(job_id=job_id, user_id=user_id)


def test_media_downloader_api_flow(tmp_path: Path):
    # 1. Register & Login User
    email = "media_user@example.com"
    pwd = "MediaPassword123"
    reg = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd, "name": "Media Downloader Tester"},
    )
    assert reg.status_code == 200
    session_cookie = reg.cookies.get(SESSION_COOKIE_NAME)
    csrf_token = reg.json()["csrf_token"]

    cookies = {SESSION_COOKIE_NAME: session_cookie}
    headers = {"X-CSRF-Token": csrf_token}

    # Definisikan mock executor
    api_payload = b"\x00\x00\x00\x20ftypisom" + b"\x11" * 500

    def fake_executor(job: MediaJob, job_dir: Path):
        out = job_dir / "output.mp4"
        out.write_bytes(api_payload)
        return True, "output.mp4", None, len(api_payload), None

    media_downloader.mock_executor = fake_executor

    # 2. POST tanpa login -> 401
    unauth_client = TestClient(app, base_url="http://localhost:8000")
    unauth_res = unauth_client.post(
        "/api/media-downloads",
        json={
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "media_type": "video",
            "rights_confirmed": True,
        },
        headers={"Origin": "http://localhost:8000"},
    )
    assert unauth_res.status_code == 401

    # 3. POST dengan akun login -> 202
    create_res = client.post(
        "/api/media-downloads",
        json={
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "media_type": "video",
            "rights_confirmed": True,
        },
        cookies=cookies,
        headers=headers,
    )
    assert create_res.status_code == 202
    data = create_res.json()["data"]
    job_id = data["job_id"]
    assert data["status"] == "queued"

    # 4. GET status
    status_res = client.get(
        f"/api/media-downloads/{job_id}",
        cookies=cookies,
        headers=headers,
    )
    assert status_res.status_code == 200
    assert status_res.json()["data"]["status"] == "queued"

    # Jalankan job satu siklus
    picked = media_downloader._pick_next_job()
    assert picked is not None
    media_downloader._process_job(picked)

    # 5. GET status lagi (succeeded)
    status_res2 = client.get(
        f"/api/media-downloads/{job_id}",
        cookies=cookies,
        headers=headers,
    )
    assert status_res2.status_code == 200
    assert status_res2.json()["data"]["status"] == "succeeded"
    assert status_res2.json()["data"]["download_url"] == f"/api/media-downloads/{job_id}/file"

    # 6. Unduh file
    download_res = client.get(
        f"/api/media-downloads/{job_id}/file",
        cookies=cookies,
        headers=headers,
    )
    assert download_res.status_code == 200
    assert download_res.headers["content-type"] == "video/mp4"
    assert "attachment" in download_res.headers["content-disposition"]
    assert len(download_res.content) == len(api_payload)

    # 7. Unduh file kedua kali -> 410 Gone
    download_res2 = client.get(
        f"/api/media-downloads/{job_id}/file",
        cookies=cookies,
        headers=headers,
    )
    assert download_res2.status_code == 410
