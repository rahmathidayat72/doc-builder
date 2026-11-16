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

---

## DEC-025 — Parameter Empiris Inpainting OpenCV TELEA, DPI Rasterisasi PDF, dan Heuristik Deteksi Struktural Watermark

- Tanggal: 2026-11-12
- Status: Accepted
- Konteks: Task `RW-01` mengevaluasi 13 berkas corpus sintetis (`spikes/watermark-eval/eval_watermark.py`, hasil di `spikes/watermark-eval/benchmark_summary.json`) untuk mengunci parameter default fitur Hapus Watermark (`CR-020`, `FR-058`) agar aman pada VPS 1 vCPU / 2.2 GiB RAM tanpa mengorbankan kualitas gambar atau teks PDF non-target.
- Opsi:
  1. Memakai `inpaintRadius = 3` / `5` / `7` dengan `cv2.INPAINT_TELEA` dan rasterisasi PDF pada `150 DPI` vs `200 DPI`.
  2. Mendeteksi teks berulang PDF murni dari kesamaan string & posisi vs penyaringan heuristik watermark (rotasi non-horizontal, ukuran font besar >=20pt, warna pudar/aksen, atau kata kunci watermark).
- Keputusan:
  1. Menetapkan algoritma default **`cv2.INPAINT_TELEA`** dengan **`inpaintRadius = 5`**, **`brush_dilate_px = 3`**, dan **rasterisasi halaman target PDF pada `150 DPI`**, dijalankan di bawah **`ConversionJobManager` (`concurrency = 1`)** serta batas `MAX_PIXELS = 50_000_000` dan maks `50` halaman analisis interaktif PDF.
  2. Menetapkan **heuristik penyaring teks watermark struktural PDF** (rotasi / font besar / tint pudar / kata kunci) + pencocokan hash biner `xref` gambar berulang (mengecualikan gambar full-page scan >85% luas halaman) serta penghapusan struktural `Stamp`/`Watermark`/`FreeText` annotation tanpa rasterisasi halaman.
  3. Menetapkan **mask koordinat ternormalisasi `0..1`** untuk kompatibilitas antara canvas preview UI dan resolusi penuh backend, serta menyetujui **OCR Tesseract bersifat opsional/non-blocking** (kegagalan/absen lokal fallback ke struktural + kuas manual).
- Alasan:
  - `inpaintRadius = 5` meningkatkan mean PSNR menjadi `30.65 dB` (+0.58 dB di atas `radius=3` `30.07 dB`) dengan rata-rata waktu `284.17 ms`/gambar; `radius=7` hanya menambah +0.24 dB (`30.89 dB`) tetapi memperlambat hampir 2x lipat (`542.62 ms`).
  - Rasterisasi PDF `150 DPI` membutuhkan `40.97 MiB` puncak heap Python dan `976.90 ms` per 2 halaman (`216.90 MiB` RSS kerja), jauh lebih hemat dibanding `200 DPI` (`72.07 MiB` heap / `1678.04 ms` / `294.61 MiB` peak RSS) dengan akurasi scaling mask IoU `0.982–0.998`.
  - Heuristik struktural memangkas false positive baris paragraf/tabel berulang dari `32` hit palsu menjadi `0` pada `01_pdf_stamp_annot` dan `04_pdf_repeated_logo`, sambil menangkap `100%` `02_pdf_repeated_text` (2/2) dan `03_pdf_satukit_text_watermark` (12/12 span rotasi mosaic).
  - Penghapusan annotation struktural selesai dalam `18.79 ms` dengan `0` halaman diraster dan `100%` teks vektor utuh; PNG RGBA mempertahankan kanal alpha identik byte-per-byte (`alpha_channel_exact_preserved = true`); seluruh gambar output bersih dari metadata EXIF.
- Konsekuensi:
  - Halaman PDF dengan teks watermark menyatu tetap membutuhkan rasterisasi selektif (hanya halaman target, non-target tetap vektor) dan dialog konfirmasi eksplisit di UI.
  - Penggunaan axis-aligned bounding box penuh pada watermark diagonal di dokumen teks padat menurunkan PSNR (`23.65 dB` pada `10_document_scan_wm`) karena menutupi teks di sekitarnya; oleh karena itu editor kuas manual tambah/hapus pada `RW-04` wajib tersedia untuk mengetatkan mask.
