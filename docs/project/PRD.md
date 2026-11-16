# Product Requirements Document (PRD)

## 1. Metadata dan Revision History
- **Proyek:** Beresin by Satukit (sebelumnya Satukit / Doc-builder)
- **Versi:** 1.2.0
- **Status:** Approved (Gerbang 1B & Gerbang 2 disetujui untuk `CR-023`..`CR-025`)
- **Tanggal:** 2026-11-16
- **Referensi BRD:** `docs/project/BRD.md`
- **Revisi Terakhir:** 2026-11-08 — Transformasi online VPS multi-user: otentikasi akun & manajemen kuota CV 30 hari (FR-042 s/d FR-045), fitur penghapus latar belakang gambar lokal CPU-only U2NetP (FR-046, FR-047), dan layanan URL shortener serverless Cloudflare Workers + D1 (FR-048).
- **Revisi 2026-11-12 (`CR-020`, `CR-021`):** Penambahan modul Hapus Watermark (`FR-058`, selesai `RW-01`–`RW-06`) dan modul **Compress Video** (`FR-059`, `NFR-PERF-008`, `NFR-REL-010`, `NFR-SEC-016`, `NFR-PRIV-002`, `NFR-UX-004`, `NFR-ACC-004`; Gerbang 2 disetujui 2026-11-12).
- **Revisi 2026-11-13 (`CR-022`):** Penambahan modul **MP4 ke MP3** (`FR-060`, `NFR-PERF-009`, `NFR-UX-005`) berbagi antrean, batas konkurensi, rate limit, dan worker `CR-021`.
- **Revisi 2026-11-13 (`CR-023`):** Penambahan modul **Video ke Teks** (`FR-061`, `NFR-PERF-010`, `NFR-REL-011`, `NFR-SEC-017`, `NFR-PRIV-003`, `NFR-UX-006`, `NFR-ACC-006`) sebagai alat ke-28 dengan transkripsi offline privat CPU (ID/EN), timestamp per segmen, pratinjau penuh read-only, paket ZIP 3-file (TXT, SRT, DOCX), serta berbagi antrean `CR-021`; baseline PRD & Gerbang 2 disetujui 2026-11-13.
- **Revisi 2026-11-16 (`CR-025`, `DEC-032`):** Rebranding publik aplikasi dari **Satukit** menjadi **Beresin by Satukit** dengan tagline **"Urusan Berkas? Beresin Aja!"** menggunakan aset resmi `Beresin_Brand_Kit`, mempertahankan maskot Kitu (*"Halo, aku Kitu! Asisten digitalmu di Beresin by Satukit."*), serta menjaga 100% kompatibilitas identifier teknis internal `satukit_*`.

## 2. Product Vision & Persona
- **Visi:** Menjadi platform dokumen pribadi dan produktivitas web modern yang memberdayakan individu untuk menghasilkan dokumen profesional berkualitas tinggi, mengedit file secara instan, menghapus latar belakang foto secara mandiri, dan membagikan tautan ringkas yang aman tanpa mengorbankan privasi atau membebani biaya langganan.
- **Persona 1 — Pencari Kerja Fresh Graduate:** Memerlukan panduan struktur CV standar ATS, bantuan pencocokan kata kunci terhadap lowongan, penghapus latar belakang foto pasfoto formal yang rapi, dan penyimpanan draft aman di cloud pribadi tanpa biaya.
- **Persona 2 — Profesional Berpengalaman:** Memerlukan fleksibilitas bagian kustom, ekspor PDF/DOCX yang rapi, konversi dokumen pendukung lamaran secara privat di server terkelola, dan kemampuan menyimpan hingga 5 variasi CV lamaran.
- **Persona 3 — Tim Rekrutmen / Reviewer HR:** Memerlukan verifikasi keterbacaan struktur resume kandidat dan utilitas pengolahan berkas secara cepat.
- **Persona 4 — Pemilik Aplikasi / Administrator:** Memerlukan sarana membuat dan mengelola tautan pendek kustom untuk portofolio dan dokumen publik dengan kontrol penuh, analitik agregat, dan penarikan instan jika terjadi kesalahan.

## 3. Role dan Akses
1. **Pengguna Anonim (Guest/Public User):**
   - Mengakses seluruh alat dokumen dasar (PDF converter, merge/split, compress, watermark, protect/unlock, repair, OCR, PDF to Markdown, image resize, dan penghapus latar belakang gambar dasar).
   - Menyusun dan mengunduh CV secara langsung dalam sesi browser tanpa penyimpanan cloud persisten.
   - Tidak memerlukan login atau registrasi akun.
   - Seluruh berkas input/output sementara di VPS dibersihkan otomatis maksimal dalam 1 jam (TTL).
2. **Pengguna Terdaftar (Registered User):**
   - Mendapatkan seluruh hak akses Pengguna Anonim.
   - Berhak menyimpan hingga 5 proyek draf CV terstruktur secara persisten di akun server VPS.
   - Draf CV disimpan selama 30 hari sejak tanggal pembaruan terakhir.
   - Menerima notifikasi email peringatan kedaluwarsa dokumen pada H-14, H-7, dan H-1.
   - Dapat mengedit, menggandakan, mengunduh ulang, atau menghapus draf kapan saja.
   - Berhak menghapus akun beserta seluruh data tersimpan secara mandiri (eksekusi instan di antarmuka, pembersihan fisik maksimal 24 jam).
3. **Pemilik Aplikasi / Administrator (Owner Role):**
   - Mendapatkan seluruh hak akses Pengguna Terdaftar.
   - Memiliki akses eksklusif ke halaman pengelolaan URL Shortener (membuat tautan, melihat daftar, menyalin, dan mencabut tautan).
   - Akses halaman admin dilindungi autentikasi Cloudflare Access (email whitelist pemilik) dan backend memverifikasi signature/token HMAC.
   - Memiliki visibilitas pemantauan kuota penyimpanan server dan antrean pemrosesan ML.

