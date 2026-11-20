# Project State

```yaml
project_name: "Beresin by Satukit (sebelumnya Satukit / Doc-builder)"
complexity: "complex"
provisional_security_risk_level: "HIGH"
security_risk_level: "HIGH"
security_owner: "User (Owner)"
data_owner: "User (Owner)"
security_risk_approved_by: "User (Owner)"
security_risk_approved_at: "2026-11-08"
security_gate_status: "APPROVED"
security_gate_evidence_ref: "docs/project/SECURITY.md#145-checklist-security-planning-gate--fitur-video-ke-teks-cr-023--gerbang-2-disetujui-2026-11-13"
security_review_due: "2026-11-20"
remediation_gate_status: "NOT_REQUIRED"
remediation_allowed: false
remediation_task: null
status: "IN_PROGRESS"
requirements_approved: true
plan_approved: true
implementation_allowed: true
current_phase: "phase-beta-release"
current_task: "EXCEL-PDF-001"
last_completed_task: "GOOGLE-OIDC-001"
blocked_reason: null
last_updated: "2026-11-19"
```

## Ringkasan Fokus
Task **`EXCEL-PDF-001`** (`.agent/plan.md` — Perbaikan Normalisasi Tata Letak Konversi Excel ke PDF) **berstatus `🧪 Menunggu verifikasi`** (implementasi normalisasi `openpyxl`, jalur `.xls` → `.xlsx` sementara, parameter API & UI pemilih orientasi, pembaruan `frontend/dist`, serta seluruh suite backend & frontend lulus, menunggu uji manual visual berkas Excel nyata di browser):
- **Normalisasi Workbook & Jalur `.xls`:** `backend/app/services/office_converter.py` & `backend/app/services/libreoffice.py` kini menormalkan `print_area` ke rentang sel terpakai nyata (termasuk nilai `0`, formula `=0`, merged cells, tabel Excel, dan style lokal anti-ekspansi `XFD`), menyembunyikan sheet kosong awal beserta memindahkan `wb.active`, membersihkan manual row/col page break, mengaktifkan `fitToPage=True`/`fitToWidth=1`/`fitToHeight=0`/`scale=None`, menyetel margin wajar, memilih orientasi otomatis (landscape untuk tabel lebar) atau sesuai pilihan (`auto`/`portrait`/`landscape`), dan mempra-konversi `.xls` → `.xlsx` terisolasi sebelum normalisasi.
- **API & UI Orientasi:** `POST /api/converter/spreadsheet-to-pdf` (`backend/app/api/converter.py`), `frontend/src/services/converter.ts`, dan `frontend/src/components/converter/SpreadsheetConverterModal.tsx` mendukung pemilih orientasi **Otomatis / Portrait / Landscape** pada tab *Excel ke PDF*.
- **Verifikasi Otomatis Pasca-Edit Akhir:** Ruff (`check` & `format --check`) `0` error (`4` file), `36/36` targeted Pytest (`test_libreoffice` + `test_office_converter` termasuk 3 tes LibreOffice nyata `.xlsx`/`.xls`→PDF), `437/437` full backend Pytest PASS, Oxlint `0` error, `14/14` `office_converter.test.tsx`, `53/53` full Vitest (`425/425` tests) PASS, `tsc -b && vite build` PASS (`frontend/dist` diperbarui), dan `scan_secrets.py` (`0` secrets) PASS.

Task **`WORD-PDF-MERGE-001`** (`.agent/plan.md` — Penggabungan Kartu `DOCX ke PDF` & `PDF ke DOCX` Menjadi `Word & PDF`) **berstatus `🧪 Menunggu verifikasi`** (implementasi komponen + integrasi `App.tsx` + pembaruan `frontend/dist` & seluruh 53 suite Vitest lulus, menunggu uji manual UI di `#/tools`):
- **Kartu & Modal Gabungan:** `frontend/src/App.tsx` menggabungkan `DOCX ke PDF` dan `PDF ke DOCX` menjadi satu kartu **Word & PDF** (`Konversi Dokumen`: `3 alat`; total alat aktif `18` / `9 Coming Soon`). `frontend/src/components/converter/WordPdfModal.tsx` menyediakan tab **Word ke PDF** (`DocxToPdfModal` `embedded`) & **PDF ke Word** (`PdfToDocxModal` `embedded`) tanpa overlay/tombol tutup ganda dengan reset state saat berganti tab.
- **Verifikasi Otomatis Pasca-Edit Akhir:** Oxlint `0` errors, `35/35` targeted Vitest (`word_pdf_modal`, `converter`, `pdf2docx`, `accessibility` WCAG 2.2 AA, `app.integration`), `53/53` full Vitest (`423/423` tests) PASS, `tsc -b && vite build` PASS (`frontend/dist` diperbarui), serta `scan_secrets.py` (`1659` file, `0` secrets) PASS.

Task **`SESSION-TTL-001`** (`.agent/plan.md` — Sesi Login 6 Jam Absolut) **berstatus `🧪 Menunggu verifikasi`** (implementasi config, service, cookie, env docs, Alembic `008_shorten_session_ttl.py`, eksekusi migrasi DB lokal, & seluruh suite backend lulus, menunggu restart server & uji manual browser):
- **TTL Absolut 6 Jam:** `SESSION_TTL_DAYS = 30` diganti menjadi `SESSION_TTL_HOURS = 6` (`_env_int("SESSION_TTL_HOURS", 6)`) pada `backend/app/core/config.py`, `auth_service.create_session` (`expires_at = now + SESSION_TTL_HOURS * 3600` tanpa sliding window pada `validate_session`), cookie `satukit_session` (`max_age = SESSION_TTL_HOURS * 3600` -> `Max-Age=21600`), dan `deploy/satukit.env.example`.
- **Migrasi Sesi Lama:** Ditambahkan `AuthRepository.shorten_existing_sessions`, Alembic `008_shorten_session_ttl.py`, serta CLI `scripts/shorten_session_ttl.py`. Eksekusi pada DB lokal memangkas `130` sesi lama PostgreSQL (`129` langsung kedaluwarsa).
- **Verifikasi Otomatis Pasca-Edit Akhir:** Ruff `0` error (`8` file), `19/19` Pytest (`test_auth_service`, `test_postgres_migration`, `test_postgres_setup`), `21/21` `test_auth_api`, `430/430` full backend Pytest PASS, dan `scan_secrets.py` (`1657` file, `0` secrets) PASS.

Task **`FS-10`** (`.agent/plan.md` — Pemindaian Berkas Rak Berkas Tidak Pernah Selesai) **berstatus `🧪 Menunggu verifikasi`** (implementasi launcher + worker heartbeat/recovery + dev R2/keyring lintas-proses + UI status + build `frontend/dist` & seluruh suite tes otomatis lulus, menunggu uji manual `start-satukit.bat` live):
- **Launcher:** `start-satukit.bat` kini menyingkirkan worker sisa sebelumnya, menunggu kesiapan `http://127.0.0.1:8000/api/health`, menjalankan `backend\.venv\Scripts\python.exe -m app.workers.file_worker` di jendela terpisah, dan menghentikan proses `app.workers.file_worker` pada blok cleanup.
- **Worker Heartbeat & Recovery:** `backend/app/workers/heartbeat.py` + `backend/app/workers/file_worker.py` mencatat `RuntimeState(key="file_worker_last_seen")` di setiap `run_worker_pass` (dan status `"stopped"` saat loop berhenti), serta memulihkan item `CHECKING` tertinggal > 15 menit (`STALE_CHECKING_TIMEOUT_SECONDS = 900.0`) hanya bila heartbeat worker aktif dengan log peringatan non-PII.
- **Fallback Lintas-Proses Dev:** `backend/app/services/r2_storage.py` (`LocalDiskR2StorageClient`) & `backend/app/services/file_crypto.py` (`_ensure_dev_keyring_file` di `.local_security/`) menjaga objek terenkripsi dan kunci enkripsi konsisten antara `uvicorn` dan `file_worker` saat kredensial R2 belum disetel di `.env` lokal.
- **Health & UI:** `/api/health` (`file_worker`) dan `/api/files/metrics` melaporkan `worker_status`, `worker_fresh`, dan `heartbeat_age_seconds`; `FileShelfView.tsx` menampilkan `"Memproses & memindai..."` atau `"Menunggu worker pemindai..."` pada `status-checking` beserta badge status worker kecil.
- **Verifikasi Otomatis:** Ruff `0` error (`10` file), `19/19` worker/crypto Pytest, `30/30` health/file-shelf Pytest, `427/427` full Pytest, Oxlint `0` error, `9/9` `FileShelfView.test.tsx`, `52/52` (`419/419`) Vitest, `tsc -b && vite build`, serta `scan_secrets.py` (`1655` file, `0` secrets) seluruhnya PASS.

Task **`GOOGLE-OIDC-003`** (`.agent/plan.md` — Wajib Verifikasi Anti-Bot untuk Login Google) **berstatus `🧪 Menunggu verifikasi`** (implementasi backend + frontend + pembaruan `frontend/dist` & seluruh suite tes otomatis lulus, menunggu restart server host & uji manual browser):
- **Backend Pending Cookie & Endpoints:** Callback login/register Google (`tx.intent == "login"`) di `backend/app/api/auth.py` kini tidak menerbitkan `satukit_session` langsung, melainkan menyetel cookie HttpOnly HMAC `satukit_google_pending` (`path=/api/auth/google/challenge`, TTL `600s` via `backend/app/core/config.py`) dan mengarahkan ke `/#/login?auth_status=google_challenge_required`. Tersedia 3 endpoint publik rate-limited (`10/min`) di `PUBLIC_PATHS` (`backend/app/core/middleware.py`): `POST /api/auth/google/challenge`, `/refresh`, dan `/verify` (`Cache-Control: no-store`, validasi `user_id` cookie vs `challenge_token`, pencabutan sesi lama, serta penghapusan cookie pending).
- **Frontend Flow & UI:** `frontend/src/services/auth.ts`, `frontend/src/App.tsx`, dan `frontend/src/components/auth/LoginPage.tsx` menangani rute `google_challenge_required` langsung ke tampilan Step 2 verifikasi anti-bot Google tanpa alert error, mendukung ganti soal, fallback ke Step 1 saat pending cookie kedaluwarsa (`401`), dan meneruskan `onLoginSuccess(user)`.
- **Verifikasi Otomatis Pasca-Edit Akhir:** Ruff (`check` & `format --check`) PASS, `37/37` targeted Pytest (`test_google_oidc`, `test_auth_api`, `test_production_config`) PASS, `425/425` full backend Pytest PASS, Oxlint `0` errors, `29/29` targeted Vitest (`LoginPage` + `app.integration`) PASS, `52/52` full Vitest (`418/418` tests) PASS, `tsc -b && vite build` PASS (`frontend/dist` diperbarui), dan `scan_secrets.py` (`1653` file, `0` secrets) PASS.

Task **`GOOGLE-OIDC-002`** (`.agent/plan.md` — Klasifikasi Error, Retry Transport, Clock Skew Adaptif, Logging Callback Google OIDC, & Pelestarian Sesi Bootstrap) **berstatus `🧪 Menunggu verifikasi`** (dua akar masalah ditemukan & diperbaiki; seluruh 422 tes backend lulus, menunggu restart server host & retest browser):
- **Fix #1 (Clock Skew):** Mengidentifikasi penyebab `google_invalid_response` pada `10:19:50 WIB`: `Token used too early, 1794971990 < 1794972051` (jam Windows tertinggal 61 detik). Menaikkan `TOKEN_CLOCK_SKEW_SECONDS = 300` serta menambahkan adaptasi otomatis dari header `Date` server Google (`_compute_skew_from_headers`, maks `MAX_CLOCK_SKEW_SECONDS = 3600`) di `backend/app/services/google_oidc.py`.
- **Fix #2 (Bootstrap menimpa sesi login menjadi guest):** Setelah login Google sukses (`OAUTH_ACCOUNTS: 1`, redirect `/#/home?auth_status=google_login_success`), panggilan awal `POST /api/auth/bootstrap` dari `App.tsx` menimpa cookie `satukit_session` pengguna dengan `session_manager.session_token` sehingga `/api/auth/me` kembali ke mode `guest` dan Navbar tetap menampilkan `Masuk`. Menambahkan `_get_active_user_csrf(request)` di `backend/app/api/auth.py` agar `POST/GET /api/auth/bootstrap` mempertahankan cookie sesi akun aktif dan mengembalikan `csrf_token` sesi pengguna.
- Hasil verifikasi otomatis pasca-edit akhir: `34/34` targeted (`13/13` `test_google_oidc.py`, `17/17` `test_auth_api.py`, `4/4` `test_production_config.py`) PASS, `422/422` full backend Pytest PASS, Ruff check & format `All checks passed!`, dan `scan_secrets.py` (`1653` file, `0` secrets) PASS.

Task **`GOOGLE-OIDC-001`** (`CR-026`, `DEC-033` — Autentikasi Google OpenID Connect PKCE Backend & Linking/Unlinking Aman Akun Password) **telah selesai dan terverifikasi**:

1. **Task `GOOGLE-OIDC-001` Selesai & Terverifikasi (Google OIDC PKCE Backend & Account Linking/Unlinking):**
   - Mengimplementasikan alur Google OpenID Connect Authorization Code + PKCE (`S256`) backend murni menggunakan pustaka `google-auth[requests]` tanpa SDK frontend.
   - Mengikat transaksi state dan nonce ke timing-safe hash rahasia via cookie HttpOnly `satukit_google_oauth_tx` (TTL 300s) dan tabel PostgreSQL `oauth_transactions` (Alembic `007_google_oidc.py`).
   - Menerapkan penegakan anti-auto-merge (`ACCOUNT_MERGE_REQUIRED`) untuk mencegah pengambilalihan akun lokal ber-password.
   - Menyediakan alur penautan (`/api/auth/google/link/start`) dan pemutusan (`/api/auth/google/unlink`) akun Google yang aman dengan kewajiban login, validasi CSRF, verifikasi password aktif saat ini, dan jaminan akun memiliki password lokal sebelum tautan diputus.
   - Menambahkan kolom `users.avatar_url`, memvalidasi hanya host HTTPS `*.googleusercontent.com`, dan merender dengan `referrerPolicy="no-referrer"` di frontend Navbar.
   - Menambahkan izin `https://*.googleusercontent.com` pada direktif CSP `img-src` reverse proxy Caddy.
   - Hasil verifikasi: `407/407` Pytest backend PASS, `52/52` Vitest test suites (414 tests) PASS, `npm run build` Vite production PASS, Ruff check 0 error, dan `scan_secrets.py` (1652 files) 0 hardcoded secrets.

Task **`REBRAND-BERESIN-001`** (`CR-025`, `DEC-032` — Rebranding Resmi ke **Beresin by Satukit** dengan Tagline **"Urusan Berkas? Beresin Aja!"**) **telah selesai dan terverifikasi**:

1. **Task `REBRAND-BERESIN-001` Selesai & Terverifikasi (Rebranding Visual & Copy Publik ke Beresin by Satukit):**
   - Mengintegrasikan aset resmi dari `Beresin_Brand_Kit`: logo horizontal, logomark squircle, icon SVG, dan maskot Kitu.
   - Memperbarui metadata HTML, Open Graph, PWA webmanifest, dan theme color (`#0F9D8A`).
   - Memperbarui copy landing/hero: headline *"Urusan Berkas? Beresin Aja!"*, subheadline *"Buat CV, kelola PDF, konversi dokumen, dan siapkan pasfoto dalam satu tempat."*, serta balon bicara Kitu *"Halo, aku Kitu! Asisten digitalmu di Beresin by Satukit."*.
   - Mengalihkan branding Navbar, Footer, template CV (Beresin Executive), modal utilitas, dan halaman login (`Masuk ke Beresin`).
   - Menyelaraskan string publik backend: default `PROJECT_NAME="Beresin by Satukit API"`, `BREVO_SENDER_NAME="Beresin by Satukit"`, template email verifikasi/reset kata sandi, dan header/footer laporan ATS.
   - Mempertahankan 100% identifier operasional internal (`satukit_*`, IndexedDB `satukit_db`, session cookie `satukit_session`, format `.docbuilder`).
   - Hasil verifikasi: `52/52` Vitest test suites (412 tests) PASS, `400/400` Pytest backend PASS, `6/6` Playwright E2E PASS, Oxlint 0 error, Vite production build PASS, dan `scan_secrets.py` (1650 files) 0 hardcoded secrets.

Task **`BETA-01`** (`CR-024` — Peluncuran Beta: Penonaktifan 9 Fitur Berisiko/Belum Siap sebagai `Coming Soon`, Reorganisasi 7 Kategori `Media & Audio`, & Blokir Endpoint API `503 FEATURE_COMING_SOON`) serta seluruh task pada `phase-office-hardening` (`OFF-01`–`OFF-04`, `CVR-01`, `CVR-02`) **telah selesai dan terverifikasi**:

1. **Task `BETA-01` Selesai & Terverifikasi (Gate Peluncuran Beta UI `Coming Soon`, 7 Kategori, & Middleware `503 FEATURE_COMING_SOON`):**
   - Menonaktifkan 9 fitur di `frontend/src/App.tsx` (`Pengunduh Media`, `Blur Background`, `WebP ke JPG`, `OCR PDF`, `Edit PDF`, `Repair PDF`, `Compress Video`, `MP4 ke MP3`, `Video ke Teks`) dengan status `comingSoon: true`, atribut tombol native `disabled`, guard `handleExecuteTool`, serta badge dan CTA `Coming Soon` (tanpa badge `Perlu Akun`/`Browser`/`Baru`).
   - Menata ulang katalog 28 alat ke dalam 7 kategori (`Konversi Dokumen`, `Kelola & Optimasi PDF`, `Ekstraksi & Digitalisasi`, `Keamanan & Tanda Tangan`, `Gambar & Foto`, `Media & Audio`, `Utilitas Digital`) dan memperbarui `Dashboard.tsx` menjadi `19` (`stat-tools-count`, label `Utilitas aktif`) dan `9 Coming Soon` (`stat-tools-coming-soon`).
   - Memblokir akses langsung ke 13 route API fitur berisiko melalui `BETA_COMING_SOON_GATES_ENABLED=True` di `SecurityMiddleware` (`backend/app/core/middleware.py`) dengan HTTP `503` dan `error_code: "FEATURE_COMING_SOON"`, sambil menjaga `/api/image-tools/remove-background` dan `/api/pdf-tools/compress` tetap aktif.
   - Hasil verifikasi: `84/84` Pytest PASS, Ruff check & format `0` error, `23/23` Vitest PASS, Oxlint `0` error, `tsc -b && vite build` PASS, dan `4/4` Playwright E2E PASS (`dashboard.spec.ts`, `login_guard.spec.ts`).

2. **Task `CVR-02` Selesai & Terverifikasi (Promosi Direct PDF Renderer `PyMuPDF` ke Produksi untuk `POST /api/export/pdf` & `POST /api/ats/export-report-pdf`):**
   - Mengganti implementasi `generate_resume_pdf` di `backend/app/services/pdf_generator.py` dengan renderer langsung `PyMuPDF` (`pymupdf.Story` + `DocumentWriter` + `Shape`) untuk ke-4 template canonical (`ats-clean`, `ats-modern`, `visual-executive` 2-kolom sidebar, `visual-minimal`) dengan dukungan penuh `sectionOrder`, `resumeLanguage` (`id`/`en`), `fontFamily` (`sans`/`serif`/`mono`), `websites` maks 3 + fallback `website`, `achievements` + fallback `description`, `customSections`, sanitasi HTML anti-XSS, dan validasi foto `parse_and_validate_photo()`.
   - Mengganti implementasi `generate_ats_report_pdf` di `backend/app/services/ats_report_generator.py` dengan renderer langsung `PyMuPDF` yang mencakup judul/subjudul, skor & grade, tabel 5 pilar penilaian, rekomendasi, tabel checklist indikator, dan disclaimer, sembari mempertahankan `generate_ats_report_docx` (`python-docx`) untuk ekspor DOCX.
   - Memperbarui test suite di `backend/tests/test_export.py`, `backend/tests/test_ats_report.py`, dan `backend/tests/test_libreoffice.py`.
   - Hasil verifikasi: `40/40` Pytest PASS, Ruff check & format `0` error pada 5 berkas.

2. **Task `CVR-01` Selesai & Terverifikasi (Feasibility Spike Direct PDF Renderer CV & Laporan ATS terhadap Canonical Baseline 4 Template Frontend):**
   - Membuat skrip eksperimen `spikes/cv-pdf-renderer/eval_cv_pdf_renderer.py` menggunakan `PyMuPDF` (`pymupdf.Story` + `DocumentWriter` + `Shape`) tanpa menambah dependensi baru dan tanpa mengubah kontrak produksi `POST /api/export/docx` (`python-docx`).
   - Memverifikasi ke-4 template canonical (`ats-clean` avg `25.03 ms`, `ats-modern` avg `18.11 ms`, `visual-executive` 2-kolom sidebar avg `17.38 ms`, `visual-minimal` avg `14.59 ms`) dan laporan ATS (`3.67 ms`) dengan peak Python heap `1.37 MiB`, sanitasi HTML anti-XSS, dan validasi foto `parse_and_validate_photo()`.
   - Mencatat keputusan arsitektur `DEC-030` di `.agent/DECISIONS.md` (termasuk temuan ligatur Unicode `\ufb01` pada `pymupdf.Story`).

2. **Task `OFF-04` Selesai & Terverifikasi (Observability `/api/health`, Telemetry Konversi Office, & Pembaruan `deploy/RUNBOOK.md`):**
   - Menambahkan `get_libreoffice_lease_health` dan field `libreoffice_worker` (`busy`, `job_type`, `lease_expires_in_seconds`) pada `GET /api/health` tanpa membocorkan PID atau path filesystem.
   - Memperbarui `deploy/RUNBOOK.md` dengan verifikasi & catatan operasional single-active lease LibreOffice pada VPS 1 vCPU.
   - Menambahkan test `test_health_reports_libreoffice_lease_status` di `backend/tests/test_libreoffice.py`.
   - Hasil verifikasi: `16/16` Pytest PASS (`test_libreoffice.py` & `test_health.py`), Ruff check & format `0` error.

2. **Task `OFF-03` Selesai & Terverifikasi (Integrasi HTTP 429 Single-Active Facade pada 6 Endpoint & Pembersihan Orphan Profil):**
   - Memetakan `CONVERSION_BUSY` / `LibreOfficeBusyError` ke HTTP `429 Too Many Requests` pada ke-6 endpoint (`POST /api/converter/docx-to-pdf`, `POST /api/converter/presentation-to-pdf`, `POST /api/converter/spreadsheet-to-pdf`, `POST /api/pdf-tools/merge`, `POST /api/export/pdf`, `POST /api/ats/export-report-pdf`).
   - Memperluas `ConversionJobManager.sweep_expired_workspaces` untuk ikut menyapu direktori temporer OS berawalan `TEMP_DIR_PREFIXES` (`docbuilder_lo_prof_`, `docbuilder_conv_`, `docbuilder_office_`, `docbuilder_pdf_`, `docbuilder_ats_pdf_`) yang melewati TTL.
   - Menambahkan test `test_six_office_endpoints_return_429_when_conversion_busy` dan `test_sweeper_cleans_expired_orphan_libreoffice_profiles` di `backend/tests/test_libreoffice.py`.
   - Hasil verifikasi: `78/78` Pytest PASS, Ruff check & format `0` error (`7` file).
   - Siap melanjutkan ke Gerbang 3 untuk **Task `OFF-04`** (Telemetri health LibreOffice & pembaruan `deploy/RUNBOOK.md`).

2. **Task `OFF-02` Selesai & Terverifikasi (Lease Database Single-Active Lintas Worker untuk Eksekusi LibreOffice):**
   - Menambahkan `LibreOfficeBusyError` dan context manager `acquire_libreoffice_slot` di `backend/app/services/libreoffice.py` berbasis tabel `RuntimeState` (`key="libreoffice_active_lease"`) dengan `pg_advisory_xact_lock` pada PostgreSQL, auto-expiry lease kadaluarsa (`expires_at = now + ttl_sec`), dan fallback in-process lock untuk unit test tanpa DB.
   - Mengintegrasikan `acquire_libreoffice_slot` secara otomatis ke dalam `run_libreoffice_conversion` dan memetakan `LibreOfficeBusyError` ke kode `CONVERSION_BUSY: ...` pada `convert_bytes_to_pdf_sandboxed`.
   - Menambahkan 3 pengujian baru di `backend/tests/test_libreoffice.py` (`test_convert_bytes_to_pdf_sandboxed_returns_conversion_busy`, `test_libreoffice_lease_single_active_and_release`, `test_libreoffice_lease_reclaims_expired_stale_lock`).
   - Hasil verifikasi: `31/31` Pytest PASS (`test_libreoffice.py`, `test_converter.py`, `test_office_converter.py`), Ruff check & format `0` error.
   - Siap melanjutkan ke Gerbang 3 untuk **Task `OFF-03`** (Integrasi HTTP 429 Single-Active Facade pada 6 Endpoint Konversi/Ekspor Office & Pembersihan Orphan Profil).

2. **Task `OFF-01` Selesai & Terverifikasi (Sentralisasi Helper LibreOffice, Isolasi Profil Per-Job, Process-Tree Termination, & Fail-Closed Win32 Job Object):**
   - Membuat modul terpusat `backend/app/services/libreoffice.py`:
     - `build_libreoffice_command`: menyusun argumen baris perintah LibreOffice headless dengan `-env:UserInstallation=file://...` unik per eksekusi (`--headless --invisible --nocrashreport --nodefault --nofirststartwizard --nologo --norestore --nolockcheck`).
     - `validate_pdf_bytes` & `validate_pdf_file`: memvalidasi keberadaan, ukuran berkas, dan magic header `%PDF-`.
     - `run_libreoffice_conversion` & `convert_bytes_to_pdf_sandboxed`: mengeksekusi konversi dalam sandbox dengan pembersihan deterministik direktori profil pengguna.
   - Memperkeras `backend/app/core/sandbox.py`:
     - Menegakkan `start_new_session=True` pada POSIX serta eskalasi `os.killpg(pgid, SIGTERM)` -> `SIGKILL` saat timeout agar child process `soffice.bin` tidak tertinggal sebagai zombie/orphan.
     - Menegakkan fail-closed pada `WindowsJobObject` (`CreateJobObjectW`, `SetInformationJobObject`, `AssignProcessToJobObject`).
   - Memigrasikan seluruh 5 call site LibreOffice (`converter.py`, `office_converter.py`, `pdf_generator.py`, `ats_report_generator.py`) ke helper terpusat tanpa mengubah tanda tangan fungsi atau kode error publik.
   - Menambahkan unit tests `backend/tests/test_sandbox.py` (6 tests) dan `backend/tests/test_libreoffice.py` (8 tests).
   - Hasil verifikasi: `34/34` targeted Pytest PASS, `375/375` full backend Pytest PASS (zero regression), Ruff check & format `0` error pada 8 berkas.
   - Siap melanjutkan ke Gerbang 3 untuk **Task `OFF-02`** (Skema Database & Repository Single-Active Office Conversion Lock/Queue Lintas Worker Uvicorn).

1. **Task `VTT-02` Selesai & Terverifikasi (Ekstraksi WAV, Engine Transkripsi faster-whisper, Format Generator, ZIP Packager, & Integrasi Worker):**
   - Menambahkan helper ekstraksi audio WAV 16kHz mono 16-bit PCM sandboxed (`build_transcription_wav_command` dan `extract_transcription_wav`) di `backend/app/services/video_compressor.py`.
   - Mengembangkan service transkripsi mandiri `backend/app/services/transcription_service.py`:
     - Loader model faster-whisper (CTranslate2 int8 CPU) dengan thread lock singleton dan lazy-import.
     - Fungsi transkripsi `transcribe_audio_file` dengan VAD filter, fail-closed deteksi ketiadaan ucapan `NO_SPEECH`, dan penanganan pembatalan `TranscriptionCancelledError`.
     - Generator format transkrip: `generate_txt` (bertimestamp), `generate_srt` (standar SubRip), dan `generate_docx` (dokumen Word rapi via `python-docx`).
     - Pratinjau transkrip ephemeral `write_preview_json` di direktori workspace (`preview.json`).
     - Generator paket arsip `create_transcription_zip` yang mengemas persis 3 berkas (`.txt`, `.srt`, `.docx`) secara flat tanpa path traversal.
     - Orchestrator `process_transcription_job` yang mengekstrak WAV, menjalankan STT, mengemas ZIP, menulis `preview.json`, dan membersihkan file sementara WAV & unzipped artifacts.
   - Mengintegrasikan branch `job_type == "transcribe"` pada worker `backend/app/workers/video_worker.py`:
     - Probing via `probe_audio_extraction` (durasi <= 600s, fail-closed `NO_AUDIO_STREAM`).
     - Transisi status `scanning` -> `probing` -> `encoding` -> `succeeded`.
     - Output ZIP disimpan pada `output_path`, ukuran berkas dicatat, input video dihapus seketika.
   - Menambahkan pengujian komprehensif:
     - `backend/tests/test_transcription_service.py` (12 unit tests): formatting timestamp, generator TXT/SRT/DOCX, ZIP packaging, mock whisper inference, penolakan NO_SPEECH, cancel handling, dan end-to-end service job.
     - `backend/tests/test_transcription_worker.py` (3 lifecycle tests): sukses transkripsi antrean worker hingga status `succeeded`, fail-closed penolakan audio-less `NO_AUDIO_STREAM` -> `failed`, dan penolakan audio tanpa ucapan `NO_SPEECH` -> `failed`.
   - Hasil verifikasi: `15/15` tests PASS pada suite transkripsi baru, `57/57` tests PASS pada seluruh suite video & worker (zero regression), Ruff linter 0 error, dan `scan_secrets.py` 0 secret pada 1.642 berkas.
   - Siap melanjutkan ke Gerbang 3 untuk **Task `VTT-03`** (Adaptasi Endpoint HTTP API, Pratinjau Ephemeral, Unduhan ZIP Sekali Pakai, & Audit Non-PII).