- Risiko: Sampel nyata pengguna di lapangan (scan miring/kompresi berat) belum diuji langsung karena spike memakai corpus sintetis; jika pengguna menyuplai sampel nyata nanti, validasi visual ulang dilakukan sebelum release.
- Requirement terkait: `CR-020`, `BUS-026`, `BRULE-015`, `FR-058`, `THR-032` s/d `THR-036`, `RW-01` s/d `RW-06`.

---

## DEC-026 — Arsitektur Streaming, Antrean PostgreSQL, Worker Terpisah, dan Preset FFmpeg untuk Compress Video (`CR-021`)

- Tanggal: 2026-11-12
- Status: Accepted
- Konteks: Penambahan fitur **Compress Video** (`CR-021`) sebagai alat ke-26 di VPS produksi (1 vCPU, 2.2 GiB RAM, 4.0 GiB swap, 2 Uvicorn worker) berisiko menyebabkan OOM jika memakai upload buffered (`request.body()`), pembacaan penuh ClamAV (`f.read()`), atau koordinasi antrean SQLite per-worker ala `media_downloader.py`.
- Opsi:
  1. Memproses upload `multipart` + `ffmpeg` langsung di web worker Uvicorn memakai koordinasi SQLite lokal.
  2. Memakai raw streaming `request.stream()` (chunk 64 KiB) + header `X-Video-Metadata`, koordinasi antrean via PostgreSQL (`video_compression_jobs`), worker systemd terpisah `satukit-video-worker`, scan ClamAV streaming `INSTREAM` 64 KiB sebelum `ffprobe`/`ffmpeg` dalam `bubblewrap --unshare-net`, serta 3 preset single-pass H.264 `-preset veryfast -threads 1`.
- Keputusan: Opsi 2. Menetapkan:
  1. **Streaming & Batas:** Input lokal MP4/MOV/WebM (`250.000.000` byte, ≤ 600s, ≤ 4K/60 FPS); workspace `0700`/`0600` dengan batas global `1.25 GiB` (`1.342.177.280` byte); Caddy mempertahankan global cap 35 MB dengan override matcher khusus `POST /api/video-compressions` (~260 MB).
  2. **Koordinasi PostgreSQL:** Tabel `video_compression_jobs` (`004_video_compression.py`) memakai `pg_advisory_xact_lock`, partial unique index (`1` job aktif/user & `1` global `running` dengan varian PostgreSQL + SQLite untuk test), `SELECT ... FOR UPDATE SKIP LOCKED`, antrean global `1 running + 2 waiting`, rate limit rolling 60m (`3 job/jam` per user & IP), dan atomic claim `succeeded -> claimed` (TTL 15m).
  3. **Pipeline Worker & Preset:** ClamAV chunk 64 KiB fail-closed sebelum `ffprobe` -> validasi `ffprobe` -> `ffmpeg` (`apt`) `libx264 -preset veryfast -threads 1`, `yuv420p`, AAC opsional, downscale proporsional ≤ 1080p & `fps=30` tanpa upscale, `-map_metadata -1 -map_chapters -1`, `-movflags +faststart`, preset `light` (CRF 23, 128k), `balanced` (CRF 28, 96k, default), `maximum` (CRF 32, 64k), sandbox `bubblewrap --unshare-net --die-with-parent`, PGID `SIGTERM`->`SIGKILL`, hard timeout 45 menit, dan penolakan `OUTPUT_NOT_SMALLER` bila `output >= input`.
  4. **Guard Frontend & Health:** Kartu `#/tools` kategori `convert` untuk Compress Video tetap menerapkan guard login eksplisit di `App.tsx`; `/api/health` mengekspos ketersediaan `ffmpeg`/`ffprobe` & heartbeat worker tanpa path internal.