## 4. Functional Requirements (FR)

### 4.1 Modul CV Builder & Editor
- **FR-001:** Sistem menyediakan antarmuka form terstruktur per bagian yang langsung merefleksikan perubahan ke panel Live Preview, termasuk hingga tiga alamat website/portofolio pada Informasi Kontak.
- **FR-002:** Form mendukung bagian inti (Informasi Kontak — termasuk LinkedIn terpisah dan maksimal tiga website/portofolio — Ringkasan Profesional, Pengalaman Kerja, Pendidikan, Keahlian, Bahasa) dan bagian kustom (Proyek, Sertifikasi, Penghargaan, Publikasi).
- **FR-003:** Pengguna dapat menambah, menghapus, menyusun ulang urutan bagian (reorder), dan memformat teks (tebal, miring, daftar butir, tautan).
- **FR-004:** Pengguna dapat memilih skema warna dan tipografi yang aman untuk sistem ATS maupun template visual.
- **FR-005:** Pengguna dapat mengimpor berkas CV lama (PDF atau DOCX); sistem mengekstrak konten ke field editor (termasuk website/portofolio pertama ke model daftar website), menandai bidang dengan confidence rendah, dan meminta konfirmasi verifikasi pengguna.
- **FR-006:** Pengguna dapat mengunduh CV hasil rancangan ke dalam format PDF dan DOCX yang valid dan dapat disunting, dengan seluruh website/portofolio non-kosong (maksimal tiga) ikut dirender.
- **Aturan Website/Portofolio (FR-001, FR-002, FR-005, FR-006):** Maksimal tiga alamat website per CV; LinkedIn tidak dihitung; setiap entri hanya berisi URL/domain tanpa label; entri kosong tidak dirender atau diekspor; field legacy `website` tetap dipertahankan untuk kompatibilitas draft lama dan disinkronkan dengan entri pertama yang terisi.
- **FR-034:** Live preview menampilkan estimasi jumlah halaman A4 berdasarkan tinggi konten yang dirender dan menandai batas halaman visual, termasuk penyesuaian untuk template full-bleed.
- **FR-035:** Sebelum ekspor, sistem menjalankan preflight kualitas CV; error memblokir ekspor, warning memerlukan acknowledgment eksplisit, dan setiap temuan menyediakan navigasi “Perbaiki” ke bagian editor terkait.
- **FR-036:** Informasi Kontak mendukung headline profesional opsional yang dapat diedit, dirender pada live preview, dan diekspor ke PDF/DOCX.
- **FR-037:** Setiap pengalaman kerja mendukung daftar pencapaian terstruktur yang dapat ditambah, diedit, dan diurutkan; draft lama tanpa `achievements` tetap dirender dari `description` sebagai fallback.
- **FR-038:** Pengguna dapat menyusun ulang entri pengalaman/pendidikan dan urutan bagian CV; pendidikan mendukung deskripsi; validasi tanggal menerima format seperti `Jan 2022`, `2022`, dan `2022-01` serta memperlakukan `Sekarang/Present` sebagai tanggal akhir terbuka.
- **FR-039:** Dari hasil Job Matching, pengguna dapat membuat draft CV target sebagai salinan draft sumber dengan metadata lowongan, skill yang cocok diurutkan lebih dahulu, dan draft asli tidak berubah.
- **FR-040:** Impor CV mendukung pemilihan bagian, mode `merge` atau `replace`, dan undo selama 30 detik yang hanya mengembalikan bagian yang diimpor tanpa menghapus perubahan pada bagian lain.
- **FR-041:** Daftar draft mendukung pencarian, favorit (diurutkan sebelum draft lain), rename inline, duplikasi, dan badge target lowongan; inisialisasi aplikasi tidak boleh membuat draft kosong sebelum daftar draft selesai dimuat.

> **Aturan Kompatibilitas Data (FR-036–FR-041):** `headline`, `achievements`, `sectionOrder`, `favorite`, dan `targetJob` bersifat opsional. `sectionOrder` yang tidak dikenal difilter dan bagian yang hilang ditambahkan secara deterministik; `contact.website` legacy tetap dipertahankan; pencapaian kosong tidak dirender/diekspor; impor dan pembuatan CV target tidak boleh memodifikasi draft sumber.

### 4.2 Modul Evaluasi ATS & Job Matching
- **FR-007:** Sistem menghitung skor ATS struktur (0–100) berdasarkan keterbacaan tata letak, keberadaan heading standar, kejelasan kronologis, dan ketiadaan elemen grafis pemblokir mesin.
- **FR-008:** Sistem menyediakan fitur pencocokan lowongan kerja terpisah (Job Matching Score) yang membandingkan keahlian, jabatan, tingkat pengalaman, dan kualifikasi pendidikan terhadap teks lowongan.
- **FR-009:** Sistem menyajikan saran perbaikan konkret tanpa mengubah konten secara otomatis dan memberikan peringatan anti-keyword stuffing.
- **FR-010:** Pengguna dapat memasukkan deskripsi lowongan melalui penempelan teks atau pengunggahan file (PDF/DOCX).
- **FR-011:** Sistem dapat mengekspor ringkasan laporan analisis ATS dan rekomendasi perbaikan ke dalam format PDF.