2. **Task `VTT-01` Selesai & Terverifikasi (Migrasi Skema Database & Adaptasi Model/Repository Queue):**
   - Menambahkan migrasi Alembic `backend/alembic/versions/006_video_to_text.py` (`down_revision = "005_mp4_to_mp3"`): memperluas check constraint `chk_video_jobs_job_type` mencakup `'transcribe'` dan `chk_video_jobs_preset` mencakup opsi bahasa `'auto'`, `'id'`, `'en'`.
   - Menyelaraskan model SQLAlchemy `VideoCompressionJob` di `backend/app/db/models.py`.
   - Mengadaptasi `VideoCompressionRepository` di `backend/app/db/repositories/video_compression_repository.py`: menambahkan konstanta `VALID_TRANSCRIPTION_PRESETS = ("auto", "id", "en")`, memperluas `VALID_JOB_TYPES`, dan memvalidasi `reserve_upload_job` untuk transkripsi.
   - Menambahkan dan memperbarui pengujian di `backend/tests/test_video_compression_db.py`: verifikasi upgrade/downgrade Alembic `006`, reservasi job transkripsi valid, serta penolakan preset/job_type yang tidak sah.
   - Hasil verifikasi: Pytest `10/10` PASS pada DB/migrasi, `42/42` PASS pada seluruh suite video compression (zero regression), Ruff linter 0 error, dan `scan_secrets.py` 0 secret pada 1.639 berkas.
   - Siap melanjutkan ke Gerbang 3 untuk **Task `VTT-02`** (Pipeline Transkripsi, Dokumen Generator, ZIP Packager, & Integrasi Worker).

2. **Task `VTT-00` Selesai & Terverifikasi (Tata Kelola, Gerbang 2, & Sinkronisasi Dokumen Perancangan):**
   - Dokumen perancangan inti diperbarui sinkron: `BRD.md` (`BUS-029`, `BRULE-018`, `KPI-010`, `RISK-BUS-007`), `PRD.md` (`FR-061`, `NFR-PERF-010`, `NFR-REL-011`, `NFR-SEC-017`, `NFR-PRIV-003`, `NFR-UX-006`, `NFR-ACC-006`), `ARCHITECTURE.md` (§9.4), `SECURITY.md` (`THR-046`–`048`, `CTRL-046`–`048`, `RISK-SEC-028`–`030`, §14.5), `TEST-STRATEGY.md` (§2.10), `TRACEABILITY.md`, `IMPLEMENTATION-PLAN.md` (§8), dan `phase-video-to-text.md`.
   - File tracking agen diperbarui: `.agent/CHANGE-REQUESTS.md` (`CR-023`), `.agent/DECISIONS.md` (`DEC-028`), `.agent/TASKS.md` (`VTT-00` s/d `VTT-05`), `.agent/REPORT.md`, dan `.agent/PROJECT-STATE.md`.
   - Gerbang 2 disetujui secara formal oleh User (Owner); `RISK-SEC-023` / `Q-007` (benchmark ClamAV > 250 MB & FFmpeg di VPS Ubuntu staging) tetap dipertahankan sebagai prasyarat **release-blocking** sebelum deploy VPS produksi.
   - Status beralih ke `READY` dan `implementation_allowed: true` untuk memproses task `VTT-01` via Gerbang 3.

2. **Fase Sebelumnya `phase-mp4-to-mp3` (`CR-022`) Selesai & Terverifikasi:**
   - Seluruh task `MP3-00` s/d `MP3-04` telah selesai dan teruji (`41/41` Pytest video, `30/30` core, `37/37` Vitest, `vitest-axe` 0 violations, Playwright count 27, secret scan 0).

1. **Task `MP3-04` Selesai & Terverifikasi (Audit Aksesibilitas WCAG 2.2 AA, Playwright E2E, Regresi Penuh & Penutupan Fase):**
   - Audit Aksesibilitas WCAG 2.2 AA (`frontend/src/components/__tests__/accessibility.test.tsx`):
     - Menambahkan pengujian `Mp4ToMp3Modal` dengan library `vitest-axe`.
     - Hasil: `0` violations (`results.violations == []`).
   - Playwright E2E Test (`frontend/e2e/dashboard.spec.ts`):
     - Memperbarui verifikasi kartu alat terhubung pada Dashboard menjadi 27 utilitas (`stat-tools-count` = `'27'`).
   - Pengujian & Verifikasi Menyeluruh:
     - Ruff `All checks passed!` pada seluruh berkas backend video compression dan suite pengujian.
     - Oxlint `0` error / `0` warning baru pada seluruh berkas frontend yang dimodifikasi.
     - Pytest `41/41` PASS pada seluruh suite video compression (upload, api, db, compressor, worker).
     - Pytest `30/30` PASS pada core auth, audit, disk_guard, dan security test suite.
     - Vitest targeted & accessibility `37/37` PASS (`mp4_to_mp3.test.tsx`, `compress_video.test.tsx`, `accessibility.test.tsx`, `app.integration.test.tsx`).
     - TypeScript compile & Vite build `tsc -b && vite build` PASS (534ms).
     - Secret scan `scripts/scan_secrets.py` memindai 1.637 file: `0` secrets.
     - `git status --short` mempertahankan seluruh berkas uncommitted OCR & CR-020.
   - `RISK-SEC-023` / `Q-007` (benchmark ClamAV > 250 MB & FFmpeg di VPS Ubuntu staging) dipertahankan sebagai prasyarat **release-blocking** sebelum deploy VPS produksi.

2. **Status Fase:**
   - Seluruh exit criteria fase `phase-mp4-to-mp3` telah terpenuhi.
   - Siap menunggu instruksi pengguna untuk langkah rilis atau kebutuhan berikutnya.
2. **Task `VC-04` Selesai & Terverifikasi:**
   - Menambahkan unit `deploy/satukit-video-worker.service` (`User=satukit`, `CPUQuota=75%`, `MemoryHigh=700M`, `MemoryMax=950M`, `ProtectSystem=strict`, `PrivateTmp=true`, `ReadWritePaths=/var/lib/satukit/video_jobs ...`), memperbarui `deploy/Caddyfile.example` (`@videoUpload` `POST /api/video-compressions` `260MB` dan `@defaultBodyLimit` `35MB` untuk seluruh rute lain), serta menambahkan `deploy/VIDEO-COMPRESSION.md` (paket `apt`, `clamd.conf` `StreamMaxLength 300M`, direktori bersama `/var/lib/satukit/video_jobs`, catatan AppArmor `bwrap`, & checklist `Q-007`) tanpa menyentuh `deploy/RUNBOOK.md`.
   - **Verifikasi `VC-04`:** Review konfigurasi statis PASS, `scripts/scan_secrets.py` (`1626` file, `0` secrets), dan `git status --short` menjaga 3 berkas OCR & `CR-020` utuh (`caddy validate` & `systemd-analyze verify` menunggu host Ubuntu staging sesuai `RISK-SEC-023`).
2. **Task `VC-03` Selesai & Terverifikasi:**
   - Melengkapi `VideoCompressionRepository` (`InvalidJobStateError(status_code, reason)`, `mark_job_expired()`, `clear_claimed_job_paths()`, `cancel_job_for_user()`), router `GET /api/video-compressions/{job_id}`, `GET /api/video-compressions/{job_id}/download` (`succeeded -> claimed`, streaming chunk 64 KiB + cleanup file/path di `finally:`, rollback-free `mark_job_expired` di luar blok sesi, audit JSONL non-PII), `DELETE /api/video-compressions/{job_id}`, serta telemetry `ffmpeg_available`/`ffprobe_available` + heartbeat `video_worker` tanpa path internal pada `GET /api/health` (`backend/app/api/health.py`). `backend/app/main.py` tidak perlu diubah karena router & `expose_headers` CORS sudah terpasang di `VC-01`.
   - **Verifikasi `VC-03`:** Ruff targeted (`5` berkas) `All checks passed!`, Pytest `48/48 PASS` (`6/6` `test_video_compression_api.py`, `2/2` `test_health.py`, `6/6` DB, `6/6` upload, `5/5` worker, `8/8` security, `10/10` audit, `1/1` sqlite, `4/4` prod), `scripts/scan_secrets.py` (`1625` file, `0` secrets), dan `git status --short` menjaga 3 berkas OCR & `CR-020` tetap utuh.
2. **Task `VC-02` Selesai & Terverifikasi:**
   - Mengupgrade `ClamAVScanner.scan_file()` & `ensure_fresh_signatures()` di `backend/app/services/file_scanner.py` (streaming `INSTREAM` 64 KiB, pengecekan `"FOUND"` sebelum `": OK"`, kesegaran signature `<= 24 jam`), membangun layanan `backend/app/services/video_compressor.py` (`bwrap` `--tmpfs /tmp` sebelum bind, validasi `ffprobe` MP4/MOV/WebM + rotasi <= 4K/600s/60fps, single-pass H.264 `libx264 -preset veryfast -threads 1` 3 preset tanpa upscale, `-map_metadata -1 -map_chapters -1`, PGID kill, timeout 45m, `OUTPUT_NOT_SMALLER`), serta daemon `backend/app/workers/video_worker.py` (transaksi pendek, recovery job macet `WORKER_INTERRUPTED`, heartbeat non-path `video_worker_heartbeat`, dan sweeper TTL 15m/retensi 24j).
   - **Verifikasi `VC-02`:** Ruff targeted (`5` berkas) `All checks passed!`, Pytest `33/33 PASS` (`10/10` `test_video_compressor.py`, `5/5` `test_video_worker.py`, `7/7` `test_file_worker.py`, `11/11` `test_file_shelf_comprehensive.py`), dan `scripts/scan_secrets.py` (`1624` file, `0` secrets).
   - **Batasan & keutuhan tree:** Host Windows dev tidak memiliki binary `ffmpeg`/`ffprobe`/`bwrap`/`clamd` (`RISK-SEC-023` / `Q-007` tetap release-blocking untuk benchmark staging Ubuntu); `3` berkas OCR & `CR-020` tetap utuh.
2. **Task `VC-01` Selesai & Terverifikasi:**
   - Mengimplementasikan `Settings.VIDEO_COMPRESSION_*` (`backend/app/core/config.py`), model `VideoCompressionJob` (`backend/app/db/models.py`), migration Alembic `004_video_compression.py` (`down_revision = "003_file_shelf"`), `VideoCompressionRepository` atomik (`pg_advisory_xact_lock`, partial unique index PostgreSQL/SQLite, `FOR UPDATE SKIP LOCKED`, `claim_succeeded_job_for_download`), serta router streaming upload `POST /api/video-compressions` (`backend/app/api/video_compression.py` + `backend/app/main.py`) tanpa memanggil `request.body()`.
   - **Verifikasi `VC-01`:** Ruff targeted (`8` file) `All checks passed!`, Pytest `18/18 PASS` (`6/6` `test_video_compression_db.py`, `6/6` `test_video_compression_upload.py`, `2/2` `test_postgres_migration.py`, `4/4` `test_postgres_setup.py`), dan `scripts/scan_secrets.py` (`1620` file, `0` secrets).
   - **Keutuhan tree & batasan diketahui:** `3` berkas OCR (`deploy/RUNBOOK.md`, `PdfOcrModal.tsx`, `pdf_ocr.test.tsx`) serta `CR-020` tetap utuh; drive C: Windows dev melampaui 80% disk guard sehingga fixture test API mem-stub `get_disk_space_info` sehat sebagai default sebelum menguji penolakan `507`.
3. **Task `VC-00` Selesai & Terverifikasi:**
   - Menyinergikan tata kelola dan dokumen arsitektur/produk/keamanan/pengujian untuk `CR-021` dengan ID bebas konflik: `docs/project/BRD.md` (`BUS-027`, `BRULE-016`, `KPI-008`, `RISK-BUS-05`), `docs/project/PRD.md` (`FR-059`, `NFR-PERF-008`, `NFR-REL-010`, `NFR-SEC-016`, `NFR-PRIV-002`, `NFR-UX-004`, `NFR-ACC-004`), `docs/project/ARCHITECTURE.md` (§9), `docs/project/SECURITY.md` (`THR-037`–`042`, `CTRL-037`–`042`, `RISK-SEC-021`–`024`, §14.3), `docs/project/TEST-STRATEGY.md` (§2.8), `docs/project/TRACEABILITY.md`, `docs/project/IMPLEMENTATION-PLAN.md` (§6), dan `docs/project/phases/phase-video-compression.md`.
   - Menyinergikan `.agent/CHANGE-REQUESTS.md` (`CR-021`), `.agent/DECISIONS.md` (`DEC-026`), `.agent/OPEN-QUESTIONS.md` (`Q-007`), `.agent/TASKS.md` (`VC-00` s/d `VC-06`), `.agent/REPORT.md`, dan `.agent/PROJECT-STATE.md`.
   - **Verifikasi `VC-00`:** `scripts/scan_secrets.py` (`1615` file, `0` secrets) dan `git status --short` memastikan 3 berkas uncommitted OCR (`deploy/RUNBOOK.md`, `PdfOcrModal.tsx`, `pdf_ocr.test.tsx`) serta seluruh berkas `CR-020` tetap utuh.
   - **Batasan & Blocker Rilis Tercatat:** Host dev Windows tidak memiliki `ffmpeg`/`ffprobe`; benchmark empiris ClamAV `StreamMaxLength` (> 250 MB) + konsumsi RAM `ffmpeg` di Ubuntu staging (`RISK-SEC-023` / `Q-007`) menjadi prasyarat release-blocking sebelum produksi.
5. **Task `VC-00` s/d `VC-05`:** Lapisan backend, artefak deployment VPS, dan UI frontend beserta guard login telah selesai; **Langkah Berikutnya:** Pengajuan dan persetujuan **Gerbang 3 untuk `VC-06`** (audit aksesibilitas `vitest-axe` WCAG 2.2 AA untuk `CompressVideoModal`, update `frontend/e2e/dashboard.spec.ts` `stat-tools-count` `'26'`, regresi penuh, dan penutupan fase `CR-021`).

Fase `phase-watermark-removal` (Fitur Hapus Watermark PDF, JPG/JPEG, dan PNG — `CR-020`, `BUS-026`, `FR-058`) **selesai dan terverifikasi (`RW-01` s/d `RW-06`)**:
1. **Task `RW-06` Selesai & Terverifikasi:**
   - Menambahkan `<WatermarkRemovalModal isOpen={true} onClose={vi.fn()} />` ke `frontend/src/components/__tests__/accessibility.test.tsx`: **7/7 tests PASS (0 pelanggaran WCAG 2.2 AA `vitest-axe`)**.
   - **Regresi penuh & kualitas kode:** `303/303` Pytest PASS (termasuk 12/12 `CR-020` & 45/45 `test_pdf_tools.py`), `392/392` Vitest PASS (50 file), Ruff `All checks passed!` pada seluruh berkas `CR-020` (catatan jujur: `ruff check backend` penuh masih mencatat 91 error pre-existing di berkas lama di luar `CR-020`), Oxlint `0` error (`21` warning pre-existing di luar `CR-020`, `0` warning di file `CR-020`), `tsc -b && vite build` PASS (`2.34s`), dan `scripts/scan_secrets.py` PASS (`1614` file, `0` secrets).
   - Menyinergikan akhir `.agent/TASKS.md`, `.agent/REPORT.md`, `.agent/PROJECT-STATE.md`, `.agent/CHANGE-REQUESTS.md`, `docs/project/SECURITY.md` (`RISK-SEC-017`–`020`, §14.2), dan `docs/project/TRACEABILITY.md`.
   - **Batasan yang diketahui:** Binary Tesseract belum terpasang di host Windows lokal (mode fallback manual teruji penuh, OCR live hanya diuji via mock `pymupdf.Pixmap.pdfocr_tobytes`) dan Playwright live browser E2E belum dijalankan pada `RW-06`.
