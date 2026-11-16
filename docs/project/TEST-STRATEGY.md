# Test Strategy (TEST-STRATEGY.md)

## 1. Pendekatan Berbasis Risiko
Doc-builder berfokus pada keandalan rekonstruksi format dokumen, keakuratan aturan ATS, dan integritas data privasi lokal pengguna. Pengujian dibagi ke dalam piramida uji:

```text
       [  UAT & Usability (10 Penguji)  ]
      [  Cross-browser E2E — NOT IMPLEMENTED (Q-005)  ]
     [  Integration & Corpus Fidelity Test ]
    [   Unit Tests (Vitest & Pytest) — target ≥80%   ]
```

> **Status tooling 2026-10-24:** Playwright, Biome, Bandit, dan Semgrep tidak terpasang/terkonfigurasi di repository. Command di bawah sudah diselaraskan dengan tooling aktual: Oxlint, `tsc` melalui build, Vitest, Pytest, Ruff, dan mypy.

## 2. Tingkatan Pengujian

### 2.1 Unit Testing
- **Frontend (Vitest + React Testing Library):**
  - Validasi schema form Zod (email, telepon, rentang tanggal).
  - State reducer form CV, penambahan/penghapusan section, reorder item.
  - Komponen UI: rendering preview, dialog konfirmasi, undo snackbar.
  - Estimasi pagination A4 dan overlay page-break, termasuk normalisasi template full-bleed.
  - Preflight ekspor: error memblokir, warning membutuhkan acknowledgment, navigasi “Perbaiki”, dan sanitasi nama berkas.
  - Field terstruktur: headline, pencapaian/reorder, deskripsi pendidikan, `sectionOrder`, dan validasi tanggal.
  - Impor selektif `merge`/`replace`, undo snapshot, CV target, pencarian/favorit/rename/duplikasi draft, serta integrasi App/Navbar.
- **Backend (Pytest):**
  - Engine kalkulasi skor ATS deterministik.
  - Keyword extractor & job matcher.
  - Validasi magic bytes dan penolakan file terenkripsi/bermakro.
  - Rendering DOCX untuk headline, pencapaian terstruktur, deskripsi pendidikan, dan urutan bagian.
  - Sanitasi nama berkas ekspor dan ekstraksi headline/lokasi parser impor.
  - Target coverage: Minimal 80% pada core business logic.

### 2.2 Integration Testing & Corpus Fidelity
- **Corpus yang benar-benar dieksekusi (2026-10-21):**
  - `scripts/benchmark_corpus.py` menguji 5 sampel resume ATS (ATS Clean, ATS Modern, ATS Compact) melalui round-trip `Resume Payload -> DOCX Generator -> Resume Parser`.
  - Metrik yang diukur adalah kelengkapan field/teks (nama, email, telepon, ringkasan, pengalaman, pendidikan, keahlian), bukan SSIM/pixel diff.
  - Hasil tercatat: 100% field/teks. Target visual ≥95% belum memiliki metode formal; lihat `Q-001`.
- **Corpus yang direncanakan tetapi belum dieksekusi:**
  - 10 dokumen kantor, 10 CV bervariasi, dan 5 korespondensi resmi untuk verifikasi margin, header/footer, dan tabel.
- **PDF ke DOCX Conversion:**
  - Pengujian rekonstruksi teks dan blok paragraf yang dapat disunting kembali di Microsoft Word / LibreOffice.
- **Subprocess & Cleanup Integration:**
  - Uji pembatalan proses (cancel) dan pembuktian bahwa file temporer terhapus bersih.
  - Uji timeout 5 menit pada proses berbeban ekstrem.

### 2.3 End-to-End (E2E) Testing
- **Status:** **NOT IMPLEMENTED.** Tidak ada `playwright.config.*`, dependency Playwright, atau file E2E di repository. Klaim “4 Browser matrix PASS” pada dokumen lama tidak didukung bukti dan sudah dikoreksi menjadi NOT VERIFIED. Lihat `Q-005`.
- **Tool yang direncanakan:** Playwright.
- **Matriks Browser yang direncanakan:** Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari (WebKit).
- **Skenario Kritis (rencana):**
  1. Pengguna membuka dashboard -> Buat CV dari template -> Isi data -> Live preview -> Download PDF -> Verifikasi konten berkas terunduh.
  2. Pengguna mengimpor CV lama -> Tinjau ekstraksi form -> Ekspor DOCX.
  3. Pengguna mengunggah DOCX untuk dikonversi ke PDF -> Indikator progress berjalan -> Unduh hasil.
  4. Pengguna menyunting CV -> Refresh halaman -> Data pulih dari autosave IndexedDB.

