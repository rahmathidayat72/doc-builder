# Business Requirements Document (BRD)

## 1. Metadata dan Revision History
- **Proyek:** Doc-builder
- **Versi:** 1.0.0
- **Tanggal Persetujuan:** 2026-10-20
- **Status:** Approved (Gerbang 1A)
- **Owner:** User (Product, Security & Data Owner)

## 2. Executive Summary
Doc-builder adalah aplikasi produktivitas dokumen lokal yang dirancang untuk mengatasi hambatan pembuatan CV yang sesuai standar Applicant Tracking System (ATS), perancangan CV visual, analisis kecocokan lowongan kerja, serta konversi dokumen perkantoran (DOCX↔PDF) dan utilitas gambar/PDF tanpa ketergantungan pada server cloud atau langganan berbayar.

## 3. Latar Belakang & Pernyataan Masalah
- **Proses As-Is:** Pengguna menggunakan Microsoft Word / Google Docs dan menyalin data berulang kali dari spreadsheet atau resume lama. Konversi dokumen sering menggunakan layanan web pihak ketiga gratis yang menyimpan data pribadi di internet.
- **Akar Penyebab Masalah:** Kurangnya standarisasi template ATS lokal yang valid, minimnya kontrol privasi pada alat konversi online, dan ketiadaan verifikasi visual lokal.
- **Dampak Bisnis:** Waktu terbuang (seringkali >1 jam per lamaran), risiko kebocoran data pribadi (PII), tingginya tingkat kegagalan sortir ATS karena kesalahan layout, dan biaya langganan software dokumen berbayar.

## 4. Tujuan Bisnis (Business Objectives)
- **OBJ-001:** Memungkinkan pengguna menyusun CV siap unduh dalam waktu ≤15 menit dari form kosong atau impor CV lama.
- **OBJ-002:** Mengurangi kesalahan format dokumen dan menjaga konsistensi tata letak pada seluruh output CV.
- **OBJ-003:** Menyediakan fasilitas konversi dokumen lokal dengan durasi proses ≤60 detik untuk file berukuran ≤25 MB.
- **OBJ-004:** Menekan error rate operasional pengguna normal hingga di bawah 2%.
- **OBJ-005:** Menghasilkan MVP berstatus siap pakai pribadi, lulus UAT 10 pengguna, dan siap distribusi beta lokal.

## 5. Stakeholder & RACI
- **Product & Business Owner (A/R):** User
- **Security & Data Owner (A/R):** User
- **Target Pengguna (I):** Pencari kerja, fresh graduate, profesional, tim HR
- **Validator HR & Privasi (C):** Praktisi HR dan penasihat privasi/legal independen
- **Beta Testers (C):** 10 pengguna uji pada sesi UAT

## 6. Proses Bisnis As-Is vs To-Be
- **As-Is:** Buka Word -> Susun manual tanpa panduan ATS -> Export PDF -> Upload ke web converter luar untuk format lain -> Risiko kebocoran data PII.
- **To-Be:** Buka Doc-builder lokal -> Isi form terstruktur atau impor CV lama -> Lihat live preview -> Analisis ATS lokal & job match -> Ekspor PDF/DOCX resmi -> Jalankan utilitas konversi dokumen/resize foto di localhost tanpa kirim data ke internet.

## 7. Ruang Lingkup Bisnis (Scope)
### 7.1 In Scope (Must Have)
- CV/Resume Builder: Form profil lengkap, pendidikan, pengalaman, skill, bahasa, proyek, sertifikasi, kustom.
- Template CV: Minimal 2 ATS + 2 Visual awal, bertahap hingga 5 ATS + 5 Visual.
- Ekspor Dokumen: PDF dan DOCX.
- Analisis ATS: Skor struktur 0-100, checklist keterbacaan, deteksi masalah, rekomendasi perbaikan.
- Job Matching: Penilaian kecocokan terpisah terhadap deskripsi pekerjaan (teks atau dokumen upload).
- Konversi Dokumen: DOCX ke PDF dan PDF ke DOCX (maks 25 MB/file, 1 job aktif).
- Retensi & Privasi: Pemrosesan localhost, auto-cleanup file temporer (TTL 5 menit), draft lokal IndexedDB.

### 7.2 In Scope (Should Have)
- PDF Tools: Merge (PDF & image) dan Split (rentang halaman).
- Image Tools: Image ke PDF, PDF ke Image (pilihan DPI), Resize JPG/PNG berbasis target KB/MB dengan pembersihan metadata EXIF.

### 7.3 Out of Scope
- Sinkronisasi cloud, autentikasi multi-user online, akun login.
- Integrasi otomatis scraping URL portal lowongan kerja.
- Pembayaran dan sistem lisensi berbayar pada MVP.
- Konversi batch multi-file bersamaan.
- Dukungan dokumen terenkripsi atau berpassword.

