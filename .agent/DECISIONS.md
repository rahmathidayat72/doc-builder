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

## DEC-005 — Keamanan Session Localhost: Cookie HttpOnly, SameSite, dan Origin Allowlist
- Tanggal: 2026-10-20
- Status: Accepted (sebagian disupersede oleh DEC-013)
- Konteks: Mencegah serangan web (CSRF, DNS rebinding, cross-origin request) dari tab browser lain ke backend localhost.
- Opsi: (1) Port tetap tanpa auth, (2) Token via query param, (3) Cookie HttpOnly + CSRF token + dynamic port + origin allowlist.
- Keputusan: Opsi 3.
- Alasan: Menutup celah eksfiltrasi data PII dan eksekusi subprocess konversi oleh website eksternal.
- Konsekuensi: Frontend dan backend butuh alur bootstrap token saat startup.
- Risiko: Kompleksitas konfigurasi startup script.
- Requirement terkait: NFR-SEC-001, NFR-PRIV-001.
- Catatan 2026-10-24: Nilai `SameSite` aktual adalah `Lax`, bukan `Strict`. Perubahan dan alasan kompatibilitas hostname didokumentasikan pada DEC-013. Kontrol utama tetap Origin allowlist + CSRF token + cookie HttpOnly.

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
- **Catatan Implementasi (2026-10-24):** Implementasi `backend/app/core/sandbox.py` **tidak** menjalankan `unshare`/`bwrap`/`seccomp` atau aturan firewall. Egress restriction hanya berupa `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` ke port tertutup; `max_memory_mb` hanya diterapkan melalui Windows Job Object, bukan Linux memory cap. Status kontrol egress aktual: **GAP/PARTIAL**, dicatat sebagai `RISK-SEC-003`. Status verifikasi spike sebelumnya tidak boleh dipakai sebagai bukti egress block OS-level.
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

## DEC-011 — Model Multi-Website pada Informasi Kontak

- Tanggal: 2026-10-24
- Status: Accepted
- Konteks: Pengguna membutuhkan maksimal tiga tautan portofolio/website pada CV; field `contact.website` saat ini hanya menampung satu nilai dan draft lama sudah tersimpan di IndexedDB.
- Opsi: (1) mengubah tipe `website` menjadi array (breaking), (2) menambah array `websites` sambil mempertahankan `website`, (3) menyimpan daftar di field terpisah di luar contact.
- Keputusan: Opsi 2 — `websites: string[]` sebagai model baru, `website` dipertahankan sebagai fallback/kompatibilitas dan disinkronkan dengan entri pertama yang terisi.
- Alasan: Tidak memerlukan migrasi IndexedDB atau breaking change; draft lama tetap tampil; render/export dapat memakai satu helper normalisasi.
- Konsekuensi: UI, empat template, parser, dan DOCX/PDF wajib memakai normalisasi yang sama; batas maksimal tiga ditegakkan di UI dan fail-safe render/export.
- Risiko: Data eksternal dengan lebih dari tiga entri akan dipotong secara aman; tidak ada validasi URL ketat agar domain tanpa skema tetap diterima.
- Requirement terkait: FR-001, FR-002, FR-005, FR-006, NFR-UX-001.

## DEC-012 — Engine PDF Toolkit Pascarilis: PyMuPDF, Tesseract, dan pymupdf4llm

- Tanggal: 2026-10-24 (retrospective decision record)
- Status: Accepted
- Konteks: Fitur pascarilis Protect/Unlock, Repair/OCR, Watermark/Page Numbers, dan PDF to Markdown membutuhkan pemrosesan PDF lokal tanpa cloud. Traceability lama merujuk DEC-007/DEC-008/DEC-009/DEC-010 yang tidak sesuai dengan decision log aktual.
- Opsi: (1) Layanan cloud/API pihak ketiga, (2) library Python murni terpisah per fitur, (3) PyMuPDF sebagai engine utama dengan Tesseract untuk OCR dan `pymupdf4llm` untuk ekstraksi Markdown.
- Keputusan: Opsi 3. PyMuPDF digunakan untuk enkripsi/dekripsi AES-256, repair xref, watermark, dan penomoran halaman; Tesseract opsional di host untuk OCR; `pymupdf4llm` untuk PDF to Markdown. Seluruh proses berjalan lokal di mesin pengguna.
- Alasan: Satu engine native yang sudah terpasang mengurangi dependensi baru, mempertahankan pemrosesan offline, dan menyediakan API yang konsisten untuk manipulasi PDF.
- Konsekuensi: Lisensi PyMuPDF (AGPL/komersial) harus ditinjau sesuai model distribusi; OCR bergantung pada ketersediaan Tesseract di host dan bersifat fail-closed dengan panduan instalasi.
- Risiko: Perbedaan versi PyMuPDF/Tesseract dapat mengubah hasil; dokumen bertanda tangan digital harus ditolak pada jalur yang dapat merusak tanda tangan. Risiko ini dicatat pada SECURITY.md.
- Requirement terkait: BUS-011, BUS-012, BUS-013, BUS-014, FR-027 s.d. FR-033.

