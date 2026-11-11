# Security Architecture & Threat Model (SECURITY.md)

## 1. Metadata & Governance
- **Security Risk Tier:** HIGH (karena memproses berkas biner tidak tepercaya, data pribadi PII pelamar kerja, otentikasi multi-user online publik, dan inferensi ML lokal di VPS).
- **Security Owner:** User (Owner Proyek)
- **Data Owner:** User (Owner Proyek)
- **Approval Authority:** User (Owner Proyek)
- **Tanggal Evaluasi Awal:** 2026-10-20
- **Revisi Dokumentasi:** 2026-10-24 — koreksi kontrol dan risk register; 2026-10-27 — implementasi audit trail JSONL; 2026-11-08 — Ekspansi model ancaman komprehensif untuk transformasi online VPS multi-user: otentikasi Email/Password & Google OAuth, pencegahan account takeover, pembatasan kuota CV 30 hari, backup terenkripsi Cloudflare R2 (7 hari), isolasi ML worker U2NetP (concurrency 1, antrean max 2, timeout 30s), anti-SSRF pada URL Shortener Cloudflare Workers + D1, dan disk fail-closed; 2026-11-11 — Penutupan entry point publik Google Auth dan Shortener Management (AUTH-ACCESS-001, DEC-023).
- **Status Gate:** PENDING (Evaluasi Gerbang 2 untuk rilis Online v2.0).
- **Release Gate Berikutnya:** PENDING — Seluruh kontrol baru wajib divalidasi dan diuji sebelum rilis publik.

## 2. Aset Kritis dan Klasifikasi Data
1. **Kredensial & Sesi Pengguna (Kritis):** Kata sandi ter-hash (Argon2id/bcrypt), token sesi cookie, token reset password, token verifikasi email, dan Google OAuth refresh/access token di backend.
2. **Data PII Pelamar Tersimpan (Kritis):** Nama lengkap, kontak, riwayat karier/pendidikan, foto profil, dan draf CV yang tersimpan di database VPS (terikat kepemilikan `user_id`).
3. **Kredensial Layanan Pihak Ketiga & Secret (Kritis):** Brevo API Key, Google OAuth Client Secret, Cloudflare R2 Access/Secret Keys, HMAC Secret Key untuk URL Shortener, dan symmetric encryption key backup. Disimpan strictly di environment VPS (`0600`) dan secret binding Workers.
4. **Dokumen & Citra Temporer (Sensitif):** Berkas unggahan converter dan gambar remove-background. Berada sementara di workspace dengan izin `0700` dan TTL maksimal 1 jam (tamu) atau per-job cleanup.
5. **Database URL Shortener (Sensitif):** Pemetaan slug dan destination URL di Cloudflare D1. Bebas dari PII pengunjung.

## 3. Threat Coverage Matrix & Mitigasi

Status bukti yang dipakai:
- `TERVERIFIKASI`: ada implementasi dan bukti eksekusi yang relevan.
- `TERVERIFIKASI (SPIKE/HISTORIS)`: bukti berasal dari spike atau eksekusi historis; regression test utama belum lengkap.
- `TERENCANA (ONLINE)`: dirancang formal untuk fase implementasi online dan wajib diuji pada quality gate.
- `PARTIAL`: kontrol ada sebagian, atau bukti belum mencakup seluruh klaim.
- `GAP`: kontrol yang diklaim sebelumnya belum diimplementasikan; bukan berarti risiko diterima.

