"""Potong lembar stiker ekspresi Kitu menjadi aset WebP transparan per ekspresi.

Sumber : Satukit_Brand_Assets/03_Ekspresi/Kitu_Expression_Sticker_Sheet.png (RGB, latar putih)
Keluaran: frontend/src/assets/kitu/kitu-<nama>.webp (RGBA, dipangkas ke bounding box)

Cara kerja: latar putih/abu-abu terang dihapus dengan flood fill dari tepi kotak potong
(isi putih sarung tangan aman karena terkurung outline gelap). Komponen kecil sisa dan
potongan karakter tetangga (yang menyentuh tepi kotak) dibuang.

Pemakaian: python scripts/extract_kitu_expressions.py [--contact-sheet <path.png>]
"""
from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "Satukit_Brand_Assets" / "03_Ekspresi" / "Kitu_Expression_Sticker_Sheet.png"
OUT_DIR = ROOT / "frontend" / "src" / "assets" / "kitu"

# nama: (x0, y0, x1, y1) pada lembar 1536x1024 (label pil di bawah tiap karakter dikecualikan)
BOXES: dict[str, tuple[int, int, int, int]] = {
    # baris 1
    "senyum": (380, 0, 610, 228),
    "wink": (625, 0, 855, 228),
    "semangat": (858, 0, 1085, 228),
    "hore": (1085, 0, 1305, 228),
    "selesai": (1305, 0, 1536, 228),
    # baris 2
    "fokus": (8, 275, 238, 487),
    "berpikir": (240, 275, 470, 487),
    "penasaran": (470, 275, 668, 487),
    "ide": (668, 275, 890, 487),
    "kaget": (890, 275, 1102, 487),
    "bingung": (1105, 275, 1305, 487),
    "kecewa": (1315, 275, 1536, 487),
    # baris 3
    "sedih": (15, 540, 218, 740),
    "marah": (220, 540, 447, 740),
    "lelah": (450, 540, 652, 740),
    "tidur": (650, 540, 862, 740),
    "santai": (865, 540, 1105, 740),
    "cinta": (1108, 540, 1312, 740),
    "terimakasih": (1322, 540, 1536, 740),
    # baris 4 (karakter membawa properti)
    "buatcv": (22, 795, 228, 972),
    "editfoto": (234, 795, 442, 972),
    "hapuslatar": (445, 795, 652, 972),
    "kelolafile": (655, 795, 862, 972),
    "konversi": (862, 795, 1062, 972),
    "pendekkanurl": (1062, 795, 1268, 972),
    "siapmembantu": (1272, 795, 1520, 972),
}

BG_MIN_CHANNEL = 188  # piksel terang
BG_MAX_SPREAD = 24    # dan hampir tidak berwarna -> kandidat latar/bayangan
PAD = 6


def _flood_background(candidate: np.ndarray) -> np.ndarray:
    """Tandai piksel kandidat latar yang terhubung ke tepi kotak."""
    h, w = candidate.shape
    seen = np.zeros_like(candidate, dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if candidate[y, x] and not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if candidate[y, x] and not seen[y, x]:
                seen[y, x] = True
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and candidate[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return seen


def _components(mask: np.ndarray) -> list[tuple[int, bool, np.ndarray]]:
    """Kembalikan (luas, menyentuh_tepi, koordinat) tiap komponen terhubung-8."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    result: list[tuple[int, bool, np.ndarray]] = []
    for sy in range(h):
        for sx in range(w):
            if not mask[sy, sx] or seen[sy, sx]:
                continue
            queue = deque([(sy, sx)])
            seen[sy, sx] = True
            pts: list[tuple[int, int]] = []
            touches = False
            while queue:
                y, x = queue.popleft()
                pts.append((y, x))
                if y in (0, h - 1) or x in (0, w - 1):
                    touches = True
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            queue.append((ny, nx))
            result.append((len(pts), touches, np.array(pts)))
    return result


def cut(sheet: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    rgb = np.asarray(sheet.crop(box).convert("RGB")).astype(np.int16)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    candidate = (rgb.min(axis=2) >= BG_MIN_CHANNEL) & (spread <= BG_MAX_SPREAD)
    fg = ~_flood_background(candidate)

    comps = _components(fg)
    if not comps:
        raise RuntimeError("tidak ada objek terdeteksi")
    main_area = max(c[0] for c in comps)
    keep = np.zeros_like(fg)
    for area, touches, pts in comps:
        is_main = area == main_area
        # buang debu kecil & potongan tetangga yang terpotong di tepi kotak
        if area < 40 or (touches and not is_main):
            continue
        keep[pts[:, 0], pts[:, 1]] = True

    alpha = Image.fromarray((keep * 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out = sheet.crop(box).convert("RGBA")
    out.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 24 else 0).getbbox()
    if bbox is None:
        raise RuntimeError("bbox kosong")
    x0, y0, x1, y1 = bbox
    out = out.crop((max(0, x0 - PAD), max(0, y0 - PAD), min(out.width, x1 + PAD), min(out.height, y1 + PAD)))
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contact-sheet", type=Path, default=None)
    args = parser.parse_args()

    sheet = Image.open(SHEET).convert("RGB")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    outputs: list[tuple[str, Image.Image]] = []
    for name, box in BOXES.items():
        img = cut(sheet, box)
        img.save(OUT_DIR / f"kitu-{name}.webp", "WEBP", lossless=True, quality=100, method=6)
        outputs.append((name, img))
        print(f"{name:14s} {img.width}x{img.height}")

    if args.contact_sheet:
        cell_w, cell_h, cols = 230, 250, 7
        rows = (len(outputs) + cols - 1) // cols
        for label, bg in (("light", (255, 250, 241)), ("dark", (8, 19, 22))):
            canvas = Image.new("RGB", (cell_w * cols, cell_h * rows), bg)
            for i, (_, im) in enumerate(outputs):
                tile = im.copy()
                tile.thumbnail((cell_w - 10, cell_h - 10))
                cx = (i % cols) * cell_w + (cell_w - tile.width) // 2
                cy = (i // cols) * cell_h + (cell_h - tile.height) // 2
                canvas.paste(tile, (cx, cy), tile)
            path = args.contact_sheet.with_name(f"{args.contact_sheet.stem}-{label}.png")
            canvas.save(path)
            print("contact sheet ->", path)


if __name__ == "__main__":
    main()
