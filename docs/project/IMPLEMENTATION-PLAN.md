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
  - TASK-1.3: Abstraksi subprocess sandbox dan rencana network egress block (Windows & Linux). Implementasi aktual hanya proxy env; egress block OS-level belum ada (`RISK-SEC-003`).
  - TASK-1.4: Evaluasi packaging runtime backend mandiri (PyInstaller/Nuitka) (cold start ≤5 detik).
- **Exit Criteria:** Laporan kelayakan terdokumentasi di Decision Log; library definitif dipilih; kriteria fidelitas field/teks disepakati. Metrik visual formal (SSIM/pixel diff) belum ditetapkan (`Q-001`).

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
- **Scope Task:** TASK-8.1 (WCAG 2.2 AA & rencana Playwright multi-browser test), TASK-8.2 (Security scans, SCA, SAST, DAST baseline).
- **Exit Criteria:** 0 temuan Critical/High yang diketahui pada saat Phase 08; kompatibilitas 4 browser modern **belum terverifikasi** karena Playwright tidak terpasang dan tidak ada E2E suite (`Q-005`). **Catatan 2026-10-24:** audit dokumentasi menemukan `RISK-SEC-003` (HIGH provisional), sehingga exit criteria ini tidak dapat dipakai sebagai dasar release berikutnya sampai risk tersebut diselesaikan.
- **Catatan 2026-10-24:** Implementasi aktual TASK-8.1 menjalankan Vitest + axe-core, bukan Playwright. Klaim “4 Browser matrix PASS” pada traceability lama telah dikoreksi menjadi NOT VERIFIED.

### Phase 09: UAT & Release
- **Tujuan:** Validasi pengguna akhir dan packaging distribusi.
- **Scope Task:** TASK-9.1 (UAT 10 pengguna & verifikasi fidelitas corpus ≥95%), TASK-9.2 (Packaging executable & script start).
- **Exit Criteria:** 90% kepuasan UAT; instalasi lokal berjalan lancar di Windows & Linux.

## 3. Peningkatan Pascarilis CV Builder (2026-10-24)

Peningkatan berikut berada di luar baseline Phase 01–09 dan tidak mengubah status rilis historis. Seluruh item telah diimplementasikan dan diverifikasi pada 2026-10-24, tetapi belum di-commit, belum di-push, dan belum dirilis.

| Task | Requirement | Capability | Dependency | Status |
|---|---|---|---|---|
| `IMPROVEMENT-CV-PREEXPORT-001` | FR-024, FR-034, FR-035 | Estimasi pagination A4, overlay page-break, preflight kualitas ekspor, acknowledgment warning, dan sanitasi nama berkas frontend/backend | TASK-4.3 | ✅ Selesai dan terverifikasi |
| `IMPROVEMENT-CV-STRUCTURED-001` | FR-036, FR-037, FR-038 | Headline profesional, pencapaian terstruktur, reorder entri/bagian, deskripsi pendidikan, validasi tanggal, dukungan 4 template + DOCX + parser | TASK-4.1–TASK-4.4 | ✅ Selesai dan terverifikasi |
| `IMPROVEMENT-CV-WORKFLOW-001` | FR-039, FR-040, FR-041 | CV target, impor selektif merge/replace + undo, pencarian/favorit/rename/duplikasi draft, dan hardening autosave | TASK-3.1, TASK-4.4, TASK-5.2 | ✅ Selesai dan terverifikasi |

## 4. Tahapan Transformasi Layanan Online Multi-Tier (2026-11-08)

Rangkaian fase berikut (Phase 10 s/d Phase 14) merancang dan mengeksekusi transformasi Doc-builder menjadi layanan web online publik di VPS Ubuntu 24.04 dan Cloudflare Edge:

```text
Phase 10: U2NetP Feasibility Spike & VPS Host Hardening
    │
    ▼
Phase 11: Multi-User Auth, Cloud CV Storage & Retention Lifecycle
    │
    ▼
Phase 12: Standalone Serverless URL Shortener (Cloudflare Workers + D1)
    │
    ▼
Phase 13: Remove-Background Web Interface & Encrypted Disaster Recovery
    │
    ▼
Phase 14: End-to-End Online Verification, Security Scan & Production Deployment
```

### Phase 10: U2NetP Feasibility Spike & VPS Host Hardening
- **Tujuan:** Menguji kelayakan model segmentasi latar belakang U2NetP pada spesifikasi host VPS (1 vCPU, 2.2 GiB RAM) dan memperkuat pembatasan resource server lokal.
- **Scope Task:**
  - `TASK-10.1`: Feasibility Spike U2NetP CPU-only (benchmark latensi ≤ 15s, peak RSS memori < 400 MB, pembebasan memori pasca subprocess, queue max 2, concurrency 1, hard timeout 30s).
  - `TASK-10.2`: Boundary Hardening & Cleanup Sweeper (perbaikan permission workspace ke `0700` (`RISK-SEC-002`), TTL 1 jam untuk berkas anonim, disk fail-closed guard pada ambang 70% warning dan 80% blokir).
