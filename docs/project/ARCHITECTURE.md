# Architecture Document

## 1. Metadata dan Revision History
- **Proyek:** Doc-builder
- **Versi Arsitektur:** 2.0.0
- **Tanggal Persetujuan Awal:** 2026-10-20
- **Revisi Terakhir:** 2026-11-08 — Transformasi arsitektur menjadi Sistem Hybrid Online Multi-Tier: Hosting VPS Ubuntu 24.04 (1 vCPU, 2.2 GiB RAM) dengan Reverse Proxy (Caddy/Nginx), Autentikasi Pengguna & Kuota Cloud CV (max 5 CV, retensi 30 hari, backup terenkripsi Cloudflare R2 7 hari, email Brevo), Penghapus Latar Belakang Gambar Lokal (U2NetP CPU-only, antrean max 2, timeout 30s), serta Layanan URL Shortener Mandiri Serverless (Cloudflare Workers + D1).
- **Status:** Pending Approval (Revisi Gerbang 2)

## 2. Gambaran Umum Sistem & Topologi

Doc-builder v2.0 menggunakan arsitektur **Hybrid Multi-Tier** yang memisahkan pemrosesan dokumen/ML dan otentikasi di VPS terkelola dengan layanan pengalihan URL berlatensi rendah di edge serverless Cloudflare:

```text
                                 [ Pengguna Publik / Browser ]
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     │                                                 │
            (Subdomain Web Utama)                            (Subdomain URL Shortener)
                     │                                                 │
                     ▼                                                 ▼
      ┌─────────────────────────────┐                  ┌──────────────────────────────┐
      │   Cloudflare Edge Network   │                  │   Cloudflare Edge Network    │
      │  - DNS, WAF, DDoS Shield    │                  │  - Workers Edge Execution    │
      │  - Origin TLS Routing       │                  │  - Direct 302 Redirect       │
      └──────────────┬──────────────┘                  │  - Cloudflare D1 (Database)  │
                     │                                 │  - HMAC Signature Auth       │
                     ▼                                 │  - Admin via CF Access       │
      ┌─────────────────────────────┐                  └──────────────┬───────────────┘
      │ VPS Host (Ubuntu 24.04)     │                                 │
      │ 1 vCPU / 2.2 GiB RAM        │                   (Admin API Sync via HMAC)
      │                             │                                 │
      │  ┌───────────────────────┐  │                                 │
      │  │ Reverse Proxy (Caddy) │  │                                 │
      │  │ - TLS 1.3 Termination │  │                                 │
      │  │ - Rate Limiting per IP│  │                                 │
      │  │ - Static Assets Serve │  │                                 │
      │  └───────────┬───────────┘  │                                 │
      │              │ 127.0.0.1    │                                 │
      │              ▼              │                                 │
      │  ┌───────────────────────┐  │                                 │
      │  │ FastAPI App (Port 8000│◄─┼─────────────────────────────────┘
      │  │ - REST API & Session  │  │
      │  │ - Auth (Argon2/OAuth) │  │
      │  │ - CV Quota & Retention│  │
      │  │ - Storage Engine      │  │
      │  └─────┬───────────┬─────┘  │
      │        │           │        │
      │        ▼           ▼        │
      │  ┌───────────┐ ┌──────────┐ │
      │  │ Doc Engine│ │U2NetP ML │ │
      │  │ LibreOff, │ │CPU-Only  │ │
      │  │ PyMuPDF   │ │Queue max2│ │
      │  └───────────┘ └──────────┘ │
      │        │                    │
      │        ▼                    │
      │  ┌────────────────────────┐ │
      │  │ Background Sweeper     │ │
      │  │ - Expired CV (>90d)    │ │
      │  │ - Anon Files (>1h)     │ │
      │  │ - Encrypted R2 Backup  │ │
      │  └───────────┬────────────┘ │
      └──────────────┼──────────────┘
                     │
                     ▼
      ┌─────────────────────────────┐
      │ Cloudflare R2 (Private)     │
      │ - Encrypted Snapshot Backup │
      │ - Object Lifecycle: 7 Days  │
      └─────────────────────────────┘
```

## 3. Komponen Arsitektur Utama

