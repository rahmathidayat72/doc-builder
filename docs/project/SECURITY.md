# Security Architecture & Threat Model (SECURITY.md)

## 1. Metadata & Governance
- **Security Risk Tier:** HIGH (karena memproses berkas biner tidak tepercaya, data pribadi PII pelamar kerja, dan menjalankan subprocess konversi lokal).
- **Security Owner:** User (Owner Proyek)
- **Data Owner:** User (Owner Proyek)
- **Approval Authority:** User (Owner Proyek)
- **Tanggal Evaluasi:** 2026-10-20
- **Revisi Dokumentasi:** 2026-10-24 — koreksi kontrol yang tidak didukung kode, status bukti, dan risk register; 2026-10-27 — implementasi audit trail JSONL lokal, pengujian, dan pembaruan status mitigasi.
- **Status Gate:** APPROVED (Security Planning Gate Gerbang 2). Status ini **tidak diubah** oleh revisi dokumentasi; open risk di bawah menunggu review owner.
- **Release Gate Berikutnya:** PENDING — `RISK-SEC-003` berstatus HIGH provisional dan harus dimitigasi atau diterima formal sebelum release berikutnya.
- **Status Verifikasi:** Histori eksekusi 2026-10-21 + regression suite terbaru; lihat §6.

## 2. Aset Kritis dan Klasifikasi Data
1. **Data PII Pelamar (Kritis):** Nama lengkap, alamat email, nomor telepon, riwayat pendidikan, riwayat karier, dan foto. Disimpan secara lokal di IndexedDB browser pengguna dan dalam berkas project terenkripsi.
2. **Dokumen Unggahan (Sensitif):** Berkas PDF/DOCX yang diproses oleh converter. Berada sementara di workspace temp lokal; permission workspace aktual mengikuti umask dan belum eksplisit `0700` (lihat `RISK-SEC-002`).
3. **Session Token Localhost (Sensitif):** Kredensial bootstrap antara frontend browser dan server FastAPI localhost.

## 3. Threat Coverage Matrix & Mitigasi

Status bukti yang dipakai:
- `TERVERIFIKASI`: ada implementasi dan bukti eksekusi yang relevan.
- `TERVERIFIKASI (SPIKE/HISTORIS)`: bukti berasal dari spike atau eksekusi historis; regression test utama belum lengkap.
- `PARTIAL`: kontrol ada sebagian, atau bukti belum mencakup seluruh klaim.
- `GAP`: kontrol yang diklaim sebelumnya belum diimplementasikan; bukan berarti risiko diterima.

