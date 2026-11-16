# Phase Video Compression (`CR-021`) — Fitur Compress Video Asinkron

## 1. Metadata
- **Fase:** `phase-video-compression`
- **Change Request:** `CR-021`
- **Status:** Closed (`VC-00` s/d `VC-06` selesai dan terverifikasi)
- **Owner:** User (Product, Security & Data Owner)
- **Tanggal Mulai:** 2026-11-12
- **Target VPS:** Ubuntu 24.04 x86_64, 1 vCPU, 2.2 GiB RAM, 4.0 GiB Swap

## 2. Goal & Capability
Menambahkan alat ke-26 pada direktori `#/tools` Satukit (**Compress Video**) agar pengguna terautentikasi dapat mengecilkan ukuran video lokal (MP4, MOV, WebM) hingga 250 MB / 10 menit / 4K 60 FPS menjadi MP4 H.264 (`yuv420p`) + AAC maksimal 1080p/30 FPS tanpa upscale melalui 3 preset single-pass (`Ringan`, `Seimbang`, `Maksimum`) dengan isolasi proses dan penggunaan RAM/disk yang aman untuk VPS 1 vCPU / 2.2 GiB RAM.

## 3. Requirement Terkait
- **Business:** `BUS-027`, `BRULE-016`, `KPI-008`, `RISK-BUS-05`
- **Product:** `FR-059`, `NFR-PERF-008`, `NFR-REL-010`, `NFR-SEC-016`, `NFR-PRIV-002`, `NFR-UX-004`, `NFR-ACC-004`
- **Security:** `THR-037` s/d `THR-042`, `CTRL-037` s/d `CTRL-042`, `RISK-SEC-021` s/d `RISK-SEC-024`
- **Decisions & Questions:** `DEC-026`, `Q-007`

## 4. Scope
- Upload raw streaming `POST /api/video-compressions` (`application/octet-stream` + `X-Video-Metadata` base64url, chunk 64 KiB, maks `250.000.000` byte, workspace cap `1.25 GiB`).
- Koordinasi antrean PostgreSQL lintas 2 Uvicorn worker (`video_compression_jobs`, Alembic migration `004_video_compression.py`, `pg_advisory_xact_lock`, partial unique index, `SELECT ... FOR UPDATE SKIP LOCKED`, atomic `succeeded -> claimed`).
- Worker systemd terpisah `satukit-video-worker.service` (`python -m app.workers.video_worker`) dengan urutan fail-closed: ClamAV streaming `INSTREAM` 64 KiB -> `ffprobe` -> `ffmpeg` single-pass (`libx264 -preset veryfast -threads 1`) dalam `bubblewrap --unshare-net --die-with-parent` + process-group kill & hard timeout 45 menit (`2700s`).
- Penghapusan output otomatis (`OUTPUT_NOT_SMALLER`) bila ukuran output ≥ input, stripping metadata (`-map_metadata -1 -map_chapters -1`), download sekali pakai TTL 15 menit, pembatalan job, dan telemetry `/api/health` (`ffmpeg`/`ffprobe` + heartbeat worker tanpa path internal).
- Deployment Caddy override matcher khusus route video (global cap 35 MB utuh), `deploy/satukit-video-worker.service`, dan `deploy/VIDEO-COMPRESSION.md`.
- Frontend `videoCompression.ts`, `CompressVideoModal.tsx`, kartu ke-26 di `App.tsx` dengan guard login eksplisit (tidak ikut bypass `category === 'convert'`), aksesibilitas WCAG 2.2 AA, dan Playwright E2E `stat-tools-count` `'26'`.

## 5. Out of Scope
- Input dari URL jarak jauh, two-pass encoding, target ukuran absolut MB, batch multi-video bersamaan.
- Format input/output di luar MP4/MOV/WebM -> MP4 H.264/AAC.
- Penyentuhan 3 berkas OCR uncommitted (`deploy/RUNBOOK.md`, `PdfOcrModal.tsx`, `pdf_ocr.test.tsx`) maupun pekerjaan `CR-020` yang tidak terkait.
- Eksekusi perintah Git mutating tanpa instruksi eksplisit.

