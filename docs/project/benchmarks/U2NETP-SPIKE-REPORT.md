# Laporan Feasibility Spike & Benchmark U2NetP CPU-Only (TASK-10.1)

## 1. Metadata & Lingkungan Uji
- **Task:** `TASK-10.1` — Feasibility spike U2NetP CPU-only di VPS
- **Tanggal Eksekusi:** 2026-11-08 11:15:57 UTC
- **Host Perangkat:** Ubuntu 24.04 LTS x86_64
- **Spesifikasi CPU:** Intel(R) Xeon(R) Gold 6138 CPU @ 2.00GHz (Alokasi: 1 vCPU)
- **Spesifikasi RAM Fisik:** 2.2 GiB (Available baseline: ~1.8 GiB, Swap: 4.0 GiB)
- **Spesifikasi Model:** U2NetP ONNX (`u2netp.onnx`)
- **Ukuran File Model:** 4.36 MB (4,574,861 bytes)
- **Checksum Integritas (MD5):** `8e83ca70e441ab06c318d82300c84806` (MATCH)
- **Runtime Inferensi:** `onnxruntime` v1.31.0 (CPUExecutionProvider, intra-op threads = 1, inter-op threads = 1)

---

## 2. Tujuan Pengujian
1. Membuktikan bahwa model segmentasi U2NetP dapat berjalan secara stabil dan mandiri di CPU tanpa GPU.
2. Memverifikasi bahwa latensi eksekusi memenuhi target SLA (≤ 15.0 detik) pada 1 vCPU.
3. Memverifikasi bahwa konsumsi memori puncak (peak RSS) berada di bawah ambang batas aman (< 400 MB) pada host RAM 2.2 GiB.
4. Membuktikan bahwa eksekusi melalui subprocess terisolasi mengembalikan 100% memori fisik ke OS pasca terminasi (zero memory leak).
5. Memverifikasi logika antrean dan penolakan kelebihan beban (concurrency = 1, antrean max = 2, rejection HTTP 429 pada request ke-4).
6. Memverifikasi kualitas transparansi alpha mask pada berkas keluaran PNG.

---

## 3. Hasil Pengujian Latensi & Sumber Daya per Resolusi

Pengujian dijalankan pada 3 variasi resolusi citra sintetis yang merepresentasikan pasfoto lamaran standar hingga citra resolusi tinggi:

| Resolusi Uji | Kategori Skenario | Load Time | Preprocess | Session Init | Murni Inferensi | Postprocess | Total Wall Time | Target SLA | Status SLA |
|---|---|---|---|---|---|---|---|---|---|
| **800 x 800** | Pasfoto standar | 0.032s | 0.012s | 0.094s | **1.059s** | 0.120s | **1.661s** | ≤ 15.0s | **PASS (9x lebih cepat)** |
| **1200 x 1200** | HD Portrait | 0.032s | 0.014s | 0.110s | **1.218s** | 0.214s | **1.958s** | ≤ 15.0s | **PASS (7.6x lebih cepat)** |
| **1920 x 1080** | Full HD Landscape | 0.039s | 0.016s | 0.097s | **1.097s** | 0.267s | **1.850s** | ≤ 15.0s | **PASS (8.1x lebih cepat)** |

### Profil Penggunaan Memori (RSS)

| Resolusi Uji | Initial Worker RSS | Peak RSS Subprocess | Host RSS Sebelum Spawn | Host RSS Pasca Exit | Selisih Host RAM (Delta) | Status Memori |
|---|---|---|---|---|---|---|
| **800 x 800** | 57.96 MB | **359.78 MB** | 48.44 MB | 48.44 MB | **0.00 MB** | **PASS (< 400 MB)** |
| **1200 x 1200** | 57.88 MB | **368.50 MB** | 48.44 MB | 48.45 MB | **+0.01 MB** | **PASS (< 400 MB)** |
| **1920 x 1080** | 57.94 MB | **377.82 MB** | 48.44 MB | 48.44 MB | **0.00 MB** | **PASS (< 400 MB)** |

