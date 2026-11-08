# Product Requirements Document (PRD)

## 1. Metadata dan Revision History
- **Proyek:** Doc-builder
- **Versi:** 1.1.0
- **Status:** Pending Approval (Revisi Gerbang 1B)
- **Tanggal:** 2026-11-08
- **Referensi BRD:** `docs/project/BRD.md`
- **Revisi Terakhir:** 2026-11-08 — Transformasi online VPS multi-user: otentikasi akun & manajemen kuota CV 90 hari (FR-042 s/d FR-045), fitur penghapus latar belakang gambar lokal CPU-only U2NetP (FR-046, FR-047), dan layanan URL shortener serverless Cloudflare Workers + D1 (FR-048).

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
   - Draf CV disimpan selama 90 hari sejak tanggal pembaruan terakhir.
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
- **FR-044:** Dokumen CV memiliki masa retensi 90 hari terhitung sejak tanggal terakhir diedit/disimpan (`updated_at`); membuka atau mengunduh tidak memperpanjang masa retensi. Dokumen yang kedaluwarsa dihapus permanen oleh background worker maksimal dalam 24 jam setelah `expires_at`.
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

## 5. Nonfunctional Requirements (NFR)
- **NFR-PERF-001:** Respons interaksi UI pada editor (input form, tab switching, toggle) harus ≤ 200 ms pada perangkat benchmark.
- **NFR-PERF-002:** Startup backend lokal hingga siap menerima request harus ≤ 5 detik pada perangkat benchmark.
- **NFR-PERF-003:** Konversi dokumen referensi standar kantor ≤ 60 detik per berkas.
- **NFR-PERF-004:** Latensi respons pengalihan URL pendek (edge redirect Cloudflare Workers) ≤ 100 ms.
- **NFR-PERF-005:** Durasi inferensi remove-background (U2NetP pada 1 vCPU) ≤ 15 detik untuk gambar standar (hard timeout 30 detik).
- **NFR-REL-001:** Error rate pada penggunaan berkas standar < 2%.
- **NFR-REL-002:** Concurrency dokumen converter dibatasi tepat 1 job aktif pada satu waktu.
- **NFR-REL-003:** Waktu tunggu maksimum satu job (timeout) converter adalah 5 menit; sistem membatalkan proses, membersihkan file sementara, dan mengizinkan retry.
- **NFR-REL-004:** Autosave draft harus dapat dipulihkan secara utuh setelah browser atau backend mengalami penghentian mendadak (crash recovery).
- **NFR-REL-005:** Concurrency worker remove-background dibatasi tepat 1 job aktif dan antrean tunggu maksimal 2 job; antrean melebihi batas ditolak seketika dengan status HTTP 429/503 dan header `Retry-After`.
- **NFR-REL-006:** Background sweeper retensi CV menghapus dokumen kedaluwarsa maksimal 24 jam setelah `expires_at`.
- **NFR-REL-007:** Pembersihan file temporer pengguna anonim (TTL maks 1 jam) berjalan otomatis secara berkala.
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
- **NFR-PRIV-001:** Semua modul analisis teks, parsing, konversi, dan remove-background berjalan lokal di server tanpa mengirim berkas atau payload dokumen ke pihak ketiga.
- **NFR-COMP-001:** Spesifikasi server VPS: 1 vCPU, 2.2 GiB RAM, 4.0 GiB Swap, 40 GB SSD.
- **NFR-COMP-002:** Dukungan kompatibilitas penuh antarmuka pada 2 rilis mayor terbaru dari Chrome, Edge, Firefox, dan Safari.
- **NFR-UX-001:** Aksesibilitas antarmuka memenuhi standar WCAG 2.2 AA (kontras, label form, navigasi keyboard penuh).

> **Catatan 2026-10-24:** Desain fitur tidak melakukan transmisi keluar, tetapi egress block OS-level untuk subprocess belum tersedia; jaminan NFR-PRIV-001 belum dapat dinyatakan sebagai kontrol yang ditegakkan (`RISK-SEC-003`). NFR-COMP-002 juga belum diverifikasi (`Q-005`).

## 6. Release Criteria MVP
1. Seluruh requirement berstatus Must Have (FR-001 s.d. FR-012, FR-017 s.d. FR-024) terverifikasi lulus uji.
2. Tidak ada defect berkategori Critical atau High yang belum terselesaikan.
3. Seluruh quality gates (Unit test, Integration test, Linting, Typechecking, SAST, SCA, Secret scan) berstatus PASS.
4. Minimal 90% dari 10 responden UAT menyatakan produk memenuhi indikator penerimaan.
5. Konversi corpus referensi kantor/CV mencapai tingkat fidelitas visual ≥95%.

> **Catatan konsistensi 2026-10-24:** Kriteria 5 saat ini diukur sebagai fidelitas field/teks round-trip 100%; metrik visual formal (SSIM/pixel diff) belum ditetapkan (`Q-001`). NFR-COMP-002 juga belum diverifikasi karena tidak ada E2E Playwright (`Q-005`). `RISK-SEC-003` (HIGH provisional) masih terbuka, sehingga release berikutnya tidak boleh mengklaim seluruh release criteria terpenuhi sampai risiko dan verifikasi tersebut diselesaikan. FR-034–FR-041 adalah peningkatan pascarilis yang telah diimplementasikan dan diverifikasi, tetapi belum menjadi dasar untuk mengubah status rilis atau security gate. Status rilis historis tidak diubah.
