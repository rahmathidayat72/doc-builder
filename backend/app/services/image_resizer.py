import io
import math
import re
from typing import Literal

from PIL import Image, ImageOps

MAX_IMAGE_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
MAX_PIXELS = 8000 * 8000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


def sanitize_filename(filename: str) -> str:
    base = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    name_only = base.rsplit(".", 1)[0] if "." in base else base
    clean = re.sub(r"[^a-zA-Z0-9_-]", "_", name_only).strip("_")
    return clean or "image"


def strip_exif(image: Image.Image) -> Image.Image:
    # Transpose orientation per EXIF before stripping metadata
    try:
        image = ImageOps.exif_transpose(image)
    except Exception:
        pass

    # Create clean canvas without exif or info dicts
    clean = Image.new(image.mode, image.size)
    clean.paste(image)
    return clean


def resize_image_to_target(
    file_bytes: bytes,
    target_kb: int,
    output_format: Literal["jpeg", "png", "webp"] = "jpeg",
    strip_exif_data: bool = True,
) -> tuple[io.BytesIO, int, int]:
    if len(file_bytes) == 0:
        raise ValueError("Berkas gambar kosong (0 byte).")
    if len(file_bytes) > MAX_IMAGE_FILE_SIZE:
        raise ValueError("Ukuran berkas gambar melebihi batas 25 MB.")
    if target_kb < 5:
        raise ValueError("Target ukuran minimal 5 KB.")

    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()
    except Exception as exc:
        raise ValueError(f"Berkas bukan format gambar valid: {exc}") from exc

    # Re-open after verify
    img = Image.open(io.BytesIO(file_bytes))

    if strip_exif_data:
        img = strip_exif(img)

    target_bytes = target_kb * 1024
    original_size = len(file_bytes)
    fmt = output_format.upper()
    if fmt == "JPG":
        fmt = "JPEG"

    # Convert mode for JPEG
    if fmt == "JPEG" and img.mode in ("RGBA", "P", "LA"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "RGBA":
            background.paste(img, mask=img.split()[3])
        else:
            background.paste(img.convert("RGBA"))
        img = background
    elif fmt in ("PNG", "WEBP") and img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA")

    # If format is PNG, compression is lossless - scale dimensions if needed
    if fmt == "PNG":
        scale = 1.0
        current_img = img
        while True:
            buf = io.BytesIO()
            current_img.save(buf, format="PNG", optimize=True)
            size = buf.tell()
            if size <= target_bytes or scale <= 0.2:
                buf.seek(0)
                return buf, original_size, size

            scale *= 0.8
            new_w = max(10, int(img.width * scale))
            new_h = max(10, int(img.height * scale))
            current_img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # For JPEG & WEBP: binary search quality, then downscale if still too big
    scale = 1.0
    current_img = img

    for _ in range(4):  # max 4 downscale attempts
        low_q = 15
        high_q = 95
        best_buf: io.BytesIO | None = None
        best_size = 0

        while low_q <= high_q:
            mid_q = (low_q + high_q) // 2
            buf = io.BytesIO()
            current_img.save(buf, format=fmt, quality=mid_q, optimize=True)
            size = buf.tell()

            if size <= target_bytes:
                best_buf = buf
                best_size = size
                low_q = mid_q + 1  # try higher quality
            else:
                high_q = mid_q - 1

        if best_buf is not None:
            best_buf.seek(0)
            return best_buf, original_size, best_size

        # If even quality 15 is too big, downscale dimension
        scale *= math.sqrt(target_bytes / max(size, 1))
        scale = max(0.15, min(0.85, scale))
        new_w = max(16, int(img.width * scale))
        new_h = max(16, int(img.height * scale))
        current_img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Fallback return lowest achieved
    buf = io.BytesIO()
    current_img.save(buf, format=fmt, quality=15, optimize=True)
    buf.seek(0)
    return buf, original_size, buf.tell()
