# Security Architecture & Threat Model (SECURITY.md)

## 1. Metadata & Governance
- **Security Risk Tier:** HIGH (karena memproses berkas biner tidak tepercaya, data pribadi PII pelamar kerja, dan menjalankan subprocess konversi lokal).
- **Security Owner:** User (Owner Proyek)
- **Data Owner:** User (Owner Proyek)
- **Approval Authority:** User (Owner Proyek)
- **Tanggal Evaluasi:** 2026-10-20
- **Status Gate:** APPROVED (Security Planning Gate Gerbang 2)

## 2. Aset Kritis dan Klasifikasi Data
1. **Data PII Pelamar (Kritis):** Nama lengkap, alamat email, nomor telepon, riwayat pendidikan, riwayat karier, dan foto. Disimpan secara lokal di IndexedDB browser pengguna dan dalam berkas project terenkripsi.
2. **Dokumen Unggahan (Sensitif):** Berkas PDF/DOCX yang diproses oleh converter. Berada sementara di direktori temp lokal dengan proteksi hak akses pengguna sistem operasi.
3. **Session Token Localhost (Sensitif):** Kredensial bootstrap antara frontend browser dan server FastAPI localhost.

## 3. Threat Coverage Matrix & Mitigasi

| Kategori Ancaman | Status | Threat Scenario (ID) | Preventive / Detective Control | Residual Risk & Owner |
|---|---|---|---|---|
| Reconnaissance | APPLICABLE | THR-001: Scanning port localhost oleh software lokal lain | Bind eksklusif ke 127.0.0.1, alokasi port dinamis, endpoint health minimal tanpa versi library | LOW (Owner) |
| Scanning & Enumeration | APPLICABLE | THR-002: Enumerasi endpoint atau file di direktori temp | Nama direktori temp acak UUIDv4 dengan izin akses OS ketat (0700/ACL privat) | LOW (Owner) |
| Vulnerability Assessment | APPLICABLE | THR-003: Kerentanan pada dependensi Python atau npm | SCA harian, pin versi di lockfile, pip-audit/npm-audit di pipeline CI/CD | LOW (Owner) |
| Exploitation | APPLICABLE | THR-004: Parser exploit / buffer overflow via file PDF/DOCX korup | Validasi magic bytes, batas ukuran berkas, dekompresi terbatas, subprocess sandbox terisolasi | MEDIUM (Owner) |
| Password Attacks | NOT APPLICABLE | N/A (Tidak ada login/password akun pada MVP) | Enkripsi file project menggunakan PBKDF2/Argon2 + AES-GCM jika pengguna mengaktifkan password | LOW (Owner) |
| Social Engineering | APPLICABLE | THR-005: Penipuan sharing log error yang memuat data pribadi | Sanitasi log otomatis, penghapusan nama file & PII dari log, dialog peringatan saat export log | LOW (Owner) |
| Web/Application/API | APPLICABLE | THR-006: Serangan CSRF atau Cross-Origin dari tab browser berbahaya | Cookie HttpOnly SameSite=Strict, validasi Origin allowlist, dan CSRF token header | LOW (Owner) |
| Privilege Escalation | APPLICABLE | THR-007: Subprocess mencoba menaikkan hak akses sistem | Seluruh proses berjalan pada hak pengguna biasa (non-root / non-admin), fail-closed | LOW (Owner) |
| Lateral Movement | APPLICABLE | THR-008: Worker mencoba mengakses host lain di LAN | Isolasi jaringan penuh pada worker subprocess (block network egress) | LOW (Owner) |
| Persistence | APPLICABLE | THR-009: File temporer atau proses zombie tertinggal | Lifecycle cleanup ketat: per-job cleanup, daemon sweeper (TTL 5m), startup cleanup sweep | LOW (Owner) |
| Defense Evasion | APPLICABLE | THR-010: Penyerang memanipulasi log audit lokal | Log hanya append, proteksi hak akses file OS, rotasi berkas 7 hari | LOW (Owner) |
| Exfiltration | APPLICABLE | THR-011: Dokumen memuat external resource yang melakukan request diam-diam | Nonaktifkan penarikan link/font eksternal di LibreOffice (`--norestore --nolockcheck --nologo --headless`) | LOW (Owner) |

## 4. Remediation SLA & Quality Gates
- **Critical Vulnerability:** Perbaikan dan patch dalam ≤ 24 jam.
- **High Vulnerability:** Perbaikan dalam ≤ 7 hari.
- **Medium / Low:** Perbaikan terencana sebelum rilis berikutnya atau risk acceptance formal dengan approver.
- **Zero Open Critical Policy:** Dilarang merilis perangkat lunak jika terdapat temuan Critical terbuka.

## 5. Rencana Pengujian Keamanan
1. **Secret Scanning:** Otomatis mendeteksi kunci, sertifikat, atau token yang tidak sengaja tertulis.
2. **Software Composition Analysis (SCA):** Audit dependensi pip (`pip-audit`) dan npm (`npm audit`).
3. **Static Application Security Testing (SAST):** Linting keamanan menggunakan Bandit (Python) dan Semgrep/Biome.
4. **Dynamic API & Regression Testing:** Pengujian negatif (unggah file non-PDF dengan ekstensi .pdf, percobaan akses tanpa origin header, CSRF injection, path traversal injection `../../`).

## 6. Status Eksekusi Audit Keamanan (TASK-8.2)
- **Status Gate Keamanan:** APPROVED & VERIFIED (2026-10-21).
- **Laporan Lengkap:** Lihat `docs/project/security/SECURITY-SCAN-REPORT.md`.
- **Hasil Pemindaian:**
  - SCA npm: 0 kerentanan (`npm audit` PASS).
  - SCA pip: 0 kerentanan (`pip-audit` PASS pasca upgrade pip ke 26.2.2).
  - Secret Scan: 0 credential/key di working tree (125 file lulus `scripts/scan_secrets.py`).
  - SAST: Ruff PASS, Oxlint PASS, TypeScript typecheck PASS.
  - Regression Test: 7/7 uji keamanan di `test_security.py` lulus (Origin, CSRF, Session, Rejection).
- **Residual Risk:** LOW (Terkendali pada lingkungan eksekusi desktop lokal).

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
   - Seluruh pemrosesan berlangsung 100% offline di localhost tanpa transmisi ke jaringan luar.

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
