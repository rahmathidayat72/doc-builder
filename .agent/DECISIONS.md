# Decision Log

## DEC-001 — Model Arsitektur: Web Lokal + Backend Lokal
- Tanggal: 2026-10-20
- Status: Accepted
- Konteks: Dibutuhkan pemrosesan dokumen lokal tanpa biaya cloud dan menjaga privasi data/PII pengguna.
- Opsi: (1) Browser-only, (2) Web online self-hosted VPS, (3) Web lokal + backend lokal localhost.
- Keputusan: Opsi 3 (Web lokal + backend lokal).
- Alasan: Browser-only tidak mampu menangani konversi DOCX↔PDF berfidelitas tinggi; VPS menambah biaya dan risiko eksposur data sensitif.
- Konsekuensi: Perlu mendistribusikan runtime backend ke mesin pengguna lokal.
- Risiko: Variasi environment OS lokal (Windows & Linux).
- Requirement terkait: BUS-009, NFR-OFFLINE-001, NFR-SEC-001.

## DEC-002 — Teknologi Stack Utama: React (TypeScript) + FastAPI (Python)
- Tanggal: 2026-10-20
- Status: Accepted
- Konteks: CV builder butuh frontend interaktif modern dan backend konversi/NLP dokumen yang kaya library.
- Opsi: (1) TypeScript penuh (React + Node.js), (2) Python penuh, (3) Hybrid React + FastAPI.
- Keputusan: Opsi 3 (React + Vite + TS di frontend, Python + FastAPI di backend).
- Alasan: Frontend TS memberikan type safety dan UX responsif; Python memiliki ekosistem PDF, DOCX, dan NLP paling matang.
- Konsekuensi: Perlu mengelola dua ekosistem paket (npm dan uv).
- Risiko: Ukuran bundle distribusi executable lebih besar.
- Requirement terkait: FR-001, FR-012, BUS-005.

## DEC-003 — Engine Konversi DOCX ke PDF: LibreOffice Headless
- Tanggal: 2026-10-20
- Status: Accepted
- Konteks: Target kemiripan layout visual ≥95% tanpa layanan cloud berbayar.
- Opsi: (1) Pure Python docx2pdf/weasyprint, (2) LibreOffice headless lokal, (3) Cloud conversion API.
- Keputusan: LibreOffice headless yang dideteksi di sistem pengguna lokal.
- Alasan: LibreOffice memberikan tingkat kompatibilitas layout DOCX paling tinggi di ranah open-source.
- Konsekuensi: Mengharuskan pengguna menginstal LibreOffice jika belum ada; aplikasi memberikan health check panduan.
- Risiko: Perbedaan versi LibreOffice dapat memengaruhi hasil render.
- Requirement terkait: BUS-005, BUS-006, FR-012.

## DEC-004 — Pendekatan PDF ke DOCX: Hasil Feasibility Spike & Pemilihan Library
- Tanggal: 2026-10-20
- Status: Accepted (Hasil Spike Terverifikasi)
- Konteks: Rekonstruksi PDF ke dokumen DOCX yang dapat diedit dengan tata letak kompleks diuji secara empiris pada Task 1.1 menggunakan dataset corpus sintetis (CV standar, dokumen tabel kantor, surat resmi).
- Hasil Spike:
  1. `01_cv_sample.pdf`: Durasi 0.275 detik, memori puncak 3.45 MB, word recall 100%, 2 tabel/blok terdeteksi rapi.
  2. `02_office_table_sample.pdf`: Durasi 0.497 detik, memori puncak 2.85 MB, word recall 100%, tabel 7 baris x 4 kolom terekonstruksi sempurna.
  3. `03_formal_letter_sample.pdf`: Durasi 0.164 detik, memori puncak 2.91 MB, word recall 100%, garis tanda tangan & header rapi.
- Catatan Lisensi Kritis: `pdf2docx` berlisensi MIT, namun bergantung pada `PyMuPDF` yang berlisensi Dual License (GNU AGPL v3 / Artifex Commercial). Untuk penggunaan lokal open-source pribadi pada MVP ini diizinkan, namun jika di masa depan hendak di-hosting online secara tertutup atau dikomersialisasikan tanpa rilis kode sumber, harus menggunakan commercial license dari Artifex atau fallback ke engine alternatif (`pypdfium2` / LibreOffice writer_pdf_import).
- Keputusan: Mengadopsi `pdf2docx` sebagai engine konversi PDF→DOCX default untuk MVP lokal, dengan adapter isolasi subprocess terpisah untuk modularitas lisensi.
- Konsekuensi: Isolasi modularitas adapter engine agar di masa depan engine dapat diganti tanpa menyentuh core API.
- Risiko: Ukuran dependensi binary PyMuPDF (~63 MB) dan OpenCV headless (~43 MB).
- Requirement terkait: BUS-005, BUS-006, FR-012, TASK-1.1.

## DEC-005 — Keamanan Session Localhost: Cookie HttpOnly, SameSite=Strict, dan Origin Allowlist
- Tanggal: 2026-10-20
- Status: Accepted
- Konteks: Mencegah serangan web (CSRF, DNS rebinding, cross-origin request) dari tab browser lain ke backend localhost.
- Opsi: (1) Port tetap tanpa auth, (2) Token via query param, (3) Cookie HttpOnly + CSRF token + dynamic port + origin allowlist.
- Keputusan: Opsi 3.
- Alasan: Menutup celah eksfiltrasi data PII dan eksekusi subprocess konversi oleh website eksternal.
- Konsekuensi: Frontend dan backend butuh alur bootstrap token saat startup.
- Risiko: Kompleksitas konfigurasi startup script.
- Requirement terkait: NFR-SEC-001, NFR-PRIV-001.

