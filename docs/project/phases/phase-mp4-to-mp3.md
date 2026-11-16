# Phase MP4 to MP3 (`CR-022`) — Fitur Konversi MP4 ke MP3 Asinkron

## 1. Metadata
- **Fase:** `phase-mp4-to-mp3`
- **Change Request:** `CR-022`
- **Status:** In Progress (`MP3-00` selesai dan terverifikasi)
- **Owner:** User (Product, Security & Data Owner)
- **Tanggal Mulai:** 2026-11-13
- **Target VPS:** Ubuntu 24.04 x86_64, 1 vCPU, 2.2 GiB RAM, 4.0 GiB Swap

## 2. Goal & Capability
Menambahkan alat ke-27 pada direktori `#/tools` Satukit (**MP4 ke MP3**) agar pengguna terautentikasi dapat mengekstrak audio dari video lokal MP4 tunggal (≤ 250 MB, durasi ≤ 600 detik) menjadi berkas MP3 stereo murni (`<stem>_audio.mp3`) melalui 3 pilihan preset bitrate CBR (`128k`, `192k` default, `320k`) dengan memanfaatkan antrean PostgreSQL, worker daemon `satukit-video-worker`, dan endpoint `POST /api/video-compressions` dari `CR-021` secara aman dan efisien pada VPS 1 vCPU / 2.2 GiB RAM.

## 3. Requirement Terkait
- **Business:** `BUS-028`, `BRULE-017`, `KPI-009`, `RISK-BUS-06`
- **Product:** `FR-060`, `NFR-PERF-009`, `NFR-REL-011`, `NFR-SEC-017`, `NFR-PRIV-003`, `NFR-UX-005`, `NFR-ACC-005`
- **Security:** `THR-043` s/d `THR-045`, `CTRL-043` s/d `CTRL-045`, `RISK-SEC-025` s/d `RISK-SEC-027`
- **Decisions & Questions:** `DEC-027`, `Q-007` (tetap release-blocking untuk rilis produksi)

## 4. Scope
- Migrasi skema database PostgreSQL `005_mp4_to_mp3.py`: menambah kolom `job_type` (`compress` vs `extract_audio`) dan memperluas check constraint preset (`light`, `balanced`, `maximum`, `128k`, `192k`, `320k`).
- Ekstensi `VideoCompressionRepository` untuk mendukung pembuatan, antrean, dan klaim job `extract_audio`.
- Deteksi & validasi audio via `ffprobe`: verifikasi container MP4, durasi ≤ 600s, tolak fail-closed MP4 tanpa audio stream dengan kode error `NO_AUDIO_STREAM`, pemilihan stream default (fallback `0:a:0`), dan auto-downmix channel > 2 ke stereo (`-ac 2`).
- Ekstraksi audio via `ffmpeg` dalam sandbox `bubblewrap --unshare-net`: codec `libmp3lame`, preset CBR 128k/192k/320k, `-vn`, strip metadata/chapter/cover art (`-map_metadata -1 -map_chapters -1`), timeout 10 menit (600s).
- Adaptasi endpoint `POST /api/video-compressions` (header `X-Video-Metadata` JSON base64url memuat `job_type: "extract_audio"` dan preset MP3), validasi strictly ekstensi `.mp4`, checkbox izin hak cipta, output filename `<stem>_audio.mp3`, single-use claim TTL 15 menit, dan audit log JSONL non-PII (`mp4_to_mp3_requested`, `mp4_to_mp3_downloaded`).
- Frontend modal `Mp4ToMp3Modal.tsx`, integrasi kartu ke-27 di `App.tsx` dengan guard login wajib (`requiresAuth: true`), aksesibilitas WCAG 2.2 AA (`vitest-axe` 0 violations), dan pembaruan Playwright E2E assertion `stat-tools-count` `'27'`.

## 5. Out of Scope
- Ekstraksi audio dari URL video eksternal (YouTube, TikTok, dll) atau format non-MP4 (MKV, AVI, FLV, WebM, MOV).
- Konversi batch multi-file secara bersamaan.
- Format output selain MP3 (WAV, FLAC, AAC, OGG).
- Custom audio filters (equalizer, pitch shift, volume boost, trim/cut).

