# Project State

```yaml
project_name: "Doc-builder"
complexity: "complex"
provisional_security_risk_level: "HIGH"
security_risk_level: "HIGH"
security_owner: "User (Owner)"
data_owner: "User (Owner)"
security_risk_approved_by: "User (Owner)"
security_risk_approved_at: "2026-10-20"
security_gate_status: "APPROVED"
security_gate_evidence_ref: "docs/project/security/SECURITY-SCAN-REPORT.md"
security_review_due: "2026-10-31"
remediation_gate_status: "NOT_REQUIRED"
remediation_allowed: false
remediation_task: null
status: "RELEASED"
requirements_approved: true
plan_approved: true
implementation_allowed: true
current_phase: null
current_task: null
last_completed_task: "IMPROVEMENT-UIUX-LAYOUT-001"
blocked_reason: null
last_updated: "2026-10-24"
```

## Ringkasan Fokus
Seluruh rangkaian fase implementasi (Fase 01 s/d Fase 09) telah SELESAI 100%. Hotfix packaging backend (`HOTFIX-PACKAGING-001`) menambahkan `[build-system]` dan package discovery `app*` sehingga editable install tetap berhasil saat `backend/temp_workspace` tersedia; `.gitignore` kini mengabaikan `*.egg-info/`. UI pascarilis telah dipisahkan menjadi tiga workspace:
- `#/builder`: pembuatan CV dengan editor 44%, preview 56%, scroll independen per kolom (`h-dvh`), footer navigasi langkah + progress bar, dan aksi CV kontekstual.
- `#/ats`: evaluasi keterbacaan ATS dan pencocokan lowongan dengan visualisasi progress skor.
- `#/tools`: 18 alat dokumen dikelompokkan dalam 4 kategori (*Konversi*, *Kelola PDF*, *Keamanan & Tanda Tangan*, *Gambar*) dilengkapi pencarian instan: DOCX ke PDF, PDF ke DOCX, PowerPoint & PDF, Excel & PDF, Merge Dokumen, Split PDF, Kompres PDF, PDF & Gambar, Edit PDF, Sign PDF visual, Resize Gambar, Unlock PDF, Protect PDF, Repair PDF, OCR PDF, Watermark PDF, Nomor Halaman, dan PDF to Markdown.
- Perbaikan Tata Letak, UI/UX & Animasi Halus (`IMPROVEMENT-UIUX-LAYOUT-001`): Shell `h-dvh` dengan scroll independen editor & preview (reset penuh pada `@media print`), switcher mobile segmented pill beranimasi, indikator garis aktif tab bagian + auto-scroll ke viewport, footer navigasi Sebelumnya/Berikutnya + progress bar langkah, hook `useDismiss` (klik luar & `Escape`) untuk seluruh popover Navbar serta modal Draft, utilitas animasi mikro 160–280 ms (`fade-in`, `fade-up`, `pop-in`, `toast-in`, `soft-pulse`, `animate-overlay-in`, `stagger-item`) yang menghormati `prefers-reduced-motion: reduce`, tata letak responsif `LanguagesForm`, serta guard unmount async pada `PdfOcrModal`. Verifikasi: 233/233 Vitest (36/36 file, 0 unhandled error, WCAG 2.2 AA axe PASS), Vite build PASS, Oxlint 0 error (16 warning pre-existing).
- Fitur Multi-Website CV (`FEATURE-CV-MULTI-WEBSITE-001`): Informasi Kontak mendukung maksimal tiga alamat website/portofolio (LinkedIn tetap terpisah), dengan model `contact.websites` dan fallback `contact.website` untuk draft lama. Entri kosong tidak dirender/diekspor; live preview 4 template dan ekspor DOCX/PDF dibatasi maksimal tiga entri.
- Peningkatan Preflight & Pagination CV (`IMPROVEMENT-CV-PREEXPORT-001`): Live preview menghitung estimasi halaman A4, menampilkan badge jumlah halaman dan overlay page-break (full-bleed dinormalisasi). Modal ekspor menjalankan preflight kualitas: error memblokir, warning membutuhkan acknowledgment, dan tombol “Perbaiki” membuka bagian terkait. Nama berkas dapat diedit dan disanitasi di frontend serta backend.
- Peningkatan Editor Terstruktur (`IMPROVEMENT-CV-STRUCTURED-001`): Headline profesional, pencapaian per pengalaman dengan tambah/edit/reorder, reorder pengalaman/pendidikan, deskripsi pendidikan, `sectionOrder`, dan validasi tanggal. Draft lama tetap kompatibel melalui fallback `description`; 4 template dan DOCX memakai helper yang sama.
- Peningkatan Alur Kerja CV (`IMPROVEMENT-CV-WORKFLOW-001`): CV target dibuat sebagai salinan draft sumber dengan metadata lowongan dan skill cocok diurutkan lebih dahulu. Impor selektif mendukung `merge`/`replace` per bagian serta undo 30 detik. Daftar draft mendukung pencarian, favorit, rename inline, duplikasi, dan badge target; autosave di-flush sebelum perpindahan draft.
- Verifikasi peningkatan CV & UI/UX: 233/233 Vitest, 126/126 Pytest, Ruff PASS, Vite build PASS, Oxlint 0 error (16 warning pre-existing). Perubahan belum di-commit, belum di-push, dan belum dirilis.
- Verifikasi fitur multi-website historis: 183/183 Vitest, 121/121 Pytest, Ruff PASS, Vite build PASS, lint 0 error (18 warning pada saat itu).
- Fitur PDF to Markdown Lokal Bergaya iLovePDF (`FEATURE-PDF-TO-MARKDOWN-001`):
  - Kartu baru dengan badge `New!` di workspace Alat Dokumen: "PDF to Markdown" (purple).
  - Modal `PdfToMarkdownModal.tsx`: ekstraksi dokumen PDF ke sintaks Markdown (`.md`) terstruktur 100% lokal via `pymupdf4llm`.
  - Fitur unggulan: panggung pratinjau teks Markdown langsung dengan syntax highlighting container, tombol *Salin Teks* ke clipboard (dengan indikator *Tersalin!*), tombol *Unduh .md*, dan filter rentang halaman target kustom.
  - Verifikasi: 45/45 Pytest `test_pdf_tools.py` (119 backend tests lulus), 179/179 Vitest frontend tests lulus (termasuk 6 unit test PDF to Markdown), 0 pelanggaran WCAG 2.2 AA (axe-core), build sukses, distribusi 5/5 lulus.