| Kategori Ancaman | Status | Threat Scenario (ID) | Preventive / Detective Control | Status Bukti / Gap | Residual Risk & Owner |
|---|---|---|---|---|---|
| Reconnaissance | APPLICABLE | THR-001: Scanning port VPS & enumerasi versi server | Reverse proxy Caddy/Cloudflare WAF membatasi eksposur port publik (hanya 80/443); backend terikat `127.0.0.1:8000`; hilangkan server version header | `TERENCANA (ONLINE)` — Caddy TLS + Cloudflare proxy; backend loopback bind terverifikasi | LOW (Owner) |
| Scanning & Enumeration | APPLICABLE | THR-002: Enumerasi akun via respons login/reset password atau path traversal temp file | Respons autentikasi dan reset password seragam (anti-enumeration); temp workspace berbasis random UUID dengan direktori `0700` | `TERENCANA (ONLINE)` — temp UUID terverifikasi; endpoint auth anti-enumeration dirancang di Phase 11 | LOW (Owner) |
| Vulnerability Assessment | APPLICABLE | THR-003: Kerentanan pada dependensi Python, npm, atau Cloudflare Workers packages | Lockfile pinning, scanning berkala (`npm audit`, `pip-audit`, Trivy), peninjauan paket sebelum instalasi | `PARTIAL` — audit dependensi lokal PASS; automated scanning pada CI/CD direkomendasikan | LOW (Owner) |
| Exploitation | APPLICABLE | THR-004: Exploit buffer overflow / memory corruption via file PDF/DOCX/gambar korup | Validasi magic bytes, batas ukuran berkas, sandbox subprocess isolasi, memory limit, timeout keras 30s-300s | `PARTIAL` — magic bytes/timeout terverifikasi; isolasi ML worker subprocess dirancang di Phase 10 | MEDIUM (Owner; `RISK-SEC-003`, `RISK-SEC-004`) |
| Password Attacks | APPLICABLE | THR-012: Brute force, credential stuffing, atau password spraying pada login pengguna | Hashing modern (Argon2id/bcrypt), rate limiting per IP & akun pada Caddy/FastAPI, lockout bertahap, token reset acak berentropi tinggi dan single-use (TTL 15m) | `TERENCANA (ONLINE)` — diimplementasikan pada Phase 11 (`RISK-SEC-006`) | LOW (Owner) |
| Social Engineering | APPLICABLE | THR-005: Penipuan akun via tautan reset password palsu atau email phishing | Email transaksional via Brevo dengan SPF/DKIM/DMARC tervalidasi; email tidak pernah meminta password atau memuat data sensitif; SOP verifikasi | `TERENCANA (ONLINE)` — konfigurasi DNS SPF/DKIM disiapkan saat domain aktif | LOW (Owner) |
| Web/Application/API | APPLICABLE | THR-006: Serangan CSRF, XSS, SSRF (URL Shortener), atau abuse API tanpa otentikasi | Cookie `HttpOnly`, `Secure`, `SameSite=Lax`, CSRF header token, Origin allowlist. URL Shortener: validasi tujuan HTTPS publik, tolak IP private RFC 1918/loopback/link-local/reserved (Anti-SSRF). API shortener: HMAC signature verification | `TERVERIFIKASI` (CSRF/Origin); `TERENCANA (ONLINE)` (SSRF guard & HMAC auth di Phase 12 - `RISK-SEC-005`) | LOW (Owner) |
| Privilege Escalation | APPLICABLE | THR-007: Pengguna mengakses atau mengubah CV milik pengguna lain (IDOR / Broken Object Level Authorization) | Strict ownership check pada backend (`WHERE id = :cv_id AND user_id = :current_user_id`); peran Admin khusus URL Shortener dilindungi Cloudflare Access + HMAC | `TERENCANA (ONLINE)` — model otorisasi ownership dirancang di Phase 11 | LOW (Owner) |
| Lateral Movement | APPLICABLE | THR-008: Worker subprocess membobol host VPS atau jaringan internal | Eksekusi subprocess di bawah user sistem non-root (`docbuilder`); isolasi direktori workspace; pembatasan network egress OS-level | `GAP` pada offline sandbox (`RISK-SEC-003`); kontrol VPS non-root dirancang di Phase 10 | MEDIUM provisional (Owner; `RISK-SEC-003`) |
| Persistence | APPLICABLE | THR-009: File temporer atau draf kedaluwarsa menumpuk dan menghabiskan disk | Per-job cleanup; periodic sweeper otomatis untuk file anonim (>1 jam) dan draf CV (>30 hari); disk fail-closed guard pada 70%/80% | `TERENCANA (ONLINE)` — diimplementasikan pada Phase 10 dan 11 (`RISK-SEC-007`) | LOW (Owner) |
| Defense Evasion | APPLICABLE | THR-010: Penyerang memanipulasi atau menghapus log audit backend | Log audit append-only JSONL dengan permission `0600`/`0700`, rotasi harian, retensi 7 hari; log terisolasi dari akses web | `TERVERIFIKASI` — audit trail lokal diuji 10/10 PASS (`RISK-SEC-001`) | LOW (Owner) |
| Exfiltration | APPLICABLE | THR-011: Kebocoran massal data CV pengguna atau draf lamaran | Draf CV disimpan terstruktur; kuota max 5 CV per akun; kuota global 5 GB; backup ke Cloudflare R2 dienkripsi simetris (AES-256-GCM) sebelum transit dan memiliki lifecycle deletion 7 hari; fitur hapus akun mandiri dengan pembersihan permanen | `TERENCANA (ONLINE)` — diimplementasikan pada Phase 11 & 13 (`RISK-SEC-007`) | LOW (Owner) |

### 3.1 Evaluasi Cross-Cutting Ancaman Baru
| Skenario | Status | Kontrol / Bukti | Residual Risk |
|---|---|---|---|
| DoS & Resource Exhaustion (ML Worker) | APPLICABLE | Concurrency = 1, Queue max 2, penolakan 429 dengan `Retry-After: 30`, timeout keras 30 detik, penghentian subprocess untuk membebaskan RAM, fail-closed disk guard 80% | LOW (Owner; `RISK-SEC-004`) |
| Account Takeover via Auto-Merge | APPLICABLE | Dilarang auto-merge antara email/password dan Google OAuth; seluruh endpoint Google auth publik dan linking dinonaktifkan (AUTH-ACCESS-001) sampai backend authorization code resmi tersedia; wajib linking sadar via re-authentication | LOW (Owner; `RISK-SEC-006`) |
| Malicious URL Redirection / Phishing (URL Shortener) | APPLICABLE | Validasi skema HTTPS publik, endpoint create/config shortener publik dinonaktifkan (AUTH-ACCESS-001), redirect publik /s/{slug} tetap beroperasi aman dengan counter atomik, link creation khusus owner terotentikasi HMAC via Cloudflare Access, revoke instan (410 Gone), larangan daur ulang slug | LOW (Owner; `RISK-SEC-005`) |
| Loss / Compromise of Cloud Backup | APPLICABLE | Bucket Cloudflare R2 private tanpa akses publik; file snapshot dienkripsi AES-256-GCM di VPS sebelum upload; lifecycle rule otomatis hapus berkas cadangan setelah 7 hari | LOW (Owner; `RISK-SEC-007`) |