## 6. Dependencies
- Fitur Compress Video (`CR-021` / `phase-video-compression`) telah selesai dan terverifikasi.
- Daemon `satukit-video-worker` dan konfigurasi reverse proxy Caddy (`POST /api/video-compressions` max_size 260MB) telah tersedia.
- Binari `ffmpeg` dengan dukungan encoder `libmp3lame` dan `ffprobe`.

## 7. References
- `docs/project/BRD.md`: `BUS-028`, `BRULE-017`, `KPI-009`, `RISK-BUS-06`
- `docs/project/PRD.md`: `FR-060`
- `docs/project/ARCHITECTURE.md`: §9.3 Arsitektur Ekstensi MP4 ke MP3
- `docs/project/SECURITY.md`: `THR-043`–`THR-045`, `CTRL-043`–`CTRL-045`, `RISK-SEC-025`–`RISK-SEC-027`
- `docs/project/TEST-STRATEGY.md`: §2.9 Matriks Pengujian MP4 ke MP3
- `.agent/DECISIONS.md`: `DEC-027`

## 8. Entry Criteria
- [x] PRD `FR-060` disetujui di Gerbang 1B.
- [x] Seluruh dokumen teknis arsitektur, keamanan, strategi pengujian, dan rencana implementasi tersinkronisasi.
- [ ] Gerbang 2 / Security Planning Gate disetujui oleh user.

## 9. Tasks

### Task MP3-00 — Migrasi Skema Database & Adaptasi Model/Repository Queue
- **Tujuan:** Menambahkan kolom `job_type` dan memperluas check constraint preset pada `video_compression_jobs` via Alembic migration `005_mp4_to_mp3.py`, serta mengadaptasi model dan repository untuk mendukung job ekstraksi audio.
- **Requirement terkait:** `BUS-028`, `FR-060`, `NFR-REL-011`
- **Dependency:** Gate 2 approval
- **File/komponen terdampak:** `backend/alembic/versions/005_mp4_to_mp3.py`, `backend/app/db/models.py`, `backend/app/db/repositories/video_compression_repository.py`, test suite database
- **Acceptance criteria:**
  - [x] Migrasi `005_mp4_to_mp3.py` menambahkan kolom `job_type VARCHAR(20) DEFAULT 'compress' NOT NULL` dan memperbarui check constraint preset untuk mendukung `('light', 'balanced', 'maximum', '128k', '192k', '320k')`.
  - [x] Model `VideoCompressionJob` dan repository `reserve_upload_job` mendukung parameter `job_type` opsional (default `'compress'`).
  - [x] Constraint konkurensi (1 aktif per user, 1 global running) tetap berlaku bersama untuk kedua tipe job.
  - [x] Test Alembic downgrade/upgrade dan test repository lulus 100%.

### Task MP3-01 — Logika Ekstraksi Audio FFmpeg, Validasi Stream, & Worker Pipeline
- **Tujuan:** Mengimplementasikan probing audio, deteksi ketiadaan stream audio (`NO_AUDIO_STREAM`), pemilihan track default, downmix stereo, perintah FFmpeg `libmp3lame`, dan integrasi worker `satukit-video-worker`.
- **Requirement terkait:** `BUS-028`, `FR-060`, `NFR-PERF-009`, `THR-043`, `THR-045`, `RISK-SEC-025`, `RISK-SEC-027`
- **Dependency:** `MP3-00`
- **File/komponen terdampak:** `backend/app/services/video_compressor.py`, `backend/app/workers/video_worker.py`, unit/integration tests
- **Acceptance criteria:**
  - [x] `probe_audio_extraction` memvalidasi container MP4, durasi ≤ 600s, dan menolak MP4 tanpa audio stream dengan error code `NO_AUDIO_STREAM`.
  - [x] Pemilihan stream memilih flag `default` atau stream audio index pertama (`0:a:0`).
  - [x] Audio > 2 channel (misal 5.1/7.1) otomatis di-downmix ke 2 channel stereo (`-ac 2`).
  - [x] `extract_audio_file` mengeksekusi FFmpeg dalam `bubblewrap` sandbox dengan `libmp3lame`, CBR bitrate sesuai preset (`128k`, `192k`, `320k`), `-vn`, `-map_metadata -1 -map_chapters -1`.
  - [x] Output berkas berupa `<stem>_audio.mp3`.
  - [x] Hard timeout ekstraksi 10 menit (600s) dan pembersihan input segera setelah selesai/gagal.
  - [x] Worker `video_worker.py` memproses job bertipe `extract_audio` sesuai alur di atas.