| Kategori Ancaman | Status | Threat Scenario (ID) | Preventive / Detective Control | Status Bukti / Gap | Residual Risk & Owner |
|---|---|---|---|---|---|
| Reconnaissance | APPLICABLE | THR-001: Scanning port localhost oleh software lokal lain | Bind eksklusif ke `127.0.0.1`, port dari launcher, endpoint health minimal tanpa versi library | `TERVERIFIKASI` — launcher memakai `--host 127.0.0.1`; health endpoint diuji | LOW (Owner) |
| Scanning & Enumeration | APPLICABLE | THR-002: Enumerasi endpoint atau file di direktori temp | Workspace berbasis UUID; permission ketat; TTL cleanup | `PARTIAL` — UUID tersedia, tetapi `backend/temp_workspace` dan `conversion_jobs` teramati `0775`, bukan `0700`; lihat `RISK-SEC-002` | LOW provisional (Owner; `RISK-SEC-002`) |
| Vulnerability Assessment | APPLICABLE | THR-003: Kerentanan pada dependensi Python atau npm | Lockfile pinning dan audit dependensi | `PARTIAL` — `npm audit` dan `pip-audit` PASS pada 2026-10-21; tidak ada pipeline CI/CD otomatis | LOW (Owner) |
| Exploitation | APPLICABLE | THR-004: Parser exploit / buffer overflow via file PDF/DOCX korup | Validasi magic bytes, batas ukuran, sandbox subprocess, timeout, resource limit | `PARTIAL` — invalid magic bytes/timeout diuji; Windows Job Object membatasi memori 500 MB; Linux belum memiliki memory cap; fuzzing parser belum ada | MEDIUM (Owner; `RISK-SEC-003`) |
| Password Attacks | NOT APPLICABLE | N/A (Tidak ada login/akun pengguna pada MVP) | Tidak ada password akun. Password file project memakai PBKDF2/Argon2 + AES-GCM jika diaktifkan | `N/A` untuk autentikasi akun; kontrol enkripsi file project diuji terpisah | LOW (Owner) |
| Social Engineering | APPLICABLE | THR-005: Penipuan sharing log error yang memuat data pribadi | Sanitasi log, penghapusan nama file/PII, dialog peringatan export log | `PARTIAL` — audit trail tidak mencatat body/header/query/PII, tetapi SOP verifikasi identitas dan redaksi log manual belum ada | LOW (Owner) |
| Web/Application/API | APPLICABLE | THR-006: Serangan CSRF atau Cross-Origin dari tab browser berbahaya | Cookie `HttpOnly` `SameSite=Lax`, Origin allowlist, dan CSRF token header | `TERVERIFIKASI` — origin liar 403, sesi tanpa cookie 401, mutasi tanpa CSRF 403; 8/8 security test PASS (hotfix 2026-10-21) | LOW (Owner) |
| Privilege Escalation | APPLICABLE | THR-007: Subprocess mencoba menaikkan hak akses sistem | Seluruh proses berjalan pada hak pengguna biasa (non-root/non-admin), fail-closed | `TERIMPLEMENTASI` — model deployment localhost; belum ada automated privilege test | LOW (Owner) |
| Lateral Movement | APPLICABLE | THR-008: Worker mencoba mengakses host lain di LAN | Egress block OS-level pada worker subprocess | `GAP` — implementasi hanya menyetel proxy env ke port tertutup; tidak ada network namespace/firewall. Spike tidak membuktikan blocking karena skrip uji sendiri menghormati env proxy | HIGH provisional (Owner; `RISK-SEC-003`) |
| Persistence | APPLICABLE | THR-009: File temporer atau proses zombie tertinggal | Per-job cleanup, startup sweep TTL 5 menit, satu job aktif | `PARTIAL` — per-job cleanup dan startup sweep diuji; periodic daemon sweeper belum ada; lihat `RISK-SEC-002` | LOW provisional (Owner; `RISK-SEC-002`) |
| Defense Evasion | APPLICABLE | THR-010: Penyerang memanipulasi log audit lokal | Append-only JSONL, permission file `0600`/direktori `0700`, rotasi harian UTC, retensi 7 hari | `TERVERIFIKASI` — `backend/app/core/audit.py` + 10 test `test_audit.py` PASS; full suite 136/136 Pytest PASS (2026-10-27); `RISK-SEC-001` closure menunggu approval owner | MEDIUM provisional (Owner; `RISK-SEC-001`) |
| Exfiltration | APPLICABLE | THR-011: Dokumen memuat external resource yang melakukan request diam-diam | Egress block OS-level sebagai kontrol utama; flag LibreOffice bukan pengganti isolasi jaringan | `GAP/PARTIAL` — proxy env hanya memengaruhi library yang menghormati proxy; test regresi external-link di suite utama belum ada | HIGH provisional (Owner; `RISK-SEC-003`) |

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
- **Residual Risk:** LOW untuk kontrol yang terverifikasi; MEDIUM provisional untuk `RISK-SEC-001` (mitigasi terimplementasi, menunggu approval penutupan); LOW provisional untuk `RISK-SEC-002`; HIGH provisional untuk `RISK-SEC-003`.
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

## 12. Risk Register (Open, 2026-10-24)