## 6. Dependencies
- Phase `phase-watermark-removal` (`RW-06`) & `phase-file-shelf` (`FS-09`) selesai.
- Host produksi/staging Linux Ubuntu memiliki paket `apt` `ffmpeg`, `clamav-daemon`, dan `bubblewrap`.

## 7. References
- `docs/project/BRD.md` (`BUS-027`, `BRULE-016`, `KPI-008`, `RISK-BUS-05`)
- `docs/project/PRD.md` (`FR-059`, `NFR-*-*`)
- `docs/project/ARCHITECTURE.md` (§9)
- `docs/project/SECURITY.md` (§3.4, `RISK-SEC-021` s/d `024`, §14.3)
- `docs/project/TEST-STRATEGY.md` (§2.8)
- `docs/project/TRACEABILITY.md`
- `.agent/DECISIONS.md` (`DEC-026`)
- `.agent/OPEN-QUESTIONS.md` (`Q-007`)

## 8. Entry Criteria
- [x] `VC-00` tata kelola, dokumen arsitektur/keamanan/strategi uji/traceability, dan tracking disinkronkan.
- [x] Persetujuan Gerbang 2 diperoleh dari User (Owner) pada 2026-11-12.
- [ ] Sebelum tiap task kode dimulai, rencana eksekusi kode Gerbang 3 wajib disetujui.

## 9. Rincian Task

### Task VC-00 — Tata Kelola, Dokumen Proyek & Sinkronisasi Fase `CR-021`
- **Tujuan:** Menyelaraskan seluruh dokumen bisnis, produk, arsitektur, keamanan, strategi uji, traceability, dan tracking `.agent/*` untuk `CR-021` sebelum menyentuh kode.
- **Requirement terkait:** `CR-021`, `BUS-027`, `BRULE-016`, `KPI-008`, `FR-059`, `DEC-026`, `THR-037` s/d `042`, `RISK-SEC-021` s/d `024`
- **Dependency:** Persetujuan Gerbang 2 (`CR-021`)
- **File/komponen terdampak:** `docs/project/{BRD,PRD,ARCHITECTURE,SECURITY,TEST-STRATEGY,TRACEABILITY,IMPLEMENTATION-PLAN}.md`, `docs/project/phases/phase-video-compression.md`, `.agent/{CHANGE-REQUESTS,DECISIONS,OPEN-QUESTIONS,TASKS,REPORT,PROJECT-STATE}.md`
- **Acceptance criteria:**
  - [x] Seluruh ID bebas konflik dan terdokumentasi konsisten lintas `BRD`, `PRD`, `ARCHITECTURE`, `SECURITY`, `TEST-STRATEGY`, `TRACEABILITY`, dan `.agent/*`.
  - [x] 3 berkas OCR dan perubahan `CR-020` tetap utuh.
- **Definition of Done:** Seluruh file docs/tracking mutakhir, `git status --short` & `scan_secrets.py` bersih.

### Task VC-01 — Skema PostgreSQL, Repository Antrean, Settings & Streaming Upload
- **Tujuan:** Membangun model `VideoCompressionJob`, migration `004_video_compression.py`, `VideoCompressionRepository`, konfigurasi `Settings`, dan endpoint upload streaming `POST /api/video-compressions`.
- **Requirement terkait:** `FR-059`, `NFR-REL-010`, `NFR-SEC-016`, `THR-037`, `THR-039`, `THR-040`, `RISK-SEC-021`
- **Dependency:** `VC-00`
- **File/komponen terdampak:** `backend/app/db/models.py`, `backend/alembic/versions/004_video_compression.py`, `backend/app/db/repositories/video_compression_repository.py`, `backend/app/core/config.py`, `backend/app/api/video_compression.py`, `backend/app/main.py`, `backend/tests/test_video_compression_db.py`, `backend/tests/test_video_compression_upload.py`
- **Behavior & Security:**
  - Partial unique index kompatibel PostgreSQL & SQLite (`postgresql_where` + `sqlite_where`) untuk `1` job aktif/akun & `1` global `running`; `pg_advisory_xact_lock` khusus dialect PostgreSQL.
  - Streaming `request.stream()` chunk 64 KiB ke `/tmp/satukit_video_jobs/<job_id>/input.bin` (`0700`/`0600`), tolak `> 250_000_000` B (HTTP 413), file 0 B (HTTP 400), cap global `1.25 GiB`, rate limit `3 job/jam` per akun & IP (HTTP 429), antrean global maks `1+2` (HTTP 429/503 + `Retry-After`).