## DEC-013 — SameSite Cookie Sesi: Lax untuk Kompatibilitas Hostname Lokal

- Tanggal: 2026-10-24
- Status: Accepted (melengkapi/menyupersede sebagian DEC-005)
- Konteks: DEC-005 menetapkan `SameSite=Strict`, tetapi runtime `backend/app/api/auth.py` menggunakan `SameSite=Lax`. Frontend dan backend dapat diakses melalui `localhost` atau `127.0.0.1`; nilai yang terlalu ketat dapat memutus alur bootstrap/sesi pada variasi hostname dan port pengembangan.
- Opsi: (1) Mempertahankan `Strict` dan menyamakan seluruh hostname, (2) `Lax` dengan Origin allowlist + CSRF tetap aktif, (3) menonaktifkan SameSite.
- Keputusan: Opsi 2 — `HttpOnly`, `SameSite=Lax`, `Secure=false` hanya untuk loopback HTTP, dengan Origin allowlist dan CSRF token sebagai kontrol utama.
- Alasan: Menjaga alur sesi lokal tetap berfungsi pada variasi `localhost`/`127.0.0.1` tanpa mengorbankan proteksi CSRF yang sudah diuji.
- Konsekuensi: Dokumentasi arsitektur, security, distribusi, dan traceability harus menyebut `Lax`, bukan `Strict`.
- Risiko: `Lax` lebih longgar daripada `Strict` untuk navigasi top-level lintas situs. Risiko dikompensasi oleh Origin allowlist, CSRF token, dan cookie HttpOnly; residual risk ditinjau pada security review berikutnya.
- Requirement terkait: NFR-SEC-001, NFR-PRIV-001, TASK-2.2.

## DEC-014 — Estimasi Pagination dan Preflight Ekspor CV

- Tanggal: 2026-10-24
- Status: Accepted
- Konteks: Preview hanya berupa satu lembar A4 dan pengguna dapat mengekspor CV yang belum lengkap tanpa peringatan. Nama berkas juga dapat memuat karakter yang tidak valid.
- Opsi: (1) True pagination dengan beberapa container halaman, (2) satu lembar kontinu dengan estimasi tinggi dan penanda batas halaman, (3) tanpa indikator halaman.
- Keputusan: Opsi 2 — estimasi jumlah halaman dari tinggi konten yang dirender, overlay penanda batas halaman, dan badge jumlah halaman. Preflight memblokir ekspor pada error dan mewajibkan acknowledgment pada warning. Nama berkas disanitasi di frontend dan backend, dengan fallback `Resume`/`resume`.
- Alasan: Memberi umpan balik halaman yang cukup akurat tanpa merombak struktur render/print dan tanpa memecah kop surat atau section.
- Konsekuensi: `visual-executive` memakai tinggi A4 penuh; template reguler memakai tinggi konten yang dikurangi padding kertas. Overlay halaman adalah indikator visual, bukan pemotongan dokumen fisik.
- Risiko: Estimasi tinggi dapat berbeda dari hasil cetak browser/backend. Pengguna tetap harus memeriksa hasil ekspor; risiko ini diterima sebagai keterbatasan preview.
- Requirement terkait: FR-024, FR-034, FR-035, NFR-UX-001.

## DEC-015 — Model Data CV Terstruktur dan Kompatibilitas Draft Lama

