# Security Architecture & Threat Model (SECURITY.md)

## 1. Metadata & Governance
- **Security Risk Tier:** HIGH (karena memproses berkas biner tidak tepercaya, data pribadi PII pelamar kerja, otentikasi multi-user online publik, dan inferensi ML lokal di VPS).
- **Security Owner:** User (Owner Proyek)
- **Data Owner:** User (Owner Proyek)
- **Approval Authority:** User (Owner Proyek)
- **Tanggal Evaluasi Awal:** 2026-10-20
- **Revisi Dokumentasi:** 2026-10-24 — koreksi kontrol dan risk register; 2026-10-27 — implementasi audit trail JSONL; 2026-11-08 — Ekspansi model ancaman komprehensif untuk transformasi online VPS multi-user: otentikasi Email/Password & Google OAuth, pencegahan account takeover, pembatasan kuota CV 30 hari, backup terenkripsi Cloudflare R2 (7 hari), isolasi ML worker U2NetP (concurrency 1, antrean max 2, timeout 30s), anti-SSRF pada URL Shortener Cloudflare Workers + D1, dan disk fail-closed; 2026-11-11 — Penutupan entry point publik Google Auth dan Shortener Management (AUTH-ACCESS-001, DEC-023); 2026-11-12 — Verifikasi lengkap `CR-020` Hapus Watermark (`RW-01` s/d `RW-06`, `THR-032` s/d `036`, `RISK-SEC-017` s/d `020` berstatus MITIGATED pending owner closure approval) dan persetujuan Gerbang 2 `CR-021` Compress Video (`THR-037` s/d `042`, `RISK-SEC-021` s/d `024`); 2026-11-13 — Evaluasi model ancaman & kontrol `CR-022` MP4 ke MP3 (`THR-043` s/d `045`, `RISK-SEC-025` s/d `027`); 2026-11-13 — Evaluasi model ancaman & kontrol `CR-023` Video ke Teks (`THR-046` s/d `048`, `RISK-SEC-028` s/d `030`).
- **Status Gate:** APPROVED (Gerbang 2 Video ke Teks disetujui untuk implementasi; rilis produksi tetap diblokir oleh prasyarat benchmark VPS staging `RISK-SEC-023` / `Q-007`).
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

### 3.3 Model Ancaman & Kontrol Hapus Watermark (`CR-020`)
| Threat ID | Skenario Ancaman | Kontrol Terkait | Tipe Kontrol | Mitigasi / Penanganan |
|---|---|---|---|---|
| `THR-032` | DoS CPU/RAM via pixel bomb, payload stroke mask berlebihan, atau analisis PDF berhalaman masif | `CTRL-032` | Preventive | Validasi `MAX_PIXELS`, batas upload 25 MB, analisis interaktif PDF maks 50 halaman, batas stroke/titik manifest ternormalisasi `0..1`, serta antrean tunggal `ConversionJobManager` (`concurrency = 1`). |
| `THR-033` | Perusakan integritas PDF bertanda tangan digital, bypass PDF terenkripsi, atau manipulasi `xref` lintas berkas | `CTRL-033` | Preventive | Penolakan fail-closed PDF terenkripsi & `has_digital_signature`; pengikatan manifest pada `file_sha256` berkas aktif dan validasi `xref` milik halaman/annotation sah. |
| `THR-034` | Penyalahgunaan hak cipta atau penghapusan cap air dokumen pihak ketiga tanpa otorisasi | `CTRL-034` | Preventive & Detective | Akses wajib login (sesi + CSRF + verifikasi email di prod), konfirmasi eksplisit kepemilikan/izin di UI & API (`owner_confirmed`), serta audit event JSONL tanpa menyimpan nama file atau payload dokumen (`RISK-SEC-017`). |
| `THR-035` | Kebocoran metadata lokasi/perangkat EXIF/GPS pada gambar JPG/PNG hasil unduhan | `CTRL-035` | Preventive | Re-encode output raster bersih tanpa menyalin blok EXIF/GPS asli secara default (`RISK-SEC-018`). |
| `THR-036` | Penghapusan isi sah dokumen atau hilangnya teks selectable PDF secara tidak sengaja | `CTRL-036` | Preventive | Tidak ada auto-apply; kandidat wajib dipilih per halaman dengan koreksi mask manual, review before/after sebelum unduh, dan konfirmasi eksplisit sebelum meraster halaman PDF terpilih (`RISK-SEC-019`, `RISK-SEC-020`). |

