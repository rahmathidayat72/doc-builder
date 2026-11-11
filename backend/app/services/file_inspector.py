"""
File Safety Inspector and Quarantine Manager for Satukit File Shelf
Task: FS-05 (Phase File Shelf)
Enforces strict format allowlists, active content rejection, and ClamAV integration.
"""

from __future__ import annotations

import hashlib
import io
import os
import tempfile
import zipfile
from pathlib import Path
from typing import NamedTuple

import defusedxml.minidom
import msoffcrypto
import pypdf
from oletools.olevba import VBA_Parser
from PIL import Image

from app.services.file_scanner import MalwareDetectedError, get_clamav_scanner

# Supported MIME types mapping
MIME_PDF = "application/pdf"
MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
MIME_DOC = "application/msword"
MIME_XLS = "application/vnd.ms-excel"
MIME_PPT = "application/vnd.ms-powerpoint"
MIME_JPEG = "image/jpeg"
MIME_PNG = "image/png"
MIME_WEBP = "image/webp"
MIME_MD = "text/markdown"

SUPPORTED_MIMES = {
    MIME_PDF, MIME_DOCX, MIME_XLSX, MIME_PPTX,
    MIME_DOC, MIME_XLS, MIME_PPT,
    MIME_JPEG, MIME_PNG, MIME_WEBP, MIME_MD,
}

MAX_FILE_BYTES = 25_000_000  # 25 MB
OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
PDF_MAGIC = b"%PDF-"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"
ZIP_MAGIC = b"PK\x03\x04"


class InspectionResult(NamedTuple):
    is_safe: bool
    content_type: str
    size_bytes: int
    sha256_hash: str
    has_exif_warning: bool
    detected_format: str


class FileInspectionError(Exception):
    """Base exception for file safety inspection."""
    pass


class UnsupportedFormatError(FileInspectionError):
    pass


class EncryptedFileError(FileInspectionError):
    pass


class SecurityInspectionError(FileInspectionError):
    pass


class QuarantineManager:
    """Manages secure local storage with restrictive 0600 permissions."""

    def __init__(self, base_dir: str | None = None) -> None:
        if base_dir:
            self.quarantine_dir = Path(base_dir)
        elif os.environ.get("SATUKIT_QUARANTINE_DIR"):
            self.quarantine_dir = Path(os.environ["SATUKIT_QUARANTINE_DIR"])
        elif Path("/var/lib/satukit/quarantine").exists():
            self.quarantine_dir = Path("/var/lib/satukit/quarantine")
        else:
            self.quarantine_dir = Path(tempfile.gettempdir()) / "satukit_quarantine"

        self.quarantine_dir.mkdir(parents=True, exist_ok=True)

    def write_file(self, item_id: str, data: bytes) -> str:
        filepath = self.quarantine_dir / f"quarantine_{item_id}.bin"
        with open(filepath, "wb") as f:
            f.write(data)

        if hasattr(os, "chmod"):
            try:
                os.chmod(filepath, 0o600)
            except OSError:
                pass

        return str(filepath)

    def remove_file(self, filepath: str) -> None:
        path = Path(filepath)
        if path.exists():
            try:
                path.unlink()
            except OSError:
                pass


