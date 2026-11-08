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
last_completed_task: "FEATURE-DEVELOPER-FOOTER-001"
blocked_reason: null
last_updated: "2026-11-07"
```

## Ringkasan Fokus
Seluruh rangkaian fase implementasi (Fase 01 s/d Fase 09) telah SELESAI 100%. Hotfix packaging backend (`HOTFIX-PACKAGING-001`) menambahkan `[build-system]` dan package discovery `app*` sehingga editable install tetap berhasil saat `backend/temp_workspace` tersedia; `.gitignore` kini mengabaikan `*.egg-info/` dan `backend/logs/`. UI pascarilis telah dipisahkan menjadi empat workspace:
- Footer Pengembang & Tahun Rilis (`FEATURE-DEVELOPER-FOOTER-001`, 2026-11-07): Menambahkan komponen footer reusable `Footer.tsx` di Beranda (`Dashboard.tsx`), workspace ATS, dan workspace Alat Dokumen (`App.tsx`). Footer menyajikan tahun pengembangan (© 2026 Doc-builder), deskripsi aplikasi privat, nama developer (Rahmat Hidayat), serta tautan portofolio eksternal aman (`https://porto.rahmath72.cloud/` dengan `target="_blank"` dan `rel="noopener noreferrer"`). Desain selaras dengan estetika Editorial Paper & Forest Teal dan lulus uji aksesibilitas WCAG 2.2 AA. Verifikasi: 264/264 Vitest passing (3 test baru di `footer.test.tsx` + 1 test baru di `dashboard.test.tsx`), Vite production build PASS, Oxlint 0 error.
- Integrasi & Upgrade Maskot Dokumen Animasi Multi-Frame 18 Emosi (`FEATURE-DOCUMENT-MASCOT-001`, 2026-11-07): Berdasarkan lembar stiker 18 karakter dokumen imut (`Cute Document Mascot Emotion Sticker Sheet.png`), logo aplikasi di Navbar (`Navbar.tsx`) ditingkatkan menjadi maskot dokumen animasi frame-by-frame (`AnimatedDocumentMascot.tsx`) berukuran 48px (`w-11 h-11 sm:w-12 sm:h-12`) dengan tinggi Navbar 64px (`h-16`). Seluruh 18 karakter dipotong presisi di atas pil label teks dan dirakit menjadi master sprite sheet multi-kolom 6 frame × 18 emosi (144×144 px per frame, total 864×2592 px) di `frontend/src/assets/document-mascot-frames.webp` dan `.png`. Setiap emosi memiliki koreografi animasi frame-by-frame unik (squash & stretch, bounce, tremor, tilt) yang digerakkan melalui CSS discrete stepping `steps(5)` dengan durasi dinamis per emosi `--mascot-duration`. Komponen merespon interaksi kontekstual (hover: `berkedip`, klik: `tertawa`, menyimpan: `semangat`, berhasil simpan: `bangga`, pergantian workspace: `sapa_salam`/`siap_membantu`/`penasaran`/`semangat`), rotasi otomatis idle pada seluruh 18 emosi tanpa pengulangan berturut-turut, dan dukungan penuh `prefers-reduced-motion: reduce`. Verifikasi: 260/260 Vitest passing (10 unit test di `animated_mascot.test.tsx` & `navbar_drafts.test.tsx`), Vite production build PASS, Oxlint 0 error / 0 mascot warning.
- Sinkronisasi Kontrak Backend ATS & Job Matcher (`HOTFIX-BACKEND-CONTRACT-001`, 2026-11-07): Berdasarkan audit menyeluruh backend, layanan `ats_analyzer.py` dan `job_matcher.py` diselaraskan agar sepenuhnya kompatibel dengan skema data canonical frontend (`achievements`, `education`, `language`) tanpa merusak backward compatibility untuk draf dan pengujian legacy (`description`, `educations`, `name`). Di `job_matcher.py`, helper `extract_experience_text` menggabungkan `achievements` terstruktur dan `description` lama, `get_resume_educations` mendukung fallback `educations`, serta `extract_language_name` mendukung alias `name`. Di `ats_analyzer.py`, evaluasi Pilar 4 (Dampak Terukur) dan Pilar 5 (Integritas) kini membaca `achievements` sehingga resume dengan butir pencapaian terstruktur dinilai akurat, dan riwayat pendidikan membaca key `education` maupun `educations`. Verifikasi: 145/145 Pytest backend PASS (16 targeted test_ats.py & test_job_match.py), Ruff check PASS, 250/250 Vitest frontend PASS, Vite build PASS.
- Redesign Anti-Slop "Editorial Paper & Forest Teal" (`REDESIGN-EDITORIAL-TEAL-001`, 2026-11-07): Atas permintaan eksplisit pengguna untuk menghilangkan warna ungu/indigo dan tata letak *AI slop*, seluruh permukaan Beranda (`#/home`), Navbar (`Navbar.tsx`), dan shell workspace (`#/builder`, `#/ats`, `#/tools` di `App.tsx`) serta token global (`index.css`) dirombak ke arah visual **Editorial Paper & Forest Teal** (kanvas kertas hangat `#FAF9F6` / `stone-50`, permukaan dokumen `white` berbatas `stone-200`, tinta arang `stone-900`, dan 1 aksen tunggal `teal-800` `< 3%` area layar). Pola *AI slop* (hero pill badges, 4 kartu metrik terpisah berwarna-warni, dan 3 kartu fitur pelangi dengan panah otomatis) digantikan dengan **Header Meja Kerja Editorial**, **Ledger Status Dokumen** bersekat 1px, serta **Grid Asimetris 12-Kolom** yang menempatkan *Arsip & Draf CV Tersimpan* (7 kolom) sebagai fokus utama berdampingan dengan *Direktori Ruang Kerja* (5 kolom). Verifikasi: 249/249 Vitest (`9/9` `dashboard.test.tsx`, `7/7` `accessibility.test.tsx` 0 axe violations), 1/1 Playwright E2E multi-viewport (`1440, 1024, 820, 768, 390` + zoom `200%`, `CLS <= 0.1`, 0 kelas ungu) PASS, Vite build PASS, Oxlint 0 error.
- Refinement & Hardening Beranda/Dashboard (`IMPROVEMENT-DASHBOARD-REFINEMENT-001`, 2026-11-07): Permukaan Beranda (`#/home`) dipoles sesuai standar `frontend-engineering` (Mode B `Operate`, Change Intent `Refinement`, *Quiet local-workspace confidence*): teks baca utama & deskripsi `>= 16px`, label/metadata `>= 13px`, angka metrik `tabular-nums`, kontras terhitung WCAG 2.2 AA/AAA (`>= 7.5:1`), permukaan netral 90–95% (`bg-white`), eliminasi dead control ATS saat skor belum tersedia, sinkronisasi jumlah alat dokumen dinamis (`18`), skeleton loading bebas empty-state flash (`CLS <= 0.1`), alert `storageError` tersanitasi + tombol *Coba Lagi*, guard *double-submit* asinkron, serta verifikasi Playwright Chromium lintas 5 viewport (`1440, 1024, 820, 768, 390`) dan zoom `200%`. Verifikasi: 248/248 Vitest (37/37 test files, 8/8 `dashboard.test.tsx`, 7/7 `accessibility.test.tsx` 0 axe violations), 1/1 Playwright E2E multi-viewport PASS, Vite build PASS, Oxlint 0 error.
- Dashboard / Beranda Utama (`FEATURE-DASHBOARD-HOME-001`, 2026-10-30): Routing default aplikasi saat root tanpa hash kini membuka Beranda (`#/home`). Beranda menyajikan hero studio lokal privat, aksi cepat (Buat CV Baru, Lanjutkan Terakhir, Impor CV), kartu 3 workspace utama (CV Builder, Optimasi ATS, Alat Dokumen), daftar draf CV tersimpan/favorit dengan indikator waktu relatif, bar status ringkas (total CV, skor ATS, status aktif, alat dokumen), dan penanganan empty state yang ramah. Penghapusan pembuatan draf otomatis saat storage kosong: draf baru hanya dibuat saat pengguna sengaja mengklik tombol buat baru atau impor. Integrasi Navbar: penambahan tab navigasi Beranda dan logo header kini mengarahkan ke Beranda. Direct link `#/builder`, `#/ats`, dan `#/tools` tetap kompatibel 100%. Verifikasi: 243/243 Vitest (37/37 test files, 7 test baru), 141/141 Pytest backend, Vite build PASS, Oxlint 0 error.
- Pencocokan Lowongan Kerja Multidimensi Cerdas (`IMPROVEMENT-JOB-MATCHING-001`, 2026-10-27): Engine pencocokan lowongan (`backend/app/services/job_matcher.py` & `frontend/src/services/ats.ts`) ditingkatkan secara komprehensif tanpa dependensi AI/cloud eksternal. Evaluasi mencakup 6 dimensi terbobot: Posisi & Keluarga Peran (25%), Keahlian Wajib vs Preferred (30%), Tanggung Jawab & Bukti Pengalaman (20%), Senioritas & Durasi Pengalaman (10%), Pendidikan (10%), dan Bahasa (5%). Bobot dinormalisasi dinamis jika lowongan tidak menyebut kriteria tertentu. Jika kualifikasi wajib (required) tidak terpenuhi, skor dibatasi maksimal 69. Lowongan tanpa kriteria yang dapat dievaluasi menghasilkan `analysis_status: 'insufficient_data'`. Antarmuka modal (`JobMatchModal.tsx`) menampilkan Skor Kecocokan Profil, badge target/senioritas, kartu rincian dimensi, peringatan batas skor 69, kualifikasi belum terpenuhi, dan mempertahankan alur Buat CV Target. Verifikasi: 141/141 Pytest (8/8 `test_job_match.py`), 236/236 Vitest (8/8 `job_match.test.tsx`), Ruff check PASS, Vite build PASS, Oxlint 0 error.
- Portable Bundled LibreOffice (`PORTABLE-LIBREOFFICE-001`, 2026-10-27): LibreOffice runtime dibundel secara mandiri di `backend/bin/libreoffice` (~700MB, diabaikan dari git via `.gitignore`). Fungsi `detect_libreoffice()` di `backend/app/api/health.py` memprioritaskan direktori portable lokal repositori, env var `LIBREOFFICE_PATH`/`SOFFICE_PATH`, `%LOCALAPPDATA%\Programs\LibreOffice`, sistem `C:\Program Files`, dan `PATH`. Hasil: saat folder proyek dipindahkan ke perangkat Windows lain, aplikasi tetap mendeteksi LibreOffice secara offline tanpa instalasi ulang. Verifikasi: 4/4 konversi integrasi 200 OK (CV PDF, DOCX ke PDF, PowerPoint ke PDF, Excel ke PDF), 136/136 Pytest PASS, Ruff check PASS.
- Audit Trail Lokal (`SEC-AUDIT-001`, 2026-10-27): `backend/app/core/audit.py` menulis event JSONL append-only ke `backend/logs/` dengan permission `0600`/direktori `0700`, rotasi harian UTC, retensi 7 hari, dan fail-open. `SecurityMiddleware` mencatat denial Origin/session/CSRF, error API, dan request `/api/*` tanpa body/header/query/PII. Verifikasi: 10/10 `test_audit.py`, 136/136 Pytest, Ruff PASS, secret scan 180 file 0 temuan. `RISK-SEC-001` berstatus MITIGATED dengan closure menunggu approval owner.
- `#/builder`: pembuatan CV dengan editor 44%, preview 56%, scroll independen per kolom (`h-dvh`), footer navigasi langkah + progress bar, dan aksi CV kontekstual.
- `#/ats`: evaluasi keterbacaan ATS dan pencocokan lowongan dengan visualisasi progress skor.
- `#/tools`: 18 alat dokumen dikelompokkan dalam 4 kategori (*Konversi*, *Kelola PDF*, *Keamanan & Tanda Tangan*, *Gambar*) dilengkapi pencarian instan: DOCX ke PDF, PDF ke DOCX, PowerPoint & PDF, Excel & PDF, Merge Dokumen, Split PDF, Kompres PDF, PDF & Gambar, Edit PDF, Sign PDF visual, Resize Gambar, Unlock PDF, Protect PDF, Repair PDF, OCR PDF, Watermark PDF, Nomor Halaman, dan PDF to Markdown.
- Perbaikan Tata Letak, UI/UX & Animasi Halus (`IMPROVEMENT-UIUX-LAYOUT-001`): Shell `h-dvh` dengan scroll independen editor & preview (reset penuh pada `@media print`), switcher mobile segmented pill beranimasi, indikator garis aktif tab bagian + auto-scroll ke viewport, footer navigasi Sebelumnya/Berikutnya + progress bar langkah, hook `useDismiss` (klik luar & `Escape`) untuk seluruh popover Navbar serta modal Draft, utilitas animasi mikro 160–280 ms (`fade-in`, `fade-up`, `pop-in`, `toast-in`, `soft-pulse`, `animate-overlay-in`, `stagger-item`) yang menghormati `prefers-reduced-motion: reduce`, tata letak responsif `LanguagesForm`, serta guard unmount async pada `PdfOcrModal`. Verifikasi: 233/233 Vitest (36/36 file, 0 unhandled error, WCAG 2.2 AA axe PASS), Vite build PASS, Oxlint 0 error (16 warning pre-existing).
- Fitur Multi-Website CV (`FEATURE-CV-MULTI-WEBSITE-001`): Informasi Kontak mendukung maksimal tiga alamat website/portofolio (LinkedIn tetap terpisah), dengan model `contact.websites` dan fallback `contact.website` untuk draft lama. Entri kosong tidak dirender/diekspor; live preview 4 template dan ekspor DOCX/PDF dibatasi maksimal tiga entri.
- Peningkatan Preflight & Pagination CV (`IMPROVEMENT-CV-PREEXPORT-001`): Live preview menghitung estimasi halaman A4, menampilkan badge jumlah halaman dan overlay page-break (full-bleed dinormalisasi). Modal ekspor menjalankan preflight kualitas: error memblokir, warning membutuhkan acknowledgment, dan tombol “Perbaiki” membuka bagian terkait. Nama berkas dapat diedit dan disanitasi di frontend serta backend.
- Peningkatan Editor Terstruktur (`IMPROVEMENT-CV-STRUCTURED-001`): Headline profesional, pencapaian per pengalaman dengan tambah/edit/reorder, reorder pengalaman/pendidikan, deskripsi pendidikan, `sectionOrder`, dan validasi tanggal. Draft lama tetap kompatibel melalui fallback `description`; 4 template dan DOCX memakai helper yang sama.
- Peningkatan Alur Kerja CV (`IMPROVEMENT-CV-WORKFLOW-001`): CV target dibuat sebagai salinan draft sumber dengan metadata lowongan dan skill cocok diurutkan lebih dahulu. Impor selektif mendukung `merge`/`replace` per bagian serta undo 30 detik. Daftar draft mendukung pencarian, favorit, rename inline, duplikasi, dan badge target; autosave di-flush sebelum perpindahan draft.
- Verifikasi peningkatan CV & UI/UX: 233/233 Vitest, 126/126 Pytest, Ruff PASS, Vite build PASS, Oxlint 0 error (16 warning pre-existing). Batch ini telah di-commit dan di-push pada `465727b` (2026-10-27).
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
Tidak ada blocker implementasi. Proyek berstatus RELEASED. `RISK-SEC-001` sudah dimitigasi dengan audit trail dan 10 test, tetapi penutupan formal menunggu approval owner. `RISK-SEC-002` dan `RISK-SEC-003` masih memerlukan keputusan owner; `RISK-SEC-003` berstatus High provisional sehingga release berikutnya tidak boleh disetujui sampai dimitigasi atau diterima formal dengan approver dan expiry.

## Keputusan Tertunda
1. Closure approval `RISK-SEC-001` berdasarkan bukti `SEC-AUDIT-001`; treatment `RISK-SEC-002` dan `RISK-SEC-003` (mitigasi vs acceptance dengan expiry), target review 2026-10-31.
2. `Q-005`: apakah cross-browser E2E Playwright diperlukan untuk NFR-COMP-002 atau cukup verifikasi manual.
3. `Q-006`: kebijakan repository untuk `docs/conversations.json` yang berisi 178 transkrip percakapan.

## Next Recommended Action
Owner review dan setujui penutupan `RISK-SEC-001` berdasarkan bukti 10/10 `test_audit.py` dan 136/136 Pytest. Lanjutkan keputusan treatment `RISK-SEC-002` dan `RISK-SEC-003`; untuk `RISK-SEC-003`, prioritaskan apakah akan menambahkan egress block OS-level dan memory cap Linux atau menerima risiko dengan expiry. Jangan melakukan deployment/release berikutnya tanpa approval eksplisit.