- Fitur Watermark PDF & Nomor Halaman PDF Lokal (`FEATURE-PDF-WATERMARK-PAGENO-001`):
  - Dua kartu baru di workspace Alat Dokumen: "Watermark PDF" (rose) dan "Nomor Halaman" (blue).
  - Modal `PdfWatermarkModal.tsx`: stempel teks/gambar, opasitas 10-100%, rotasi arbitrary, posisi 3x3 dan mosaic, seleksi target halaman, output `<nama>_watermarked.pdf`.
  - Modal `PdfPageNumbersModal.tsx`: 4 format nomor, letak posisi 6 titik, jarak margin tepi, lewati sampul depan (start page 2), output `<nama>_numbered.pdf`.
  - Verifikasi: 44/44 Pytest `test_pdf_tools.py` (118 backend tests lulus), 173/173 Vitest frontend tests lulus (termasuk unit test watermark & nomor halaman), 0 pelanggaran WCAG 2.2 AA (axe-core), build sukses, distribusi 5/5 lulus.
- Fitur Repair PDF & OCR PDF Lokal (`FEATURE-PDF-REPAIR-OCR-001`):
  - Dua kartu baru di workspace Alat Dokumen: "Repair PDF" dan "OCR PDF".
  - Modal `PdfRepairModal.tsx`: rekonstruksi xref, trailer patching, dan penyelamatan halaman/stream terpotong via PyMuPDF native (`garbage=4, clean=True, deflate=True`), fail-closed edukatif pada berkas berpassword, output `<nama>_repaired.pdf`.
  - Modal `PdfOcrModal.tsx`: deteksi otomatis ketersediaan Tesseract host via `pymupdf.get_tessdata()`, panduan instalasi edukatif (UB-Mannheim Windows, apt Linux), tombol periksa ulang, seleksi bahasa dokumen (ind, eng, ind+eng), penyisipan teks transparan via `pix.pdfocr_tobytes()`, output `<nama>_searchable.pdf`.
  - Verifikasi: 41/41 Pytest `test_pdf_tools.py` (115 backend tests lulus), 162/162 Vitest frontend tests lulus (termasuk unit test repair & OCR), 0 pelanggaran WCAG 2.2 AA (axe-core), build sukses, distribusi 5/5 lulus.