### 3.4 Model Ancaman & Kontrol Compress Video (`CR-021`)
| Threat ID | Skenario Ancaman | Kontrol Terkait | Tipe Kontrol | Mitigasi / Penanganan |
|---|---|---|---|---|
| `THR-037` | Memory exhaustion / OOM VPS 2.2 GiB akibat buffering payload video 250 MB atau full-read ClamAV | `CTRL-037` | Preventive | Upload streaming chunk `request.stream()` langsung ke disk `0600` (tanpa `request.body()`), ClamAV streaming `INSTREAM` 64 KiB, batas `250.000.000` byte, dan workspace global cap `1.25 GiB` (`RISK-SEC-021`). |
| `THR-038` | Eksploitasi parser/demuxer `ffprobe`/`ffmpeg` atau eksekusi payload malware via berkas video korup/polyglot | `CTRL-038` | Preventive | Scan ClamAV fail-closed wajib sebelum `ffprobe` (signature ≤ 24h), validasi ketat allowlist container/codec MP4/MOV/WebM, batas ≤ 600s/4K/60 FPS, dan isolasi `bubblewrap --unshare-net --die-with-parent` di Linux (`RISK-SEC-022`). |
| `THR-039` | DoS CPU, proses zombie `ffmpeg`, atau exhaustion disk akibat antrean/transcoding video berat | `CTRL-039` | Preventive & Responsive | Worker systemd terpisah `satukit-video-worker`, koordinasi PostgreSQL (`1 running + 2 queued`), rate limit 3 job/jam per akun & per IP, `-threads 1`, process-group kill (`SIGTERM`->`SIGKILL`), hard timeout 45 menit, startup recovery, & sweeper TTL 15 menit (`RISK-SEC-023`, `RISK-SEC-024`). |
| `THR-040` | Broken Object-Level Authorization (BOLA), replay download, atau bypass login pada kategori `convert` | `CTRL-040` | Preventive | Wajib sesi terautentikasi + email terverifikasi (prod) + Origin/CSRF guard, guard login eksplisit di `App.tsx` (tidak ikut bypass `category === 'convert'`), filter `user_id` (HTTP 404 anti-enumerasi), dan transisi atomik sekali unduh `succeeded -> claimed` (`RISK-SEC-022`). |
| `THR-041` | Kebocoran metadata lokasi/perangkat (EXIF/GPS/chapter/creator tag) atau nama berkas/PII di audit log | `CTRL-041` | Preventive & Detective | Flag `ffmpeg -map_metadata -1 -map_chapters -1` pada semua output, sanitasi filename (`os.path.basename` + fallback `Content-Disposition`), dan pencatatan audit JSONL non-PII tanpa nama berkas (`RISK-SEC-024`). |
| `THR-042` | Regresi pelonggaran batas payload global 35 MB atau ketiadaan worker/`ffmpeg` yang tidak terdeteksi | `CTRL-042` | Preventive & Detective | Override matcher Caddy khusus `POST /api/video-compressions` (~260 MB) sambil mempertahankan batas global 35 MB, serta telemetry kesiapan `ffmpeg`/`ffprobe` & heartbeat worker di `/api/health` tanpa mengekspos path internal (`RISK-SEC-023`). |

### 3.5 Model Ancaman & Kontrol MP4 ke MP3 (`CR-022`)
| Threat ID | Skenario Ancaman | Kontrol Terkait | Tipe Kontrol | Mitigasi / Penanganan |
|---|---|---|---|---|
| `THR-043` | Parser/demuxer abuse atau malformed MP4 container attack saat ekstraksi stream audio via `ffprobe`/`ffmpeg` | `CTRL-043` | Preventive | Scan ClamAV streaming fail-closed sebelum probe, validasi ekstensi ketat `.mp4` & format token MP4, sandboxing `bubblewrap --unshare-net` di Linux (`RISK-SEC-025`). |
| `THR-044` | Pelanggaran hak cipta audio atau ekstraksi materi terlindungi hak cipta tanpa otorisasi | `CTRL-044` | Preventive & Detective | Otentikasi wajib, checkbox konfirmasi hak kepemilikan/izin audio eksplisit sebelum upload, audit log JSONL kepatuhan non-PII (`action="mp4_to_mp3_requested"`, `action="mp4_to_mp3_downloaded"`) (`RISK-SEC-026`). |
| `THR-045` | DoS pemrosesan atau worker crash akibat berkas MP4 bisu (tanpa stream audio), audio corrupt, atau channel berlebih (> 2 channel) | `CTRL-045` | Preventive | Probe audio fail-closed menolak video tanpa audio dengan `NO_AUDIO_STREAM` sebelum masuk antrean encoding, pemilihan track default / 0:a:0 eksplisit, auto-downmix channel >2 menjadi stereo (`-ac 2`), timeout 10 menit (600s), dan pembersihan workspace (`RISK-SEC-027`). |