- Alasan: Mencegah duplikasi state antar-2 Uvicorn worker, menjaga memori proses utama tetap rata, menghentikan eksploit demuxer sedini mungkin dengan ClamAV pre-probe, serta menjamin akses terautentikasi pada beban CPU berat VPS.
- Konsekuensi: Membutuhkan migration Alembic `004`, paket `ffmpeg`/`clamav-daemon`/`bubblewrap` di host Linux Ubuntu, dan unit systemd tambahan `satukit-video-worker.service`.
- Risiko: Host Windows lokal tidak memiliki `ffmpeg`/`ffprobe`, sehingga pengujian dev memakai mock untuk eksekusi biner sedangkan kalibrasi RAM/ClamAV `StreamMaxLength` > 250 MB di Ubuntu staging (`Q-007`, `RISK-SEC-023`) wajib dilakukan sebelum rilis produksi.
- Requirement terkait: `CR-021`, `BUS-027`, `BRULE-016`, `KPI-008`, `FR-059`, `NFR-PERF-008`, `NFR-REL-010`, `NFR-SEC-016`, `NFR-PRIV-002`, `NFR-UX-004`, `NFR-ACC-004`, `THR-037` s/d `042`, `VC-00` s/d `VC-06`.

---

## DEC-027 — Pemanfaatan Kembali Antrean PostgreSQL, Worker Daemon, dan Route Upload Video untuk Fitur MP4 ke MP3 (`CR-022`)

- Tanggal: 2026-11-13
- Status: Accepted
- Konteks: Fitur **MP4 ke MP3** (`CR-022`, `FR-060`) sebagai alat ke-27 Satukit membutuhkan antrean asinkron, streaming upload video hingga 250 MB, background processing via FFmpeg, dan proteksi resource VPS 2.2 GiB RAM. Membangun tabel, worker, atau route upload baru secara terpisah akan menambah kompleksitas kode, duplikasi konfigurasi Caddy, dan fragmentasi batas konkurensi antar-pekerjaan berat.
- Opsi:
  1. Membuat tabel database baru `audio_extraction_jobs`, daemon worker baru `satukit-audio-worker`, dan route HTTP baru `POST /api/audio-extractions` beserta modifikasi `deploy/Caddyfile.example`.
  2. Memanfaatkan kembali tabel `video_compression_jobs` (dengan kolom `job_type`), daemon bersama `satukit-video-worker`, dan route `POST /api/video-compressions` (diatur oleh header `X-Video-Metadata` berisi `job_type="extract_audio"`).
- Keputusan: Opsi 2. Menetapkan:
  1. **Skema & Antrean Bersama:**
     - Menambah kolom `job_type VARCHAR(20) DEFAULT 'compress' NOT NULL` pada tabel `video_compression_jobs` via migrasi Alembic `005_mp4_to_mp3.py`.
     - Memperluas check constraint preset untuk mencakup bitrate audio: `preset IN ('light', 'balanced', 'maximum', '128k', '192k', '320k')`.
     - Batas konkurensi (1 job aktif per user via `uq_video_jobs_active_per_user`, 1 running global via `uq_video_jobs_global_running`, antrean max 2 menunggu, rate limit 3/jam per akun & IP) otomatis berlaku bersama antara kompresi video dan ekstraksi audio.
  2. **Pipeline Ekstraksi Audio Worker:**
     - ClamAV chunk 64 KiB tetap dijalankan sebelum `ffprobe`.
     - Validasi `ffprobe` fail-closed: format container MP4, durasi ≤ 600s, dan **wajib terdapat minimal satu stream audio**. Jika tidak ada stream audio, job ditolak dengan kode error `NO_AUDIO_STREAM`.
     - Pemilihan stream: track dengan flag `default` diprioritaskan, fallback ke `0:a:0`.
     - Penanganan channel: jika channel audio > 2 (misal 5.1/7.1), otomatis di-downmix ke stereo 2 channel (`-ac 2`).
     - FFmpeg encoding: `ffmpeg -nostdin -y -hide_banner -i <input> -map 0:a:<idx> -vn -ac <channels> -c:a libmp3lame -b:a <preset> -map_metadata -1 -map_chapters -1 <output>` dalam sandbox `bubblewrap --unshare-net`, timeout 10 menit (600s).
     - Nama berkas keluaran `<stem>_audio.mp3`.
     - Hasil unduhan sekali pakai (`succeeded -> claimed`) dengan TTL 15 menit, penghapusan input segera pasca-proses.
  3. **Zero Proxy Changes & Checkbox Hak Cipta:**
     - Route `POST /api/video-compressions` langsung dilayani oleh matcher Caddy `@videoUpload` yang sudah ada (~260 MB) tanpa memerlukan perubahan konfigurasi reverse proxy.
     - Klien wajib menyertakan konfirmasi hak cipta (`owner_confirmed=true`) sebelum pemrosesan diizinkan; audit log JSONL non-PII mencatat `action="mp4_to_mp3_requested"` dan `action="mp4_to_mp3_downloaded"`.
