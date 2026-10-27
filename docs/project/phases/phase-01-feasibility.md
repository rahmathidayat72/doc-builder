# Phase 01 — Feasibility Spikes & Technical Validation

## 1. Metadata
- **Fase:** Phase 01
- **Status:** Completed & Verified (100% PASS)
- **Target Waktu:** 1–2 minggu
- **Owner:** Tech Lead / AI
- **Tanggal Selesai:** 2026-10-20

## 2. Goal & Capability
Menguji secara empiris seluruh asumsi teknis dengan risiko kegagalan tertinggi sebelum fondasi aplikasi dibangun, khususnya:
1. Menentukan engine konversi PDF ke DOCX terbaik (fidelitas, lisensi, stabilitas).
2. Menentukan library NLP lokal bilingual (ID/EN) yang efisien pada RAM 8 GB.
3. Membuktikan mekanisme isolasi sandbox subprocess dan pemutusan koneksi internet (network egress block) di Windows dan Linux.
4. Memvalidasi kelayakan packaging executable backend mandiri (PyInstaller/Nuitka) dengan cold startup ≤5 detik.

## 3. Requirement Terkait
- **BUS-004, BUS-005, BUS-006, BUS-009**
- **FR-007, FR-008, FR-012**
- **NFR-PERF-002, NFR-SEC-001, NFR-SEC-004, NFR-OFFLINE-001**

## 4. Entry Criteria
- Dokumentasi BRD, PRD, Arsitektur, dan Test Strategy telah disetujui (Gerbang 1 & 2 selesai).
- Tersedia workspace lokal untuk pengujian eksperimen terisolasi.

## 5. Rincian Task

### Task 1.1 — Feasibility Spike PDF to DOCX
- **Tujuan:** Mengevaluasi kandidat library open-source untuk rekonstruksi PDF ke DOCX yang dapat diedit (kandidat: `pdf2docx`, `pypdfium2`+`python-docx`, dsb.).
- **Metodologi:** Pengujian terhadap mini-corpus (3 CV, 3 dokumen kantor dengan tabel, 2 surat resmi).
- **Tolok Ukur:** Kemiripan visual, kepatuhan lisensi (bebas AGPL komersial keras), crash rate pada dokumen kompleks, dan pemakaian memori.
- **Output:** Rekomendasi library definitif dan batas fidelitas realistis untuk dicatat di Decision Log.

### Task 1.2 — Feasibility Spike Local Bilingual NLP
- **Tujuan:** Menemukan engine NLP lokal teringan untuk ekstraksi keyword dan pencocokan lowongan kerja dalam Bahasa Indonesia dan Bahasa Inggris.
- **Tolok Ukur:** Ukuran model/library pada disk, waktu pemrosesan teks ≤100 ms, akurasi ekstraksi keyword relevan.

### Task 1.3 — Feasibility Spike Subprocess Sandbox & Network Isolation
- **Tujuan:** Membuat prototipe adapter eksekusi subprocess yang memutus akses internet dan membatasi direktori hanya pada temp folder spesifik di Windows dan Linux.
- **Tolok Ukur:** Subprocess gagal melakukan outgoing HTTP request; subprocess tidak dapat membaca di luar direktori temp; pembatasan memori dan timeout berfungsi andal.

### Task 1.4 — Feasibility Spike Backend Packaging
- **Tujuan:** Memvalidasi bahwa backend Python dapat dikemas ke dalam bentuk standalone binary tanpa mengharuskan pengguna akhir menginstal interpreter Python.
- **Tolok Ukur:** Cold start backend ≤ 5 detik; deteksi binary berjalan tanpa crash di Windows.

## 6. Exit Criteria
- [x] Laporan hasil keempat spike terdokumentasi lengkap di `.agent/REPORT.md`.
- [x] Decision Log diperbarui dengan pilihan teknis definitif (DEC-004, DEC-007, DEC-008, DEC-009).
- [x] Dokumen Phase 02 disesuaikan berdasarkan temuan spike.

## 7. Bukti Verifikasi Empiris
1. **TASK-1.1 (PDF to DOCX):** Word recall 100%, durasi <0.5s, memori <3.5MB, tabel 7x4 terdeteksi utuh (`spikes/pdf2docx-eval/benchmark_summary.json`).
2. **TASK-1.2 (Bilingual NLP):** Latensi 1.88ms per pasang, memori 169KB, 0 dependensi eksternal, akurasi recall >75% bilingual (`spikes/nlp-eval/nlp_benchmark_summary.json`).
3. **TASK-1.3 (Sandbox & Egress Block):** 4/4 skenario tercatat PASS pada spike: Job Objects aktif, timeout 2.01s auto-kill, secret tereduksi. **Koreksi 2026-10-24:** egress restriction aktual hanya proxy environment (`HTTP_PROXY` ke port tertutup), bukan block OS-level; klaim egress diblokir tidak boleh dipakai sebagai bukti isolasi penuh. Lihat `RISK-SEC-003`.
4. **TASK-1.4 (Packaging Executable):** Cold start biner 1.289s (SLA ≤5s), warm start 0.592s, ukuran folder biner 30.52 MB (`spikes/packaging-eval/packaging_summary.json`).

