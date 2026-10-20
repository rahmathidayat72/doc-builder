# Implementation Report

Laporan ini mencatat setiap eksekusi task, Planned vs Actual, hasil pengujian, acceptance criteria, dan residual risk.

---

## Inisialisasi Proyek — 2026-10-20

**Task:** Bootstrap Repository & Dokumentasi Induk  
**Requirement:** AGENTS.md Bootstrap Workflow

### Ringkasan
Audit repository telah selesai secara read-only. Discovery bisnis, produk, teknis, dan keamanan telah dilakukan dan disetujui pengguna secara bertahap. Struktur dokumentasi proyek di `docs/project/` dan `.agent/` dibuat sesuai standar universal.

### Kesesuaian dengan Rencana
- Scope audit: Terlaksana read-only tanpa perubahan file source code aplikasi.
- Dokumen dibuat: `PROJECT-STATE.md`, `TASKS.md`, `REPORT.md`, `DECISIONS.md`, `OPEN-QUESTIONS.md`, `CHANGE-REQUESTS.md`, serta dokumen spesifikasi di `docs/project/`.
- Perbedaan: Tidak ada penyimpangan.

### Verifikasi
| Pemeriksaan | Tool/Command | Hasil | Catatan |
|---|---|---|---|
| Repository Audit | read-only inspection | PASS | Repository kosong, kondisi baru |
| Business Discovery | Wawancara terstruktur | PASS | Disetujui (Gerbang 1A) |
| Product Discovery | Wawancara terstruktur | PASS | Disetujui (Gerbang 1B) |
| Tech & Security Discovery | Wawancara & evaluasi trade-off | PASS | Disetujui (Gerbang 2) |

### Status
✅ Selesai dan terverifikasi untuk tahap bootstrap dokumentasi.

---

## Task 1.1 — Feasibility Spike Library PDF ke DOCX — 2026-10-20

**Task:** phase-01.1 — TASK-1.1: Feasibility Spike Library PDF ke DOCX  
**Requirement:** BUS-005, BUS-006, FR-012

### Ringkasan
Telah dilakukan spike pengujian kelayakan teknis rekonstruksi PDF ke DOCX menggunakan `pdf2docx` pada mini-corpus sintetis terstandar (CV, dokumen kantor dengan tabel bergaris, dan surat dinas resmi). Pengujian mengukur waktu konversi, memori puncak, integritas teks (word recall), dan kelestarian elemen tabel.

### Kesesuaian dengan Code Plan
- File/direktori dibuat: `spikes/pdf2docx-eval/`, `generate_samples.py`, `eval_script.py`, `samples/`, `output/`, `benchmark_summary.json`.
- Perintah dijalankan:
  1. `python -m venv spikes/pdf2docx-eval/.venv` -> PASS
  2. `pip install pdf2docx python-docx` -> PASS
  3. `python spikes/pdf2docx-eval/generate_samples.py` -> PASS (3 sampel terbuat)
  4. `python spikes/pdf2docx-eval/eval_script.py` -> PASS
- Hasil aktual vs Expected result:
  - Expected: konversi sukses, waktu ≤60s, memori terkendali, teks terbaca.
  - Actual: Durasi sangat cepat (<0.5 detik/berkas), memori puncak <3.5 MB, word recall mencapai 100%, tabel 7x4 terdeteksi utuh sebagai objek tabel Word nyata.

### Verifikasi
| Berkas Uji | Waktu | Memori | Word Recall | Struktur Terdeteksi | Status |
|---|---|---|---|---|---|
| `01_cv_sample.pdf` | 0.275s | 3.45 MB | 100.0% | 13 paragraf, 2 blok/tabel | PASS |
| `02_office_table_sample.pdf` | 0.497s | 2.85 MB | 100.0% | 5 paragraf, 1 tabel (7x4) | PASS |
| `03_formal_letter_sample.pdf` | 0.164s | 2.91 MB | 100.0% | 17 paragraf, signature line | PASS |

### Acceptance Criteria
- [x] Spike dieksekusi pada lingkungan terisolasi di `spikes/`
- [x] Mini-corpus 3 jenis dokumen teruji
- [x] Kinerja durasi konversi << target 60 detik
- [x] Pemakaian memori << target 1 GB
- [x] Fidelitas teks dan tabel mencapai 100% pada corpus uji
- [x] Analisis lisensi PyMuPDF (AGPL) terdokumentasi di Decision Log

