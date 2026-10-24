import base64
import io
import math
import os
import re
import zipfile
from collections.abc import Iterable
from typing import Literal

import pymupdf
from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader, PdfWriter

from app.services.converter import convert_docx_to_pdf_sandboxed

PDF_MAGIC = b"%PDF"
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
MAX_PAGES = 500
MAX_PIXELS = 50_000_000


def validate_pdf(file_bytes: bytes) -> bool:
    return len(file_bytes) >= 4 and file_bytes[:4] == PDF_MAGIC


def detect_image_format(file_bytes: bytes) -> Literal["JPEG", "PNG"] | None:
    if file_bytes.startswith(JPEG_MAGIC):
        return "JPEG"
    if file_bytes.startswith(PNG_MAGIC):
        return "PNG"
    return None


def _read_pdf(file_bytes: bytes) -> PdfReader:
    if not validate_pdf(file_bytes):
        raise ValueError("Header berkas tidak valid sebagai PDF.")
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted:
            raise ValueError("Berkas PDF terenkripsi password tidak didukung.")
        if len(reader.pages) == 0:
            raise ValueError("Berkas PDF kosong (0 halaman).")
        if len(reader.pages) > MAX_PAGES:
            raise ValueError(f"Jumlah halaman melebihi batas {MAX_PAGES} halaman.")
        return reader
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Gagal membaca berkas PDF: {exc}") from exc


def merge_pdf_and_images(files: Iterable[tuple[str, bytes]]) -> io.BytesIO:
    writer = PdfWriter()
    added = 0

    for filename, file_bytes in files:
        lower_name = filename.lower()
        if lower_name.endswith(".pdf"):
            reader = _read_pdf(file_bytes)
            for page in reader.pages:
                writer.add_page(page)
                added += 1
        elif lower_name.endswith(".docx"):
            pdf_stream, err_code = convert_docx_to_pdf_sandboxed(file_bytes, filename)
            if err_code == "LIBREOFFICE_NOT_FOUND":
                raise ValueError(
                    "LIBREOFFICE_NOT_FOUND: LibreOffice belum terpasang di komputer lokal "
                    "untuk mengonversi berkas DOCX."
                )
            if not pdf_stream or err_code:
                raise ValueError(
                    f"Gagal mengonversi DOCX '{filename}': {err_code or 'Kesalahan konversi'}"
                )
            reader = _read_pdf(pdf_stream.getvalue())
            for page in reader.pages:
                writer.add_page(page)
                added += 1
        elif lower_name.endswith((".jpg", ".jpeg", ".png")):
            if detect_image_format(file_bytes) is None:
                raise ValueError(f"Magic bytes gambar tidak valid: {filename}")
            try:
                with Image.open(io.BytesIO(file_bytes)) as image:
                    image.load()
                    if image.width * image.height > MAX_PIXELS:
                        raise ValueError("Resolusi gambar melebihi batas keamanan.")
                    rgb = image.convert("RGB")
                    image_pdf = io.BytesIO()
                    rgb.save(image_pdf, format="PDF", resolution=150)
                image_pdf.seek(0)
                image_reader = PdfReader(image_pdf)
                writer.add_page(image_reader.pages[0])
                added += 1
            except UnidentifiedImageError as exc:
                raise ValueError(f"Berkas gambar rusak: {filename}") from exc
        else:
            raise ValueError(f"Format tidak didukung untuk merge: {filename}")

        if added > MAX_PAGES:
            raise ValueError(f"Total halaman melebihi batas {MAX_PAGES} halaman.")

    if added == 0:
        raise ValueError("Tidak ada halaman valid untuk digabungkan.")

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return output


def parse_page_ranges(range_text: str, total_pages: int) -> list[int]:
    if not range_text.strip():
        raise ValueError("Rentang halaman wajib diisi.")

    pages: set[int] = set()
    for part in range_text.split(","):
        token = part.strip()
        if re.fullmatch(r"\d+", token):
            pages.add(int(token))
        elif re.fullmatch(r"\d+\s*-\s*\d+", token):
            start_text, end_text = re.split(r"\s*-\s*", token)
            start, end = int(start_text), int(end_text)
            if start > end:
                raise ValueError(f"Rentang terbalik tidak valid: {token}")
            pages.update(range(start, end + 1))
        else:
            raise ValueError(f"Format rentang halaman tidak valid: {token}")

    if not pages or min(pages) < 1 or max(pages) > total_pages:
        raise ValueError(f"Rentang halaman harus berada antara 1 dan {total_pages}.")
    return sorted(page - 1 for page in pages)


def split_pdf(file_bytes: bytes, range_text: str) -> io.BytesIO:
    reader = _read_pdf(file_bytes)
    page_indexes = parse_page_ranges(range_text, len(reader.pages))
    writer = PdfWriter()
    for index in page_indexes:
        writer.add_page(reader.pages[index])

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)
    return output