def inspect_file_safety(data: bytes, filename: str) -> InspectionResult:
    """
    Comprehensive multi-layer safety inspection:
    1. Size verification (<= 25 MB)
    2. Antivirus check (ClamAV)
    3. Magic signature & format classification
    4. Anti-active content & deep parser checks (No Macros, No JS, No Launch, No Animation)
    5. Image EXIF check (preserves raw bytes with flag)
    """
    size = len(data)
    if size > MAX_FILE_BYTES:
        raise UnsupportedFormatError(f"Ukuran berkas ({size} byte) melebihi batas 25 MB.")

    if size == 0:
        raise UnsupportedFormatError("Berkas kosong (0 byte) tidak dapat diproses.")

    sha256_hash = hashlib.sha256(data).hexdigest()

    # 1. Antivirus scan (ClamAV)
    scanner = get_clamav_scanner()
    scan_res = scanner.scan_bytes(data)
    if not scan_res.is_clean:
        raise MalwareDetectedError(scan_res.virus_name or "Malware")

    # 2. Reject executable signatures
    is_exe = (
        data.startswith(b"MZ")
        or data.startswith(b"\x7fELF")
        or data.startswith(b"\xca\xfe\xba\xbe")
    )
    if is_exe:
        raise SecurityInspectionError("Berkas biner executable tidak diizinkan.")

    # 3. Reject SVG
    lower_sample = data[:2048].lower()
    if b"<svg" in lower_sample or (b"<?xml" in lower_sample and b"<svg" in data.lower()):
        raise UnsupportedFormatError("Format berkas gambar vektor SVG tidak diizinkan.")

    # 4. Format detection & deep inspection
    content_type = ""
    detected_format = ""
    has_exif_warning = False

    # PDF
    if data.startswith(PDF_MAGIC) or (PDF_MAGIC in data[:1024]):
        content_type = MIME_PDF
        detected_format = "pdf"
        _inspect_pdf(data)

    # OpenXML or ZIP Archive
    elif data.startswith(ZIP_MAGIC):
        content_type, detected_format = _inspect_openxml_or_reject_archive(data)

    # Legacy OLE (DOC, XLS, PPT)
    elif data.startswith(OLE_MAGIC):
        content_type, detected_format = _inspect_legacy_ole(data)

    # JPEG
    elif data.startswith(JPEG_MAGIC):
        content_type = MIME_JPEG
        detected_format = "jpeg"
        has_exif_warning = _inspect_image(data, expected_format="JPEG")

    # PNG
    elif data.startswith(PNG_MAGIC):
        content_type = MIME_PNG
        detected_format = "png"
        has_exif_warning = _inspect_image(data, expected_format="PNG")

    # WebP
    elif data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        content_type = MIME_WEBP
        detected_format = "webp"
        has_exif_warning = _inspect_image(data, expected_format="WEBP")

    # Markdown / Plain Text
    else:
        content_type, detected_format = _inspect_markdown_or_reject(data, filename)

    return InspectionResult(
        is_safe=True,
        content_type=content_type,
        size_bytes=size,
        sha256_hash=sha256_hash,
        has_exif_warning=has_exif_warning,
        detected_format=detected_format,
    )


def _inspect_pdf(data: bytes) -> None:
    # 1. Byte-level screening for active content keywords
    banned_keywords = [
        b"/JavaScript", b"/JS", b"/Launch", b"/EmbeddedFiles",
        b"/SubmitForm", b"/ImportData", b"/RichMedia",
    ]
    for kw in banned_keywords:
        if kw in data:
            raise SecurityInspectionError(f"PDF memuat elemen aktif terlarang ({kw.decode()}).")

    # 2. Structural parsing
    try:
        reader = pypdf.PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise EncryptedFileError("PDF terproteksi kata sandi / terenkripsi tidak didukung.")
    except EncryptedFileError:
        raise
    except Exception as e:
        raise SecurityInspectionError(f"Struktur PDF rusak atau tidak valid: {e}") from e


