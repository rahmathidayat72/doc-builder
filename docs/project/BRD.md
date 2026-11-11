# Business Requirements Document (BRD)

## 1. Metadata dan Revision History
- **Proyek:** Doc-builder
- **Versi:** 1.1.0
- **Tanggal Persetujuan Awal:** 2026-10-20
- **Revisi Terakhir:** 2026-11-08 — Transformasi arsitektur menjadi layanan online publik di VPS (Ubuntu 24.04, 1 vCPU, 2.2 GiB RAM, 40 GB SSD): otentikasi akun & kuota penyimpanan CV (max 5 dokumen, 30 hari retensi, backup R2 7 hari, email Brevo), fitur penghapus latar belakang gambar lokal CPU-only (U2NetP, antrean max 2, timeout 30s), dan layanan pemendek URL publik mandiri berbasis serverless Cloudflare Workers + D1.
- **Status:** Pending Approval (Revisi Gerbang 1A)
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
- Sinkronisasi otomatis ke cloud drive pihak ketiga (Google Drive, Dropbox, OneDrive).
- Integrasi otomatis scraping URL portal lowongan kerja berbayar atau melanggar ToS portal.
- Pembayaran dan sistem lisensi berbayar pada rilis ini (tetap memanfaatkan free-tier resources).
- Pemrosesan batch multi-file bersamaan untuk remove-background.
- Penggunaan model AI/ML eksternal berbasis cloud (seluruh ML wajib lokal di VPS).

### 7.4 Scope Tambahan Transformasi Online & Serverless (2026-11-08)
- **Otentikasi Akun Multi-User (Fitur Lanjutan):** Pendaftaran & masuk via Email + Password (hashing Argon2/bcrypt) dan Google OAuth. Pengguna dapat menyimpan draf proyek CV di server, sedangkan basic tools tetap dapat digunakan anonim tanpa login.
- **Kebijakan Kuota & Retensi CV:** Maksimal 5 proyek CV tersimpan per akun, retensi 30 hari sejak tanggal pembaruan terakhir, kuota global penyimpanan CV 5 GB, pembersihan file temporer anonim maks 1 jam.
- **Disaster Recovery & Backup CV:** Backup snapshot database & CV terenkripsi ke Cloudflare R2 Standard (lifecycle deletion 7 hari).
- **Notifikasi Lifecycle CV:** Pengiriman email transaksional peringatan 14 hari, 7 hari, dan 1 hari sebelum dokumen kedaluwarsa melalui Brevo Free.
- **Penghapus Latar Belakang Gambar Lokal (Remove Background):** Model segmentasi U2NetP yang dijalankan di CPU VPS dalam subprocess terisolasi, 1 worker aktif, antrean maksimal 2, timeout 30 detik, output PNG RGBA transparan dengan metadata EXIF dibuang.
- **Layanan URL Shortener Serverless Mandiri:** Dibangun di atas Cloudflare Workers + D1, subdomain tersendiri, redirect direct 302, pembuatan/pengelolaan link khusus owner melalui API terotentikasi HMAC, link aktif tanpa batas waktu, record revoke dipertahankan 90 hari sebelum penghapusan destination menjadi tombstone permanen, tanpa pengumpulan IP/fingerprint pengunjung.