### 3.1 Evaluasi Cross-Cutting
| Skenario | Status | Kontrol / Bukti | Residual Risk |
|---|---|---|---|
| Availability/DoS dan resource exhaustion | APPLICABLE | Batas ukuran 25 MB, timeout 5 menit, satu job aktif (`JobBusyError`), batas temp 500 MB; Windows Job Object 500 MB; Linux belum memiliki memory cap (`RISK-SEC-003`) | MEDIUM provisional (Owner; `RISK-SEC-003`) |
| Supply-chain / CI-CD | APPLICABLE | Lockfile tersedia; SCA manual 2026-10-21; tidak ada pipeline CI/CD atau SBOM | LOW (Owner; `Q-005`) |
| Insider / authorized-user abuse | APPLICABLE | Aplikasi lokal single-user; tidak ada akun/RBAC; batas kepercayaan adalah akun OS pengguna | LOW (Owner) |
| Key/certificate/cryptographic compromise | APPLICABLE | Token sesi lokal dan enkripsi file project; tidak ada HSM/KMS, sesuai model desktop lokal | LOW (Owner) |
| Destructive integrity / ransomware | APPLICABLE | Draft IndexedDB dapat diekspor sebagai file project; belum ada backup otomatis | MEDIUM provisional (Owner; review berikutnya) |
| Third-party/provider compromise | NOT APPLICABLE | Tidak ada cloud/API pihak ketiga; LibreOffice dan Tesseract adalah binary lokal opsional | LOW (Owner) |
| Business-logic abuse | APPLICABLE | Batas ukuran file, satu job aktif, validasi password/format; tidak ada akun atau transaksi finansial | LOW (Owner) |

### 3.2 Model Ancaman & Kontrol Rak Berkas (File Shelf)
| Threat ID | Skenario Ancaman | Kontrol Terkait | Tipe Kontrol | Mitigasi / Penanganan |
|---|---|---|---|---|
| `THR-018` | Eksekusi malware/trojan via berkas unggahan | `CTRL-018` | Preventive & Detective | Scan wajib daemon ClamAV Unix socket `INSTREAM` (`/run/clamav/clamd.ctl`). Signature >24 jam memblokir promosi file. File terinfeksi langsung dihapus seketika. |
| `THR-019` | Exploit parser berkas Office / PDF RCE | `CTRL-019` | Preventive | Child process `bubblewrap --unshare-net` (`RLIMIT_AS=512 MiB`, timeout 30s); tolak makro, JavaScript, OLE/ActiveX, launch actions, external references. |
| `THR-020` | DoS dekompresi / Zip Bomb / XML Entity Expansion | `CTRL-020` | Preventive | Tolak semua arsip (ZIP/RAR/TAR/GZ); parsing XML aman via `defusedxml`; batasi kedalaman entitas dan alokasi memori bwrap. |
| `THR-021` | Polyglot file (misal PDF berkedok executable) | `CTRL-021` | Preventive | Validasi magic bytes multi-offset, inspeksi header/trailer ketat, tolak berkas yang memiliki struktur biner ganda. |
| `THR-022` | Bypass autentikasi atau Broken Object Level Authorization (BOLA) | `CTRL-022` | Preventive | Verifikasi kepemilikan server-side berbasis `user_id` sesi; query filter wajib menyertakan `user_id`; return 404 pada file bukan milik sendiri. |
| `THR-023` | Cross-tenant ciphertext swap / replay di storage R2 | `CTRL-023` | Preventive | Enkripsi AES-256-GCM envelope 49-byte dengan AAD terikat identitas: `satukit:fileshelf:v1:{user_id}:{item_id}:{content_type}`. |
| `THR-024` | Pencurian kunci enkripsi di host VPS | `CTRL-024` | Preventive | Keyring root-owned (`0400`) di `/etc/satukit/keyring.json`; dipasok via systemd `LoadCredential=`; isolasi proteksi memori Linux. |
| `THR-025` | Resource exhaustion / bandwidth exhaustion via download massal | `CTRL-025` | Preventive | Maksimal 1 download aktif per akun; kuota lease download global maksimal 2 secara bersamaan; rate limit rolling 30 download/jam. |
| `THR-026` | Flooding upload & pembengkakan storage R2 | `CTRL-026` | Preventive | Maksimal 5 slot per akun (available + in-flight), max 1 in-flight upload, max 25 MB/file, rolling rate limit 10 upload/jam. |
| `THR-027` | Tagihan tak terkendali / lonjakan Class A/B R2 | `CTRL-027` | Detective & Responsive | Polling Cloudflare GraphQL usage tiap 15m; fail-closed jika data >30m; hard ceiling 7 GB; alert Class A 700k/B 7M; blok upload pada Class A 800k dan blok download pada Class B 8M. |
| `THR-028` | Kebocoran data lokasi sensitif EXIF/GPS | `CTRL-028` | Preventive & Compensating | Pelestarian byte asli gambar statis diimbangi kewajiban persetujuan checkbox peringatan UI sebelum upload (`RISK-SEC-014`). |
| `THR-029` | File mentah tertinggal di direktori karantina lokal | `CTRL-029` | Preventive & Responsive | Karantina permission `0600`; pembersihan otomatis pasca-enkripsi atau saat reject; sweeper orphan background tiap 15 menit. |
| `THR-030` | Akumulasi berkas lama melebihi masa retensi | `CTRL-030` | Preventive | Sweeper otomatis membersihkan berkas yang berusia >30 hari sejak `available_at`; job penghapusan asinkron R2 diselesaikan <24 jam. |
| `THR-031` | Berkas terenkripsi/terproteksi password menyembunyikan malware | `CTRL-031` | Preventive | Tolak seluruh berkas PDF/Office yang terproteksi password atau terenkripsi menggunakan `msoffcrypto-tool` dan PyMuPDF metadata check. |

## 4. Remediation SLA & Quality Gates
- **Critical Vulnerability:** Perbaikan dan patch dalam ≤ 24 jam.
- **High Vulnerability:** Perbaikan dalam ≤ 7 hari.
- **Medium / Low:** Perbaikan terencana sebelum rilis berikutnya atau risk acceptance formal dengan approver dan expiry.
- **Zero Open Critical Policy:** Dilarang merilis perangkat lunak jika terdapat temuan Critical terbuka.
- **High Finding Policy:** High finding/residual risk harus memiliki owner, compensating control, target, approver, dan expiry sebelum release berikutnya.