### 4.3 Modul Konversi Dokumen & Keamanan PDF
- **FR-012:** Sistem menyediakan konversi dua arah DOCX ke PDF dan PDF ke DOCX untuk file berukuran hingga 25 MB dengan indikator progress dan tombol pembatalan.
- **FR-013:** Sistem menyediakan fitur PDF Tools: Merge (menggabungkan file PDF dan gambar) serta Split (memisahkan PDF berdasarkan nomor/rentang halaman).
- **FR-014:** Sistem menyediakan fitur konversi PDF ke gambar (JPG/PNG) dengan resolusi DPI yang dapat dikonfigurasi.
- **FR-015:** Sistem menyediakan fitur konversi gambar ke PDF dengan pengaturan ukuran halaman (A4, Letter) dan orientasi (Portrait, Landscape).
- **FR-027:** Sistem menyediakan fitur Protect PDF berbasis enkripsi AES-256 lokal menggunakan satu password buka dokumen yang kuat (12-40 byte UTF-8, huruf besar, kecil, angka, simbol), menolak berkas bertanda tangan digital dan berkas yang sudah terenkripsi, menghasilkan berkas `<nama>_protected.pdf`.
- **FR-028:** Sistem menyediakan fitur Unlock PDF berbasis dekripsi lokal menggunakan password yang sah, menolak berkas yang tidak terenkripsi atau berkas bertanda tangan digital, menghasilkan salinan bebas proteksi `<nama>_unlocked.pdf`.
- **FR-029:** Sistem menyediakan fitur Repair PDF untuk merekonstruksi tabel xref rusak, menambal trailer cacat, menyelamatkan stream objek/halaman yang terputus, dan membuang elemen korup via sanitasi PyMuPDF, menghasilkan berkas `<nama>_repaired.pdf`.
- **FR-030:** Sistem menyediakan fitur OCR PDF untuk menyisipkan lapisan teks transparan (searchable layer) di bawah gambar pindaian menggunakan engine Tesseract lokal (pilihan bahasa ind, eng, ind+eng) dengan deteksi status ketersediaan dan panduan instalasi edukatif, menghasilkan berkas `<nama>_searchable.pdf`.
- **FR-031:** Sistem menyediakan fitur Watermark PDF untuk membubuhkan stempel teks atau logo gambar dengan opasitas (0.1–1.0), rotasi sudut arbitrary (-90° s/d 90°), grid posisi 3x3 dan pola berulang (mosaic), serta seleksi target halaman kustom, menghasilkan berkas `<nama>_watermarked.pdf`.
- **FR-032:** Sistem menyediakan fitur Page Numbers PDF untuk menyisipkan penomoran halaman otomatis dengan variasi format (`{n}`, `{n}/{total}`, `Halaman {n} dari {total}`, `Page {n} of {total}`), letak posisi 6 titik, jarak margin tepi dinamis, pengecualian halaman sampul (mulai dari halaman X), dan penomoran awal Y, menghasilkan berkas `<nama>_numbered.pdf`.
- **FR-033:** Sistem menyediakan fitur PDF to Markdown untuk mengekstrak dokumen PDF menjadi berkas Markdown (.md) lokal dengan mempertahankan heading, tabel, list, dan link, dilengkapi panggung pratinjau teks Markdown langsung, tombol salin ke clipboard, dan opsi rentang halaman kustom.

### 4.4 Modul Utilitas Gambar
- **FR-016:** Sistem menyediakan fitur resize foto yang dapat mengoptimalkan ukuran berkas JPG/PNG menuju target spesifik (KB/MB) secara otomatis dan menghapus metadata EXIF/GPS secara default.

### 4.5 Modul Manajemen Data & Draft Lokal
- **FR-017:** Sistem menyimpan draft CV secara persisten di IndexedDB browser lokal, mendukung autosave, duplikasi draft, ganti nama, dan penghapusan draft.
- **FR-018:** Penghapusan draft wajib meminta konfirmasi dialog dan menyediakan mekanisme pembatalan (undo snackbar) selama 10 detik.
- **FR-019:** Sistem menyediakan mode privat (Private/Incognito Session) di mana tidak ada draft yang disimpan ke IndexedDB setelah jendela ditutup.
- **FR-020:** Pengguna dapat melihat dan menghapus metrik penggunaan operasional lokal (telemetry reset).
- **FR-021:** UI menampilkan status kesiapan backend lokal (health indicator) dan panduan jika dependensi LibreOffice belum terpasang.
- **FR-022:** Unduhan hasil parsial atau konversi fallback hanya diizinkan setelah pengguna menyetujui peringatan visual.
- **FR-023:** Sistem menyediakan fitur ekspor dan impor project file (.docbuilder) dengan opsi enkripsi kata sandi untuk cadangan data portabel.
- **FR-024:** Penamaan file keluaran digenerasi secara otomatis, dapat disunting pengguna sebelum proses unduh, dan disanitasi di frontend serta backend; ekstensi ganda dilepas, karakter tidak valid/control character dibersihkan, dan nama kosong memakai fallback aman atau ditolak pada preflight.

### 4.6 Modul Akun Pengguna & Penyimpanan Kuota CV Cloud (Online)
- **FR-042:** Sistem menyediakan alur pendaftaran dan masuk akun pengguna menggunakan Email + Password (dengan verifikasi email wajib dan hashing modern) serta Google OAuth (hanya menerima email terverifikasi). Sistem dilarang melakukan auto-merge akun pada alamat email yang sama; penggabungan akun wajib melalui proses otorisasi eksplisit di pengaturan akun terautentikasi dengan re-authentication.
- **FR-043:** Pengguna terdaftar dapat menyimpan, menyinkronkan, mengedit, menggandakan, dan menghapus proyek CV di server VPS dengan pembatasan kuota ketat: maksimal 5 dokumen aktif per akun, maksimal 10 MB per dokumen, maksimal 50 MB total per akun, dan ambang batas global 5 GB di server. Data CV disimpan dalam format data terstruktur + konfigurasi template (render PDF/DOCX dibuat on-demand dan dicache sementara).
- **FR-044:** Dokumen CV memiliki masa retensi 30 hari terhitung sejak tanggal terakhir diedit/disimpan (`updated_at`); membuka atau mengunduh tidak memperpanjang masa retensi. Dokumen yang kedaluwarsa dihapus permanen oleh background worker maksimal dalam 5 menit setelah `expires_at`.
- **FR-045:** Sistem mengirimkan notifikasi email transaksional via Brevo Free pada H-14, H-7, dan H-1 sebelum dokumen kedaluwarsa dihapus permanen. Email pemberitahuan dilarang memuat rincian isi CV atau PII detail pengguna. Pengguna juga dapat melakukan penghapusan akun mandiri yang seketika mencabut sesi dan menjadwalkan penghapusan seluruh data aktif maksimal 24 jam (dengan backup terenkripsi di Cloudflare R2 otomatis kedaluwarsa maksimal 7 hari).