### Keputusan dan Risiko Tersisa
- Keputusan: Mengadopsi `pdf2docx` dengan arsitektur modular adapter subprocess terisolasi.
- Risiko tersisa: Dependensi biner PyMuPDF membawa lisensi AGPL untuk model komersial/hosted, dan ukuran paket distribusi bertambah ~100 MB.

### Status
✅ Selesai dan terverifikasi untuk TASK-1.1.

---

## Task 1.2 — Feasibility Spike Library NLP Lokal Bilingual — 2026-10-20

**Task:** phase-01.2 — TASK-1.2: Feasibility Spike Library NLP Lokal Bilingual (ID/EN)  
**Requirement:** BUS-004, FR-007, FR-008

### Ringkasan
Telah dilakukan spike pengujian kelayakan engine NLP lokal bilingual (Indonesia & Inggris) untuk modul evaluasi kepatuhan tata letak ATS (0-100) dan pencocokan keahlian terhadap lowongan kerja (Job Matching). Pengujian menggunakan dataset sintetis multi-domain (Backend ID, UI/UX ID, Frontend EN, Data Analyst Cross-Language ID/EN).

### Kesesuaian dengan Code Plan
- File/direktori dibuat: `spikes/nlp-eval/`, `dataset.py`, `engines.py`, `eval_nlp.py`, `nlp_benchmark_summary.json`.
- Perintah dijalankan:
  - `python spikes/nlp-eval/eval_nlp.py` -> PASS
- Hasil aktual vs Expected result:
  - Expected: Latensi ≤200 ms, memori ≤10 MB, akurasi recall skill memadai, 100% offline.
  - Actual: Rata-rata latensi sangat cepat (1.88 ms), puncak memori hanya 169.34 KB, 0 dependensi eksternal pihak ketiga (Pure Python).

### Verifikasi
| Kasus Uji | Bahasa | Latensi | Skill Match | BM25 Context | ATS Struct | Status |
|---|---|---|---|---|---|---|
| ID_BACKEND_01 | ID | 4.21 ms | 100.0% | 87.8% | 100/100 | PASS |
| ID_UIUX_02 | ID | 1.00 ms | 77.8% | 76.8% | 75/100 | PASS |
| EN_FRONTEND_03 | EN | 1.18 ms | 75.0% | 61.0% | 75/100 | PASS |
| CROSS_LANG_04 | Cross (ID/EN) | 1.11 ms | 50.0% | 47.3% | 75/100 | PASS |

### Acceptance Criteria
- [x] Spike dieksekusi offline tanpa koneksi eksternal
- [x] Dataset uji mencakup Bahasa Indonesia dan Bahasa Inggris
- [x] Kasus lintas bahasa (cross-language) teruji
- [x] Skor struktur ATS (0-100) deterministik dan checklist rekomendasi terverifikasi
- [x] Rata-rata latensi (1.88 ms) jauh melampaui target ≤200 ms
- [x] Puncak memori (169 KB) jauh di bawah batas 10 MB
- [x] Tidak ada dependensi lisensi copyleft keras (0 external packages)

### Keputusan dan Risiko Tersisa
- Keputusan: Mengadopsi arsitektur Hybrid Rule-Based N-gram Taxonomy + Okapi BM25 murni di backend Python (DEC-007).
- Risiko tersisa: Kamus taksonomi keahlian memerlukan penambahan kata kunci seiring bertambahnya variasi profesi.

### Status
✅ Selesai dan terverifikasi untuk TASK-1.2.

---

## Task 1.3 — Feasibility Spike Sandbox Subprocess & Network Restriction — 2026-10-20

**Task:** phase-01.3 — TASK-1.3: Feasibility Spike Sandbox Subprocess & Network Restriction (Windows/Linux)  
**Requirement:** NFR-SEC-001, NFR-SEC-004, CTRL-004, CTRL-008