- Alasan: Menghilangkan redundansi kode, mencegah overhead RAM dari penambahan background daemon baru di VPS 2.2 GiB RAM, menjamin keadilan resource dengan shared queue limit, dan menghindari modifikasi konfigurasi reverse proxy produksi.
- Konsekuensi: Tabel `video_compression_jobs` dan model SQLAlchemy-nya menangani dua jenis job (`compress` dan `extract_audio`).
- Risiko: Konsumsi resource bersama dapat membuat antrean video compression dan audio extraction saling menunggu jika digunakan simultan. Mitigasi: Ini adalah perilaku yang diinginkan (desired design) untuk melindungi 1 vCPU VPS dari kelebihan beban (overload).
- Requirement terkait: `CR-022`, `BUS-028`, `BRULE-017`, `KPI-009`, `FR-060`, `NFR-PERF-009`, `NFR-REL-011`, `NFR-SEC-017`, `NFR-PRIV-003`, `NFR-UX-005`, `NFR-ACC-005`, `THR-043` s/d `045`, `MP3-00` s/d `MP3-04`.

---

## DEC-028 — Arsitektur Transkripsi Video ke Teks Offline CPU, Skema Antrean Bersama, dan Paket Unduhan Multi-Format (`CR-023`)

- Tanggal: 2026-11-13
- Status: Accepted
- Konteks: Fitur **Video ke Teks** (`CR-023`, `FR-061`) sebagai alat ke-28 Satukit membutuhkan transkripsi rekaman video MP4 lokal (≤ 250 MB, ≤ 600s), segmentasi timestamp (ID/EN), pratinjau baca-saja penuh di UI, dan paket unduhan ZIP 3-file (`.txt`, `.srt`, `.docx`). Eksekusi harus aman di VPS 1 vCPU / 2.2 GiB RAM tanpa ketergantungan API cloud berbayar/pihak ketiga dan tanpa kebocoran PII audio/teks.
- Opsi:
  1. Integrasi API cloud STT pihak ketiga (OpenAI Whisper API, Cloudflare Workers AI, Deepgram, dll).
  2. Menjalankan model AI transkripsi CPU lokal (`faster-whisper` CTranslate2 kuantisasi `int8`) dengan memanfaatkan kembali antrean PostgreSQL `video_compression_jobs` dan daemon worker `satukit-video-worker`.