## 8. Business Requirements
- **BUS-001:** Sistem harus menyediakan alur pembuatan CV dari template kosong serta impor dokumen CV lama dengan konfirmasi ekstraksi.
- **BUS-002:** Sistem harus menyediakan variasi template berorientasi keterbacaan mesin (ATS) dan desain visual presentatif.
- **BUS-003:** Sistem harus mampu mengekspor hasil CV ke dalam format PDF dan DOCX yang valid dan dapat disunting kembali.
- **BUS-004:** Sistem harus memberikan skor evaluasi ATS deterministik dan skor kecocokan lowongan yang terpisah beserta alasannya.
- **BUS-005:** Sistem harus mampu mengonversi dokumen DOCX ke PDF dan PDF ke DOCX pada file dokumen perkantoran umum.
- **BUS-006:** Hasil konversi pada corpus referensi (kantor umum, CV, surat) wajib memiliki tingkat kemiripan visual ≥95%.
- **BUS-007:** Sistem menyediakan utilitas pelengkap pengolahan PDF (merge/split) dan optimasi foto lamaran kerja.
- **BUS-008:** Kepemilikan dan kendali data dokumen sepenuhnya berada di tangan pengguna; jika disimpan di server online, wajib mematuhi batas retensi dan enkripsi cadangan.
- **BUS-009:** Sistem dapat dijalankan pada lingkungan hosting VPS Linux (Ubuntu 24.04 x86_64, 1 vCPU, 2.2 GiB RAM) dengan reverse proxy aman dan konfigurasi efisien.
- **BUS-010:** Antarmuka responsif untuk desktop dan mobile web, dengan pemrosesan dokumen dioptimalkan pada antarmuka pengguna.
- **BUS-011:** Sistem menyediakan utilitas keamanan dokumen PDF lokal untuk memproteksi (enkripsi AES-256 dengan password kuat) dan membuka proteksi (dekripsi dengan password yang sah) secara privat.
- **BUS-012:** Sistem menyediakan utilitas pemulihan dokumen PDF rusak (reconstruct xref, perbaikan trailer, dan penyelamatan stream halaman) serta pengenalan karakter dokumen hasil scan (OCR PDF) secara lokal dengan deteksi otomatis ketersediaan Tesseract OCR di host.
- **BUS-013:** Sistem menyediakan utilitas pembubuhan stempel cap air (Watermark teks & logo gambar transparan dengan kontrol rotasi dan posisi 3x3/mosaic) serta penomoran halaman otomatis (Page Numbers dengan format kustom, posisi 6 titik, margin, dan pengecualian sampul) secara lokal.
- **BUS-014:** Sistem menyediakan utilitas konversi berkas PDF menjadi format Markdown (.md) terstruktur secara lokal dengan mempertahankan struktur heading, list, tabel, dan tautan untuk integrasi LLM dan catatan digital.
- **BUS-015:** Sistem menyediakan layanan pemendek URL publik terpisah (URL Shortener) berbasis arsitektur serverless (Cloudflare Workers + D1) dengan subdomain khusus, pengalihan instan direct 302, manajemen khusus pemilik via HMAC authentication, link aktif jangka panjang tanpa batas waktu, record revoke 90 hari lalu tombstone permanen, serta analitik agregat bebas PII (hanya `click_count` dan `last_accessed_at`).
- **BUS-016:** Sistem menyediakan alat penghapus latar belakang gambar (Remove Background) yang memproses gambar statis (JPG, PNG, WebP) menjadi PNG RGBA transparan secara lokal di VPS menggunakan model segmentasi ringan (U2NetP CPU-only) tanpa transmisi ke API/cloud pihak ketiga, dengan pratinjau sebelum unduh, single-worker execution, antrean terbatas, dan isolasi kegagalan.
- **BUS-017:** Sistem menyediakan manajemen akun dan penyimpanan dokumen CV terkelola di VPS bagi pengguna terdaftar (Email/Password & Google OAuth) dengan pembatasan kuota ketat (maksimal 5 CV per akun, retensi 30 hari sejak pembaruan terakhir, batas global penyimpanan 5 GB), notifikasi kedaluwarsa transaksional via email Brevo, serta cadangan darurat terenkripsi ke Cloudflare R2 (retensi 7 hari).

## 9. Business Rules (BRULE)
- **BRULE-001:** Batas ukuran file maksimum yang diizinkan untuk diproses alat dokumen adalah 25 MB per berkas (10 MB untuk gambar remove-background).
- **BRULE-002:** Sistem hanya memproses satu pekerjaan konversi aktif pada satu waktu (concurrency limit = 1); untuk remove-background, antrean tunggu dibatasi maksimal 2 pekerjaan (pekerjaan berikutnya ditolak dengan HTTP 429/503).
- **BRULE-003:** Seluruh berkas temporer untuk pengguna anonim di backend VPS wajib dihapus segera setelah diserahkan atau maksimal TTL 1 jam.
- **BRULE-004:** Pengguna terdaftar berhak menyimpan maksimal 5 proyek CV aktif; data CV disimpan dalam bentuk data terstruktur dan konfigurasi template; berkas output PDF/DOCX hasil render dibuat ulang saat diminta (on-the-fly) dan hanya disimpan sementara di cache.
- **BRULE-005:** Dokumen CV yang disimpan memiliki masa berlaku (retensi) 30 hari sejak tanggal pembaruan terakhir (`updated_at`). Jika tidak diperbarui, dokumen akan dihapus permanen oleh background worker maksimal 5 menit setelah tanggal kedaluwarsa.
- **BRULE-006:** Rekomendasi ATS tidak boleh mengubah data CV secara otomatis dan wajib menampilkan disclaimer bahwa skor bukan jaminan lolos seleksi.
- **BRULE-007:** Input lowongan kerja hanya diizinkan melalui penempelan teks langsung atau pengunggahan file dokumen (PDF/DOCX).
- **BRULE-008:** Hak cipta template dimiliki aplikasi, sedangkan isi dan hak cipta dokumen output sepenuhnya milik pengguna.
- **BRULE-009:** Pengguna wajib menyetujui pemberitahuan privasi berbasis prinsip UU PDP Indonesia yang menjelaskan bahwa file diproses di server VPS terkelola dan file temporer dihapus otomatis.
- **BRULE-010:** Peringatan kedaluwarsa CV dikirimkan melalui email pada H-14, H-7, dan H-1 sebelum penghapusan permanen (jika layanan email aktif); email tidak boleh memuat isi rincian dokumen CV atau PII sensitif.
- **BRULE-011:** Tujuan pengalihan URL shortener (destination URL) wajib tervalidasi skema HTTPS publik, menolak kredensial dalam URL, menolak host internal/localhost/link-local/private RFC 1918, serta menolak domain berbahaya.
- **BRULE-012:** Pengalihan URL pendek wajib mengembalikan HTTP 302 untuk link aktif, HTTP 404 untuk slug tidak terdaftar, dan HTTP 410 untuk link yang telah dicabut (revoked); slug yang dicabut dilarang keras digunakan ulang (no slug reuse).
- **BRULE-013:** Akun pengguna yang mendaftar via email/password dan Google OAuth dengan alamat email yang sama dilarang digabungkan secara otomatis (no auto-merge); penggabungan akun wajib melalui proses otorisasi sadar (linking via pengaturan akun terautentikasi).
- **BRULE-014:** Jika penggunaan disk sistem VPS mencapai ambang 80% atau kuota penyimpanan global CV mencapai 5 GB, sistem wajib menghentikan penerimaan simpan dokumen baru (fail-closed) demi menjaga ketersediaan ruang kerja OS dan pemrosesan sementara.