## 5. Rencana dan Tooling Pengujian Keamanan
1. **Secret Scanning:** `backend/.venv/bin/python scripts/scan_secrets.py`; hasil terakhir 2026-10-21: 0 secret pada 125 file.
2. **Software Composition Analysis (SCA):** `npm --prefix frontend audit` dan `pip-audit` (environment eksternal). Tidak ada pipeline CI/CD otomatis.
3. **Static Application Security Testing (SAST):** Ruff untuk Python, Oxlint dan TypeScript compiler untuk frontend. Bandit, Semgrep, dan Biome tidak terpasang/terkonfigurasi.
4. **Dynamic API & Regression Testing:** Pytest negative tests untuk origin, session, CSRF, magic bytes, dan endpoint mutasi. Belum ada DAST khusus.
5. **Container/IaC Scanning:** Tidak berlaku — tidak ada container atau infrastructure-as-code di repository.

## 6. Status Eksekusi Audit Keamanan (TASK-8.2 dan Hotfix)
- **Status Gate Keamanan:** APPROVED (2026-10-21). Status ini historis dan tidak diubah oleh revisi dokumentasi 2026-10-24.
- **Laporan Lengkap:** `docs/project/security/SECURITY-SCAN-REPORT.md` (snapshot 2026-10-21).
- **Hasil Pemindaian Historis:**
  - SCA npm: 0 kerentanan (`npm audit` PASS).
  - SCA pip: 0 kerentanan (`pip-audit` PASS pasca upgrade pip ke 26.2.2).
  - Secret Scan: 0 credential/key di working tree (125 file lulus `scripts/scan_secrets.py`).
  - SAST: Ruff PASS, Oxlint PASS, TypeScript typecheck PASS.
- **Regression Keamanan Terbaru:**
  - `test_security.py` saat ini memiliki 8 test fungsi; hotfix autentikasi 2026-10-21 mencatat 8/8 PASS.
  - Verifikasi `FEATURE-CV-MULTI-WEBSITE-001` 2026-10-24 mencatat 121/121 Pytest PASS (mencakup suite keamanan).
  - Laporan scan 7/7 adalah snapshot lebih awal dengan nama test yang sudah berubah; jangan memakai angka 7/7 sebagai bukti suite saat ini.
- **Residual Risk:** LOW untuk kontrol yang terverifikasi; MEDIUM provisional untuk `RISK-SEC-001` (mitigasi terimplementasi, menunggu approval penutupan); LOW provisional untuk `RISK-SEC-002` (mitigasi terimplementasi, menunggu approval penutupan); HIGH provisional untuk `RISK-SEC-003` s/d `RISK-SEC-006`.
- **Catatan:** Open risk di bawah belum merupakan risk acceptance. Owner review diperlukan sebelum status gate/risk register difinalkan. Sesuai kebijakan High finding, release berikutnya tidak boleh disetujui sampai `RISK-SEC-003` dimitigasi atau diterima secara formal dengan approver dan expiry.

### 6.1 Audit Trail Lokal (2026-10-27)
- **Implementasi:** `backend/app/core/audit.py` menulis event JSONL append-only ke `backend/logs/audit-YYYY-MM-DD.jsonl`; `SecurityMiddleware` mencatat penolakan Origin/session/CSRF, error API, dan request `/api/*` yang diizinkan.
- **Field aman:** `timestamp`, `event`, `outcome`, `request_id`, `method`, `route`, `status`, `reason`/`error_type`, dan `duration_ms`. Body, header, cookie, query string, nama berkas, token, dan PII tidak dicatat.
- **Proteksi berkas:** direktori `0700`, berkas `0600`, rotasi harian UTC, retensi 7 hari; berkas di luar pola `audit-YYYY-MM-DD.jsonl` tidak disentuh saat prune.
- **Fail-open:** kegagalan tulis tidak menggagalkan request; hanya tipe error yang ditulis ke stderr tanpa path atau payload.
- **Bukti:** `backend/tests/test_audit.py` 10 test (permission, retensi, penulisan paralel, kegagalan tulis, denial Origin/session/CSRF, request sukses, pengecualian health, dan pemeriksaan kebocoran query/credential); full suite 136/136 Pytest PASS, Ruff PASS, secret scan 180 file 0 temuan.
- **Batas:** log bukan tamper-evident terhadap pengguna OS yang sama, belum ada batas ukuran harian, dan penulisan dilakukan sinkron di event loop. `RISK-SEC-001` tetap **OPEN** sampai owner menyetujui penutupan berdasarkan bukti retest ini.

## 7. Kontrol Keamanan Fitur Protect & Unlock PDF
1. **Enkripsi Standar Industri:** Menggunakan native PyMuPDF AES-256 (`PDF_ENCRYPT_AES_256`) dengan hak akses penuh (`permissions=4095`) dan pembersihan struktur berkas (`garbage=4, clean=True, use_objstms=1`).
2. **Penegakan Kompleksitas Password:**
   - Panjang minimum 12 karakter dan maksimum 40 byte UTF-8 (sesuai batasan engine PyMuPDF AES-256).
   - Memuat minimal 1 huruf besar (A-Z), 1 huruf kecil (a-z), 1 angka (0-9), dan 1 simbol khusus.
   - Konfirmasi password wajib cocok sebelum tombol enkripsi diizinkan aktif di UI dan diverifikasi ketat di backend (`validate_protect_password`).
3. **Proteksi Integritas Tanda Tangan Digital:**
   - Pemeriksaan sertifikat/tanda tangan digital (`has_digital_signature`) secara fail-closed pada kedua mode.
   - Jika berkas memuat tanda tangan digital, proses proteksi atau buka proteksi langsung dibatalkan (HTTP 422) untuk mencegah perusakan status keabsahan tanda tangan kriptografis.
