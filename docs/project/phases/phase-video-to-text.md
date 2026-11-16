# Phase Video to Text (`CR-023`) — Fitur Transkripsi Video ke Teks Asinkron

## 1. Metadata
- **Fase:** `phase-video-to-text`
- **Change Request:** `CR-023`
- **Status:** In Progress (`VTT-00` selesai dan terverifikasi)
- **Owner:** User (Product, Security & Data Owner)
- **Tanggal Mulai:** 2026-11-13
- **Target VPS:** Ubuntu 24.04 x86_64, 1 vCPU, 2.2 GiB RAM, 4.0 GiB Swap

## 2. Goal & Capability
Menambahkan alat ke-28 pada direktori `#/tools` Satukit (**Video ke Teks**) agar pengguna terautentikasi dapat mentranskripsikan rekaman video lokal MP4 tunggal (≤ 250 MB, durasi ≤ 600 detik) menjadi teks dan subtitel bertimestamp (Bahasa Indonesia dan/atau Inggris) secara privat di VPS lokal menggunakan model AI CPU-only kuantisasi `int8` (`faster-whisper`), menyediakan pratinjau baca-saja penuh di antarmuka web, serta menghasilkan paket unduhan arsip ZIP yang memuat 3 berkas inti (`<stem>_transcript.txt`, `<stem>_transcript.srt`, `<stem>_transcript.docx`) sekali unduh dengan retensi 15 menit, memanfaatkan kembali antrean PostgreSQL, daemon worker `satukit-video-worker`, dan endpoint upload streaming dari `CR-021` secara aman dan efisien pada VPS 1 vCPU / 2.2 GiB RAM.

## 3. Requirement Terkait
- **Business:** `BUS-029`, `BRULE-018`, `KPI-010`, `RISK-BUS-007`
- **Product:** `FR-061`, `NFR-PERF-010`, `NFR-REL-011`, `NFR-SEC-017`, `NFR-PRIV-003`, `NFR-UX-006`, `NFR-ACC-006`
- **Security:** `THR-046` s/d `THR-048`, `CTRL-046` s/d `CTRL-048`, `RISK-SEC-028` s/d `RISK-SEC-030`
- **Decisions & Questions:** `DEC-028`, `Q-007` (benchmark staging Ubuntu tetap release-blocking untuk rilis produksi)

## 4. Scope
- Migrasi skema database PostgreSQL `006_video_to_text.py`: memperluas check constraint `job_type` (`compress`, `extract_audio`, `transcribe`) dan check constraint `preset` (`light`, `balanced`, `maximum`, `128k`, `192k`, `320k`, `auto`, `id`, `en`).
- Ekstensi `VideoCompressionRepository` untuk mendukung pembuatan, antrean, dan klaim job `transcribe`.
- Ekstraksi audio sementara via FFmpeg: format PCM WAV 16kHz mono 16-bit (`-ar 16000 -ac 1 -c:a pcm_s16le`).
- Pipeline transkripsi offline: engine `faster-whisper` (CTranslate2 int8), segmentasi kalimat bertimestamp, pemilihan bahasa (`auto`, `id`, `en`), penolakan fail-closed video tanpa audio (`NO_AUDIO_STREAM`), penolakan fail-closed audio tanpa ucapan terdeteksi (`NO_SPEECH`).
- Dokumen generator multi-format:
  - `<stem>_transcript.txt`: teks bertimestamp per segmen `[HH:MM:SS - HH:MM:SS]`.
  - `<stem>_transcript.srt`: subtitel SubRip standar `HH:MM:SS,mmm --> HH:MM:SS,mmm`.
  - `<stem>_transcript.docx`: dokumen Microsoft Word rapi memuat judul, bahasa, durasi, tabel segmen, dan disclaimer pemeriksaan manusia via pustaka `python-docx`.
- Ephemeral preview: berkas `preview.json` disimpan di workspace direktori job, disajikan via `GET /api/video-compressions/{job_id}` saat `status='succeeded'`, dan musnah saat diklaim/kedaluwarsa.
- Pengemasan ZIP: mengemas ketiga berkas dokumen ke dalam `<stem>_transcript.zip` (Python `zipfile`), validasi integritas arsip, dan pembersihan berkas perantara.
- Adaptasi endpoint `POST /api/video-compressions` (header metadata `job_type: "transcribe"`, preset bahasa `auto`/`id`/`en`, checkbox konfirmasi kepemilikan dan izin rekaman suara), unduhan sekali pakai `application/zip`, dan audit log non-PII.
- Frontend modal `VideoToTextModal.tsx`, integrasi kartu ke-28 di `App.tsx` dengan guard login wajib (`requiresAuth: true`), aksesibilitas WCAG 2.2 AA (`vitest-axe` 0 violations), dan pembaruan Playwright E2E assertion `stat-tools-count` `'28'`.