## DEC-006 — Penyimpanan Draft Lokal: IndexedDB & Export Project Opsional Enkripsi
- Tanggal: 2026-10-20
- Status: Accepted
- Konteks: Pengguna membutuhkan autosave CV tanpa akun dan privasi pada perangkat bersama.
- Opsi: (1) LocalStorage, (2) SQLite di backend, (3) IndexedDB di browser dengan backup file project.
- Keputusan: Opsi 3.
- Alasan: IndexedDB mendukung volume data dan binary blob/foto; file project memungkinkan portabilitas antar perangkat.
- Konsekuensi: Perlu mekanisme migrasi skema berversi di IndexedDB.
- Risiko: Pengguna membersihkan browser cache dapat menghapus draft lokal jika belum diekspor.
- Requirement terkait: FR-017, FR-019, NFR-SEC-001.

## DEC-007 — Engine NLP Lokal Bilingual: Hybrid Rule-Based Taksonomi + Okapi BM25 Ringan
- Tanggal: 2026-10-20
- Status: Accepted (Hasil Spike Terverifikasi)
- Konteks: Dibutuhkan evaluasi skor struktur ATS dan job matching relevansi dalam Bahasa Indonesia & Inggris secara deterministik, offline, tanpa dependensi library eksternal yang besar (NFR-PRIV-001, NFR-PERF-001).
- Opsi: (1) Model transformer lokal (spaCy/HuggingFace), (2) NLTK/Sastrawi eksternal, (3) Hybrid pure Python dictionary matcher + Okapi BM25 ranker.
- Keputusan: Opsi 3 (Hybrid Pure Python Taksonomi N-Gram + Okapi BM25).
- Hasil Spike:
  - Rata-rata latensi pemrosesan: 1.88 ms per pasangan CV & lowongan (jauh melampaui target ≤200 ms).
  - Puncak pemakaian memori: 169.34 KB (jauh di bawah batas 10 MB).
  - Kepatuhan lisensi: 100% bebas copyleft / zero external dependencies.
  - Akurasi ekstraksi keahlian (skill recall) mencapai >75% pada pengujian multi-domain ID/EN dan cross-language.
- Konsekuensi: Kamus istilah dan taksonomi sinonim dipelihara dalam modul internal data dictionary yang terstruktur.
- Risiko: Perlu pembaruan berkala pada kamus kata kunci industri baru.
- Requirement terkait: BUS-004, FR-007, FR-008, TASK-1.2.

## DEC-008 — Mekanisme Isolasi Sandbox Subprocess & Pembatasan Egress Jaringan
- Tanggal: 2026-10-20
- Status: Accepted (Hasil Spike Terverifikasi)
- Konteks: Eksekusi converter file dokumen tidak tepercaya harus terisolasi dari akses jaringan lokal/internet, membatasi hak akses file hanya pada working dir temporer, dan mencegah kebocoran secret (NFR-SEC-001, NFR-SEC-004, CTRL-004, CTRL-008).
- Opsi: (1) Menjalankan subprocess tanpa isolasi, (2) Bergantung pada container Docker wajib, (3) Native OS Sandbox Adapter (Windows Job Objects via ctypes + env redaction + proxy nullification; Linux unshare/bwrap).
- Keputusan: Opsi 3 (Native OS Sandbox Adapter).
- Hasil Spike:
  - Eksekusi normal di folder temporer terisolasi: PASS (exit code 0).
  - Percobaan akses keluar jaringan (egress): BLOCKED (ditolak dan ditandai `DOCBUILDER_NETWORK_BLOCKED`).
  - Penegakan timeout: PASS (proses loop di-kill tepat waktu pada 2.01s tanpa proses zombie).
  - Sanitasi environment: PASS (variabel sensitif seperti SECRET_KEY dan AWS_* terhapus dari child process).
- Konsekuensi: Seluruh eksekusi worker eksternal (LibreOffice dan converter biner) wajib melalui `run_sandboxed_subprocess()`.
- Risiko: Perbedaan kapabilitas sandbox OS tertentu ditangani dengan strategi fail-closed.
- Requirement terkait: NFR-SEC-001, NFR-SEC-004, CTRL-004, CTRL-008, TASK-1.3.

## DEC-009 — Strategi Packaging Backend Executable Mandiri (Onedir Distribution)
- Tanggal: 2026-10-20
- Status: Accepted (Hasil Spike Terverifikasi)
- Konteks: Pengguna akhir tidak boleh dibebani kewajiban menginstal Python, virtualenv, atau dependensi backend secara manual (BUS-009, NFR-PERF-002).
- Opsi: (1) Mengharuskan pengguna menginstal Python, (2) PyInstaller `--onefile`, (3) PyInstaller `--onedir` terdistribusi portable.
- Keputusan: Opsi 3 (PyInstaller `--onedir` Portable).
- Hasil Spike:
  - Cold startup time biner: 1.289 detik (jauh di bawah batas toleransi SLA ≤ 5.0 detik).
  - Warm startup average: 0.592 detik.
  - Ukuran folder distribusi biner: 30.52 MB (sangat ringkas dan portabel).
  - Respon API health check 200 OK konsisten.
- Alasan: `--onefile` lambat karena melakukan dekompresi biner ke temp directory setiap kali dijalankan (2-4 detik), sedangkan `--onedir` langsung dieksekusi tanpa overhead dekompresi.
- Konsekuensi: Script start peluncur aplikasi akan memanggil executable di folder distribusi backend internal.
- Risiko: Perlu pipeline build terpisah saat kompilasi rilis Windows vs Linux.
- Requirement terkait: BUS-009, NFR-PERF-002, TASK-1.4.