4. **Pencegahan Kebocoran Kredensial:**
   - Password hanya berada di memori sesaat (in-memory) selama pemrosesan request HTTP POST lokal.
   - Password tidak pernah ditulis ke disk, tidak disimpan di IndexedDB/database, dan dilarang dicatat ke dalam file log sistem backend.
   - Fitur tidak melakukan transmisi ke jaringan luar. Namun egress block subprocess belum tersedia di level OS; klaim “offline” adalah desain fitur, bukan jaminan isolasi jaringan (`RISK-SEC-003`).

## 8. Kontrol Keamanan Fitur Repair PDF & OCR PDF
1. **Sanitasi Biner pada Pemulihan Berkas Rusak (Repair):**
   - Penolakan berkas korup tanpa objek visual dengan fail-closed exception agar tidak memicu memory exhaustion.
   - Pembersihan objek terlantar via `garbage=4, clean=True` dan penataan ulang struktur xref.
   - Penolakan berkas terenkripsi password pada alur perbaikan untuk mencegah bypass kata sandi.
2. **Isolasi Pemrosesan OCR Lokal:**
   - Deteksi Tesseract berbasis path lokal aman tanpa mengunduh binary tidak terverifikasi secara runtime.
   - Proses OCR berjalan murni di lingkungan host lokal tanpa mengirim citra pindaian dokumen ke API pihak ketiga atau cloud AI.
   - Pembersihan dokumen perantara di memori sesaat dengan pembebasan objek doc otomatis (`finally: doc.close()`).

## 9. Kontrol Keamanan Fitur Watermark PDF & Page Numbers PDF
1. **Perlindungan Dokumen Terenkripsi:**
   - Penolakan berkas berpassword secara fail-closed pada watermark dan penomoran halaman untuk mencegah manipulasi dokumen berhak cipta/berproteksi tanpa otorisasi sah.
2. **Sanitasi Gambar & Teks Watermark:**
   - Validasi format dan ukuran gambar watermark (maksimal 10 MB, hanya PNG/JPG) dengan isolasi konversi Pillow RGBA di memori sesaat.
   - Sanitasi teks watermark dan pembatasan panjang teks serta ukuran font aman (8–120 pt) untuk mencegah buffer overflow atau Denial-of-Service.
   - Seluruh proses berjalan di memori lokal tanpa penulisan berkas watermark atau citra masukan ke disk permanen.

## 10. Kontrol Keamanan Fitur PDF to Markdown
1. **Isolasi Ekstraksi Teks Offline:**
   - Ekstraksi dijalankan 100% lokal via library `pymupdf4llm` tanpa menghubungi model API AI eksternal atau layanan pihak ketiga.
2. **Penolakan Dokumen Terproteksi:**
   - Berkas PDF berpassword ditolak secara fail-closed informatif sebelum didekode untuk mencegah bypass enkripsi dokumen.
3. **Penyajian Konten Aman:**
   - Output sintaks Markdown disajikan murni sebagai teks mentah (`text/markdown; charset=utf-8`) dengan isolasi pratinjau teks pre-formatted di frontend tanpa eksekusi skrip HTML aktif.

## 11. Kontrol Keamanan Peningkatan CV Builder (2026-10-24)

- **Batas Kepercayaan:** Peningkatan pagination, preflight, headline, pencapaian, reorder, CV target, impor selektif, dan manajemen draft tidak menambah endpoint atau transmisi jaringan baru. Data tetap berada pada draft IndexedDB lokal dan request ekspor yang sudah ada.
- **Sanitasi Nama Berkas:** Nama berkas dibersihkan dari control character, path separator, dan karakter tidak valid di frontend serta backend sebelum dipakai pada `Content-Disposition`. Ekstensi duplikat dilepas dan nama kosong memakai fallback aman.
- **Fail-Closed Preflight:** Error kualitas CV memblokir ekspor. Warning hanya dapat dilewati setelah acknowledgment eksplisit; modal tidak mengubah konten secara otomatis.
- **Integritas Draft:** CV target dibuat sebagai salinan; draft sumber tidak dimodifikasi. Impor selektif hanya menimpa bagian yang dipilih, dan undo memakai snapshot bagian tersebut. Autosave di-flush sebelum perpindahan draft untuk mencegah kehilangan data.
- **Verifikasi:** 233/233 Vitest, 126/126 Pytest, Ruff PASS, Vite build PASS, Oxlint 0 error (16 warning pre-existing). Tidak ada open Critical/High finding baru dari perubahan ini; `RISK-SEC-003` tetap menjadi blocker release berikutnya.

## 12. Risk Register (Open, Terkini 2026-11-08)