- Tanggal: 2026-10-24
- Status: Accepted
- Konteks: CV membutuhkan headline profesional, pencapaian per pengalaman, deskripsi pendidikan, dan urutan bagian yang dapat diatur, tetapi draft IndexedDB lama tidak memiliki field tersebut.
- Opsi: (1) Migrasi destruktif seluruh draft, (2) field opsional dengan fallback saat render/ekspor, (3) hanya mendukung draft baru.
- Keputusan: Opsi 2 — `headline`, `achievements`, `sectionOrder`, `favorite`, dan `targetJob` bersifat opsional. `achievements` menjadi sumber utama bila ada; jika tidak, `description` lama dipecah menjadi butir. Baris pencapaian kosong dipertahankan selama pengeditan dan difilter saat render/ekspor. `sectionOrder` tidak dikenal difilter dan bagian yang hilang ditambahkan.
- Alasan: Menjaga backward compatibility penuh dan mencegah kehilangan data pengguna.
- Konsekuensi: Semua renderer (4 template, DOCX, PDF) harus memakai helper yang sama; parser dapat mengisi headline dari baris di bawah nama.
- Risiko: Duplikasi logika fallback bila helper tidak dipakai konsisten. Mitigasi: helper terpusat di `types/resume.ts` dan test lintas template/DOCX.
- Requirement terkait: FR-036, FR-037, FR-038, TASK-4.1–TASK-4.4.

## DEC-016 — CV Target, Impor Selektif + Undo, dan Manajemen Draft

- Tanggal: 2026-10-24
- Status: Accepted
- Konteks: Pengguna perlu membuat versi CV untuk lowongan tertentu, menggabungkan hasil impor secara selektif, dan mengelola banyak draft tanpa kehilangan data.
- Opsi: (1) Menimpa draft sumber saat membuat CV target atau impor, (2) membuat salinan/merge selektif dengan undo, (3) memisahkan seluruh alur ke fitur baru.
- Keputusan: Opsi 2 — CV target adalah salinan draft sumber dengan `targetJob` dan skill cocok diurutkan lebih dahulu; draft asli tidak berubah. Impor mendukung `merge`/`replace` per bagian dan undo 30 detik yang hanya mengembalikan bagian terpilih. Daftar draft mendukung pencarian, favorit (tanpa mengubah `updatedAt` saat toggle), rename inline, duplikasi, dan badge target. Inisialisasi menunggu daftar draft selesai dimuat sebelum membuat draft baru.
- Alasan: Mencegah kehilangan data, memberi kontrol granular, dan menghindari draft kosong yang tidak disengaja.
- Konsekuensi: Autosave harus di-flush sebelum berpindah/menduplikasi draft; snapshot undo disimpan di memori sesi.
- Risiko: Snapshot undo hilang jika halaman di-refresh; ini diterima karena undo adalah bantuan sesi, bukan version history.
- Requirement terkait: FR-039, FR-040, FR-041, NFR-REL-004, NFR-UX-001.

> Catatan: ID `DEC-010` tidak pernah digunakan dalam decision log ini. Referensi lama pada `TRACEABILITY.md` yang menunjuk DEC-010 telah diperbaiki ke DEC-012.

## DEC-017 — Audit Trail JSONL Lokal dan Retensi 7 Hari

