# Architecture Document

## 1. Metadata dan Revision History
- **Proyek:** Doc-builder
- **Versi Arsitektur:** 1.0.0
- **Tanggal Persetujuan:** 2026-10-20
- **Status:** Approved (Gerbang 2)

## 2. Gambaran Umum Sistem & Topologi

Doc-builder menggunakan arsitektur **Hybrid Client-Server Lokal** yang berjalan sepenuhnya pada mesin pengguna (`localhost`):

```text
+------------------------------------------------------------------------+
| Mesin Pengguna (Localhost Environment)                                 |
|                                                                        |
|  +------------------------+             +---------------------------+  |
|  | Web Browser (Frontend) |             | Local Backend (FastAPI)   |  |
|  |                        |  HTTP/REST  |                           |  |
|  | - React 18+ (TS)       | ----------> | - FastAPI Server (uvicorn)|  |
|  | - Vite, Tailwind CSS   |  (Loopback  | - Dynamic Port + Session  |  |
|  | - Radix UI Primitives  |   Auth)     | - REST API & OpenAPI Spec |  |
|  | - React Hook Form + Zod|             |                           |  |
|  | - IndexedDB (Drafts)   |             +-------------+-------------+  |
|  +------------------------+                           |                |
|                                                       | Process Pool   |
|                                                       v                |
|                                         +---------------------------+  |
|                                         | Isolated Worker Sandbox   |  |
|                                         |                           |  |
|                                         | - LibreOffice Headless    |  |
|                                         | - PDF->DOCX Engine        |  |
|                                         | - PyPDF / Pillow / NLP    |  |
|                                         | - No-Network & ResourceCap|  |
|                                         +-------------+-------------+  |
|                                                       |                |
|                                                       v                |
|                                         +---------------------------+  |
|                                         | Local Temp Workspace      |  |
|                                         | (Max 500 MB, TTL 5 Menit) |  |
|                                         +---------------------------+  |
+------------------------------------------------------------------------+
```

## 3. Komponen Arsitektur Utama

### 3.1 Frontend (Presentation & Draft Storage)
- **Teknologi:** React, TypeScript, Vite, Tailwind CSS, Radix UI.
- **State Management & Form:** React Hook Form terintegrasi dengan validasi skema Zod.
- **Penyimpanan Lokal:** IndexedDB (melalui wrapper idb) untuk autosave draft CV, preferensi, dan template state.
- **Responsivitas:** Layout responsif untuk desktop dan layar sentuh, optimasi visual desktop untuk preview side-by-side.

### 3.2 Backend Service (Local Orchestrator)
- **Teknologi:** Python 3.11+, FastAPI, Uvicorn, uv (package & dependency manager).
- **Protokol:** REST API dengan kontrak formal berbasis OpenAPI/Swagger.
- **Bind Network:** Terkunci keras hanya pada `127.0.0.1` (loopback). Dilarang mengikat ke `0.0.0.0`.
- **Port:** Port dinamis yang dialokasikan saat runtime atau fallback ke port default yang tersedia.
- **Autentikasi Sesi:** Token bootstrap acak yang disimpan sebagai Cookie `HttpOnly` dengan `SameSite=Strict`. Validasi header CSRF token pada setiap mutasi POST/PUT/DELETE.

### 3.3 Conversion & Processing Engine (Isolated Workers)
- **Worker Management:** Process pool terpisah dari proses web server untuk mencegah crash pada web server saat memproses file korup.
- **DOCX ke PDF:** Eksekusi LibreOffice headless via subprocess dengan parameter `--headless --convert-to pdf`.
- **PDF ke DOCX:** Engine terisolasi berbasis evaluasi Phase 1 (kandidat: pdf2docx / PyMuPDF wrapper) dengan mode best-effort.
- **PDF & Image Tools:** PyPDF/pypdfium2 untuk merge & split; Pillow (PIL Fork) untuk image conversion dan EXIF sanitization.
- **ATS & NLP Engine:** Aturan deterministik berbasis regex dan NLP bilingual ringan (ekstraksi kata kunci, frekuensi, segmentasi kalimat) tanpa external cloud call.

## 4. Keamanan dan Isolasi (Security by Design)
- **Network Isolation:** Subprocess konversi diputus dari akses jaringan luar (menggunakan adapter platform sandbox: Job Objects / Low-Integrity di Windows, unshare / seccomp / bubblewrap di Linux).
- **Resource Limiting:** Batas waktu eksekusi (timeout) 5 menit per pekerjaan; batas memori per worker (maks 1 GB); pembatasan disk temporer maks 500 MB.
- **Sanitasi File:** Validasi magic bytes sebelum berkas diproses; penolakan makro aktif (.docm/.xlsm); penolakan berkas terenkripsi; pembersihan metadata gambar.
- **Pembersihan Berkas Temporer:** Pola try-finally memastikan pembersihan direktori temporer segera setelah job selesai, ditambah daemon background sweeper (TTL 5 menit) dan startup cleanup.

## 5. Alur Data (Data Flow)

### 5.1 Alur CV Builder
```text
Pengguna Mengisi Form -> Validasi Zod -> Update Live Preview (In-Memory)
                      -> Debounced Autosave (IndexedDB)
                      -> Klik Unduh PDF/DOCX -> Request ke Backend
                      -> Generator Worker Merender Berkas
                      -> Stream Download ke Browser -> Hapus Berkas Temp
```

### 5.2 Alur Konversi Dokumen
```text
Upload File -> Validasi Magic Bytes & Ukuran -> Simpan ke Temp Workspace Unik
            -> Spawn Isolated Worker Subprocess (No Network)
            -> Proses Konversi dengan Timeout 5 Menit
            -> Hasil Tersedia -> Notifikasi Progress Selesai
            -> Pengguna Mengunduh Output -> Auto-delete Temp Workspace
```

## 6. Error Handling & Observability
- **Error Response Envelope:** Format terstruktur `{ success: false, error: { code: string, message: string, reference_id: string } }` tanpa membocorkan internal stack trace ke client.
- **Logging:** Structured logging format JSON yang telah disanitasi dari nama file asli, isi dokumen, dan PII. Retensi log lokal dibatasi 7 hari dengan rotasi otomatis.
- **Health Check Endpoint:** `GET /api/health` mengembalikan status kesiapan server lokal dan deteksi ketersediaan LibreOffice.
