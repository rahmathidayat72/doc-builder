from __future__ import annotations

import ipaddress
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

from app.core.config import settings
from app.db import session as db_session


class MediaDownloaderError(Exception):
    """Base error untuk pengunduh media."""


class InvalidMediaUrlError(MediaDownloaderError):
    """URL tidak valid, bukan dari platform yang didukung, atau merupakan playlist/profil."""


class SsrBlockedError(MediaDownloaderError):
    """Alamat target mengarah ke IP privat atau terlarang (SSRF guard)."""


class RateLimitExceededError(MediaDownloaderError):
    """Batas frekuensi unduhan tercapai."""


class QuotaExceededError(MediaDownloaderError):
    """Batas kuota data harian tercapai."""


class QueueFullError(MediaDownloaderError):
    """Kapasitas antrean global penuh."""


class ActiveJobExistsError(MediaDownloaderError):
    """Pengguna sudah memiliki job aktif."""


class JobNotFoundError(MediaDownloaderError):
    """Job tidak ditemukan atau bukan milik pengguna."""


class JobNotReadyError(MediaDownloaderError):
    """Job belum selesai atau file sudah kedaluwarsa/diklaim."""


# Regex domain & jalur platform
YOUTUBE_DOMAINS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
INSTAGRAM_DOMAINS = {"instagram.com", "www.instagram.com"}
TIKTOK_DOMAINS = {"tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"}

RE_YT_WATCH = re.compile(r"^/watch/?$", re.IGNORECASE)
RE_YT_SHORTS = re.compile(r"^/shorts/([A-Za-z0-9_-]+)/?$", re.IGNORECASE)
RE_YT_BE = re.compile(r"^/([A-Za-z0-9_-]+)/?$", re.IGNORECASE)

RE_IG_POST = re.compile(r"^/(?:p|reel|reels)/([A-Za-z0-9_-]+)/?$", re.IGNORECASE)
RE_TT_VIDEO = re.compile(r"^/@[^/]+/video/(\d+)/?$", re.IGNORECASE)
RE_TT_PHOTO = re.compile(r"^/@[^/]+/photo/(\d+)/?$", re.IGNORECASE)
RE_TT_SHORT = re.compile(r"^/([A-Za-z0-9_-]+)/?$", re.IGNORECASE)

RESERVED_BYTES_PER_JOB = 250 * 1024 * 1024  # 250 MB
DAILY_QUOTA_BYTES = settings.MEDIA_DOWNLOAD_DAILY_QUOTA_MB * 1024 * 1024  # 1 GB


def is_safe_ip(ip_str: str) -> bool:
    """Memeriksa apakah IP publik dan aman (mencegah SSRF)."""
    try:
        ip = ipaddress.ip_address(ip_str)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return False
        # Blokir metadata cloud AWS/GCP/Azure
        if str(ip) == "169.254.169.254":
            return False
        return True
    except ValueError:
        return False