| ID | Risiko | Severity | Bukti | Dampak | Compensating Control | Treatment | Owner | Review Due | Status |
|---|---|---|---|---|---|---|---|---|---|
| `RISK-SEC-001` | Audit/logging keamanan dan retensi 7 hari tidak tersedia sebelum mitigasi | MEDIUM (provisional; mitigasi terimplementasi) | `backend/app/core/audit.py` + `test_audit.py` (10 test PASS); full suite 136/136 Pytest PASS (2026-10-27); Ruff PASS; secret scan 0 temuan | Tanpa audit trail, aksi sensitif tidak dapat dideteksi/diforensik; mitigasi menutup gap utama, tetapi log belum tamper-evident dan belum memiliki batas ukuran harian | Loopback-only, tidak ada akun remote, PII tidak ditulis ke log, akses file mengikuti akun OS | `MITIGATE` — append-only JSONL, `0600`/`0700`, rotasi harian UTC, retensi 7 hari, fail-open; **closure pending owner approval** | User (Owner) | 2026-11-15 | MITIGATED — closure pending owner approval |
| `RISK-SEC-002` | Workspace temp job manager memakai permission default `0775`, bukan `0700`, dan periodic sweeper belum tersedia | LOW (provisional; mitigasi terimplementasi) | `backend/app/core/disk_guard.py` + `job_manager.py` (mode `0o700`, `BackgroundSweeper` daemon interval 300s / TTL 3600s, fail-closed disk guard 80%); `test_job_manager.py` (8 test PASS), `test_disk_guard.py` (4 test PASS), `test_health.py` (1 test PASS); total suite 152/152 Pytest PASS, Ruff check clean | Pada mesin multi-user, pengguna lokal lain berpotensi membaca sisa file temp; workspace kedaluwarsa dapat tertahan sampai startup berikutnya | UUID workspace, per-job cleanup, startup sweep, batas TTL 1 jam (tamu), akun OS pengguna | `MITIGATE` — set `0700` saat pembuatan workspace dan jalankan periodic sweep di Phase 10; **closure pending owner approval** | User (Owner) | 2026-11-15 | MITIGATED — closure pending owner approval |
| `RISK-SEC-003` | Sandbox isolation tidak sekuat klaim: egress hanya proxy environment; tidak ada network namespace/firewall; Linux belum memiliki memory cap | HIGH (provisional) | `backend/app/core/sandbox.py` hanya menyetel `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` dan `DOCBUILDER_SANDBOX_NETWORK_BLOCKED`; tidak ada `unshare`, `bwrap`, `seccomp`, atau aturan firewall; `max_memory_mb` hanya dipakai Windows Job Object; spike egress bergantung pada env proxy | Parser exploit dapat membuka koneksi langsung dan mengeksfiltrasi PII; resource exhaustion di Linux tidak dibatasi memori | Hak pengguna biasa, timeout 5 menit, sanitasi env, workspace UUID, satu job aktif, tidak ada cloud credential di env | `MITIGATE` — non-root service di VPS, timeout ketat, memory cap per subprocess; verifikasi batas di Phase 10 | User (Owner) | 2026-11-15 | OPEN — scheduled for Phase 10 |
| `RISK-SEC-004` | Potensi DoS CPU & RAM akibat inferensi ML U2NetP pada VPS 1 vCPU / 2.2 GiB RAM | HIGH (provisional) | VPS memiliki 1 vCPU Xeon dan 2.2 GiB RAM fisik; inferensi ML simultan dapat memicu thrashing swap atau OOM killer | Server unresponsive, web service down, proses lain terhenti mendadak | `MITIGATE` — Concurrency worker = 1, antrean tunggu max 2, penolakan 429/503 + `Retry-After: 30`, timeout keras 30 detik, penghentian subprocess pasca-inferensi untuk membebaskan RAM, fail-closed disk guard 80% | `MITIGATE` — diuji melalui feasibility spike di Phase 10 | User (Owner) | 2026-11-15 | OPEN — scheduled for Phase 10 |
| `RISK-SEC-005` | Risiko SSRF atau eksploitasi open redirect pada layanan URL Shortener publik | HIGH (provisional) | Layanan memendekkan URL publik dan mengalihkan pengunjung via HTTP 302 | Penyerang menggunakan pemendek URL untuk menjangkau endpoint internal, IP link-local metadata cloud, atau melancarkan kampanye phishing | `MITIGATE` — Validasi skema wajib `https:`, penolakan kredensial dalam URL, penolakan IP internal RFC 1918, loopback, link-local, dan reserved; API pembuatan link khusus owner via HMAC auth & Cloudflare Access | `MITIGATE` — diimplementasikan dan diuji di Phase 12 | User (Owner) | 2026-11-15 | OPEN — scheduled for Phase 12 |
| `RISK-SEC-006` | Risiko Account Takeover pada multi-login (Email/Password & Google OAuth) via auto-merge | HIGH (provisional) | Pengguna mendaftar dengan email/password, lalu penyerang mencoba masuk via Google OAuth dengan email yang sama | Pengambilalihan akses ke draf CV sensitif jika sistem menggabungkan akun secara otomatis tanpa verifikasi | `MITIGATE` — Kebijakan ketat dilarang auto-merge secara diam-diam; linking akun wajib dilakukan melalui otorisasi sadar di pengaturan akun dengan re-authentication kredensial lama | `MITIGATE` — diimplementasikan dan diuji di Phase 11 | User (Owner) | 2026-11-15 | OPEN — scheduled for Phase 11 |
| `RISK-SEC-007` | Akumulasi data PII CV pengguna melebihi masa aktif atau terpapar pada cadangan | MEDIUM (provisional) | Pengguna menyimpan draf CV di server VPS; kebocoran atau penumpukan data tak terkelola melanggar prinsip privasi | Eksposur PII riwayat hidup dan identitas pelamar; pelanggaran regulasi perlindungan data pribadi (UU PDP) | `MITIGATE` — Kuota maks 5 CV per akun, retensi 30 hari sejak pembaruan terakhir, penghapusan harian otomatis, cadangan ke Cloudflare R2 dienkripsi AES-256-GCM di VPS dengan lifecycle deletion 7 hari, fitur hapus akun mandiri instan | `MITIGATE` — diimplementasikan di Phase 11 & 13 | User (Owner) | 2026-11-15 | OPEN — scheduled for Phase 11 & 13 |
| `RISK-SEC-008` | DoS & Memory Exhaustion akibat pemrosesan file berat di VPS 2.2 GiB | HIGH | Unggahan berkas format Office/PDF kompleks berpotensi memicu lonjakan RAM dan CPU | Host VPS kehabisan memori (OOM), service web utama terganggu | `MITIGATE` — Isolasi parser di child process `bubblewrap --unshare-net` dengan `RLIMIT_AS=512 MiB` dan hard timeout 30s; worker terpisah `satukit-file-worker` | `MITIGATE` — Diuji pada FS-01 & diimplementasikan FS-05 | User (Owner) | 2027-02-11 | OPEN — FS-01 & FS-05 |
| `RISK-SEC-009` | Malware lolos akibat daemon ClamAV tidak aktif atau signature usang | HIGH | ClamAV crash atau koneksi socket Unix terputus atau freshclam gagal update >24 jam | Berkas malware tersimpan di storage dan berpotensi terunduh kembali | `MITIGATE` — Mandatory scan via Unix socket `/run/clamav/clamd.ctl`; fail-closed jika daemon mati atau signature >24 jam; fallback wajib upgrade RAM VPS jika host 2.2 GiB tidak aman | `MITIGATE` — Diuji pada FS-01 & diimplementasikan FS-05 | User (Owner) | 2027-02-11 | OPEN — FS-01 & FS-05 |
| `RISK-SEC-010` | Broken Object-Level Authorization (BOLA) pada unduh dan hapus file | HIGH | Pengguna memanipulasi parameter `item_id` untuk mengakses atau menghapus berkas pengguna lain | Pelanggaran kerahasiaan data privat dan perusakan berkas antar akun | `MITIGATE` — Query filter server-side wajib menyertakan `user_id` dari sesi aktif; return HTTP 404 (bukan 403) untuk mencegah enumerasi ID | `MITIGATE` — Diimplementasikan pada FS-06 | User (Owner) | 2027-02-11 | OPEN — FS-06 |
| `RISK-SEC-011` | Cross-tenant cipher swap / replay attack pada penyimpanan R2 privat | HIGH | Ciphertext dari akun A dipindahkan atau disuntikkan ke metadata akun B | Pengguna dapat membaca berkas tanpa otorisasi atau merusak integritas | `MITIGATE` — Enkripsi AES-256-GCM dengan AAD kanonikal mengikat `user_id`, `item_id`, dan `content_type`; dekripsi gagal jika identitas tidak cocok | `MITIGATE` — Diimplementasikan pada FS-04 | User (Owner) | 2027-02-11 | OPEN — FS-04 |
| `RISK-SEC-012` | Kunci enkripsi keyring bocor di environment host VPS | HIGH | Proses tidak berwenang membaca environment variable atau file konfigurasi | Penyerang dengan akses parsial host dapat mendekripsi berkas di R2 | `MITIGATE` — Keyring disimpan di `/etc/satukit/keyring.json` (root `0400`); disalurkan ke service via systemd `LoadCredential=`; dilarang ditulis ke env var biasa | `MITIGATE` — Diimplementasikan pada FS-02 | User (Owner) | 2027-02-11 | OPEN — FS-02 |
| `RISK-SEC-013` | Lonjakan biaya atau DoS kuota operasi Cloudflare R2 | MEDIUM | Pemanggilan API R2 tanpa batas atau kuota storage membengkak | Biaya tak terduga atau akun Cloudflare terkena penalti kuota | `MITIGATE` — Polling GraphQL usage tiap 15m; fail-closed jika data >30m; hard ceiling 7 GB; alert Class A 700k/B 7M; blok upload pada Class A 800k dan blok download pada Class B 8M di bulan kalender UTC | `MITIGATE` — Diimplementasikan pada FS-07 | User (Owner) | 2027-02-11 | OPEN — FS-07 |
| `RISK-SEC-014` | Retensi metadata sensitif (EXIF/GPS) pada gambar statis | MEDIUM | Unggahan foto kamera menyimpan koordinat lokasi rumah/tempat privat pengguna | Risiko privasi jika pengguna mengunduh atau berbagi berkas asli | `ACCEPT` — Diterima secara formal oleh Owner sampai 2027-02-11 dengan compensating control kewajiban checkbox persetujuan pengguna di UI sebelum upload | User (Owner) | 2027-02-11 | ACCEPTED (Formal Owner Approval) |
| `RISK-SEC-015` | Saturasi bandwidth dan starvation koneksi pada unduhan besar simultan | MEDIUM | Beberapa pengguna mengunduh berkas 25 MB secara bersamaan | Latensi server meningkat drastis, starvation koneksi API | `MITIGATE` — Batas 1 download aktif per akun, batas 2 lease download global di seluruh sistem, rate limit rolling 30 download/jam | `MITIGATE` — Diimplementasikan pada FS-03 & FS-06 | User (Owner) | 2027-02-11 | OPEN — FS-03 & FS-06 |
| `RISK-SEC-016` | Berkas mentah tertinggal di folder karantina jika worker crash | MEDIUM | Worker mengalami panic/OOM sebelum membersihkan berkas di folder karantina | Akumulasi berkas tidak terenkripsi di disk lokal | `MITIGATE` — Karantina mode `0600`; cleanup saat startup worker dan daemon periodic orphan sweeper tiap 15 menit untuk berkas >1 jam | `MITIGATE` — Diimplementasikan pada FS-05 & FS-07 | User (Owner) | 2027-02-11 | OPEN — FS-05 & FS-07 |

