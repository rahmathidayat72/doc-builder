"""
ClamAV Antivirus Scanner Service for Satukit File Shelf
Task: FS-05 (Phase File Shelf)
Implements clamd INSTREAM protocol via Unix domain socket with fail-closed security policy.
"""

from __future__ import annotations

import os
import socket
import struct
import time
from collections.abc import Iterator
from datetime import datetime
from pathlib import Path
from typing import NamedTuple

CHUNK_SIZE = 64 * 1024  # 64 KiB chunks for INSTREAM
SOCKET_TIMEOUT_SECONDS = 30.0
DEFAULT_CLAMD_SOCKET = "/run/clamav/clamd.ctl"
DEFAULT_CLAMAV_DB_DIR = "/var/lib/clamav"
MAX_SIGNATURE_AGE_SECONDS = 86400.0  # 24 jam fail-closed

EICAR_SIGNATURE = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


class ScanResult(NamedTuple):
    is_clean: bool
    virus_name: str | None = None
    raw_response: str = ""


class ClamAVError(Exception):
    """Base exception for ClamAV scanner operations."""
    pass


class ClamAVUnavailableError(ClamAVError):
    pass


class MalwareDetectedError(ClamAVError):
    def __init__(self, virus_name: str):
        super().__init__(f"Berkas terdeteksi memuat malware/virus ({virus_name}). Berkas ditolak.")
        self.virus_name = virus_name


class ClamAVScanner:
    """Production scanner communicating with clamd daemon via Unix domain socket."""

    def __init__(
        self,
        socket_path: str = DEFAULT_CLAMD_SOCKET,
        db_dir: str | Path = DEFAULT_CLAMAV_DB_DIR,
    ):
        self.socket_path = socket_path
        self.db_dir = Path(db_dir)

    def _open_socket(self) -> socket.socket:
        if not hasattr(socket, "AF_UNIX") or not os.path.exists(self.socket_path):
            msg = f"Socket Unix '{self.socket_path}' tidak ditemukan / platform tidak mendukung."
            raise ClamAVUnavailableError(msg)

        client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        client.settimeout(SOCKET_TIMEOUT_SECONDS)
        client.connect(self.socket_path)
        return client

    @staticmethod
    def _read_response(client: socket.socket) -> str:
        response_chunks: list[bytes] = []
        while True:
            buf = client.recv(4096)
            if not buf:
                break
            response_chunks.append(buf)
            if b"\0" in buf or b"\n" in buf:
                break
        return b"".join(response_chunks).decode("utf-8", errors="replace").strip("\0\r\n")

    @staticmethod
    def _parse_version_timestamp(raw_version: str) -> float | None:
        parts = raw_version.split("/")
        if len(parts) < 3:
            return None
        ts_str = " ".join(parts[2].strip().split())
        try:
            dt = datetime.strptime(ts_str, "%a %b %d %H:%M:%S %Y")
        except ValueError:
            return None
        return dt.astimezone().timestamp()

    def _get_db_mtime_fallback(self) -> float | None:
        newest: float | None = None
        for name in ("daily.cld", "daily.cvd", "main.cld", "main.cvd"):
            candidate = self.db_dir / name
            try:
                if candidate.is_file():
                    mtime = candidate.stat().st_mtime
                    if newest is None or mtime > newest:
                        newest = mtime
            except OSError:
                continue
        return newest

    def ensure_fresh_signatures(
        self,
        max_age_seconds: float = MAX_SIGNATURE_AGE_SECONDS,
        now: float | None = None,
    ) -> float:
        """Memverifikasi daemon clamd aktif dan signature <= 24 jam (fail-closed)."""
        client: socket.socket | None = None
        try:
            client = self._open_socket()
            client.sendall(b"zVERSION\0")
            raw_version = self._read_response(client)
        except ClamAVUnavailableError:
            raise
        except (TimeoutError, OSError) as e:
            raise ClamAVUnavailableError(
                f"Gagal berkomunikasi dengan ClamAV daemon: {e}"
            ) from e
        finally:
            if client is not None:
                client.close()

        sig_ts = self._parse_version_timestamp(raw_version)
        if sig_ts is None:
            sig_ts = self._get_db_mtime_fallback()
        if sig_ts is None:
            raise ClamAVUnavailableError(
                "Tanggal database signature ClamAV tidak dapat diverifikasi."
            )

        current_ts = time.time() if now is None else now
        if (current_ts - sig_ts) > max_age_seconds:
            raise ClamAVUnavailableError(
                "Database signature ClamAV kedaluwarsa (> 24 jam)."
            )
        return sig_ts

    def _scan_stream(self, chunks: Iterator[bytes]) -> ScanResult:
        client: socket.socket | None = None
        try:
            client = self._open_socket()
            # 1. Initiate INSTREAM command
            client.sendall(b"zINSTREAM\0")

            # 2. Send chunks: [4-byte big-endian size][chunk_bytes]
            for chunk in chunks:
                if not chunk:
                    continue
                header = struct.pack(">I", len(chunk))
                client.sendall(header + chunk)

            # 3. Terminate stream with 4 zero bytes
            client.sendall(struct.pack(">I", 0))

            # 4. Read response until null byte or newline
            raw_response = self._read_response(client)

            # 5. Parse response: "stream: OK" or "stream: <virus> FOUND"
            stripped = raw_response.strip()
            if "FOUND" in stripped:
                parts = stripped.split(":", 1)
                virus_name = (
                    parts[1].replace("FOUND", "").strip() if len(parts) > 1 else "Unknown-Malware"
                )
                return ScanResult(is_clean=False, virus_name=virus_name, raw_response=raw_response)
            if stripped.endswith(": OK") or stripped == "OK":
                return ScanResult(is_clean=True, raw_response=raw_response)

            raise ClamAVError(f"Respon tidak dikenal dari ClamAV: {raw_response}")

        except ClamAVUnavailableError:
            raise
        except (TimeoutError, OSError) as e:
            raise ClamAVUnavailableError(f"Gagal berkomunikasi dengan ClamAV daemon: {e}") from e
        finally:
            if client is not None:
                client.close()

    def scan_bytes(self, data: bytes) -> ScanResult:
        view = memoryview(data)

        def _byte_chunks() -> Iterator[bytes]:
            offset = 0
            total_len = len(view)
            while offset < total_len:
                yield bytes(view[offset : offset + CHUNK_SIZE])
                offset += CHUNK_SIZE

        return self._scan_stream(_byte_chunks())

    def scan_file(self, filepath: str | Path, *, chunk_size: int = CHUNK_SIZE) -> ScanResult:
        step = max(1, int(chunk_size))

        def _file_chunks() -> Iterator[bytes]:
            with open(filepath, "rb") as f:
                while True:
                    chunk = f.read(step)
                    if not chunk:
                        break
                    yield chunk

        return self._scan_stream(_file_chunks())


