# SATUKIT — Brand & Mascot Guidelines

**Versi:** 1.0 — 8 November 2026  
**Status:** Konsep visual disetujui sebagai arah kreatif; belum menjadi brand guideline produksi yang final.

## 1. Ringkasan merek

- **Nama produk:** Satukit (ditulis satu kata, huruf S kapital).
- **Jenis produk:** platform web kumpulan alat digital (all-in-one digital tools).
- **Tagline:** **Satu Tempat, Banyak Solusi Digital**.
- **Karakter merek:** modern, ramah, praktis, mudah diakses, bernuansa Indonesia.
- **Tujuan:** memudahkan pekerjaan digital sehari-hari tanpa harus berpindah-pindah layanan.
- **Contoh fitur:** pembuat CV, pengolahan/konversi file, resize/kompres foto, hapus latar belakang, pemendek URL, dan alat digital lain yang akan bertambah.

### Prinsip penamaan

Nama **Satukit** menggabungkan gagasan **satu** tempat dan **kit** (perangkat alat). Penjelasan ini adalah konsep branding, bukan klaim etimologi resmi.

## 2. Logo Satukit

Aset: `01_Logo/Satukit_Logo_HD.png`

- **Logomark:** bentuk huruf **S** geometris seperti pita yang terlipat, dalam gradasi hijau-toska.
- **Wordmark:** **Satukit**, huruf tebal, sudut membulat, modern.
- **Pendamping:** maskot Kitu boleh muncul di sebelah logo untuk banner/hero, tetapi sebaiknya disediakan pula versi logo tanpa maskot untuk header kecil.
- **Tagline:** `Satu Tempat, Banyak Solusi Digital`.
- **Aturan dasar:** pertahankan proporsi, hindari distorsi, dan sediakan ruang kosong di sekitar logo.

**Catatan:** aset yang tersedia berupa PNG raster, bukan file SVG atau logo vektor yang dapat diedit. Untuk produksi, logomark dan wordmark perlu digambar ulang dalam format SVG.

## 3. Maskot: Kitu

- **Nama resmi:** **Kitu** (menggantikan nama konsep awal **Kito**).
- **Peran:** asisten digital Satukit.
- **Julukan:** *Si Perkakas Pintar Nusantara* / *Si Asisten Digital Satukit*.
- **Kepribadian:** ceria, sigap, solutif, kreatif, sedikit jenaka, tidak menggurui.
- **Inspirasi bentuk:** **besek** (wadah anyaman bambu Indonesia) yang dipadukan dengan kotak perkakas digital.
- **Ciri visual utama:** tubuh kotak membulat warna bambu hangat, tekstur anyaman diagonal, tutup kompartemen, kain kepala bernuansa batik, simpul kain, daun hijau di atas kepala, mata besar, pipi merah muda, sarung tangan putih, sepatu hijau-toska, emblem bunga geometris di sabuk.
- **Simbol fungsi:** ketika kompartemen terbuka, muncul ikon CV, gambar, PDF, tautan, dan perkakas.
- **Arah gaya:** kartun chibi modern dengan outline jelas, shading lembut, tetap terbaca pada ukuran kecil.

### Gaya bahasa Kitu

- Sapaan: “Halo! Aku Kitu. Mau dibantu apa hari ini?”
- Berhasil: “Sip, sudah beres!”
- Menunggu: “Sebentar, Kitu lagi proses ya!”
- Kesalahan: “Waduh, belum berhasil. Yuk, coba lagi!”

## 4. Warna merek

Palet rujukan dari concept sheet; kode perlu diuji dan distandardisasi saat implementasi UI.

| Fungsi | Warna | HEX |
|---|---|---|
| Toska gelap | Primary dark | `#0F766E` |
| Toska utama | Primary | `#16B89A` |
| Hijau limau | Highlight | `#A3E635` |
| Kuning jingga | Energi/aksen | `#FFB22E` |
| Krem | Background hangat | `#FFF3E0` |
| Arang | Teks utama | `#26343A` |
| Bambu | Tubuh maskot | `#E7C58D` |

Gunakan kontras yang memadai untuk teks dan tombol; jangan menggunakan warna aksen terang sebagai teks kecil di atas latar putih.

## 5. Tipografi

**Satukit:** kandidat `Poppins` atau `Plus Jakarta Sans` dengan bobot Bold/SemiBold.  
**Kitu:** kandidat `Baloo 2` atau `Nunito Rounded` dengan bobot ExtraBold/Bold.  
**UI:** `Plus Jakarta Sans` atau `Inter` untuk keterbacaan.

Font ini adalah **rekomendasi**, bukan file font yang disertakan; pastikan lisensi dan implementasi sesuai kebutuhan.