### 3.6 Model Ancaman & Kontrol Video ke Teks (`CR-023`)
| Threat ID | Skenario Ancaman | Kontrol Terkait | Tipe Kontrol | Mitigasi / Penanganan |
|---|---|---|---|---|
| `THR-046` | Exploit buffer overflow / unsafe parsing pada audio WAV atau model AI CTranslate2 oleh crafted audio/video | `CTRL-046` | Preventive | Scan ClamAV streaming fail-closed sebelum probe, sanitasi ekstensi ketat `.mp4`, ekstraksi audio terstandarisasi PCM WAV 16kHz mono, sandboxing `bubblewrap --unshare-net` di Linux, isolasi user non-root (`RISK-SEC-028`). |
| `THR-047` | Resource exhaustion (CPU starvation, memory spike, OOM freeze) pada VPS 1 vCPU / 2.2 GiB RAM oleh model transkripsi | `CTRL-047` | Preventive & Responsive | Kuantisasi model `int8` (RAM ~200-550MB), batas worker tunggal paralel (1 running global + 2 waiting), hard timeout 15 menit (900s), pembatalan per process-group, VAD filtering segmen hening / fail-closed `NO_SPEECH`, prasyarat benchmark staging VPS (`RISK-SEC-028`, `RISK-SEC-030`). |
| `THR-048` | Kebocoran PII percakapan rapat/wawancara rahasia melalui logging, residu workspace, atau insecure ZIP download | `CTRL-048` | Preventive & Detective | Redaksi total isi transkrip dan audio dari seluruh log aplikasi dan audit trail JSONL; data pratinjau `preview.json` bersifat ephemeral di direktori workspace `0700` dan musnah saat diklaim/kedaluwarsa; unduhan ZIP sekali pakai (`succeeded -> claimed`) dengan TTL 15 menit; sanitasi nama berkas dalam ZIP tanpa path traversal (`RISK-SEC-029`). |

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
| `RISK-SEC-017` | Penyalahgunaan fitur Hapus Watermark pada dokumen/foto tanpa izin pemilik hak cipta | MEDIUM | Pengguna mengunggah berkas berhak cipta untuk menghapus watermark | Risiko hukum/reputasi apabila fitur digunakan melanggar izin pemilik dokumen | `MITIGATE` — Wajib login terverifikasi di prod, checkbox konfirmasi hak kepemilikan/izin sebelum proses, out-of-scope batch/bypass proteksi, dan audit JSONL non-PII | `MITIGATE` — Terimplementasi & terverifikasi di `RW-03` s/d `RW-06` (`303/303` Pytest, `392/392` Vitest, `scan_secrets.py` 0 secrets); **closure pending owner approval** | User (Owner) | 2027-02-12 | MITIGATED — verifikasi RW-06 selesai; closure pending owner approval |
| `RISK-SEC-018` | Kebocoran metadata EXIF/GPS atau memori sisa citra pada pemrosesan gambar OpenCV | LOW | Gambar input memuat tag GPS/EXIF atau alokasi buffer besar | Eksposur lokasi pengguna atau akumulasi RAM VPS | `MITIGATE` — Re-encode keluaran JPG/PNG tanpa metadata EXIF, batas piksel `MAX_PIXELS`, pemrosesan in-memory tanpa simpan permanen | `MITIGATE` — Terimplementasi & terverifikasi di `RW-02`/`RW-03` & regresi `RW-06`; **closure pending owner approval** | User (Owner) | 2027-02-12 | MITIGATED — verifikasi RW-06 selesai; closure pending owner approval |
| `RISK-SEC-019` | Ketiadaan engine OCR Tesseract atau false positive deteksi kandidat teks sah | LOW | VPS/host tanpa binary Tesseract atau OCR menandai teks dokumen sah sebagai watermark | Kegagalan deteksi otomatis atau pengguna mengira isi dokumen harus dihapus | `MITIGATE` — OCR opsional (gagal tidak memblokir mode manual), review visual before/after wajib, koreksi mask kuas tambah/hapus | `MITIGATE` — Fallback manual & UI teruji di `RW-01` s/d `RW-06` (catatan: host Windows tanpa Tesseract, OCR diuji via mock `pdfocr_tobytes`); **closure pending owner approval** | User (Owner) | 2027-02-12 | MITIGATED — verifikasi RW-06 selesai; closure pending owner approval |
| `RISK-SEC-020` | Hilangnya teks selectable, vektor, atau tautan halaman PDF akibat rasterisasi inpainting | MEDIUM | Halaman PDF dengan watermark menyatu harus diraster untuk dijalankan `cv2.inpaint` | Pengguna kehilangan kemampuan seleksi teks/vektor pada halaman terdampak | `MITIGATE` — Annotation/stamp dihapus struktural tanpa rasterisasi; halaman non-target tetap asli; dialog peringatan & konfirmasi eksplisit wajib sebelum rasterisasi | `MITIGATE` — Terimplementasi & terverifikasi di `RW-03` s/d `RW-06`; **closure pending owner approval** | User (Owner) | 2027-02-12 | MITIGATED — verifikasi RW-06 selesai; closure pending owner approval |
| `RISK-SEC-021` | Memory exhaustion / OOM VPS 2.2 GiB saat menerima upload video hingga 250 MB atau memindai ClamAV | HIGH | `request.body()` atau `ClamAVScanner.scan_file()` yang memuat seluruh byte ke RAM sekaligus dapat memicu OOM | Proses web utama / worker crash dan melumpuhkan layanan lain di VPS | `MITIGATE` — Upload streaming chunk `request.stream()`, ClamAV streaming `INSTREAM` 64 KiB, batas `250.000.000` B, dan workspace cap global `1.25 GiB` | `MITIGATE` — Dirancang pada `VC-00`, target implementasi & uji `VC-01`–`VC-02` | User (Owner) | 2026-11-26 | PLANNED — VC-01 & VC-02 |
| `RISK-SEC-022` | Eksploitasi parser `ffprobe`/`ffmpeg`, BOLA lintas akun, atau bypass login kategori `convert` | HIGH | Berkas video korup memicu eksploit demuxer, atau `App.tsx` lama melewatkan login pada kategori `convert` | RCE di sandbox, kebocoran video pengguna lain, atau komputasi server oleh pengguna anonim | `MITIGATE` — ClamAV pre-`ffprobe` fail-closed, `bwrap --unshare-net`, `user_id` ownership (404), atomic `succeeded -> claimed`, dan guard login eksplisit di `App.tsx` | `MITIGATE` — Dirancang pada `VC-00`, target implementasi & uji `VC-02`–`VC-05` | User (Owner) | 2026-11-26 | PLANNED — VC-02, VC-03, VC-05 |
| `RISK-SEC-023` | Ketiadaan `ffmpeg`/`ffprobe` di host dev Windows & kebutuhan kalibrasi `StreamMaxLength` ClamAV (>250 MB) + konsumsi RAM FFmpeg di Ubuntu staging | HIGH (release-blocking) | `ffmpeg`/`ffprobe` tidak tersedia di Windows dev host; benchmark aktual ClamAV >250 MB + FFmpeg pada 2.2 GiB RAM belum dieksekusi di Ubuntu staging | Kegagalan penolakan palsu ClamAV atau OOM/thrashing pada skenario produksi 4K/250 MB | `MITIGATE` — Unit/integration suite terisolasi di dev, telemetry `/api/health` untuk `ffmpeg`/`ffprobe` & heartbeat worker, serta **benchmark Ubuntu staging wajib** (`Q-007`) sebelum rilis produksi | `MITIGATE` — Terjadwal sebelum rilis produksi (`Q-007`) | User (Owner) | 2026-11-26 | OPEN (Release-blocking) — Q-007 |
| `RISK-SEC-024` | Akumulasi file video sementara, zombie `ffmpeg`, atau kebocoran metadata lokasi/perangkat pada MP4 hasil | MEDIUM | Crash worker atau timeout encode dapat menyisakan file input/output besar maupun metadata asli | Disk workspace penuh hingga batas 1.25 GiB atau kebocoran metadata pribadi dalam output | `MITIGATE` — Workspace `0700`/`0600`, process-group kill (`SIGTERM`->`SIGKILL`), timeout 45m, `-map_metadata -1 -map_chapters -1`, startup recovery, dan sweeper TTL 15m | `MITIGATE` — Dirancang pada `VC-00`, target implementasi & uji `VC-02`–`VC-03` | User (Owner) | 2026-11-26 | PLANNED — VC-02 & VC-03 |
| `RISK-SEC-025` | Eksploitasi malformed MP4 container / parser abuse pada stream audio via `ffprobe`/`ffmpeg` | HIGH | Berkas MP4 berbahaya memicu celah pada demuxer FFmpeg | RCE atau arbitrary memory read di dalam proses worker | `MITIGATE` — Scan ClamAV fail-closed sebelum probe, pembatasan ekstensi ketat `.mp4`, sandbox `bubblewrap --unshare-net`, user non-root | `MITIGATE` — Dirancang pada `CR-022`, target implementasi & uji `MP3-01`–`MP3-02` | User (Owner) | 2026-11-27 | PLANNED — MP3-01 & MP3-02 |
| `RISK-SEC-026` | Pelanggaran hak cipta audio atau ekstraksi konten berhak cipta tanpa izin pemilik | MEDIUM | Pengguna mengekstrak lagu/audio berhak cipta dari berkas MP4 pihak ketiga | Risiko hukum/reputasi platform Doc-builder/Satukit | `MITIGATE` — Otentikasi wajib, konfirmasi checkbox hak kepemilikan/izin audio eksplisit di UI & API, audit event non-PII | `MITIGATE` — Dirancang pada `CR-022`, target implementasi & uji `MP3-02`–`MP3-03` | User (Owner) | 2026-11-27 | PLANNED — MP3-02 & MP3-03 |
| `RISK-SEC-027` | DoS worker crash akibat MP4 tanpa audio stream (`NO_AUDIO_STREAM`) atau audio abnormal (>2 channel) | MEDIUM | Berkas MP4 bisu atau surround 5.1/7.1 dikirim untuk ekstraksi audio | Worker gagal tanpa error jelas atau pemborosan resource CPU/disk | `MITIGATE` — Validasi ffprobe fail-closed menolak berkas tanpa stream audio dengan `NO_AUDIO_STREAM`, auto-downmix channel >2 menjadi stereo (`-ac 2`), timeout 10 menit | `MITIGATE` — Dirancang pada `CR-022`, target implementasi & uji `MP3-01`–`MP3-02` | User (Owner) | 2026-11-27 | PLANNED — MP3-01 & MP3-02 |
| `RISK-SEC-028` | Resource exhaustion (CPU starvation, spike RAM, OOM freeze) pada VPS 1 vCPU / 2.2 GiB RAM saat inferensi model transkripsi | HIGH | Beban eksekusi model AI transkripsi melampaui RAM fisik VPS | Web server Uvicorn crash atau VPS tidak merespons | `MITIGATE` — Kuantisasi int8 (RAM ~200-550MB), single worker queue (1 running + 2 waiting), hard timeout 15 menit, VAD noise rejection, benchmark staging wajib sebelum rilis | `MITIGATE` — Dirancang pada `CR-023`, target implementasi & uji `VTT-02`–`VTT-05` | User (Owner) | 2026-11-28 | PLANNED — VTT-02 & VTT-05 |
| `RISK-SEC-029` | Kebocoran PII percakapan rapat/wawancara melalui logging, residu workspace disk, atau insecure ZIP | MEDIUM | Rekaman sensitif pengguna tertinggal di disk atau bocor di log audit | Pelanggaran kerahasiaan data pengguna / UU PDP | `MITIGATE` — Redaksi penuh transkrip dan audio dari log/audit, ephemeral preview `preview.json` musnah pasca-download/expiry, single-use download TTL 15 menit, sanitasi nama ZIP | `MITIGATE` — Dirancang pada `CR-023`, target implementasi & uji `VTT-02`–`VTT-04` | User (Owner) | 2026-11-28 | PLANNED — VTT-02 & VTT-03 |
| `RISK-SEC-030` | Worker hang atau kebuntuan proses pada rekaman audio tanpa ucapan / audio rusak | MEDIUM | Audio berisi musik murni, hening panjang, atau file WAV PCM rusak diproses model | Worker terkunci selama 15 menit penuh dan menghalangi antrean job lain | `MITIGATE` — Deteksi VAD fail-closed `NO_SPEECH`, validasi integritas WAV sebelum inferensi, process-group kill SIGTERM->SIGKILL jika melewati deadline | `MITIGATE` — Dirancang pada `CR-023`, target implementasi & uji `VTT-02` | User (Owner) | 2026-11-28 | PLANNED — VTT-02 |