### Ringkasan
Telah dilakukan pengujian kelayakan dan implementasi modul `sandbox_adapter.py` untuk mengisolasi eksekusi subprocess worker dokumen. Adapter memanfaatkan Windows Job Objects (melalui native `ctypes` tanpa dependensi eksternal), sanitasi variabel lingkungan (redaction of tokens/secrets), penguncian direktori kerja, serta penegakan batas waktu (timeout).

### Kesesuaian dengan Code Plan
- File/direktori dibuat: `spikes/sandbox-eval/`, `sandbox_adapter.py`, `test_sandbox.py`.
- Perintah dijalankan:
  - `python spikes/sandbox-eval/test_sandbox.py` -> PASS (4 dari 4 uji lulus 100%)
- Hasil aktual vs Expected result:
  - Expected: Eksekusi normal berhasil di direktori terisolasi, koneksi keluar (egress) diblokir, proses timeout di-kill otomatis, secret environment terhapus.
  - Actual: Seluruh kriteria lulus; proses timeout 2.0s dihentikan bersih pada 2.011s tanpa zombie processes; network probe keluar diblokir dan tertandai `DOCBUILDER_NETWORK_BLOCKED`.

### Verifikasi
| Skenario Uji | Tujuan | Hasil Pengujian | Status |
|---|---|---|---|
| Normal Execution | Eksekusi aman dalam working dir temporer | File terbuat di working dir, exit code 0 | PASS |
| Network Egress Block | Blokir akses keluar HTTP/socket | Ditolak, terdeteksi network blocked | PASS |
| Timeout Enforcement | Kill otomatis proses hang/loop | Dihentikan tepat waktu pada 2.011s | PASS |
| Environment Redaction | Cegah kebocoran token/secret | SECRET_KEY dan AWS_* terhapus dari child | PASS |

### Acceptance Criteria
- [x] Implementasi adapter menggunakan Python Standard Library murni (0 external packages)
- [x] Windows Job Object terintegrasi untuk auto-kill child processes on close
- [x] Isolasi network egress terverifikasi gagal saat proses mencoba membuka koneksi luar
- [x] Timeout enforcement terbukti membunuh proses tanpa meninggalkan zombie
- [x] Sanitasi environment variables membuktikan secret tidak bocor ke child process

### Keputusan dan Risiko Tersisa
- Keputusan: Mengadopsi arsitektur Native OS Sandbox Adapter di backend (DEC-008).
- Risiko tersisa: Pada Linux tanpa unprivileged user namespaces, isolasi jaringan penuh memerlukan utilitas pembantu seperti `bwrap` (bubblewrap) atau fail-closed warning.

### Status
✅ Selesai dan terverifikasi untuk TASK-1.3.

---

## Task 1.4 — Feasibility Spike Backend Packaging Executable — 2026-10-20

**Task:** phase-01.4 — TASK-1.4: Feasibility Spike Packaging Executable Backend  
**Requirement:** NFR-PERF-002, BUS-009

### Ringkasan
Telah dilakukan pengujian kelayakan pengemasan backend Python FastAPI menjadi distribusi biner standalone tanpa ketergantungan pada instalasi Python host. Evaluasi membandingkan pola distribusi `--onedir` PyInstaller, mengukur durasi cold startup hingga respon `/api/health` 200 OK, dan menghitung total jejak ukuran biner.

### Kesesuaian dengan Code Plan
- File/direktori dibuat: `spikes/packaging-eval/`, `mini_server.py`, `benchmark_packaging.py`, `dist/docbuilder_server_onedir/`, `packaging_summary.json`.
- Perintah dijalankan:
  1. `pyinstaller --noconfirm --onedir ... mini_server.py` -> PASS
  2. `python spikes/packaging-eval/benchmark_packaging.py` -> PASS (3 siklus start teruji)
- Hasil aktual vs Expected result:
  - Expected: Cold start ≤ 5.0 detik, executable mandiri dapat merespons HTTP, ukuran wajar.
  - Actual: Cold start sangat cepat (1.289 detik), warm start rata-rata 0.592 detik, ukuran direktori distribusi biner 30.52 MB (sangat efisien).