## 6. Ekspresi dan konteks pemakaian

Aset: `03_Ekspresi/Kitu_Expression_Sticker_Sheet.png`

| Ekspresi | Penggunaan |
|---|---|
| Senyum / Wink | Sambutan dan onboarding |
| Semangat / Hore! | Ajakan menggunakan tools dan perayaan |
| Selesai! | Proses berhasil |
| Fokus / Berpikir | Sedang memproses |
| Penasaran / Ide! | Tips dan eksplorasi |
| Kaget / Bingung | Kondisi tidak terduga / bantuan |
| Kecewa / Sedih | Empty state atau kegagalan yang disampaikan empatik |
| Marah | Konten ekspresif, bukan untuk menyalahkan pengguna |
| Lelah / Tidur / Santai | Idle state dan ilustrasi santai |
| Cinta / Terima Kasih | Apresiasi |
| Buat CV / Edit Foto / Hapus Latar | Halaman fitur |
| Kelola File / Konversi File / Pendekkan URL | Halaman fitur |
| Siap Membantu! | Pusat bantuan / asisten |

**Catatan:** ekspresi pada lembar ilustrasi belum dipisah menjadi PNG transparan per karakter.

## 7. Animasi

Aset GIF berada di `05_Animasi/`. Ketiganya adalah **animasi gabungan beberapa pose/frame**, bukan satu file per ekspresi.

- `Kitu_Magical_Toolbox.gif`: ekspresi ramah, jempol, dan kompartemen perkakas terbuka.
- `Kitu_Expressions_A.gif`: kumpulan pose bahagia, berpikir, sedih, marah.
- `Kitu_Expressions_B.gif`: variasi pose ekspresi serupa.

**Penting:** animasi yang ada berupa GIF dengan frame berupa komposisi/grid; **belum berupa animasi karakter tunggal yang mulus**. Untuk integrasi website yang rapi, buat ulang animasi individual per ekspresi dengan kanvas konsisten, latar transparan, durasi 1–3 detik, dan loop yang halus. Ekspor WebP animasi atau Lottie bila sesuai.

## 8. Konsep website

Aset: `04_Website/Satukit_Landing_Page_Concept.png`

- **Tema:** clean, playful, friendly tech, Indonesia modern.
- **Hero:** judul besar “Satu Tempat, Banyak Solusi Digital”, deskripsi manfaat, CTA utama, dan ilustrasi Kitu.
- **Navigasi:** Beranda, Fitur/Tools, Harga (jika ada paket), Panduan, Tentang, Masuk/Daftar.
- **Kategori:** CV, foto, background remover, konversi file, pengelola file, pemendek URL, lainnya.
- **Komponen:** kartu fitur dengan sudut membulat, iconografi sederhana, whitespace cukup, motif Kawung/batik hanya sebagai aksen.
- **Latar:** putih/krem, hijau toska, ilustrasi lanskap Nusantara abstrak tanpa mendominasi konten.
- **UX:** mobile-first, pencarian tools, drag-and-drop file, progress state, hasil unduh yang jelas, serta penjelasan privasi file.

**Catatan:** desain website merupakan mockup visual, bukan kode HTML/CSS siap pakai. Klaim seperti “gratis” atau “aman” harus sesuai fitur dan kebijakan aktual.

## 9. Inventaris aset

| Folder | Isi | Status |
|---|---|---|
| `01_Logo/` | Logo Satukit HD | Konsep PNG |
| `02_Maskot/` | Character sheet dan eksplorasi maskot | Referensi visual |
| `03_Ekspresi/` | Sticker sheet ekspresi Kitu | Gabungan PNG |
| `04_Website/` | Landing page Satukit | Mockup PNG |
| `05_Animasi/` | Tiga GIF konsep gerakan | Prototype, belum GIF individual |
| `06_Referensi_Awal/` | Eksplorasi maskot dokumen dan referensi awal | Arsip, bukan identitas final |

## 10. Rencana tindak lanjut

1. Tetapkan varian logo horizontal, vertikal, icon-only, monochrome, dark mode, dan SVG.
2. Buat *master character* Kitu dengan proporsi baku dan latar transparan.
3. Pisahkan seluruh ekspresi menjadi aset individual dan ekspor PNG/WebP.
4. Buat animasi ekspresi individual untuk loading, success, error, idle, welcome.
5. Bangun design tokens, UI components, dan responsive landing page dari mockup.
6. Periksa ketersediaan domain, penggunaan merek, serta lisensi sebelum publikasi.

---

Dokumen ini mencatat keputusan dan arah desain dari percakapan pengembangan Satukit; bukan dokumen pendaftaran merek atau bukti kepemilikan hak eksklusif.
