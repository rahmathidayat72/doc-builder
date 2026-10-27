# Open Questions

| ID | Pertanyaan | Alasan Penting | Status | Resolusi/Bukti | Pemilik | Target/Review |
|---|---|---|---|---|---|---|
| Q-001 | Metrik visual formal apa yang dipakai untuk membuktikan kemiripan layout ≥95% (SSIM, pixel diff, atau structural text box)? | Klaim fidelitas visual harus punya metode pengukuran yang dapat direproduksi | Sebagian terbuka | Benchmark 2026-10-21 mengukur round-trip field/teks dan mencapai 100%; belum ada perbandingan visual formal (SSIM/pixel diff). Lihat `docs/project/UAT-REPORT.md` dan `scripts/benchmark_corpus.py`. | User / Tech Lead | Sebelum klaim fidelitas visual berikutnya |
| Q-002 | Library Python mana yang paling seimbang antara lisensi permisif, stabilitas, dan fidelitas untuk PDF→DOCX? | Menentukan engine konversi dan kewajiban lisensi | Tertutup | `DEC-004` memilih `pdf2docx`; TASK-1.1 mencatat recall 100%, durasi <0.5s, memori <3.5MB, tabel 7x4 utuh. | User / Tech Lead | Selesai 2026-10-20 |
| Q-003 | Apakah sandbox Windows/Linux dapat diabstraksikan tanpa dependensi native berat? | Mencegah converter mengakses network atau file di luar temp directory | Tertutup (dengan gap) | Abstraksi `run_sandboxed_subprocess()` tersedia dan dipakai. Namun egress block aktual hanya proxy env, bukan isolasi OS-level; Linux belum memiliki memory cap. Gap dicatat sebagai `RISK-SEC-003`; jangan memakai klaim “4/4 egress PASS” sebagai bukti isolasi penuh. | User / Security Owner | Review risiko 2026-10-31 |
| Q-004 | Berapa ukuran model NLP lokal maksimum agar cold start ≤5 detik pada RAM 8 GB? | Model transformer berisiko memperlambat startup dan memakai memori besar | Tertutup | `DEC-007` memilih hybrid pure Python + Okapi BM25; TASK-1.2 mencatat latensi 1.88ms, memori 169KB, 0 dependensi eksternal. | User / Tech Lead | Selesai 2026-10-20 |
| Q-005 | Apakah cross-browser E2E dengan Playwright diperlukan untuk memenuhi NFR-COMP-002, atau cukup verifikasi manual? | Traceability lama mengklaim “4 Browser matrix PASS”, tetapi tidak ada dependency/konfigurasi Playwright dan TASK-8.1 hanya menjalankan Vitest + axe | Terbuka | Tidak ditemukan `playwright.config.*`, dependency Playwright, atau file E2E. Klaim pada `TRACEABILITY.md` sudah dikoreksi menjadi NOT VERIFIED. | User | Sebelum release berikutnya |
| Q-006 | Bagaimana kebijakan repository untuk `docs/conversations.json`? | File ini berisi 178 transkrip percakapan dan berpotensi bertentangan dengan `AGENTS.md` §3.13 tentang larangan menyalin transkrip privat | Terbuka | File masih tracked di Git. Belum dihapus/diubah karena memerlukan keputusan owner dan rencana penanganan history. | User | Sebelum commit/release berikutnya |

## Catatan

- Q-001 sampai Q-004 adalah pertanyaan Phase 1 yang sudah lama tidak diperbarui. Statusnya kini diselaraskan dengan decision log dan laporan task, bukan lagi “Terbuka / Phase 1”.
- Q-005 dan Q-006 ditemukan pada audit dokumentasi 2026-10-24 dan tidak mengubah status rilis atau security gate.
- Risiko security yang belum ditutup dicatat di `docs/project/SECURITY.md` sebagai `RISK-SEC-001`, `RISK-SEC-002`, dan `RISK-SEC-003`.