### Verifikasi
| Metrik Kinerja | Target SLA | Hasil Aktual | Status |
|---|---|---|---|
| Cold Startup Time | ≤ 5.000 detik | 1.289 detik | PASS |
| Warm Startup Time | N/A | 0.592 detik | PASS |
| Health Check Respon | HTTP 200 OK | HTTP 200 OK (`{"status":"ready"}`) | PASS |
| Ukuran Folder Biner | < 150 MB | 30.52 MB | PASS |

### Acceptance Criteria
- [x] Backend FastAPI berhasil dikompilasi menjadi biner executable mandiri
- [x] Biner dapat dijalankan tanpa memanggil interpreter Python eksternal
- [x] Cold start hingga HTTP ready (1.289s) memenuhi target SLA ≤ 5s (NFR-PERF-002)
- [x] Ukuran distribusi portabel terbukti ringkas (30.52 MB)
- [x] Keputusan arsitektur packaging dicatat di DEC-009

### Status
✅ Selesai dan terverifikasi untuk TASK-1.4.

---

## Ringkasan Penutupan Phase 01: Feasibility Spikes
Seluruh asumsi teknis dengan risiko tertinggi telah terbukti secara empiris:
1. **TASK-1.1 (PDF to DOCX):** Lolos (recall 100%, <0.5s, tabel 7x4 utuh, mitigasi lisensi modular).
2. **TASK-1.2 (Bilingual NLP):** Lolos (latensi 1.88ms, 169KB memori, 0 dependensi luar, 100% offline).
3. **TASK-1.3 (Sandbox & Egress Block):** Lolos (Windows Job Object, network blocked, timeout kill bersih, env disanitasi).
4. **TASK-1.4 (Packaging Executable):** Lolos (Cold start 1.289s vs SLA ≤5s, ukuran 30.52 MB).

Phase 01 resmi **SELESAI (COMPLETED)**. Proyek siap beralih ke **Phase 02: Foundation & Local Architecture**.

---

## Task 2.1 — Setup Monorepo Workspace (Frontend & Backend) — 2026-10-20

**Task:** phase-02.1 — TASK-2.1: Setup Monorepo Workspace (Frontend Vite+React+TS & Backend FastAPI)  
**Requirement:** BUS-009, NFR-OFFLINE-001, NFR-PERF-002

### Ringkasan
Inisialisasi workspace monorepo terpadu telah berhasil dilaksanakan:
1. `frontend/`: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (@tailwindcss/vite) + Lucide Icons.
2. `backend/`: FastAPI + Pydantic v2 + Uvicorn + Pytest + Ruff linting/formatting dalam venv terisolasi.
3. Root `package.json` untuk orkestrasi build, test, dan linting terpadu.

### Kesesuaian dengan Code Plan
- File/direktori dibuat: `package.json`, `frontend/`, `backend/app/`, `backend/app/core/config.py`, `backend/app/api/health.py`, `backend/app/main.py`, `backend/pyproject.toml`, `backend/tests/test_health.py`.
- Perintah dijalankan:
  1. `npm create vite@latest frontend -- --template react-ts` -> PASS
  2. `npm --prefix frontend install tailwindcss @tailwindcss/vite ...` -> PASS
  3. `npm --prefix frontend run build` -> PASS (waktu kompilasi 142ms)
  4. `python -m venv backend/.venv` & `pip install ...` -> PASS
  5. `ruff check backend/app` -> PASS (0 errors)
  6. `pytest backend/tests` -> PASS (1 test passed)
- Hasil aktual vs Expected result:
  - Seluruh verifikasi build frontend dan unit test backend lulus 100%.

### Verifikasi
| Komponen | Pemeriksaan | Hasil Aktual | Status |
|---|---|---|---|
| Frontend | TypeScript & Vite Build | Built in 142ms, 0 type errors | PASS |
| Backend | Pytest Health Check Test | 1 passed in 0.70s | PASS |
| Backend | Ruff Linting & Formatting | All checks passed, 0 errors | PASS |
| LibreOffice | System Detection Function | Deteksi PATH & Standard Path Windows | PASS |

### Acceptance Criteria
- [x] Workspace frontend React 18/19 + TypeScript + Vite + Tailwind terpasang dan lolos build
- [x] Workspace backend FastAPI modular terpasang dan lolos ruff linting
- [x] Endpoint `GET /api/health` terimplementasi dengan deteksi kesiapan LibreOffice
- [x] Pytest baseline unit test lulus 100%
- [x] Root `package.json` terkonfigurasi untuk orkestrasi dev, build, dan test

