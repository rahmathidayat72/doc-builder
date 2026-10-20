# Task Tracking

| ID | Phase | Requirement | Task | Dependency | Priority | Status | Verification |
|---|---|---|---|---|---|---|---|
| TASK-1.1 | phase-01 | BUS-005, FR-012 | Feasibility spike library PDF ke DOCX pada corpus kantor/CV/surat | Tidak ada | High | ✅ Selesai dan terverifikasi | Benchmark: durasi <0.5s, memori <3.5MB, recall 100% |
| TASK-1.2 | phase-01 | BUS-004, FR-007, FR-008 | Feasibility spike library NLP lokal bilingual (ID/EN) | Tidak ada | High | ✅ Selesai dan terverifikasi | Benchmark: latensi 1.88ms, memori 169KB, 0 dependensi luar |
| TASK-1.3 | phase-01 | NFR-SEC-001, NFR-SEC-004 | Feasibility spike sandbox subprocess dan network restriction Windows & Linux | Tidak ada | High | ✅ Selesai dan terverifikasi | 4/4 Uji PASS: Job Object, egress block, timeout, env sanitasi |
| TASK-1.4 | phase-01 | NFR-PERF-002, BUS-009 | Feasibility spike packaging executable backend (PyInstaller/Nuitka) | Tidak ada | Medium | ✅ Selesai dan terverifikasi | Cold start 1.289s (SLA ≤5s), ukuran biner 30.5MB |
| TASK-2.1 | phase-02 | BUS-009, NFR-OFFLINE-001 | Setup monorepo/workspace Vite + React + TS dan Python FastAPI + uv | Phase 1 | High | ✅ Selesai dan terverifikasi | Frontend build PASS (142ms), Backend pytest PASS |
| TASK-2.2 | phase-02 | NFR-SEC-001, FR-021 | Implementasi loopback binding, dynamic port, session cookie, dan health check | TASK-2.1 | High | ✅ Selesai dan terverifikasi | 6/6 Pytest test_security.py PASS, Origin & CSRF verified |
| TASK-3.1 | phase-03 | FR-017, FR-018, FR-019 | Implementasi IndexedDB draft storage, autosave, undo delete, dan private mode | TASK-2.1 | High | 📋 Siap | Unit/integration test IndexedDB & migration |
| TASK-3.2 | phase-03 | FR-017, NFR-SEC-001 | Implementasi export/import project dengan opsi enkripsi password | TASK-3.1 | Medium | ⬜ Belum siap | Roundtrip export/import test, encryption test |
| TASK-4.1 | phase-04 | FR-001, FR-002, FR-003, FR-004 | CV Builder Form per bagian + live preview (Tailwind + Radix) | TASK-3.1 | High | ⬜ Belum siap | UI testing, responsive layout test |
| TASK-4.2 | phase-04 | BUS-002, FR-001 | Implementasi 2 template ATS + 2 template visual awal | TASK-4.1 | High | ⬜ Belum siap | Visual rendering test |
| TASK-4.3 | phase-04 | BUS-003, FR-006 | Ekspor CV ke PDF dan DOCX | TASK-4.2 | High | ⬜ Belum siap | Export verification, file integrity check |
| TASK-4.4 | phase-04 | BUS-001, FR-005 | Ekstraksi impor CV lama (PDF/DOCX) dengan review confidence | TASK-4.1 | High | ⬜ Belum siap | Parsing test corpus CV lama |
| TASK-5.1 | phase-05 | BUS-004, FR-007 | Mesin skor ATS struktur 0-100 dan rekomendasi heuristik | TASK-4.1 | High | ⬜ Belum siap | Rule engine unit test, edge case test |
| TASK-5.2 | phase-05 | BUS-004, FR-008, FR-010 | Job matching parser (teks & PDF/DOCX) dan skor relevansi terpisah | TASK-5.1 | High | ⬜ Belum siap | Matching test corpus lowongan |
| TASK-5.3 | phase-05 | FR-011 | Ekspor laporan analisis ATS ke PDF | TASK-5.2 | Medium | ⬜ Belum siap | Export PDF integrity test |
| TASK-6.1 | phase-06 | BUS-005, FR-012 | Orkestrator konversi DOCX ke PDF via LibreOffice headless terisolasi | TASK-1.1, TASK-2.2 | High | ⬜ Belum siap | Fidelitas visual test ≥95% |
| TASK-6.2 | phase-06 | BUS-005, FR-012 | Orkestrator konversi PDF ke DOCX via engine terpilih | TASK-1.1, TASK-6.1 | High | ⬜ Belum siap | Conversion benchmark pada corpus |
| TASK-6.3 | phase-06 | NFR-SEC-004, NFR-REL-003 | Job queueing (1 job aktif), timeout 5 menit, dan per-job cleanup (TTL 5m) | TASK-6.1 | High | ⬜ Belum siap | Concurrency test, timeout & cleanup test |
| TASK-7.1 | phase-07 | FR-013, FR-014, FR-015 | PDF Tools: merge PDF/image, split PDF rentang halaman, PDF to image | TASK-6.3 | Medium | ⬜ Belum siap | Tool functionality integration test |
| TASK-7.2 | phase-07 | FR-016 | Image resize target KB/MB dengan optimasi otomatis dan EXIF stripping | TASK-2.2 | Medium | ⬜ Belum siap | Quality test, EXIF metadata removal test |
| TASK-8.1 | phase-08 | NFR-PERF-001, NFR-COMP-001 | Aksesibilitas WCAG 2.2 AA & Browser testing (Chrome, Edge, Firefox, Safari) | All core | High | ⬜ Belum siap | Axe accessibility test, Playwright multi-browser |
| TASK-8.2 | phase-08 | NFR-SEC-001, SEC Gates | Security scans (Secret, SCA, SAST, DAST baseline) & regression tests | All core | High | ⬜ Belum siap | Scan reports & retest closure |
| TASK-9.1 | phase-09 | BUS-006, OBJ-001 | UAT bersama 10 pengguna uji & verifikasi corpus kemiripan visual ≥95% | All | High | ⬜ Belum siap | UAT report & KPI baseline confirmation |
| TASK-9.2 | phase-09 | BUS-009, NFR-PERF-002 | Packaging distribusi executable Windows & Linux + script start | TASK-9.1 | High | ⬜ Belum siap | Smoke test installer/bundle di fresh OS |