- **Acceptance criteria:**
  - [x] Tidak ada pemanggilan `request.body()` pada route upload video.
  - [x] Migration `004` berantai dari `003_file_shelf`; unit & integration test Pytest + Ruff PASS.

### Task VC-02 — Layanan Kompresor FFmpeg/ClamAV/Bubblewrap & Worker Systemd
- **Tujuan:** Mengupgrade `ClamAVScanner.scan_file()` ke streaming 64 KiB, membangun `video_compressor.py` (probe, encode 3 preset, strip metadata, `OUTPUT_NOT_SMALLER`, bwrap + PGID kill), dan daemon `app.workers.video_worker`.
- **Requirement terkait:** `FR-059`, `NFR-PERF-008`, `NFR-REL-010`, `NFR-SEC-016`, `NFR-PRIV-002`, `THR-037` s/d `041`, `RISK-SEC-021`, `RISK-SEC-022`, `RISK-SEC-024`
- **Dependency:** `VC-01`
- **File/komponen terdampak:** `backend/app/services/file_scanner.py`, `backend/app/services/video_compressor.py`, `backend/app/workers/video_worker.py`, `backend/tests/test_video_compressor.py`, `backend/tests/test_video_worker.py`
- **Behavior & Security:**
  - ClamAV `INSTREAM` chunk 64 KiB fail-closed dijalankan **sebelum** `ffprobe`.
  - Validasi `ffprobe` (MP4/MOV/WebM, `<= 600s`, `<= 3840x2160` / `2160x3840`, `<= 60` FPS), single-pass H.264 `libx264 -preset veryfast -threads 1`, tanpa upscale `<= 1080p` / `<= 30 FPS`, `-map_metadata -1 -map_chapters -1`, hapus output jika `output >= input` (`OUTPUT_NOT_SMALLER`), PGID `SIGTERM`->`SIGKILL`, timeout 45 menit, startup recovery & TTL 15 menit sweeper + heartbeat di `runtime_state`.
- **Acceptance criteria:**
  - [x] Seluruh jalur positif & negatif (mock `ffprobe`/`ffmpeg` + EICAR + simulasi sandbox & process-group kill) teruji dan Ruff clean.

### Task VC-03 — Endpoint Status, Single-Use Download, Cancel & Telemetry `/api/health`
- **Tujuan:** Melengkapi API `GET /api/video-compressions/{job_id}`, `GET /api/video-compressions/{job_id}/download`, `DELETE /api/video-compressions/{job_id}`, audit logging non-PII, serta status `ffmpeg`/`ffprobe` & heartbeat worker pada `/api/health`.
- **Requirement terkait:** `FR-059`, `NFR-REL-010`, `NFR-SEC-016`, `NFR-PRIV-002`, `THR-039` s/d `042`
- **Dependency:** `VC-02`
- **File/komponen terdampak:** `backend/app/db/repositories/video_compression_repository.py`, `backend/app/api/video_compression.py`, `backend/app/api/health.py`, `backend/tests/test_video_compression_api.py`, `backend/tests/test_health.py` (`backend/app/main.py` sudah memuat router & `expose_headers` CORS sejak `VC-01`)
- **Security & Telemetry:**
  - Anti-BOLA (HTTP 404 lintas user), transisi atomik `succeeded -> claimed` saat download (tolak unduhan ke-2), `StreamingResponse` 64 KiB + hapus berkas segera pasca-download/cancel, dan `/api/health` tidak mengekspos path filesystem internal.
- **Acceptance criteria:**
  - [x] Auth 401/403, CSRF, BOLA 404, single-use claim, cancel job aktif, audit log non-PII, dan `/api/health` teruji penuh (`48/48` Pytest & Ruff `0` error).

