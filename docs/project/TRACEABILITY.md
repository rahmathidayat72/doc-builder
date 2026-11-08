# Traceability Matrix (TRACEABILITY.md)

## 1. Requirement Traceability Matrix (Business to Implementation & Verification)

| Business Obj / Req | Product Req | Architecture / Decision | Phase / Task | Test Strategy | Verification Evidence |
|---|---|---|---|---|---|
| OBJ-001, BUS-001 | FR-001, FR-002 | DEC-002 (React+TS) | Phase 04 / TASK-4.1 | Unit test reducer, UI testing | Vitest PASS |
| BUS-002 | FR-004 | DEC-002 (Tailwind) | Phase 04 / TASK-4.2 | Visual rendering test | Snapshot test PASS |
| BUS-003 | FR-006 | DEC-002, DEC-003 | Phase 04 / TASK-4.3 | Integration export test | File integrity check PASS |
| BUS-001 | FR-005 | DEC-002 | Phase 04 / TASK-4.4 | Parsing test corpus CV lama | Ekstraksi validasi PASS |
| OBJ-002, BUS-004 | FR-007, FR-009 | DEC-002 | Phase 05 / TASK-5.1 | Deterministic rule test | Pytest unit test PASS |
| BUS-004 | FR-008, FR-010 | DEC-002 | Phase 05 / TASK-5.2 | Job matching parser test | Test corpus lowongan PASS |
| BUS-004 | FR-011 | DEC-002 | Phase 05 / TASK-5.3 | PDF export test | Report PDF check PASS |
| OBJ-003, BUS-005 | FR-012 | DEC-003 (LibreOffice) | Phase 06 / TASK-6.1 | Corpus fidelity benchmark | Fidelitas field/teks 100%; metrik visual formal belum ditetapkan (`Q-001`) |
| OBJ-003, BUS-005 | FR-012 | DEC-004 (Spike) | Phase 06 / TASK-6.2 | Conversion accuracy test | Benchmark report PASS |
| BRULE-002, BRULE-003| NFR-REL-002, NFR-SEC-004 | ARCH-03 (Worker Sandbox)| Phase 06 / TASK-6.3 | Concurrency & timeout test | Subprocess cleanup PASS |
| BUS-007 | FR-013, FR-014, FR-015 | ARCH-03 (PyPDF) | Phase 07 / TASK-7.1 | Integration tool test | Merge/split verifikasi PASS |
| BUS-007 | FR-016 | ARCH-03 (Pillow) | Phase 07 / TASK-7.2 | Image optimization test | EXIF stripping audit PASS |
| BRULE-004, BUS-008 | FR-017, FR-018, FR-019 | DEC-006 (IndexedDB) | Phase 03 / TASK-3.1 | IndexedDB persistence test | Crash recovery test PASS |
| BUS-008 | FR-023 | DEC-006 (Encryption) | Phase 03 / TASK-3.2 | AES-GCM roundtrip test | Project file import PASS |
| BUS-009 | NFR-PERF-002 | DEC-001, DEC-002 | Phase 02 / TASK-2.1 | Startup timing test | Startup ≤5s verified |
| NFR-SEC-001 | NFR-SEC-001 | DEC-005, DEC-013 (Auth/Origin/Cookie), DEC-017 (Audit Trail) | Phase 02 / TASK-2.2; post-release / SEC-AUDIT-001 | Security regression test; audit trail & rotasi | 8/8 security test PASS (hotfix 2026-10-21); 136/136 Pytest PASS (2026-10-27), termasuk 10/10 `test_audit.py` |
| NFR-COMP-002 | NFR-COMP-002 | ARCH-01 | Phase 08 / TASK-8.1 | Automated axe/WCAG; Playwright NOT AVAILABLE | 68/68 Vitest PASS (historis); cross-browser E2E **NOT VERIFIED** (`Q-005`) |
| OBJ-005 | KPI-005 | ARCH-All | Phase 09 / TASK-9.1 | UAT 10 pengguna uji | UAT sign-off sheet |
| BUS-011 | FR-027, FR-028 | DEC-012 (PyMuPDF AES-256) | post-release / FEATURE-PDF-SECURITY-001 | Unit & Integration Test (protect & unlock roundtrip, signature reject, password validation) | Pytest 38/38 & Vitest 150/150 PASS |
| BUS-012 | FR-029, FR-030 | DEC-012 (PyMuPDF Repair & OCR) | post-release / FEATURE-PDF-REPAIR-OCR-001 | Unit & Integration Test (reconstruct xref, corrupt salvage, OCR status & searchable generation) | Pytest 41/41 & Vitest 162/162 PASS |
| BUS-013 | FR-031, FR-032 | DEC-012 (Watermark & Page Numbers) | post-release / FEATURE-PDF-WATERMARK-PAGENO-001 | Unit & Integration Test (text/image watermark, 3x3/mosaic grid, numbering formats, skip cover) | Pytest 44/44 & Vitest 173/173 PASS |
| BUS-014 | FR-033 | DEC-012 (PDF to Markdown) | post-release / FEATURE-PDF-TO-MARKDOWN-001 | Unit & Integration Test (markdown extraction, headings/lists/tables, target pages, copy & download) | Pytest 45/45 & Vitest 179/179 PASS |
| BUS-001, BUS-003 | FR-001, FR-002, FR-005, FR-006 | DEC-002, DEC-011 (model multi-website) | post-release / FEATURE-CV-MULTI-WEBSITE-001 | Unit & UI test (tambah/hapus maks. 3, fallback legacy, 4 template, DOCX maks. 3) | 183/183 Vitest & 121/121 Pytest PASS |
| BUS-001, BUS-003 | FR-024, FR-034, FR-035 | DEC-014 (pagination, preflight, filename) | post-release / IMPROVEMENT-CV-PREEXPORT-001 | Unit/UI test pagination & preflight; backend filename sanitization | 233/233 Vitest & 126/126 Pytest PASS (2026-10-24); Vite build PASS |
| BUS-001, BUS-002, BUS-003 | FR-036, FR-037, FR-038 | DEC-015 (structured CV data + legacy fallback) | post-release / IMPROVEMENT-CV-STRUCTURED-001 | Editor reorder/date validation; 4 template & DOCX rendering; parser headline/location | 233/233 Vitest & 126/126 Pytest PASS; Ruff PASS |
| BUS-001, BUS-003, BUS-004, BUS-008 | FR-039, FR-040, FR-041 | DEC-016 (targeted draft, selective import, draft management) | post-release / IMPROVEMENT-CV-WORKFLOW-001 | Merge/replace/undo, targeted draft, Navbar/App integration, favorite sorting | 233/233 Vitest & 126/126 Pytest PASS; Vite build PASS; Oxlint 0 error |
| BUS-016 | FR-046, FR-047 | ARCH-04, DEC-018 (U2NetP CPU-only subprocess, queue max 2, timeout 30s) | Phase 10 / TASK-10.1 & Phase 13 / TASK-13.1 | Benchmark latensi ≤ 15s, peak RSS < 400 MB, queue rejection 429, alpha channel inspection | TASK-10.1 Selesai (latensi 1.63s-1.87s, peak RSS 356-378MB, zero leak 0.00MB) |
| BRULE-003, BRULE-014 | NFR-REL-007, NFR-SEC-012 | ARCH-02, ARCH-06 (workspace 0700, sweeper TTL 1h, disk fail-closed 70%/80%) | Phase 10 / TASK-10.2 | Permission check 0700, TTL sweeper test, disk guard simulation | TERVERIFIKASI — test_job_manager.py (8/8), test_disk_guard.py (4/4), test_health.py (1/1); 152/152 Pytest PASS |
| BUS-017, BRULE-013 | FR-042 | ARCH-03, DEC-019 (Argon2id hashing, Google OAuth, anti-auto-merge guard) | Phase 11 / TASK-11.1 & TASK-11.4 | Auth regression, password strength, account linking takeover negative test | Menunggu eksekusi Phase 11 |
| BUS-017, BRULE-004, BRULE-005 | FR-043, FR-044 | ARCH-03, ARCH-06 (max 5 CV, retensi 90 hari, sweeper harian) | Phase 11 / TASK-11.2 | Quota overflow test (CV ke-6), 90-day retention sweeper test, read/download untouched updated_at | Menunggu eksekusi Phase 11 |
| BUS-017, BRULE-010 | FR-045 | ARCH-03, DEC-020 (Brevo API adapter, no-PII email, H-14/H-7/H-1 warning) | Phase 11 / TASK-11.3 | Email payload inspection (zero CV content), outbox retry test, mock Brevo API test | Menunggu eksekusi Phase 11 |
| BUS-015, BRULE-011, BRULE-012 | FR-048 | ARCH-05, DEC-021 (Cloudflare Workers + D1, direct 302, anti-SSRF, HMAC auth, no slug reuse) | Phase 12 / TASK-12.1 s/d TASK-12.3 | Miniflare edge test: 302/404/410 status, SSRF negative matrix, HMAC signature replay test | Menunggu eksekusi Phase 12 |
| BUS-017, BRULE-005 | NFR-SEC-010 | ARCH-06, DEC-022 (Encrypted backup R2 AES-256-GCM, 7d lifecycle) | Phase 13 / TASK-13.2 | Encrypted snapshot inspection, offsite decryption rehearsal, R2 lifecycle deletion verification | Menunggu eksekusi Phase 13 |