## 5. Out of Scope
- Speaker diarization (pemisahan pembicara) pada MVP.
- Transkripsi kata-per-kata (word-level timestamps).
- Editor interaktif langsung di peramban.
- Terjemahan bahasa atau ringkasan otomatis dokumen via LLM eksternal.
- Transkripsi dari URL video eksternal (YouTube, TikTok, dll) atau input batch.
- Format video selain MP4 (MOV, WebM, MKV, AVI).
- Penggunaan API transkripsi pihak ketiga (Cloudflare, OpenAI, Deepgram).

## 6. Dependencies
- Fitur Compress Video (`CR-021`) dan MP4 ke MP3 (`CR-022`) telah selesai dan terverifikasi.
- Daemon `satukit-video-worker` dan konfigurasi reverse proxy Caddy (`POST /api/video-compressions` max_size 260MB) telah tersedia.
- Binari `ffmpeg` dan `ffprobe`.
- Pustaka Python `python-docx` (sudah terpasang di environment backend).
- Pustaka transkripsi CPU lokal `faster-whisper` (CTranslate2 int8).

## 7. References
- `docs/project/BRD.md`: `BUS-029`, `BRULE-018`, `KPI-010`, `RISK-BUS-007`
- `docs/project/PRD.md`: `FR-061`, `NFR-PERF-010`, `NFR-REL-011`, `NFR-SEC-017`, `NFR-PRIV-003`, `NFR-UX-006`, `NFR-ACC-006`
- `docs/project/ARCHITECTURE.md`: §9.4 Arsitektur Ekstensi Video ke Teks
- `docs/project/SECURITY.md`: `THR-046`–`THR-048`, `CTRL-046`–`CTRL-048`, `RISK-SEC-028`–`RISK-SEC-030`
- `docs/project/TEST-STRATEGY.md`: §2.10 Matriks Pengujian Video ke Teks
- `.agent/DECISIONS.md`: `DEC-028`

## 8. Entry Criteria
- [x] PRD `FR-061` disetujui di Gerbang 1B.
- [x] Seluruh dokumen teknis arsitektur, keamanan, strategi pengujian, dan rencana implementasi tersinkronisasi.
- [x] Gerbang 2 / Security Planning Gate disetujui oleh user pada 2026-11-13.

## 9. Tasks

### Task VTT-00 — Tata Kelola, Gerbang 2, & Sinkronisasi Dokumen Perancangan
- **Tujuan:** Menyinkronkan seluruh dokumen perancangan, arsitektur, keamanan, strategi pengujian, traceability, implementasi, dan tracking fase untuk fitur Video ke Teks (`CR-023`, `FR-061`).
- **Requirement terkait:** `CR-023`, `BUS-029`, `BRULE-018`, `KPI-010`, `FR-061`, `NFR-PERF-010`, `NFR-REL-011`, `NFR-SEC-017`, `NFR-PRIV-003`, `NFR-UX-006`, `NFR-ACC-006`, `THR-046` s/d `THR-048`, `RISK-SEC-028` s/d `RISK-SEC-030`
- **Dependency:** Gerbang 1B PRD approval
- **File/komponen terdampak:** `docs/project/*`, `.agent/*`
- **Acceptance criteria:**
  - [x] Seluruh dokumen perancangan (`BRD.md`, `PRD.md`, `ARCHITECTURE.md`, `SECURITY.md`, `TEST-STRATEGY.md`, `TRACEABILITY.md`, `IMPLEMENTATION-PLAN.md`, `phase-video-to-text.md`) terbarui sinkron.
  - [x] Gerbang 2 disetujui secara eksplisit oleh User (Owner).
  - [x] Tracking `.agent/CHANGE-REQUESTS.md`, `.agent/DECISIONS.md`, `.agent/PROJECT-STATE.md`, dan `.agent/TASKS.md` terbarui.
  - [x] Pemindaian rahasia `scan_secrets.py` lulus 0 temuan dan berkas uncommitted OCR terjaga utuh.