- Tanggal: 2026-10-27
- Status: Accepted
- Konteks: `RISK-SEC-001` mencatat tidak adanya audit/logging keamanan dan retensi 7 hari. Aplikasi berjalan lokal single-user, sehingga solusi harus ringan, tidak membutuhkan infrastruktur eksternal, dan tidak menambah paparan data.
- Opsi: (1) Structured logging ke file teks biasa, (2) audit trail JSONL dengan permission ketat dan retensi harian, (3) mengirim log ke layanan eksternal.
- Keputusan: Opsi 2 — `AuditLogger` menulis JSONL append-only ke `backend/logs/audit-YYYY-MM-DD.jsonl` dengan direktori `0700`, berkas `0600`, rotasi harian UTC, retensi 7 hari, dan fail-open saat tulis gagal. `SecurityMiddleware` mencatat denial Origin/session/CSRF, error API, dan request `/api/*` yang diizinkan; `/api/health` dikecualikan. Field yang dicatat dibatasi pada metadata aman tanpa body, header, cookie, query string, nama berkas, token, atau PII.
- Alasan: Memenuhi kebutuhan deteksi/forensik dasar tanpa dependensi baru, tetap lokal/offline, dan tidak memperluas permukaan data sensitif.
- Konsekuensi: Penulisan log bersifat sinkron di event loop; volume lokal rendah sehingga diterima. Log belum tamper-evident terhadap pengguna OS yang sama dan belum memiliki batas ukuran harian. `backend/logs/` diabaikan Git.
- Risiko: Disk penuh atau permission gagal tidak menggagalkan request, tetapi event audit hilang; kegagalan hanya dilaporkan sebagai tipe error di stderr. `RISK-SEC-001` tetap OPEN sampai owner menyetujui penutupan berdasarkan bukti 10 test `test_audit.py` dan full suite 136/136 Pytest PASS.
- Requirement terkait: NFR-SEC-001, THR-010, CTRL-010, `RISK-SEC-001`.

## DEC-019 — Halaman Login Penuh Mandiri dan Alur Autentikasi 2-Tahap dengan Tantangan Matematika SD Kelas 1

- Tanggal: 2026-11-11
- Status: Accepted
- Konteks: Popup modal autentikasi kurang nyaman pada perangkat mobile/desktop, dan tantangan anti-bot tidak boleh langsung diekspos sebelum kredensial akun terbukti benar agar tidak mengganggu alur atau membocorkan state.
- Opsi: (1) Modal popup satu langkah (email + password + soal sekaligus), (2) Modal popup dua langkah, (3) Halaman penuh mandiri `#/login` dengan alur verifikasi dua tahap: cek email & kata sandi dahulu (`POST /api/auth/login-init`), baru tampilkan soal matematika SD kelas 1 terikat `user_id` (`POST /api/auth/login-verify`).
- Keputusan: Opsi 3. Seluruh pop-up modal auth dihapus. Dibuat komponen halaman penuh `LoginPage.tsx` yang terdaftar pada workspace `#/login`. Pengguna anonim yang mengakses `#/tools` dialihkan secara otomatis ke `#/login`. Soal matematika SD hanya muncul setelah email dan kata sandi valid.
- Alasan: Pengalaman pengguna lebih fokus, bersih, bebas gangguan modal backdrop, serta mencegah pemborosan komputasi verifikasi bot pada kredensial yang salah.
- Konsekuensi: Frontend mengelola state dua tahap (Step 1 -> Step 2) dan routing hash mengidentifikasi `login` sebagai workspace resmi.
- Risiko: Pengguna perlu melakukan 2 kali submit; diimbangi dengan kejelasan tahapan (Step 1: Kredensial, Step 2: Anti-bot).
- Requirement terkait: BUS-017, FR-042, NFR-UX-001, CR-018.