### 2.4 Security Regression Testing
- **Suite aktual:** `backend/tests/test_security.py` memiliki 8 test fungsi per 2026-10-24 (public health, origin rejection, session 401, invalid bootstrap 401, trusted bootstrap, full bootstrap/CSRF flow, PDF mutation CSRF 403, image mutation CSRF 403). Sejak 2026-10-27, `backend/tests/test_audit.py` menambah 10 test untuk permission/retensi/concurrency audit, kegagalan tulis, denial Origin/session/CSRF, request sukses, pengecualian health, dan pemeriksaan kebocoran query/credential.
- **Bukti eksekusi:** hotfix autentikasi 2026-10-21 mencatat 8/8 test keamanan PASS; verifikasi peningkatan CV 2026-10-24 mencatat 126/126 Pytest PASS dan 233/233 Vitest PASS; verifikasi audit 2026-10-27 mencatat 136/136 Pytest PASS (termasuk 10/10 `test_audit.py`) dan Ruff PASS. Laporan `SECURITY-SCAN-REPORT.md` yang mencatat 7/7 adalah snapshot lebih awal dan tidak lagi mencerminkan nama test saat ini.
- **Cakupan yang diuji:** request API tanpa cookie session (401), mutasi tanpa token CSRF (403), origin non-lokal (403), alur bootstrap sesi/CSRF, permission `0600`/`0700`, retensi 7 hari, penulisan paralel, dan kegagalan tulis yang tidak menggagalkan request.
- **Cakupan yang belum otomatis:** zip bomb/decompression bomb, path traversal, dan parser exploit end-to-end; sebagian baru diuji pada level validasi magic bytes.

### 2.5 User Acceptance Testing (UAT)
- Dilakukan oleh 10 responden uji dengan latar belakang pencari kerja dan tim HR.
- Meliputi pengujian alur kerja penuh dari pembuatan hingga ekspor dan penilaian kegunaan (usability).

### 2.6 ML Inference & Resource Benchmark (U2NetP CPU-Only)
- **Host Benchmark:** Lingkungan VPS aktual (Ubuntu 24.04 x86_64, 1 vCPU, 2.2 GiB RAM, 4.0 GiB Swap).
- **Target Pengujian:**
  1. *Latensi Pemrosesan:* Pengukuran durasi segmentasi latar belakang pada gambar pasfoto resolusi standar (800x800, 1200x1200, 1920x1080) dengan target ≤ 15 detik (hard timeout 30 detik).
  2. *Konsumsi Memori & Peak RSS:* Memastikan memori puncak proses inferensi tidak melebihi 400 MB dan RAM segera dibebaskan pasca subprocess dihentikan.
  3. *Uji Antrean & Concurrency:* Pengujian pengiriman 4 request simultan; memastikan request 1 dieksekusi, request 2 & 3 masuk antrean, dan request 4 ditolak seketika dengan status HTTP 429/503 + header `Retry-After: 30`.
  4. *Fidelitas Visual:* Verifikasi keluaran PNG RGBA transparan dengan alpha channel bersih dan metadata EXIF dibuang.

### 2.7 Multi-User Authentication & Authorization Testing
- **Otentikasi Akun (Pytest):**
  - Alur registrasi email/password: verifikasi email token hash, penolakan password lemah, hashing Argon2id.
  - Alur Google OAuth: verifikasi penukaran code, validasi token Google, pembuatan akun baru.
  - **Account Linking Guard Test:** Pengujian skenario penyerangan account takeover — memastikan registrasi Google OAuth dengan email yang sudah terdaftar via password TIDAK melakukan auto-merge; linking hanya berhasil jika dipicu dari akun terotentikasi.
  - Proteksi Brute-force: Rate limiting login (5 percobaan gagal memicu backoff/lockout sementara).
  - Alur Reset Password: Token single-use, expiry 15 menit, penolakan token lama atau yang sudah dipakai.
