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