- Tanggal: 2026-11-08
- Status: Accepted
- Konteks: Doc-builder membutuhkan fitur remove-background untuk pasfoto/dokumen secara online pada VPS Ubuntu 24.04 (1 vCPU, 2.2 GiB RAM, 4.0 GiB swap) tanpa GPU. Penggunaan library `rembg` standar membawa dependensi torch/torchvision yang berat (>800 MB - 1.5 GB disk) dan konsumsi RAM besar (>800 MB) yang memicu OOM/swap thrashing. Selain itu, model ML in-process dapat meninggalkan residual memory leak di runtime Python/FastAPI.
- Opsi: (1) Menggunakan `rembg` in-process dengan PyTorch, (2) memanggil API cloud eksternal berbayar (misal remove.bg), (3) mengadopsi model segmentasi ringan U2NetP ONNX CPU-only (`u2netp.onnx` ~4.36 MB) yang dijalankan via runtime terisolasi `onnxruntime` CPUExecutionProvider (single-thread) di dalam subprocess terisolasi per permintaan.
- Keputusan: Opsi 3 — Menggunakan model bobot mandiri `u2netp.onnx` (~4.36 MB, MD5: `8e83ca70e441ab06c318d82300c84806`) dengan `onnxruntime` CPU-only (`intra_op_num_threads = 1`, `inter_op_num_threads = 1`). Inferensi dijalankan di dalam worker subprocess terpisah yang dihentikan (terminasi) segera setelah gambar selesai diproses, sehingga 100% memori fisik (~356–378 MB peak RSS) dikembalikan ke kernel OS (delta RAM host: 0.00 MB). Arsitektur antrean menerapkan batas ketat: concurrency limit = 1, antrean tunggu maksimal = 2, hard timeout 30 detik, dan penolakan kelebihan beban dengan HTTP 429 + `Retry-After: 30`.
- Alasan: Hasil spike empiris pada 1 vCPU menunjukkan total wall time 1.63s–1.87s (inferensi murni ~1.05s–1.15s), jauh di bawah target SLA 15.0 detik (8x lebih cepat). Peak memory berada di bawah 400 MB, dan terminasi subprocess menjamin zero long-term memory leak pada proses utama FastAPI. Pola fail-closed antrean melindungi VPS dari serangan exhaustion komputasi.
- Konsekuensi: Setiap request inferensi menanggung overhead spawn subprocess dan inisialisasi session ONNX (~90–110 ms), yang sepenuhnya dapat diterima dibandingkan jaminan stabilitas memori RAM host. Binary weights `u2netp.onnx` diabaikan oleh Git via `.gitignore`.
- Risiko: Permintaan serentak tinggi dapat ditolak dengan HTTP 429 jika antrean melebihi 2. Mitigasi: Header `Retry-After: 30` dan penolakan beban lebih deterministik melindungi layanan utama dari kelumpuhan.
- Requirement terkait: BUS-016, FR-046, FR-047, NFR-PERF-005, NFR-REL-005, THR-004, CTRL-004, `RISK-SEC-004`.

## DEC-019 — Arsitektur Layanan Online Multi-Tier (VPS Ubuntu + Cloudflare Edge)

- Tanggal: 2026-11-08
- Status: Accepted
- Konteks: Transformasi dari aplikasi murni desktop lokal menjadi aplikasi hybrid online publik membutuhkan pemisahan concern yang jelas antara komputasi dokumen berat, autentikasi pengguna, dan pengalihan URL berlatensi rendah.
- Opsi: (1) Menjalankan seluruh komponen (termasuk shortener dan ML) di VPS tunggal, (2) Memindahkan seluruh komponen ke serverless AWS/GCP, (3) Membagi arsitektur: VPS Ubuntu 24.04 untuk FastAPI, ML CPU-only, dan database; Cloudflare Workers + D1 untuk edge URL shortener; Cloudflare R2 untuk disaster recovery offsite terenkripsi.
- Keputusan: Opsi 3 — Arsitektur hybrid multi-tier.
- Alasan: VPS tunggal menghemat biaya hosting, sementara edge Workers menjamin latensi 302 redirect < 100 ms tanpa membebani CPU VPS.
- Konsekuensi: Perlu mengelola dua target runtime (Python/FastAPI di VPS dan TypeScript/Wrangler di Cloudflare).
- Risiko: Ketergantungan konfigurasi DNS dan token Cloudflare.
- Requirement terkait: BUS-015, BUS-016, BUS-017, FR-042–FR-048.

## DEC-020 — Rebranding Penuh Satukit, Maskot Kitu, dan Adaptasi Beranda/Dashboard

- Tanggal: 2026-11-08
- Status: Accepted
- Konteks: Nama "Doc-builder" terlalu sempit karena platform kini mencakup 20+ alat digital (CV, konversi, kompresi, editor, OCR, remove background, shortener). Identitas baru "Satukit" ("Satu Tempat, Banyak Solusi Digital") dan maskot resmi "Kitu" telah disetujui sebagai arah kreatif.
- Opsi: (1) Rebranding visual saja (logo dan teks tampilan), (2) Rebranding publik dan identifier internal sekaligus tanpa strategi backward compatibility, (3) Rebranding menyeluruh mencakup nama publik dan identifier internal teknis, dengan strategi dual-read dan backward compatibility penuh.
- Keputusan: Opsi 3 — Rebranding penuh menyeluruh menjadi Satukit. Beranda/Dashboard diadaptasi menerapkan wajah visual Satukit dan maskot Kitu tanpa merombak alur kerja workspace CV Builder dan Alat Dokumen yang sudah stabil. Peluncuran maskot Kitu dilakukan 2 tahap: Tahap 1 menggunakan aset beresolusi tinggi dan fallback transparan yang layak; Tahap 2 animasi individual transparan menyusul setelah aset frame/SVG produksi siap.
- Alasan: Memberikan identitas brand yang matang dan konsisten tanpa menimbulkan breaking change atau kehilangan data draf bagi pengguna.
- Konsekuensi: Perlu memigrasikan IndexedDB, session cookie, localStorage, launcher, package name, dan aset antarmuka secara bertahap.
- Risiko: Regresi visual atau hilangnya data pengguna jika migrasi storage dilakukan secara destruktif. Mitigasi: Kebijakan dual-read, larangan menghapus database lama pada rilis awal, dan pengujian regresi komprehensif.
- Requirement terkait: BUS-018, NFR-UX-002, NFR-ACC-002.