### 4.7 Modul Penghapus Latar Belakang Gambar Lokal (Remove Background)
- **FR-046:** Sistem menyediakan alat penghapus latar belakang gambar statis (JPG, PNG, WebP hingga ukuran 10 MB) menjadi berkas PNG RGBA dengan transparansi alpha menggunakan model segmentasi ringan U2NetP yang dijalankan secara lokal di CPU host VPS tanpa mengirim payload ke layanan cloud pihak ketiga.
- **FR-047:** Proses inferensi remove-background dijalankan dalam subprocess terisolasi dengan timeout keras 30 detik, concurrency 1 job aktif, dan antrean tunggu maksimal 2 job (penolakan dengan HTTP 429/503 saat antrean penuh). Antarmuka web menyediakan panggung pratinjau interaktif (pola catur transparansi / checkerboard dan opsi latar warna pratinjau) sebelum pengguna mengunduh berkas akhir.

### 4.8 Modul Layanan Pemendek URL Serverless (URL Shortener)
- **FR-048:** Sistem menyediakan layanan pemendek URL publik mandiri yang berjalan di edge Cloudflare Workers + database D1 pada subdomain khusus, dengan ketentuan:
  1. Pengalihan cepat direct HTTP 302 ke destination URL yang valid (wajib skema HTTPS publik, menolak IP private RFC 1918, menolak loopback/link-local/reserved IP, dan menolak kredensial dalam URL).
  2. Pembuatan dan pengelolaan tautan (list, create, revoke) khusus untuk pemilik/administrator melalui API yang diverifikasi tanda tangan HMAC + timestamp + nonce untuk mencegah replay attack, serta antarmuka admin terlindungi Cloudflare Access (Zero Trust).
  3. Tautan aktif bersifat permanen tanpa tanggal kedaluwarsa otomatis; tautan yang dicabut (revoked) mengembalikan HTTP 410 Gone dan dicatat selama 90 hari sebelum destination dihapus menjadi tombstone permanen; slug tautan yang dicabut dilarang keras digunakan kembali (no slug reuse).
  4. Analitik kunjungan bersifat agregat tanpa pengumpulan PII (hanya mencatat `click_count` dan `last_accessed_at` tanpa menyimpan alamat IP atau fingerprint pengunjung).
  5. Pencadangan database D1 dilakukan berkala melalui export snapshot bergulir (mingguan disimpan 8 minggu, bulanan disimpan 12 bulan).

### 4.9 Modul Hapus Watermark (`CR-020`)
- **FR-058:** Sistem menyediakan alat **Hapus Watermark** bagi pengguna terautentikasi untuk membersihkan watermark tipis umum pada berkas **PDF, JPG/JPEG, dan PNG** (maksimum 25 MB, analisis interaktif PDF maksimal 50 halaman terpilih) milik pengguna atau yang pengguna berizin memodifikasinya, dengan ketentuan:
  1. Pengguna wajib mencentang konfirmasi hak kepemilikan/izin sebelum analisis dan pemrosesan final.
  2. Sistem menolak PDF terenkripsi dan PDF bertanda tangan digital (`has_digital_signature`) secara fail-closed.
  3. Deteksi kandidat menggabungkan objek struktural PDF (annotation/stamp/objek berulang) serta OCR teks opsional (Tesseract lokal jika tersedia; kegagalan atau ketiadaan OCR tidak memblokir editor manual).
  4. Pengguna memilih kandidat per halaman dan mengoreksi mask melalui kuas tambah/hapus (beserta ukuran kuas, undo, redo, reset). Tidak ada penghapusan otomatis tanpa tinjauan pengguna.
  5. Pemrosesan raster memakai OpenCV inpainting (`cv2.inpaint` INPAINT_TELEA) secara in-memory tanpa menyimpan berkas input/output permanen di server; PNG keluaran mempertahankan kanal alpha asli (inpaint pada RGB saja) dan metadata EXIF gambar dibersihkan.
  6. Halaman PDF non-annotation yang harus diraster ulang wajib menampilkan peringatan kehilangan teks selectable/vektor/tautan dan meminta konfirmasi eksplisit pengguna sebelum eksekusi; halaman PDF yang tidak ditargetkan tetap dipertahankan dalam bentuk vektor/aslinya.
  7. Pengguna meninjau perbandingan before/after terlebih dahulu sebelum mengunduh `<nama>_watermark_removed.<ext>`, disertai catatan keterbatasan bahwa detail yang tertutup watermark opaque tidak dapat dipulihkan sempurna.