### Task MP3-02 — Adaptasi Endpoint API, Checkbox Hak Cipta, Download Single-Use, & Audit Log
- **Tujuan:** Menyesuaikan endpoint upload dan status untuk menerima `job_type="extract_audio"`, validasi ekstensi strictly `.mp4`, verifikasi konfirmasi hak cipta, single-use download berkas MP3, dan pencatatan audit JSONL non-PII.
- **Requirement terkait:** `BUS-028`, `BRULE-017`, `FR-060`, `NFR-SEC-017`, `THR-044`, `RISK-SEC-026`
- **Dependency:** `MP3-01`
- **File/komponen terdampak:** `backend/app/api/video_compression.py`, `backend/app/core/audit.py`, integration tests
- **Acceptance criteria:**
  - [x] Header `X-Video-Metadata` menerima `job_type="extract_audio"` dan preset `128k`/`192k`/`320k`.
  - [x] Validasi format menolak selain `.mp4` jika `job_type="extract_audio"`.
  - [x] Endpoint mewajibkan konfirmasi hak cipta (`owner_confirmed=true`) pada payload metadata.
  - [x] Download endpoint `/api/video-compressions/{job_id}/download` menyajikan Content-Type `audio/mpeg` dengan header Content-Disposition yang aman.
  - [x] Transisi atomik `succeeded -> claimed` dan penghapusan berkas MP3 pasca-unduh.
  - [x] Audit log JSONL mencatat event `video_compression.upload` (dengan `job_type`) dan `video_compression.download` tanpa data sensitif / nama berkas.

### Task MP3-03 — Frontend UI Modal, Integrasi Katalog Alat ke-27, & Guard Login
- **Tujuan:** Membangun antarmuka pengguna `Mp4ToMp3Modal.tsx` dengan dropzone MP4, seleksi preset bitrate, checkbox hak cipta, indikator upload/antrean/ekstraksi, penanganan error, serta mendaftarkan alat ke-27 di `App.tsx` dengan guard login wajib.
- **Requirement terkait:** `BUS-028`, `FR-060`, `NFR-UX-005`, `NFR-ACC-005`
- **Dependency:** `MP3-02`
- **File/komponen terdampak:** `frontend/src/services/videoCompression.ts`, `frontend/src/components/video-tools/Mp4ToMp3Modal.tsx`, `frontend/src/App.tsx`, component tests
- **Acceptance criteria:**
  - [x] Pengguna anonim yang mengklik kartu `MP4 ke MP3` di `#/tools` dialihkan ke `#/login` (`requiresAuth: true`).
  - [x] Modal menyediakan dropzone khusus file `.mp4` (≤ 250 MB), pilihan preset bitrate (128k, 192k default, 320k), dan checkbox konfirmasi kepemilikan audio wajib.
  - [x] Progress upload streaming dan status antrean/pemrosesan ditampilkan secara real-time.
  - [x] Pesan error ramah pengguna saat menghadapi berkas tanpa audio (`NO_AUDIO_STREAM`), kuota penuh, atau timeout.
  - [x] Unduhan otomatis/manual berkas `<stem>_audio.mp3` berhasil.

