# Project Brief — Doc-builder

## 1. Identitas Proyek
- **Nama Proyek:** Doc-builder
- **Versi Rilis Target:** MVP 1.0.0
- **Target Waktu:** 3–4 bulan (fleksibel)
- **Model Layanan:** Web lokal + Backend lokal (offline, tanpa cloud), gratis/open-source
- **Target OS & Lingkungan:** Windows 10/11 & Linux desktop; browser modern (Chrome, Edge, Firefox, Safari)

## 2. Masalah dan Tujuan
- **Masalah:** Pembuatan dokumen manual dan CV sering memakan waktu, format tidak konsisten, rawan gagal parsing sistem ATS, dan konversi dokumen sering merusak tata letak atau membocorkan data pribadi ke layanan cloud pihak ketiga.
- **Tujuan:** Menyediakan aplikasi pembuatan CV (ATS-friendly & visual) yang cepat (≤15 menit), analisis kompatibilitas ATS lokal dengan scoring heuristik terpisah dari job matching, serta konversi dokumen dua arah (DOCX↔PDF) berfidelitas tinggi (≥95% pada corpus umum) secara aman dan privat.

## 3. Pengguna dan Nilai Utama
- **Target Pengguna:** Pencari kerja umum, fresh graduate, profesional berpengalaman, dan tim rekrutmen/HR.
- **Nilai Utama:**
  1. Privasi total: Dokumen dan PII diproses lokal tanpa kirim ke cloud.
  2. Kompatibilitas ATS: Rekomendasi konkret dan format yang ramah mesin pencari kerja.
  3. Konversi dokumen tanpa biaya langganan: Utilitas dokumen sehari-hari dalam satu paket.

## 4. Ruang Lingkup Inti
- **In Scope (Must Have):** Form CV Builder, Live Preview, Impor CV lama dengan review, Ekspor PDF & DOCX, Analisis ATS struktur & Job matching terpisah, Konversi DOCX↔PDF (≤25 MB), Offline localhost, IndexedDB autosave.
- **In Scope (Should Have):** Merge & Split PDF, Image↔PDF, Resize JPG/PNG target KB/MB dengan EXIF removal.
- **Out of Scope:** Sistem akun/login online, sinkronisasi cloud/VPS, integrasi job portal via URL scraping, batch conversion, dokumen terenkripsi/berpassword, API AI berbayar eksternal.

## 5. Indikator Keberhasilan (KPI)
- Pembuatan CV siap unduh ≤ 15 menit.
- Konversi dokumen selesai ≤ 60 detik (file ≤ 25 MB).
- Error rate penggunaan normal < 2%.
- Kemiripan visual konversi ≥ 95% pada corpus referensi.
- Lolos validasi UAT bersama 10 pengguna uji.

## 6. Stakeholder & Tata Kelola
- **Sponsor & Product Owner:** Pengguna (Personal Owner)
- **Security & Data Owner:** Pengguna (Personal Owner)
- **Validator Eksternal:** 10 Pengguna Uji, Praktisi HR, Penasihat Privasi/Legal
- **Status Persetujuan:** Disetujui (Gerbang 1 & Gerbang 2)