### Task VTT-01 — Migrasi Skema Database & Adaptasi Model/Repository Queue
- **Tujuan:** Memperluas check constraint `job_type` (`transcribe`) dan check constraint `preset` (`auto`, `id`, `en`) pada tabel `video_compression_jobs` via Alembic migration `006_video_to_text.py`, serta mengadaptasi model dan repository antrean.
- **Requirement terkait:** `BUS-029`, `FR-061`, `NFR-REL-011`
- **Dependency:** `VTT-00`
- **File/komponen terdampak:** `backend/alembic/versions/006_video_to_text.py`, `backend/app/db/models.py`, `backend/app/db/repositories/video_compression_repository.py`, test suite database
- **Acceptance criteria:**
  - [x] Migrasi `006_video_to_text.py` memperluas check constraint `chk_video_jobs_job_type` untuk mendukung `('compress', 'extract_audio', 'transcribe')` dan `chk_video_jobs_preset` untuk mendukung `('light', 'balanced', 'maximum', '128k', '192k', '320k', 'auto', 'id', 'en')`.
  - [x] Model `VideoCompressionJob` dan repository `reserve_upload_job` mendukung `job_type='transcribe'` dan preset bahasa baru.
  - [x] Constraint konkurensi (1 aktif per user, 1 global running) tetap berlaku bersama untuk seluruh tipe job.
  - [x] Test Alembic downgrade/upgrade dan test repository database lulus 100%.

### Task VTT-02 — Pipeline Transkripsi, Dokumen Generator, ZIP Packager, & Integrasi Worker
- **Tujuan:** Mengimplementasikan probing audio, ekstraksi WAV 16kHz mono PCM, integrasi engine transkripsi `faster-whisper` int8, VAD filtering (`NO_SPEECH`), generator dokumen multi-format (`.txt`, `.srt`, `.docx`), pengemas arsip ZIP, dan integrasi worker `satukit-video-worker`.
- **Requirement terkait:** `BUS-029`, `FR-061`, `NFR-PERF-010`, `NFR-REL-011`, `NFR-SEC-017`, `NFR-PRIV-003`, `THR-046`, `THR-047`, `THR-048`, `RISK-SEC-028`, `RISK-SEC-030`
- **Dependency:** `VTT-01`
- **File/komponen terdampak:** `backend/app/services/transcription_service.py`, `backend/app/workers/video_worker.py`, unit/integration tests
- **Acceptance criteria:**
  - [x] Probing audio fail-closed menolak video tanpa audio dengan `NO_AUDIO_STREAM`.
  - [x] Ekstraksi audio menghasilkan berkas perantara WAV 16kHz mono 16-bit PCM.
  - [x] Engine transkripsi menghasilkan segmen waktu dan teks dalam Bahasa Indonesia atau Inggris; VAD filtering menolak audio tanpa ucapan dengan `NO_SPEECH`.
  - [x] Generator dokumen menghasilkan berkas `.txt` bertimestamp, `.srt` standar SubRip, dan `.docx` rapi via `python-docx`.
  - [x] Generator paket membuat `<stem>_transcript.zip` yang memuat ketiga berkas tersebut secara atomik dan valid.
  - [x] Berkas perantara `.wav` dan file individual segera dibersihkan dari workspace.
  - [x] Berkas `preview.json` ditulis ke workspace untuk kebutuhan pratinjau API.
  - [x] Unit test backend lulus 100%.

### Task VTT-03 — Endpoint HTTP API, Pratinjau Ephemeral, & Unduhan ZIP Sekali Pakai
- **Tujuan:** Mengadaptasi endpoint HTTP API `POST /api/video-compressions` untuk menerima job transkripsi, validasi ekstensi strictly `.mp4`, checkbox izin rekaman ganda, penanganan polling status dengan injeksi `transcript_preview`, streaming download ZIP sekali pakai (`succeeded -> claimed`), dan audit log non-PII.
- **Requirement terkait:** `BUS-029`, `FR-061`, `NFR-SEC-017`, `NFR-PRIV-003`, `THR-048`, `RISK-SEC-029`
- **Dependency:** `VTT-02`
- **File/komponen terdampak:** `backend/app/api/video_compression.py`, API tests
- **Acceptance criteria:**
  - [ ] `POST /api/video-compressions` menerima `job_type="transcribe"`, preset bahasa (`auto`, `id`, `en`), dan menolak jika `owner_confirmed != True` (HTTP 422).
  - [ ] Penolakan berkas selain `.mp4` dengan HTTP 422.
  - [ ] Endpoint `GET /{job_id}` menyajikan data `transcript_preview` saat job berstatus `succeeded`.
  - [ ] Endpoint `GET /{job_id}/download` menyajikan paket ZIP dengan Content-Type `application/zip` dan Content-Disposition `<stem>_transcript.zip`.
  - [ ] Unduhan bersifat sekali pakai (`succeeded -> claimed`); replay download ditolak HTTP 410; direktori workspace (termasuk ZIP dan `preview.json`) terhapus seketika.
  - [ ] Audit log JSONL non-PII mencatat event transkripsi tanpa merekam nama berkas maupun teks transkrip.
  - [ ] API integration tests lulus 100%.