### 3.1 Frontend Web Client — ARCH-01
- **Teknologi:** React 19, TypeScript, Vite, Tailwind CSS, Lucide icons.
- **State Management & Form:** State React lokal, Zod schema validation, modular tool dialogs.
- **Dua Jalur Penyimpanan CV:**
  1. *Mode Anonim / Tamu:* Penyimpanan draf lokal di IndexedDB (offline-capable).
  2. *Mode Akun Terdaftar:* Sinkronisasi draf proyek CV terstruktur ke backend PostgreSQL VPS (maksimal 5 CV per akun, retensi 30 hari).
- **Halaman & Dialog Tambahan Online:**
  - Modal Autentikasi (Masuk, Daftar, Lupa Kata Sandi, Verifikasi Email, Masuk via Google).
  - Manajemen Akun & Pengaturan Profil (daftar CV tersimpan, indikator kuota 5 dokumen, sisa hari retensi, tombol hapus akun mandiri, tombol sambung/lepas Google OAuth dengan re-authentication).
  - Modal Remove Background dengan live preview interaktif (checkerboard transparansi dan color picker background preview).
  - Portal Pemendek URL (khusus Owner/Admin).

### 3.2 Edge Infrastructure & Reverse Proxy — ARCH-02
- **Cloudflare Edge:**
  - Menyediakan proteksi DDoS, DNS manajemen, dan WAF edge rules.
  - Subdomain Shortener didelegasikan ke Cloudflare Workers.
- **Reverse Proxy VPS (Caddy):**
  - Mengikat port 80/443 dengan sertifikat TLS otomatis.
  - Menyajikan static bundle frontend hasil build Vite (`dist/`).
  - Mem-proxy request `/api/*` ke backend FastAPI lokal (`127.0.0.1:8000`).
  - Menegakkan rate limiting per client IP: misal 60 req/menit untuk API umum, 5 req/menit untuk endpoint autentikasi, dan 2 req/menit untuk pemrosesan ML berat.
  - Menginjeksi security headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, dan `Content-Security-Policy`.

### 3.3 Backend API & User Management Service (FastAPI) — ARCH-03
- **Teknologi:** Python 3.11+, FastAPI, Uvicorn (internal loopback binding `127.0.0.1:8000`).
- **Autentikasi & Otorisasi:**
  - Password hashing menggunakan **Argon2id** (atau bcrypt work factor 12).
  - Soal Anti-Bot: Tantangan matematika dasar SD kelas 1 bertahap server-side (HMAC-SHA256 signed challenge token dengan expiry 5 menit) sebelum penerbitan sesi.
  - Catatan Google Auth (AUTH-ACCESS-001, DEC-023): Seluruh endpoint publik Google Auth (`POST /api/auth/google`, `link-google`, `unlink-google`) dinonaktifkan sementara dari API publik sampai modul OAuth authorization code resmi diimplementasikan.
  - **Account Linking Guard:** Menolak auto-merge jika email sama ditemukan. Pengguna wajib login dengan kredensial lama terlebih dahulu, lalu menghubungkan Google via re-authentication.
  - Session management menggunakan Cookie `HttpOnly`, `Secure`, `SameSite=Lax`, dengan token sesi berumur terbatas dan invalidasi instan saat logout/hapus akun.
- **Penyimpanan Dokumen CV & Kuota:**
  - Database relasional SQLite (dengan WAL mode) di VPS untuk data akun, sesi, dan draf terstruktur CV.
  - Satu proyek CV disimpan sebagai entitas data terstruktur JSON + template ID (ukuran rata-rata < 100 KB); berkas upload pendukung (seperti foto formal) divalidasi dan dioptimasi.
  - Enforce kuota: max 5 CV per akun, max 10 MB per dokumen, max 50 MB total per akun, dan kuota global penyimpanan 5 GB.
  - Dokumen mencatat timestamp `updated_at` dan `expires_at` (`updated_at` + 30 hari). Aksi baca atau render unduhan tidak memicu pembaruan `updated_at`.
- **Integrasi Email Transaksional (Brevo Free):**
  - Adapter modular Python untuk Brevo REST API v3.
  - Template email transaksional berbahasa Indonesia untuk verifikasi email pendaftaran, token reset password, dan pemberitahuan kedaluwarsa dokumen pada H-14, H-7, dan H-1.
  - Email tidak memuat konten CV atau data pribadi sensitif.