- Fitur Unlock PDF dan Protect PDF Berbasis AES-256 Lokal (`FEATURE-PDF-SECURITY-001`):
  - Dua kartu terpisah di workspace Alat Dokumen: "Unlock PDF" dan "Protect PDF".
  - Modal interaktif terpadu `PdfSecurityModal.tsx` dengan segmented tab ("Unlock PDF" & "Protect PDF"), pemicu dropzone batas 25 MB, dan toggle tampil/sembunyi password.
  - Mode Protect: Enkripsi AES-256 native PyMuPDF (`PDF_ENCRYPT_AES_256`, `permissions=4095`), validasi password kuat 12-40 byte UTF-8 (huruf besar, kecil, angka, simbol), checklist kekuatan password interaktif, penolakan berkas sudah terenkripsi, penolakan berkas bertanda tangan digital (fail-closed HTTP 422), dan output `<nama>_protected.pdf`.
  - Mode Unlock: Dekripsi password sah via PyMuPDF (`PDF_ENCRYPT_NONE`), penolakan berkas tidak terenkripsi, penolakan password salah (HTTP 422), penolakan berkas bertanda tangan digital (fail-closed HTTP 422), dan output `<nama>_unlocked.pdf`.
  - Kerahasiaan & Privasi: 100% lokal offline tanpa pengiriman data ke server pihak ketiga, password hanya di memori sesaat, tidak disimpan di disk dan dilarang dicatat di log.
  - Verifikasi: 38/38 Pytest pdf_tools (112 backend tests lulus), 15/15 Vitest `pdf_security.test.tsx`, 6/6 suite `accessibility.test.tsx` (0 WCAG 2.2 AA violations), 150/150 frontend test lulus, build lulus, 5/5 verifikasi distribusi lulus.
- Redesign Dialog Pemilih Penandatangan & Multi-Signer Lokal Sign PDF iLovePDF Style (`FEATURE-PDF-SIGN-002`):
  - Dialog pemilih penandatangan ("Siapa yang akan menandatangani dokumen ini? / Who will sign this document?") muncul otomatis setelah berkas PDF diunggah.
  - Dua kartu visual opsi: "Hanya saya" (*Only me*) dan "Beberapa orang" (*Several people*) dengan tombol merah tebal responsif dan panel ringkasan berkas (nama, ukuran, jumlah halaman).
  - Mode "Hanya saya": alur penandatanganan mandiri cepat dengan identitas tunggal "Saya Sendiri".
  - Mode "Beberapa orang": alur Multi-Signer Lokal terpadu dengan palet warna penanda identitas (Biru, Hijau, Ungu, Jingga, Merah Muda), pemilih pihak aktif (Pihak 1, Pihak 2, dst.), penambahan hingga 5 penandatangan, pengubahan nama inline, dan penghapusan pihak.
  - Visualisasi panggung kerja: Elemen overlay pada halaman menampilkan border warna khas pihak penandatangan dan badge tag nama pihak di sudut atas overlay.
  - Tombol "Ganti Mode" (`btn-switch-signing-mode`) di header studio untuk kembali ke dialog pemilih atau mengganti mode penandatangan tanpa perlu mengunggah ulang berkas.
  - Verifikasi: 19/19 Vitest `pdf_sign.test.tsx`, 6/6 suite `accessibility.test.tsx` (0 WCAG 2.2 AA violations), 135/135 frontend test lulus, build lulus, 108/108 Pytest lulus.