### 4.10 Modul Compress Video (`CR-021`)
- **FR-059:** Sistem menyediakan alat **Compress Video** sebagai utilitas ke-26 pada direktori `#/tools` (kategori `convert`, **wajib login** dan email terverifikasi di mode produksi tanpa bypass anonim) bagi pengguna terautentikasi untuk mengompresi berkas video lokal menjadi MP4 lebih ringkas, dengan ketentuan:
  1. Input berupa unggahan berkas langsung (bukan URL) dengan format yang diizinkan pada MVP: **MP4, MOV, dan WebM**; ukuran maksimum tepat `250.000.000` byte (`250 MB`), durasi maksimum `600` detik (10 menit), resolusi input maksimum 4K (`3840x2160` atau orientasi portrait ekuivalen `2160x3840`), dan frame rate input maksimum `60` FPS.
  2. Kontrol kompresi berupa tepat **3 preset kualitas** single-pass H.264 (`libx264 -preset veryfast -threads 1`) + AAC: **Ringan** (`light`: CRF 23, AAC 128k), **Seimbang** (`balanced`: CRF 28, AAC 96k — default), dan **Maksimum** (`maximum`: CRF 32, AAC 64k). Tidak ada input target ukuran MB absolut dan tidak ada two-pass encoding.
  3. Output selalu berupa kontainer MP4 H.264 (`yuv420p`) + audio AAC (atau tanpa audio jika sumber tidak memiliki track audio) dengan nama `<nama>_compressed.mp4`, resolusi maksimal 1080p dan FPS maksimal 30 tanpa upscale (video `<= 1080p` atau `<= 30 FPS` tidak diperbesar/dinaikkan), serta seluruh metadata dan chapter dihapus (`-map_metadata -1 -map_chapters -1`, `-movflags +faststart`).
  4. Apabila ukuran berkas output `>=` ukuran berkas input (`output_size_bytes >= input_size_bytes`), server wajib langsung menghapus file output, menandai job gagal dengan kode `OUTPUT_NOT_SMALLER`, dan menampilkan pesan edukatif di UI agar pengguna mencoba preset yang lebih kuat.
  5. Seluruh unggahan melalui streaming byte mentah (`application/octet-stream` + header metadata `X-Video-Metadata` base64url), melewati scan antivirus ClamAV fail-closed sebelum `ffprobe`/`ffmpeg`, dan dibatasi 1 job aktif per akun, 3 job/jam per akun, 3 job/jam per IP, antrean global maksimal 1 berjalan + 2 menunggu, serta batas global workspace video `1.25 GiB`.
  6. Hasil kompresi hanya dapat diunduh **satu kali** (`succeeded -> claimed`) dan kedaluwarsa dalam **15 menit** (`900` detik), dengan polling status progres, tombol batalkan job, dan informasi perbandingan ukuran asli vs hasil.

### 4.11 Modul MP4 ke MP3 (`CR-022`)
- **FR-060:** Sistem menyediakan alat **MP4 ke MP3** sebagai utilitas ke-27 pada direktori `#/tools` (kategori `convert`, **wajib login** dan persetujuan konfirmasi hak kepemilikan/hak cipta tanpa bypass anonim) bagi pengguna terautentikasi untuk mengekstrak trek audio dari video MP4 lokal menjadi berkas MP3, dengan ketentuan:
  1. Input berupa unggahan berkas lokal tunggal (bukan URL, bukan batch) berformat **MP4** (`.mp4`, MIME `video/mp4`, magic bytes `ftyp`), ukuran maksimum `250.000.000` byte (`250 MB`), dan durasi maksimum `600` detik (10 menit).
  2. Wajib mencentang checkbox konfirmasi kepemilikan / hak cipta audio sebelum tombol ekstraksi aktif di antarmuka.
  3. Menyediakan tepat **3 preset bitrate MP3** CBR stereo/mono:
     - **128k** (Standar / Voice / Podcast hemat ukuran)
     - **192k** (Kualitas Tinggi — Default seimbang musik & vokal)
     - **320k** (Maksimum / Studio fidelity)
  4. Validasi trek audio via `ffprobe`:
     - Berkas MP4 **wajib memuat minimal 1 trek audio**. Jika tidak ditemukan stream audio sama sekali, job langsung ditandai gagal dengan kode spesifik `NO_AUDIO_STREAM` dan antarmuka menampilkan pesan edukatif bahwa video tidak memiliki audio.
     - Memilih trek audio dengan flag `default` secara otomatis; jika tidak ada flag `default`, sistem memilih trek audio pertama (`stream 0:a:0`).
     - Preservasi jumlah channel untuk mono (1-ch) dan stereo (2-ch). Jika input memiliki lebih dari 2 channel (misal surround 5.1 / 6-ch), sistem secara otomatis melakukan downmix ke stereo 2 channel (`-ac 2`).
  5. Pembersihan data & output:
     - Seluruh metadata, cover art / image attachment streams, chapters, dan ID3 tags dihapus bersih (`-vn -map_metadata -1 -map_chapters -1`).
     - Output selalu berkas MP3 murni dengan format penamaan `<nama_asli_tanpa_ekstensi>_audio.mp3`.
  6. Infrastruktur dan batas pemakaian berbagi penuh dengan `CR-021`:
     - Memakai antrean PostgreSQL, daemon worker systemd, scan antivirus ClamAV 64 KiB, isolasi sandbox bubblewrap, batas konkurensi (1 job aktif per pengguna, 1 running + 2 waiting global), rate limit (3 job/jam per akun & IP), batas ruang kerja global 1.25 GiB, hard timeout 10 menit (`600` detik), serta retensi unduhan sekali pakai 15 menit (`succeeded -> claimed`).