- **Otorisasi & Tenant Isolation (IDOR/BOLA):**
  - Verifikasi bahwa User A tidak dapat membaca (`GET /api/user/cv/:id`), menyunting (`PUT /api/user/cv/:id`), atau menghapus (`DELETE /api/user/cv/:id`) CV milik User B (harus mengembalikan HTTP 404/403).

### 2.8 Kuota, Retensi, & Backup Disaster Recovery Testing
- **Penegakan Kuota CV:**
  - Pembuatan CV ke-6 ditolak (batas 5 CV per akun).
  - Berkas upload melebihi 10 MB ditolak; total akun > 50 MB ditolak.
  - Ambang disk 80% menolak simpan dokumen baru (fail-closed).
- **Retensi Dokumen 90 Hari:**
  - Pengujian background sweeper: draf dengan `expires_at < NOW()` dihapus fisik dari disk dan database.
  - Verifikasi bahwa aksi membaca atau mengunduh TIDAK memperbarui `updated_at`.
- **Pembersihan Berkas Tamu Anonim:**
  - File temporer konversi/remove-background berumur > 1 jam dihapus otomatis oleh sweeper.
- **Uji Cadangan Terenkripsi Cloudflare R2:**
  - Snapshot database diekspor, dikompresi, dan dienkripsi AES-256-GCM.
  - Pengujian dekripsi di mesin independen untuk membuktikan integritas pemulihan (disaster recovery rehearsal).
  - Verifikasi lifecycle deletion rule pada bucket R2 (7 hari).

### 2.9 Edge URL Shortener Testing (Cloudflare Workers + D1)
- **Redirection & Status Code (Vitest / Miniflare):**
  - Slug aktif mengembalikan HTTP 302 Found ke destination URL.
  - Slug tidak terdaftar mengembalikan HTTP 404 Not Found.
  - Slug yang telah dicabut (`revoked`) mengembalikan HTTP 410 Gone.
  - Verifikasi larangan daur ulang slug (slug reuse ditolak).
- **Anti-SSRF Test Matrix:**
  - Penolakan destination dengan skema `http://`, `ftp://`, `file://`.
  - Penolakan destination dengan kredensial (`https://user:pass@example.com`).
  - Penolakan destination ke IP private RFC 1918 (`10.x`, `172.16.x`, `192.168.x`).
  - Penolakan destination ke loopback (`127.0.0.1`, `::1`) dan link-local/cloud metadata (`169.254.169.254`).
- **Autentikasi HMAC Admin:**
  - Request pembuatan link tanpa HMAC signature ditolak (HTTP 401).
  - Request dengan timestamp kedaluwarsa (> 5 menit) atau nonce duplikat ditolak (HTTP 403).
- **Agregat Analitik:**
  - Verifikasi `click_count` bertambah dan `last_accessed_at` diperbarui tanpa menyimpan alamat IP atau fingerprint pengunjung.

### 2.7 Matriks Pengujian Unggah Rak Berkas (10 Kelompok Pengujian)
1. **Format Didukung (Happy Path):**
   - PDF standar, DOCX standar, PPT/PPTX standar, XLS/XLSX standar, JPG/JPEG statis, PNG statis, WebP statis, Markdown UTF-8.
   - Hasil: Lolos seluruh inspeksi, dienkripsi AES-256-GCM envelope 49B, disimpan ke R2, status `AVAILABLE`.
2. **Format Dilarang:**
   - Arsip (ZIP, RAR, 7Z, TAR, GZ), SVG, executable (.exe, .elf, .sh, .bat), audio/video (MP3, MP4, WAV).
   - Hasil: Ditolak seketika (HTTP 400 Bad Request) dengan pesan kesalahan spesifik.
3. **Bom Dekompresi / Arsip / XML:**
   - XML bomb (billion laughs, quadratic entity expansion), image decompression bomb (resolusi gigapixel palsu), file kompresi biner tak wajar.
   - Hasil: Tertahan batas memori `RLIMIT_AS=512 MiB` di bubblewrap dan `defusedxml`; proses dihentikan aman tanpa membuat host OOM.
