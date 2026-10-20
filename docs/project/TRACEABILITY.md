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
| OBJ-003, BUS-005 | FR-012 | DEC-003 (LibreOffice) | Phase 06 / TASK-6.1 | Corpus fidelity benchmark | Kemiripan visual ≥95% |
| OBJ-003, BUS-005 | FR-012 | DEC-004 (Spike) | Phase 06 / TASK-6.2 | Conversion accuracy test | Benchmark report PASS |
| BRULE-002, BRULE-003| NFR-REL-002, NFR-SEC-004 | ARCH-03 (Worker Sandbox)| Phase 06 / TASK-6.3 | Concurrency & timeout test | Subprocess cleanup PASS |
| BUS-007 | FR-013, FR-014, FR-015 | ARCH-03 (PyPDF) | Phase 07 / TASK-7.1 | Integration tool test | Merge/split verifikasi PASS |
| BUS-007 | FR-016 | ARCH-03 (Pillow) | Phase 07 / TASK-7.2 | Image optimization test | EXIF stripping audit PASS |
| BRULE-004, BUS-008 | FR-017, FR-018, FR-019 | DEC-006 (IndexedDB) | Phase 03 / TASK-3.1 | IndexedDB persistence test | Crash recovery test PASS |
| BUS-008 | FR-023 | DEC-006 (Encryption) | Phase 03 / TASK-3.2 | AES-GCM roundtrip test | Project file import PASS |
| BUS-009 | NFR-PERF-002 | DEC-001, DEC-002 | Phase 02 / TASK-2.1 | Startup timing test | Startup ≤5s verified |
| NFR-SEC-001 | NFR-SEC-001 | DEC-005 (Auth/Origin) | Phase 02 / TASK-2.2 | Security regression test | Loopback & CSRF test PASS |
| NFR-COMP-002 | NFR-COMP-002 | ARCH-03 | Phase 08 / TASK-8.1 | Playwright multi-browser | 4 Browser matrix PASS |
| OBJ-005 | KPI-005 | ARCH-All | Phase 09 / TASK-9.1 | UAT 10 pengguna uji | UAT sign-off sheet |

## 2. Security Threat & Control Traceability

| Threat Scenario | Control ID & Deskripsi | Tipe Kontrol | Task Terkait | Verification Test | Status |
|---|---|---|---|---|---|
| THR-001 (Port scanning) | CTRL-001: Loopback bind 127.0.0.1 & dynamic port | Preventive | TASK-2.2 | Network interface scan | Plan Approved |
| THR-002 (Temp enumeration)| CTRL-002: UUIDv4 temp dir + 0700 file permission | Preventive | TASK-6.3 | File permission inspection | Plan Approved |
| THR-003 (SCA / Outdated) | CTRL-003: Lockfile pinning + automated dependency audit | Detective | TASK-8.2 | pip-audit & npm audit | Plan Approved |
| THR-004 (Parser exploit) | CTRL-004: Subprocess sandbox, memory/time capping | Preventive | TASK-1.3, TASK-6.3 | Malicious file injection test | Plan Approved |
| THR-005 (Social engineering)| CTRL-005: Log redaction & export confirmation dialog | Preventive | TASK-2.2 | Log content PII regex scan | Plan Approved |
| THR-006 (CSRF / Origin) | CTRL-006: Cookie SameSite=Strict + CSRF Token + Origin check | Preventive | TASK-2.2 | Cross-origin request test | Plan Approved |
| THR-007 (Privilege escalation)| CTRL-007: Non-root execution & restricted capabilities | Preventive | TASK-1.3 | Process token inspection | Plan Approved |
| THR-008 (Lateral movement) | CTRL-008: Network egress block on worker sandbox | Preventive | TASK-1.3 | Outbound connection test | Plan Approved |
| THR-009 (Temp persistence) | CTRL-009: Per-job cleanup + daemon sweeper TTL 5m | Preventive | TASK-6.3 | Orphan directory audit | Plan Approved |
| THR-010 (Defense evasion) | CTRL-010: Append-only log with 7-day retention | Detective | TASK-2.2 | Log rotation audit | Plan Approved |
| THR-011 (Exfiltration) | CTRL-011: Block external resource fetching in converter | Preventive | TASK-6.1 | External link render test | Plan Approved |