def validate_media_url(url: str, resolve_dns: bool = True) -> tuple[str, str]:
    """Validasi URL publik, verifikasi platform, cegah SSRF & playlist/profil.

    Mengembalikan (platform, clean_url).
    """
    if not url or not isinstance(url, str):
        raise InvalidMediaUrlError("URL wajib diisi.")

    url = url.strip()
    parsed = urlparse(url)

    if parsed.scheme.lower() != "https":
        raise InvalidMediaUrlError("Hanya skema https:// yang diizinkan.")

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        raise InvalidMediaUrlError("Hostname URL tidak valid.")

    # Deteksi platform
    platform: str | None = None
    clean_url: str | None = None

    if hostname in YOUTUBE_DOMAINS:
        platform = "youtube"
        # Tolak playlist
        qs = parse_qs(parsed.query)
        if "list" in qs and not parsed.path.startswith("/shorts/"):
            raise InvalidMediaUrlError(
                "Pengunduhan playlist tidak didukung. Harap masukkan URL satu video."
            )

        if hostname == "youtu.be":
            m = RE_YT_BE.match(parsed.path)
            if not m or len(m.group(1)) < 5:
                raise InvalidMediaUrlError("Format tautan pendek YouTube tidak valid.")
            clean_url = f"https://www.youtube.com/watch?v={m.group(1)}"
        elif RE_YT_WATCH.match(parsed.path):
            video_id = qs.get("v", [None])[0]
            if not video_id:
                raise InvalidMediaUrlError("Parameter video (v=) tidak ditemukan pada URL YouTube.")
            clean_url = f"https://www.youtube.com/watch?v={video_id}"
        elif m := RE_YT_SHORTS.match(parsed.path):
            clean_url = f"https://www.youtube.com/shorts/{m.group(1)}"
        else:
            raise InvalidMediaUrlError(
                "Hanya video atau shorts YouTube tunggal yang didukung (bukan channel/playlist)."
            )

    elif hostname in INSTAGRAM_DOMAINS:
        platform = "instagram"
        m = RE_IG_POST.match(parsed.path)
        if not m:
            raise InvalidMediaUrlError(
                "Hanya postingan gambar atau Reel Instagram tunggal yang didukung (bukan profil/stories)."
            )
        clean_url = f"https://www.instagram.com/p/{m.group(1)}/"

    elif hostname in TIKTOK_DOMAINS:
        platform = "tiktok"
        if hostname in ("vm.tiktok.com", "vt.tiktok.com"):
            m = RE_TT_SHORT.match(parsed.path)
            if not m or len(m.group(1)) < 3:
                raise InvalidMediaUrlError("Format tautan pendek TikTok tidak valid.")
            clean_url = f"https://{hostname}/{m.group(1)}"
        elif m := RE_TT_VIDEO.match(parsed.path):
            clean_url = f"https://www.tiktok.com{parsed.path}"
        elif m := RE_TT_PHOTO.match(parsed.path):
            clean_url = f"https://www.tiktok.com{parsed.path}"
        else:
            raise InvalidMediaUrlError(
                "Hanya video atau foto TikTok tunggal yang didukung (bukan profil/live)."
            )
    else:
        raise InvalidMediaUrlError(
            "Platform tidak didukung. Hanya YouTube, Instagram, dan TikTok yang diizinkan."
        )

    # Validasi Anti-SSRF (DNS resolution check)
    if resolve_dns:
        try:
            addr_info = socket.getaddrinfo(hostname, 443, proto=socket.IPPROTO_TCP)
            for item in addr_info:
                ip_addr = item[4][0]
                if not is_safe_ip(ip_addr):
                    raise SsrBlockedError(
                        f"Akses ke host dilarang karena mengarah ke alamat IP non-publik: {ip_addr}"
                    )
        except socket.gaierror as exc:
            raise InvalidMediaUrlError(f"Gagal me-resolve nama host: {hostname}") from exc

    return platform, clean_url


def detect_magic_type(file_bytes: bytes) -> str | None:
    """Deteksi jenis file dari header magic bytes."""
    if not file_bytes:
        return None
    # MP4
    if len(file_bytes) >= 12 and (
        file_bytes[4:8] == b"ftyp" or file_bytes[4:12] in (b"ftypmp41", b"ftypmp42", b"ftypisom")
    ):
        return "mp4"
    # JPEG
    if file_bytes.startswith(b"\xff\xd8\xff"):
        return "jpg"
    # PNG
    if file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    # WebP
    if file_bytes.startswith(b"RIFF") and len(file_bytes) >= 12 and file_bytes[8:12] == b"WEBP":
        return "webp"
    return None


@dataclass
class MediaJob:
    id: str
    user_id: str
    ip_address: str
    url: str
    platform: str
    media_type: str
    status: str
    progress_percent: float
    file_path: str | None
    filename: str | None
    file_size_bytes: int
    error_message: str | None
    error_code: str | None
    reserved_bytes: int
    actual_bytes: int
    created_at: float
    started_at: float | None
    completed_at: float | None
    expires_at: float | None


