import io
import re
import zipfile
from collections.abc import Iterable
from typing import Literal

import pymupdf
from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader, PdfWriter

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