### 4.12 Modul Video ke Teks (`CR-023`)
- **FR-061:** Sistem menyediakan alat **Video ke Teks** sebagai utilitas ke-28 pada direktori `#/tools` (kategori `convert`, **wajib login** dan persetujuan konfirmasi hak kepemilikan/izin rekaman tanpa bypass anonim) bagi pengguna terautentikasi untuk mentranskripsikan rekaman video MP4 lokal menjadi teks dan subtitel secara privat di VPS lokal, dengan ketentuan:
  1. Input berupa unggahan berkas lokal tunggal (bukan URL, bukan batch) berformat **MP4** (`.mp4`, MIME `video/mp4`, magic bytes `ftyp`), ukuran maksimum `250.000.000` byte (`250 MB`), dan durasi maksimum `600` detik (10 menit).
  2. Wajib mencentang checkbox konfirmasi kepemilikan / hak cipta berkas dan izin mentranskripsikan suara orang yang direkam sebelum tombol transkripsi aktif di antarmuka.
  3. Menyediakan kontrol pemilihan bahasa transkripsi:
     - **auto** (Deteksi otomatis antara Bahasa Indonesia dan Inggris — default)
     - **id** (Bahasa Indonesia)
     - **en** (Bahasa Inggris)
  4. Validasi aliran audio & suara:
     - Berkas MP4 **wajib memuat minimal 1 trek audio**. Jika tidak ditemukan stream audio sama sekali, job langsung ditandai gagal dengan kode spesifik `NO_AUDIO_STREAM` dan antarmuka menampilkan pesan bahwa video tidak memiliki audio.
     - Ekstraksi audio sementara dilakukan via FFmpeg ke format PCM WAV 16kHz mono 16-bit (`-ar 16000 -ac 1 -c:a pcm_s16le`).
     - Jika audio tidak memuat ucapan yang dapat dikenali (hanya hening, derau, atau musik tanpa vokal), job ditandai gagal dengan kode spesifik `NO_SPEECH` tanpa menghasilkan berkas transkrip kosong.
  5. Format luaran & paket unduhan:
     - Output berupa satu paket arsip **ZIP** dengan penamaan `<nama_asli_tanpa_ekstensi>_transcript.zip`.
     - ZIP memuat tepat 3 berkas inti:
       - `<nama>_transcript.txt`: Transkrip teks bertimestamp per segmen `[HH:MM:SS - HH:MM:SS]`.
       - `<nama>_transcript.srt`: Subtitel SubRip standar bertimestamp `HH:MM:SS,mmm --> HH:MM:SS,mmm`.
       - `<nama>_transcript.docx`: Dokumen Microsoft Word rapi memuat judul transkrip, bahasa terdeteksi, durasi rekaman, tabel segmen waktu dan teks, serta disclaimer pemeriksaan manusia.
  6. Pratinjau baca-saja (Read-Only Preview):
     - Antarmuka menyajikan pratinjau seluruh teks hasil transkripsi per segmen waktu secara langsung setelah job berhasil (`succeeded`) sebelum atau sesudah unduhan ZIP.
     - Data pratinjau disimpan sebagai berkas `preview.json` sementara di direktori workspace job dan otomatis terhapus saat unduhan selesai atau kedaluwarsa.
  7. Berbagi antrean dan batasan operasional:
     - Memakai antrean PostgreSQL (`video_compression_jobs`, `job_type='transcribe'`), daemon worker systemd, ClamAV fail-closed, isolasi sandbox bubblewrap, batas konkurensi (1 job aktif per pengguna, 1 running + 2 waiting global), rate limit (3 job/jam per akun & IP), batas ruang kerja global 1.25 GiB, hard timeout 15 menit (`900` detik), serta retensi unduhan sekali pakai 15 menit (`succeeded -> claimed`).

### 4.13 Gate Peluncuran Beta (`CR-024` / `BETA-01`)
- **FR-062:** Pada rilis beta publik, direktori `#/tools` mengelompokkan 28 kartu ke dalam 7 kategori (`Konversi Dokumen`, `Kelola & Optimasi PDF`, `Ekstraksi & Digitalisasi`, `Keamanan & Tanda Tangan`, `Gambar & Foto`, `Media & Audio`, dan `Utilitas Digital`), menampilkan 19 fitur aktif dan menonaktifkan 9 fitur (`Pengunduh Media`, `Blur Background`, `WebP ke JPG`, `OCR PDF`, `Edit PDF`, `Repair PDF`, `Compress Video`, `MP4 ke MP3`, `Video ke Teks`) sebagai kartu `Coming Soon` (`disabled`), serta menampilkan metrik `19 aktif` dan `9 Coming Soon` pada Beranda.
- **NFR-SEC-018:** Ketika `BETA_COMING_SOON_GATES_ENABLED=True` (default), `SecurityMiddleware` menolak akses HTTP langsung ke `/api/media-downloads*`, `/api/video-compressions*`, `/api/pdf-tools/editor/pages`, `/api/pdf-tools/editor/apply`, `/api/pdf-tools/repair`, `/api/pdf-tools/ocr/status`, dan `/api/pdf-tools/ocr` dengan HTTP `503` (`error_code: "FEATURE_COMING_SOON"`) sebelum membaca stream upload atau menyentuh database, tanpa memblokir `/api/image-tools/remove-background` untuk `Hapus Latar Belakang`.