### Task VTT-04 — Frontend UI Modal, Integrasi Katalog Alat ke-28, & Guard Login
- **Tujuan:** Memperluas service client `videoCompression.ts`, membangun modal interaktif `VideoToTextModal.tsx` dengan dropzone MP4, selektor bahasa, checkbox ganda izin, progres tahapan worker, pratinjau baca-saja, tombol unduh ZIP, serta mendaftarkan kartu alat ke-28 di `App.tsx` dengan guard login wajib.
- **Requirement terkait:** `BUS-029`, `FR-061`, `NFR-UX-006`, `NFR-ACC-006`
- **Dependency:** `VTT-03`
- **File/komponen terdampak:** `frontend/src/services/videoCompression.ts`, `frontend/src/components/video-tools/VideoToTextModal.tsx`, `frontend/src/App.tsx`, frontend tests
- **Acceptance criteria:**
  - [ ] Service client mendukung tipe `TranscriptionLanguagePreset = 'auto' | 'id' | 'en'` dan fungsi upload transkripsi.
  - [ ] Modal `VideoToTextModal.tsx` memiliki antarmuka dropzone MP4-only, selektor bahasa, checkbox kepemilikan dan izin suara, progres antrean/pemrosesan, pratinjau baca-saja penuh, tombol unduh ZIP, dan tombol pembatalan job.
  - [ ] Penanganan error ramah pengguna untuk `NO_AUDIO_STREAM`, `NO_SPEECH`, timeout, dan kuota penuh.
  - [ ] Kartu alat ke-28 (**Video ke Teks**) terdaftar di `App.tsx` pada kategori `convert` dengan guard login wajib (`requiresAuth: true`).
  - [ ] Unit & integration test frontend lulus 100%.

### Task VTT-05 — Audit Aksesibilitas WCAG 2.2 AA, Playwright E2E, Regresi Penuh & Penutupan Fase
- **Tujuan:** Memverifikasi kepatuhan aksesibilitas modal baru, memperbarui Playwright assertion jumlah alat menjadi 28, menjalankan full regression testing, dan menutup fase.
- **Requirement terkait:** `KPI-010`, `NFR-ACC-006`, quality gates
- **Dependency:** `VTT-04`
- **File/komponen terdampak:** `frontend/src/components/__tests__/accessibility.test.tsx`, `frontend/e2e/dashboard.spec.ts`, tracking & dokumentasi
- **Acceptance criteria:**
  - [ ] Uji `vitest-axe` menghasilkan 0 violations pada `VideoToTextModal`.
  - [ ] Playwright E2E `dashboard.spec.ts` memverifikasi kartu ke-28 dan `stat-tools-count` = `'28'`.
  - [ ] Seluruh suite Pytest, Vitest, Oxlint, Ruff, tsc/vite build, dan `scan_secrets.py` lulus 100%.
  - [ ] Dokumentasi fase, state, report, dan task diperbarui sinkron.
  - [ ] `RISK-SEC-023` (benchmark staging Ubuntu) tetap dipertahankan sebagai rilis-blocking.

## 10. Risks
- `RISK-SEC-028` (HIGH): Resource exhaustion (OOM/CPU freeze) pada VPS 1 vCPU / 2.2 GiB RAM oleh model transkripsi.
- `RISK-SEC-029` (MEDIUM): Kebocoran PII percakapan rapat/wawancara melalui logging, residu workspace, atau insecure ZIP.
- `RISK-SEC-030` (MEDIUM): Worker hang pada audio tanpa ucapan atau audio rusak.
- `RISK-SEC-023` (HIGH — Release-blocking): Benchmark staging Ubuntu tetap prasyarat rilis produksi.

## 11. Exit Criteria
- Seluruh task `VTT-00` s/d `VTT-05` selesai dan terverifikasi.
- Tidak ada regresi pada fitur Compress Video (`CR-021`), MP4 ke MP3 (`CR-022`), maupun fitur-fitur sebelumnya.
- Berkas OCR dan file uncommitted tetap utuh (`git status`).

## 12. Phase Definition of Done
- Setiap task diawali dengan persetujuan Gerbang 3.
- Seluruh kode lolos Ruff (0 error), Oxlint (0 error), TypeScript check, unit/integration test, dan secret scan.
- Tracking dokumentasi sinkron setelah setiap task.

## 13. Verification Evidence
- `VTT-00`: Tercatat pada `.agent/REPORT.md` (Sinkronisasi seluruh dokumen perancangan, arsitektur, keamanan, strategi pengujian, traceability, dan tracking fase; scan_secrets 0 temuan; uncommitted OCR & CR-020 files intact).