- **Exit Criteria:** Benchmark latensi dan RAM U2NetP memenuhi batas SLA di VPS; penolakan antrean 429 terbukti; workspace `0700` terverifikasi.

### Phase 11: Multi-User Auth, Cloud CV Storage & Retention Lifecycle
- **Tujuan:** Menyediakan akun pengguna dengan otentikasi ganda (Email/Password & Google OAuth), penyimpanan draf CV terstruktur, kuota maksimal 5 CV, retensi 90 hari, dan notifikasi email kedaluwarsa.
- **Scope Task:**
  - `TASK-11.1`: Database Schema & Backend Authentication Service (User table, session management, Argon2id hashing, Google OAuth handler, anti-auto-merge guard untuk mencegah account takeover).
  - `TASK-11.2`: CV Quota Engine & Retention Cleaner (max 5 CV per akun, max 10 MB per dokumen, max 50 MB total akun, global cap 5 GB, retensi 90 hari dari `updated_at`, background sweeper).
  - `TASK-11.3`: Integrasi Email Transaksional Brevo Free (adapter API, template verifikasi email, token reset password 15m, notifikasi kedaluwarsa H-14, H-7, H-1).
  - `TASK-11.4`: Antarmuka Akun Frontend (Modal login/register, Google OAuth button, dialog akun & kuota CV, sisa hari kedaluwarsa, fitur hapus akun mandiri).
- **Exit Criteria:** Pendaftaran, login, dan account linking aman terverifikasi 100%; kuota 5 CV dan retensi 90 hari teruji dengan test otomatis.

### Phase 12: Standalone Serverless URL Shortener (Cloudflare Workers + D1)
- **Tujuan:** Membangun layanan pemendek URL publik mandiri berlatensi rendah di edge Cloudflare Workers dan database D1 dengan kontrol penuh oleh pemilik.
- **Scope Task:**
  - `TASK-12.1`: Cloudflare Workers Routing & D1 Setup (Schema tabel `urls`, direct 302 redirect, 404 handler, 410 Gone untuk link revoked, larangan daur ulang slug, agregat analitik).
  - `TASK-12.2`: Anti-SSRF Validation & HMAC Authenticated Management API (Validasi skema HTTPS publik, penolakan IP internal RFC 1918, link-local, loopback, dan reserved; autentikasi pembuatan link via HMAC signature + timestamp + nonce).
  - `TASK-12.3`: Admin UI & Cloudflare Access Integration (Halaman kelola link khusus pemilik dilindungi Cloudflare Access Zero Trust, export backup snapshot D1 berkala).
- **Exit Criteria:** Pengalihan URL edge berlatensi ≤ 100 ms; validasi anti-SSRF lulus uji penetrasi sintetis; pembuatan link tanpa HMAC ditolak.

### Phase 13: Remove-Background Web Interface & Encrypted Disaster Recovery
- **Tujuan:** Menyediakan antarmuka interaktif penghapus latar belakang gambar dan mengimplementasikan sistem pencadangan terenkripsi ke Cloudflare R2.
- **Scope Task:**
  - `TASK-13.1`: Frontend Modal Remove-Background (Upload dialog 10 MB JPG/PNG/WebP, pratinjau transparan checkerboard, pemilih warna latar belakang pratinjau, unduh PNG RGBA).
  - `TASK-13.2`: Encrypted Backup ke Cloudflare R2 Standard (Snapshot database & CV terenkripsi AES-256-GCM di VPS, unggah ke private bucket R2, lifecycle deletion rule 7 hari, rehearsal restore).
- **Exit Criteria:** Pengguna dapat menghapus latar belakang foto dan mengunduh PNG transparan; backup terenkripsi berhasil diuji pulih pada mesin terpisah.

### Phase 14: End-to-End Online Verification, Security Scan & Production Deployment
- **Tujuan:** Verifikasi komprehensif seluruh sistem online, pemindaian keamanan, dan konfigurasi deployment produksi VPS.
- **Scope Task:**
  - `TASK-14.1`: Pengujian Integrasi Multi-Tier & Security Regression (Tenant isolation BOLA test, brute-force test, rate limiting verification, secret scan, SCA pip/npm).
  - `TASK-14.2`: Konfigurasi Produksi VPS & Reverse Proxy Caddy (Setup service systemd non-root, konfigurasi Caddyfile dengan TLS 1.3 & rate limiting, monitoring script disk & RAM).
- **Exit Criteria:** Seluruh test suite (Unit, Integration, Security) PASS 100%; 0 open Critical/High security findings; layanan live dan dapat diakses publik dengan aman.

## 5. Tahapan Rebranding Satukit & Migrasi Database PostgreSQL (2026-11-08)

Rangkaian fase berikut (Phase 15 dan Phase 16) mengimplementasikan perubahan nama produk menjadi Satukit dan pemindahan database backend ke PostgreSQL sebelum penyelesaian kuota CV:

```text
Phase 15: Rebranding Penuh Satukit & Maskot Kitu
    │
Phase 16: Fondasi & Migrasi Database PostgreSQL Co-Located
    │
Phase 11 (Lanjutan): CV Quota, Email Brevo & Frontend Auth
    │
Phase 13 (Lanjutan): Encrypted PostgreSQL Backup ke R2
    │
Phase 14: E2E Verification & VPS Production Live
```

### Phase 15: Rebranding Penuh Satukit & Integrasi Maskot Kitu
- **Tujuan:** Mengubah seluruh identitas nama dan visual produk dari Doc-builder menjadi Satukit ("Satu Tempat, Banyak Solusi Digital") dengan maskot Kitu, mengadaptasi Beranda/Dashboard, dan memigrasikan identifier internal dengan jaminan backward-compatibility penuh tanpa merusak draf pengguna atau format berkas `.docbuilder`.
- **Scope Task:**
  - `REBRAND-SATUKIT-001`: Governance, CR-015, Requirements, Decisions, Inventaris Identifier, dan Kontrak Kompatibilitas.
  - `REBRAND-SATUKIT-002`: Produksi Aset Visual Baseline (Logo horizontal, logomark, favicon SVG, fallback Kitu transparan statis).
  - `REBRAND-SATUKIT-003`: Brand Foundation & Design Tokens (CSS variables warna Satukit, tipografi, metadata title & favicon).
  - `REBRAND-SATUKIT-004`: Adaptasi Beranda/Dashboard (Wajah baru Satukit, hero tagline, kartu studio, draf CV, Kitu companion).
  - `REBRAND-SATUKIT-005`: Navbar, Footer Developer, & Shell Workspace (Wordmark Satukit, footer Satukit, integrasi Kitu tahap 1).
  - `REBRAND-SATUKIT-006`: Rename Runtime Publik (Teks UI frontend, judul backend FastAPI, OpenAPI docs, pesan error pengguna, nama default berkas ekspor).
  - `REBRAND-SATUKIT-007`: Migrasi Browser Storage & Session (IndexedDB `satukit_db` dual-read copy, transisi cookie `satukit_session`, localStorage prefix).
  - `REBRAND-SATUKIT-008`: Rename Package, Launcher Script, & Service (`package.json`, launcher `start-satukit.*` + alias `start-docbuilder.*`, temp prefix `satukit_*`).
  - `REBRAND-SATUKIT-009`: Migrasi Identitas Cloudflare Worker Shortener (Nama worker Satukit, domain routing, branding portal admin Zero Trust).
  - `REBRAND-SATUKIT-010`: Full Rebranding Verification & Compatibility Gate (Regression test frontend/backend, import `.docbuilder`, E2E multi-viewport, security scan).
  - `REBRAND-SATUKIT-011`: Kitu Mascot Phase 2 (Animasi individual transparan per emosi saat aset produksi final siap).
- **Exit Criteria:** Seluruh tampilan antarmuka dan metadata publik beridentitas Satukit; draf lama dan sesi pengguna terbaca normal; berkas `.docbuilder` dapat diimpor tanpa kendala; seluruh test suite lulus 100%.

### Phase 16: Fondasi & Migrasi Database PostgreSQL Co-Located
- **Tujuan:** Menggantikan database relasional SQLite pada backend FastAPI dengan PostgreSQL yang berjalan pada host VPS yang sama (co-located) untuk mendukung konkurensi multi-user, transaksi aman, dan isolasi tenant.
- **Scope Task:**
  - `DB-POSTGRES-001`: Arsitektur PostgreSQL, Driver psycopg/asyncpg, Setup Migration SQLAlchemy/Alembic.
  - `DB-POSTGRES-002`: Skema PostgreSQL & Migration Baseline (users, oauth_accounts, user_sessions, auth_tokens, shortener fallback).
  - `DB-POSTGRES-003`: Abstraksi Repository Database & Migrasi AuthService ke PostgreSQL.
  - `DB-POSTGRES-004`: Migrasi Local Shortener Fallback ke PostgreSQL & Handler HTTP 302 Redirect Lokal (`GET /s/{slug}`).
  - `DB-POSTGRES-005`: Pengujian Integrasi, Konkurensi, & Keamanan PostgreSQL.
  - `DB-POSTGRES-006`: Hardening PostgreSQL Co-located di VPS (Tuning RAM shared_buffers 128MB, loopback listen 127.0.0.1, least-privilege app user).
  - `DB-POSTGRES-007`: SQLite Retirement Gate (Pemutusan dependency SQLite backend, pengalihan inisialisasi startup ke PostgreSQL).
- **Exit Criteria:** Autentikasi dan sesi berjalan 100% di PostgreSQL; pengalihan URL lokal 302 berfungsi dengan atomic click count; test konkurensi dan security lolos; konsumsi memori database aman (<400 MB RSS).