- Keputusan: Opsi 2. Menetapkan:
  1. **Skema Database & Antrean Bersama:**
     - Memperluas nilai kolom `job_type` pada tabel `video_compression_jobs` untuk mencakup `'transcribe'` via migrasi Alembic `006_video_to_text.py`.
     - Memperluas check constraint `preset` untuk mendukung opsi bahasa: `preset IN ('light', 'balanced', 'maximum', '128k', '192k', '320k', 'auto', 'id', 'en')`.
     - Batas konkurensi bersama (1 aktif per user `uq_video_jobs_active_per_user`, 1 running global `uq_video_jobs_global_running`, antrean max 2 menunggu, rate limit 3/jam per akun & IP) menjaga stabilitas beban VPS 1 vCPU.
  2. **Pipeline Ekstraksi Audio & Transkripsi Worker:**
     - ClamAV streaming chunk 64 KiB memeriksa integritas berkas MP4 fail-closed sebelum `ffprobe`.
     - `ffprobe` memvalidasi keberadaan stream audio (gagal `NO_AUDIO_STREAM` jika bisu).
     - Ekstraksi audio perantara via FFmpeg ke format PCM WAV 16kHz mono 16-bit (`-ar 16000 -ac 1 -c:a pcm_s16le`).
     - Transkripsi offline CPU-only via `faster-whisper` dengan kuantisasi `int8` (footprint RAM ~200-550MB). VAD filtering menolak audio hening/tanpa vokal dengan kode `NO_SPEECH`.
     - Timeout keras transkripsi 15 menit (900s), eksekusi dalam sandbox `bubblewrap --unshare-net`, pembatalan per process-group.
  3. **Multi-Format Document Generator & ZIP Packager:**
     - Menghasilkan 3 berkas: `<stem>_transcript.txt` (timestamp segmen), `<stem>_transcript.srt` (subtitel SubRip), dan `<stem>_transcript.docx` (dokumen Word rapi via `python-docx` dengan tabel segmen dan disclaimer verifikasi manusia).
     - Mengemas ketiga dokumen ke dalam `<stem>_transcript.zip` secara atomik via pustaka standar `zipfile`.
     - Berkas perantara WAV dan berkas teks individual segera dihapus dari workspace.
  4. **Ephemeral Preview & Unduhan Sekali Pakai:**
     - Data pratinjau teks disimpan sebagai `preview.json` di workspace direktori `0700` job (tidak disimpan di database) dan diinjeksikan pada polling status job saat `status='succeeded'`.
     - Unduhan melalui endpoint `GET .../download` bersifat sekali pakai (`succeeded -> claimed`) dengan TTL 15 menit. Workspace (termasuk ZIP dan `preview.json`) langsung dihapus seketika setelah diunduh atau kedaluwarsa.
  5. **Proteksi Hukum, Privasi, & Log Audit:**
     - Wajib login terverifikasi di produksi dan wajib mencentang konfirmasi ganda (kepemilikan berkas dan izin transkripsi suara) sebelum job diproses.
     - Redaksi penuh: teks transkrip dan audio dilarang masuk ke log aplikasi atau audit trail JSONL non-PII (`video_to_text_requested`, `video_to_text_downloaded`).
- Alasan: Menjaga kedaulatan data dan privasi pengguna (zero external data leak), zero cloud cost tambahan, konsumsi RAM terkontrol via int8, dan menghindari duplikasi infrastruktur antrean di VPS.
- Konsekuensi: Host pengujian dev Windows membutuhkan mock untuk `faster-whisper` dan biner FFmpeg; benchmark empiris staging VPS Ubuntu (`RISK-SEC-023` / `Q-007` serta akurasi/RAM transkripsi) tetap prasyarat rilis produksi.
- Risiko: Durasi inferensi pada video 10 menit di 1 vCPU membutuhkan waktu ~8-12 menit. Mitigasi: Kuantisasi int8, timeout 15 menit, VAD noise rejection, dan antrean 1 aktif per pengguna.
- Requirement terkait: `CR-023`, `BUS-029`, `BRULE-018`, `KPI-010`, `FR-061`, `NFR-PERF-010`, `NFR-REL-011`, `NFR-SEC-017`, `NFR-PRIV-003`, `NFR-UX-006`, `NFR-ACC-006`, `THR-046` s/d `048`, `RISK-SEC-028` s/d `030`, `VTT-00` s/d `VTT-05`.

---

## DEC-029 — Hardening LibreOffice Single-Worker, Isolasi Profil Per-Job, Facade Sinkron Kompatibel, dan Canonical Visual Baseline CV

