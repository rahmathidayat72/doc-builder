# Plan: Perbaiki Hasil Konversi Excel ke PDF yang Acak

**Terakhir diperbarui:** 2026-11-19
**Status:** Menunggu verifikasi manual (implementasi & seluruh pengujian otomatis lulus)

## Masalah

Hasil konversi Excel (`XLSX`/`XLS`) ke PDF berantakan:
- Halaman pertama **kosong**, tabel baru muncul di halaman berikutnya.
- Kolom angka terpotong/pindah halaman secara acak.
- Penyebab: backend langsung menyerahkan workbook ke LibreOffice tanpa menormalkan pengaturan cetak. LibreOffice mengikuti `print area` lama, manual page break, dan skala cetak yang tidak sesuai dengan lebar tabel.

## Akar Masalah

- `backend/app/services/office_converter.py` → `convert_spreadsheet_to_pdf_sandboxed` hanya memvalidasi magic bytes lalu memanggil `convert_bytes_to_pdf_sandboxed` (LibreOffice) tanpa preprocessing.
- Tidak ada langkah normalisasi print area / page break / orientasi / skala sebelum konversi.

## Rencana Perubahan

### 1. Normalisasi workbook sebelum konversi (baru)

Tambahkan langkah normalisasi di `office_converter.py` sebelum memanggil LibreOffice:

- Cari rentang sel yang benar-benar digunakan (nilai, formula, merged cells, style tabel) — jangan anggap sel formula bernilai `0` sebagai kosong.
- Hapus manual page break bermasalah.
- Set ulang `print_area` ke rentang data nyata.
- Aktifkan `fitToWidth=1` (seluruh kolom muat satu halaman), tinggi bebas (boleh beberapa halaman).
- Orientasi **landscape** bila tabel lebar, portrait bila sempit (otomatis).
- Set margin cetak wajar.
- Pertahankan format, formula, merged cells, dan ukuran kolom.

### 2. Dukungan format berkas

- **`.xlsx`**: langsung dinormalisasi dengan `openpyxl` (sudah ada di dependensi `openpyxl>=3.1.5`; tidak perlu dependency baru).
- **`.xls`**: konversi sementara `.xls` → `.xlsx` via LibreOffice dulu, normalisasi hasilnya, baru konversi ke PDF.

### 3. API & UI (opsional, bila diperlukan)

- Default: **Sesuaikan seluruh kolom dalam satu halaman** (`fitToWidth`).
- Pilihan orientasi: **Otomatis / Portrait / Landscape** pada `SpreadsheetConverterModal` bila ditambahkan; jika tidak, cukup otomatis di backend.

### 4. Pengujian

- Workbook dengan halaman kosong akibat `print_area` lama → halaman pertama PDF langsung memuat tabel.
- Workbook dengan manual page break → tidak ada halaman kosong.
- Tabel lebar → otomatis landscape, kolom tidak terpotong.
- Formula, format, dan merged cells tetap ada di hasil.
- `.xlsx` dan `.xls` tetap didukung.
- Perbarui `backend/tests/test_office_converter.py` (tes yang sudah ada untuk `convert_spreadsheet_to_pdf_sandboxed`).

## File yang Diubah

| File | Perubahan |
|---|---|
| `backend/app/services/office_converter.py` | Tambah normalisasi workbook (print area, page break, fitToWidth, orientasi, margin); konversi `.xls` → `.xlsx` sementara |
| `backend/app/api/converter.py` | (opsional) parameter orientasi/skala |
| `frontend/src/components/converter/SpreadsheetConverterModal.tsx` | (opsional) pilihan orientasi UI |
| `backend/tests/test_office_converter.py` | Tes normalisasi + halaman pertama berisi tabel |

## Langkah Eksekusi

1. Implementasi normalisasi `openpyxl` di `office_converter.py`.
2. Jalur `.xls` → `.xlsx` sementara → normalisasi → PDF.
3. (Opsional) pilihan UI orientasi.
4. Perbarui/tambah tes.
5. `pytest` backend penuh, `ruff check`, `scripts/scan_secrets.py`.
6. `npm run build` bila UI berubah.
7. Uji manual: unggah Excel dengan print area rusak → PDF rapi, halaman pertama langsung tabel.

## Status

- [x] Plan ditulis
- [x] Normalisasi workbook (print area / page break / fitToWidth / orientasi)
- [x] Jalur `.xls` sementara ke `.xlsx`
- [x] (Opsional) pilihan orientasi UI
- [x] Tes backend diperbarui
- [x] Pytest + ruff + scan secrets lulus
- [x] Build frontend diperbarui (jika UI berubah)
- [ ] Uji manual Excel → PDF rapi lulus