2. **Task `RW-05` Selesai:** Kartu mandiri `Hapus Watermark` (kategori `organize`, 25 alat total) + login guard `#/login` (`10/10` `app.integration.test.tsx` PASS, `dashboard.spec.ts` `'25'`).
3. **Task `RW-04` Selesai:** Client API & modal `WatermarkRemovalModal.tsx` (`8/8` `watermark_removal.test.tsx` PASS).
4. **Task `RW-03` Selesai:** Mesin OpenCV preview/apply (`cv2.INPAINT_TELEA` radius=5), penghapusan struktural annotation PDF, rekonstruksi PDF hybrid (`150 DPI`), preservasi alpha PNG, stripping EXIF/GPS, endpoint `/api/watermark-removal/{analyze,preview,apply}` & header CORS.
5. **Task `RW-02` Selesai:** Pin `opencv-python-headless` di `backend/pyproject.toml` dan layanan analyzer/manifest `0..1`.
6. **Task `RW-01` Selesai (`DEC-025`):** Feasibility spike corpus & benchmark empiris (`INPAINT_TELEA radius=5`, `PDF 150 DPI`).
7. **Working tree OCR:** 3 berkas perubahan OCR (`deploy/RUNBOOK.md`, `frontend/src/components/pdf-tools/PdfOcrModal.tsx`, `frontend/src/components/pdf-tools/__tests__/pdf_ocr.test.tsx`) tetap dibiarkan di working tree tanpa diubah atau di-commit, serta `"Tesseract OCR tidak ditemukan"` dipertahankan di `backend/tests/test_pdf_tools.py`.
8. **Langkah Berikutnya:** Review owner untuk penutupan formal `RISK-SEC-017`–`RISK-SEC-020` (serta `RISK-SEC-001`–`002`), atau melanjutkan backlog yang belum siap (`TASK-11.3`, `TASK-11.4`, `TASK-13.2`, `TASK-14.1`, `TASK-14.2`) / commit Git atas instruksi eksplisit pengguna.

Fase `phase-file-shelf` (Fitur Rak Berkas Privat Per Akun / File Shelf) **selesai dan terverifikasi penuh (FS-00 s/d FS-09)**:
1. **Pengujian Komprehensif Matriks Upload & Keamanan (`FS-09`):**
   - File `backend/tests/test_file_shelf_comprehensive.py`: 11/11 tests PASS mencakup 10 kelompok matriks upload (format didukung PDF/DOCX/XLSX/PPTX/JPG/PNG/WebP/MD, penolakan format dilarang arsip/SVG/biner, penolakan bom dekompresi/XML defusedxml, makro VBA & script PDF, file terenkripsi password, malformed & polyglot, pelestarian byte EXIF foto statis vs tolak animasi, pemindaian ClamAV fail-closed, batas ukuran 25MB & kuota 5 slot & hard ceiling R2 7GB, batas konkurensi in-flight & rolling rate limits).
   - Verifikasi isolasi cross-tenant anti-BOLA: penolakan unduh/hapus lintas akun mengembalikan HTTP 404 anti-enumerasi.
   - Pindai kredensial `scripts/scan_secrets.py`: 1.603 file dipindai, 0 secret ditemukan.
   - 290/290 Pytest full suite PASS, 379/379 Vitest full suite PASS, Vite build PASS.
2. **Antarmuka UI Rak Berkas `#/files` (`FS-08`):** Selesai dan terverifikasi (8/8 tests PASS).
3. **Background Worker Pemrosesan File (`FS-07`):** Selesai dan terverifikasi (7/7 tests PASS).
4. **Endpoint API Rak Berkas (`FS-06`):** Selesai dan terverifikasi (10/10 tests PASS).
5. **Inspeksi Keamanan & Karantina Berkas (`FS-05`):** Selesai dan terverifikasi (11/11 tests PASS).
6. **Kriptografi AES-256-GCM Envelope 49B & R2 Adapter (`FS-04`):** Selesai dan terverifikasi (10/10 tests PASS).
7. **Skema Database & Alembic Migration 003 (`FS-03`):** Selesai dan terverifikasi (7/7 tests PASS).
8. **Setup Dependensi, Worker Unit, & Keyring (`FS-02`):** Selesai dan terverifikasi.
9. **Feasibility Spike Bubblewrap & ClamAV (`FS-01`):** Selesai dan terverifikasi (`DEC-024`).
10. **Sinkronisasi Dokumen & State Tracking (`FS-00`):** Selesai dan terverifikasi.

Fase `phase-17` (Deployment Produksi VPS Hardening & Runtime Security) **selesai dan terverifikasi**:
1. **Fondasi Runtime & Keamanan Produksi (`DEPLOY-PROD-001`):** Konfigurasi fail-fast pada runtime `IS_PRODUCTION`, validasi kredensial non-default database PostgreSQL, penegakan same-origin relative path `/api`, dan proxy Vite dev.
2. **Autentikasi & Email Transaksional Brevo (`DEPLOY-PROD-002`):** Implementasi Brevo REST API adapter (stdlib urllib) untuk email verifikasi (TTL 15m), reset kata sandi single-use, sliding window in-memory rate limiter untuk mitigasi brute force, dan integrasi UI `LoginPage.tsx`.
3. **Pemisahan Izin Fitur Browser-Only vs Server-Side (`DEPLOY-PROD-003`):** Alat murni browser (WebP ke JPG, QR Code, CV preview/print) dapat diakses anonim di direktori tools; komputasi server VPS diproteksi `SecurityMiddleware` fail-closed (HTTP 401 anonim, HTTP 403 email belum terverifikasi di mode produksi) dengan guard redirect ke `#/login`.
4. **Pembersihan Klaim Offline/Lokal UI (`DEPLOY-PROD-004`):** Seluruh klaim "offline/lokal" pada antarmuka publik diganti dengan "aman & privat", tanpa merusak identifier teknis (`localStorage`, `localhost`, `getLocalShortenedLinks`) atau frasa "budaya lokal".
5. **Artefak Deployment Produksi Lengkap (`DEPLOY-PROD-005`):** Tersedia `deploy/Caddyfile.example` (reverse proxy loopback 127.0.0.1:8000, automatic TLS, security headers), `deploy/satukit.service` (systemd unit dengan isolasi Linux namespaces & limit 1 vCPU / 2.2 GiB RAM), `deploy/satukit.env.example`, skrip backup terenkripsi AES-256-GCM `deploy/backup_r2.sh` + rotasi 7 hari Cloudflare R2, `deploy/restore_r2.sh`, dan runbook `deploy/RUNBOOK.md`.
6. **Audit Akhir & Verifikasi Penuh (`DEPLOY-PROD-006`):** 234/234 Pytest backend PASS, 371/371 Vitest frontend PASS, Vite build PASS, Oxlint 0 error. Repo siap serah terima.
1. Skema database PostgreSQL & model deklaratif `resume_drafts` diimplementasikan dengan migrasi Alembic `002_resume_drafts.py` (relasi `user_id -> users.id` cascade delete, indeks komposit `(user_id, updated_at DESC)` dan `(expires_at)`).
2. Repository `ResumeDraftRepository` dan endpoint API `/api/drafts` terlindung:
   - Autorisasi kepemilikan server-side berbasis `id + user_id` mencegah Broken Object Level Authorization (BOLA).
   - Kuota ketat: maksimal 5 draf aktif per akun, 10 MB per dokumen draf, dan 50 MB total akun; penolakan HTTP 400 dengan pesan solutif.
   - Retensi 30 hari otomatis terhitung dari `updated_at`; akses baca atau unduh tidak memperpanjang masa aktif.
   - Soft-delete dengan window undo 10 detik (`deleted_at`); draf kedaluwarsa 30 hari tidak dapat di-undo dan langsung dihapus permanen.
3. Daemon sweeper `DraftCleanerWorker` (interval 300s) terintegrasi pada lifespan FastAPI plus purge oportunistik saat akses endpoint draf; membersihkan draf kedaluwarsa maksimal 5 menit pasca jatuh tempo.
4. Model hybrid storage frontend:
   - Pengguna login: tersimpan otomatis di PostgreSQL via `/api/drafts`.
   - Pengguna anonim: terisolasi di IndexedDB dengan namespace `'anonymous'`. Draf legacy tanpa `ownerId` tetap anonim dan tidak diklaim otomatis saat login.
   - Mode Privat: tersimpan hanya di memori sesi aktif tanpa jejak ke database server maupun IndexedDB.
   - Manajemen akun: autosave tertunda dibatalkan, draf aktif di-reset saat pergantian pengguna / login / logout.
5. Antarmuka UI (`Dashboard.tsx` & `Navbar.tsx`):
   - Badge sisa hari ("Tersisa N hari") dengan peringatan visual khusus saat sisa hari ≤ 7 hari.
   - Penyelarasan dokumentasi induk seluruh proyek dari 90 hari menjadi 30 hari retensi draf akun (`BRD.md`, `PRD.md`, `ARCHITECTURE.md`, `SOP.md`, `SECURITY.md`, `TRACEABILITY.md`, `IMPLEMENTATION-PLAN.md`).
6. Verifikasi 100% lolos:
   - Backend Pytest: 9/9 `test_resume_drafts.py` PASS, 223/223 full suite PASS; Ruff bersih.
   - Frontend Vitest: 3/3 `useResumeDraft.test.tsx` PASS, 11/11 `dashboard.test.tsx` PASS, 367/367 full suite PASS.
   - TypeScript build: `npm run build` PASS.
   - Playwright E2E: 5/5 tests PASS.

Task `AUTH-MASCOT-001` (Integrasi Maskot Kitu Dinamis pada Halaman Login & Sign Up) **selesai dan terverifikasi**:
1. Menampilkan maskot resmi Satukit (Kitu) di header kartu autentikasi `LoginPage.tsx` (`#/login`).
2. Ekspresi dan animasi maskot berganti secara otomatis mengikuti alur interaksi pengguna:
   - Mode Masuk (Login default): ekspresi `siapmembantu` dengan animasi hop (`animate-kitu-hop`).
   - Mode Daftar (Sign Up): ekspresi `semangat` dengan animasi wiggle (`animate-kitu-wiggle`).
   - Tahap 2 Verifikasi Anti-Bot: ekspresi `berpikir` dengan animasi bob (`animate-kitu-bob`).
   - Sedang Memproses / Validasi: ekspresi `fokus` dengan animasi bob (`animate-kitu-bob`).
   - Kesalahan / Validasi Gagal: ekspresi `kecewa` dengan animasi getar shake (`animate-kitu-shake`).
3. Aksesibilitas terjamin: maskot bersifat dekoratif pendukung visual, ramah `prefers-reduced-motion` lewat CSS global, dan tidak mengganggu screen reader.
4. Verifikasi 100% hijau: 10/10 Vitest `LoginPage.test.tsx`, 364/364 Vitest suite PASS, 5/5 Playwright E2E PASS, Vite build PASS, Oxlint 0 error.

Task `AUTH-VERIFY-001` (Integrasi Database PostgreSQL Lokal, Registrasi, dan Alur Verifikasi Anti-Bot) **selesai dan terverifikasi**:
1. Server PostgreSQL 18 lokal di port 5432 berhasil dihubungkan; database `satukit` dan pengguna `satukit_user` (password `satukit_pass`) diinisialisasi secara otomatis dengan grant privileges lengkap via `backend/scripts/setup_postgres.py`.
2. Migrasi skema database Alembic (`001_initial_schema`) berhasil membentuk seluruh 7 tabel relasional (`users`, `oauth_accounts`, `user_sessions`, `auth_tokens`, `short_urls`, `media_download_jobs`, `media_download_usage`).
3. Perbaikan dependency order/flush pada `AuthRepository`: pemanggilan `session.flush()` setelah `session.add(user)` pada `create_user_with_token` dan `create_google_user` untuk mencegah pelanggaran foreign key PostgreSQL saat menyimpan token verifikasi anak.
4. Pengujian alur otentikasi nyata (live) sukses penuh:
   - Registrasi user baru (`POST /api/auth/register`) menghasilkan akun di PostgreSQL.
   - Login tahap 1 (`POST /api/auth/login-init`) memverifikasi password Argon2id dan memberikan soal matematika SD.
   - Login tahap 2 salah (`POST /api/auth/login-verify`) ditolak (HTTP 400).
   - Login tahap 2 benar (`POST /api/auth/login-verify`) berhasil, menerbitkan sesi PostgreSQL dan cookie `satukit_session`.
   - Pemeriksaan profil (`GET /api/auth/me`) sukses mengembalikan user terotentikasi.
5. Verifikasi kode: 214/214 backend Pytest PASS, 362/362 frontend Vitest PASS, Vite production build PASS.
1. Menghilangkan popup modal untuk login; menyediakan halaman mandiri penuh `frontend/src/components/auth/LoginPage.tsx` di route hash `#/login`.
2. Alur verifikasi dua tahap aman:
   - Tahap 1 (`POST /api/auth/login-init`): pengguna menginput email & kata sandi. Server memverifikasi kredensial. Jika salah, muncul pesan error dan soal matematika TIDAK MUNCUL.
   - Tahap 2 (`POST /api/auth/login-verify`): jika dan hanya jika kredensial benar, server menerbitkan token HMAC terikat `user_id` dan menampilkan kartu soal matematika SD kelas 1 (hasil 0..20). Pengguna mengetikkan jawaban angka dan melakukan verifikasi untuk menerbitkan sesi login (`satukit_session`).
3. Penegakan login guard: pengguna anonim yang mengakses workspace `#/tools` otomatis dialihkan ke halaman penuh `#/login` dengan notifikasi panduan, serta otomatis diteruskan kembali ke `#/tools` setelah berhasil masuk.
4. CV Builder, evaluasi keterbacaan ATS, dan import/export lokal tetap 100% anonim dan bebas diakses tanpa akun.
5. Verifikasi 100% lolos: 8/8 Vitest targeted `LoginPage.test.tsx`, 9/9 Vitest `app.integration.test.tsx`, 362/362 Vitest full suite PASS, 8/8 Pytest `test_auth_api.py`, 8/8 Pytest `test_bot_challenge.py`, 214/214 Pytest full suite PASS, Vite build PASS, 5/5 Playwright E2E PASS.

Task `AUTH-BOT-001` (Generator & Verifier Soal Anti-Bot Matematika SD Kelas 1 Server-Side) **selesai dan terverifikasi**:
1. Modul generator soal matematika SD kelas 1 di `backend/app/services/bot_challenge.py`: operasi penjumlahan dan pengurangan sederhana hasil 0..20, teks soal berbahasa Indonesia ramah anak.
2. Token state berbasis HMAC-SHA256 (`expires_at.nonce.signature`) dengan TTL 5 menit (anti-replay & anti-tamper).
3. Endpoint publik `POST /api/auth/challenge` untuk meminta soal dan token tantangan baru (terdaftar di `PUBLIC_PATHS` middleware).
4. Penegakan verifikasi dua langkah pada `POST /api/auth/login`: mewajibkan `challenge_token` dan `challenge_answer`, menolak jawaban salah atau token kedaluwarsa dengan HTTP 400.
5. Verifikasi 100% lolos: 7/7 unit test di `test_bot_challenge.py` (termasuk 100 iterasi validasi matematika), 7/7 API auth test di `test_auth_api.py`, 212/212 Pytest full backend suite PASS, Ruff clean.