def parse_page_range_groups(range_text: str, total_pages: int) -> list[tuple[str, list[int]]]:
    if not range_text.strip():
        raise ValueError("Rentang halaman wajib diisi.")

    groups: list[tuple[str, list[int]]] = []
    tokens = [t.strip() for t in range_text.split(",") if t.strip()]
    if not tokens:
        raise ValueError("Rentang halaman wajib diisi.")

    for token in tokens:
        if re.fullmatch(r"\d+", token):
            page_num = int(token)
            if page_num < 1 or page_num > total_pages:
                raise ValueError(
                    f"Halaman {page_num} di luar rentang dokumen (1-{total_pages})."
                )
            groups.append((f"page_{page_num:03d}", [page_num - 1]))
        elif re.fullmatch(r"\d+\s*-\s*\d+", token):
            start_text, end_text = re.split(r"\s*-\s*", token)
            start, end = int(start_text), int(end_text)
            if start > end:
                raise ValueError(f"Rentang terbalik tidak valid: {token}")
            if start < 1 or end > total_pages:
                raise ValueError(
                    f"Rentang {start}-{end} di luar batas dokumen (1-{total_pages})."
                )
            if start == end:
                label = f"page_{start:03d}"
            else:
                label = f"pages_{start:03d}-{end:03d}"
            groups.append((label, list(range(start - 1, end))))
        else:
            raise ValueError(f"Format rentang halaman tidak valid: {token}")

    return groups