## DEC-021 — Adopsi PostgreSQL Co-located di Host VPS yang Sama

- Tanggal: 2026-11-08
- Status: Accepted
- Konteks: SQLite lokal pada backend FastAPI memiliki keterbatasan konkurensi tulis dan kemampuan pooling untuk beban multi-user online. Diperlukan database relasional yang kuat untuk autentikasi, kuota CV, dan operasional backend.
- Opsi: (1) Tetap menggunakan SQLite WAL mode di VPS, (2) Menggunakan Managed PostgreSQL cloud eksternal (Supabase/Neon/AWS RDS), (3) Menginstal dan menjalankan PostgreSQL langsung di VPS Ubuntu 24.04 yang sama (co-located).
- Keputusan: Opsi 3 — PostgreSQL co-located di host VPS yang sama, dikerjakan sebelum penambahan fitur kuota CV (TASK-11.2) agar tidak terjadi pengerjaan ulang (rework).
- Alasan: Menjaga biaya operasional tetap nol rupiah tambahan (zero cloud bill) dan meminimalkan latensi jaringan antar-layanan (koneksi local socket/loopback).
- Konsekuensi: VPS dengan RAM 2.2 GiB harus mengalokasikan memori secara disiplin antara FastAPI, PostgreSQL (`shared_buffers` konservatif, misal 128 MB), dan worker U2NetP.
- Risiko: Resource contention antara database dan ML worker. Mitigasi: Tuning memori PostgreSQL konservatif, isolasi worker ML dalam subprocess single-thread yang segera terminasi, dan backup berkala terenkripsi ke R2.
- Requirement terkait: BUS-017, FR-042–FR-045, NFR-PERF-006, NFR-SEC-012.

## DEC-022 — Kebijakan Kompatibilitas Format Berkas Project `.docbuilder`

- Tanggal: 2026-11-08
- Status: Accepted
- Konteks: Rebranding menjadi Satukit memunculkan pertanyaan mengenai format berkas proyek ekspor/impor lokal (saat ini berekstensi `.docbuilder` dengan magic `DOCBUILDER_PROJECT`).
- Opsi: (1) Mengubah ekstensi menjadi `.satukit` dan menolak berkas `.docbuilder`, (2) Mengubah ekstensi baru `.satukit` dengan parser dual-format, (3) Mempertahankan ekstensi resmi `.docbuilder` dan wadah `DOCBUILDER_PROJECT` untuk rilis ini.
- Keputusan: Opsi 3 — Format berkas project lokal tetap mempertahankan ekstensi `.docbuilder` dan magic header `DOCBUILDER_PROJECT`.
- Alasan: Berkas proyek yang telah diekspor oleh pengguna sebelumnya tetap dapat diimpor tanpa kendala atau kebingungan kompatibilitas; tidak ada nilai fungsional memecah format berkas pada tahap ini.
- Konsekuensi: Antarmuka UI dapat menyebutnya "Berkas Proyek Satukit (.docbuilder)" agar tetap selaras dengan identitas merek.
- Risiko: Tidak ada risiko breaking change pada data berkas pengguna lama.
- Requirement terkait: BUS-018, FR-017, NFR-COMP-002.

## DEC-023 — Penutupan Entry Point Tidak Aman Google Auth & Shortener Management