**Aturan:** `RISK-SEC-001` s/d `RISK-SEC-016` wajib ditangani secara bertahap sesuai fase implementasinya, `RISK-SEC-021` s/d `RISK-SEC-024` berlaku untuk `CR-021` (`RISK-SEC-023` benchmark Ubuntu staging bersifat release-blocking), `RISK-SEC-025` s/d `RISK-SEC-027` berlaku untuk `CR-022`, dan `RISK-SEC-028` s/d `RISK-SEC-030` berlaku untuk `CR-023`. Tidak ada deployment rilis online yang diizinkan sebelum seluruh mitigasi wajib diverifikasi.

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

### 14.2 Checklist Security Planning Gate — Fitur Hapus Watermark (`CR-020` — `RW-01` s/d `RW-06`)
```markdown
### Governance & Ownership
- [x] Security risk tier HIGH tetap berlaku; Security & Data Owner: User (Owner)
- [x] Implementasi & verifikasi bertahap `RW-01` s/d `RW-06` selesai pasca `DEC-025` (penutupan formal `RISK-SEC-017` s/d `020` oleh owner)

### Asset, Data, dan Exposure
- [x] Input dibatasi PDF, JPG/JPEG, PNG <= 25 MB, batas piksel `MAX_PIXELS`, analisis interaktif <= 50 halaman
- [x] Pemrosesan stateless in-memory via `ConversionJobManager` tanpa penyimpanan berkas permanen
- [x] Re-encode output JPG/PNG membuang seluruh metadata EXIF/GPS (`THR-035`, `RISK-SEC-018`, teruji di `RW-03` & `RW-06`)

### Identity, Authorization, & Integrity
- [x] Akses `/api/watermark-removal/*` wajib sesi terautentikasi & proteksi CSRF (`SecurityMiddleware`, `THR-034`, teruji di `RW-03`) dan kartu `#/tools` mewajibkan login (`app.integration.test.tsx`, teruji di `RW-05`)
- [x] Penegakan server-side `owner_confirmed == true` & audit JSONL non-PII (`RISK-SEC-017`, teruji di `RW-03` & `RW-06`)
- [x] Penolakan fail-closed PDF terenkripsi & `has_digital_signature` (`THR-033`, teruji di `RW-02` & `RW-03`)
- [x] Validasi manifest koordinat ternormalisasi `0..1`, batas stroke/titik, serta ikatan `file_sha256` & `xref` (`THR-032`, `THR-033`, teruji di `RW-02` & `RW-03`)

### Safety, Telemetry, & Verification
- [x] Mode OCR opsional tidak memblokir saat Tesseract absen/gagal (`RISK-SEC-019`, teruji di `RW-02`, `RW-03`, `RW-04`)
- [x] Review before/after wajib, penghapusan struktural annotation/stamp tanpa meraster halaman non-target, & konfirmasi eksplisit sebelum rasterisasi (`THR-036`, backend teruji `RW-03`; UI teruji `RW-04`)
- [x] Pengujian negatif & gate akhir (`RW-06`): auth 401/origin/CSRF/prod-verified 403 (endpoint stateless tanpa objek tersimpan antarakun), signed/encrypted/SHA/xref 422, EXIF strip, batas 25MB/50-hal/`MAX_PIXELS`/NaN/out-of-range `0..1` (batas stroke/point overflow ditegakkan schema Pydantic meski belum diuji terpisah), 7/7 `vitest-axe` 0 violations, 303/303 Pytest, 392/392 Vitest, Ruff file CR-020 PASS, Oxlint 0 errors, `scan_secrets.py` 0 secrets
```

### 14.3 Checklist Security Planning Gate — Fitur Compress Video (`CR-021` — Gerbang 2 Disetujui 2026-11-12)
```markdown
### Governance & Ownership
- [x] Security risk tier HIGH tetap berlaku; Security & Data Owner: User (Owner)
- [x] Persetujuan Gerbang 2 (`CR-021`) diberikan oleh User (Owner) pada 2026-11-12 dengan phase `phase-video-compression` (`VC-00` s/d `VC-06`)
- [ ] Release gate produksi menuntut penutupan `RISK-SEC-023` melalui benchmark empiris ClamAV (`StreamMaxLength` > 250 MB) + FFmpeg di Ubuntu staging (`Q-007`)

### Asset, Data, dan Exposure
- [x] Input dibatasi unggahan berkas lokal MP4, MOV, WebM ≤ 250.000.000 byte (250 MB), ≤ 600 detik, ≤ 4K (landscape/portrait), ≤ 60 FPS; input URL, two-pass, & target ukuran MB di luar scope
- [x] Upload stream `request.stream()` chunk 64 KiB tanpa `request.body()`; workspace video permission `0700`/`0600` dan batas global `1.25 GiB` (`1.342.177.280` B)
- [x] Output dipaksa MP4 H.264 (`yuv420p`) + AAC ≤ 1080p/30 FPS tanpa upscale dan tanpa metadata/chapter (`-map_metadata -1 -map_chapters -1`), TTL unduhan sekali pakai 15 menit
- [x] Batas reverse proxy global `Caddyfile.example` 35 MB dipertahankan; override matcher khusus hanya untuk `POST /api/video-compressions` (~260 MB)

### Identity, Authorization, & Coordination
- [x] Akses `/api/video-compressions*` wajib login, email terverifikasi (prod), Origin allowlist, dan CSRF token; `App.tsx` menambahkan guard login eksplisit meskipun kategori `convert`
- [x] Koordinasi antrean lintas 2 worker Uvicorn via PostgreSQL (`video_compression_jobs`, advisory xact lock, partial unique index 1 aktif/akun & 1 global `running`, `FOR UPDATE SKIP LOCKED`)
- [x] Isolasi kepemilikan `user_id` (HTTP 404 anti-enumerasi) dan transisi atomik single-use download `succeeded -> claimed`

### Threat Coverage, Isolation, & Verification
- [x] `THR-037` s/d `THR-042` dan `CTRL-037` s/d `CTRL-042` dipetakan beserta `RISK-SEC-021` s/d `RISK-SEC-024`
- [x] ClamAV streaming `INSTREAM` 64 KiB fail-closed (signature ≤ 24h) wajib sebelum `ffprobe`; `ffprobe`/`ffmpeg` di Linux dibungkus `bubblewrap --unshare-net --die-with-parent` + process-group kill + timeout 45 menit
- [x] Rencana verifikasi (`VC-01` s/d `VC-06`) mencakup streaming 250 MB, ClamAV pre-probe, sandbox/timeout/cancel, rate limit 3/jam per akun & IP, BOLA 404, single-use download, `/api/health` tanpa path bocor, aksesibilitas `vitest-axe` 0 violations, dan Playwright E2E
```

### 14.4 Checklist Security Planning Gate — Fitur MP4 ke MP3 (`CR-022` — Gerbang 2 Siap Disetujui)
```markdown
### Governance & Ownership
- [x] Security risk tier HIGH tetap berlaku; Security & Data Owner: User (Owner)
- [x] Gerbang 1B PRD disetujui untuk `CR-022` (`FR-060`); fase `phase-mp4-to-mp3` (`MP3-00` s/d `MP3-04`)
- [ ] Release gate produksi menuntut penutupan `RISK-SEC-023` melalui benchmark empiris ClamAV (`StreamMaxLength` > 250 MB) + FFmpeg di Ubuntu staging (`Q-007`)

### Asset, Data, dan Exposure
- [x] Input terbatas pada berkas lokal MP4 tunggal ≤ 250.000.000 byte, durasi ≤ 600 detik; tidak ada input URL, batch, atau format video non-MP4
- [x] Output audio dipaksa MP3 (CBR 128k, 192k default, 320k), strip metadata dan cover art (`-map_metadata -1 -map_chapters -1 -vn`), nama output `<stem>_audio.mp3`
- [x] Hasil download sekali pakai (`claimed`) dengan TTL 15 menit, pembersihan berkas segera pasca-unduh/batal

### Identity, Authorization, & Legal Protection
- [x] Wajib login terverifikasi (prod) + Origin/CSRF guard; guard login eksplisit di `App.tsx`
- [x] Checkbox wajib konfirmasi hak kepemilikan/izin audio sebelum proses ekstraksi dimulai
- [x] Audit log JSONL non-PII (`action="mp4_to_mp3_requested"`, `action="mp4_to_mp3_downloaded"`) tanpa merekam nama berkas asli maupun payload audio

### Threat Coverage, Audio Validation, & Resource Limits
- [x] `THR-043` s/d `THR-045` dan `CTRL-043` s/d `CTRL-045` dipetakan beserta `RISK-SEC-025` s/d `RISK-SEC-027`
- [x] Validasi ffprobe fail-closed menolak MP4 tanpa aliran audio aktif dengan kode error spesifik `NO_AUDIO_STREAM`
- [x] Pemilihan stream default / 0:a:0 eksplisit dan auto-downmix channel > 2 ke stereo (`-ac 2`)
- [x] Berbagi antrean dan pembatasan dengan `CR-021`: 1 aktif per akun (`uq_video_jobs_active_per_user`), 1 running global (`uq_video_jobs_global_running`), max 2 menunggu, rate limit 3/jam per akun & IP
- [x] Timeout ekstraksi audio maksimal 10 menit (600s), sandbox Linux `bubblewrap --unshare-net`, dan penghapusan input segera setelah ekstraksi selesai
```

### 14.5 Checklist Security Planning Gate — Fitur Video ke Teks (`CR-023` — Gerbang 2 Disetujui 2026-11-13)
```markdown
### Governance & Ownership
- [x] Security risk tier HIGH dipertahankan; Security & Data Owner: User (Owner)
- [x] Approval Gerbang 2 diberikan oleh User (Owner) pada 2026-11-13
- [x] Residual risk RISK-SEC-028 s/d RISK-SEC-030 dipetakan dengan owner User (Owner); benchmark staging VPS Ubuntu (RISK-SEC-023 / Q-007 & transkripsi) tetap prasyarat rilis-blocking

### Asset, Data, dan Exposure
- [x] Input terbatas pada berkas MP4 lokal tunggal ≤ 250.000.000 byte, durasi ≤ 600 detik; tidak menerima URL atau batch
- [x] Paket hasil diunduh dalam 1 arsip ZIP berisi tepat 3 berkas: `<stem>_transcript.txt`, `.srt`, dan `.docx` (via python-docx)
- [x] Data pratinjau teks (preview.json) bersifat ephemeral di direktori workspace 0700 dan otomatis musnah saat diunduh atau kedaluwarsa 15 menit
- [x] Transisi atomik sekali unduh (succeeded -> claimed) dengan Content-Type application/zip; replay download ditolak fail-closed (HTTP 410)

### Identity, Authorization, & Legal Protection
- [x] Wajib login terverifikasi (prod) + Origin/CSRF guard; guard login eksplisit di App.tsx
- [x] Checkbox wajib konfirmasi kepemilikan berkas dan izin mentranskripsikan suara sebelum tombol transkripsi aktif
- [x] Redaksi total: teks transkrip dan audio dilarang masuk ke dalam log aplikasi maupun audit trail JSONL

### Threat Coverage, Audio Validation, & Resource Limits
- [x] THR-046 s/d THR-048 dan CTRL-046 s/d CTRL-048 dipetakan beserta RISK-SEC-028 s/d RISK-SEC-030
- [x] Validasi ffprobe fail-closed menolak MP4 tanpa audio dengan kode NO_AUDIO_STREAM
- [x] VAD filtering fail-closed menolak audio tanpa ucapan dengan kode NO_SPEECH tanpa menghasilkan dokumen kosong
- [x] Kuantisasi model int8 (RAM ~200-550MB) dijalankan offline CPU-only pada worker systemd terpisah
- [x] Berbagi antrean dan pembatasan dengan CR-021: 1 aktif per akun, 1 running global, max 2 menunggu, rate limit 3/jam per akun & IP
- [x] Timeout transkripsi keras maksimal 15 menit (900s), pembatalan per process-group, sandbox Linux bubblewrap --unshare-net, dan pembersihan berkas audio WAV perantara segera setelah inferensi selesai
```

### 14.6 Hardening Subprocess LibreOffice (`OFF-01` — `DEC-029`)
- **Isolasi Profil Per-Eksekusi:** Setiap konversi dokumen Office menggunakan `-env:UserInstallation=file://...` pada direktori temporer terisolasi (`docbuilder_lo_prof_*`) dan dihapus deterministik setelah proses selesai, menutup celah race condition dan kebocoran state antar-konversi.
- **Terminasi Pohon Proses (Process-Tree Kill):** `run_sandboxed_subprocess` di `backend/app/core/sandbox.py` menggunakan `start_new_session=True` dan `os.killpg` (`SIGTERM` -> `SIGKILL`) pada POSIX serta fail-closed `WindowsJobObject` pada Windows untuk mencegah penumpukan proses zombie `soffice.bin` akibat dokumen macet/malicious.
- **Validasi Output Fail-Closed:** Luaran konversi wajib lolos pemeriksaan header magic bytes `%PDF-` (`validate_pdf_file`) sebelum dikirim ke klien.

### 14.7 Gate Endpoint Peluncuran Beta (`BETA-01` — `CR-024`, `THR-049`, `CTRL-049`)
- **Ancaman (`THR-049`):** Bypass antarmuka pengguna dengan menembak langsung endpoint fitur yang dinonaktifkan pada masa beta (`/api/media-downloads*`, `/api/video-compressions*`, `/api/pdf-tools/editor/*`, `/api/pdf-tools/repair`, `/api/pdf-tools/ocr*`) untuk memicu beban CPU/RAM/disk di VPS 1 vCPU.
- **Kontrol Preventif & Detektif (`CTRL-049`):** `SecurityMiddleware` memeriksa `is_beta_coming_soon_path(path)` ketika `BETA_COMING_SOON_GATES_ENABLED=True` tepat setelah pemeriksaan `Origin` (sebelum pembacaan stream upload atau reservasi DB), mencatat `audit_denial("feature_coming_soon", 503)`, dan mengembalikan HTTP `503` dengan `error_code: "FEATURE_COMING_SOON"`. Endpoint `/api/image-tools/remove-background` sengaja tidak diblokir agar fitur aktif `Hapus Latar Belakang` tetap berfungsi.
