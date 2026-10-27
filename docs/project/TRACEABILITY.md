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
| NFR-SEC-001 | NFR-SEC-001 | DEC-005, DEC-013 (Auth/Origin/Cookie) | Phase 02 / TASK-2.2 | Security regression test | 8/8 security test PASS (hotfix 2026-10-21); 126/126 Pytest PASS (2026-10-24) |
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

## 2. Security Threat & Control Traceability

| Threat Scenario | Control ID & Deskripsi | Tipe Kontrol | Task Terkait | Verification Test | Status |
|---|---|---|---|---|---|
| THR-001 (Port scanning) | CTRL-001: Loopback bind 127.0.0.1 & port dari launcher | Preventive | TASK-2.2 | Health endpoint + static launcher inspection | TERVERIFIKASI |
| THR-002 (Temp enumeration)| CTRL-002: UUIDv4 workspace + permission ketat | Preventive | TASK-6.3 | File permission inspection | PARTIAL — permission aktual `0775`; `RISK-SEC-002` |
| THR-003 (SCA / Outdated) | CTRL-003: Lockfile pinning + manual dependency audit | Detective | TASK-8.2 | `pip-audit` & `npm audit` | PARTIAL — PASS 2026-10-21; tidak ada CI/CD |
| THR-004 (Parser exploit) | CTRL-004: Magic bytes, size limit, subprocess timeout; Windows memory cap; Linux memory cap belum ada | Preventive | TASK-1.3, TASK-6.3 | Invalid magic bytes, sandbox, timeout tests | PARTIAL — Linux memory cap belum ada; fuzzing parser belum ada; `RISK-SEC-003` |
| THR-005 (Social engineering)| CTRL-005: Redaksi log & dialog konfirmasi export | Preventive | TASK-2.2 | Log/PII review | PARTIAL — belum ada logging terpusat/SOP redaksi |
| THR-006 (CSRF / Origin) | CTRL-006: Cookie HttpOnly `SameSite=Lax` + CSRF Token + Origin check | Preventive | TASK-2.2 | Origin/session/CSRF regression | TERVERIFIKASI — 8/8 security test PASS (2026-10-21) |
| THR-007 (Privilege escalation)| CTRL-007: Non-root execution & restricted capabilities | Preventive | TASK-1.3 | Process/token inspection | TERIMPLEMENTASI — model deployment; belum ada automated test |
| THR-008 (Lateral movement) | CTRL-008: Egress block OS-level pada worker sandbox | Preventive | TASK-1.3 | Outbound connection test | GAP — hanya proxy env; tidak ada namespace/firewall; `RISK-SEC-003` |
| THR-009 (Temp persistence) | CTRL-009: Per-job cleanup + startup sweep TTL 5m | Preventive | TASK-6.3 | Orphan directory audit | PARTIAL — tidak ada periodic daemon; `RISK-SEC-002` |
| THR-010 (Defense evasion) | CTRL-010: Append-only log with 7-day retention | Detective | TASK-2.2 | Log rotation audit | GAP — logging/audit belum ada; `RISK-SEC-001` |
| THR-011 (Exfiltration) | CTRL-011: Egress block OS-level; flag LibreOffice bukan kontrol utama | Preventive | TASK-6.1 | External link/egress test | GAP/PARTIAL — proxy env saja; regresi external-link belum ada; `RISK-SEC-003` |

**Catatan status:** `TERVERIFIKASI (SPIKE)` dan angka PASS pada tabel ini adalah bukti historis yang tercatat di `.agent/REPORT.md`; bukan klaim bahwa seluruh suite telah dijalankan ulang pada 2026-10-24. Khusus THR-008, spike lama tidak membuktikan egress block karena skrip uji menghormati env proxy yang sama. `GAP` dan `PARTIAL` tidak berarti risk accepted. Lihat `docs/project/SECURITY.md` §12 untuk `RISK-SEC-001`, `RISK-SEC-002`, dan `RISK-SEC-003`.

**Catatan peningkatan CV 2026-10-24:** P0/P1/P2 CV builder tidak menambah endpoint atau transmisi jaringan baru. Data `headline`, `achievements`, `sectionOrder`, `favorite`, dan `targetJob` disimpan pada draft lokal/IndexedDB. Nama berkas ekspor disanitasi di frontend dan backend sebelum dipakai pada `Content-Disposition`; pengujian backend mencakup sanitasi nama. Preflight ekspor gagal-tertutup pada error dan meminta acknowledgment untuk warning.
