# Product Requirements Document (PRD)

## 1. Metadata dan Revision History
- **Proyek:** Doc-builder
- **Versi:** 1.0.0
- **Status:** Approved (Gerbang 1B)
- **Tanggal:** 2026-10-20
- **Referensi BRD:** `docs/project/BRD.md`
- **Revisi Terakhir:** 2026-10-24 — Dukungan maksimal tiga website/portofolio, live preview 4 template, impor, dan ekspor PDF/DOCX; peningkatan pascarilis: estimasi pagination A4, preflight ekspor, headline profesional, pencapaian terstruktur, reorder bagian/entri, CV target, impor selektif + undo, dan manajemen draft lanjutan.

## 2. Product Vision & Persona
- **Visi:** Menjadi platform dokumen pribadi lokal terdepan yang memberdayakan individu untuk menghasilkan dokumen profesional berkualitas tinggi tanpa mengorbankan privasi atau mengeluarkan biaya langganan.
- **Persona 1 — Pencari Kerja Fresh Graduate:** Memerlukan panduan struktur CV standar ATS, bantuan pencocokan kata kunci terhadap lowongan, dan foto formal yang ukurannya sesuai batas unggah portal kerja.
- **Persona 2 — Profesional Berpengalaman:** Memerlukan fleksibilitas bagian kustom, ekspor PDF/DOCX yang rapi, dan konversi dokumen pendukung lamaran tanpa risiko data karier bocor.
- **Persona 3 — Tim Rekrutmen / Reviewer HR:** Memerlukan verifikasi keterbacaan struktur resume kandidat dan utilitas penggabungan/pemisahan berkas pelamar secara offline.

## 3. Role dan Akses
- Single User Local Role: Aplikasi berjalan dalam konteks pengguna lokal pada mesin yang sama (`localhost`). Tidak ada multi-tenancy, registrasi akun, atau hierarki izin pengguna online pada MVP.

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

## 5. Nonfunctional Requirements (NFR)
- **NFR-PERF-001:** Respons interaksi UI pada editor (input form, tab switching, toggle) harus ≤ 200 ms pada perangkat benchmark.
- **NFR-PERF-002:** Startup backend lokal hingga siap menerima request harus ≤ 5 detik pada perangkat benchmark.
- **NFR-PERF-003:** Konversi dokumen referensi standar kantor ≤ 60 detik per berkas.
- **NFR-REL-001:** Error rate pada penggunaan berkas standar < 2%.
- **NFR-REL-002:** Concurrency dibatasi tepat 1 job konversi aktif pada satu waktu.
- **NFR-REL-003:** Waktu tunggu maksimum satu job (timeout) adalah 5 menit; sistem membatalkan proses, membersihkan file sementara, dan mengizinkan retry.
- **NFR-REL-004:** Autosave draft harus dapat dipulihkan secara utuh setelah browser atau backend mengalami penghentian mendadak (crash recovery).
- **NFR-SEC-001:** Backend hanya mengikat pada antarmuka loopback (`127.0.0.1` / `localhost`) dan menolak koneksi dari alamat IP eksternal.
- **NFR-SEC-002:** Berkas input pengguna bersifat read-only dan tidak boleh dimodifikasi di tempat asal.
- **NFR-SEC-003:** Sistem fail-closed dan memicu cleanup otomatis jika kapasitas penyimpanan disk atau memori sistem tidak mencukupi.
- **NFR-SEC-004:** Alokasi penyimpanan sementara (temp workspace) dibatasi maksimal 500 MB secara global.
- **NFR-PRIV-001:** Semua modul analisis teks, parsing, dan konversi berjalan 100% offline tanpa mengirim payload ke luar perangkat.
- **NFR-COMP-001:** Spesifikasi perangkat minimum pengujian: CPU 4-core, RAM 8 GB, ruang kosong disk 2 GB.
- **NFR-COMP-002:** Dukungan kompatibilitas penuh pada 2 rilis mayor terbaru dari Chrome, Edge, Firefox, dan Safari.
- **NFR-UX-001:** Aksesibilitas antarmuka memenuhi standar WCAG 2.2 AA (kontras, label form, navigasi keyboard penuh).

> **Catatan 2026-10-24:** Desain fitur tidak melakukan transmisi keluar, tetapi egress block OS-level untuk subprocess belum tersedia; jaminan NFR-PRIV-001 belum dapat dinyatakan sebagai kontrol yang ditegakkan (`RISK-SEC-003`). NFR-COMP-002 juga belum diverifikasi (`Q-005`).

## 6. Release Criteria MVP
1. Seluruh requirement berstatus Must Have (FR-001 s.d. FR-012, FR-017 s.d. FR-024) terverifikasi lulus uji.
2. Tidak ada defect berkategori Critical atau High yang belum terselesaikan.
3. Seluruh quality gates (Unit test, Integration test, Linting, Typechecking, SAST, SCA, Secret scan) berstatus PASS.
4. Minimal 90% dari 10 responden UAT menyatakan produk memenuhi indikator penerimaan.
5. Konversi corpus referensi kantor/CV mencapai tingkat fidelitas visual ≥95%.

> **Catatan konsistensi 2026-10-24:** Kriteria 5 saat ini diukur sebagai fidelitas field/teks round-trip 100%; metrik visual formal (SSIM/pixel diff) belum ditetapkan (`Q-001`). NFR-COMP-002 juga belum diverifikasi karena tidak ada E2E Playwright (`Q-005`). `RISK-SEC-003` (HIGH provisional) masih terbuka, sehingga release berikutnya tidak boleh mengklaim seluruh release criteria terpenuhi sampai risiko dan verifikasi tersebut diselesaikan. FR-034–FR-041 adalah peningkatan pascarilis yang telah diimplementasikan dan diverifikasi, tetapi belum menjadi dasar untuk mengubah status rilis atau security gate. Status rilis historis tidak diubah.
