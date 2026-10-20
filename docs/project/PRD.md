# Product Requirements Document (PRD)

## 1. Metadata dan Revision History
- **Proyek:** Doc-builder
- **Versi:** 1.0.0
- **Status:** Approved (Gerbang 1B)
- **Tanggal:** 2026-10-20
- **Referensi BRD:** `docs/project/BRD.md`

## 2. Product Vision & Persona
- **Visi:** Menjadi platform dokumen pribadi lokal terdepan yang memberdayakan individu untuk menghasilkan dokumen profesional berkualitas tinggi tanpa mengorbankan privasi atau mengeluarkan biaya langganan.
- **Persona 1 — Pencari Kerja Fresh Graduate:** Memerlukan panduan struktur CV standar ATS, bantuan pencocokan kata kunci terhadap lowongan, dan foto formal yang ukurannya sesuai batas unggah portal kerja.
- **Persona 2 — Profesional Berpengalaman:** Memerlukan fleksibilitas bagian kustom, ekspor PDF/DOCX yang rapi, dan konversi dokumen pendukung lamaran tanpa risiko data karier bocor.
- **Persona 3 — Tim Rekrutmen / Reviewer HR:** Memerlukan verifikasi keterbacaan struktur resume kandidat dan utilitas penggabungan/pemisahan berkas pelamar secara offline.

## 3. Role dan Akses
- Single User Local Role: Aplikasi berjalan dalam konteks pengguna lokal pada mesin yang sama (`localhost`). Tidak ada multi-tenancy, registrasi akun, atau hierarki izin pengguna online pada MVP.

## 4. Functional Requirements (FR)

### 4.1 Modul CV Builder & Editor
- **FR-001:** Sistem menyediakan antarmuka form terstruktur per bagian yang langsung merefleksikan perubahan ke panel Live Preview.
- **FR-002:** Form mendukung bagian inti (Informasi Kontak, Ringkasan Profesional, Pengalaman Kerja, Pendidikan, Keahlian, Bahasa) dan bagian kustom (Proyek, Sertifikasi, Penghargaan, Publikasi).
- **FR-003:** Pengguna dapat menambah, menghapus, menyusun ulang urutan bagian (reorder), dan memformat teks (tebal, miring, daftar butir, tautan).
- **FR-004:** Pengguna dapat memilih skema warna dan tipografi yang aman untuk sistem ATS maupun template visual.
- **FR-005:** Pengguna dapat mengimpor berkas CV lama (PDF atau DOCX); sistem mengekstrak konten ke field editor, menandai bidang dengan confidence rendah, dan meminta konfirmasi verifikasi pengguna.
- **FR-006:** Pengguna dapat mengunduh CV hasil rancangan ke dalam format PDF dan DOCX yang valid dan dapat disunting.

### 4.2 Modul Evaluasi ATS & Job Matching
- **FR-007:** Sistem menghitung skor ATS struktur (0–100) berdasarkan keterbacaan tata letak, keberadaan heading standar, kejelasan kronologis, dan ketiadaan elemen grafis pemblokir mesin.
- **FR-008:** Sistem menyediakan fitur pencocokan lowongan kerja terpisah (Job Matching Score) yang membandingkan keahlian, jabatan, tingkat pengalaman, dan kualifikasi pendidikan terhadap teks lowongan.
- **FR-009:** Sistem menyajikan saran perbaikan konkret tanpa mengubah konten secara otomatis dan memberikan peringatan anti-keyword stuffing.
- **FR-010:** Pengguna dapat memasukkan deskripsi lowongan melalui penempelan teks atau pengunggahan file (PDF/DOCX).
- **FR-011:** Sistem dapat mengekspor ringkasan laporan analisis ATS dan rekomendasi perbaikan ke dalam format PDF.

### 4.3 Modul Konversi Dokumen
- **FR-012:** Sistem menyediakan konversi dua arah DOCX ke PDF dan PDF ke DOCX untuk file berukuran hingga 25 MB dengan indikator progress dan tombol pembatalan.
- **FR-013:** Sistem menyediakan fitur PDF Tools: Merge (menggabungkan file PDF dan gambar) serta Split (memisahkan PDF berdasarkan nomor/rentang halaman).
- **FR-014:** Sistem menyediakan fitur konversi PDF ke gambar (JPG/PNG) dengan resolusi DPI yang dapat dikonfigurasi.
- **FR-015:** Sistem menyediakan fitur konversi gambar ke PDF dengan pengaturan ukuran halaman (A4, Letter) dan orientasi (Portrait, Landscape).

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
- **FR-024:** Penamaan file keluaran digenerasi secara otomatis dan dapat disunting oleh pengguna sebelum proses unduh.

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

## 6. Release Criteria MVP
1. Seluruh requirement berstatus Must Have (FR-001 s.d. FR-012, FR-017 s.d. FR-024) terverifikasi lulus uji.
2. Tidak ada defect berkategori Critical atau High yang belum terselesaikan.
3. Seluruh quality gates (Unit test, Integration test, Linting, Typechecking, SAST, SCA, Secret scan) berstatus PASS.
4. Minimal 90% dari 10 responden UAT menyatakan produk memenuhi indikator penerimaan.
5. Konversi corpus referensi kantor/CV mencapai tingkat fidelitas visual ≥95%.
