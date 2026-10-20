# Implementation Plan (IMPLEMENTATION-PLAN.md)

## 1. Ikhtisar Tahapan Pengembangan (Phases)

Pengembangan Doc-builder dibagi ke dalam 9 fase terukur dengan prinsip mitigasi risiko awal melalui feasibility spike:

```text
Phase 01: Feasibility Spikes & Technical Validation (Risiko Terberat)
    │
    ▼
Phase 02: Foundation, Workspace & Local Security Architecture
    │
    ▼
Phase 03: Local Persistence & Project Data Management (IndexedDB)
    │
    ▼
Phase 04: Core CV/Resume Builder & Template Engine
    │
    ▼
Phase 05: Deterministic ATS Analysis & Job Match Engine
    │
    ▼
Phase 06: Document Conversion Orchestration & Sandbox
    │
    ▼
Phase 07: PDF Utilities & Image Processing Tools
    │
    ▼
Phase 08: Security Hardening, Accessibility & Multi-Browser E2E
    │
    ▼
Phase 09: UAT, Corpus Benchmark Verification & Distribution Release
```

## 2. Rincian dan Exit Criteria per Fase

### Phase 01: Feasibility Spikes & Technical Validation
- **Tujuan:** Menguji asumsi teknis paling berisiko sebelum fondasi kode dibangun.
- **Scope Task:**
  - TASK-1.1: Evaluasi library PDF→DOCX pada corpus referensi (benchmark fidelitas, stabilitas, lisensi).
  - TASK-1.2: Evaluasi library NLP lokal bilingual (ID/EN) (memori, akurasi keyword extraction, kecepatan).
  - TASK-1.3: Abstraksi subprocess sandbox dan network egress block (Windows & Linux).
  - TASK-1.4: Evaluasi packaging runtime backend mandiri (PyInstaller/Nuitka) (cold start ≤5 detik).
- **Exit Criteria:** Laporan kelayakan terdokumentasi di Decision Log; library definitif dipilih; kriteria kemiripan visual visual disepakati.

### Phase 02: Foundation & Local Architecture
- **Tujuan:** Membangun monorepo workspace, setup tooling quality gate, dan arsitektur komunikasi aman localhost.
- **Scope Task:** TASK-2.1 (Monorepo setup), TASK-2.2 (Dynamic port, session cookie, health check, CSRF).
- **Exit Criteria:** Linter, formatter, typechecker, dan pipeline test berjalan sukses; server FastAPI terikat ke 127.0.0.1 dengan proteksi origin.

### Phase 03: Local Data & Draft Storage
- **Tujuan:** Pengelolaan data CV offline pada browser dan mekanisme cadangan portabel.
- **Scope Task:** TASK-3.1 (IndexedDB store, autosave, undo delete, mode privat), TASK-3.2 (Export/Import file project dengan enkripsi AES-GCM opsional).
- **Exit Criteria:** Data tidak hilang saat refresh; crash recovery teruji; opsi hapus permanen berfungsi.

### Phase 04: CV Builder & Template Engine
- **Tujuan:** Antarmuka penyusunan CV interaktif dan live preview.
- **Scope Task:** TASK-4.1 (Editor form & Live preview), TASK-4.2 (2 template ATS + 2 visual), TASK-4.3 (Ekspor PDF & DOCX), TASK-4.4 (Ekstraksi impor CV lama).
- **Exit Criteria:** CV dapat diselesaikan ≤15 menit; berkas PDF dan DOCX hasil ekspor valid dan dapat disunting kembali.

### Phase 05: ATS Engine & Job Matching
- **Tujuan:** Evaluasi keterbacaan mesin dan kecocokan terhadap lowongan kerja.
- **Scope Task:** TASK-5.1 (Skor ATS struktur 0-100 & rekomendasi), TASK-5.2 (Job matching parser & skor relevansi), TASK-5.3 (Ekspor laporan PDF).
- **Exit Criteria:** Skor konsisten pada dataset sintetis; peringatan anti-keyword stuffing aktif.

### Phase 06: Document Conversion Orchestration
- **Tujuan:** Orkestrator konversi dokumen dua arah yang aman.
- **Scope Task:** TASK-6.1 (DOCX→PDF via LibreOffice), TASK-6.2 (PDF→DOCX via engine terpilih), TASK-6.3 (Queue 1 job, timeout 5m, auto-cleanup TTL 5m).
- **Exit Criteria:** Konversi file ≤25 MB selesai ≤60 detik; berkas temporer bersih 100%.

### Phase 07: PDF & Image Tools
- **Tujuan:** Utilitas pendukung pengolahan dokumen lamaran.
- **Scope Task:** TASK-7.1 (Merge/Split PDF, Image to PDF, PDF to Image), TASK-7.2 (Resize JPG/PNG target KB/MB dengan pembersihan EXIF).
- **Exit Criteria:** EXIF terhapus otomatis; optimasi ukuran foto presisi tanpa penurunan resolusi drastis.

### Phase 08: Hardening & Multi-Browser E2E
- **Tujuan:** Pematangan kualitas, aksesibilitas, dan ketahanan keamanan.
- **Scope Task:** TASK-8.1 (WCAG 2.2 AA & Playwright multi-browser test), TASK-8.2 (Security scans, SCA, SAST, DAST baseline).
- **Exit Criteria:** 0 temuan Critical/High; kompatibilitas 4 browser modern terbukti.

### Phase 09: UAT & Release
- **Tujuan:** Validasi pengguna akhir dan packaging distribusi.
- **Scope Task:** TASK-9.1 (UAT 10 pengguna & verifikasi fidelitas corpus ≥95%), TASK-9.2 (Packaging executable & script start).
- **Exit Criteria:** 90% kepuasan UAT; instalasi lokal berjalan lancar di Windows & Linux.
