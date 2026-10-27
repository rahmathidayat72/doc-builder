# Architecture Document

## 1. Metadata dan Revision History
- **Proyek:** Doc-builder
- **Versi Arsitektur:** 1.1.0
- **Tanggal Persetujuan:** 2026-10-20
- **Revisi Terakhir:** 2026-10-24 — sinkronisasi stack aktual, engine PDF pascarilis, kebijakan cookie `SameSite=Lax`, model data CV terstruktur, alur preflight ekspor/import/target draft, dan pencatatan gap observability.
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
|  | - React 19 + TS        | ----------> | - FastAPI Server (uvicorn)|  |
|  | - Vite, Tailwind CSS   |  (Loopback  | - Dynamic Port + Session  |  |
|  | - Zod validation       |   Auth)     | - REST API & OpenAPI Spec |  |
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

### 3.1 Frontend (Presentation & Draft Storage) — ARCH-01
- **Teknologi:** React 19, TypeScript, Vite, Tailwind CSS, Lucide icons.
- **State Management & Form:** State React lokal dan validasi skema Zod; tidak memakai React Hook Form atau Radix UI pada implementasi saat ini.
- **Penyimpanan Lokal:** IndexedDB (melalui wrapper `idb`) untuk autosave draft CV, preferensi, dan template state.
- **Model Draft:** `ResumeDraft` menyimpan data CV, `favorite`, dan `targetJob` opsional. `ResumeData` mendukung `headline`, `achievements[]`, dan `sectionOrder[]` opsional; draft lama tetap kompatibel melalui fallback `description` dan normalisasi urutan bagian.
- **Pagination Preview:** `ResumePreview` mengestimasi tinggi konten A4 dan menampilkan jumlah halaman serta overlay batas halaman. Template full-bleed memakai tinggi A4 penuh; template reguler mengurangi padding kertas.
- **Preflight Ekspor:** `resumeQuality` memisahkan error/warning; `ExportResumeModal` memblokir error, mewajibkan acknowledgment warning, dan meneruskan nama berkas yang sudah disanitasi ke service ekspor.
- **Responsivitas:** Layout responsif untuk desktop dan layar sentuh, optimasi visual desktop untuk preview side-by-side.

### 3.2 Backend Service (Local Orchestrator) — ARCH-02
- **Teknologi:** Python 3.11+, FastAPI, Uvicorn, pip/venv (virtual environment proyek). `uv` tidak digunakan sebagai package manager utama saat ini.
- **Protokol:** REST API dengan kontrak formal berbasis OpenAPI/Swagger.
- **Bind Network:** Terkunci keras hanya pada `127.0.0.1` (loopback). Dilarang mengikat ke `0.0.0.0`.
- **Port:** Port default `8000` dari launcher; belum ada alokasi port dinamis saat runtime.
- **Autentikasi Sesi:** Token bootstrap acak yang disimpan sebagai Cookie `HttpOnly` dengan `SameSite=Lax` pada loopback HTTP. Validasi header CSRF token pada setiap mutasi POST/PUT/DELETE. Lihat `DEC-013`.

### 3.3 Conversion & Processing Engine (Isolated Workers) — ARCH-03
- **Worker Management:** Subprocess terpisah per job dengan maksimal satu job aktif, untuk mencegah crash pada web server saat memproses file korup.
- **DOCX ke PDF:** Eksekusi LibreOffice headless via subprocess dengan parameter `--headless --convert-to pdf`.
- **PDF ke DOCX:** `pdf2docx` terisolasi sesuai `DEC-004`, dengan mode best-effort.
- **PDF & Image Tools:** PyMuPDF (`fitz`) untuk Protect/Unlock, Repair, OCR orchestration, Watermark, Page Numbers, dan ekstraksi Markdown; `pypdf` tersedia untuk operasi tertentu; Pillow untuk image conversion dan EXIF sanitization. Lihat `DEC-012`.
- **ATS & NLP Engine:** Aturan deterministik berbasis regex dan NLP bilingual ringan (ekstraksi kata kunci, frekuensi, segmentasi kalimat) tanpa external cloud call.