## 10. Key Performance Indicators (KPI)
- **KPI-001:** Rata-rata waktu penyusunan CV dari template hingga unduh ≤ 15 menit.
- **KPI-002:** Rata-rata waktu proses konversi dokumen referensi ≤ 60 detik.
- **KPI-003:** Rata-rata waktu proses penghapusan latar belakang gambar (U2NetP, 1 vCPU) ≤ 15 detik pada gambar resolusi standar (hard timeout 30 detik).
- **KPI-004:** Waktu respons pengalihan URL pendek (edge redirect Cloudflare Workers) ≤ 100 ms.
- **KPI-005:** Tingkat kegagalan operasional pengguna (error rate) < 2%.
- **KPI-006:** Keberhasilan penghapusan data kedaluwarsa (retensi 30 hari CV & TTL 1 jam berkas anonim) mencapai 100% tepat waktu (toleransi sweep 5 menit).
- **KPI-007:** Skor fidelitas visual konversi ≥ 95% pada corpus pengujian resmi.

## 11. Batasan & Dependensi Bisnis
- **Constraint Hardware VPS:** 1 vCPU Intel Xeon Gold 6138 @ 2.00GHz, 2.2 GiB RAM fisik, 4.0 GiB Swap, 40 GB SSD (tersedia ~24 GB). Beban ML harus diatur ketat (CPU-only, memory footprint hemat, isolasi subprocess, pembebasan RAM segera).
- **Constraint Biaya:** Mengutamakan paket gratis jangka panjang (Cloudflare Workers Free 100k req/hari, D1 Free 5M read & 100k write/hari, R2 Free 10 GB-mo, Brevo Free 300 email/hari).
- **Dependency:** Konfigurasi DNS domain pada Cloudflare, kredensial Google OAuth Console, API Key Brevo Transactional Email, API Token Cloudflare R2 & D1, serta instalasi LibreOffice di VPS Ubuntu.

## 12. Analisis Risiko Bisnis
- **RISK-BUS-01:** Lonjakan beban inferensi gambar di VPS 1 vCPU / 2.2 GiB RAM dapat menyebabkan thrashing swap atau OOM. (Mitigasi: Concurrency limit = 1, antrean max 2, reject 429/503 saat penuh, memory cap per worker, resize downscale sebelum inferensi).
- **RISK-BUS-02:** Penyalahgunaan URL shortener untuk phishing atau malware. (Mitigasi: Pembuatan link khusus owner terotentikasi HMAC via Cloudflare Access, validasi HTTPS publik ketat, penolakan SSRF/private IP, kemampuan revoke instan, dan log audit).
- **RISK-BUS-03:** Penumpukan dokumen CV melampaui kapasitas disk VPS. (Mitigasi: Kuota max 5 CV per akun, retensi 30 hari, kuota global 5 GB, pembersihan otomatis background worker dan oportunistik API, alert disk 70% dan blokir penyimpanan baru di 80%).
- **RISK-BUS-04:** Ketergantungan paket gratis penyedia pihak ketiga (Cloudflare, Brevo) terhadap perubahan kebijakan kuota/SLA. (Mitigasi: Desain adapter decoupled/agnostik vendor, export database mandiri D1 dan R2, serta dokumentasi runbook migrasi darurat).