class MediaDownloadManager:
    """Manajer antrean unduhan media, batasan kuota, dan orkestrasi worker subprocess."""

    def __init__(self) -> None:
        self.workspace_root = settings.TEMP_WORKSPACE_DIR / "media_downloads"
        self.workspace_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._worker_thread: threading.Thread | None = None
        self._active_subprocess: subprocess.Popen[Any] | None = None
        self._active_job_id: str | None = None
        # Hook mock untuk pengujian otomatis tanpa memanggil extractor jaringan asli
        self.mock_executor: Callable[[MediaJob, Path], tuple[bool, str | None, str | None, int, str | None]] | None = None

    def start(self) -> None:
        """Memulai background worker thread."""
        with self._lock:
            if self._worker_thread is None or not self._worker_thread.is_alive():
                self._stop_event.clear()
                self._worker_thread = threading.Thread(
                    target=self._worker_loop, name="MediaDownloadWorker", daemon=True
                )
                self._worker_thread.start()

    def stop(self) -> None:
        """Menghentikan background worker thread secara anggun."""
        self._stop_event.set()
        with self._lock:
            if self._active_subprocess and self._active_subprocess.poll() is None:
                try:
                    self._active_subprocess.terminate()
                except OSError:
                    pass
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=3.0)

    def _worker_loop(self) -> None:
        """Loop latar belakang untuk mengambil job dari antrean."""
        while not self._stop_event.is_set():
            job = self._pick_next_job()
            if job:
                self._process_job(job)
            else:
                self._cleanup_expired_files()
                self._stop_event.wait(timeout=1.0)

    def _pick_next_job(self) -> MediaJob | None:
        """Mengambil satu job berstatus 'queued' tertua secara atomik."""
        with db_session.db_manager.transaction() as conn:
            # Periksa apakah sudah ada job 'running'
            running_count = conn.execute(
                "SELECT COUNT(*) FROM media_download_jobs WHERE status = 'running';"
            ).fetchone()[0]
            if running_count >= settings.MEDIA_DOWNLOAD_GLOBAL_RUNNING_LIMIT:
                return None

            row = conn.execute(
                """
                SELECT * FROM media_download_jobs
                WHERE status = 'queued'
                ORDER BY created_at ASC
                LIMIT 1;
                """
            ).fetchone()

            if not row:
                return None

            job_id = row["id"]
            now = time.time()
            conn.execute(
                """
                UPDATE media_download_jobs
                SET status = 'running', started_at = ?, progress_percent = 5.0
                WHERE id = ?;
                """,
                (now, job_id),
            )
            updated_row = conn.execute(
                "SELECT * FROM media_download_jobs WHERE id = ?;", (job_id,)
            ).fetchone()
            return self._row_to_job(updated_row)

    def _process_job(self, job: MediaJob) -> None:
        """Mengeksekusi pengunduhan media dalam workspace terisolasi."""
        job_dir = self.workspace_root / f"job_{job.id}"
        job_dir.mkdir(parents=True, exist_ok=True, mode=0o700)

        with self._lock:
            self._active_job_id = job.id

        success = False
        err_msg: str | None = None
        err_code: str | None = None
        actual_size = 0
        out_filename: str | None = None

        try:
            if self.mock_executor:
                success, out_filename, err_msg, actual_size, err_code = self.mock_executor(job, job_dir)
            else:
                success, out_filename, err_msg, actual_size, err_code = self._execute_extractor(job, job_dir)
        except Exception as exc:
            success = False
            err_msg = str(exc)
            err_code = "UNEXPECTED_ERROR"
        finally:
            with self._lock:
                self._active_job_id = None
                self._active_subprocess = None

        now = time.time()
        with db_session.db_manager.transaction() as conn:
            # Periksa apakah job dibatalkan saat proses berlangsung
            current_status = conn.execute(
                "SELECT status FROM media_download_jobs WHERE id = ?;", (job.id,)
            ).fetchone()

            if current_status and current_status[0] == "cancelled":
                # Bersihkan berkas jika pengguna telah membatalkan
                shutil.rmtree(job_dir, ignore_errors=True)
                conn.execute(
                    """
                    UPDATE media_download_usage
                    SET bytes_used = ?
                    WHERE job_id = ?;
                    """,
                    (actual_size, job.id),
                )
                return

            if success and out_filename:
                target_file = job_dir / out_filename
                expires_at = now + settings.MEDIA_DOWNLOAD_FILE_TTL_SECONDS
                conn.execute(
                    """
                    UPDATE media_download_jobs
                    SET status = 'succeeded',
                        progress_percent = 100.0,
                        file_path = ?,
                        filename = ?,
                        file_size_bytes = ?,
                        actual_bytes = ?,
                        completed_at = ?,
                        expires_at = ?
                    WHERE id = ?;
                    """,
                    (
                        str(target_file),
                        out_filename,
                        actual_size,
                        actual_size,
                        now,
                        expires_at,
                        job.id,
                    ),
                )
                # Sesuaikan reservasi kuota dengan ukuran aktual yang diunduh
                conn.execute(
                    """
                    UPDATE media_download_usage
                    SET bytes_used = ?
                    WHERE job_id = ?;
                    """,
                    (actual_size, job.id),
                )
            else:
                shutil.rmtree(job_dir, ignore_errors=True)
                conn.execute(
                    """
                    UPDATE media_download_jobs
                    SET status = 'failed',
                        error_message = ?,
                        error_code = ?,
                        actual_bytes = ?,
                        completed_at = ?
                    WHERE id = ?;
                    """,
                    (err_msg, err_code, actual_size, now, job.id),
                )
                # Tagih penggunaan byte aktual terukur jika gagal (lepaskan sisa reservasi)
                conn.execute(
                    """
                    UPDATE media_download_usage
                    SET bytes_used = ?
                    WHERE job_id = ?;
                    """,
                    (actual_size, job.id),
                )

    def _find_binary(self, name: str) -> str:
        # ponytail: fallback ke venv Scripts jika tidak ada di global PATH. Upgrade: configurable binary path di settings.
        found = shutil.which(name)
        if found:
            return found
        venv_bin = Path(sys.executable).parent / (f"{name}.exe" if os.name == "nt" else name)
        if venv_bin.is_file():
            return str(venv_bin)
        return name

    def _execute_extractor(
        self, job: MediaJob, job_dir: Path
    ) -> tuple[bool, str | None, str | None, int, str | None]:
        """Menjalankan yt-dlp atau gallery-dl sesuai platform dan media_type."""
        timeout_sec = settings.MEDIA_DOWNLOAD_TIMEOUT_SECONDS
        max_bytes = settings.MEDIA_DOWNLOAD_MAX_FILE_SIZE_MB * 1024 * 1024

        cmd: list[str] = []
        out_pattern = str(job_dir / "output.%(ext)s")
        bin_ytdlp = self._find_binary("yt-dlp")
        bin_gallerydl = self._find_binary("gallery-dl")

        if job.platform == "youtube":
            if job.media_type == "video":
                # YouTube Video: MP4 max 720p, stream-copy merge
                cmd = [
                    bin_ytdlp,
                    "--no-playlist",
                    "--format",
                    "bv*[height<=720][vcodec^=avc1]+ba[acodec^=mp4a]/b[height<=720][ext=mp4]/best[height<=720]",
                    "--merge-output-format",
                    "mp4",
                    "--max-filesize",
                    f"{settings.MEDIA_DOWNLOAD_MAX_FILE_SIZE_MB}M",
                    "--output",
                    out_pattern,
                    "--no-warnings",
                    "--no-call-home",
                    job.url,
                ]
            else:
                # YouTube Image: Thumbnail kualitas terbaik
                cmd = [
                    bin_ytdlp,
                    "--no-playlist",
                    "--skip-download",
                    "--write-thumbnail",
                    "--convert-thumbnails",
                    "jpg",
                    "--output",
                    str(job_dir / "thumbnail"),
                    job.url,
                ]
        elif job.platform in ("instagram", "tiktok"):
            if job.media_type == "video":
                cmd = [
                    bin_ytdlp,
                    "--no-playlist",
                    "--format",
                    "b[ext=mp4]/best",
                    "--max-filesize",
                    f"{settings.MEDIA_DOWNLOAD_MAX_FILE_SIZE_MB}M",
                    "--output",
                    out_pattern,
                    "--no-warnings",
                    job.url,
                ]
            else:
                # Foto/Carousel Instagram/TikTok: ambil item pertama dengan gallery-dl
                cmd = [
                    bin_gallerydl,
                    "--range",
                    "1",
                    "--directory",
                    str(job_dir),
                    "--filename",
                    "output.{extension}",
                    job.url,
                ]

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            with self._lock:
                self._active_subprocess = proc

            stdout, stderr = proc.communicate(timeout=timeout_sec)
        except subprocess.TimeoutExpired:
            if proc.poll() is None:
                proc.kill()
            return False, None, "Waktu proses unduhan melebihi batas 20 menit.", 0, "TIMEOUT"
        except FileNotFoundError:
            return False, None, f"Extractor {cmd[0]} belum terpasang di sistem.", 0, "EXTRACTOR_MISSING"

        if proc.returncode != 0:
            err_lower = (stderr or "").lower()
            if "live event" in err_lower or "premiere" in err_lower or "is a live stream" in err_lower:
                return False, None, "Konten live stream atau premiere tidak didukung.", 0, "LIVE_STREAM_REJECTED"
            if "requested format is not available" in err_lower:
                return False, None, "Format video MP4 720p tidak tersedia untuk konten ini.", 0, "FORMAT_NOT_SUPPORTED"
            # Sanitasi error message
            return False, None, "Gagal mengunduh media dari platform sumber.", 0, "EXTRACTION_FAILED"

        # Temukan file hasil di job_dir
        found_files = [f for f in job_dir.iterdir() if f.is_file()]
        if not found_files:
            return False, None, "Tidak ada berkas yang berhasil dihasilkan.", 0, "NO_OUTPUT_FILE"

        output_file = found_files[0]
        file_size = output_file.stat().st_size

        if file_size > max_bytes:
            output_file.unlink(missing_ok=True)
            return False, None, f"Ukuran berkas melebihi batas {settings.MEDIA_DOWNLOAD_MAX_FILE_SIZE_MB} MB.", file_size, "FILE_TOO_LARGE"

        file_bytes_head = output_file.read_bytes()[:32]
        detected_type = detect_magic_type(file_bytes_head)

        if job.media_type == "video" and detected_type != "mp4":
            output_file.unlink(missing_ok=True)
            return False, None, "Format berkas yang dihasilkan bukan MP4 valid.", file_size, "INVALID_FORMAT"
        elif job.media_type == "image" and detected_type not in ("jpg", "png", "webp"):
            output_file.unlink(missing_ok=True)
            return False, None, "Format citra yang dihasilkan tidak didukung.", file_size, "INVALID_FORMAT"

        # Buat nama berkas unduhan yang bersih
        ext = detected_type or "bin"
        sanitized_name = f"{job.platform}_{job.id[:8]}.{ext}"

        return True, output_file.name, None, file_size, None

    def create_job(
        self,
        user_id: str,
        ip_address: str,
        url: str,
        media_type: str,
        rights_confirmed: bool,
    ) -> dict[str, Any]:
        """Mendaftarkan job unduhan baru setelah validasi kuota, rate limit, dan URL."""
        if not rights_confirmed:
            raise ValueError(
                "Pengguna wajib mengonfirmasi kepemilikan hak cipta atau izin atas konten yang diunduh."
            )

        if media_type not in ("video", "image"):
            raise ValueError("Jenis media tidak didukung. Pilih 'video' atau 'image'.")

        platform, clean_url = validate_media_url(url, resolve_dns=True)

        now = time.time()
        one_hour_ago = now - 3600
        twenty_four_hours_ago = now - 86400

        with db_session.db_manager.transaction() as conn:
            # 1. Cek antrean global (max 2 queued)
            queued_count = conn.execute(
                "SELECT COUNT(*) FROM media_download_jobs WHERE status = 'queued';"
            ).fetchone()[0]
            if queued_count >= settings.MEDIA_DOWNLOAD_QUEUE_CAPACITY:
                raise QueueFullError(
                    "Antrean pemrosesan media sedang penuh (maks 2 antrean). Silakan coba sesaat lagi."
                )

            # 2. Cek job aktif pengguna (max 1 queued/running)
            user_active_count = conn.execute(
                """
                SELECT COUNT(*) FROM media_download_jobs
                WHERE user_id = ? AND status IN ('queued', 'running');
                """,
                (user_id,),
            ).fetchone()[0]
            if user_active_count >= 1:
                raise ActiveJobExistsError(
                    "Anda memiliki proses unduhan yang sedang berjalan atau mengantre. Harap tunggu hingga selesai."
                )

            # 3. Rate limit per jam (maks 3 job / jam per user dan per IP)
            hourly_user_count = conn.execute(
                """
                SELECT COUNT(*) FROM media_download_jobs
                WHERE user_id = ? AND created_at >= ?;
                """,
                (user_id, one_hour_ago),
            ).fetchone()[0]
            if hourly_user_count >= settings.MEDIA_DOWNLOAD_HOURLY_JOB_LIMIT:
                raise RateLimitExceededError(
                    f"Batas {settings.MEDIA_DOWNLOAD_HOURLY_JOB_LIMIT} job per jam telah tercapai untuk akun Anda."
                )

            hourly_ip_count = conn.execute(
                """
                SELECT COUNT(*) FROM media_download_jobs
                WHERE ip_address = ? AND created_at >= ?;
                """,
                (ip_address, one_hour_ago),
            ).fetchone()[0]
            if hourly_ip_count >= settings.MEDIA_DOWNLOAD_HOURLY_JOB_LIMIT:
                raise RateLimitExceededError(
                    f"Batas {settings.MEDIA_DOWNLOAD_HOURLY_JOB_LIMIT} job per jam telah tercapai untuk alamat IP Anda."
                )

            # 4. Kuota harian (maks 1 GB / hari per user dan per IP)
            user_daily_bytes = conn.execute(
                """
                SELECT COALESCE(SUM(bytes_used), 0) FROM media_download_usage
                WHERE user_id = ? AND timestamp >= ?;
                """,
                (user_id, twenty_four_hours_ago),
            ).fetchone()[0]

            if user_daily_bytes + RESERVED_BYTES_PER_JOB > DAILY_QUOTA_BYTES:
                raise QuotaExceededError(
                    "Kuota unduhan harian (1 GB) akun Anda tidak mencukupi untuk proses baru."
                )

            ip_daily_bytes = conn.execute(
                """
                SELECT COALESCE(SUM(bytes_used), 0) FROM media_download_usage
                WHERE ip_address = ? AND timestamp >= ?;
                """,
                (ip_address, twenty_four_hours_ago),
            ).fetchone()[0]

            if ip_daily_bytes + RESERVED_BYTES_PER_JOB > DAILY_QUOTA_BYTES:
                raise QuotaExceededError(
                    "Kuota unduhan harian (1 GB) pada jaringan IP Anda telah habis."
                )

            # Daftarkan job baru
            job_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO media_download_jobs (
                    id, user_id, ip_address, url, platform, media_type, status,
                    progress_percent, reserved_bytes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0.0, ?, ?);
                """,
                (
                    job_id,
                    user_id,
                    ip_address,
                    clean_url,
                    platform,
                    media_type,
                    RESERVED_BYTES_PER_JOB,
                    now,
                ),
            )

            # Catat reservasi kuota awal
            usage_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO media_download_usage (
                    id, user_id, ip_address, job_id, bytes_used, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?);
                """,
                (usage_id, user_id, ip_address, job_id, RESERVED_BYTES_PER_JOB, now),
            )

        return {
            "job_id": job_id,
            "status": "queued",
            "platform": platform,
            "media_type": media_type,
            "created_at": now,
        }

    def get_job(self, job_id: str, user_id: str) -> dict[str, Any]:
        """Mendapatkan status job unduhan milik pengguna."""
        with db_session.db_manager.connection() as conn:
            row = conn.execute(
                "SELECT * FROM media_download_jobs WHERE id = ?;", (job_id,)
            ).fetchone()

            if not row or row["user_id"] != user_id:
                raise JobNotFoundError("Job unduhan tidak ditemukan atau akses ditolak.")

            job = self._row_to_job(row)
            return {
                "id": job.id,
                "platform": job.platform,
                "media_type": job.media_type,
                "status": job.status,
                "progress_percent": job.progress_percent,
                "filename": job.filename,
                "file_size_bytes": job.file_size_bytes,
                "error_message": job.error_message,
                "error_code": job.error_code,
                "created_at": job.created_at,
                "completed_at": job.completed_at,
                "expires_at": job.expires_at,
            }

    def cancel_job(self, job_id: str, user_id: str) -> bool:
        """Membatalkan job yang sedang queued atau running."""
        with db_session.db_manager.transaction() as conn:
            row = conn.execute(
                "SELECT * FROM media_download_jobs WHERE id = ?;", (job_id,)
            ).fetchone()

            if not row or row["user_id"] != user_id:
                raise JobNotFoundError("Job unduhan tidak ditemukan.")

            status = row["status"]
            if status not in ("queued", "running"):
                return False

            conn.execute(
                """
                UPDATE media_download_jobs
                SET status = 'cancelled', completed_at = ?
                WHERE id = ?;
                """,
                (time.time(), job_id),
            )

            # Lepaskan kuota jika job belum selesai
            conn.execute(
                "UPDATE media_download_usage SET bytes_used = 0 WHERE job_id = ?;",
                (job_id,),
            )

        # Jika sedang running, hentikan proses aktifnya
        with self._lock:
            if self._active_job_id == job_id and self._active_subprocess:
                try:
                    self._active_subprocess.terminate()
                except OSError:
                    pass

        job_dir = self.workspace_root / f"job_{job_id}"
        shutil.rmtree(job_dir, ignore_errors=True)
        return True

    def claim_file(self, job_id: str, user_id: str) -> tuple[Path, str]:
        """Mengklaim berkas unduhan satu kali (single-use delivery)."""
        with db_session.db_manager.transaction() as conn:
            row = conn.execute(
                "SELECT * FROM media_download_jobs WHERE id = ?;", (job_id,)
            ).fetchone()

            if not row or row["user_id"] != user_id:
                raise JobNotFoundError("Job tidak ditemukan.")

            if row["status"] != "succeeded":
                raise JobNotReadyError("Berkas belum selesai diproses atau sudah tidak tersedia.")

            now = time.time()
            if row["expires_at"] and now > row["expires_at"]:
                raise JobNotReadyError("Tautan unduhan telah kedaluwarsa (batas 15 menit).")

            file_path = Path(row["file_path"]) if row["file_path"] else None
            filename = row["filename"] or "downloaded_media.bin"

            if not file_path or not file_path.is_file():
                raise JobNotReadyError("Berkas tidak ditemukan di penyimpanan server.")

            # Tandai status 'claimed' sehingga tidak dapat diunduh ulang
            conn.execute(
                "UPDATE media_download_jobs SET status = 'claimed' WHERE id = ?;",
                (job_id,),
            )

        return file_path, filename

    def _cleanup_expired_files(self) -> None:
        """Membersihkan file berkas yang sudah kedaluwarsa atau diklaim."""
        now = time.time()
        with db_session.db_manager.transaction() as conn:
            rows = conn.execute(
                """
                SELECT id, file_path FROM media_download_jobs
                WHERE (status = 'claimed' OR (status = 'succeeded' AND expires_at < ?))
                  AND file_path IS NOT NULL;
                """,
                (now,),
            ).fetchall()

            for row in rows:
                job_id = row["id"]
                file_path_str = row["file_path"]
                if file_path_str:
                    p = Path(file_path_str)
                    if p.is_file():
                        p.unlink(missing_ok=True)
                    # Bersihkan foldernya
                    if p.parent != self.workspace_root and p.parent.is_dir():
                        shutil.rmtree(p.parent, ignore_errors=True)

                conn.execute(
                    """
                    UPDATE media_download_jobs
                    SET file_path = NULL, status = CASE WHEN status = 'claimed' THEN 'claimed' ELSE 'expired' END
                    WHERE id = ?;
                    """,
                    (job_id,),
                )

    def _row_to_job(self, row: Any) -> MediaJob:
        return MediaJob(
            id=row["id"],
            user_id=row["user_id"],
            ip_address=row["ip_address"],
            url=row["url"],
            platform=row["platform"],
            media_type=row["media_type"],
            status=row["status"],
            progress_percent=row["progress_percent"] or 0.0,
            file_path=row["file_path"],
            filename=row["filename"],
            file_size_bytes=row["file_size_bytes"] or 0,
            error_message=row["error_message"],
            error_code=row["error_code"],
            reserved_bytes=row["reserved_bytes"] or 0,
            actual_bytes=row["actual_bytes"] or 0,
            created_at=row["created_at"],
            started_at=row["started_at"],
            completed_at=row["completed_at"],
            expires_at=row["expires_at"],
        )


media_downloader = MediaDownloadManager()