### Task MP3-04 — Audit Aksesibilitas WCAG 2.2 AA, Playwright E2E, Regresi Penuh & Penutupan Fase
- **Tujuan:** Memverifikasi kepatuhan aksesibilitas modal baru, memperbarui Playwright assertion jumlah alat menjadi 27, menjalankan full regression testing, dan menutup fase.
- **Requirement terkait:** `KPI-009`, `NFR-ACC-005`, quality gates
- **Dependency:** `MP3-03`
- **File/komponen terdampak:** `frontend/src/components/__tests__/accessibility.test.tsx`, `frontend/e2e/dashboard.spec.ts`, tracking & dokumentasi
- **Acceptance criteria:**
  - [x] Uji `vitest-axe` menghasilkan 0 violations pada `Mp4ToMp3Modal`.
  - [x] Playwright E2E `dashboard.spec.ts` memverifikasi kartu ke-27 dan `stat-tools-count` = `'27'`.
  - [x] Seluruh suite Pytest, Vitest, Oxlint, Ruff, tsc/vite build, dan `scan_secrets.py` lulus 100%.
  - [x] Dokumentasi fase, state, report, dan task diperbarui sinkron.
  - [x] `RISK-SEC-023` (benchmark staging Ubuntu) tetap dipertahankan sebagai rilis-blocking.

## 10. Risks
- `RISK-SEC-025` (HIGH): Eksploitasi malformed MP4 container pada parser FFmpeg.
- `RISK-SEC-026` (MEDIUM): Pelanggaran hak cipta audio tanpa izin.
- `RISK-SEC-027` (MEDIUM): DoS worker crash pada MP4 tanpa stream audio atau audio abnormal (>2 channel).
- `RISK-SEC-023` (HIGH — Release-blocking): Benchmark staging Ubuntu tetap prasyarat rilis produksi.

## 11. Exit Criteria
- [x] Seluruh task `MP3-00` s/d `MP3-04` selesai dan terverifikasi.
- [x] Tidak ada regresi pada fitur Compress Video (`CR-021`) maupun fitur-fitur sebelumnya.
- [x] Berkas OCR dan file uncommitted tetap utuh (`git status`).

## 12. Phase Definition of Done
- Setiap task diawali dengan persetujuan Gerbang 3.
- Seluruh kode lolos Ruff (0 error), Oxlint (0 error), TypeScript check, unit/integration test, dan secret scan.
- Tracking dokumentasi sinkron setelah setiap task.

## 13. Verification Evidence
- `MP3-00`: Tercatat pada `.agent/REPORT.md` (Ruff `All checks passed!` pada 4 berkas MP3-00; Pytest `7/7` `test_video_compression_db.py` PASS termasuk Alembic 005 upgrade/downgrade; Pytest `2/2` `test_postgres_migration.py` PASS; zero regression pada `27/27` test video suite lainnya; `scripts/scan_secrets.py` 1635 file 0 secrets; berkas uncommitted OCR & CR-020 terjaga utuh).
- `MP3-01`: Tercatat pada `.agent/REPORT.md` (Ruff `All checks passed!` pada 4 berkas MP3-01; Pytest `20/20` `test_video_compressor.py` & `test_video_worker.py` PASS; zero regression pada `21/21` test DB/migration/upload/API video suite; `scripts/scan_secrets.py` 1635 file 0 secrets; berkas uncommitted OCR & CR-020 terjaga utuh).
- `MP3-02`: Tercatat pada `.agent/REPORT.md` (Ruff `All checks passed!` pada `video_compression.py` dan seluruh file test video; Pytest `14/14` `test_video_compression_upload.py` & `test_video_compression_api.py` PASS; Pytest `41/41` seluruh video suite PASS; zero regression pada core auth/audit/disk_guard/security suite; 0 secrets; uncommitted OCR & CR-020 files intact).
- `MP3-03`: Tercatat pada `.agent/REPORT.md` (Oxlint 0 error; Vitest `18/18` `mp4_to_mp3.test.tsx` & `app.integration.test.tsx` PASS; `tsc -b && vite build` PASS (553ms); 0 secrets; uncommitted OCR & CR-020 files intact).
- `MP3-04`: Tercatat pada `.agent/REPORT.md` (Oxlint 0 error; Ruff `All checks passed!`; Pytest `41/41` video tests & `30/30` core tests PASS; Vitest targeted & accessibility `37/37` PASS termasuk `vitest-axe` 0 violations pada `Mp4ToMp3Modal`; Playwright dashboard assertion update ke `'27'`; `tsc -b && vite build` PASS; `scripts/scan_secrets.py` 1637 file 0 secrets; uncommitted OCR & CR-020 files intact).