4. **Makro, Script, & Komponen Aktif:**
   - Dokumen Office bermakro VBA (DOCM, XLSM, PPTM atau DOCX bertrik OLE), PDF ber-JavaScript, form OLE/ActiveX, launch actions, external references URI.
   - Hasil: Terdeteksi via `vtx-oletools` dan PyMuPDF; ditolak dengan status rejected dan alasan konten aktif dilarang.
5. **Berkas Terenkripsi / Password Protected:**
   - Dokumen PDF atau Office yang diproteksi password sehingga isinya tidak dapat diinspeksi.
   - Hasil: Terdeteksi via `msoffcrypto-tool` dan PyMuPDF metadata; ditolak HTTP 400.
6. **Berkas Rusak / Malformed / Polyglot:**
   - File dengan extension palsu (misal berkas EXE/ELF dinamai `.pdf`), header terpotong, atau struktur biner ganda (polyglot PDF-ZIP).
   - Hasil: Validasi magic bytes multi-offset dan parser mendalam menolak berkas (HTTP 400).
7. **Gambar Statis dengan Metadata EXIF/GPS:**
   - Foto kamera asli yang memuat koordinat GPS, informasi perangkat, dan waktu pengambilan.
   - Hasil: Jika checkbox konfirmasi persetujuan UI dicentang (`RISK-SEC-014`), byte asli dipertahankan utuh tanpa re-encoding. Gambar animasi (GIF/WebP animasi) ditolak.
8. **Malware / EICAR Test File:**
   - File uji standar EICAR test string.
   - Hasil: Daemon ClamAV Unix socket mengembalikan status `FOUND`; file mentah di folder karantina segera dihapus permanen; database mencatat status gagal.
9. **Batas Ukuran & Quota Limit:**
   - File berukuran > 25.000.000 byte; upload saat kuota 5 slot akun penuh; upload saat kapasitas global rak penuh (7 GB).
   - Hasil: Ditolak sebelum/saat streaming dengan kode HTTP 413 Payload Too Large atau HTTP 400 Quota Exceeded.
10. **Konkurensi & Rate Limiting:**
    - Upaya 2 upload simultan dari akun yang sama (hanya 1 in-flight diizinkan).
    - Upaya >10 upload sukses dalam 1 rolling hour (HTTP 429).
    - Upaya >30 download dalam 1 rolling hour (HTTP 429).
    - Upaya >1 download aktif per akun atau >2 lease download global (HTTP 429 / 503).
    - Hasil: Penegakan atomik di PostgreSQL menghentikan aksi berlebih secara akurat.

### 2.8 Matriks Pengujian Compress Video (`CR-021` — `VC-01` s/d `VC-06`)
1. **Streaming Upload & Batas Workspace:**
   - Unggahan stream `application/octet-stream` + `X-Video-Metadata` base64url (MP4/MOV/WebM) tanpa memanggil `request.body()`.
   - Ukuran `250.000.000` byte lulus; `250.000.001` byte ditolak HTTP 413 dan file parsial segera dihapus.
   - Berkas kosong (0 B) ditolak HTTP 400; total workspace video global melampaui `1.25 GiB` ditolak fail-closed (HTTP 503/507).
2. **ClamAV Pre-Probe Fail-Closed & Streaming `INSTREAM`:**
   - `ClamAVScanner.scan_file()` mengirim chunk 64 KiB ke Unix socket tanpa memuat penuh file ke RAM (`f.read()`).
   - Berkas EICAR ditolak sebelum `ffprobe` pernah dipanggil; daemon mati atau signature > 24 jam gagal tertutup.
3. **Validasi `ffprobe`, Preset Kualitas, & Aturan Output:**
   - Penolakan format di luar MP4/MOV/WebM, durasi > 600 detik, resolusi > 4K (landscape `3840x2160` / portrait `2160x3840`), dan frame rate > 60 FPS.
   - Verifikasi 3 preset single-pass (`light` CRF 23/128k, `balanced` CRF 28/96k, `maximum` CRF 32/64k), tanpa upscale pada input ≤ 1080p atau ≤ 30 FPS, dukungan video tanpa track audio, dan penghapusan metadata/chapter (`-map_metadata -1 -map_chapters -1`).
   - Simulasi `output_size_bytes >= input_size_bytes` memastikan output dihapus segera dan status gagal `OUTPUT_NOT_SMALLER`.
