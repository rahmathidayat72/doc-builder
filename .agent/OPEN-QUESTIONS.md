# Open Questions

| ID | Pertanyaan | Alasan Penting | Dampak jika Belum Terjawab | Pemilik | Target Waktu | Status |
|---|---|---|---|---|---|---|
| Q-001 | Metrik visual perbandingan apa yang paling objektif untuk mengukur kemiripan layout ≥95% (SSIM, pixel diff, atau structural text box)? | Dibutuhkan tolok ukur otomatis pada corpus uji konversi | Pengujian fidelitas menjadi subjektif | AI / Tech Lead | Phase 1 (Spike) | Terbuka |
| Q-002 | Library Python mana yang paling seimbang antara lisensi permisif, stabilitas, dan fidelitas untuk PDF→DOCX (pdf2docx, PyMuPDF, atau alternatif)? | pdf2docx memiliki dependensi dan lisensi tertentu; PyMuPDF memiliki lisensi AGPL kecuali commercial license | Potensi pelanggaran lisensi atau hasil konversi rusak | AI / Tech Lead | Phase 1 (Spike) | Terbuka |
| Q-003 | Apakah mekanik sandbox Windows (Job Objects / Low Integrity SID) dan Linux (unshare / seccomp / bubblewrap) dapat diabstraksikan tanpa dependensi native yang berat? | Mencegah converter subprocess mengakses network atau file di luar temp directory | Potensi eksfiltrasi file lokal jika dokumen exploit diunggah | AI / Security Owner | Phase 1 (Spike) | Terbuka |
| Q-004 | Berapa ukuran model NLP lokal bilingual maksimum agar tidak membebani cold start ≤5 detik pada RAM 8 GB? | Model transformer terlalu berat; tokenizer/regex/WordNet lebih ringan | Startup lambat dan memory bloat | AI / Tech Lead | Phase 1 (Spike) | Terbuka |