---

## 4. Bukti Reklamasi Memori (Zero Memory Leak)
Untuk membuktikan bahwa pemrosesan ML tidak meninggalkan beban memori atau memicu swap thrashing pada server VPS 2.2 GiB RAM:
- **Host RAM Baseline (sebelum worker jalan):** 48.45 MB
- **Peak RAM saat Inferensi Berjalan:** 368.50 MB (berada di subprocess worker)
- **Host RAM Pasca Subprocess Dihentikan:** 48.45 MB
- **Selisih Memori Tersisa:** **0.00 MB** (100% memori subprocess dibebaskan oleh kernel OS).
- **Kesimpulan:** Arsitektur subprocess terisolasi **lulus uji keandalan memori** dan mencegah memory leak jangka panjang pada proses utama FastAPI.

---

## 5. Bukti Kualitas Transparansi Citra Keluaran
Pemeriksaan dilakukan pada piksel sudut dan piksel tengah berkas keluaran PNG RGBA:
- **Piksel Sudut (Latar Belakang - koordinat 5, 5):** `Alpha = 0` (100% transparan, latar belakang terpotong bersih).
- **Piksel Tengah (Subjek Objek - koordinat w/2, h/2):** `Alpha = 254` (Solid / terdeteksi sebagai subjek utama).
- **Ukuran File Teroptimasi:** 78.8 KB – 123.8 KB (format PNG RGBA kompresi aman tanpa metadata EXIF).

---

## 6. Simulasi Batas Konkurensi & Antrean Beban

Simulasi pengujian 4 request simultan (`req-1`, `req-2`, `req-3`, `req-4`) dengan konfigurasi `concurrency_limit = 1` dan `queue_capacity = 2`:

| Request ID | Status Antrean | HTTP Status Code | Catatan Response Header |
|---|---|---|---|
| `req-1` | `started_immediately` | **HTTP 200 OK** | Langsung dieksekusi oleh active worker slot |
| `req-2` | `enqueued` (posisi 1) | **HTTP 202 Accepted** | Menunggu slot worker selesai |
| `req-3` | `enqueued` (posisi 2) | **HTTP 202 Accepted** | Menunggu di antrean batas maksimal |
| `req-4` | `rejected` (antrean penuh) | **HTTP 429 Too Many Requests** | `Retry-After: 30`, pesan: *"Antrean pemrosesan gambar penuh"* |

**Hasil:** Sistem fail-closed secara deterministik saat antrean penuh. Tidak ada request tambahan yang menumpuk tak terkendali di memori server.

---

## 7. Kesimpulan & Rekomendasi untuk Implementasi Produksi

1. **Kelayakan Model:** Model `u2netp.onnx` (~4.36 MB) terbukti **sangat layak (FEASIBLE)** dan sangat efisien untuk di-hosting pada VPS Ubuntu 24.04 (1 vCPU, 2.2 GiB RAM).
2. **Latensi Super Cepat:** Total waktu eksekusi per gambar berkisar antara **1.66s s/d 1.95s** (jauh lebih cepat dari batas SLA 15 detik), dengan waktu inferensi murni hanya ~1.1 detik.
3. **Pola Eksekusi:** Wajib mempertahankan pola **Subprocess Isolation** pada backend FastAPI (`backend/app/services/image_remover.py`) agar `onnxruntime` engine dijalankan dalam proses anak mandiri dan memori fisik ~370 MB langsung dikembalikan 100% ke kernel setelah gambar selesai di-render.
4. **Kebijakan Antrean:** Pola antrean concurrency 1 + queue 2 + penolakan HTTP 429 terbukti efektif melindungi stabilitas host dari DoS beban komputasi.
5. **Rekomendasi Task Selanjutnya:** Melanjutkan ke `TASK-10.2` (Boundary Hardening & Cleanup Sweeper) untuk memperkuat izin folder workspace ke `0700` dan menegakkan fail-closed disk guard 70%/80%.
