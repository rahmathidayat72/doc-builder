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

## 3. Automation & Quality Commands

Command di bawah adalah tooling yang benar-benar tersedia di repository per 2026-10-24. Contoh path backend menggunakan Linux/macOS; di Windows gunakan `backend\.venv\Scripts\python.exe` dan `backend\.venv\Scripts\pytest.exe`.

| Area | Command | Status |
|---|---|---|
| Frontend install | `npm --prefix frontend install` | Tersedia |
| Frontend lint | `npm --prefix frontend run lint` | Tersedia (Oxlint) |
| Frontend typecheck | `cd frontend && npx tsc -b` | Tersedia |
| Frontend test | `npm --prefix frontend test` | Tersedia (Vitest) |
| Frontend build | `npm --prefix frontend run build` | Tersedia (`tsc -b && vite build`) |
| Frontend E2E | `npx playwright test` | **TIDAK TERSEDIA** — Playwright belum terpasang (`Q-005`) |
| Backend install | `backend/.venv/bin/python -m pip install -e "./backend[dev]"` | Tersedia |
| Backend lint/SAST | `backend/.venv/bin/ruff check backend/app backend/tests` | Tersedia |
| Backend typecheck | `backend/.venv/bin/mypy backend/app` | Tersedia |
| Backend test | `backend/.venv/bin/pytest backend/tests` | Tersedia |
| Backend coverage | `backend/.venv/bin/pytest backend/tests --cov=backend/app --cov-report=term-missing` | Tersedia; belum ada bukti coverage terbaru |
| Secret scan | `backend/.venv/bin/python scripts/scan_secrets.py` | Tersedia |
| SCA frontend | `npm --prefix frontend audit` | Tersedia |
| SCA backend | `pip-audit` | Tersedia hanya di environment eksternal; bukan dependency `.venv` |
| DAST/API test | — | Belum ada tool khusus; negative API test dijalankan via Pytest |

**Catatan:** Biome, Bandit, Semgrep, `uv sync`, dan `npm run typecheck` tidak tersedia sebagai konfigurasi proyek saat ini. Jangan menyalin command lama dari dokumen historis tanpa memeriksa manifest.