Task `AUTH-ACCESS-001` (Penutupan entry point tidak aman Google Auth & Shortener Management) **selesai dan terverifikasi**:
1. Penutupan endpoint publik Google Auth: `POST /api/auth/google`, `POST /api/auth/link-google`, `POST /api/auth/unlink-google` dihapus dari router publik dan `PUBLIC_PATHS` middleware. Seluruh percobaan akses diblokir (HTTP 401/404/405).
2. Penonaktifan endpoint shortener management: `POST /api/shortener/create` dan `GET /api/shortener/config` tidak lagi didaftarkan di FastAPI application router.
3. Redirect publik `GET /s/{slug}` dan `GET /api/s/{slug}` tetap beroperasi penuh melayani HTTP 302, 404, dan 410 dengan penambahan counter atomik.
4. Katalog alat dokumen publik diselaraskan dari 25 menjadi 24 utilitas; Kartu 4 Pendekkan URL dan quick category di Beranda/Dashboard dihilangkan (grid menjadi 3 kolom rapi).
5. Seluruh verifikasi 100% lolos: 11/11 targeted Pytest, 204/204 Pytest full suite, 8/8 targeted Vitest, 353/353 Vitest full suite, Ruff PASS, Oxlint 0 error, Vite build lolos, Playwright E2E dashboard multi-viewport PASS.

Fase berikutnya: `AUTH-BOT-001` (Implementasi Soal Anti-Bot Matematika SD Kelas 1 Server-Side & HMAC Challenge Token).
Migrasi PostgreSQL Phase 16 (`DB-POSTGRES-001` hingga `DB-POSTGRES-007`) **selesai dan terverifikasi**:
1. Setup dependensi SQLAlchemy 2, Alembic, psycopg binary, dan konfigurasi `DATABASE_URL`.
2. Model deklaratif 7 tabel di `backend/app/db/models.py` dan script migrasi baseline Alembic `001_initial_schema.py`.
3. Abstraksi `AuthRepository` dan `AuthService` bermigrasi penuh mendelegasikan query ke repository relasional.
4. `ShortenerRepository` dan rute redirect publik `GET /s/{slug}` (302/404/410) terpasang dengan counter klik atomik.
5. Uji konkurensi, race condition, transaction rollback, dan proteksi SQL injection lolos pengujian.
6. Hardening PostgreSQL VPS (DEC-021: 280 MB peak RAM < 400 MB target, loopback 127.0.0.1, least-privilege non-superuser user).
7. SQLite Retirement Gate lolos: startup backend tidak lagi menciptakan atau menginisialisasi `docbuilder.db`.
8. Verifikasi menyeluruh: 210/210 Pytest PASS (0 regresi), 0 lint error.

Hotfix kontras dark mode `HOTFIX-DARK-MODE-CONTRAST-001` **selesai dan terverifikasi**:
1. Mengeliminasi kelas fiktif Tailwind `stone-850` pada `Dashboard.tsx` (kartu draf & direktori ruang kerja) dan `PdfEditorModal.tsx` menjadi `dark:bg-stone-900`.
2. Menghilangkan bug teks putih di atas latar putih pada mode gelap.
3. Menambahkan unit test regresi di `dashboard.test.tsx`.
4. Seluruh verifikasi PASS (353/353 Vitest, 189/189 Pytest, 0 Oxlint error, Vite build lolos).

Fitur Pengunduh Media Publik `FEAT-MEDIA-DOWNLOADER-001` (alat ke-25 pada katalog Alat Dokumen Satukit) **selesai dan terverifikasi**. Modal mandiri `MediaDownloaderModal.tsx` terdaftar pada `App.tsx` dengan ikon `Download` di kategori Konversi. Menyediakan fitur:
1. Pemrosesan async berbasis worker background thread & antrean terisolasi (`media_download_jobs` & `media_download_usage`).
2. Penegakan Anti-SSRF: verifikasi resolusi DNS nama host dan penolakan IP loopback, IP privat RFC1918, link-local, multicast, dan metadata cloud AWS/GCP/Azure.
3. Batasan media: video MP4 maks 720p, 250 MB, dan durasi 30 menit tanpa transcoding CPU; ekstraksi gambar/carousel item pertama.
4. Single-use delivery: tautan berlaku 15 menit, dan berkas di server langsung dibersihkan setelah pengunduhan pertama atau kedaluwarsa.
5. Kuota dan pembatasan: rate limit 3 job/jam dan kuota 1 GB/hari per akun dan per IP, maksimal 1 job aktif per pengguna dan 2 kapasitas antrean global.
6. Perlindungan legalitas & hak cipta: penolakan skema non-HTTPS, penolakan playlist/profil/channel/livestream, dan kewajiban centang konfirmasi hak cipta oleh pengguna.
7. Verifikasi lengkap: 9/9 Pytest (`test_media_downloader.py`), 189/189 Pytest full suite PASS, 7/7 Vitest (`media_downloader.test.tsx`), 353/353 Vitest full suite PASS, `stat-tools-count` 25 alat di dashboard E2E, Vite build PASS, Oxlint 0 error.

Fitur Generate QR Code mandiri `FEAT-QR-GENERATOR-001` (alat ke-24 pada katalog Alat Dokumen Satukit) **selesai dan terverifikasi**. Modal mandiri `QrCodeGeneratorModal.tsx` terdaftar pada `App.tsx` dengan ikon `QrCode` di kategori Konversi. Menyediakan fitur:
1. Konversi 100% lokal di browser via library `qrcode@1.5.4` (ECC Level M, margin 4 modul), tanpa upload jaringan atau pencatatan server.
2. Mode input fleksibel: Teks Biasa dan Tautan (URL) dengan penghitungan byte UTF-8 akurat (maks 2.000 byte).
3. Validasi keamanan ketat: penolakan skema non-HTTP/HTTPS (`javascript:`, `data:`, `file:`) dan penolakan URL dengan kredensial tertanam (`user:pass@host`).
4. Pengaturan visual: preset ukuran ekspor (256×256, 512×512, 1024×1024 px; default 512 px) serta kustomisasi warna modul dan latar belakang (preset Classic, Forest, Navy, Charcoal, serta HTML5 color pickers).
5. Validasi rasio kontras warna: deteksi luminansi relatif dan rasio kontras minimum 3:1; otomatis memblokir generate dan unduhan jika modul lebih terang dari latar atau kontras tidak memadai untuk pemindaian.
6. Tombol eksekusi manual ("Generate QR Code") dengan status usang (stale indicator) jika input diubah setelah generate.
7. Opsi ekspor ganda: unduh gambar bitmap PNG (`satukit-qr-code.png`) dan gambar vektor tajam SVG (`satukit-qr-code.svg`).
8. Verifikasi: 14/14 Vitest unit tests (`qr_code_generator.test.tsx`), 346/346 Vitest full suite PASS, 180/180 Pytest backend PASS, Vite build PASS, Oxlint 0 error, 0 axe accessibility violations.

Fitur WebP ke JPG mandiri `FEAT-WEBP-TO-JPG-001` (alat ke-23 pada katalog Alat Dokumen Satukit) **selesai dan terverifikasi**. Modal mandiri `WebpToJpgModal.tsx` terdaftar pada `App.tsx` dengan ikon `FileImage`. Menyediakan fitur:
1. Konversi 100% lokal via browser Canvas API (`toBlob('image/jpeg', quality)`) tanpa unggah atau beban server.
2. Fidelitas ukuran penuh: menjaga dimensi, resolusi, dan rasio aspek asli citra tanpa crop atau downscaling paksa.
3. Penanganan transparansi WebP: perataan latar kanvas dengan default warna Putih (`#FFFFFF`), preset warna (Hitam, Abu-abu, Krem), dan color picker kustom sebelum digambar.
4. Kontrol kualitas kompresi JPG: slider rentang 60%–100% dengan default rekomendasi 92%.
5. Validasi keamanan & batas memori: batas ukuran maksimal 25 MB, batas dimensi 64 juta piksel (8000×8000), serta verifikasi struktur header magic bytes `RIFF` (0..3) dan `WEBP` (8..11).
6. Penanganan WebP animasi: konversi bingkai (frame) pertama secara utuh disertai catatan informatif pada antarmuka.
7. Verifikasi: 16/16 Vitest unit tests (`webp_to_jpg.test.tsx`), 332/332 Vitest full suite PASS, 180/180 Pytest backend PASS, Vite build PASS, Oxlint 0 error, 0 axe accessibility violations.

Fitur Photo Profile Maker mandiri `FEAT-PROFILE-MAKER-001` (alat ke-22 pada katalog Alat Dokumen Satukit) **selesai dan terverifikasi**. Modal mandiri `PhotoProfileMakerModal.tsx` terdaftar pada `App.tsx` dengan ikon `CircleUser`. Menyediakan fitur:
1. Mode subjek foto: Foto Asli (cepat lokal tanpa beban server) dan Hapus Latar Belakang (model segmentasi AI U2NetP lokal).
2. Mode pemotongan objek (Fit Mode) & Safe Headroom Avatar: default awal saat foto dipilih atau diunggah adalah "Pas Utuh (Tidak Terpotong)" (`object-contain`). Bingkai avatar lingkaran secara otomatis menerapkan safe headroom padding 32px (12px untuk persegi), dan penskalaan ekspor kanvas disinkronkan 1:1 (`targetSize - safePadding * 2`) sehingga kepala dan rambut subjek tidak terpotong oleh kelengkungan busur atas lingkaran avatar sejak pertama kali dibuka. Opsi "Isi Penuh (Crop Frame)" tetap tersedia via selector jika pengguna menginginkan crop penuh.
3. Bentuk avatar: Lingkaran (`circle`) dan Persegi (`square rounded-2xl`).
4. Kontrol zoom dan anti-terpotong: rentang zoom diperluas menjadi 20%–300%, dilengkapi tombol Zoom Out (`btn-zoom-out`), Zoom In (`btn-zoom-in`), preset "Pas Utuh" (`btn-zoom-fit`) yang mempertahankan ukuran proporsional citra asli tanpa terpotong, preset 100%, serta wheel scroll pada kanvas pratinjau.
5. Latar belakang: Transparan checkerboard, warna solid (Putih, Slate, Teal, Sky, Amber, Kustom), gradasi linear diagonal 135deg (Sunset, Ocean, Emerald), dan Blur Latar belakang asli (bokeh).
6. Garis tepi (Border): pilihan tebal (0px, 4px, 8px, 14px) dan warna (Putih, Teal, Charcoal, Gold).
7. Preset platform tujuan: Umum 512×512, HD 1080×1080, LinkedIn 400×400, WhatsApp 500×500, Instagram 1080×1080.
8. Komposit canvas ekspor: unduh gambar profil PNG (transparan atau latar) dan JPG (latar putih untuk lingkaran), dengan penskalaan `Math.min` dan padding aman saat mode Pas Utuh agar hasil unduhan identik 1:1 tanpa pemotongan.
9. Verifikasi: 17/17 Vitest unit tests (`photo_profile_maker.test.tsx`), 316/316 Vitest full suite PASS, 180/180 Pytest backend PASS, 1/1 Playwright dashboard spec PASS (22 alat), Oxlint 0 error, Vite build PASS, 0 axe accessibility violations.

Fitur efek Blur Background foto `FEAT-BG-BLUR-001` **selesai dan terverifikasi**. Opsi "Blur Latar" ditambahkan ke selector gaya latar belakang di modal `RemoveBackgroundModal.tsx`. Pengguna dapat mengatur intensitas blur melalui slider (4–40 px) atau preset instan (Ringan 8px, Sedang 16px, Kuat 28px) dengan pratinjau bokeh real-time. Subjek hasil segmentasi AI U2NetP tetap tajam di lapisan depan dengan penjangkaran bawah ("mentok ke bawah"), sementara latar belakang asli diburamkan. Pengguna juga dapat memilih format ekspor (PNG atau JPG) saat mengunduh. Seluruh proses blur dilakukan di browser via Web APIs (HTML5 Canvas & CSS filter) tanpa beban komputasi tambahan di server.

Fitur opsi ukuran pasfoto sebelum unduh `FEAT-BG-RESIZE-001` **selesai dan terverifikasi**. Modal Hapus Latar Belakang Foto (`RemoveBackgroundModal.tsx`) kini menyediakan preset ukuran standar: Asli (resolusi penuh), 2×3 cm (236×354 px), 3×4 cm (354×472 px — CPNS/BUMN/SKCK), 4×6 cm (472×709 px — Ijazah/Buku Nikah/Visa), dan 1:1 Persegi (600×600 px — Avatar profil). Panggung pratinjau menyesuaikan rasio aspek secara responsif. Unduh kanvas memotong subjek secara proporsional terpusat (`center cover`) dengan nama berkas deskriptif (`<nama>_<ukuran>_<warna>.png`).

Task pembersihan visual Beranda dan penataan ulang draf `REBRAND-SATUKIT-021` **selesai dan terverifikasi**. Ornamen batik absolut (`batikLeft`, `batikRight`) pada pembungkus footer di `Dashboard.tsx` telah dieliminasi sehingga tidak lagi bocor menimpa Meja Draf Pengguna. Wadah kartu draf disatukan menjadi kontainer tunggal `rounded-2xl divide-y border` dengan sorotan item aktif `border-l-4 border-l-teal-700 bg-teal-50/70`, simetris dengan Direktori Ruang Kerja. Seluruh tipografi teks deskripsi dan langkah kerja diperbarui ke minimum `>= 13px` untuk memenuhi quality gate Playwright E2E accessibility (3/3 passing).

Task penyesuaian mega menu horizontal CV Builder `REBRAND-SATUKIT-020` **selesai dan terverifikasi**. Kolom Desain & Format dihilangkan dari mega menu karena sudah tersedia di toolbar konteks Builder. Mega menu kini berfokus pada 3 kolom menu utama: Mulai & Kelola (Buat Baru, Draf, Impor), Optimasi & Ekspor (Skor ATS, Unduh PDF, Unduh Word, Cetak), serta Kartu Standar ATS 2026 dengan background solid `#fffdfa` bebas ghosting teks halaman bawah.