## 2. Security Threat & Control Traceability

| Threat Scenario | Control ID & Deskripsi | Tipe Kontrol | Task Terkait | Verification Test | Status |
|---|---|---|---|---|---|
| THR-001 (Port scanning) | CTRL-001: Loopback bind 127.0.0.1 & port dari launcher | Preventive | TASK-2.2 | Health endpoint + static launcher inspection | TERVERIFIKASI |
| THR-002 (Temp enumeration)| CTRL-002: UUIDv4 workspace + permission ketat (0700) | Preventive | TASK-6.3, TASK-10.2 | File permission inspection | TERVERIFIKASI — `_ensure_secure_dir` 0700 diuji di test_job_manager.py (`RISK-SEC-002` MITIGATED) |
| THR-003 (SCA / Outdated) | CTRL-003: Lockfile pinning + manual dependency audit | Detective | TASK-8.2, TASK-14.1 | `pip-audit` & `npm audit` | PARTIAL — PASS 2026-10-21; periodic scan di Phase 14 |
| THR-004 (Parser exploit) | CTRL-004: Magic bytes, size limit, subprocess timeout; Windows memory cap; Linux memory cap belum ada | Preventive | TASK-1.3, TASK-6.3 | Invalid magic bytes, sandbox, timeout tests | PARTIAL — Linux memory cap belum ada; fuzzing parser belum ada; `RISK-SEC-003` |
| THR-005 (Social engineering)| CTRL-005: Redaksi log & dialog konfirmasi export | Preventive | TASK-2.2 | Log/PII review | PARTIAL — belum ada logging terpusat/SOP redaksi |
| THR-006 (CSRF / Origin) | CTRL-006: Cookie HttpOnly `SameSite=Lax` + CSRF Token + Origin check | Preventive | TASK-2.2 | Origin/session/CSRF regression | TERVERIFIKASI — 8/8 security test PASS (2026-10-21) |
| THR-007 (Privilege escalation)| CTRL-007: Non-root execution & restricted capabilities | Preventive | TASK-1.3, TASK-14.2 | Process/token inspection | TERIMPLEMENTASI — model deployment; non-root VPS di Phase 14 |
| THR-008 (Lateral movement) | CTRL-008: Egress block OS-level pada worker sandbox | Preventive | TASK-1.3 | Outbound connection test | GAP — hanya proxy env; tidak ada namespace/firewall; `RISK-SEC-003` |
| THR-009 (Temp persistence) | CTRL-009: Per-job cleanup + startup sweep TTL 5m / 1h | Preventive | TASK-6.3, TASK-10.2 | Orphan directory audit | TERVERIFIKASI — BackgroundSweeper daemon thread (300s) + TTL 3600s diuji di test_job_manager.py |
| THR-010 (Defense evasion) | CTRL-010: Append-only log with 7-day retention | Detective | SEC-AUDIT-001 | Audit permission, retensi, concurrency, denial/request logging | TERVERIFIKASI — 10/10 `test_audit.py` PASS; `RISK-SEC-001` closure pending owner |
| THR-011 (Exfiltration) | CTRL-011: Egress block OS-level; flag LibreOffice bukan kontrol utama | Preventive | TASK-6.1 | External link/egress test | GAP/PARTIAL — proxy env saja; regresi external-link belum ada; `RISK-SEC-003` |
| THR-012 (Password attacks) | CTRL-012: Hashing Argon2id, rate limiting login per IP & akun, single-use reset token 15m | Preventive | TASK-11.1 | Brute-force simulation, timing attack review | TERRENCANA (ONLINE) — Phase 11 (`RISK-SEC-006`) |
| THR-013 (Account takeover) | CTRL-013: Dilarang auto-merge akun email/password dengan Google OAuth; linking via re-auth | Preventive | TASK-11.1 | Auto-merge negative test | TERRENCANA (ONLINE) — Phase 11 (`RISK-SEC-006`) |
| THR-014 (SSRF URL Shortener)| CTRL-014: Validasi wajib HTTPS publik, penolakan IP internal RFC 1918/loopback/link-local | Preventive | TASK-12.2 | SSRF payload negative test suite | TERRENCANA (ONLINE) — Phase 12 (`RISK-SEC-005`) |
| THR-015 (ML Resource DoS) | CTRL-015: Concurrency = 1, queue max 2, penolakan 429 Retry-After, timeout 30s, free RAM | Preventive | TASK-10.1 | Load spike test, RAM consumption benchmark | TERVERIFIKASI — benchmark scripts/spike_u2netp.py lulus seluruh ambang (DEC-018) |
| THR-016 (Data Loss / Leak) | CTRL-016: Kuota 5 CV, retensi 90d, backup R2 terenkripsi AES-256-GCM, lifecycle 7d | Preventive & Recover | TASK-11.2, TASK-13.2 | Retention cleanup test, backup restore rehearsal | TERRENCANA (ONLINE) — Phase 11 & 13 (`RISK-SEC-007`) |

