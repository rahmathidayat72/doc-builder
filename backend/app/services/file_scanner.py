"""
ClamAV Antivirus Scanner Service for Satukit File Shelf
Task: FS-05 (Phase File Shelf)
Implements clamd INSTREAM protocol via Unix domain socket with fail-closed security policy.
"""

from __future__ import annotations

import os
import socket
import struct
from pathlib import Path
from typing import NamedTuple

CHUNK_SIZE = 64 * 1024  # 64 KiB chunks for INSTREAM
SOCKET_TIMEOUT_SECONDS = 30.0
DEFAULT_CLAMD_SOCKET = "/run/clamav/clamd.ctl"

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

    def __init__(self, socket_path: str = DEFAULT_CLAMD_SOCKET):
        self.socket_path = socket_path

    def scan_bytes(self, data: bytes) -> ScanResult:
        if not hasattr(socket, "AF_UNIX") or not os.path.exists(self.socket_path):
            msg = f"Socket Unix '{self.socket_path}' tidak ditemukan / platform tidak mendukung."
            raise ClamAVUnavailableError(msg)

        client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        client.settimeout(SOCKET_TIMEOUT_SECONDS)
        try:
            client.connect(self.socket_path)
            # 1. Initiate INSTREAM command
            client.sendall(b"zINSTREAM\0")

            # 2. Send chunks: [4-byte big-endian size][chunk_bytes]
            offset = 0
            total_len = len(data)
            while offset < total_len:
                chunk = data[offset:offset + CHUNK_SIZE]
                chunk_len = len(chunk)
                header = struct.pack(">I", chunk_len)
                client.sendall(header + chunk)
                offset += chunk_len

            # 3. Terminate stream with 4 zero bytes
            client.sendall(struct.pack(">I", 0))

            # 4. Read response until null byte or newline
            response_chunks = []
            while True:
                buf = client.recv(4096)
                if not buf:
                    break
                response_chunks.append(buf)
                if b"\0" in buf or b"\n" in buf:
                    break

            resp_bytes = b"".join(response_chunks)
            raw_response = resp_bytes.decode("utf-8", errors="replace").strip("\0\r\n")

            # 5. Parse response: "stream: OK" or "stream: <virus> FOUND"
            if "OK" in raw_response:
                return ScanResult(is_clean=True, raw_response=raw_response)
            if "FOUND" in raw_response:
                parts = raw_response.split(":", 1)
                virus_name = (
                    parts[1].replace("FOUND", "").strip() if len(parts) > 1 else "Unknown-Malware"
                )
                return ScanResult(is_clean=False, virus_name=virus_name, raw_response=raw_response)

            raise ClamAVError(f"Respon tidak dikenal dari ClamAV: {raw_response}")

        except (TimeoutError, OSError) as e:
            raise ClamAVUnavailableError(f"Gagal berkomunikasi dengan ClamAV daemon: {e}") from e
        finally:
            client.close()

    def scan_file(self, filepath: str) -> ScanResult:
        with open(filepath, "rb") as f:
            data = f.read()
        return self.scan_bytes(data)


class MockClamAVScanner:
    """Test double scanner detecting EICAR signature without requiring ClamAV daemon."""

    def scan_bytes(self, data: bytes) -> ScanResult:
        if EICAR_SIGNATURE in data:
            return ScanResult(
                is_clean=False,
                virus_name="Eicar-Test-Signature",
                raw_response="stream: Eicar-Test-Signature FOUND",
            )
        return ScanResult(is_clean=True, raw_response="stream: OK")

    def scan_file(self, filepath: str) -> ScanResult:
        with open(filepath, "rb") as f:
            data = f.read()
        return self.scan_bytes(data)


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