4. **Sandbox `bubblewrap`, Process-Group Kill, & Pembersihan:**
   - Verifikasi argumen `bubblewrap --unshare-net --die-with-parent` di Linux, hard timeout 45 menit (`2700s`), cancel job `queued`/`running`, cleanup file input segera setelah proses, serta startup recovery & sweeper TTL 15 menit.
5. **Koordinasi Antrean PostgreSQL & Rate Limit:**
   - Uji `pg_advisory_xact_lock`, partial unique index (1 job aktif/akun, 1 global `running`), `SELECT ... FOR UPDATE SKIP LOCKED`, kapasitas antrean global `1 running + 2 waiting` (ke-4 ditolak 429/503 + `Retry-After`), serta batas rolling 60 menit `3 job/jam` per akun dan per IP.
6. **Otorisasi, Anti-BOLA, & Single-Use Download:**
   - Penolakan `401`/`403` untuk akses anonim, Origin tidak diizinkan, CSRF hilang, dan email unverified di produksi; akses lintas akun mengembalikan `404`.
   - Unduhan pertama mengembalikan berkas `<nama>_compressed.mp4` (`200`), transisi atomik `succeeded -> claimed` menghapus berkas setelah stream selesai, dan unduhan ulang ditolak (`409`/`410`).
7. **Telemetry `/api/health` & Deployment Config:**
   - `/api/health` menampilkan status ketersediaan `ffmpeg`/`ffprobe` (`apt`) dan kesegaran heartbeat worker tanpa membocorkan path internal host.
   - Validasi statis `deploy/Caddyfile.example` (global 35 MB utuh + override matcher `POST /api/video-compressions`) dan unit `deploy/satukit-video-worker.service`.
8. **Frontend UI, Login Guard, Aksesibilitas WCAG 2.2 AA, & E2E:**
   - `CompressVideoModal.tsx` (`vitest` progress stream, polling status, cancel, pesan `OUTPUT_NOT_SMALLER`), guard `#/tools` menuju `#/login` untuk pengguna anonim (`app.integration.test.tsx`), `0` pelanggaran `vitest-axe` (`accessibility.test.tsx`), dan Playwright E2E `stat-tools-count` = `'26'`.

### 2.9 Matriks Pengujian MP4 ke MP3 (`CR-022` — `MP3-00` s/d `MP3-04`)
1. **Model & Skema Antrean Bersama (`MP3-00`):**
   - Migrasi Alembic `005_mp4_to_mp3.py` menambah kolom `job_type` (`compress` vs `extract_audio`) dan memperluas check constraint preset (`light`, `balanced`, `maximum`, `128k`, `192k`, `320k`).
   - Repository `VideoCompressionRepository` mendukung pembuatan dan klaim job bertipe `extract_audio`.
   - Shared limits teruji: job video compression dan extract audio berbagi slot konkurensi (1 aktif per user, 1 global running).
2. **Audio Probing & Validasi Stream (`MP3-01`):**
   - Penolakan format selain `.mp4` (MOV dan WebM ditolak untuk tool MP4 ke MP3).
   - Penolakan berkas video tanpa stream audio sama sekali dengan kode error `NO_AUDIO_STREAM` sebelum masuk ke encoding.
   - Deteksi stream default: jika terdapat beberapa stream audio, otomatis memilih stream dengan flag `default` (fallback ke stream audio pertama `0:a:0`).
   - Deteksi channel: jika channel audio > 2 (misal surround 5.1), dipaksa downmix stereo `-ac 2`.
3. **Eksekusi Encoding MP3 & Worker Pipeline (`MP3-01` / `MP3-02`):**
   - Pemanggilan FFmpeg dengan `libmp3lame`, preset bitrate CBR yang sesuai (`128k`, `192k`, `320k`), `-vn`, `-map_metadata -1 -map_chapters -1`.
   - Output filename `<stem>_audio.mp3`.
   - Pembersihan berkas input segera setelah ekstraksi berhasil atau gagal.
   - Hard timeout 10 menit (600s) untuk ekstraksi audio.