### 3.4 Isolated Document & ML Processing Engine — ARCH-04
- **Engine Dokumen:**
  - Konversi DOCX↔PDF: LibreOffice Headless via sandboxed subprocess.
  - Utilitas PDF: PyMuPDF (`fitz`) untuk protect, unlock, repair, OCR, watermark, page numbers, dan markdown.
  - Utilitas Gambar: Pillow untuk kompresi dan sanitasi EXIF.
- **Engine Remove-Background (U2NetP CPU-Only):**
  - Model inferensi berbasis `onnxruntime` atau `torch` CPU-only dengan model berbobot ringan U2NetP (~4.7 MB biner bobot).
  - **Eksekusi Subprocess Terisolasi:** Worker dieksekusi dalam subprocess terpisah yang dihentikan dan dibebaskan sepenuhnya pasca-inferensi untuk mengembalikan memori fisik ke OS (mencegah memory leak atau akumulasi RAM di 2.2 GiB RAM host).
  - **Concurrency & Queueing:** Dikelola oleh `job_manager.py` yang diperluas: Concurrency = 1 active job, Antrean tunggu = maksimal 2 job, Timeout = hard timeout 30 detik.
  - Jika antrean penuh, backend merespons HTTP 429/503 dengan header `Retry-After: 30`.

### 3.5 Pemendek URL Serverless (Cloudflare Workers + D1) — ARCH-05
- **Arsitektur:** 100% Serverless di Edge Cloudflare.
- **Runtime:** Cloudflare Workers (TypeScript / Hono atau native Fetch handler).
- **Database:** Cloudflare D1 (Serverless SQLite at edge).
- **Routing:**
  - `GET /:slug`: Memeriksa D1. Jika link aktif (`status = 'active'`), mengembalikan `302 Found` ke `destination_url` dan memperbarui `click_count` serta `last_accessed_at` secara asinkron (menggunakan `ctx.waitUntil`). Jika `status = 'revoked'`, mengembalikan `410 Gone`. Jika tidak ditemukan, mengembalikan `404 Not Found`.
  - `POST /api/shorten`: Pembuatan link baru. Wajib header `X-Signature` HMAC-SHA256, `X-Timestamp`, dan `X-Nonce`.
  - `POST /api/revoke`: Pencabutan link. Mengubah status menjadi `revoked` dan mencatat `revoked_at`.
- **Lifecycle & Anti-Reuse:**
  - Link aktif tidak memiliki masa kedaluwarsa.
  - Link yang dicabut dipertahankan selama 90 hari sebelum `destination_url` dihapus/dikosongkan menjadi tombstone permanen.
  - Slug yang dicabut tidak boleh digunakan ulang (primary key / unique index pada `slug`).