def split_pdf_ranges_zip(file_bytes: bytes, range_text: str) -> io.BytesIO:
    reader = _read_pdf(file_bytes)
    groups = parse_page_range_groups(range_text, len(reader.pages))

    total_output_pages = sum(len(indices) for _, indices in groups)
    if total_output_pages > MAX_PAGES:
        raise ValueError(
            f"Total halaman hasil pemisahan ({total_output_pages}) "
            f"melebihi batas {MAX_PAGES} halaman."
        )

    output = io.BytesIO()
    with zipfile.ZipFile(output, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for idx, (label, page_indices) in enumerate(groups, start=1):
            writer = PdfWriter()
            for p_idx in page_indices:
                writer.add_page(reader.pages[p_idx])
            buf = io.BytesIO()
            writer.write(buf)
            entry_name = f"{idx:02d}_{label}.pdf"
            archive.writestr(entry_name, buf.getvalue())

    output.seek(0)
    return output


def images_to_pdf(
    images: Iterable[tuple[str, bytes]],
    page_size: Literal["A4", "LETTER"] = "A4",
    orientation: Literal["portrait", "landscape"] = "portrait",
) -> io.BytesIO:
    image_list = list(images)
    if not image_list:
        raise ValueError("Minimal satu gambar wajib diunggah.")

    # Ukuran pada 150 DPI
    sizes = {"A4": (1240, 1754), "LETTER": (1275, 1650)}
    target = sizes[page_size]
    if orientation == "landscape":
        target = (target[1], target[0])

    pages: list[Image.Image] = []
    for filename, file_bytes in image_list:
        if detect_image_format(file_bytes) is None:
            raise ValueError(f"Magic bytes gambar tidak valid: {filename}")
        with Image.open(io.BytesIO(file_bytes)) as source:
            source.load()
            if source.width * source.height > MAX_PIXELS:
                raise ValueError("Resolusi gambar melebihi batas keamanan.")
            image = source.convert("RGB")
            image.thumbnail((target[0] - 100, target[1] - 100), Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", target, "white")
            x = (target[0] - image.width) // 2
            y = (target[1] - image.height) // 2
            canvas.paste(image, (x, y))
            pages.append(canvas)

    output = io.BytesIO()
    pages[0].save(
        output,
        format="PDF",
        save_all=True,
        append_images=pages[1:],
        resolution=150,
    )
    output.seek(0)
    return output


def pdf_to_images_zip(
    file_bytes: bytes,
    image_format: Literal["jpeg", "png"] = "png",
    dpi: int = 150,
) -> io.BytesIO:
    if not validate_pdf(file_bytes):
        raise ValueError("Header berkas tidak valid sebagai PDF.")
    if dpi < 72 or dpi > 300:
        raise ValueError("DPI harus berada antara 72 dan 300.")

    try:
        document = pymupdf.open(stream=file_bytes, filetype="pdf")
        if document.is_encrypted:
            document.close()
            raise ValueError("Berkas PDF terenkripsi password tidak didukung.")
        if document.page_count == 0:
            document.close()
            raise ValueError("Berkas PDF kosong (0 halaman).")
        if document.page_count > MAX_PAGES:
            document.close()
            raise ValueError(f"Jumlah halaman melebihi batas {MAX_PAGES} halaman.")

        zoom = dpi / 72
        matrix = pymupdf.Matrix(zoom, zoom)
        output = io.BytesIO()
        with zipfile.ZipFile(output, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            for page_index in range(document.page_count):
                page = document.load_page(page_index)
                pixmap = page.get_pixmap(matrix=matrix, alpha=False)
                extension = "jpg" if image_format == "jpeg" else "png"
                image_bytes = pixmap.tobytes("jpeg" if image_format == "jpeg" else "png")
                archive.writestr(f"page_{page_index + 1:03d}.{extension}", image_bytes)
        document.close()
        output.seek(0)
        return output
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Gagal mengekstrak halaman PDF ke gambar: {exc}") from exc


def has_digital_signature(doc: pymupdf.Document) -> bool:
    try:
        if doc.get_sigflags() > 0:
            return True
        for page in doc:
            for widget in page.widgets():
                if (
                    widget.field_type == pymupdf.PDF_WIDGET_TYPE_SIGNATURE
                    or getattr(widget, "is_signed", False)
                ):
                    return True
    except Exception:
        pass
    return False


def compress_pdf(
    file_bytes: bytes,
    level: Literal["light", "balanced", "maximum"] = "balanced",
) -> tuple[io.BytesIO, bool, int, int]:
    # Validasi awal integritas, enkripsi, dan batas halaman
    _read_pdf(file_bytes)
    original_size = len(file_bytes)

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Gagal memuat berkas PDF: {exc}") from exc

    try:
        if has_digital_signature(doc):
            raise ValueError(
                "Berkas PDF memuat tanda tangan digital. "
                "Kompresi dibatalkan untuk menjaga keabsahan tanda tangan."
            )

        if level == "balanced":
            doc.rewrite_images(dpi_threshold=160, dpi_target=144, quality=75)
        elif level == "maximum":
            doc.rewrite_images(dpi_threshold=120, dpi_target=96, quality=50)

        output = io.BytesIO()
        doc.save(
            output,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
            use_objstms=1,
        )
        compressed_bytes = output.getvalue()
        output_size = len(compressed_bytes)

        if output_size >= original_size:
            # Berkas asli sudah lebih optimal, kembalikan salinan asli dengan flag applied=False
            fallback = io.BytesIO(file_bytes)
            fallback.seek(0)
            return fallback, False, original_size, original_size

        output.seek(0)
        return output, True, original_size, output_size
    finally:
        doc.close()


def _clean_ratio(val: any, default: float = 0.0) -> float:
    try:
        f = float(val)
        if not math.isfinite(f):
            return default
        return max(0.0, min(1.0, f))
    except (ValueError, TypeError):
        return default


def _parse_hex_color(hex_str: str) -> tuple[float, float, float]:
    clean = hex_str.strip().lstrip("#")
    if len(clean) == 3:
        clean = "".join(c * 2 for c in clean)
    if len(clean) != 6:
        return (0.0, 0.0, 0.0)
    try:
        r = int(clean[0:2], 16) / 255.0
        g = int(clean[2:4], 16) / 255.0
        b = int(clean[4:6], 16) / 255.0
        return (r, g, b)
    except ValueError:
        return (0.0, 0.0, 0.0)


def get_pdf_editor_pages(file_bytes: bytes) -> list[dict]:
    if not validate_pdf(file_bytes):
        raise ValueError("Header berkas tidak valid sebagai PDF.")
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    try:
        if doc.is_encrypted:
            raise ValueError("Berkas PDF terenkripsi password tidak didukung.")
        if doc.page_count == 0:
            raise ValueError("Berkas PDF kosong (0 halaman).")
        if doc.page_count > MAX_PAGES:
            raise ValueError(f"Jumlah halaman melebihi batas {MAX_PAGES} halaman.")
        if has_digital_signature(doc):
            raise ValueError(
                "Berkas PDF memuat tanda tangan digital. "
                "Pengeditan dibatalkan untuk menjaga keabsahan tanda tangan."
            )

        pages_info: list[dict] = []
        for page_idx in range(doc.page_count):
            page = doc.load_page(page_idx)
            rect = page.rect
            scale = min(1.0, 240.0 / max(1.0, rect.width))
            matrix = pymupdf.Matrix(scale, scale)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            jpg_bytes = pix.tobytes("jpeg")
            b64_thumb = base64.b64encode(jpg_bytes).decode("ascii")

            # High-resolution preview for interactive canvas stage
            prev_scale = min(2.0, 960.0 / max(1.0, rect.width))
            prev_matrix = pymupdf.Matrix(prev_scale, prev_scale)
            prev_pix = page.get_pixmap(matrix=prev_matrix, alpha=False)
            prev_jpg = prev_pix.tobytes("jpeg")
            b64_prev = base64.b64encode(prev_jpg).decode("ascii")

            pages_info.append(
                {
                    "page_number": page_idx + 1,
                    "original_index": page_idx,
                    "width": round(rect.width, 2),
                    "height": round(rect.height, 2),
                    "rotation": page.rotation % 360,
                    "thumbnail": f"data:image/jpeg;base64,{b64_thumb}",
                    "preview": f"data:image/jpeg;base64,{b64_prev}",
                }
            )
        return pages_info
    finally:
        doc.close()


def _apply_text_overlay_item(target_page, txt: dict, p_width: float, p_height: float) -> None:
    raw_text = str(txt.get("text", "")).strip()
    if not raw_text:
        return
    if len(raw_text) > 5000:
        raw_text = raw_text[:5000]

    font_size = float(txt.get("font_size", 12))
    font_size = max(6.0, min(72.0, font_size))
    color_hex = str(txt.get("color", "#000000"))
    color_rgb = _parse_hex_color(color_hex)

    if "x_ratio" in txt and "y_ratio" in txt:
        x = _clean_ratio(txt["x_ratio"], 0.1) * p_width
        y = _clean_ratio(txt["y_ratio"], 0.1) * p_height
    else:
        x = float(txt.get("x", 50))
        y = float(txt.get("y", 50))

    if "width_ratio" in txt:
        w_box = _clean_ratio(txt["width_ratio"], 0.5) * p_width
    else:
        w_box = float(txt.get("width", 300))

    if "height_ratio" in txt:
        h_box = _clean_ratio(txt["height_ratio"], 0.1) * p_height
    else:
        h_box = float(txt.get("height", 80))

    x = max(0.0, min(p_width - 10, x))
    y = max(0.0, min(p_height - 10, y))
    w_box = max(20.0, min(p_width - x, w_box))
    h_box = max(font_size + 4, min(p_height - y, h_box))

    rect = pymupdf.Rect(x, y, x + w_box, y + h_box)
    target_page.insert_textbox(
        rect, raw_text, fontsize=font_size, color=color_rgb
    )


def _apply_image_overlay_item(target_page, img_item: dict, p_width: float, p_height: float) -> None:
    b64_str = str(img_item.get("image_base64", ""))
    if not b64_str:
        return
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    try:
        img_bytes = base64.b64decode(b64_str)
    except Exception as exc:
        raise ValueError(
            "Data gambar overlay tidak valid (base64 rusak)."
        ) from exc

    if len(img_bytes) > 5 * 1024 * 1024:
        raise ValueError("Ukuran gambar overlay melebihi batas 5 MB.")

    with Image.open(io.BytesIO(img_bytes)) as pil_img:
        pil_img.load()
        if pil_img.format not in ("JPEG", "PNG"):
            raise ValueError("Format gambar overlay harus PNG atau JPEG.")
        if pil_img.width * pil_img.height > MAX_PIXELS:
            raise ValueError(
                "Resolusi gambar overlay melebihi batas keamanan."
            )

    if "x_ratio" in img_item and "y_ratio" in img_item:
        x = _clean_ratio(img_item["x_ratio"], 0.5) * p_width
        y = _clean_ratio(img_item["y_ratio"], 0.7) * p_height
    else:
        x = float(img_item.get("x", 50))
        y = float(img_item.get("y", 50))

    if "width_ratio" in img_item:
        w_box = _clean_ratio(img_item["width_ratio"], 0.25) * p_width
    else:
        w_box = float(img_item.get("width", 150))

    if "height_ratio" in img_item:
        h_box = _clean_ratio(img_item["height_ratio"], 0.12) * p_height
    else:
        h_box = float(img_item.get("height", 75))

    x = max(0.0, min(p_width - 10, x))
    y = max(0.0, min(p_height - 10, y))
    w_box = max(10.0, min(p_width - x, w_box))
    h_box = max(10.0, min(p_height - y, h_box))

    img_rect = pymupdf.Rect(x, y, x + w_box, y + h_box)
    target_page.insert_image(img_rect, stream=img_bytes)


def apply_pdf_editor_changes(file_bytes: bytes, manifest: dict) -> io.BytesIO:
    if not validate_pdf(file_bytes):
        raise ValueError("Header berkas tidak valid sebagai PDF.")
    src_doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    try:
        if src_doc.is_encrypted:
            raise ValueError("Berkas PDF terenkripsi password tidak didukung.")
        if has_digital_signature(src_doc):
            raise ValueError(
                "Berkas PDF memuat tanda tangan digital. "
                "Pengeditan dibatalkan untuk menjaga keabsahan tanda tangan."
            )

        page_specs = manifest.get("pages", [])
        if not page_specs:
            raise ValueError("Minimal satu halaman wajib dipertahankan.")
        if len(page_specs) > MAX_PAGES:
            raise ValueError(f"Jumlah halaman melebihi batas {MAX_PAGES} halaman.")

        out_doc = pymupdf.open()
        try:
            for spec in page_specs:
                src_idx = int(spec.get("source_index", 0))
                if src_idx < 0 or src_idx >= src_doc.page_count:
                    raise ValueError(f"Indeks halaman sumber tidak valid: {src_idx}")

                out_doc.insert_pdf(src_doc, from_page=src_idx, to_page=src_idx)
                target_page = out_doc[-1]

                rot = int(spec.get("rotation", 0)) % 360
                rot = (rot // 90) * 90
                target_page.set_rotation(rot)

                p_width = target_page.rect.width
                p_height = target_page.rect.height

                unified_list = spec.get("overlays")
                if unified_list is not None:
                    if len(unified_list) > 50:
                        raise ValueError("Maksimum 50 elemen overlay per halaman.")
                    for item in unified_list:
                        item_type = str(item.get("type", "text")).lower()
                        if item_type == "text":
                            _apply_text_overlay_item(target_page, item, p_width, p_height)
                        elif item_type in ("image", "signature", "drawing"):
                            _apply_image_overlay_item(target_page, item, p_width, p_height)
                else:
                    text_list = spec.get("text_overlays", [])
                    image_list = spec.get("image_overlays", [])
                    if len(text_list) + len(image_list) > 50:
                        raise ValueError("Maksimum 50 elemen overlay per halaman.")

                    for txt in text_list:
                        _apply_text_overlay_item(target_page, txt, p_width, p_height)
                    for img_item in image_list:
                        _apply_image_overlay_item(target_page, img_item, p_width, p_height)

            output = io.BytesIO()
            out_doc.save(
                output,
                garbage=4,
                deflate=True,
                clean=True,
                use_objstms=1,
            )
            output.seek(0)
            return output
        finally:
            out_doc.close()
    finally:
        src_doc.close()


def validate_protect_password(password: str) -> None:
    if not isinstance(password, str) or not password:
        raise ValueError("Password proteksi wajib diisi.")
    pw_bytes = password.encode("utf-8")
    if len(pw_bytes) < 12:
        raise ValueError("Password proteksi minimal 12 karakter.")
    if len(pw_bytes) > 40:
        raise ValueError("Password proteksi maksimal 40 byte untuk enkripsi AES-256.")
    if not any(c.isupper() for c in password):
        raise ValueError("Password wajib memuat minimal 1 huruf besar (A-Z).")
    if not any(c.islower() for c in password):
        raise ValueError("Password wajib memuat minimal 1 huruf kecil (a-z).")
    if not any(c.isdigit() for c in password):
        raise ValueError("Password wajib memuat minimal 1 angka (0-9).")
    if not any(not c.isalnum() and not c.isspace() for c in password):
        raise ValueError("Password wajib memuat minimal 1 simbol / karakter khusus.")


def protect_pdf(file_bytes: bytes, password: str) -> io.BytesIO:
    if not validate_pdf(file_bytes):
        raise ValueError("Header berkas tidak valid sebagai PDF.")
    validate_protect_password(password)

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Gagal memuat berkas PDF: {exc}") from exc

    try:
        if doc.is_encrypted or doc.needs_pass:
            raise ValueError("Berkas PDF sudah terenkripsi password.")
        if doc.page_count == 0:
            raise ValueError("Berkas PDF kosong (0 halaman).")
        if doc.page_count > MAX_PAGES:
            raise ValueError(f"Jumlah halaman melebihi batas {MAX_PAGES} halaman.")
        if has_digital_signature(doc):
            raise ValueError(
                "Berkas PDF memuat tanda tangan digital. "
                "Proteksi password dibatalkan untuk menjaga keabsahan tanda tangan."
            )

        output = io.BytesIO()
        doc.save(
            output,
            encryption=pymupdf.PDF_ENCRYPT_AES_256,
            user_pw=password,
            owner_pw=password,
            permissions=4095,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
            use_objstms=1,
        )
        output.seek(0)
        return output
    finally:
        doc.close()


def unlock_pdf(file_bytes: bytes, password: str) -> io.BytesIO:
    if not validate_pdf(file_bytes):
        raise ValueError("Header berkas tidak valid sebagai PDF.")
    if not isinstance(password, str) or not password.strip():
        raise ValueError("Password wajib diisi untuk membuka proteksi PDF.")

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Gagal memuat berkas PDF: {exc}") from exc

    try:
        if not doc.is_encrypted and not doc.needs_pass:
            raise ValueError("Berkas PDF tidak terenkripsi password.")

        auth_res = doc.authenticate(password)
        if not auth_res:
            raise ValueError("Password salah. Dokumen PDF gagal dibuka.")

        if doc.page_count == 0:
            raise ValueError("Berkas PDF kosong (0 halaman).")
        if doc.page_count > MAX_PAGES:
            raise ValueError(f"Jumlah halaman melebihi batas {MAX_PAGES} halaman.")
        if has_digital_signature(doc):
            raise ValueError(
                "Berkas PDF memuat tanda tangan digital. "
                "Buka proteksi dibatalkan untuk menjaga keabsahan tanda tangan."
            )

        output = io.BytesIO()
        doc.save(
            output,
            encryption=pymupdf.PDF_ENCRYPT_NONE,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
            use_objstms=1,
        )
        output.seek(0)
        return output
    finally:
        doc.close()


def repair_pdf(file_bytes: bytes) -> tuple[io.BytesIO, dict]:
    """Memperbaiki berkas PDF yang rusak/korup menggunakan rekonstruksi xref & sanitasi objek."""
    if not isinstance(file_bytes, (bytes, bytearray)) or len(file_bytes) == 0:
        raise ValueError("Berkas PDF kosong atau tidak valid.")

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Berkas PDF rusak parah dan tidak dapat dipulihkan: {exc}") from exc

    try:
        if doc.is_encrypted or doc.needs_pass:
            raise ValueError(
                "Berkas PDF terenkripsi password. "
                "Buka proteksi dokumen terlebih dahulu sebelum melakukan perbaikan."
            )
        if doc.page_count == 0:
            raise ValueError("Berkas PDF tidak memuat halaman yang dapat dipulihkan (0 halaman).")
        if doc.page_count > MAX_PAGES:
            raise ValueError(f"Jumlah halaman melebihi batas {MAX_PAGES} halaman.")

        page_count = doc.page_count
        output = io.BytesIO()
        doc.save(
            output,
            garbage=4,
            clean=True,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            use_objstms=1,
        )
        output.seek(0)
        repaired_bytes = output.getvalue()
        metadata = {
            "page_count": page_count,
            "original_size": len(file_bytes),
            "repaired_size": len(repaired_bytes),
        }
        return output, metadata
    finally:
        doc.close()


def get_tesseract_status() -> dict:
    """Memeriksa apakah Tesseract OCR tersedia di sistem lokal dan mengambil daftar bahasa."""
    try:
        tessdata = pymupdf.get_tessdata()
        languages: list[str] = []
        if os.path.exists(tessdata):
            for f in os.listdir(tessdata):
                if f.endswith(".traineddata"):
                    languages.append(f[:-12])
        languages.sort()
        return {
            "available": True,
            "tessdata": tessdata,
            "languages": languages,
            "message": "Engine Tesseract OCR siap digunakan.",
        }
    except Exception as exc:
        return {
            "available": False,
            "tessdata": None,
            "languages": [],
            "message": str(exc),
        }


def ocr_pdf(file_bytes: bytes, language: str = "eng") -> tuple[io.BytesIO, dict]:
    """Menerapkan OCR pada setiap halaman berkas PDF dan menghasilkan berkas PDF searchable."""
    if not validate_pdf(file_bytes):
        raise ValueError("Header berkas tidak valid sebagai PDF.")

    status = get_tesseract_status()
    if not status["available"]:
        raise ValueError(
            "Tesseract OCR tidak ditemukan di sistem lokal. "
            "Silakan instal Tesseract OCR terlebih dahulu untuk menggunakan fitur ini."
        )

    tessdata = status["tessdata"]

    try:
        src_doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Gagal memuat berkas PDF: {exc}") from exc

    out_doc = pymupdf.open()
    try:
        if src_doc.is_encrypted or src_doc.needs_pass:
            raise ValueError("Berkas PDF terenkripsi password. Buka proteksi terlebih dahulu.")
        if src_doc.page_count == 0:
            raise ValueError("Berkas PDF kosong (0 halaman).")
        if src_doc.page_count > MAX_PAGES:
            raise ValueError(f"Jumlah halaman melebihi batas {MAX_PAGES} halaman.")

        pages_processed = 0
        for page in src_doc:
            pix = page.get_pixmap(dpi=150)
            ocr_pdf_bytes = pix.pdfocr_tobytes(
                compress=True,
                language=language or "eng",
                tessdata=tessdata,
            )
            ocr_page_doc = pymupdf.open(stream=ocr_pdf_bytes, filetype="pdf")
            try:
                out_doc.insert_pdf(ocr_page_doc)
                pages_processed += 1
            finally:
                ocr_page_doc.close()

        output = io.BytesIO()
        out_doc.save(
            output,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
            use_objstms=1,
        )
        output.seek(0)
        metadata = {
            "page_count": pages_processed,
            "original_size": len(file_bytes),
            "output_size": len(output.getvalue()),
            "language": language,
        }
        return output, metadata
    finally:
        src_doc.close()
        out_doc.close()


def _hex_to_rgb(hex_code: str) -> tuple[float, float, float]:
    clean = hex_code.lstrip("#")
    if len(clean) == 3:
        clean = "".join(c * 2 for c in clean)
    if len(clean) != 6:
        return (0.0, 0.0, 0.0)
    try:
        r = int(clean[0:2], 16) / 255.0
        g = int(clean[2:4], 16) / 255.0
        b = int(clean[4:6], 16) / 255.0
        return (r, g, b)
    except ValueError:
        return (0.0, 0.0, 0.0)


def watermark_pdf(
    file_bytes: bytes,
    mode: Literal["text", "image"] = "text",
    text: str = "DRAFT",
    image_bytes: bytes | None = None,
    opacity: float = 0.3,
    rotation: float = 45.0,
    position: str = "center",
    fontsize: int = 40,
    color_hex: str = "#e11d48",
    pages_str: str = "all",
) -> tuple[io.BytesIO, dict]:
    """Membubuhkan cap air (watermark) teks atau gambar transparan pada halaman berkas PDF."""
    if not validate_pdf(file_bytes):
        raise ValueError("Header berkas tidak valid sebagai PDF.")

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Gagal memuat berkas PDF: {exc}") from exc

    try:
        if doc.is_encrypted or doc.needs_pass:
            raise ValueError(
                "Berkas PDF terenkripsi password. "
                "Buka proteksi berkas terlebih dahulu sebelum membubuhkan watermark."
            )
        if doc.page_count == 0:
            raise ValueError("Berkas PDF kosong (0 halaman).")
        if doc.page_count > MAX_PAGES:
            raise ValueError(f"Jumlah halaman melebihi batas {MAX_PAGES} halaman.")

        total_pages = doc.page_count
        if not pages_str or pages_str.strip().lower() == "all":
            target_indices = list(range(total_pages))
        else:
            target_indices = parse_page_ranges(pages_str, total_pages)

        safe_opacity = max(0.05, min(1.0, float(opacity)))
        rgb_color = _hex_to_rgb(color_hex)
        safe_fontsize = max(8, min(120, int(fontsize)))

        prepared_img_bytes: bytes | None = None
        img_aspect_ratio = 1.0
        if mode == "image":
            if not image_bytes or len(image_bytes) == 0:
                raise ValueError("Berkas gambar watermark wajib diunggah untuk mode gambar.")
            try:
                pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
                w, h = pil_img.size
                if w > 0 and h > 0:
                    img_aspect_ratio = w / h
                alpha = pil_img.split()[3]
                alpha = alpha.point(lambda p: int(p * safe_opacity))
                pil_img.putalpha(alpha)
                img_buf = io.BytesIO()
                pil_img.save(img_buf, format="PNG")
                prepared_img_bytes = img_buf.getvalue()
            except Exception as exc:
                raise ValueError(f"Gagal memproses gambar watermark: {exc}") from exc

        pages_watermarked = 0
        for idx in target_indices:
            page = doc[idx]
            page_rect = page.rect
            margin = 35

            if mode == "text":
                clean_text = text.strip() or "DRAFT"
                tw = pymupdf.get_text_length(clean_text, fontname="helv", fontsize=safe_fontsize)

                if position == "mosaic":
                    for row in range(3):
                        for col in range(2):
                            cx = (col + 0.5) * (page_rect.width / 2)
                            cy = (row + 0.5) * (page_rect.height / 3)
                            p0 = pymupdf.Point(cx - tw / 2, cy + safe_fontsize * 0.35)
                            morph = (pymupdf.Point(cx, cy), pymupdf.Matrix(rotation))
                            page.insert_text(
                                p0,
                                clean_text,
                                fontname="helv",
                                fontsize=safe_fontsize,
                                color=rgb_color,
                                fill_opacity=safe_opacity,
                                morph=morph,
                            )
                else:
                    if "top" in position:
                        cy = margin + safe_fontsize
                    elif "bottom" in position:
                        cy = page_rect.height - margin
                    else:
                        cy = page_rect.height / 2

                    if "left" in position:
                        cx = margin + tw / 2
                    elif "right" in position:
                        cx = page_rect.width - margin - tw / 2
                    else:
                        cx = page_rect.width / 2

                    p0 = pymupdf.Point(cx - tw / 2, cy + safe_fontsize * 0.35)
                    morph = (pymupdf.Point(cx, cy), pymupdf.Matrix(rotation))
                    page.insert_text(
                        p0,
                        clean_text,
                        fontname="helv",
                        fontsize=safe_fontsize,
                        color=rgb_color,
                        fill_opacity=safe_opacity,
                        morph=morph,
                    )
            else:
                assert prepared_img_bytes is not None
                target_w = min(250.0, page_rect.width * 0.35)
                target_h = target_w / img_aspect_ratio

                if position == "mosaic":
                    for row in range(3):
                        for col in range(2):
                            cx = (col + 0.5) * (page_rect.width / 2)
                            cy = (row + 0.5) * (page_rect.height / 3)
                            rect = pymupdf.Rect(
                                cx - target_w / 2,
                                cy - target_h / 2,
                                cx + target_w / 2,
                                cy + target_h / 2,
                            )
                            page.insert_image(
                                rect,
                                stream=prepared_img_bytes,
                                keep_proportion=True,
                                overlay=True,
                            )
                else:
                    if "top" in position:
                        y0 = margin
                    elif "bottom" in position:
                        y0 = page_rect.height - margin - target_h
                    else:
                        y0 = (page_rect.height - target_h) / 2

                    if "left" in position:
                        x0 = margin
                    elif "right" in position:
                        x0 = page_rect.width - margin - target_w
                    else:
                        x0 = (page_rect.width - target_w) / 2

                    rect = pymupdf.Rect(x0, y0, x0 + target_w, y0 + target_h)
                    page.insert_image(
                        rect,
                        stream=prepared_img_bytes,
                        keep_proportion=True,
                        overlay=True,
                    )

            pages_watermarked += 1

        output = io.BytesIO()
        doc.save(
            output,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
            use_objstms=1,
        )
        output.seek(0)
        metadata = {
            "page_count": total_pages,
            "pages_watermarked": pages_watermarked,
            "original_size": len(file_bytes),
            "output_size": len(output.getvalue()),
            "mode": mode,
        }
        return output, metadata
    finally:
        doc.close()


def add_page_numbers_pdf(
    file_bytes: bytes,
    format_pattern: str = "{n}",
    position: str = "bottom-center",
    margin: int = 30,
    start_page: int = 1,
    start_number: int = 1,
    fontsize: int = 10,
    color_hex: str = "#000000",
    pages_str: str = "all",
) -> tuple[io.BytesIO, dict]:
    """Membubuhkan nomor halaman otomatis pada dokumen PDF."""
    if not validate_pdf(file_bytes):
        raise ValueError("Header berkas tidak valid sebagai PDF.")

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Gagal memuat berkas PDF: {exc}") from exc

    try:
        if doc.is_encrypted or doc.needs_pass:
            raise ValueError(
                "Berkas PDF terenkripsi password. "
                "Buka proteksi berkas terlebih dahulu sebelum membubuhkan nomor halaman."
            )
        if doc.page_count == 0:
            raise ValueError("Berkas PDF kosong (0 halaman).")
        if doc.page_count > MAX_PAGES:
            raise ValueError(f"Jumlah halaman melebihi batas {MAX_PAGES} halaman.")

        total_pages = doc.page_count
        if not pages_str or pages_str.strip().lower() == "all":
            allowed_indices = set(range(total_pages))
        else:
            allowed_indices = set(parse_page_ranges(pages_str, total_pages))

        safe_fontsize = max(7, min(24, int(fontsize)))
        safe_margin = max(10, min(100, int(margin)))
        rgb_color = _hex_to_rgb(color_hex)
        safe_start_page = max(1, min(total_pages, int(start_page)))
        safe_start_number = max(0, int(start_number))

        pattern = format_pattern.strip() or "{n}"

        pages_numbered = 0
        for idx in range(total_pages):
            page_human_num = idx + 1
            if page_human_num < safe_start_page:
                continue
            if idx not in allowed_indices:
                continue

            current_n = (page_human_num - safe_start_page) + safe_start_number
            page_text = pattern.replace("{n}", str(current_n)).replace("{total}", str(total_pages))

            page = doc[idx]
            page_rect = page.rect
            tw = pymupdf.get_text_length(page_text, fontname="helv", fontsize=safe_fontsize)

            if "top" in position:
                y = safe_margin + safe_fontsize
            else:
                y = page_rect.height - safe_margin

            if "left" in position:
                x = safe_margin
            elif "right" in position:
                x = page_rect.width - safe_margin - tw
            else:
                x = (page_rect.width - tw) / 2

            page.insert_text(
                pymupdf.Point(x, y),
                page_text,
                fontname="helv",
                fontsize=safe_fontsize,
                color=rgb_color,
            )
            pages_numbered += 1

        output = io.BytesIO()
        doc.save(
            output,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
            use_objstms=1,
        )
        output.seek(0)
        metadata = {
            "page_count": total_pages,
            "pages_numbered": pages_numbered,
            "original_size": len(file_bytes),
            "output_size": len(output.getvalue()),
        }
        return output, metadata
    finally:
        doc.close()


def pdf_to_markdown(file_bytes: bytes, pages_str: str = "all") -> tuple[str, dict]:
    """Mengubah dokumen PDF menjadi sintaks Markdown (.md) terstruktur."""
    if not validate_pdf(file_bytes):
        raise ValueError("Header berkas tidak valid sebagai PDF.")

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError(f"Gagal memuat berkas PDF: {exc}") from exc

    try:
        if doc.is_encrypted or doc.needs_pass:
            raise ValueError(
                "Berkas PDF terenkripsi password. "
                "Buka proteksi berkas terlebih dahulu sebelum mengonversi ke Markdown."
            )
        if doc.page_count == 0:
            raise ValueError("Berkas PDF kosong (0 halaman).")
        if doc.page_count > MAX_PAGES:
            raise ValueError(f"Jumlah halaman melebihi batas {MAX_PAGES} halaman.")

        total_pages = doc.page_count
        if not pages_str or pages_str.strip().lower() == "all":
            pages_arg = None
            converted_pages = total_pages
        else:
            pages_arg = parse_page_ranges(pages_str, total_pages)
            converted_pages = len(pages_arg)

        import pymupdf4llm

        if pages_arg is not None:
            md_content = pymupdf4llm.to_markdown(doc, pages=pages_arg)
        else:
            md_content = pymupdf4llm.to_markdown(doc)

        clean_md = md_content.strip() if md_content else ""
        if not clean_md:
            clean_md = (
                "*Dokumen tidak memuat teks atau merupakan hasil scan gambar.* "
                "*(Gunakan fitur OCR PDF untuk menghasilkan dokumen PDF searchable).*"
            )

        metadata = {
            "total_pages": total_pages,
            "converted_pages": converted_pages,
            "markdown_length": len(clean_md),
            "original_size": len(file_bytes),
        }
        return clean_md, metadata
    finally:
        doc.close()