### Task VC-04 — Artefak Deployment VPS & Reverse Proxy Override
- **Tujuan:** Menyediakan konfigurasi systemd `satukit-video-worker.service`, override batas payload Caddy khusus `POST /api/video-compressions`, dan panduan deployment `deploy/VIDEO-COMPRESSION.md`.
- **Requirement terkait:** `KPI-008`, `NFR-SEC-016`, `THR-042`, `CTRL-042`, `RISK-SEC-023`
- **Dependency:** `VC-03`
- **File/komponen terdampak:** `deploy/satukit-video-worker.service`, `deploy/Caddyfile.example`, `deploy/VIDEO-COMPRESSION.md` (jangan ubah `deploy/RUNBOOK.md`)
- **Acceptance criteria:**
  - [x] Batas global Caddy 35 MB tetap terjaga untuk seluruh rute lain (`@defaultBodyLimit`); matcher `@videoUpload` (`POST /api/video-compressions`) mengizinkan `260MB`; `deploy/RUNBOOK.md` tetap tidak berubah.

### Task VC-05 — Frontend Client Streaming, Modal Compress Video & Guard Login `App.tsx`
- **Tujuan:** Membangun client upload streaming + polling + download + cancel (`videoCompression.ts`), modal `CompressVideoModal.tsx`, dan mendaftarkan kartu alat ke-26 **Compress Video** di `App.tsx` dengan guard login eksplisit.
- **Requirement terkait:** `FR-059`, `NFR-UX-004`, `NFR-ACC-004`, `THR-040`, `RISK-SEC-022`
- **Dependency:** `VC-03`
- **File/komponen terdampak:** `frontend/src/services/videoCompression.ts`, `frontend/src/components/video-tools/CompressVideoModal.tsx`, `frontend/src/App.tsx`, `frontend/src/components/video-tools/__tests__/compress_video.test.tsx`, `frontend/src/__tests__/app.integration.test.tsx`
- **Acceptance criteria:**
  - [x] Pengguna anonim yang mengklik kartu `Compress Video` di `#/tools` dialihkan ke `#/login` (tidak ikut bypass `category === 'convert'`).
  - [x] Modal mendukung 3 preset, validasi ekstensi/250 MB client-side, progres upload, polling status, tombol batal, dan penanganan `OUTPUT_NOT_SMALLER`.

### Task VC-06 — Audit Aksesibilitas WCAG 2.2 AA, Playwright E2E, Regresi Penuh & Penutupan Fase
- **Tujuan:** Memverifikasi aksesibilitas `CompressVideoModal`, memperbarui `dashboard.spec.ts` ke `26` alat, menjalankan regresi penuh backend/frontend/lint/build/secret scan, dan menyinkronkan dokumentasi akhir fase.
- **Requirement terkait:** `CR-021`, `KPI-008`, `NFR-ACC-004`, `THR-037` s/d `042`, `RISK-SEC-021` s/d `024`
- **Dependency:** `VC-04`, `VC-05`
- **File/komponen terdampak:** `frontend/src/components/__tests__/accessibility.test.tsx`, `frontend/e2e/dashboard.spec.ts`, dokumen & tracking akhir fase
- **Acceptance criteria:**
  - [x] `vitest-axe` 0 violations (`8/8` PASS di `accessibility.test.tsx`), Playwright `dashboard.spec.ts` (`26` utilitas) PASS (dengan perbaikan isolasi proxy `/s/` di `vite.config.ts`), seluruh 337 Pytest, 51 Vitest files (404 tests), Oxlint (0 error), `tsc -b && vite build`, Ruff (0 error), `scan_secrets.py` (0 secrets) PASS.
  - [x] Status `RISK-SEC-023` (benchmark Ubuntu staging `Q-007`) dicatat jujur sebagai release-blocking item sebelum rilis produksi.