- Tanggal: 2026-11-16
- Status: Accepted
- Konteks: Audit terhadap 5 call site LibreOffice (`converter.py`, `office_converter.py`, `pdf_generator.py`, `ats_report_generator.py`) menunjukkan: (1) tidak adanya `-env:UserInstallation=file://...` sehingga paralelisme Uvicorn 2 worker memicu korupsi profil bersama atau deadlock `.lock`, (2) `proc.kill()` hanya membunuh wrapper `soffice` tanpa membunuh child `soffice.bin` di POSIX, (3) `conversion_job_manager` berbasis memori per-proses tidak mencegah 2 proses LibreOffice berjalan serentak lintas worker Uvicorn pada VPS 1 vCPU, dan (4) output PDF CV dari `docx_generator.py -> LibreOffice` masih generik dibanding 4 template preview frontend (`AtsClean`, `AtsModern`, `VisualExecutive`, `VisualMinimal`).
- Keputusan:
  1. **Subprocess & Profile Isolation (`OFF-01`):** Sentralisasi eksekusi LibreOffice di `backend/app/services/libreoffice.py` dengan profil unik `-env:UserInstallation=file://...` per konversi, pembersihan deterministik, validasi magic header `%PDF-`, process-group termination (`start_new_session=True` + `os.killpg` SIGTERM->SIGKILL di POSIX), dan fail-closed `WindowsJobObject` di Windows.
  2. **Single-Worker Queue & Synchronous Compatible Facade (`OFF-02` & `OFF-03`):** Mempertahankan kontrak HTTP sinkron yang kompatibel dengan frontend saat ini, namun membatasi tepat 1 proses LibreOffice aktif di seluruh host melalui koordinasi database/worker; request konkuren saat slot penuh/sibuk ditolak deterministik dengan HTTP 429.
  3. **Canonical Visual Baseline CV (`CVR-01`):** Menetapkan 4 template preview frontend (`AtsClean`, `AtsModern`, `VisualExecutive`, `VisualMinimal`) sebagai acuan fidelitas visual canonical untuk evaluasi direct PDF renderer CV/ATS, sembari mempertahankan `python-docx` untuk ekspor DOCX.
- Requirement terkait: `NFR-PERF-001`, `NFR-REL-003`, `NFR-SEC-004`, `OFF-01` s/d `OFF-04`, `CVR-01`.

---

## DEC-030 — Hasil Feasibility Spike Direct PDF Renderer CV & Laporan ATS (`CVR-01`)

- Tanggal: 2026-11-16
- Status: Accepted
- Konteks: Saat ini ekspor PDF CV (`POST /api/export/pdf`) dan laporan evaluasi ATS (`POST /api/ats/export-report-pdf`) menggunakan rantai dua tahap `python-docx -> LibreOffice headless`, yang memicu konsumsi RAM ~250–450 MB per konversi, latensi cold-start 1.5–4 detik di VPS 1 vCPU, kontensi slot single-active LibreOffice terhadap konverter dokumen umum, serta kehilangan fidelitas tata letak 2-kolom (`visual-executive`) dibanding 4 template preview canonical di frontend (`AtsClean`, `AtsModern`, `VisualExecutive`, `VisualMinimal`).
- Opsi:
  1. Mempertahankan `python-docx -> LibreOffice` untuk seluruh ekspor PDF CV & ATS.
  2. Menambahkan dependensi baru (`weasyprint` / `reportlab` / headless Chromium).
  3. Menggunakan pustaka `PyMuPDF` (`pymupdf.Story` + `pymupdf.DocumentWriter` + drawing shapes) yang sudah terpasang di `backend/pyproject.toml` tanpa dependensi baru, sambil mempertahankan `python-docx` khusus untuk `POST /api/export/docx`.