## 5. Nonfunctional Requirements (NFR)
- **NFR-PERF-001:** Respons interaksi UI pada editor (input form, tab switching, toggle) harus ≤ 200 ms pada perangkat benchmark.
- **NFR-PERF-002:** Startup backend lokal hingga siap menerima request harus ≤ 5 detik pada perangkat benchmark.
- **NFR-PERF-003:** Konversi dokumen referensi standar kantor ≤ 60 detik per berkas.
- **NFR-PERF-004:** Latensi respons pengalihan URL pendek (edge redirect Cloudflare Workers) ≤ 100 ms.
- **NFR-PERF-005:** Durasi inferensi remove-background (U2NetP pada 1 vCPU) ≤ 15 detik untuk gambar standar (hard timeout 30 detik).
- **NFR-PERF-008:** Proses encoding video berjalan single-thread (`-threads 1`, `libx264 -preset veryfast`) pada worker systemd terpisah dengan hard timeout 45 menit (`2700` detik) dan pembaruan progres berkala tanpa memblokir event loop API utama (2 worker Uvicorn tetap responsif).
- **NFR-PERF-009:** Proses ekstraksi audio MP4 ke MP3 berjalan pada worker sistem yang sama dengan hard timeout 10 menit (`600` detik) dan target durasi ≤ 60 detik untuk video 10 menit tanpa membebani memori sistem (streaming output via libmp3lame).
- **NFR-PERF-010:** Proses transkripsi AI berjalan offline CPU-only pada worker terpisah dengan timeout keras 15 menit (`900` detik), target durasi ≤ 15 menit untuk video 10 menit pada VPS 1 vCPU, serta peak RAM terkontrol melalui kuantisasi int8.
- **NFR-REL-001:** Error rate pada penggunaan berkas standar < 2%.
- **NFR-REL-002:** Concurrency dokumen converter dibatasi tepat 1 job aktif pada satu waktu.
- **NFR-REL-003:** Waktu tunggu maksimum satu job (timeout) converter adalah 5 menit; sistem membatalkan proses, membersihkan file sementara, dan mengizinkan retry.
- **NFR-REL-004:** Autosave draft harus dapat dipulihkan secara utuh setelah browser atau backend mengalami penghentian mendadak (crash recovery).
- **NFR-REL-005:** Concurrency worker remove-background dibatasi tepat 1 job aktif dan antrean tunggu maksimal 2 job; antrean melebihi batas ditolak seketika dengan status HTTP 429/503 dan header `Retry-After`.
- **NFR-REL-006:** Background sweeper retensi CV menghapus dokumen kedaluwarsa maksimal 24 jam setelah `expires_at`.
- **NFR-REL-007:** Pembersihan file temporer pengguna anonim (TTL maks 1 jam) berjalan otomatis secara berkala.
- **NFR-REL-010:** Koordinasi antrean video lintas multi-worker Uvicorn menggunakan PostgreSQL (`SELECT ... FOR UPDATE SKIP LOCKED`, partial unique index 1 aktif/akun dan 1 global `running`, transisi atomik `succeeded -> claimed`), pemulihan startup & sweeper TTL 15 menit, serta pembatasan global ruang kerja video `1.25 GiB` (`1.342.177.280` byte).
- **NFR-REL-011:** Penanganan kegagalan transkripsi atomik (pembersihan berkas audio sementara, penandaan job `failed` dengan kode terstandarisasi seperti `NO_AUDIO_STREAM`, `NO_SPEECH`, `TRANSCRIPTION_TIMEOUT`), pembatalan proses per process-group, serta jaminan integritas paket ZIP 3-file tanpa berkas korup atau path traversal.
- **NFR-SEC-001:** Backend hanya mengikat pada antarmuka loopback (`127.0.0.1`) di balik reverse proxy lokal (Caddy/Nginx) dan menolak koneksi langsung dari alamat IP publik tanpa melalui proxy.
- **NFR-SEC-002:** Berkas input pengguna bersifat read-only dan tidak boleh dimodifikasi di tempat asal.
- **NFR-SEC-003:** Sistem fail-closed dan memicu cleanup otomatis jika kapasitas penyimpanan disk atau memori sistem tidak mencukupi.
- **NFR-SEC-004:** Alokasi penyimpanan sementara (temp workspace) dibatasi maksimal 500 MB secara global untuk file operasional.
- **NFR-SEC-005:** Reverse proxy (Caddy/Nginx) menegakkan TLS 1.3, HSTS, Secure/HttpOnly/SameSite cookies, dan pembatasan laju (rate limiting) per IP.
- **NFR-SEC-006:** Kata sandi akun disimpan menggunakan modern hashing (Argon2id/bcrypt); token verifikasi dan reset kata sandi bersifat acak, berentropi tinggi, disimpan dalam bentuk hash, single-use, dan berumur pendek (≤ 15 menit).
- **NFR-SEC-007:** Dilarang melakukan auto-merge akun antara Email/Password dan Google OAuth dengan email yang sama; account linking wajib melalui otorisasi eksplisit di pengaturan akun.
- **NFR-SEC-008:** Validasi tujuan URL shortener wajib menolak skema non-HTTPS, menolak URL dengan kredensial (`user:pass@`), menolak loopback, private IPv4 (RFC 1918), IPv6 loopback/link-local, serta reserved IP addresses (anti-SSRF).
- **NFR-SEC-009:** Pembuatan/pengelolaan link URL shortener di Cloudflare Workers dilindungi autentikasi HMAC signature dengan timestamp dan nonce untuk mencegah replay attack, serta antarmuka admin dilindungi Cloudflare Access (Zero Trust).
- **NFR-SEC-010:** Cadangan database/CV terenkripsi ke Cloudflare R2 Standard wajib menggunakan enkripsi simetris kuat (AES-256-GCM) di VPS sebelum diunggah; bucket R2 bersifat private tanpa akses publik; lifecycle rule menghapus objek cadangan maksimal 7 hari.
- **NFR-SEC-011:** Analitik URL shortener strictly aggregated tanpa menyimpan IP address, browser fingerprint, atau PII (hanya `click_count` dan `last_accessed_at`).
- **NFR-SEC-012:** Kebijakan disk fail-closed: peringatan kapasitas disk pada ambang 70% dan penolakan simpan dokumen baru pada ambang 80% atau saat kuota global CV mencapai 5 GB.
- **NFR-SEC-016:** Pemindaian antivirus ClamAV streaming (`INSTREAM` chunk 64 KiB, fail-closed jika daemon tidak tersedia atau signature > 24 jam) wajib mendahului eksekusi `ffprobe`/`ffmpeg`; pada host Linux, `ffprobe`/`ffmpeg` dieksekusi dalam sandbox `bubblewrap --unshare-net --die-with-parent` dan diterminasi per process-group (`SIGTERM` -> `SIGKILL`); metadata & chapter keluaran dihapus; batas unggah umum reverse proxy Caddy 35 MB tetap terjaga dengan override matcher khusus route `POST /api/video-compressions` (~260 MB).
- **NFR-SEC-017:** Eksekusi engine transkripsi berjalan di sandbox terisolasi jaringan (`--unshare-net`); hak akses berkas 0600 dan direktori 0700; penamaan berkas dalam paket ZIP disanitasi tanpa path traversal atau symlink; redaksi total teks transkrip dan audio dari seluruh log aplikasi dan audit trail.
- **NFR-PRIV-001:** Semua modul analisis teks, parsing, konversi, dan remove-background berjalan lokal di server tanpa mengirim berkas atau payload dokumen ke pihak ketiga.
- **NFR-PRIV-002:** Berkas video input, direktori kerja sementara (`0700`/`0600`), dan video hasil kompresi tidak disimpan permanen, dihapus segera setelah gagal/dibatalkan/diunduh sekali pakai atau maksimal TTL 15 menit, tanpa menyisakan tag EXIF/GPS/chapter di MP4 output dan tanpa mencatat nama file/PII di log audit JSONL.
- **NFR-PRIV-003:** Berkas audio WAV perantara, teks transkrip, pratinjau JSON, dan paket ZIP tidak disimpan permanen, tidak dikirim ke pihak ketiga, dan dihapus seketika setelah diunduh sekali pakai atau saat kedaluwarsa TTL 15 menit.
- **NFR-COMP-001:** Spesifikasi server VPS: 1 vCPU, 2.2 GiB RAM, 4.0 GiB Swap, 40 GB SSD.
- **NFR-COMP-002:** Dukungan kompatibilitas penuh antarmuka pada 2 rilis mayor terbaru dari Chrome, Edge, Firefox, dan Safari.
- **NFR-UX-001:** Aksesibilitas antarmuka memenuhi standar WCAG 2.2 AA (kontras, label form, navigasi keyboard penuh).
- **NFR-UX-004:** Antarmuka Compress Video menampilkan progres unggah streaming, status tahapan worker real-time (`queued`/`scanning`/`probing`/`encoding`), tombol batal, saran preset saat `OUTPUT_NOT_SMALLER`, serta guard login wajib pada `#/tools`.
- **NFR-UX-005:** Antarmuka MP4 ke MP3 menampilkan dropzone MP4, checkbox konfirmasi kepemilikan wajib, pemilih 3 preset bitrate (128k, 192k default, 320k), status progres tahapan worker real-time (`queued`/`scanning`/`probing`/`extracting`), tombol pembatalan job, unduhan sekali pakai, pesan edukatif penolakan `NO_AUDIO_STREAM`, serta guard login wajib pada `#/tools`.
- **NFR-UX-006:** Antarmuka Video ke Teks menampilkan dropzone MP4, checkbox konfirmasi kepemilikan & izin rekaman wajib, pemilih bahasa (auto, id, en), status progres tahapan worker real-time (`queued`/`scanning`/`probing`/`extracting_audio`/`transcribing`/`packaging`), pratinjau baca-saja penuh bertimestamp, tombol unduh paket ZIP, tombol pembatalan job, pesan edukatif penolakan `NO_AUDIO_STREAM` dan `NO_SPEECH`, serta guard login wajib pada `#/tools`.
- **NFR-ACC-004:** Modal Compress Video memenuhi standar WCAG 2.2 AA (`vitest-axe` 0 pelanggaran, navigasi keyboard penuh, ARIA live status, dark mode kontras memadai, dan `prefers-reduced-motion`).
- **NFR-ACC-005:** Modal MP4 ke MP3 memenuhi standar WCAG 2.2 AA (`vitest-axe` 0 pelanggaran, navigasi keyboard penuh, ARIA live status, dark mode kontras memadai, dan `prefers-reduced-motion`).
- **NFR-ACC-006:** Modal Video ke Teks memenuhi standar WCAG 2.2 AA (`vitest-axe` 0 pelanggaran, navigasi keyboard penuh, ARIA live status pada progres dan pratinjau, dark mode kontras memadai, dan `prefers-reduced-motion`).