### Status
✅ Selesai dan terverifikasi untuk TASK-2.1.

---

## Task 2.2 — Local Security Architecture & Session Bootstrap — 2026-10-20

**Task:** phase-02.2 — TASK-2.2: Implementasi Loopback Binding, Dynamic Port, Session Bootstrap Cookie, Origin Validation, dan Health Check  
**Requirement:** NFR-SEC-001, FR-021, CTRL-001, CTRL-006

### Ringkasan
Penguatan arsitektur keamanan localhost telah selesai diimplementasikan:
1. `LocalSessionManager` (`backend/app/core/security.py`): Menghasilkan token bootstrap acak kriptografis (32 bytes), token sesi, dan token CSRF. Token bootstrap ditulis secara aman ke file lokal `.local_security/bootstrap.token`.
2. `SecurityMiddleware` (`backend/app/core/middleware.py`):
   - Memblokir seluruh request dengan Origin eksternal/berbahaya (HTTP 403).
   - Menegakkan kewajiban Cookie `HttpOnly; SameSite=Strict` pada endpoint terlindungi `/api/` (HTTP 401 jika absen/salah).
   - Menegakkan validasi header `X-CSRF-Token` pada seluruh mutasi POST/PUT/DELETE/PATCH (HTTP 403 jika absen/salah).
3. `auth_router` (`backend/app/api/auth.py`): Endpoint `/api/auth/bootstrap` untuk menukarkan token lokal bootstrap dengan Cookie sesi HttpOnly dan token CSRF.
4. Security Regression Suite (`backend/tests/test_security.py`): 5 pengujian otomatis mencakup penolakan Origin jahat, endpoint publik vs terproteksi, dan token mismatch.

### Kesesuaian dengan Code Plan
- File dibuat/diubah: `backend/app/core/security.py`, `backend/app/core/middleware.py`, `backend/app/api/auth.py`, `backend/app/main.py`, `backend/tests/test_security.py`.
- Perintah dijalankan:
  1. `pytest backend/tests` -> PASS (6/6 tests passed)
  2. `ruff check backend` & `ruff format backend` -> PASS (0 errors)
  3. `npm --prefix frontend run build` -> PASS (151ms)

### Verifikasi
| Skenario Uji | Command/Tool | Hasil Aktual | Status |
|---|---|---|---|
| Public Health Check | GET /api/health | HTTP 200 OK tanpa autentikasi | PASS |
| Malicious Origin Block | Origin: evil.com | HTTP 403 Forbidden | PASS |
| Protected Endpoint Without Session | GET /api/auth/session | HTTP 401 Unauthorized | PASS |
| Invalid Bootstrap Token | POST /api/auth/bootstrap | HTTP 401 Unauthorized | PASS |
| Valid Bootstrap & CSRF Flow | POST /api/auth/bootstrap + GET /session | HTTP 200 OK + Cookie HttpOnly diset | PASS |
| Code Quality | Ruff check & format | 0 errors, 100% compliant | PASS |

### Acceptance Criteria
- [x] Host bind terkunci pada antarmuka localhost (`127.0.0.1`)
- [x] Origin allowlist memblokir akses dari tab web eksternal
- [x] Session cookie diset dengan `HttpOnly` dan `SameSite=Strict`
- [x] Proteksi CSRF ganda aktif untuk seluruh operasi mutasi data
- [x] 6/6 unit & security regression test lulus 100%

### Status
✅ Selesai dan terverifikasi untuk TASK-2.2.

---

## Ringkasan Penutupan Phase 02: Foundation & Local Architecture
1. **TASK-2.1 (Monorepo Workspace):** Lolos (Vite React 19 TS, Tailwind CSS v4, FastAPI backend, Pytest baseline).
2. **TASK-2.2 (Local Security Architecture):** Lolos (Loopback binding, session bootstrap, Origin allowlist, CSRF enforcement, 6/6 test passed).

Phase 02 resmi **SELESAI (COMPLETED)**. Proyek siap beralih ke **Phase 03: Local Persistence & Project Data Management (IndexedDB)**.