- Redesign Penuh UI/UX Editor PDF Layar Penuh iLovePDF Style (`FEATURE-PDF-EDITOR-002`):
  - Modal editor bertransformasi menjadi workspace interaktif layar penuh (`fixed inset-0`) dengan header kontrol terpadu.
  - Kolom kiri: Panel navigasi halaman vertikal (filmstrip), nomor halaman badge, indikator jumlah elemen per halaman, tombol reorder naik/turun, rotasi 90°, duplikasi, dan hapus halaman.
  - Kolom tengah: Kanvas pratinjau halaman PDF resolusi tajam (~960px / 120 DPI) dengan pan/drag/resize elemen overlay langsung di panggung, indikator seleksi aktif, dan kontrol floating zoom (Fit Page, Zoom In/Out, indikator persentase 40%-200%).
  - Kolom kanan: Panel layer "Edit PDF" berisi daftar elemen aktif halaman (Text, Drawing, Image, Signature) dengan fitur reorder z-index (Move Forward/Backward), rename/edit teks langsung, hapus elemen, serta tombol "Hapus Semua" (Remove all).
  - Toolbar atas terpadu: Mode kursor (Pilih), Tambah Teks, Unggah Gambar, Coret Bebas (Free Drawing), Tanda Tangan visual, tombol Undo/Redo riwayat aksi, dan pintasan manipulasi halaman.
  - Aksesibilitas keyboard penuh: Tombol panah (geser posisi), Shift+Panah (resize), Delete/Backspace (hapus elemen), Ctrl+Z (undo), Ctrl+Y (redo), dan 0 pelanggaran axe-core WCAG 2.2 AA.
  - Peningkatan Backend: Penyediaan bidang `preview` resolusi tinggi di `/editor/pages` dan eksekusi sekuensial urutan z-index `overlays` di `/editor/apply` dengan backward compatibility penuh.
  - Tombol aksi utama "Terapkan & Unduh PDF" merah tebal di pojok kanan bawah seperti referensi iLovePDF.
- Fitur Mandiri Sign PDF Visual (`FEATURE-PDF-SIGN-001`):
  - Kartu akses mandiri "Sign PDF" di workspace `#/tools` `App.tsx` yang membuka modal visual mandiri `PdfSignModal.tsx`.
  - Empat aset penandatanganan: Tanda Tangan, Paraf, Nama Terang, dan Tanggal Penandatanganan.
  - Tiga mode input pembuatan tanda tangan & paraf: Coret Kanvas interaktif, Ketik Nama/Inisial (dikonversi otomatis ke kursif via HTML5 Canvas), dan Unggah Gambar PNG/JPEG (maks. 5 MB).
  - Target halaman fleksibel: Halaman Aktif, Rentang Halaman (e.g. `1-3, 5`), atau Semua Halaman dokumen.
  - Panggung kerja interaktif: pratinjau thumbnail halaman aktif, drag overlay bebas dengan Pointer Events, resize sudut dengan aspect-ratio lock untuk tanda tangan/paraf, serta fallback keyboard navigation (tombol panah untuk geser, Shift+panah untuk resize, Delete untuk hapus) dan inspector numerik persentase.
  - Strip film navigasi halaman dengan indikator titik biru pada halaman yang telah memiliki overlay penandatanganan.
  - Backend endpoint `/api/pdf-tools/editor/apply` menerima parameter `output_mode: "signed"` untuk menghasilkan berkas `<nama>_signed.pdf`.
  - Hardening backend: pembatasan maksimum 50 overlay per halaman, sanitasi rasio via `_clean_ratio` (finite 0.0-1.0), dan penolakan format non-PNG/JPEG (HTTP 422).
  - Disclaimer edukatif keabsahan hukum lokal: visual signature bukan sertifikat kriptografis p12/pfx.
  - Aksesibilitas WCAG 2.2 AA (0 pelanggaran axe-core).
