import io
import os
import tempfile
import threading
import time
import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.health import detect_libreoffice
from app.core.sandbox import SandboxConfig, run_sandboxed_subprocess
from app.db.models import RuntimeState
from app.db.postgres import SessionLocal

PDF_MAGIC_BYTES = b"%PDF-"
LIBREOFFICE_LEASE_KEY = "libreoffice_active_lease"
LIBREOFFICE_ADVISORY_LOCK_KEY = 90010510
BUSY_MESSAGE = "Server sedang memproses dokumen Office lain. Silakan coba beberapa saat lagi."

_DB_TX_LOCK = threading.Lock()
_FALLBACK_LOCK = threading.Lock()


class LibreOfficeBusyError(RuntimeError):
    """Dilempar ketika slot konversi tunggal LibreOffice sedang digunakan."""


@contextmanager
def acquire_libreoffice_slot(
    job_type: str = "pdf_conversion",
    ttl_sec: float = 310.0,
    session_factory: Callable[[], Session] | None = None,
    now_fn: Callable[[], float] = time.time,
) -> Iterator[str]:
    """
    Mengakuisisi slot eksekusi tunggal LibreOffice lintas worker via tabel RuntimeState.
    Melempar LibreOfficeBusyError jika ada konversi aktif yang belum kedaluwarsa.
    """
    lease_id = uuid.uuid4().hex
    factory = session_factory or SessionLocal
    db_acquired = False
    fallback_acquired = False

    try:
        now = now_fn()
        try:
            with _DB_TX_LOCK, factory() as session:
                bind = session.get_bind()
                is_pg = bind is not None and bind.dialect.name == "postgresql"
                if is_pg:
                    session.execute(
                        text("SELECT pg_advisory_xact_lock(:lock_key)"),
                        {"lock_key": LIBREOFFICE_ADVISORY_LOCK_KEY},
                    )

                stmt = select(RuntimeState).where(RuntimeState.key == LIBREOFFICE_LEASE_KEY)
                if is_pg:
                    stmt = stmt.with_for_update()

                state = session.execute(stmt).scalar_one_or_none()
                if state and isinstance(state.value, dict):
                    active = bool(state.value.get("active"))
                    expires_at = float(state.value.get("expires_at", 0.0))
                    if active and expires_at > now:
                        raise LibreOfficeBusyError(BUSY_MESSAGE)

                payload = {
                    "active": True,
                    "lease_id": lease_id,
                    "pid": os.getpid(),
                    "job_type": job_type,
                    "acquired_at": now,
                    "expires_at": now + ttl_sec,
                }
                if state:
                    state.value = payload
                    state.updated_at = now
                else:
                    session.add(
                        RuntimeState(key=LIBREOFFICE_LEASE_KEY, value=payload, updated_at=now)
                    )
                session.commit()
                db_acquired = True
        except LibreOfficeBusyError:
            raise
        except SQLAlchemyError:
            # ponytail: fallback in-process lock saat DB belum siap di unit test;
            # upgrade saat seluruh suite menginisialisasi skema.
            if not _FALLBACK_LOCK.acquire(blocking=False):
                raise LibreOfficeBusyError(BUSY_MESSAGE) from None
            fallback_acquired = True

        yield lease_id
    finally:
        if db_acquired:
            try:
                with _DB_TX_LOCK, factory() as session:
                    bind = session.get_bind()
                    if bind is not None and bind.dialect.name == "postgresql":
                        session.execute(
                            text("SELECT pg_advisory_xact_lock(:lock_key)"),
                            {"lock_key": LIBREOFFICE_ADVISORY_LOCK_KEY},
                        )
                    state = session.get(RuntimeState, LIBREOFFICE_LEASE_KEY)
                    if (
                        state
                        and isinstance(state.value, dict)
                        and state.value.get("lease_id") == lease_id
                    ):
                        rel_now = now_fn()
                        state.value = {
                            "active": False,
                            "lease_id": lease_id,
                            "pid": os.getpid(),
                            "job_type": job_type,
                            "released_at": rel_now,
                            "expires_at": 0.0,
                        }
                        state.updated_at = rel_now
                        session.commit()
            except SQLAlchemyError:
                pass
        if fallback_acquired:
            _FALLBACK_LOCK.release()