## 10. Risks
- `RISK-SEC-021` (HIGH): OOM pada upload 250 MB / scan ClamAV.
- `RISK-SEC-022` (HIGH): Eksploit demuxer, BOLA, atau bypass login kategori `convert`.
- `RISK-SEC-023` (HIGH — Release-blocking): Ketiadaan `ffmpeg`/`ffprobe` di Windows dev & perlunya benchmark empiris ClamAV `StreamMaxLength` > 250 MB + FFmpeg di Ubuntu staging (`Q-007`).
- `RISK-SEC-024` (MEDIUM): Akumulasi workspace/zombie process atau metadata bocor.

## 11. Exit Criteria
- [x] Seluruh task `VC-00` s/d `VC-06` selesai dan terverifikasi pada environment dev.
- [x] `git status` membuktikan `deploy/RUNBOOK.md`, `PdfOcrModal.tsx`, dan `pdf_ocr.test.tsx` tetap utuh.
- [x] Catatan release gate secara eksplisit mempertahankan `RISK-SEC-023` (`Q-007`) hingga benchmark Ubuntu staging dieksekusi.

## 12. Phase Definition of Done
- Code plan Gerbang 3 disetujui sebelum setiap task implementasi.
- Seluruh file baru/diubah lolos Ruff (0 error), Oxlint (0 error), TypeScript build, dan `scan_secrets.py` (0 secrets).
- Dokumentasi proyek & `.agent/*` sinkron pasca setiap task.

## 13. Verification Evidence
- `VC-00`: Tercatat pada `.agent/REPORT.md` (sinkronisasi ID bebas konflik, `scan_secrets.py` `1615` file `0` secrets, `git status --short` menjaga 3 berkas OCR & `CR-020` utuh).
- `VC-01`: Tercatat pada `.agent/REPORT.md` (Ruff `0` error pada `8` file VC-01, `18/18` Pytest PASS: `6/6` `test_video_compression_db.py`, `6/6` `test_video_compression_upload.py`, `2/2` `test_postgres_migration.py`, `4/4` `test_postgres_setup.py`, `scan_secrets.py` `1620` file `0` secrets).
- `VC-02`: Tercatat pada `.agent/REPORT.md` (Ruff `0` error pada `5` file VC-02, `33/33` Pytest PASS: `10/10` `test_video_compressor.py`, `5/5` `test_video_worker.py`, `7/7` `test_file_worker.py`, `11/11` `test_file_shelf_comprehensive.py`, `scan_secrets.py` `1624` file `0` secrets).
- `VC-03`: Tercatat pada `.agent/REPORT.md` (Ruff `0` error pada `5` file VC-03, `48/48` Pytest PASS: `6/6` `test_video_compression_api.py`, `2/2` `test_health.py`, `6/6` DB, `6/6` upload, `5/5` worker, `8/8` security, `10/10` audit, `1/1` sqlite, `4/4` prod; `scan_secrets.py` `1625` file `0` secrets).
- `VC-04`: Tercatat pada `.agent/REPORT.md` (`deploy/satukit-video-worker.service`, `deploy/Caddyfile.example` `@videoUpload` 260MB / `@defaultBodyLimit` 35MB, `deploy/VIDEO-COMPRESSION.md`, `scan_secrets.py` `1626` file `0` secrets, `deploy/RUNBOOK.md` utuh).
- `VC-05`: Tercatat pada `.agent/REPORT.md` (`videoCompression.ts`, `CompressVideoModal.tsx`, kartu ke-26 `App.tsx` + `toolRequiresAuth()`, Oxlint `0` error, `21/21` targeted Vitest [`10/10` `compress_video.test.tsx`, `11/11` `app.integration.test.tsx`], `51/51` full Vitest [`403/403`], `tsc -b && vite build` PASS, `scan_secrets.py` `1629` file `0` secrets).
- `VC-06`: Tercatat pada `.agent/REPORT.md` (`accessibility.test.tsx` `8/8` PASS, `dashboard.spec.ts` PASS `26` tools, `vite.config.ts` perbaikan proxy prefix `/s/`, 337 Pytest PASS, 51 Vitest files `404/404` PASS, Oxlint `0` error, `tsc -b && vite build` PASS, `scan_secrets.py` `1631` file `0` secrets, `RISK-SEC-023` / `Q-007` tetap open & release-blocking).