| ID | Risiko | Severity | Bukti | Dampak | Compensating Control | Treatment | Owner | Review Due | Status |
|---|---|---|---|---|---|---|---|---|---|
| `RISK-SEC-001` | Audit/logging keamanan dan retensi 7 hari tidak tersedia sebelum mitigasi | MEDIUM (provisional; mitigasi terimplementasi) | `backend/app/core/audit.py` + `test_audit.py` (10 test PASS); full suite 136/136 Pytest PASS (2026-10-27); Ruff PASS; secret scan 0 temuan | Tanpa audit trail, aksi sensitif tidak dapat dideteksi/diforensik; mitigasi menutup gap utama, tetapi log belum tamper-evident dan belum memiliki batas ukuran harian | Loopback-only, tidak ada akun remote, PII tidak ditulis ke log, akses file mengikuti akun OS | `MITIGATE` — append-only JSONL, `0600`/`0700`, rotasi harian UTC, retensi 7 hari, fail-open; **closure pending owner approval** | User (Owner) | 2026-10-31 | MITIGATED — closure pending owner approval |
| `RISK-SEC-002` | Workspace temp job manager memakai permission default `0775`, bukan `0700`, dan periodic sweeper belum tersedia | LOW (provisional) | `backend/temp_workspace` dan `conversion_jobs` teramati `0775`; `job_manager.py` memakai `Path.mkdir` tanpa `chmod`; sweep hanya saat startup/per-job | Pada mesin multi-user, pengguna lokal lain berpotensi membaca sisa file temp; workspace kedaluwarsa dapat tertahan sampai startup berikutnya | UUID workspace, per-job cleanup, startup sweep, batas TTL 5 menit, akun OS pengguna | `MITIGATE` — set `0700` saat pembuatan workspace dan tambahkan periodic sweep; **belum diimplementasikan** | User (Owner) | 2026-10-31 | OPEN — decision required |
| `RISK-SEC-003` | Sandbox isolation tidak sekuat klaim: egress hanya proxy environment; tidak ada network namespace/firewall; Linux belum memiliki memory cap | HIGH (provisional) | `backend/app/core/sandbox.py` hanya menyetel `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` dan `DOCBUILDER_SANDBOX_NETWORK_BLOCKED`; tidak ada `unshare`, `bwrap`, `seccomp`, atau aturan firewall; `max_memory_mb` hanya dipakai Windows Job Object; spike egress bergantung pada env proxy | Parser exploit dapat membuka koneksi langsung dan mengeksfiltrasi PII; resource exhaustion di Linux tidak dibatasi memori | Hak pengguna biasa, timeout 5 menit, sanitasi env, workspace UUID, satu job aktif, tidak ada cloud credential di env | `MITIGATE` — egress block OS-level (network namespace/firewall/container) + memory cap Linux; `ACCEPT` hanya dengan owner/expiry; **belum dipilih** | User (Owner) | 2026-10-31 | OPEN — decision required |

**Aturan:** `RISK-SEC-001`, `RISK-SEC-002`, dan `RISK-SEC-003` belum Accepted. Jangan menurunkan severity atau menutup risk tanpa bukti implementasi/retest dan persetujuan owner. Status rilis dan `security_gate_status` tidak diubah oleh pencatatan ini; namun release berikutnya tunduk pada quality gate High finding.

## 13. Catatan Konsistensi Dokumentasi
- Revisi 2026-10-27 mencatat implementasi audit trail JSONL lokal dan bukti 10 test `test_audit.py`; status `RISK-SEC-001` berubah menjadi MITIGATED dengan penutupan menunggu approval owner. Status gate dan tiga open risk lain tidak berubah.
- Revisi 2026-10-24 mengoreksi klaim `SameSite=Strict` menjadi `SameSite=Lax` (lihat `DEC-013`), referensi engine PDF menjadi `DEC-012`, dan klaim CI/CD/Playwright/logging yang tidak didukung kode.
- Klaim “isolasi jaringan penuh” dikoreksi: implementasi aktual hanya proxy environment, bukan egress block OS-level (`RISK-SEC-003`). Klaim “memory cap 1 GB” juga dikoreksi menjadi 500 MB Windows-only; Linux belum memiliki cap.
- Gap verifikasi cross-browser dan kebijakan `docs/conversations.json` dicatat di `.agent/OPEN-QUESTIONS.md` sebagai `Q-005` dan `Q-006`.
- Tidak ada source code, test, dependency, atau konfigurasi runtime yang diubah oleh revisi dokumentasi konsistensi 2026-10-24. Implementasi peningkatan CV Builder dicatat terpisah pada §11 dan tetap tunduk pada quality gate di atas.