**Catatan status:** `TERVERIFIKASI (SPIKE)` dan angka PASS pada tabel ini adalah bukti historis yang tercatat di `.agent/REPORT.md`; bukan klaim bahwa seluruh suite telah dijalankan ulang pada 2026-10-24. Khusus THR-008, spike lama tidak membuktikan egress block karena skrip uji menghormati env proxy yang sama. `GAP` dan `PARTIAL` tidak berarti risk accepted. Lihat `docs/project/SECURITY.md` §12 untuk `RISK-SEC-001`, `RISK-SEC-002`, dan `RISK-SEC-003`.

**Catatan audit 2026-10-27:** `SEC-AUDIT-001` mengimplementasikan audit trail JSONL lokal (`backend/app/core/audit.py`) dan 10 test di `backend/tests/test_audit.py`. Full suite 136/136 Pytest PASS, Ruff PASS, secret scan 180 file 0 temuan. THR-010 berubah dari `GAP` menjadi `TERVERIFIKASI`; penutupan `RISK-SEC-001` tetap menunggu approval owner.

**Catatan peningkatan CV 2026-10-24:** P0/P1/P2 CV builder tidak menambah endpoint atau transmisi jaringan baru. Data `headline`, `achievements`, `sectionOrder`, `favorite`, dan `targetJob` disimpan pada draft lokal/IndexedDB. Nama berkas ekspor disanitasi di frontend dan backend sebelum dipakai pada `Content-Disposition`; pengujian backend mencakup sanitasi nama. Preflight ekspor gagal-tertutup pada error dan meminta acknowledgment untuk warning.
