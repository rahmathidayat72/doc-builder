# Panduan Distribusi & Catatan Rilis Doc-builder (DISTRIBUTION.md)

- **Versi Produk:** 1.0.0 (Release Ready)
- **Tanggal Rilis:** 2026-10-21
- **Target Platform:** Windows 10/11 (x64) & Linux / macOS POSIX
- **Arsitektur:** Localhost Desktop App (FastAPI Backend + React Vite SPA)

---

## 1. Ikhtisar Distribusi

Doc-builder dirancang sebagai aplikasi desktop lokal independen tanpa ketergantungan cloud (offline-first). Dalam mode distribusi terpadu:
- Server FastAPI backend menyajikan antarmuka pengguna React SPA secara langsung pada alamat `http://127.0.0.1:8000/`.
- Seluruh endpoint API `/api/*` terproteksi melalui middleware Origin Allowlist, Session Cookie `SameSite=Strict`, dan verifikasi token CSRF.
- Privasi 100% terjaga: draf tersimpan di IndexedDB browser lokal pengguna, dan operasi file sementara dibersihkan secara instan melalui sandbox terisolasi.

---

## 2. Struktur Berkas Distribusi

```text
Doc-builder/
├── start-docbuilder.bat         # Peluncur 1-klik Windows Command Prompt
├── start-docbuilder.ps1         # Peluncur 1-klik Windows PowerShell
├── start-docbuilder.sh          # Peluncur 1-klik Linux / macOS POSIX
├── backend/
│   ├── app/                     # Source code backend FastAPI
│   ├── pyproject.toml           # Konfigurasi dependensi Python
│   └── .venv/                   # Virtual environment lokal
├── frontend/
│   ├── dist/                    # Bundel artefak produksi React SPA
│   │   ├── index.html
│   │   └── assets/
│   └── package.json
├── scripts/
│   ├── verify_distribution.py   # Verifikasi kelayakan bundel distribusi
│   ├── benchmark_corpus.py      # Pengujian fidelitas corpus ATS (100%)
│   └── scan_secrets.py          # Pemindai credential/secret
└── docs/project/                # Dokumentasi arsitektur, keamanan, dan UAT
```

---

## 3. Prasyarat Sistem

1. **Sistem Operasi:** Windows 10/11, Ubuntu 22.04+ / Debian 12+, atau macOS 13+.
2. **Runtime Python:** Python versi 3.11 s/d 3.14 (dengan dependensi di `backend/pyproject.toml`).
3. **LibreOffice (Opsional):** Disarankan untuk mendukung konversi dokumen DOCX ke PDF dan PDF ke DOCX. Jika belum terpasang, fitur Resume Builder, Template ATS, Scoring Job Match, PDF Merge/Split, dan Image Resizer tetap beroperasi 100%.

---

## 4. Cara Menjalankan Aplikasi

### Di Windows
Cukup klik ganda salah satu berkas peluncur:
- **`start-docbuilder.bat`** (CMD), atau
- Klik kanan **`start-docbuilder.ps1`** -> *Run with PowerShell*.

Skrip akan:
1. Memeriksa ketersediaan bundel antarmuka di `frontend/dist`.
2. Menyalakan backend server FastAPI pada `127.0.0.1:8000`.
3. Membuka peramban web bawaan sistem operasi secara otomatis ke alamat `http://127.0.0.1:8000`.

### Di Linux atau macOS
Buka terminal dan jalankan:
```bash
chmod +x start-docbuilder.sh
./start-docbuilder.sh
```

---

## 5. Verifikasi Integritas Paket Distribusi

Sebelum melakukan pengemasan atau distribusi ke pengguna baru, jalankan script verifikasi:
```bash
python scripts/verify_distribution.py
```
Hasil yang diharapkan:
- Seluruh modul backend terpasang.
- Bundel `frontend/dist/index.html` dan assets valid.
- Seluruh skrip peluncur (`.bat`, `.ps1`, `.sh`) siap pakai.
- Endpoint FastAPI melayani root SPA dan `/api/health` dengan kode HTTP 200.

---

## 6. Catatan Rilis Resmi (Release Notes v1.0.0)

### Fitur Utama
1. **Interactive ATS Resume Builder:**
   - Formulir dinamis modular: Kontak, Ringkasan, Pengalaman Kerja, Pendidikan, Keahlian teknis/soft skills, dan Bahasa.
   - Pilihan template standar ATS: *ATS Clean*, *ATS Modern*, dan *ATS Compact*.
   - Kustomisasi tema warna aksen dan jenis font (Sans, Serif, Mono).
   - Pratinjau dokumen lembar A4 real-time dengan status autosave lokal.
2. **Ekspor & Impor Standar Industri:**
   - Ekspor Microsoft Word (.docx) dengan margin dan tipografi standar ATS.
   - Ekspor berkas PDF beresolusi cetak.
   - Impor CV lama dari PDF atau Word DOCX dengan ekstraksi teks dan confidence scoring.
3. **Analisis Skor ATS & Pencocokan Lowongan (Job Match):**
   - Evaluasi kelayakan CV terhadap deskripsi lowongan kerja secara offline.
   - Rekomendasi kata kunci dan perbaikan section yang belum lengkap.
4. **Alat Manipulasi PDF (PDF Tools):**
   - Penggabungan multi-dokumen PDF dan gambar (Merge PDF).
   - Pemisahan berkas PDF berdasarkan rentang nomor halaman (Split PDF).
   - Konversi gambar JPG/PNG ke PDF terpadu.
   - Ekstraksi halaman PDF ke arsip ZIP citra (PNG/JPEG) dengan opsi DPI (72, 150, 300).
5. **Optimasi Foto & Privasi Citra:**
   - Pengubahan ukuran gambar adaptif berdasarkan target ukuran file (KB/MB).
   - Pembersihan otomatis metadata privasi EXIF (koordinat GPS, identitas kamera).
6. **Keamanan & Aksesibilitas Teruji:**
   - Kepatuhan aksesibilitas WCAG 2.2 AA (0 pelanggaran axe).
   - Zero open Critical/High vulnerabilities pada SCA dependensi (`npm audit` & `pip-audit`).
   - Zero hardcoded secrets/credentials pada repository.
   - Fidelitas tata letak resume teruji 100% pada benchmark corpus.