- Fitur Editor PDF Visual Lokal (`FEATURE-PDF-EDITOR-001`):
  - Ekstraksi thumbnail per halaman (240px lebar, 72 DPI JPEG base64) berlatar PyMuPDF di bawah kendali job manager.
  - Manipulasi halaman interaktif: geser urutan ke kiri/kanan, rotasi 90° bertahap, duplikasi halaman, dan penghapusan halaman (dengan proteksi minimal 1 halaman tersisa).
  - Penambahan teks overlay dengan konfigurasi ukuran font (10-24 pt), palet warna hex, dan pilihan posisi (Atas, Tengah, Bawah).
  - Penambahan tanda tangan visual via canvas coretan tangan atau gambar overlay dengan pemilihan penempatan (Kanan Bawah standar surat, Kiri Bawah, Tengah).
  - Terapkan & Unduh berkas PDF yang termutasi (`<nama>_edited.pdf`) dengan pengoptimalan kompresi stream `garbage=4, deflate=True`.
  - Fail-closed terhadap berkas PDF terenkripsi dan bertanda tangan digital (HTTP 422).
  - Aksesibilitas WCAG 2.2 AA (0 pelanggaran axe-core).
- Peningkatan UI/UX Modal PDF Tools (`IMPROVEMENT-PDF-TOOLS-UI-002`):
  - Modal dilebarkan dari `max-w-xl` ke `max-w-2xl` memberikan ruang leluasa pada 5 tab dan kartu tingkat kompresi.
  - Tab navigasi diperbarui menjadi segmented control terpadu (`bg-slate-100 p-1 rounded-xl`) yang konsisten dengan modal alat lainnya.
  - Badge pill tingkat kompresi (Lossless, Rekomendasi, Terkecil) diperbaiki tipografinya (`text-[10px]`, `rounded-full`, `leading-none`) sehingga tidak menabrak atau menumpuk teks judul card "Seimbang".
  - Scrollbar digantikan oleh `.custom-scrollbar` slim (6px rounded) dan tombol aksi utama dipastikan tidak terpotong tepi bawah viewport.
- Fitur Konversi PowerPoint & PDF serta Excel & PDF Dua Arah:
  - PowerPoint (.pptx/.ppt) ke PDF dan Excel (.xlsx/.xls) ke PDF menggunakan LibreOffice headless lokal di dalam sandbox subprocess terisolasi dengan penanganan fail-closed ramah (HTTP 422 `LIBREOFFICE_NOT_FOUND`) jika LibreOffice belum terpasang di host.
  - PDF ke PowerPoint (.pptx) merender setiap halaman dokumen menjadi slide visual berpresisi tinggi (144 DPI) dengan penyesuaian dimensi halaman tanpa crop.
  - PDF ke Excel (.xlsx) mengekstrak tabel terstruktur berbasis teks ke dalam sheet terpisah per halaman (menggunakan PyMuPDF `find_tables`), dengan baris pemisah antar tabel dan sanitasi proteksi formula injection (menambahkan prefix kutip tunggal `'` jika teks sel diawali simbol formula `=`, `+`, `-`, atau `@`).
  - Penolakan dokumen PDF scan tanpa tabel terstruktur secara edukatif (HTTP 422 `NO_TABLES_FOUND`).
  - Antarmuka Alat Dokumen (`#/tools`) menyediakan kartu akses terpisah untuk "PowerPoint & PDF" dan "Excel & PDF" dengan modal 2-tab yang accessible (WCAG 2.2 AA compliant).