> **Catatan 2026-10-24:** Desain fitur tidak melakukan transmisi keluar, tetapi egress block OS-level untuk subprocess belum tersedia; jaminan NFR-PRIV-001 belum dapat dinyatakan sebagai kontrol yang ditegakkan (`RISK-SEC-003`). NFR-COMP-002 juga belum diverifikasi (`Q-005`).

## 6. Release Criteria MVP
1. Seluruh requirement berstatus Must Have (FR-001 s.d. FR-012, FR-017 s.d. FR-024) terverifikasi lulus uji.
2. Tidak ada defect berkategori Critical atau High yang belum terselesaikan.
3. Seluruh quality gates (Unit test, Integration test, Linting, Typechecking, SAST, SCA, Secret scan) berstatus PASS.
4. Minimal 90% dari 10 responden UAT menyatakan produk memenuhi indikator penerimaan.
5. Konversi corpus referensi kantor/CV mencapai tingkat fidelitas visual ≥95%.

> **Catatan konsistensi 2026-10-24:** Kriteria 5 saat ini diukur sebagai fidelitas field/teks round-trip 100%; metrik visual formal (SSIM/pixel diff) belum ditetapkan (`Q-001`). NFR-COMP-002 juga belum diverifikasi karena tidak ada E2E Playwright (`Q-005`). `RISK-SEC-003` (HIGH provisional) masih terbuka, sehingga release berikutnya tidak boleh mengklaim seluruh release criteria terpenuhi sampai risiko dan verifikasi tersebut diselesaikan. FR-034–FR-041 adalah peningkatan pascarilis yang telah diimplementasikan dan diverifikasi, tetapi belum menjadi dasar untuk mengubah status rilis atau security gate. Status rilis historis tidak diubah.