**Aturan:** `RISK-SEC-001` s/d `RISK-SEC-016` wajib ditangani secara bertahap sesuai fase implementasinya. Tidak ada deployment rilis online yang diizinkan sebelum seluruh mitigasi diverifikasi.

## 13. Catatan Konsistensi Dokumentasi
- Revisi 2026-11-08: Penambahan model ancaman komprehensif, evaluasi cross-cutting, dan mitigasi risiko `RISK-SEC-004` s/d `RISK-SEC-007` untuk arsitektur hybrid VPS online dan serverless Cloudflare Workers + D1.
- Revisi 2026-10-27 mencatat implementasi audit trail JSONL lokal dan bukti 10 test `test_audit.py`; status `RISK-SEC-001` berubah menjadi MITIGATED dengan penutupan menunggu approval owner. Status gate dan tiga open risk lain tidak berubah.
- Revisi 2026-10-24 mengoreksi klaim `SameSite=Strict` menjadi `SameSite=Lax` (lihat `DEC-013`), referensi engine PDF menjadi `DEC-012`, dan klaim CI/CD/Playwright/logging yang tidak didukung kode.

## 14. Checklist Security Planning Gate (Gerbang 2 Online)
```markdown
### Governance
- [x] Security risk tier HIGH dan alasan disetujui (memproses biner tidak tepercaya, data pribadi PII pelamar, inferensi ML di VPS, dan otentikasi online)
- [x] Security owner, data owner, operator, dan approval authority ditentukan (User / Owner)
- [x] Regulasi perlindungan data pribadi (UU PDP Indonesia) diidentifikasi
- [x] Residual risk memiliki owner teridentifikasi (User / Owner)

### Asset, Data, dan Exposure
- [x] Aset kritis, data PII CV, trust boundary, dan attack surface dipetakan
- [x] Data classification, retensi 30 hari, kuota max 5 CV, kuota global 5 GB, pembersihan file anonim max 1 jam, dan backup terenkripsi R2 7 hari ditentukan
- [x] Eksposur publik dibatasi: reverse proxy Caddy (port 80/443), backend terikat ke 127.0.0.1, portal shortener dilindungi Cloudflare Access

### Identity dan Access
- [x] Otentikasi Email/Password (Argon2id/bcrypt) dan Google OAuth dirancang
- [x] Kebijakan anti-auto-merge (mencegah account takeover) ditegakkan
- [x] Default deny dan pemeriksaan kepemilikan CV (user_id ownership check) dirancang

### Threat Coverage (12 Kategori Dievaluasi)
- [x] Reconnaissance: Caddy TLS + Cloudflare proxy, hilangkan banner versi (APPLICABLE)
- [x] Scanning & Enumeration: UUID workspace, anti-user enumeration pada login/reset (APPLICABLE)
- [x] Vulnerability Assessment: Lockfile pinning, scan dependensi pip/npm/trivy (APPLICABLE)
- [x] Exploitation: Validasi magic bytes, batas ukuran berkas, sandbox isolasi subprocess (APPLICABLE)
- [x] Password Attacks: Argon2id hashing, rate limiting per IP & akun, single-use reset token TTL 15m (APPLICABLE)
- [x] Social Engineering: Transaksional email via Brevo dengan SPF/DKIM/DMARC (APPLICABLE)
- [x] Web/Application/API: Cookie HttpOnly Secure SameSite=Lax, CSRF token, Anti-SSRF pada URL Shortener, HMAC auth (APPLICABLE)
- [x] Privilege Escalation: Non-root VPS execution, strict object-level authorization (APPLICABLE)
- [x] Lateral Movement: Isolasi workspace direktori, subprocess non-root (APPLICABLE)
- [x] Persistence: Per-job cleanup, daily retention cleaner, disk fail-closed guard (APPLICABLE)
- [x] Defense Evasion: Append-only audit log JSONL 0600/0700, rotasi harian (APPLICABLE)
- [x] Exfiltration: Kuota data ketat, enkripsi AES-256-GCM cadangan R2, hapus akun mandiri permanen (APPLICABLE)

### Prevention, Detection, Response, dan Recovery
- [x] Kontrol pencegahan dan kompensasi dipetakan lengkap (RISK-SEC-001 s/d RISK-SEC-007)
- [x] Logging audit, rotasi 7 hari, dan error envelope aman dirancang
- [x] Prosedur pemulihan bencana (disaster recovery) via R2 snapshot terenkripsi dirancang

### Verification
- [x] Secret scanning, dependency audit, linter/typecheck, dan negative testing dirancang untuk setiap fase
- [x] Uji isolasi ML worker, benchmark latensi/RAM U2NetP, dan SSRF validation suite dirancang
```