def build_libreoffice_command(
    lo_bin: str,
    input_file: Path,
    out_dir: Path,
    profile_dir: Path,
    *,
    target_format: str = "pdf",
) -> list[str]:
    """Membangun argumen baris perintah LibreOffice headless dengan isolasi profil."""
    return [
        lo_bin,
        f"-env:UserInstallation={profile_dir.resolve().as_uri()}",
        "--headless",
        "--invisible",
        "--nocrashreport",
        "--nodefault",
        "--nofirststartwizard",
        "--nologo",
        "--norestore",
        "--nolockcheck",
        "--convert-to",
        target_format,
        str(input_file),
        "--outdir",
        str(out_dir),
    ]


def validate_pdf_bytes(data: bytes) -> bool:
    """Memeriksa apakah data biner diawali header magic bytes PDF (%PDF-)."""
    return len(data) >= 5 and data[:5] == PDF_MAGIC_BYTES


def validate_pdf_file(path: Path) -> bool:
    """Memeriksa apakah berkas PDF ada, berukuran valid, dan ber-magic bytes PDF."""
    if not path.is_file() or path.stat().st_size < 5:
        return False
    with open(path, "rb") as f:
        header = f.read(5)
    return header == PDF_MAGIC_BYTES


def run_libreoffice_conversion(
    input_path: Path,
    output_dir: Path,
    timeout_sec: float = 300.0,
    max_memory_mb: int = 1000,
    job_type: str = "pdf_conversion",
    session_factory: Callable[[], Session] | None = None,
) -> Path:
    """
    Menjalankan konversi dokumen menjadi PDF menggunakan LibreOffice headless
    dalam sandbox subprocess dengan lease tunggal lintas-worker dan profil terisolasi.
    """
    lo_available, lo_path = detect_libreoffice()
    if not lo_available or not lo_path:
        raise FileNotFoundError("LIBREOFFICE_NOT_FOUND")

    with (
        acquire_libreoffice_slot(
            job_type=job_type,
            ttl_sec=timeout_sec + 10.0,
            session_factory=session_factory,
        ),
        tempfile.TemporaryDirectory(prefix="docbuilder_lo_prof_") as profile_tmp,
    ):
        profile_dir = Path(profile_tmp)
        cmd = build_libreoffice_command(lo_path, input_path, output_dir, profile_dir)
        config = SandboxConfig(
            working_dir=output_dir,
            timeout_sec=timeout_sec,
            max_memory_mb=max_memory_mb,
            allow_network=False,
        )

        result = run_sandboxed_subprocess(cmd, config)
        if result.exit_code != 0:
            err = (
                result.error_message
                or result.stderr
                or result.stdout
                or f"exit code {result.exit_code}"
            )
            raise RuntimeError(f"LibreOffice conversion failed: {err}")

        expected_pdf = output_dir / f"{input_path.stem}.pdf"
        if not validate_pdf_file(expected_pdf):
            err = (
                result.error_message
                or result.stderr
                or "Berkas PDF luaran tidak ditemukan atau kosong."
            )
            raise RuntimeError(f"LibreOffice output invalid: {err}")

        return expected_pdf