## 4. Keamanan dan Isolasi (Security by Design)
- **Network Isolation:** **Belum memadai.** Implementasi saat ini hanya menyetel `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` ke port tertutup dan menyanitasi environment; tidak ada network namespace, firewall, atau egress block OS-level. Windows memakai Job Object untuk batas proses/memori, bukan network. Gap ini dicatat sebagai `RISK-SEC-003`.
- **Resource Limiting:** Timeout 5 menit per pekerjaan; Windows Job Object membatasi memori default 500 MB; Linux belum memiliki memory cap (cgroup/rlimit). Batas disk temporer 500 MB.
- **Sanitasi File:** Validasi magic bytes sebelum berkas diproses; penolakan makro aktif (.docm/.xlsm); penolakan berkas terenkripsi pada jalur yang tidak meminta password; fail-closed untuk dokumen bertanda tangan digital pada operasi yang dapat merusaknya; pembersihan metadata gambar.
- **Pembersihan Berkas Temporer:** Pola try-finally membersihkan workspace setelah job selesai, ditambah startup sweep untuk workspace kedaluwarsa (TTL 5 menit). Periodic daemon sweeper belum diimplementasikan; lihat `RISK-SEC-002`.
- **Audit Trail:** `backend/app/core/audit.py` menulis event JSONL append-only ke `backend/logs/` dengan permission `0600`/direktori `0700`, rotasi harian UTC, dan retensi 7 hari. `SecurityMiddleware` mencatat denial Origin/session/CSRF, error API, dan request `/api/*` yang diizinkan tanpa body, header, cookie, query string, atau PII. Kegagalan tulis bersifat fail-open.

## 5. Alur Data (Data Flow)

### 5.1 Alur CV Builder
```text
Pengguna Mengisi Form -> Validasi Zod -> Update Live Preview (In-Memory)
                      -> Estimasi Tinggi A4 -> Badge Jumlah Halaman + Overlay Page Break
                      -> Debounced Autosave (IndexedDB)
                      -> Klik Unduh PDF/DOCX -> Preflight Kualitas
                      -> Error: blokir + navigasi Perbaiki | Warning: acknowledgment
                      -> Sanitasi Nama Berkas (frontend) -> Request ke Backend
                      -> Sanitasi Nama Berkas (backend) -> Generator Worker Merender Berkas
                      -> Stream Download ke Browser -> Hapus Berkas Temp
```

### 5.2 Alur Konversi Dokumen
```text
Upload File -> Validasi Magic Bytes & Ukuran -> Simpan ke Temp Workspace Unik
            -> Spawn Worker Subprocess (proxy env; egress block OS-level belum ada — RISK-SEC-003)
            -> Proses Konversi dengan Timeout 5 Menit
            -> Hasil Tersedia -> Notifikasi Progress Selesai
            -> Pengguna Mengunduh Output -> Auto-delete Temp Workspace
```

### 5.3 Alur Impor Selektif, CV Target, dan Manajemen Draft
```text
Impor PDF/DOCX -> Parsing + Confidence -> Pilih Bagian -> Mode merge/replace
               -> Snapshot bagian terpilih -> Terapkan ke Editor -> Undo 30 detik (restore snapshot)

Job Matching -> Pilih Lowongan -> Buat CV Target
             -> Salin Draft Sumber + targetJob + Urutkan Skill Cocok
             -> Draft Asli Tidak Berubah

Daftar Draft -> Cari / Favorit / Rename / Duplikasi / Hapus + Undo
             -> Favorit diurutkan lebih dahulu, lalu updatedAt
             -> Flush Autosave Sebelum Berpindah/Menduplikasi Draft
```

## 6. Error Handling & Observability
- **Error Response Envelope:** Respons error menggunakan `{ success: false, error: { ... } }` tanpa membocorkan stack trace internal ke client.
- **Logging:** Audit trail JSONL lokal tersedia di `backend/app/core/audit.py`: append-only, permission `0600`/`0700`, rotasi harian UTC, retensi 7 hari, dan field yang tidak memuat body/header/query/PII. `SecurityMiddleware` mencatat denial keamanan, error API, dan request `/api/*` yang diizinkan. Batas: log belum tamper-evident terhadap pengguna OS yang sama dan belum memiliki batas ukuran harian; `RISK-SEC-001` menunggu approval penutupan owner.
- **Health Check Endpoint:** `GET /api/health` mengembalikan status kesiapan server lokal dan deteksi ketersediaan LibreOffice.

## 7. Known Documentation & Security Gaps (2026-10-24)
- `RISK-SEC-001`: audit trail JSONL lokal sudah diimplementasikan dan diuji; status mitigasi menunggu approval penutupan owner.
- `RISK-SEC-002`: workspace job manager memakai permission default `0775`, belum eksplisit `0700`; periodic sweeper belum tersedia.
- `RISK-SEC-003`: sandbox belum memiliki egress block OS-level; Linux belum memiliki memory cap. Klaim “isolasi jaringan penuh” dikoreksi.
- `Q-001`: metrik fidelitas visual formal belum ditetapkan; benchmark 100% adalah field/teks, bukan SSIM/pixel diff.
- `Q-005`: cross-browser E2E Playwright belum tersedia; klaim “4 Browser matrix PASS” tidak didukung bukti.
- `Q-006`: `docs/conversations.json` berisi transkrip percakapan dan memerlukan keputusan kebijakan repository.
- Detail risk treatment ada di `docs/project/SECURITY.md` dan `.agent/OPEN-QUESTIONS.md`.