### 14.1 Checklist Security Planning Gate — Fitur Rak Berkas (Gerbang 2 Disetujui 2026-11-11)
```markdown
### Governance & Ownership
- [x] Security risk tier HIGH dan alasan disetujui (eksposur file biner eksternal, parsing multi-format di VPS, enkripsi cloud storage)
- [x] Security owner & data owner: User (Owner)
- [x] Approval Gerbang 2 diberikan oleh User (Owner) pada 2026-11-11
- [x] Residual risk RISK-SEC-014 (EXIF/GPS metadata) diterima secara formal oleh Owner sampai 2027-02-11 dengan syarat checkbox persetujuan wajib di UI

### Asset, Data, dan Exposure
- [x] Aset kritis: Berkas privat pengguna, kunci enkripsi AES-256-GCM, kredensial Cloudflare R2
- [x] Retensi 30 hari otomatis, batas 5 slot per akun, batas 25 MB per file
- [x] Jalur unggah menggunakan raw stream octet-stream (bukan multipart form), metadata di header base64url

### Threat Coverage & Isolation
- [x] Antivirus ClamAV via daemon Unix socket /run/clamav/clamd.ctl (INSTREAM); port TCP dilarang; fail-closed jika signature >24h
- [x] Isolasi parser: child process bubblewrap --unshare-net, RLIMIT_AS=512 MiB, timeout 30s
- [x] Tolak makro VBA, JavaScript, OLE/ActiveX, launch actions, external references, polyglot, arsip, file terenkripsi
- [x] Enkripsi AES-256-GCM envelope 49-byte dengan AAD terikat identitas (user_id + item_id + content_type)
- [x] Keyring root-owned 0400 disalurkan via systemd LoadCredential=
- [x] Batasan unduh: max 1 aktif per user, max 2 lease download global; rate limit rolling hour
- [x] Pemantauan Cloudflare R2 via GraphQL tiap 15m; fail-closed jika data >30m; hard ceiling 7 GB
```