def convert_bytes_to_pdf_sandboxed(
    file_bytes: bytes,
    filename: str,
    prefix: str = "docbuilder_conv_",
    timeout_sec: float = 300.0,
    max_memory_mb: int = 1000,
    error_prefix: str = "CONVERSION_ERROR",
    job_type: str = "pdf_conversion",
) -> tuple[io.BytesIO | None, str | None]:
    """
    Helper terpadu untuk mengonversi berkas biner ke PDF via LibreOffice headless.
    Mengembalikan (io.BytesIO, None) saat sukses, atau (None, error_code) saat gagal.
    """
    lo_available, lo_path = detect_libreoffice()
    if not lo_available or not lo_path:
        return None, "LIBREOFFICE_NOT_FOUND"

    clean_stem = Path(filename).stem
    safe_stem = "".join([c for c in clean_stem if c.isalnum() or c in ("-", "_")]) or "document"
    ext = Path(filename).suffix.lower() or ".docx"
    unique_prefix = f"lo_{uuid.uuid4().hex[:8]}"

    with tempfile.TemporaryDirectory(prefix=prefix) as tmpdir:
        work_dir = Path(tmpdir)
        input_file = work_dir / f"{safe_stem}_{unique_prefix}{ext}"
        input_file.write_bytes(file_bytes)

        try:
            pdf_path = run_libreoffice_conversion(
                input_path=input_file,
                output_dir=work_dir,
                timeout_sec=timeout_sec,
                max_memory_mb=max_memory_mb,
                job_type=job_type,
            )
            pdf_bytes = pdf_path.read_bytes()
            out = io.BytesIO(pdf_bytes)
            out.seek(0)
            return out, None
        except FileNotFoundError:
            return None, "LIBREOFFICE_NOT_FOUND"
        except LibreOfficeBusyError as e:
            return None, f"CONVERSION_BUSY: {e}"
        except Exception as e:
            return None, f"{error_prefix}: {e}"


def convert_bytes_to_format_sandboxed(
    file_bytes: bytes,
    filename: str,
    *,
    target_format: str,
    expected_ext: str,
    validator: Callable[[bytes], bool] | None = None,
    prefix: str = "docbuilder_conv_",
    timeout_sec: float = 300.0,
    max_memory_mb: int = 1000,
    error_prefix: str = "CONVERSION_ERROR",
    job_type: str = "office_conversion",
    session_factory: Callable[[], Session] | None = None,
) -> tuple[bytes | None, str | None]:
    """Mengonversi berkas biner ke format target via LibreOffice headless terisolasi."""
    lo_available, lo_path = detect_libreoffice()
    if not lo_available or not lo_path:
        return None, "LIBREOFFICE_NOT_FOUND"

    clean_stem = Path(filename).stem
    safe_stem = "".join([c for c in clean_stem if c.isalnum() or c in ("-", "_")]) or "document"
    ext = Path(filename).suffix.lower() or ".bin"
    out_ext = expected_ext if expected_ext.startswith(".") else f".{expected_ext}"
    unique_prefix = f"lo_{uuid.uuid4().hex[:8]}"

    with tempfile.TemporaryDirectory(prefix=prefix) as tmpdir:
        work_dir = Path(tmpdir)
        input_file = work_dir / f"{safe_stem}_{unique_prefix}{ext}"
        input_file.write_bytes(file_bytes)

        try:
            with (
                acquire_libreoffice_slot(
                    job_type=job_type,
                    ttl_sec=timeout_sec + 10.0,
                    session_factory=session_factory,
                ),
                tempfile.TemporaryDirectory(prefix="docbuilder_lo_prof_") as profile_tmp,
            ):
                profile_dir = Path(profile_tmp)
                cmd = build_libreoffice_command(
                    lo_path,
                    input_file,
                    work_dir,
                    profile_dir,
                    target_format=target_format,
                )
                config = SandboxConfig(
                    working_dir=work_dir,
                    timeout_sec=timeout_sec,
                    max_memory_mb=max_memory_mb,
                    allow_network=False,
                )
                result = run_sandboxed_subprocess(cmd, config)
                if result.exit_code != 0:
                    err = (
                        result.error_message
                        or result.stderr
                        or result.stdout
                        or f"exit code {result.exit_code}"
                    )
                    raise RuntimeError(f"LibreOffice conversion failed: {err}")

                expected_out = work_dir / f"{input_file.stem}{out_ext}"
                if not expected_out.is_file() or expected_out.stat().st_size == 0:
                    raise RuntimeError("Berkas luaran LibreOffice tidak ditemukan atau kosong.")

                out_bytes = expected_out.read_bytes()
                if validator is not None and not validator(out_bytes):
                    raise RuntimeError("Berkas luaran LibreOffice tidak lolos validasi format.")
                return out_bytes, None
        except FileNotFoundError:
            return None, "LIBREOFFICE_NOT_FOUND"
        except LibreOfficeBusyError as e:
            return None, f"CONVERSION_BUSY: {e}"
        except Exception as e:
            return None, f"{error_prefix}: {e}"