- Fitur Kompresi PDF Lokal Cerdas (Compress PDF):
  - 3 tingkat kompresi: Ringan (lossless deflating & object streams), Seimbang (default, recompress gambar moderat 144 DPI Q75), dan Maksimum (kompresi agresif 96 DPI Q50).
  - Teks dapat dicari (searchable text), tautan, formulir, dan tata letak halaman tetap dipertahankan penuh.
  - Fail-closed penolakan dokumen PDF bertanda tangan digital (HTTP 422) demi menjaga keabsahan hukum tanda tangan.
  - Jika kompresi tidak menghasilkan berkas lebih kecil, berkas asli diunduh dengan pesan edukatif bahwa PDF sudah optimal.
  - Workspace Alat Dokumen menyediakan kartu mandiri "Kompres PDF" yang langsung membuka tab kompresi modal (`initialTab="compress"`).
- Peningkatan PDF Tools (Merge & Split):
  - Merge dokumen kini menerima berkas PDF, Word (.docx), dan gambar (JPG, PNG).
  - Berkas DOCX dikonversi secara sandboxed menggunakan LibreOffice headless lokal; penolakan ramah dengan HTTP 422 edukatif jika LibreOffice belum terpasang (tanpa hasil parsial atau server crash).
  - Urutan berkas merge dapat diatur naik/turun via tombol ArrowUp dan ArrowDown yang accessible sebelum proses penggabungan.
  - Split PDF rentang halaman majemuk (contoh: `1-3, 5, 7-9`) menghasilkan berkas-berkas PDF terpisah yang dikemas rapi dalam arsip ZIP dengan penamaan deterministik (`01_pages_001-003.pdf`, `02_page_005.pdf`, dst.), dengan tetap menjaga kompatibilitas kontrak lama `output_mode=combined`.
  - Workspace Alat Dokumen menyediakan kartu akses terpisah untuk "Merge Dokumen", "Split PDF", dan "PDF & Gambar" dengan sinkronisasi `initialTab` pada modal.