4. **Endpoint API & Single-Use Download (`MP3-02`):**
   - `POST /api/video-compressions` dengan header `X-Video-Metadata` berisi `job_type="extract_audio"` dan preset MP3.
   - Status polling `/api/video-compressions/{job_id}` mengembalikan detail progres dan output filename MP3.
   - Unduhan `/api/video-compressions/{job_id}/download` menyajikan file MP3 dengan Content-Type `audio/mpeg`, Content-Disposition `<stem>_audio.mp3`.
   - Single-use claim: setelah unduh, status berubah ke `claimed` dan file dihapus dari disk.
   - Audit trail non-PII dicatat (`mp4_to_mp3_requested`, `mp4_to_mp3_downloaded`).
5. **Frontend UI Modal, Checkbox Hak Cipta, & WCAG 2.2 AA (`MP3-03` / `MP3-04`):**
   - `Mp4ToMp3Modal.tsx` dengan dropzone MP4-only, pilihan preset bitrate (128k, 192k default, 320k), checkbox konfirmasi hak kepemilikan audio wajib.
   - Indikator progres upload dan processing (antrean/konversi).
   - Penanganan error responsif (`NO_AUDIO_STREAM`, timeout, kuota penuh).
   - Tool card #27 di direktori `#/tools` dengan guard login wajib (`requiresAuth: true`).
   - Uji aksesibilitas `vitest-axe` 0 pelanggaran dan Playwright E2E verifikasi `stat-tools-count` = `'27'`.

### 2.10 Matriks Pengujian Video ke Teks (`CR-023` — `VTT-00` s/d `VTT-05`)
1. **Model & Skema Antrean Bersama (`VTT-01`):**
   - Migrasi Alembic `006_video_to_text.py` memperluas kolom `job_type` (`compress`, `extract_audio`, `transcribe`) dan check constraint preset (`light`, `balanced`, `maximum`, `128k`, `192k`, `320k`, `auto`, `id`, `en`).
   - Repository `VideoCompressionRepository` mendukung pembuatan dan klaim job bertipe `transcribe`.
   - Shared limits teruji: job kompresi video, ekstraksi audio, dan transkripsi berbagi slot konkurensi (1 aktif per user, 1 global running).
2. **Audio Extraction, Probing, & VAD Filtering (`VTT-02`):**
   - Penolakan format selain `.mp4` (ekstensi non-MP4 ditolak HTTP 422).
   - Penolakan berkas video tanpa stream audio dengan kode error `NO_AUDIO_STREAM` sebelum masuk antrean model.
   - Ekstraksi audio perantara via FFmpeg ke format PCM WAV 16kHz mono 16-bit (`-ar 16000 -ac 1 -c:a pcm_s16le`).
   - VAD (Voice Activity Detection) fail-closed: audio tanpa ucapan yang dapat dikenali ditolak dengan `NO_SPEECH`.
3. **Eksekusi Transkripsi, Dokumen Generator, & ZIP Packager (`VTT-02`):**
   - Integrasi service transkripsi offline CPU-only (kuantisasi int8) dengan opsi bahasa `auto`, `id`, dan `en`.
   - Generator teks `.txt` bertimestamp segmen `[HH:MM:SS - HH:MM:SS]`.
   - Generator subtitel `.srt` standar SubRip `HH:MM:SS,mmm --> HH:MM:SS,mmm`.
   - Generator dokumen Microsoft Word `.docx` (via `python-docx`) dengan struktur tabel rapi dan disclaimer verifikasi manusia.
   - Pengemas ZIP: membuat `<stem>_transcript.zip` yang memuat tepat ketiga berkas tersebut, integritas arsip tervalidasi, tanpa symlink atau path traversal.
   - Pembersihan berkas audio perantara `.wav` seketika setelah inferensi selesai.