- Bukti & Hasil Benchmark Spike (`spikes/cv-pdf-renderer/eval_cv_pdf_renderer.py`):
  - **Fidelitas 4 Template Canonical & ATS Report:**
    - `ats-clean`: 1 kolom rata tengah header, garis aksen bawah, rata-rata `25.03 ms` (max `28.11 ms`), ukuran `110,749 bytes`.
    - `ats-modern`: 1 kolom rata kiri tegas + bar aksen vertikal kiri `pymupdf.Shape`, foto kanan atas, rata-rata `18.11 ms` (max `21.79 ms`), ukuran `110,871 bytes`.
    - `visual-executive`: 2 kolom (`34%` sidebar kiri berlatar tint aksen + `66%` kolom utama kanan via dual `Story.place(rect)`), rata-rata `17.38 ms` (max `18.55 ms`), ukuran `110,945 bytes`.
    - `visual-minimal`: 1 kolom bersih dengan label ringkas (`TENTANG`, `PENGALAMAN`), rata-rata `14.59 ms` (max `15.07 ms`), ukuran `110,645 bytes`.
    - `ats-report`: laporan skor & checklist ATS langsung ke PDF dalam `3.67 ms`, ukuran `90,202 bytes`.
  - **Memori & Keamanan:** Peak Python heap (`tracemalloc`) hanya `1.37 MiB` (dibanding ~250–450 MiB proses `soffice.bin`), tanpa spawning subprocess, bebas risiko SSRF karena seluruh HTML disusun internal dengan `html.escape` dan foto divalidasi oleh `parse_and_validate_photo()`.
  - **Catatan Teknis Penting (Ligatur Font):** `pymupdf.Story` secara default membentuk ligatur Unicode `\ufb01` (`ﬁ`) untuk urutan huruf `"fi"` (misal pada `"Certified"`). Jika diadopsi ke produksi, parser ATS hilir atau renderer perlu menonaktifkan ligatur CSS (`font-variant-ligatures: none`) atau menormalisasi Unicode `NFKC` agar ekstraksi teks ATS 100% identik dengan string ASCII.
- Keputusan:
  - Pendekatan Opsi 3 (`pymupdf.Story` + `DocumentWriter`) **terbukti layak (feasible)** dengan penurunan latensi >95% (`~15–25 ms` vs `1500–4000 ms`) dan penghematan memori >99% (`1.37 MiB` heap vs 프로세스 `soffice.bin`), serta membebaskan slot single-active LibreOffice (`OFF-02`) sepenuhnya untuk konversi dokumen Office pengguna (`DOCX/PPTX/XLSX`).
  - Integrasi penggantian `pdf_generator.py` dan `ats_report_generator.py` di produksi dapat dijadwalkan sebagai task implementasi terpisah apabila disetujui pemilik proyek, sementara ekspor DOCX (`POST /api/export/docx`) tetap menggunakan `python-docx`.
- Requirement terkait: `FR-012`, `FR-038`, `NFR-PERF-001`, `DEC-029`, `CVR-01`.

---

## DEC-031 — Gate Peluncuran Beta (`BETA-01` / `CR-024`): Kartu `Coming Soon`, Kategori `Media & Audio`, dan Middleware `503 FEATURE_COMING_SOON`

- Tanggal: 2026-11-16
- Status: Accepted
- Konteks: Untuk peluncuran beta di VPS 1 vCPU / 2.2 GiB RAM, 9 fitur yang berisiko beban tinggi, ketergantungan pihak ketiga, atau belum siap penuh (`Pengunduh Media`, `Blur Background`, `WebP ke JPG`, `OCR PDF`, `Edit PDF`, `Repair PDF`, `Compress Video`, `MP4 ke MP3`, `Video ke Teks`) harus dinonaktifkan sementara tanpa menghapus kartu dari katalog `#/tools` dan tanpa membiarkan endpoint API-nya ditembak langsung.
- Keputusan:
  1. **UI Kartu `Coming Soon` & 7 Kategori:** Menambahkan properti `comingSoon?: boolean` pada `ToolItem` di `frontend/src/App.tsx`, mengelompokkan 4 fitur media ke kategori baru `Media & Audio` (`id: 'media'`), merender tombol dengan atribut native `disabled`, menampilkan badge & CTA `Coming Soon` (menyembunyikan badge `Perlu Akun`/`Browser`/`Baru`), dan menampilkan metrik `19 aktif` + `9 Coming Soon` di `Dashboard.tsx`.
  2. **Gate Middleware Backend Fail-Closed (`503 FEATURE_COMING_SOON`):** Menambahkan flag `BETA_COMING_SOON_GATES_ENABLED: bool = True` di `backend/app/core/config.py` dan pemeriksaan `is_beta_coming_soon_path` di `SecurityMiddleware` (`backend/app/core/middleware.py`) tepat setelah validasi Origin untuk menolak `/api/media-downloads*`, `/api/video-compressions*`, `/api/pdf-tools/editor/pages`, `/api/pdf-tools/editor/apply`, `/api/pdf-tools/repair`, `/api/pdf-tools/ocr/status`, dan `/api/pdf-tools/ocr` dengan HTTP `503` (`error_code: "FEATURE_COMING_SOON"`).
  3. **Pelestarian Endpoint Bersama:** Endpoint `POST /api/image-tools/remove-background` tetap aktif karena digunakan oleh fitur aktif `Hapus Latar Belakang`, sedangkan `Blur Background` dan `WebP ke JPG` dinonaktifkan di lapisan UI.