- Fitur Foto Profil CV adaptif: toggle pemakaian foto pada formulir kontak, pemrosesan crop 1:1 dan EXIF stripping via Canvas di sisi browser, tata letak foto adaptif di 4 template CV (bulat di Visual Executive, rounded-square di AtsClean, AtsModern, dan VisualMinimal), penyembunyian otomatis jika toggle nonaktif (tanpa menghapus draft foto), sanitasi data foto dari payload evaluasi ATS, validasi Base64 dan pencegahan bom dekompresi di backend, penyematan foto ke dokumen Word (.docx) saat toggle aktif, serta penanganan error HTTP 400 tanpa server crash.
- Parser impor CV (PDF/DOCX) diperkuat: domain email dicegah bocor menjadi website, alamat pada baris kontak majemuk berbasis delimiter diekstrak dengan akurat, bullet kotak/privat PDF (`□`, `\uf0b7`, `\u25a1`, dll) dibersihkan dari teks butir dan tidak lagi tertukar menjadi nama jabatan, header majemuk `Jabatan — Perusahaan | Periode` dipetakan presisi, serta kelulusan tahun tunggal (`Lulus 2015`) dipetakan ke `endDate` dengan rendering tanggal tanpa tanda minus gantung pada 4 template pratinjau dan DOCX.
- Topbar tidak lagi menggabungkan seluruh fitur dalam satu baris.
- Navigasi responsif menggunakan hash URL tanpa dependency router baru.
- Opsi dwibahasa (ID/EN) terintegrasi pada topbar desktop & mobile, mengubah label bawaan CV (heading, sekarang/present, dalam/in, IPK/GPA) secara konsisten pada pratinjau live, cetak PDF browser, dan ekspor DOCX/PDF backend tanpa mengubah konten inputan atau teks kustom pengguna.
- Modal Evaluasi ATS memprioritaskan rekomendasi perbaikan, menyediakan CTA kembali ke editor, dan menempatkan ekspor laporan sebagai aksi sekunder.
- Modal responsif layar penuh pada mobile, memiliki semantics dialog, fokus awal, tombol tutup berlabel, serta dukungan `Escape`.
- Impor PDF/DOCX mempertahankan urutan teks, pengalaman/pendidikan multi-baris, bahasa, dan bagian tambahan; hasil wajib ditinjau serta dikonfirmasi sebelum mengganti editor.
- `customSections` dapat diedit, dihapus, dirender oleh empat template, dicetak melalui fallback PDF browser, dan diekspor ke DOCX/PDF backend.
- Frontend API client mengikuti hostname halaman (`localhost` atau `127.0.0.1`) agar cookie sesi `SameSite=Lax` tetap terkirim dan mutasi API tidak gagal 401.
- Form Keahlian & Kompetensi (Skills) disederhanakan menjadi input general tanpa segmentasi dropdown kategori; field internal `category` tetap dipertahankan dengan default `General` demi kompatibilitas penuh draft IndexedDB lama.
- Skrip start-docbuilder (`.bat`, `.ps1`, `.sh`) dan package backend disempurnakan dengan penambahan direktori backend ke `PYTHONPATH` dan `sys.path` otomatis agar import internal `app.*` tidak gagal `ModuleNotFoundError`.
- Network error `Failed to fetch` dibungkus menjadi pesan bantuan instruktif agar pengguna langsung mengetahui status server backend dan solusi peluncurannya.
- Quality gates terbaru (IMPROVEMENT-CV-WORKFLOW-001): 126/126 Pytest PASS, Ruff PASS, 233/233 Vitest PASS, Vite build PASS, Oxlint 0 error dengan 16 warning pre-existing. Verifikasi distribusi belum dijalankan ulang pada perubahan ini.
- Dokumentasi reconciliation (`DOC-CONSISTENCY-001`, 2026-10-24): referensi `DEC-*` pada traceability diselaraskan (`DEC-012` untuk PDF toolkit, `DEC-013` untuk cookie `SameSite=Lax`), stack aktual React 19/Oxlint/Vitest dicatat, command SOP/test strategy dikoreksi, dan klaim Playwright/CI/CD/logging yang tidak didukung kode ditandai. Tiga open risk dicatat: `RISK-SEC-001` (audit/logging, provisional MEDIUM), `RISK-SEC-002` (permission/cleanup temp workspace, provisional LOW), dan `RISK-SEC-003` (sandbox egress hanya proxy env + Linux tanpa memory cap, provisional HIGH). Status rilis dan security gate historis tidak diubah.

## Blocker Aktif
Tidak ada blocker implementasi. Proyek berstatus RELEASED, tetapi `RISK-SEC-001`, `RISK-SEC-002`, dan `RISK-SEC-003` memerlukan keputusan owner sebelum ditutup/diterima. `RISK-SEC-003` berstatus High provisional; release berikutnya tidak boleh disetujui sampai risk ini dimitigasi atau diterima formal dengan approver dan expiry.

## Keputusan Tertunda
1. Risk treatment `RISK-SEC-001`, `RISK-SEC-002`, dan `RISK-SEC-003` (mitigasi vs acceptance dengan expiry), target review 2026-10-31.
2. `Q-005`: apakah cross-browser E2E Playwright diperlukan untuk NFR-COMP-002 atau cukup verifikasi manual.
3. `Q-006`: kebijakan repository untuk `docs/conversations.json` yang berisi 178 transkrip percakapan.

## Next Recommended Action
Review dan putuskan treatment `RISK-SEC-001`/`RISK-SEC-002`/`RISK-SEC-003`, lalu retest keamanan jika dimitigasi. Untuk `RISK-SEC-003`, prioritaskan keputusan apakah akan menambahkan egress block OS-level dan memory cap Linux atau menerima risiko dengan expiry. Setelah risk review selesai, lakukan review perubahan peningkatan CV yang masih uncommitted, lalu putuskan commit/release secara eksplisit. Jangan commit/push tanpa instruksi.