4. **Endpoint API, Ephemeral Preview, & Single-Use Download (`VTT-03`):**
   - `POST /api/video-compressions` dengan header `X-Video-Metadata` berisi `job_type="transcribe"`, `preset="auto"|"id"|"en"`, dan `owner_confirmed=true`.
   - Status polling `/api/video-compressions/{job_id}` mengembalikan pratinjau baca-saja `transcript_preview` saat job berstatus `succeeded`.
   - Unduhan `/api/video-compressions/{job_id}/download` menyajikan paket ZIP dengan Content-Type `application/zip`, Content-Disposition `<stem>_transcript.zip`.
   - Single-use claim: setelah unduh, status berubah ke `claimed` dan direktori workspace (termasuk ZIP dan `preview.json`) langsung dihapus. Replay download menghasilkan HTTP 410.
   - Redaksi audit trail non-PII (`action="video_to_text_requested"`, `action="video_to_text_downloaded"`).
5. **Frontend UI Modal, Pratinjau Read-Only, & WCAG 2.2 AA (`VTT-04` / `VTT-05`):**
   - `VideoToTextModal.tsx` dengan dropzone MP4, selektor bahasa (`auto` default, `id`, `en`), checkbox ganda konfirmasi kepemilikan dan izin suara.
   - Tampilan progres bertahap (`uploading` -> `queued` -> `scanning` -> `probing` -> `extracting_audio` -> `transcribing` -> `packaging`).
   - Komponen pratinjau baca-saja semantik (daftar segmen berwaktu) yang mudah ditinjau sebelum/setelah unduh.
   - Tool card #28 di direktori `#/tools` dengan guard login wajib (`requiresAuth: true`).
   - Uji aksesibilitas `vitest-axe` 0 pelanggaran dan Playwright E2E verifikasi `stat-tools-count` = `'28'`.

## 3. Automation & Quality Commands

Command di bawah adalah tooling yang benar-benar tersedia di repository per 2026-11-11. Contoh path backend menggunakan Linux/macOS; di Windows gunakan `backend\.venv\Scripts\python.exe` dan `backend\.venv\Scripts\pytest.exe`.

| Area | Command | Status |
|---|---|---|
| Frontend install | `npm --prefix frontend install` | Tersedia |
| Frontend lint | `npm --prefix frontend run lint` | Tersedia (Oxlint) |
| Frontend typecheck | `cd frontend && npx tsc -b` | Tersedia |
| Frontend test | `npm --prefix frontend test` | Tersedia (Vitest) |
| Frontend build | `npm --prefix frontend run build` | Tersedia (`tsc -b && vite build`) |
| Frontend E2E | `npx playwright test` | Tersedia (5/5 suites PASS) |
| Backend install | `backend/.venv/bin/python -m pip install -e "./backend[dev]"` | Tersedia |
| Backend lint/SAST | `backend/.venv/bin/ruff check backend/app backend/tests` | Tersedia |
| Backend typecheck | `backend/.venv/bin/mypy backend/app` | Tersedia |
| Backend test | `backend/.venv/bin/pytest backend/tests` | Tersedia |
| Backend coverage | `backend/.venv/bin/pytest backend/tests --cov=backend/app --cov-report=term-missing` | Tersedia; belum ada bukti coverage terbaru |
| Secret scan | `backend/.venv/bin/python scripts/scan_secrets.py` | Tersedia |
| SCA frontend | `npm --prefix frontend audit` | Tersedia |
| SCA backend | `pip-audit` | Tersedia hanya di environment eksternal; bukan dependency `.venv` |
| DAST/API test | — | Belum ada tool khusus; negative API test dijalankan via Pytest |
| Subprocess & LibreOffice Unit Test (`OFF-01`) | `backend/.venv/Scripts/python -m pytest backend/tests/test_sandbox.py backend/tests/test_libreoffice.py -v` | Tersedia & LULUS (`14/14` unit test baru; `34/34` gabungan converter; `375/375` full suite) |
| Beta Coming Soon Gate Test (`BETA-01`) | `backend/.venv/Scripts/python -m pytest backend/tests/test_beta_feature_gates.py -v` | Tersedia & LULUS (`16/16` test gate `503 FEATURE_COMING_SOON` + `84/84` gabungan legacy suites) |

**Catatan:** Biome, Bandit, Semgrep, `uv sync`, dan `npm run typecheck` tidak tersedia sebagai konfigurasi proyek saat ini. Jangan menyalin command lama dari dokumen historis tanpa memeriksa manifest.