- Tanggal: 2026-11-11
- Status: Accepted
- Konteks: Audit keamanan pra-otentikasi mengidentifikasi bahwa endpoint `POST /api/auth/google` mengizinkan pengalihan sesi hanya berdasar payload JSON buatan klien tanpa verifikasi ID token/server OAuth, serta endpoint shortener create/config membuka peluang abuse publik tanpa otorisasi owner.
- Opsi: (1) Membiarkan endpoint aktif hingga backend OAuth selesai, (2) Memblokir endpoint publik seketika dan menurunkan kartu UI publik, namun mempertahankan redirect publik `/s/{slug}` dan dormant service code, (3) Menghapus seluruh tabel dan service shortener/OAuth secara permanen.
- Keputusan: Opsi 2 — Menutup 5 endpoint publik (`POST /api/auth/google`, `POST /api/auth/link-google`, `POST /api/auth/unlink-google`, `POST /api/shortener/create`, `GET /api/shortener/config`), menyelaraskan katalog alat frontend menjadi 24 utilitas, serta mempertahankan rute redirect publik `GET /s/{slug}` dengan counter atomik.
- Alasan: Mencegah spoofing autentikasi dan abuse shortener publik tanpa merusak tautan pendek yang sudah beredar atau memicu migrasi skema destruktif.
- Konsekuensi: Pengguna Google-only sementara waktu tidak dapat masuk via OAuth hingga alur authorization code resmi dibangun.
- Risiko: Tidak ada risiko terhadap fitur anonim.
- Requirement terkait: NFR-SEC-006, NFR-SEC-008, NFR-SEC-009, TASK `AUTH-ACCESS-001`.

## DEC-024 — Hasil Feasibility Spike Bubblewrap Sandbox & ClamAV Daemon Unix Socket (FS-01)

- Tanggal: 2026-11-11
- Status: Accepted
- Konteks: Rak Berkas memproses berkas tidak tepercaya multi-format di VPS Ubuntu 24.04 (1 vCPU, 2.2 GiB RAM). Diperlukan pembuktian protokol streaming antivirus ClamAV `INSTREAM`, penegakan fail-closed saat daemon mati/usang, dan isolasi proses anak parser via bubblewrap dengan batas memori `RLIMIT_AS=512 MiB` dan batas waktu 30 detik.
- Opsi:
  1. Menjalankan parser dan ClamAV langsung di dalam lifespan FastAPI Uvicorn tanpa batasan cgroup/rlimit.
  2. Menggunakan bubblewrap `--unshare-net` dengan `RLIMIT_AS=512 MiB`, ClamAV via daemon Unix socket `INSTREAM` di background worker mandiri, dengan fail-closed jika daemon mati/signature >24 jam.
  3. Mengabaikan ClamAV demi menghemat RAM VPS 2.2 GiB.
- Keputusan: Opsi 2 — Menerapkan isolasi bubblewrap child process (`RLIMIT_AS=512 MiB`, timeout 30s) dan streaming ClamAV Unix socket `INSTREAM` (`/run/clamav/clamd.ctl`). ClamAV adalah mandatory control; jika pengoperasian penuh di VPS 2.2 GiB membuktikan OOM/thrashing, tindakan wajib adalah upgrade RAM VPS ≥4 GiB (bukan menonaktifkan antivirus).
- Alasan:
  - Protokol chunked `INSTREAM` terbukti efisien (latensi streaming < 1 ms untuk sampel PDF).
  - Subproses parser terisolasi membatasi ledakan alokasi memori ke proses anak tanpa merusak proses worker utama.
  - Fail-closed menjamin berkas malware atau saat daemon mati tidak akan lolos ke status `AVAILABLE`.
- Konsekuensi: Background worker `satukit-file-worker` memerlukan instalasi `bubblewrap` dan `clamav-daemon` di host Ubuntu 24.04.
- Risiko: Konsumsi RAM ClamAV daemon (~700 MiB - 1.2 GiB pada VPS). Mitigasi: Swap file 2 GiB terkonfigurasi, tuning worker concurrency = 1, dan mandatory upgrade RAM VPS ≥4 GiB jika host tertekan.
- Requirement terkait: NFR-SEC-013, NFR-PERF-007, NFR-REL-008, TASK `FS-01`, `RISK-SEC-008`, `RISK-SEC-009`.