def _inspect_openxml_or_reject_archive(data: bytes) -> tuple[str, str]:
    try:
        with zipfile.ZipFile(io.BytesIO(data), "r") as z:
            names = set(z.namelist())

            # Check if this is an OpenXML office file
            is_docx = "word/document.xml" in names
            is_xlsx = "xl/workbook.xml" in names
            is_pptx = "ppt/presentation.xml" in names

            if not (is_docx or is_xlsx or is_pptx):
                raise UnsupportedFormatError(
                    "Format arsip (ZIP/RAR/TAR/GZ/7Z) atau arsip umum tidak diizinkan."
                )

            # Check XML safety with defusedxml
            for xml_name in names:
                if xml_name.endswith(".xml") or xml_name.endswith(".rels"):
                    raw_xml = z.read(xml_name)
                    try:
                        defusedxml.minidom.parseString(raw_xml)
                    except Exception as e:
                        raise SecurityInspectionError(
                            f"XML malformed atau memuat entity terlarang ({xml_name}): {e}"
                        ) from e

            # Check macro/VBA presence
            vba_parser = VBA_Parser(filename="document.bin", data=data)
            if vba_parser.detect_vba_macros():
                raise SecurityInspectionError("Dokumen Office memuat makro VBA yang dilarang.")

            # Check encryption
            office_file = msoffcrypto.OfficeFile(io.BytesIO(data))
            if office_file.is_encrypted():
                raise EncryptedFileError("Dokumen Office terproteksi kata sandi tidak didukung.")

            if is_docx:
                return MIME_DOCX, "docx"
            if is_xlsx:
                return MIME_XLSX, "xlsx"
            return MIME_PPTX, "pptx"

    except (UnsupportedFormatError, SecurityInspectionError, EncryptedFileError):
        raise
    except zipfile.BadZipFile as e:
        raise SecurityInspectionError(f"Format arsip rusak atau malformed: {e}") from e


def _inspect_legacy_ole(data: bytes) -> tuple[str, str]:
    # Check encryption
    office_file = msoffcrypto.OfficeFile(io.BytesIO(data))
    if office_file.is_encrypted():
        raise EncryptedFileError("Berkas Office lama terproteksi kata sandi tidak didukung.")

    # Check macros
    vba_parser = VBA_Parser(filename="document.ole", data=data)
    if vba_parser.detect_vba_macros():
        raise SecurityInspectionError("Berkas Office OLE memuat makro VBA yang dilarang.")

    # Detect legacy subtype based on stream names
    from olefile import OleFileIO
    ole = OleFileIO(io.BytesIO(data))
    if ole.exists("WordDocument"):
        return MIME_DOC, "doc"
    if ole.exists("Workbook") or ole.exists("Book"):
        return MIME_XLS, "xls"
    if ole.exists("PowerPoint Document"):
        return MIME_PPT, "ppt"

    return MIME_DOC, "doc"


def _inspect_image(data: bytes, expected_format: str) -> bool:
    try:
        img = Image.open(io.BytesIO(data))
        if img.format != expected_format:
            msg = f"Format gambar tidak cocok (diharapkan {expected_format}, ada {img.format})."
            raise SecurityInspectionError(msg)

        # Decompression bomb prevention
        img.verify()

        # Reopen for metadata/animation inspection (verify closes file pointer)
        img = Image.open(io.BytesIO(data))

        # Check animation (Reject animated WebP, APNG, GIF)
        is_anim = getattr(img, "is_animated", False)
        n_frames = getattr(img, "n_frames", 1)
        if is_anim or n_frames > 1:
            raise SecurityInspectionError("Gambar animasi tidak diizinkan.")

        # Check EXIF / GPS presence (RISK-SEC-014: bytes are preserved, warning flagged)
        has_exif = False
        exif_data = getattr(img, "_getexif", None)
        if exif_data and exif_data():
            has_exif = True

        info_exif = img.info.get("exif")
        if info_exif:
            has_exif = True

        return has_exif

    except (SecurityInspectionError, UnsupportedFormatError):
        raise
    except Exception as e:
        raise SecurityInspectionError(f"Format gambar rusak atau tidak dapat di-parse: {e}") from e


def _inspect_markdown_or_reject(data: bytes, filename: str) -> tuple[str, str]:
    if not (filename.lower().endswith(".md") or filename.lower().endswith(".markdown")):
        msg = (
            "Format berkas tidak didukung. "
            "Satukit mendukung: PDF, DOCX, PPTX, XLSX, JPG, PNG, WebP, Markdown."
        )
        raise UnsupportedFormatError(msg)

    # Must be valid UTF-8 without NUL bytes
    if b"\x00" in data:
        raise SecurityInspectionError("Berkas Markdown memuat biner NUL byte terlarang.")

    try:
        data.decode("utf-8")
    except UnicodeDecodeError as e:
        raise SecurityInspectionError(f"Berkas Markdown bukan teks UTF-8 valid: {e}") from e

    return MIME_MD, "markdown"