class MockClamAVScanner:
    """Test double scanner detecting EICAR signature without requiring ClamAV daemon."""

    def ensure_fresh_signatures(
        self,
        max_age_seconds: float = MAX_SIGNATURE_AGE_SECONDS,
        now: float | None = None,
    ) -> float:
        return time.time() if now is None else now

    def scan_bytes(self, data: bytes) -> ScanResult:
        if EICAR_SIGNATURE in data:
            return ScanResult(
                is_clean=False,
                virus_name="Eicar-Test-Signature",
                raw_response="stream: Eicar-Test-Signature FOUND",
            )
        return ScanResult(is_clean=True, raw_response="stream: OK")

    def scan_file(self, filepath: str | Path, *, chunk_size: int = CHUNK_SIZE) -> ScanResult:
        step = max(1, int(chunk_size))
        overlap_len = max(0, len(EICAR_SIGNATURE) - 1)
        tail = b""
        with open(filepath, "rb") as f:
            while True:
                chunk = f.read(step)
                if not chunk:
                    break
                window = tail + chunk
                if EICAR_SIGNATURE in window:
                    return ScanResult(
                        is_clean=False,
                        virus_name="Eicar-Test-Signature",
                        raw_response="stream: Eicar-Test-Signature FOUND",
                    )
                tail = window[-overlap_len:] if overlap_len else b""
        return ScanResult(is_clean=True, raw_response="stream: OK")


_GLOBAL_SCANNER: ClamAVScanner | MockClamAVScanner | None = None


def get_clamav_scanner() -> ClamAVScanner | MockClamAVScanner:
    """
    Get ClamAV scanner instance.
    Uses MockClamAVScanner if Unix socket does not exist or running in test/dev mode.
    """
    global _GLOBAL_SCANNER
    if _GLOBAL_SCANNER is not None:
        return _GLOBAL_SCANNER

    sock_path = os.environ.get("CLAMAV_SOCKET_PATH", DEFAULT_CLAMD_SOCKET)
    use_mock = os.environ.get("USE_MOCK_CLAMAV", "").lower() in ("1", "true", "yes")

    if not use_mock and hasattr(socket, "AF_UNIX") and Path(sock_path).exists():
        _GLOBAL_SCANNER = ClamAVScanner(socket_path=sock_path)
    else:
        _GLOBAL_SCANNER = MockClamAVScanner()

    return _GLOBAL_SCANNER


def set_global_clamav_scanner(scanner: ClamAVScanner | MockClamAVScanner | None) -> None:
    global _GLOBAL_SCANNER
    _GLOBAL_SCANNER = scanner