- **Validasi Destination URL (Anti-SSRF):**
  - Skema wajib `https:`.
  - Melarang username/password dalam URL.
  - Resolusi host menolak alamat loopback (`127.0.0.0/8`, `::1`), private range (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`, `fe80::/10`), dan reserved IPs.
- **Admin Portal Access:**
  - Halaman antarmuka manajemen link dilindungi oleh Cloudflare Access (kebijakan Zero Trust: verifikasi email OTP/Google login pemilik akun).
- **Catatan Pemendek URL Publik (AUTH-ACCESS-001, DEC-023):**
  - Endpoint publik pembuatan dan konfigurasi link (`POST /api/shortener/create`, `GET /api/shortener/config`) dinonaktifkan dari API umum Satukit untuk mencegah abuse; redirect publik `GET /s/{slug}` dan `GET /api/s/{slug}` tetap aktif melayani 302/404/410 dengan counter atomik.

### 3.6 Background Worker & Disaster Recovery — ARCH-06
- **Periodic Retention Cleaner:**
  - Cron service harian yang mengeksekusi script pembersihan di VPS.
  - Mencari proyek CV dengan `expires_at < NOW()`. Menghapus draf dan file terkait secara fisik dari disk dan database.
  - Menghapus berkas temporer tamu anonim yang berumur > 1 jam.
- **Encrypted Backup ke Cloudflare R2:**
  - Cron job harian melakukan snapshot SQLite database dan direktori data CV.
  - Mengompresi dan mengenkripsi arsip cadangan dengan AES-256-GCM menggunakan symmetric key yang tersimpan aman di environment VPS.
  - Mengunggah arsip terenkripsi ke Cloudflare R2 Standard bucket (private bucket tanpa izin akses publik).
  - Lifecycle rule pada bucket R2 secara otomatis menghapus objek cadangan setelah 7 hari.
- **Fail-Closed Disk Guard:**
  - Pemeriksaan berkala terhadap kapasitas disk VPS (`df -h`).
  - Ambang Peringatan (70%): Log peringatan level WARNING dan notifikasi admin.
  - Ambang Pemblokiran (80%): Menolak pembuatan atau penyimpanan proyek CV baru dengan pesan error yang jelas bagi pengguna.

## 4. Keamanan dan Isolasi (Security by Design)
- **Tingkat Risiko:** HIGH.
- **Prinsip Least Privilege:** Backend FastAPI berjalan di bawah user non-root (`docbuilder` / `www-data`).
- **Autentikasi & Kredensial:** Seluruh secret (Brevo API Key, Google OAuth Secret, R2 Access Key, HMAC Secret) hanya tersimpan dalam file environment terlindungi (`0600`) dan secret binding Cloudflare, tidak pernah dikirim ke frontend.
- **Proteksi Penggabungan Akun (Anti-Takeover):** Tidak ada auto-merge. Akun dengan email sama wajib dihubungkan melalui autentikasi sadar.
- **Proteksi Denial of Service (DoS):**
  - Rate limiting di layer Caddy dan Cloudflare WAF.
  - Concurrency limit = 1 dan queue limit = 2 pada ML worker U2NetP.
  - Hard timeout 30 detik untuk pembatalan paksa subprocess inferensi yang hang.
- **Anti-SSRF pada URL Shortener:** URL tujuan divalidasi ketat di edge sebelum disimpan ke D1.
- **Audit Logging:** Audit log append-only di VPS mencatat peristiwa otentikasi, pembuatan link, penghapusan akun, dan eksekusi background worker tanpa mencatat payload PII atau kata sandi.

## 5. Alur Data (Data Flow)

### 5.1 Alur Autentikasi & Penyimpanan CV Terkelola
```text
Pengguna -> Daftar / Masuk (Email+Password / Google OAuth)
         -> Backend Verifikasi Kredensial (Argon2 / Google Token Verification)
         -> Terbitkan Cookie Sesi HttpOnly Secure
         -> Pengguna Menyunting CV -> Simpan ke Cloud
         -> Backend Periksa Kuota (Akun < 5 CV, Ukuran < 10 MB, Total Akun < 50 MB, Global < 5 GB, Disk < 80%)
         -> Simpan Draf Terstruktur ke DB + Set expires_at = NOW() + 30 hari
         -> Respons Sukses
```

### 5.2 Alur Penghapusan Latar Belakang Gambar (Remove Background)
```text
Pengguna Mengunggah Gambar (JPG/PNG/WebP <= 10 MB)
  -> Frontend Validasi Ukuran & Magic Bytes
  -> Request POST /api/image/remove-background
  -> Backend Job Manager Periksa Antrean (Aktif = 0? Jalankan! | Antrean < 2? Antrekan! | Penuh? Tolak 429)
  -> Spawn Subprocess U2NetP CPU-Only dengan Timeout 30s
  -> Inferensi Alpha Masking -> Komposisi RGBA Transparan
  -> Hentikan Subprocess & Bebaskan Memori
  -> Simpan Hasil Temporer (TTL 1 Jam)
  -> Kirim Pratinjau ke Frontend -> Pengguna Melihat Pratinjau Checkerboard -> Unduh Berkas
```

### 5.3 Alur Pengalihan URL Pendek (Cloudflare Workers)
```text
Pengunjung Mengakses https://go.domain.com/{slug}
  -> Cloudflare Edge Worker Mengintersepsi Request
  -> Query Cloudflare D1 Cache / Read: SELECT destination_url, status FROM urls WHERE slug = ?
  -> Status 'active'? -> Async increment click_count via ctx.waitUntil -> HTTP 302 Redirect ke destination_url
  -> Status 'revoked'? -> HTTP 410 Gone (Link telah dicabut)
  -> Tidak ditemukan? -> HTTP 404 Not Found
```

## 6. Error Handling & Observability
- **Error Envelope Standar:** `{ success: false, error: { code: string, message: string } }`.
- **Health Check:** `GET /api/health` memeriksa status database lokal, kapasitas disk, antrean ML, dan status konektivitas eksternal.
- **Monitoring Edge:** Cloudflare Dashboard analytics untuk memantau request rate, latensi edge, dan kuota D1/Workers.
- **Log Rotasi & Retensi:** Log lokal Caddy dan FastAPI diputar harian dengan retensi 7 hari.

## 7. Known Architecture Trade-offs & Accepted Constraints
- **1 vCPU / 2.2 GiB RAM:** Tidak dapat menjalankan model AI generatif (LLM) atau model segmentasi berat. U2NetP CPU-only dipilih karena efisiensi memori (< 200 MB saat inferensi) dan model weights hanya 4.7 MB.
- **Subprocess Isolation:** Mengorbankan waktu spawn awal (~500 ms) demi stabilitas RAM dan isolasi error agar web server tidak pernah mengalami OOM.
- **Serverless URL Shortener Terpisah:** Memisahkan beban redirect dari VPS ke Cloudflare Workers untuk memastikan pengalihan super cepat (≤100 ms) dan tidak membebani CPU VPS.
- **Network Isolation:** **Belum memadai.** Implementasi saat ini hanya menyetel `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` ke port tertutup dan menyanitasi environment; tidak ada network namespace, firewall, atau egress block OS-level. Windows memakai Job Object untuk batas proses/memori, bukan network. Gap ini dicatat sebagai `RISK-SEC-003`.
- **Resource Limiting:** Timeout 5 menit per pekerjaan; Windows Job Object membatasi memori default 500 MB; Linux belum memiliki memory cap (cgroup/rlimit). Batas disk temporer 500 MB.
- **Sanitasi File:** Validasi magic bytes sebelum berkas diproses; penolakan makro aktif (.docm/.xlsm); penolakan berkas terenkripsi pada jalur yang tidak meminta password; fail-closed untuk dokumen bertanda tangan digital pada operasi yang dapat merusaknya; pembersihan metadata gambar.
- **Pembersihan Berkas Temporer:** Pola try-finally membersihkan workspace setelah job selesai, ditambah startup sweep untuk workspace kedaluwarsa (TTL 5 menit). Periodic daemon sweeper belum diimplementasikan; lihat `RISK-SEC-002`.
- **Audit Trail:** `backend/app/core/audit.py` menulis event JSONL append-only ke `backend/logs/` dengan permission `0600`/direktori `0700`, rotasi harian UTC, dan retensi 7 hari. `SecurityMiddleware` mencatat denial Origin/session/CSRF, error API, dan request `/api/*` yang diizinkan tanpa body, header, cookie, query string, atau PII. Kegagalan tulis bersifat fail-open.

## 5. Alur Data (Data Flow)

### 5.1 Alur CV Builder
```text
Pengguna Mengisi Form -> Validasi Zod -> Update Live Preview (In-Memory)
                      -> Estimasi Tinggi A4 -> Badge Jumlah Halaman + Overlay Page Break
                      -> Debounced Autosave (IndexedDB)
                      -> Klik Unduh PDF/DOCX -> Preflight Kualitas
                      -> Error: blokir + navigasi Perbaiki | Warning: acknowledgment
                      -> Sanitasi Nama Berkas (frontend) -> Request ke Backend
                      -> Sanitasi Nama Berkas (backend) -> Generator Worker Merender Berkas
                      -> Stream Download ke Browser -> Hapus Berkas Temp
```

### 5.2 Alur Konversi Dokumen
```text
Upload File -> Validasi Magic Bytes & Ukuran -> Simpan ke Temp Workspace Unik
            -> Spawn Worker Subprocess (proxy env; egress block OS-level belum ada — RISK-SEC-003)
            -> Proses Konversi dengan Timeout 5 Menit
            -> Hasil Tersedia -> Notifikasi Progress Selesai
            -> Pengguna Mengunduh Output -> Auto-delete Temp Workspace
```

### 5.3 Alur Impor Selektif, CV Target, dan Manajemen Draft
```text
Impor PDF/DOCX -> Parsing + Confidence -> Pilih Bagian -> Mode merge/replace
               -> Snapshot bagian terpilih -> Terapkan ke Editor -> Undo 30 detik (restore snapshot)

Job Matching -> Pilih Lowongan -> Buat CV Target
             -> Salin Draft Sumber + targetJob + Urutkan Skill Cocok
             -> Draft Asli Tidak Berubah

Daftar Draft -> Cari / Favorit / Rename / Duplikasi / Hapus + Undo
             -> Favorit diurutkan lebih dahulu, lalu updatedAt
             -> Flush Autosave Sebelum Berpindah/Menduplikasi Draft
```

## 6. Error Handling & Observability
- **Error Response Envelope:** Respons error menggunakan `{ success: false, error: { ... } }` tanpa membocorkan stack trace internal ke client.
- **Logging:** Audit trail JSONL lokal tersedia di `backend/app/core/audit.py`: append-only, permission `0600`/`0700`, rotasi harian UTC, retensi 7 hari, dan field yang tidak memuat body/header/query/PII. `SecurityMiddleware` mencatat denial keamanan, error API, dan request `/api/*` yang diizinkan. Batas: log belum tamper-evident terhadap pengguna OS yang sama dan belum memiliki batas ukuran harian; `RISK-SEC-001` menunggu approval penutupan owner.
- **Health Check Endpoint:** `GET /api/health` mengembalikan status kesiapan server lokal dan deteksi ketersediaan LibreOffice.

## 7. Known Documentation & Security Gaps (2026-10-24)
- `RISK-SEC-001`: audit trail JSONL lokal sudah diimplementasikan dan diuji; status mitigasi menunggu approval penutupan owner.
- `RISK-SEC-002`: workspace job manager memakai permission default `0775`, belum eksplisit `0700`; periodic sweeper belum tersedia.
- `RISK-SEC-003`: sandbox belum memiliki egress block OS-level; Linux belum memiliki memory cap. Klaim “isolasi jaringan penuh” dikoreksi.
- `Q-001`: metrik fidelitas visual formal belum ditetapkan; benchmark 100% adalah field/teks, bukan SSIM/pixel diff.
- `Q-005`: cross-browser E2E Playwright belum tersedia; klaim “4 Browser matrix PASS” tidak didukung bukti.
- `Q-006`: `docs/conversations.json` berisi transkrip percakapan dan memerlukan keputusan kebijakan repository.
- Detail risk treatment ada di `docs/project/SECURITY.md` dan `.agent/OPEN-QUESTIONS.md`.

## 8. Arsitektur Rak Berkas Privat Per Akun (File Shelf)

### 8.1 Ringkasan & Prinsip Desain
Rak Berkas (`/api/files` dan UI `#/files`) adalah fasilitas penyimpanan berkas privat per akun pengguna terdaftar dengan batas kuota ketat (5 slot per akun, maksimal 25 MB per berkas, retensi 30 hari otomatis).
Prinsip utama:
1. **Pemisahan Proses Penuh:** Upload API Uvicorn (`satukit.service`) hanya memvalidasi kuota dan streaming ke folder karantina lokal (`0600`). Seluruh inspeksi berat (ClamAV, bubblewrap parsing, enkripsi, dan upload R2) didelegasikan ke background worker mandiri (`satukit-file-worker.service`).
2. **Karantina Ketat & Sandbox Isolasi:** Berkas mentah disimpan di direktori terisolasi dengan mode `0600`. Parser dijalankan via child process `bubblewrap --unshare-net` dengan `RLIMIT_AS=512 MiB` dan hard timeout 30 detik.
3. **ClamAV Antivirus Terdedikasi:** Pemindaian malware wajib melalui daemon Unix socket (`/run/clamav/clamd.ctl`) menggunakan protokol streaming `INSTREAM`. Koneksi TCP dilarang. Signature ClamAV diperbarui via freshclam tiap 4 jam; jika signature berusia >24 jam, upload/promosi file diblokir secara fail-closed.
4. **Enkripsi Sisi Server Terikat Identitas:** Berkas dienkripsi dengan AES-256-GCM envelope 49-byte sebelum dikirim ke Cloudflare R2 Standard privat terpisah. Associated Authenticated Data (AAD) wajib mengikat `user_id`, `item_id`, dan `content_type` untuk mencegah cross-tenant cipher reuse.
5. **Kunci Enkripsi Root-Owned:** Keyring disimpan di host `/etc/satukit` (permission root `0400`) dan disalurkan ke service melalui systemd `LoadCredential=`. Recovery key offline diuji secara berkala tiap kuartal.
6. **Pemantauan Kapasitas Cloudflare R2:** Polling metrik account-wide dilakukan tiap 15 menit via Cloudflare GraphQL API. Data metrik yang usang (>30 menit) memicu fail-closed (blokir upload & download). Hard ceiling rak 7 GB; alert Class A pada 700k dan Class B pada 7M; blok upload pada Class A 800k dan blok download pada Class B 8M di bulan kalender UTC.

### 8.2 Topologi Proses & Komponen
```text
Client Browser (UI #/files)
    |
    | (1) POST /api/files/upload [application/octet-stream + headers base64url]
    v
Caddy Reverse Proxy (HTTPS 443 -> 127.0.0.1:8000)
    v
FastAPI Uvicorn (satukit.service)
    |
    |-- (2) Validasi autentikasi, status email, rate limit rolling hour,
    |       dan reservasi slot atomik (SELECT ... FOR UPDATE di PostgreSQL)
    |-- (3) Stream payload ke karantina lokal /var/lib/satukit/quarantine/<item_id>.raw (mode 0600)
    |-- (4) Buat record file_shelf_items (status: 'CHECKING')
    `-- (5) Return HTTP 202 Accepted { id, status: 'CHECKING' }

                [ PostgreSQL Database ]
                         ^
                         | (Polling queue CHECKING & DELETION)
                         v
Background Worker (satukit-file-worker.service)
    |
    |-- (6) Scan Antivirus via Unix Socket /run/clamav/clamd.ctl (INSTREAM)
    |-- (7) Inspeksi Format mendalam di sandbox child process:
    |       bwrap --unshare-net --ro-bind / / ... (RLIMIT_AS=512MB, timeout 30s)
    |       vtx-oletools, msoffcrypto-tool, defusedxml
    |-- (8) Enkripsi AES-256-GCM envelope 49-byte (Keyring via LoadCredential=)
    |       AAD: "user_id|item_id|content_type"
    |-- (9) Upload stream terenkripsi ke Cloudflare R2 Standard (Bucket Privat)
    |-- (10) Hapus file mentah di karantina lokal
    `-- (11) Update record PostgreSQL (status: 'AVAILABLE', available_at: now())
```

### 8.3 Format Berkas yang Didukung & Ditolak
- **Didukung:** PDF, DOCX, PPT/PPTX, XLS/XLSX, JPG/JPEG, PNG, WebP, Markdown UTF-8.
- **Ditolak:** Arsip (ZIP, RAR, 7Z, TAR, GZ), SVG, executable/biner, audio, video.
- **Aturan Keamanan Konten:**
  - Tolak dokumen yang memuat makro VBA, JavaScript, OLE/ActiveX, launch actions, external references, polyglot header, file terenkripsi/terproteksi password, atau bom arsip/XML/dekompresi gambar.
  - Gambar statis: byte asli dipertahankan penuh (termasuk metadata EXIF/GPS) dengan kewajiban konfirmasi checkbox peringatan di UI sebelum upload (`RISK-SEC-014`). Gambar animasi ditolak.

### 8.4 Envelope Enkripsi 49-Byte
Header biner terenkripsi memiliki panjang tepat 49 byte sebelum ciphertext:
```text
+---------------+---------------+-------------------+-----------------------+---------------------+
| Versi (1 Byte)| IV (12 Byte)  | Auth Tag (16 Byte)| Key ID Hash (20 Byte) | Ciphertext (N Byte) |
+---------------+---------------+-------------------+-----------------------+---------------------+
```
- Versi: `0x01` (1 byte).
- IV: 12-byte random non-repeating cryptographic nonce.
- Auth Tag: 16-byte GCM authentication tag.
- Key ID Hash: 20-byte SHA-1 dari Key ID aktif untuk mendukung rotasi kunci mulus.
- AAD: String UTF-8 kanonikal `satukit:fileshelf:v1:{user_id}:{item_id}:{content_type}`.

### 8.5 Batas Unduh & Kuota Bersama
- Kuota akun: maksimal 5 slot total (item AVAILABLE + in-flight CHECKING).
- Maksimal 1 upload in-flight per akun.
- Rate limit rolling 60 menit per akun: maksimal 10 upload sukses, maksimal 30 download.
- Konkurensi download: maksimal 1 download aktif per akun dan maksimal 2 download lease global di seluruh sistem untuk mencegah saturasi bandwidth VPS.
- Unduh langsung didekripsi on-the-fly dari stream R2 ke client tanpa menyimpan file terdekripsi di disk lokal.