## 8. Business Requirements
- **BUS-001:** Sistem harus menyediakan alur pembuatan CV dari template kosong serta impor dokumen CV lama dengan konfirmasi ekstraksi.
- **BUS-002:** Sistem harus menyediakan variasi template berorientasi keterbacaan mesin (ATS) dan desain visual presentatif.
- **BUS-003:** Sistem harus mampu mengekspor hasil CV ke dalam format PDF dan DOCX yang valid dan dapat disunting kembali.
- **BUS-004:** Sistem harus memberikan skor evaluasi ATS deterministik dan skor kecocokan lowongan yang terpisah beserta alasannya.
- **BUS-005:** Sistem harus mampu mengonversi dokumen DOCX ke PDF dan PDF ke DOCX pada file dokumen perkantoran umum.
- **BUS-006:** Hasil konversi pada corpus referensi (kantor umum, CV, surat) wajib memiliki tingkat kemiripan visual ≥95%.
- **BUS-007:** Sistem menyediakan utilitas pelengkap pengolahan PDF (merge/split) dan optimasi foto lamaran kerja.
- **BUS-008:** Kepemilikan dan kendali data dokumen sepenuhnya berada di tangan pengguna tanpa transfer data eksternal.
- **BUS-009:** Sistem berjalan pada arsitektur web lokal yang diaktifkan dengan script start sederhana tanpa konfigurasi manual rumit.
- **BUS-010:** Antarmuka responsif untuk desktop dan mobile web, dengan pemrosesan dokumen dioptimalkan pada desktop.
- **BUS-011:** Sistem menyediakan utilitas keamanan dokumen PDF lokal untuk memproteksi (enkripsi AES-256 dengan password kuat) dan membuka proteksi (dekripsi dengan password yang sah) secara privat tanpa server pihak ketiga.
- **BUS-012:** Sistem menyediakan utilitas pemulihan dokumen PDF rusak (reconstruct xref, perbaikan trailer, dan penyelamatan stream halaman) serta pengenalan karakter dokumen hasil scan (OCR PDF) secara lokal dengan deteksi otomatis ketersediaan Tesseract OCR di host.
- **BUS-013:** Sistem menyediakan utilitas pembubuhan stempel cap air (Watermark teks & logo gambar transparan dengan kontrol rotasi dan posisi 3x3/mosaic) serta penomoran halaman otomatis (Page Numbers dengan format kustom, posisi 6 titik, margin, dan pengecualian sampul) secara lokal offline.
- **BUS-014:** Sistem menyediakan utilitas konversi berkas PDF menjadi format Markdown (.md) terstruktur secara lokal offline dengan mempertahankan struktur heading, list, tabel, dan tautan untuk integrasi LLM dan catatan digital.

## 9. Business Rules (BRULE)
- **BRULE-001:** Batas ukuran file maksimum yang diizinkan untuk diproses adalah 25 MB per berkas.
- **BRULE-002:** Sistem hanya memproses satu pekerjaan konversi aktif pada satu waktu (concurrency limit = 1).
- **BRULE-003:** Seluruh berkas temporer pada backend lokal wajib dihapus segera setelah diserahkan atau maksimal TTL 5 menit.
- **BRULE-004:** Draft lokal disimpan di perangkat pengguna sampai dihapus secara eksplisit atau melalui mode privat.
- **BRULE-005:** Sistem mendukung pembukaan proteksi PDF berpassword yang sah dan pemproteksian berkas PDF via enkripsi AES-256 lokal; berkas terenkripsi tetap ditolak pada modul konversi format hingga dibuka terlebih dahulu. Berkas bertanda tangan digital ditolak pada modul proteksi & buka proteksi untuk mencegah perusakan keabsahan tanda tangan.
- **BRULE-006:** Rekomendasi ATS tidak boleh mengubah data CV secara otomatis dan wajib menampilkan disclaimer bahwa skor bukan jaminan lolos seleksi.
- **BRULE-007:** Input lowongan kerja hanya diizinkan melalui penempelan teks langsung atau pengunggahan file dokumen (PDF/DOCX).
- **BRULE-008:** Hak cipta template dimiliki aplikasi, sedangkan isi dan hak cipta dokumen output sepenuhnya milik pengguna.
- **BRULE-009:** Pengguna wajib menyetujui pemberitahuan privasi berbasis prinsip UU PDP Indonesia saat pertama kali menjalankan aplikasi.

## 10. Key Performance Indicators (KPI)
- **KPI-001:** Rata-rata waktu penyusunan CV dari template hingga unduh ≤ 15 menit.
- **KPI-002:** Rata-rata waktu proses konversi dokumen referensi ≤ 60 detik.
- **KPI-003:** Tingkat kegagalan operasional pengguna (error rate) < 2%.
- **KPI-004:** Skor fidelitas visual konversi ≥ 95% pada corpus pengujian resmi.
- **KPI-005:** Kelulusan UAT minimal 90% dari 10 responden penguji.

> **Catatan konsistensi 2026-10-24:** KPI-004 belum memiliki metode visual formal (SSIM/pixel diff); benchmark 2026-10-21 mengukur fidelitas field/teks round-trip 100%, bukan kemiripan visual (`Q-001`). BRULE-003 baru dipenuhi melalui per-job cleanup dan startup sweep; periodic sweeper belum tersedia (`RISK-SEC-002`).

## 11. Batasan & Dependensi Bisnis
- **Constraint:** Anggaran operasional nol (tanpa cloud pihak ketiga), waktu target 3–4 bulan, bebas lisensi komersial copyleft keras (GPL/AGPL tanpa izin).
- **Dependency:** Ketersediaan instalasi LibreOffice di perangkat pengguna lokal, penyusunan corpus uji representatif, dan partisipasi 10 pengguna uji UAT.

## 12. Analisis Risiko Bisnis
- **RISK-BUS-01:** Rekonstruksi layout PDF→DOCX yang rumit berpotensi menurunkan kepuasan pengguna. (Mitigasi: Batasi jaminan pada corpus standar, berikan status best-effort dengan peringatan).
- **RISK-BUS-02:** Pengguna salah mengartikan skor ATS sebagai jaminan mutlak diterima kerja. (Mitigasi: Cantumkan disclaimer hukum dan panduan objektif).
- **RISK-BUS-03:** Risiko privasi pada komputer bersama (shared device). (Mitigasi: Peringatan perangkat bersama, tombol hapus seluruh data, dan mode privat tanpa penyimpanan).