- Requirement terkait: `CR-024`, `FR-062`, `NFR-SEC-018`, `THR-049`, `BETA-01`.

---

## DEC-032 — Rebranding Resmi ke "Beresin by Satukit" ("Urusan Berkas? Beresin Aja!")

- Tanggal: 2026-11-16
- Status: Accepted
- Konteks: Keputusan bisnis menetapkan nama produk resmi menjadi "Beresin by Satukit" dengan tagline "Urusan Berkas? Beresin Aja!" untuk mempertegas posisi pasar platform utilitas dokumen dan karier serba ada.
- Keputusan: Mengadopsi aset visual Beresin_Brand_Kit (logo, logomark, maskot Kitu), memperbarui seluruh copy publik di frontend dan teks respons publik di backend, sembari mempertahankan 100% identifier teknis internal `satukit_*` dan format `.docbuilder`.
- Requirement terkait: `CR-025`, `NFR-UX-002`, `NFR-COMP-002`, `REBRAND-BERESIN-001`.

---

## DEC-033 — Arsitektur Otentikasi Google OpenID Connect PKCE Backend & Linking/Unlinking Akun Aman

- Tanggal: 2026-11-16
- Status: Accepted
- Konteks: Penambahan opsi pendaftaran dan masuk menggunakan akun Google pada Beresin by Satukit memerlukan kepatuhan standar keamanan tinggi tanpa membuka kerentanan token forgery atau account takeover (ATO).
- Keputusan:
  1. **Backend Authorization Code + PKCE (`S256`):** Menggunakan alur Authorization Code dengan PKCE (`code_verifier` & `code_challenge` `S256`) dan scope minimum `openid email profile`. Dilarang menggunakan Google Sign-In SDK frontend atau meminta offline refresh token.
  2. **Timing-Safe Transaction State:** State OAuth diikat ke timing-safe hash rahasia pada cookie HttpOnly `satukit_google_oauth_tx` (TTL 5 menit) dan database `oauth_transactions` (Alembic `007_google_oidc.py`). Cookie dan transaksi langsung dihapus/diklaim saat callback.
  3. **Anti-Auto-Merge Akun Lokal (BRULE-013):** Jika email dari Google cocok dengan akun lokal yang sudah memiliki password aktif namun belum tertaut, login Google ditolak dengan status `ACCOUNT_MERGE_REQUIRED`. Pengguna wajib masuk dengan password terlebih dahulu sebelum menautkan Google.
  4. **Linking & Unlinking Sadar Password:** Menautkan dan memutuskan akun Google wajib berstatus login, memiliki token CSRF valid, memverifikasi kata sandi akun saat ini, dan memastikan email Google sama persis dengan email akun Beresin. Pemutusan Google wajib memastikan akun memiliki password aktif lokal agar pengguna tidak terkunci.
  5. **Avatar Sanitasi & CSP:** Kolom `users.avatar_url` hanya menerima URL HTTPS dari host `googleusercontent.com` / `*.googleusercontent.com`. Rendering di frontend wajib menyertakan `referrerPolicy="no-referrer"`. Server tidak menyimpan atau mem-proxy file gambar avatar. CSP Caddy memperbolehkan `https://*.googleusercontent.com` pada direktif `img-src`.
- Requirement terkait: `CR-026`, `BUS-017`, `FR-042`, `NFR-SEC-006`, `NFR-SEC-007`, `BRULE-013`, `GOOGLE-OIDC-001`.