Fase Rebranding Penuh ke **Satukit** (**Phase 15**) tercatat selesai untuk `REBRAND-SATUKIT-001` s/d `REBRAND-SATUKIT-020`:
- Pixel-Perfect Mockup Landing Page Satukit & Engine Dark Mode Penuh (`REBRAND-SATUKIT-011` s/d `REBRAND-SATUKIT-015`, 2026-11-08): Menyesuaikan tampilan Landing Page Beranda Satukit sama persis dengan konsep visual mockup `Satukit_Landing_Page_Concept.png`. Mengintegrasikan hero lanskap budaya siluet candi & batik Kawung, tagline brush underline "Satu Tempat, Banyak Solusi Digital", maskot Kitu wadah besek + speech bubble + 3 floating badges (100% Gratis, Super Cepat, Tanpa Login & Aman), quick category bar (7 utilitas interaktif), 4 kartu fitur unggulan Kitu (CV Builder ATS, Edit & Sentuh Foto, Konversi & Kelola PDF, Pendekkan Tautan), banner 3 langkah mudah, serta integrasi draf CV lokal. Mengimplementasikan engine Dark Mode global (`ThemeContext.tsx`, `ThemeToggle.tsx`, `@variant dark`, script anti-FOUC di `index.html`) dengan sakelar ☀️/🌙 di Navbar dan persistensi di `localStorage` (`satukit_theme`). Menyelaraskan seluruh ruang kerja (CV Builder editor, kanvas A4 studio, ATS Optimizer, direktori Tools, modal utilitas, Footer) dalam mode terang dan gelap serasi. Verifikasi menyeluruh: 293/293 Vitest unit tests lulus (43 files), 7/7 accessibility tests (0 axe violations), Playwright E2E batched multi-viewport (1440, 1024, 820, 768, 390 px, zoom 200%, CLS <= 0.1, tipografi >= 13px, dark mode toggle) lulus, 180/180 Pytest backend lulus, dan secret scan bersih.
- Seluruh rangkaian fase implementasi desktop/lokal (Fase 01 s/d Fase 09) telah SELESAI 100%. **Phase 10 (VPS Foundation & Security Hardening)** telah SELESAI (`TASK-10.1` dan `TASK-10.2`). Fitur prioritas **Hapus Latar Belakang Foto (U2NetP AI)** pada **Phase 13** telah SELESAI (`TASK-13.1`). **Phase 12 (Standalone Serverless URL Shortener & UI Integration)** telah SELESAI 100% (`TASK-12.1`, `TASK-12.2`, `TASK-12.3`, dan `TASK-12.4` SELESAI):
- Frontend URL Shortener Modal & Backend Adapter Integration (`TASK-12.4`, 2026-11-08): Mengintegrasikan fitur Pemendek URL ke antarmuka utama aplikasi Doc-builder. Menambahkan kartu alat "Pemendek URL" pada katalog Alat Dokumen (`App.tsx`, menggenapkan menjadi 20 alat dokumen aktif dengan badge "Baru" dan ikon `Link2`). Membangun komponen modal interaktif `UrlShortenerModal.tsx` yang dilengkapi validasi Anti-SSRF (skema HTTPS publik), generator slug acak 6 karakter, kartu hasil tautan singkat dengan tombol salin satu-klik dan tombol uji, riwayat tautan sesi pengguna (`localStorage`), serta link pintas ke Portal Admin Zero Trust. Menyediakan adapter backend FastAPI (`/api/shortener/create` dan `/api/shortener/config` di `shortener.py`) yang menjembatani frontend ke Cloudflare Workers edge dengan tanda tangan HMAC rahasia server atau SQLite fallback lokal. Verifikasi: 280/280 Vitest frontend tests (7/7 `url_shortener.test.tsx`, 7/7 `accessibility.test.tsx`), 179/179 Pytest backend (6/6 `test_shortener_api.py`), Vite build PASS, Ruff check PASS.
- Admin UI & Cloudflare Access Integration (`TASK-12.3`, 2026-11-08): Membangun portal web administrasi interaktif responsif modern di edge (`GET /admin` di `shortener/src/admin.ts`) terlindungi kebijakan Zero Trust Cloudflare Access (`Cf-Access-Authenticated-User-Email` matching `CF_ACCESS_ALLOWED_EMAILS`, `shortener/src/access.ts`) dengan respons penolakan HTTP 403 Forbidden fail-closed dan security headers ketat (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`). Portal admin dilengkapi kartu ringkasan metrik statistik real-time (Total link, aktif, dicabut, klik kumulatif), form pembuatan tautan baru dengan validasi Anti-SSRF dan auto-slug generator, tabel daftar tautan interaktif dengan tombol salin URL cepat dan tombol aksi pencabutan tautan (`Revoke`) disertai modal konfirmasi pengaman. Menambahkan mekanisme autentikasi terpadu di Management API (`/api/links`) yang mengizinkan akses baik melalui sesi Cloudflare Access Zero Trust maupun tanda tangan HMAC-SHA256 (`X-Signature`). Mengimplementasikan script otomatisasi pencadangan snapshot D1 bergulir (`shortener/scripts/backup-d1.mjs` & `backup-d1.sh`) yang menegakkan rotasi retensi (maks 8 snapshot mingguan untuk tier `weekly` dan maks 12 snapshot bulanan untuk tier `monthly`, `FR-048` poin 5) dengan verifikasi integritas file SQL. Verifikasi: 47/47 Vitest shortener tests passing (18 test baru: 6 `access.test.ts`, 7 `admin.test.ts`, 5 `backup.test.ts`), `tsc --noEmit` PASS.
- Anti-SSRF Validation & HMAC Authenticated Management API (`TASK-12.2`, 2026-11-08): Menerapkan filter keamanan ketat Anti-SSRF (`NFR-SEC-008`, `FR-048`) yang mewajibkan skema HTTPS publik, menolak URL dengan kredensial (`user:pass@`), menolak loopback IPv4/IPv6 (`127.0.0.0/8`, `[::1]`, `localhost`), menolak IP private RFC 1918 (`10.x`, `172.16-31.x`, `192.168.x`), menolak cloud metadata AWS/GCP/Azure (`169.254.169.254`), serta obfuski IP desimal/heksadesimal. Membangun Management API (`POST /api/links`, `GET /api/links`, `POST /api/links/:slug/revoke`) yang diamankan oleh tanda tangan kriptografis HMAC-SHA256 (`NFR-SEC-009`) dengan proteksi anti-replay (stempel waktu maksimal selisih 5 menit, nonce acak minimal 8 karakter, komparasi timing-safe). Penegakan larangan daur ulang slug yang telah dicabut (`no slug reuse`) mengembalikan HTTP 409 Conflict. Verifikasi: 29/29 Vitest tests passing (`ssrf.test.ts`, `api.test.ts`, `router.test.ts`), `tsc --noEmit` PASS.
- Cloudflare Workers Routing & D1 Setup (`TASK-12.1`, 2026-11-08): Membangun edge router berkinerja tinggi Cloudflare Workers dan skema basis data SQLite D1 (`shortener/`). Menyediakan pengalihan direct HTTP 302 berlatensi rendah (`NFR-PERF-004`) ke `destination_url` dengan header `Cache-Control: private, max-age=60`, penanganan HTTP 410 Gone untuk tautan berstatus `revoked`/`tombstone`, HTTP 404 untuk tautan fiktif, serta agregasi analitik hit `click_count` dan `last_accessed_at` via `ctx.waitUntil()` yang sepenuhnya terbebas dari pengumpulan PII (tidak menyimpan alamat IP atau fingerprint pengunjung, `NFR-SEC-011`). Endpoint `/health` memvalidasi status layanan. Verifikasi: 9/9 Vitest edge tests passing, tsc typecheck PASS.
- Remove Background Foto & Pasfoto AI U2NetP (`TASK-13.1`, 2026-11-08): Menyediakan utilitas penghapusan latar belakang gambar 100% lokal berbasis model segmentasi U2NetP ONNX (`u2netp.onnx`). Di backend, proses inferensi CPU-only dieksekusi dalam subprocess terisolasi per permintaan (`bg_remover.py`) dengan batas konkurensi 1, antrean 2, hard timeout 30s, dan penolakan deterministik 429 (`Retry-After: 30`). Endpoint `POST /api/image-tools/remove-background` memvalidasi citra (maks 10 MB, JPG/PNG/WebP, magic bytes), EXIF stripping, dan mengembalikan PNG RGBA transparan. Di frontend, modal interaktif `RemoveBackgroundModal.tsx` terintegrasi pada workspace Alat Dokumen (`App.tsx`), dilengkapi canvas checkerboard transparan, pemilih warna latar belakang instan (transparan, putih, merah pasfoto `#D32F2F`, biru pasfoto `#1976D2`, abu-abu `#E5E7EB`, dan pemilih warna kustom), komposit canvas saat unduh, dan metrik latensi/ukuran. Verifikasi: 273/273 Vitest (9/9 `remove_background.test.tsx`, 7/7 `accessibility.test.tsx` 0 axe violations), 173/173 Pytest (4/4 `test_bg_remover.py`), Vite build PASS, Oxlint 0 error, Ruff PASS.
- Database Schema & Backend Authentication Service (`TASK-11.1`, 2026-11-08): Berhasil membangun infrastruktur basis data relasional SQLite berkinerja tinggi (WAL mode, sync NORMAL, foreign keys ON, izin 0700/0600) dan modul autentikasi multi-user lengkap. Mencakup hashing password Argon2id (`argon2-cffi`) standar OWASP, hashing token SHA-256 di database, komparasi timing-safe anti-timing-attack, penegakan Anti-Auto-Merge guard (`BRULE-013`, `NFR-SEC-007` dengan penolakan HTTP 409 `ACCOUNT_MERGE_REQUIRED`), verifikasi kata sandi sadar untuk penautan akun Google OAuth, proteksi pemutusan akun Google, alur reset password single-use ber-TTL 15 menit (`NFR-SEC-006`) dengan pencabutan seluruh sesi aktif, self-delete akun instan cascade, dual-session middleware (multi-user session + guest mode fallback), serta cookie sesi `docbuilder_session` HttpOnly & SameSite=Lax. Verifikasi: 17/17 auth unit & integration tests PASS, 169/169 Pytest PASS, Ruff clean, 264/264 Vitest PASS.
- Boundary Hardening & Cleanup Daemon (`TASK-10.2`, 2026-11-08): Menerapkan permission direktori ketat `0700` (`_ensure_secure_dir`) untuk seluruh workspace job sementara pada host multi-user (`RISK-SEC-002`, `THR-002`, `CTRL-002`), mengaktifkan thread daemon `BackgroundSweeper` berkala (interval 300s, TTL 3600s untuk berkas anonim `BRULE-003`, `NFR-REL-007`), serta disk usage fail-closed guard 70% warning / 80% critical rejection dengan HTTP 507 (`BRULE-014`, `NFR-SEC-012`). Telemetri kapasitas disk juga diintegrasikan pada endpoint `/api/health`. Verifikasi: 152/152 Pytest passing, Ruff check clean.
- Feasibility Spike & Benchmark U2NetP CPU-only (`TASK-10.1`, 2026-11-08): Berhasil memvalidasi kelayakan hosting model segmentasi gambar U2NetP ONNX (`u2netp.onnx`, 4.36 MB, MD5: `8e83ca70e441ab06c318d82300c84806`) pada VPS Ubuntu 24.04 (1 vCPU, 2.2 GiB RAM). Menghasilkan latensi inferensi total 1.63s–1.87s (inferensi murni ~1.05s–1.15s, 8x lebih cepat dari target SLA 15 detik), peak RSS 356–378 MB (< 400 MB target), zero memory leak melalui pola subprocess isolation (delta RAM host 0.00 MB), serta penolakan beban lebih antrean terbukti deterministik dengan HTTP 429 + `Retry-After: 30`. Laporan benchmark lengkap tercatat di `docs/project/benchmarks/U2NETP-SPIKE-REPORT.md` dan keputusan teknis dicatat di `DEC-018`. Verifikasi: 145/145 Pytest backend PASS, Ruff check PASS.
- Footer Pengembang & Tahun Rilis (`FEATURE-DEVELOPER-FOOTER-001`, 2026-11-07): Menambahkan komponen footer reusable `Footer.tsx` di Beranda (`Dashboard.tsx`), workspace ATS, dan workspace Alat Dokumen (`App.tsx`). Footer menyajikan tahun pengembangan (© 2026 Doc-builder), deskripsi aplikasi privat, nama developer (Rahmat Hidayat), serta tautan portofolio eksternal aman (`https://porto.rahmath72.cloud/` dengan `target="_blank"` dan `rel="noopener noreferrer"`). Desain selaras dengan estetika Editorial Paper & Forest Teal dan lulus uji aksesibilitas WCAG 2.2 AA. Verifikasi: 264/264 Vitest passing (3 test baru di `footer.test.tsx` + 1 test baru di `dashboard.test.tsx`), Vite production build PASS, Oxlint 0 error.
- Integrasi & Upgrade Maskot Dokumen Animasi Multi-Frame 18 Emosi (`FEATURE-DOCUMENT-MASCOT-001`, 2026-11-07): Berdasarkan lembar stiker 18 karakter dokumen imut (`Cute Document Mascot Emotion Sticker Sheet.png`), logo aplikasi di Navbar (`Navbar.tsx`) ditingkatkan menjadi maskot dokumen animasi frame-by-frame (`AnimatedDocumentMascot.tsx`) berukuran 48px (`w-11 h-11 sm:w-12 sm:h-12`) dengan tinggi Navbar 64px (`h-16`). Seluruh 18 karakter dipotong presisi di atas pil label teks dan dirakit menjadi master sprite sheet multi-kolom 6 frame × 18 emosi (144×144 px per frame, total 864×2592 px) di `frontend/src/assets/document-mascot-frames.webp` dan `.png`. Setiap emosi memiliki koreografi animasi frame-by-frame unik (squash & stretch, bounce, tremor, tilt) yang digerakkan melalui CSS discrete stepping `steps(5)` dengan durasi dinamis per emosi `--mascot-duration`. Komponen merespon interaksi kontekstual (hover: `berkedip`, klik: `tertawa`, menyimpan: `semangat`, berhasil simpan: `bangga`, pergantian workspace: `sapa_salam`/`siap_membantu`/`penasaran`/`semangat`), rotasi otomatis idle pada seluruh 18 emosi tanpa pengulangan berturut-turut, dan dukungan penuh `prefers-reduced-motion: reduce`. Verifikasi: 260/260 Vitest passing (10 unit test di `animated_mascot.test.tsx` & `navbar_drafts.test.tsx`), Vite production build PASS, Oxlint 0 error / 0 mascot warning.
- Sinkronisasi Kontrak Backend ATS & Job Matcher (`HOTFIX-BACKEND-CONTRACT-001`, 2026-11-07): Berdasarkan audit menyeluruh backend, layanan `ats_analyzer.py` dan `job_matcher.py` diselaraskan agar sepenuhnya kompatibel dengan skema data canonical frontend (`achievements`, `education`, `language`) tanpa merusak backward compatibility untuk draf dan pengujian legacy (`description`, `educations`, `name`). Di `job_matcher.py`, helper `extract_experience_text` menggabungkan `achievements` terstruktur dan `description` lama, `get_resume_educations` mendukung fallback `educations`, serta `extract_language_name` mendukung alias `name`. Di `ats_analyzer.py`, evaluasi Pilar 4 (Dampak Terukur) dan Pilar 5 (Integritas) kini membaca `achievements` sehingga resume dengan butir pencapaian terstruktur dinilai akurat, dan riwayat pendidikan membaca key `education` maupun `educations`. Verifikasi: 145/145 Pytest backend PASS (16 targeted test_ats.py & test_job_match.py), Ruff check PASS, 250/250 Vitest frontend PASS, Vite build PASS.
- Redesign Anti-Slop "Editorial Paper & Forest Teal" (`REDESIGN-EDITORIAL-TEAL-001`, 2026-11-07): Atas permintaan eksplisit pengguna untuk menghilangkan warna ungu/indigo dan tata letak *AI slop*, seluruh permukaan Beranda (`#/home`), Navbar (`Navbar.tsx`), dan shell workspace (`#/builder`, `#/ats`, `#/tools` di `App.tsx`) serta token global (`index.css`) dirombak ke arah visual **Editorial Paper & Forest Teal** (kanvas kertas hangat `#FAF9F6` / `stone-50`, permukaan dokumen `white` berbatas `stone-200`, tinta arang `stone-900`, dan 1 aksen tunggal `teal-800` `< 3%` area layar). Pola *AI slop* (hero pill badges, 4 kartu metrik terpisah berwarna-warni, dan 3 kartu fitur pelangi dengan panah otomatis) digantikan dengan **Header Meja Kerja Editorial**, **Ledger Status Dokumen** bersekat 1px, serta **Grid Asimetris 12-Kolom** yang menempatkan *Arsip & Draf CV Tersimpan* (7 kolom) sebagai fokus utama berdampingan dengan *Direktori Ruang Kerja* (5 kolom). Verifikasi: 249/249 Vitest (`9/9` `dashboard.test.tsx`, `7/7` `accessibility.test.tsx` 0 axe violations), 1/1 Playwright E2E multi-viewport (`1440, 1024, 820, 768, 390` + zoom `200%`, `CLS <= 0.1`, 0 kelas ungu) PASS, Vite build PASS, Oxlint 0 error.
- Refinement & Hardening Beranda/Dashboard (`IMPROVEMENT-DASHBOARD-REFINEMENT-001`, 2026-11-07): Permukaan Beranda (`#/home`) dipoles sesuai standar `frontend-engineering` (Mode B `Operate`, Change Intent `Refinement`, *Quiet local-workspace confidence*): teks baca utama & deskripsi `>= 16px`, label/metadata `>= 13px`, angka metrik `tabular-nums`, kontras terhitung WCAG 2.2 AA/AAA (`>= 7.5:1`), permukaan netral 90–95% (`bg-white`), eliminasi dead control ATS saat skor belum tersedia, sinkronisasi jumlah alat dokumen dinamis (`18`), skeleton loading bebas empty-state flash (`CLS <= 0.1`), alert `storageError` tersanitasi + tombol *Coba Lagi*, guard *double-submit* asinkron, serta verifikasi Playwright Chromium lintas 5 viewport (`1440, 1024, 820, 768, 390`) dan zoom `200%`. Verifikasi: 248/248 Vitest (37/37 test files, 8/8 `dashboard.test.tsx`, 7/7 `accessibility.test.tsx` 0 axe violations), 1/1 Playwright E2E multi-viewport PASS, Vite build PASS, Oxlint 0 error.
- Dashboard / Beranda Utama (`FEATURE-DASHBOARD-HOME-001`, 2026-10-30): Routing default aplikasi saat root tanpa hash kini membuka Beranda (`#/home`). Beranda menyajikan hero studio lokal privat, aksi cepat (Buat CV Baru, Lanjutkan Terakhir, Impor CV), kartu 3 workspace utama (CV Builder, Optimasi ATS, Alat Dokumen), daftar draf CV tersimpan/favorit dengan indikator waktu relatif, bar status ringkas (total CV, skor ATS, status aktif, alat dokumen), dan penanganan empty state yang ramah. Penghapusan pembuatan draf otomatis saat storage kosong: draf baru hanya dibuat saat pengguna sengaja mengklik tombol buat baru atau impor. Integrasi Navbar: penambahan tab navigasi Beranda dan logo header kini mengarahkan ke Beranda. Direct link `#/builder`, `#/ats`, dan `#/tools` tetap kompatibel 100%. Verifikasi: 243/243 Vitest (37/37 test files, 7 test baru), 141/141 Pytest backend, Vite build PASS, Oxlint 0 error.
- Pencocokan Lowongan Kerja Multidimensi Cerdas (`IMPROVEMENT-JOB-MATCHING-001`, 2026-10-27): Engine pencocokan lowongan (`backend/app/services/job_matcher.py` & `frontend/src/services/ats.ts`) ditingkatkan secara komprehensif tanpa dependensi AI/cloud eksternal. Evaluasi mencakup 6 dimensi terbobot: Posisi & Keluarga Peran (25%), Keahlian Wajib vs Preferred (30%), Tanggung Jawab & Bukti Pengalaman (20%), Senioritas & Durasi Pengalaman (10%), Pendidikan (10%), dan Bahasa (5%). Bobot dinormalisasi dinamis jika lowongan tidak menyebut kriteria tertentu. Jika kualifikasi wajib (required) tidak terpenuhi, skor dibatasi maksimal 69. Lowongan tanpa kriteria yang dapat dievaluasi menghasilkan `analysis_status: 'insufficient_data'`. Antarmuka modal (`JobMatchModal.tsx`) menampilkan Skor Kecocokan Profil, badge target/senioritas, kartu rincian dimensi, peringatan batas skor 69, kualifikasi belum terpenuhi, dan mempertahankan alur Buat CV Target. Verifikasi: 141/141 Pytest (8/8 `test_job_match.py`), 236/236 Vitest (8/8 `job_match.test.tsx`), Ruff check PASS, Vite build PASS, Oxlint 0 error.
- Portable Bundled LibreOffice (`PORTABLE-LIBREOFFICE-001`, 2026-10-27): LibreOffice runtime dibundel secara mandiri di `backend/bin/libreoffice` (~700MB, diabaikan dari git via `.gitignore`). Fungsi `detect_libreoffice()` di `backend/app/api/health.py` memprioritaskan direktori portable lokal repositori, env var `LIBREOFFICE_PATH`/`SOFFICE_PATH`, `%LOCALAPPDATA%\Programs\LibreOffice`, sistem `C:\Program Files`, dan `PATH`. Hasil: saat folder proyek dipindahkan ke perangkat Windows lain, aplikasi tetap mendeteksi LibreOffice secara offline tanpa instalasi ulang. Verifikasi: 4/4 konversi integrasi 200 OK (CV PDF, DOCX ke PDF, PowerPoint ke PDF, Excel ke PDF), 136/136 Pytest PASS, Ruff check PASS.
- Audit Trail Lokal (`SEC-AUDIT-001`, 2026-10-27): `backend/app/core/audit.py` menulis event JSONL append-only ke `backend/logs/` dengan permission `0600`/direktori `0700`, rotasi harian UTC, retensi 7 hari, dan fail-open. `SecurityMiddleware` mencatat denial Origin/session/CSRF, error API, dan request `/api/*` tanpa body/header/query/PII. Verifikasi: 10/10 `test_audit.py`, 136/136 Pytest, Ruff PASS, secret scan 180 file 0 temuan. `RISK-SEC-001` berstatus MITIGATED dengan closure menunggu approval owner.
- `#/builder`: pembuatan CV dengan editor 44%, preview 56%, scroll independen per kolom (`h-dvh`), footer navigasi langkah + progress bar, dan aksi CV kontekstual.
- `#/ats`: evaluasi keterbacaan ATS dan pencocokan lowongan dengan visualisasi progress skor.
- `#/tools`: 19 alat dokumen dikelompokkan dalam 4 kategori (*Konversi*, *Kelola PDF*, *Keamanan & Tanda Tangan*, *Gambar*) dilengkapi pencarian instan: DOCX ke PDF, PDF ke DOCX, PowerPoint & PDF, Excel & PDF, Merge Dokumen, Split PDF, Kompres PDF, PDF & Gambar, Edit PDF, Sign PDF visual, Hapus Latar Belakang foto AI, Resize Gambar, Unlock PDF, Protect PDF, Repair PDF, OCR PDF, Watermark PDF, Nomor Halaman, dan PDF to Markdown.
- Perbaikan Tata Letak, UI/UX & Animasi Halus (`IMPROVEMENT-UIUX-LAYOUT-001`): Shell `h-dvh` dengan scroll independen editor & preview (reset penuh pada `@media print`), switcher mobile segmented pill beranimasi, indikator garis aktif tab bagian + auto-scroll ke viewport, footer navigasi Sebelumnya/Berikutnya + progress bar langkah, hook `useDismiss` (klik luar & `Escape`) untuk seluruh popover Navbar serta modal Draft, utilitas animasi mikro 160–280 ms (`fade-in`, `fade-up`, `pop-in`, `toast-in`, `soft-pulse`, `animate-overlay-in`, `stagger-item`) yang menghormati `prefers-reduced-motion: reduce`, tata letak responsif `LanguagesForm`, serta guard unmount async pada `PdfOcrModal`. Verifikasi: 233/233 Vitest (36/36 file, 0 unhandled error, WCAG 2.2 AA axe PASS), Vite build PASS, Oxlint 0 error (16 warning pre-existing).
- Fitur Multi-Website CV (`FEATURE-CV-MULTI-WEBSITE-001`): Informasi Kontak mendukung maksimal tiga alamat website/portofolio (LinkedIn tetap terpisah), dengan model `contact.websites` dan fallback `contact.website` untuk draft lama. Entri kosong tidak dirender/diekspor; live preview 4 template dan ekspor DOCX/PDF dibatasi maksimal tiga entri.
- Peningkatan Preflight & Pagination CV (`IMPROVEMENT-CV-PREEXPORT-001`): Live preview menghitung estimasi halaman A4, menampilkan badge jumlah halaman dan overlay page-break (full-bleed dinormalisasi). Modal ekspor menjalankan preflight kualitas: error memblokir, warning membutuhkan acknowledgment, dan tombol “Perbaiki” membuka bagian terkait. Nama berkas dapat diedit dan disanitasi di frontend serta backend.
- Peningkatan Editor Terstruktur (`IMPROVEMENT-CV-STRUCTURED-001`): Headline profesional, pencapaian per pengalaman dengan tambah/edit/reorder, reorder pengalaman/pendidikan, deskripsi pendidikan, `sectionOrder`, dan validasi tanggal. Draft lama tetap kompatibel melalui fallback `description`; 4 template dan DOCX memakai helper yang sama.
- Peningkatan Alur Kerja CV (`IMPROVEMENT-CV-WORKFLOW-001`): CV target dibuat sebagai salinan draft sumber dengan metadata lowongan dan skill cocok diurutkan lebih dahulu. Impor selektif mendukung `merge`/`replace` per bagian serta undo 30 detik. Daftar draft mendukung pencarian, favorit, rename inline, duplikasi, dan badge target; autosave di-flush sebelum perpindahan draft.
- Verifikasi peningkatan CV & UI/UX: 233/233 Vitest, 126/126 Pytest, Ruff PASS, Vite build PASS, Oxlint 0 error (16 warning pre-existing). Batch ini telah di-commit dan di-push pada `465727b` (2026-10-27).
- Verifikasi fitur multi-website historis: 183/183 Vitest, 121/121 Pytest, Ruff PASS, Vite build PASS, lint 0 error (18 warning pada saat itu).
- Fitur PDF to Markdown Lokal Bergaya iLovePDF (`FEATURE-PDF-TO-MARKDOWN-001`):
  - Kartu baru dengan badge `New!` di workspace Alat Dokumen: "PDF to Markdown" (purple).
  - Modal `PdfToMarkdownModal.tsx`: ekstraksi dokumen PDF ke sintaks Markdown (`.md`) terstruktur 100% lokal via `pymupdf4llm`.
  - Fitur unggulan: panggung pratinjau teks Markdown langsung dengan syntax highlighting container, tombol *Salin Teks* ke clipboard (dengan indikator *Tersalin!*), tombol *Unduh .md*, dan filter rentang halaman target kustom.
  - Verifikasi: 45/45 Pytest `test_pdf_tools.py` (119 backend tests lulus), 179/179 Vitest frontend tests lulus (termasuk 6 unit test PDF to Markdown), 0 pelanggaran WCAG 2.2 AA (axe-core), build sukses, distribusi 5/5 lulus.
- Fitur Watermark PDF & Nomor Halaman PDF Lokal (`FEATURE-PDF-WATERMARK-PAGENO-001`):
  - Dua kartu baru di workspace Alat Dokumen: "Watermark PDF" (rose) dan "Nomor Halaman" (blue).
  - Modal `PdfWatermarkModal.tsx`: stempel teks/gambar, opasitas 10-100%, rotasi arbitrary, posisi 3x3 dan mosaic, seleksi target halaman, output `<nama>_watermarked.pdf`.
  - Modal `PdfPageNumbersModal.tsx`: 4 format nomor, letak posisi 6 titik, jarak margin tepi, lewati sampul depan (start page 2), output `<nama>_numbered.pdf`.
  - Verifikasi: 44/44 Pytest `test_pdf_tools.py` (118 backend tests lulus), 173/173 Vitest frontend tests lulus (termasuk unit test watermark & nomor halaman), 0 pelanggaran WCAG 2.2 AA (axe-core), build sukses, distribusi 5/5 lulus.
- Fitur Repair PDF & OCR PDF Lokal (`FEATURE-PDF-REPAIR-OCR-001`):
  - Dua kartu baru di workspace Alat Dokumen: "Repair PDF" dan "OCR PDF".
  - Modal `PdfRepairModal.tsx`: rekonstruksi xref, trailer patching, dan penyelamatan halaman/stream terpotong via PyMuPDF native (`garbage=4, clean=True, deflate=True`), fail-closed edukatif pada berkas berpassword, output `<nama>_repaired.pdf`.
  - Modal `PdfOcrModal.tsx`: deteksi otomatis ketersediaan Tesseract host via `pymupdf.get_tessdata()`, panduan instalasi edukatif (UB-Mannheim Windows, apt Linux), tombol periksa ulang, seleksi bahasa dokumen (ind, eng, ind+eng), penyisipan teks transparan via `pix.pdfocr_tobytes()`, output `<nama>_searchable.pdf`.
  - Verifikasi: 41/41 Pytest `test_pdf_tools.py` (115 backend tests lulus), 162/162 Vitest frontend tests lulus (termasuk unit test repair & OCR), 0 pelanggaran WCAG 2.2 AA (axe-core), build sukses, distribusi 5/5 lulus.
- Fitur Unlock PDF dan Protect PDF Berbasis AES-256 Lokal (`FEATURE-PDF-SECURITY-001`):
  - Dua kartu terpisah di workspace Alat Dokumen: "Unlock PDF" dan "Protect PDF".
  - Modal interaktif terpadu `PdfSecurityModal.tsx` dengan segmented tab ("Unlock PDF" & "Protect PDF"), pemicu dropzone batas 25 MB, dan toggle tampil/sembunyi password.
  - Mode Protect: Enkripsi AES-256 native PyMuPDF (`PDF_ENCRYPT_AES_256`, `permissions=4095`), validasi password kuat 12-40 byte UTF-8 (huruf besar, kecil, angka, simbol), checklist kekuatan password interaktif, penolakan berkas sudah terenkripsi, penolakan berkas bertanda tangan digital (fail-closed HTTP 422), dan output `<nama>_protected.pdf`.
  - Mode Unlock: Dekripsi password sah via PyMuPDF (`PDF_ENCRYPT_NONE`), penolakan berkas tidak terenkripsi, penolakan password salah (HTTP 422), penolakan berkas bertanda tangan digital (fail-closed HTTP 422), dan output `<nama>_unlocked.pdf`.
  - Kerahasiaan & Privasi: 100% lokal offline tanpa pengiriman data ke server pihak ketiga, password hanya di memori sesaat, tidak disimpan di disk dan dilarang dicatat di log.
  - Verifikasi: 38/38 Pytest pdf_tools (112 backend tests lulus), 15/15 Vitest `pdf_security.test.tsx`, 6/6 suite `accessibility.test.tsx` (0 WCAG 2.2 AA violations), 150/150 frontend test lulus, build lulus, 5/5 verifikasi distribusi lulus.
- Redesign Dialog Pemilih Penandatangan & Multi-Signer Lokal Sign PDF iLovePDF Style (`FEATURE-PDF-SIGN-002`):
  - Dialog pemilih penandatangan ("Siapa yang akan menandatangani dokumen ini? / Who will sign this document?") muncul otomatis setelah berkas PDF diunggah.
  - Dua kartu visual opsi: "Hanya saya" (*Only me*) dan "Beberapa orang" (*Several people*) dengan tombol merah tebal responsif dan panel ringkasan berkas (nama, ukuran, jumlah halaman).
  - Mode "Hanya saya": alur penandatanganan mandiri cepat dengan identitas tunggal "Saya Sendiri".
  - Mode "Beberapa orang": alur Multi-Signer Lokal terpadu dengan palet warna penanda identitas (Biru, Hijau, Ungu, Jingga, Merah Muda), pemilih pihak aktif (Pihak 1, Pihak 2, dst.), penambahan hingga 5 penandatangan, pengubahan nama inline, dan penghapusan pihak.
  - Visualisasi panggung kerja: Elemen overlay pada halaman menampilkan border warna khas pihak penandatangan dan badge tag nama pihak di sudut atas overlay.
  - Tombol "Ganti Mode" (`btn-switch-signing-mode`) di header studio untuk kembali ke dialog pemilih atau mengganti mode penandatangan tanpa perlu mengunggah ulang berkas.
  - Verifikasi: 19/19 Vitest `pdf_sign.test.tsx`, 6/6 suite `accessibility.test.tsx` (0 WCAG 2.2 AA violations), 135/135 frontend test lulus, build lulus, 108/108 Pytest lulus.
- Redesign Penuh UI/UX Editor PDF Layar Penuh iLovePDF Style (`FEATURE-PDF-EDITOR-002`):
  - Modal editor bertransformasi menjadi workspace interaktif layar penuh (`fixed inset-0`) dengan header kontrol terpadu.
  - Kolom kiri: Panel navigasi halaman vertikal (filmstrip), nomor halaman badge, indikator jumlah elemen per halaman, tombol reorder naik/turun, rotasi 90°, duplikasi, dan hapus halaman.
  - Kolom tengah: Kanvas pratinjau halaman PDF resolusi tajam (~960px / 120 DPI) dengan pan/drag/resize elemen overlay langsung di panggung, indikator seleksi aktif, dan kontrol floating zoom (Fit Page, Zoom In/Out, indikator persentase 40%-200%).
  - Kolom kanan: Panel layer "Edit PDF" berisi daftar elemen aktif halaman (Text, Drawing, Image, Signature) dengan fitur reorder z-index (Move Forward/Backward), rename/edit teks langsung, hapus elemen, serta tombol "Hapus Semua" (Remove all).
  - Toolbar atas terpadu: Mode kursor (Pilih), Tambah Teks, Unggah Gambar, Coret Bebas (Free Drawing), Tanda Tangan visual, tombol Undo/Redo riwayat aksi, dan pintasan manipulasi halaman.
  - Aksesibilitas keyboard penuh: Tombol panah (geser posisi), Shift+Panah (resize), Delete/Backspace (hapus elemen), Ctrl+Z (undo), Ctrl+Y (redo), dan 0 pelanggaran axe-core WCAG 2.2 AA.
  - Peningkatan Backend: Penyediaan bidang `preview` resolusi tinggi di `/editor/pages` dan eksekusi sekuensial urutan z-index `overlays` di `/editor/apply` dengan backward compatibility penuh.
  - Tombol aksi utama "Terapkan & Unduh PDF" merah tebal di pojok kanan bawah seperti referensi iLovePDF.
- Fitur Mandiri Sign PDF Visual (`FEATURE-PDF-SIGN-001`):
  - Kartu akses mandiri "Sign PDF" di workspace `#/tools` `App.tsx` yang membuka modal visual mandiri `PdfSignModal.tsx`.
  - Empat aset penandatanganan: Tanda Tangan, Paraf, Nama Terang, dan Tanggal Penandatanganan.
  - Tiga mode input pembuatan tanda tangan & paraf: Coret Kanvas interaktif, Ketik Nama/Inisial (dikonversi otomatis ke kursif via HTML5 Canvas), dan Unggah Gambar PNG/JPEG (maks. 5 MB).
  - Target halaman fleksibel: Halaman Aktif, Rentang Halaman (e.g. `1-3, 5`), atau Semua Halaman dokumen.
  - Panggung kerja interaktif: pratinjau thumbnail halaman aktif, drag overlay bebas dengan Pointer Events, resize sudut dengan aspect-ratio lock untuk tanda tangan/paraf, serta fallback keyboard navigation (tombol panah untuk geser, Shift+panah untuk resize, Delete untuk hapus) dan inspector numerik persentase.
  - Strip film navigasi halaman dengan indikator titik biru pada halaman yang telah memiliki overlay penandatanganan.
  - Backend endpoint `/api/pdf-tools/editor/apply` menerima parameter `output_mode: "signed"` untuk menghasilkan berkas `<nama>_signed.pdf`.
  - Hardening backend: pembatasan maksimum 50 overlay per halaman, sanitasi rasio via `_clean_ratio` (finite 0.0-1.0), dan penolakan format non-PNG/JPEG (HTTP 422).
  - Disclaimer edukatif keabsahan hukum lokal: visual signature bukan sertifikat kriptografis p12/pfx.
  - Aksesibilitas WCAG 2.2 AA (0 pelanggaran axe-core).
- Fitur Editor PDF Visual Lokal (`FEATURE-PDF-EDITOR-001`):
  - Ekstraksi thumbnail per halaman (240px lebar, 72 DPI JPEG base64) berlatar PyMuPDF di bawah kendali job manager.
  - Manipulasi halaman interaktif: geser urutan ke kiri/kanan, rotasi 90° bertahap, duplikasi halaman, dan penghapusan halaman (dengan proteksi minimal 1 halaman tersisa).
  - Penambahan teks overlay dengan konfigurasi ukuran font (10-24 pt), palet warna hex, dan pilihan posisi (Atas, Tengah, Bawah).
  - Penambahan tanda tangan visual via canvas coretan tangan atau gambar overlay dengan pemilihan penempatan (Kanan Bawah standar surat, Kiri Bawah, Tengah).
  - Terapkan & Unduh berkas PDF yang termutasi (`<nama>_edited.pdf`) dengan pengoptimalan kompresi stream `garbage=4, deflate=True`.
  - Fail-closed terhadap berkas PDF terenkripsi dan bertanda tangan digital (HTTP 422).
  - Aksesibilitas WCAG 2.2 AA (0 pelanggaran axe-core).
- Peningkatan UI/UX Modal PDF Tools (`IMPROVEMENT-PDF-TOOLS-UI-002`):
  - Modal dilebarkan dari `max-w-xl` ke `max-w-2xl` memberikan ruang leluasa pada 5 tab dan kartu tingkat kompresi.
  - Tab navigasi diperbarui menjadi segmented control terpadu (`bg-slate-100 p-1 rounded-xl`) yang konsisten dengan modal alat lainnya.
  - Badge pill tingkat kompresi (Lossless, Rekomendasi, Terkecil) diperbaiki tipografinya (`text-[10px]`, `rounded-full`, `leading-none`) sehingga tidak menabrak atau menumpuk teks judul card "Seimbang".
  - Scrollbar digantikan oleh `.custom-scrollbar` slim (6px rounded) dan tombol aksi utama dipastikan tidak terpotong tepi bawah viewport.
- Fitur Konversi PowerPoint & PDF serta Excel & PDF Dua Arah:
  - PowerPoint (.pptx/.ppt) ke PDF dan Excel (.xlsx/.xls) ke PDF menggunakan LibreOffice headless lokal di dalam sandbox subprocess terisolasi dengan penanganan fail-closed ramah (HTTP 422 `LIBREOFFICE_NOT_FOUND`) jika LibreOffice belum terpasang di host.
  - PDF ke PowerPoint (.pptx) merender setiap halaman dokumen menjadi slide visual berpresisi tinggi (144 DPI) dengan penyesuaian dimensi halaman tanpa crop.
  - PDF ke Excel (.xlsx) mengekstrak tabel terstruktur berbasis teks ke dalam sheet terpisah per halaman (menggunakan PyMuPDF `find_tables`), dengan baris pemisah antar tabel dan sanitasi proteksi formula injection (menambahkan prefix kutip tunggal `'` jika teks sel diawali simbol formula `=`, `+`, `-`, atau `@`).
  - Penolakan dokumen PDF scan tanpa tabel terstruktur secara edukatif (HTTP 422 `NO_TABLES_FOUND`).
  - Antarmuka Alat Dokumen (`#/tools`) menyediakan kartu akses terpisah untuk "PowerPoint & PDF" dan "Excel & PDF" dengan modal 2-tab yang accessible (WCAG 2.2 AA compliant).
- Fitur Kompresi PDF Lokal Cerdas (Compress PDF):
  - 3 tingkat kompresi: Ringan (lossless deflating & object streams), Seimbang (default, recompress gambar moderat 144 DPI Q75), dan Maksimum (kompresi agresif 96 DPI Q50).
  - Teks dapat dicari (searchable text), tautan, formulir, dan tata letak halaman tetap dipertahankan penuh.
  - Fail-closed penolakan dokumen PDF bertanda tangan digital (HTTP 422) demi menjaga keabsahan hukum tanda tangan.
  - Jika kompresi tidak menghasilkan berkas lebih kecil, berkas asli diunduh dengan pesan edukatif bahwa PDF sudah optimal.
  - Workspace Alat Dokumen menyediakan kartu mandiri "Kompres PDF" yang langsung membuka tab kompresi modal (`initialTab="compress"`).
- Peningkatan PDF Tools (Merge & Split):
  - Merge dokumen kini menerima berkas PDF, Word (.docx), dan gambar (JPG, PNG).
  - Berkas DOCX dikonversi secara sandboxed menggunakan LibreOffice headless lokal; penolakan ramah dengan HTTP 422 edukatif jika LibreOffice belum terpasang (tanpa hasil parsial atau server crash).
  - Urutan berkas merge dapat diatur naik/turun via tombol ArrowUp dan ArrowDown yang accessible sebelum proses penggabungan.
  - Split PDF rentang halaman majemuk (contoh: `1-3, 5, 7-9`) menghasilkan berkas-berkas PDF terpisah yang dikemas rapi dalam arsip ZIP dengan penamaan deterministik (`01_pages_001-003.pdf`, `02_page_005.pdf`, dst.), dengan tetap menjaga kompatibilitas kontrak lama `output_mode=combined`.
  - Workspace Alat Dokumen menyediakan kartu akses terpisah untuk "Merge Dokumen", "Split PDF", dan "PDF & Gambar" dengan sinkronisasi `initialTab` pada modal.
- Fitur Foto Profil CV adaptif: toggle pemakaian foto pada formulir kontak, pemrosesan crop 1:1 dan EXIF stripping via Canvas di sisi browser, tata letak foto adaptif di 4 template CV (bulat di Visual Executive, rounded-square di AtsClean, AtsModern, dan VisualMinimal), penyembunyian otomatis jika toggle nonaktif (tanpa menghapus draft foto), sanitasi data foto dari payload evaluasi ATS, validasi Base64 dan pencegahan bom dekompresi di backend, penyematan foto ke dokumen Word (.docx) saat toggle aktif, serta penanganan error HTTP 400 tanpa server crash.
- Parser impor CV (PDF/DOCX) diperkuat: domain email dicegah bocor menjadi website, alamat pada baris kontak majemuk berbasis delimiter diekstrak dengan akurat, bullet kotak/privat PDF (`□`, `\uf0b7`, `\u25a1`, dll) dibersihkan dari teks butir dan tidak lagi tertukar menjadi nama jabatan, header majemuk `Jabatan — Perusahaan | Periode` dipetakan presisi, serta kelulusan tahun tunggal (`Lulus 2015`) dipetakan ke `endDate` dengan rendering tanggal tanpa tanda minus gantung pada 4 template pratinjau dan DOCX.
- Topbar tidak lagi menggabungkan seluruh fitur dalam satu baris.
- Navigasi responsif menggunakan hash URL tanpa dependency router baru.
- Opsi dwibahasa (ID/EN) terintegrasi pada topbar desktop & mobile, mengubah label bawaan CV (heading, sekarang/present, dalam/in, IPK/GPA) secara konsisten pada pratinjau live, cetak PDF browser, dan ekspor DOCX/PDF backend tanpa mengubah konten inputan atau teks kustom pengguna.
- Modal Evaluasi ATS memprioritaskan rekomendasi perbaikan, menyediakan CTA kembali ke editor, dan menempatkan ekspor laporan sebagai aksi sekunder.
- Modal responsif layar penuh pada mobile, memiliki semantics dialog, fokus awal, tombol tutup berlabel, serta dukungan `Escape`.
- Impor PDF/DOCX mempertahankan urutan teks, pengalaman/pendidikan multi-baris, bahasa, dan bagian tambahan; hasil wajib ditinjau serta dikonfirmasi sebelum mengganti editor.
- `customSections` dapat diedit, dihapus, dirender oleh empat template, dicetak melalui fallback PDF browser, dan diekspor ke DOCX/PDF backend.
- Frontend API client mengikuti hostname halaman (`localhost` atau `127.0.0.1`) agar cookie sesi `SameSite=Lax` tetap terkirim dan mutasi API tidak gagal 401.
- Form Keahlian & Kompetensi (Skills) disederhanakan menjadi input general tanpa segmentasi dropdown kategori; field internal `category` tetap dipertahankan dengan default `General` demi kompatibilitas penuh draft IndexedDB lama.
- Skrip start-docbuilder (`.bat`, `.ps1`, `.sh`) dan package backend disempurnakan dengan penambahan direktori backend ke `PYTHONPATH` dan `sys.path` otomatis agar import internal `app.*` tidak gagal `ModuleNotFoundError`.
- Network error `Failed to fetch` dibungkus menjadi pesan bantuan instruktif agar pengguna langsung mengetahui status server backend dan solusi peluncurannya.
- Quality gates terbaru (IMPROVEMENT-CV-WORKFLOW-001): 126/126 Pytest PASS, Ruff PASS, 233/233 Vitest PASS, Vite build PASS, Oxlint 0 error dengan 16 warning pre-existing. Verifikasi distribusi belum dijalankan ulang pada perubahan ini.
- Dokumentasi reconciliation (`DOC-CONSISTENCY-001`, 2026-10-24): referensi `DEC-*` pada traceability diselaraskan (`DEC-012` untuk PDF toolkit, `DEC-013` untuk cookie `SameSite=Lax`), stack aktual React 19/Oxlint/Vitest dicatat, command SOP/test strategy dikoreksi, dan klaim Playwright/CI/CD/logging yang tidak didukung kode ditandai. Tiga open risk dicatat: `RISK-SEC-001` (audit/logging, provisional MEDIUM), `RISK-SEC-002` (permission/cleanup temp workspace, provisional LOW), dan `RISK-SEC-003` (sandbox egress hanya proxy env + Linux tanpa memory cap, provisional HIGH). Status rilis dan security gate historis tidak diubah.

## Blocker Aktif
Tidak ada blocker implementasi. Proyek berstatus RELEASED. `RISK-SEC-001` sudah dimitigasi dengan audit trail dan 10 test, tetapi penutupan formal menunggu approval owner. `RISK-SEC-002` dan `RISK-SEC-003` masih memerlukan keputusan owner; `RISK-SEC-003` berstatus High provisional sehingga release berikutnya tidak boleh disetujui sampai dimitigasi atau diterima formal dengan approver dan expiry.

## Keputusan Tertunda
1. Closure approval `RISK-SEC-001` berdasarkan bukti `SEC-AUDIT-001`; treatment `RISK-SEC-002` dan `RISK-SEC-003` (mitigasi vs acceptance dengan expiry), target review 2026-10-31.
2. `Q-005`: apakah cross-browser E2E Playwright diperlukan untuk NFR-COMP-002 atau cukup verifikasi manual.
3. `Q-006`: kebijakan repository untuk `docs/conversations.json` yang berisi 178 transkrip percakapan.

## Next Recommended Action
Owner review dan setujui penutupan `RISK-SEC-001` berdasarkan bukti 10/10 `test_audit.py` dan 136/136 Pytest. Lanjutkan keputusan treatment `RISK-SEC-002` dan `RISK-SEC-003`; untuk `RISK-SEC-003`, prioritaskan apakah akan menambahkan egress block OS-level dan memory cap Linux atau menerima risiko dengan expiry. Jangan melakukan deployment/release berikutnya tanpa approval eksplisit.
