# Test Strategy (TEST-STRATEGY.md)

## 1. Pendekatan Berbasis Risiko
Doc-builder berfokus pada keandalan rekonstruksi format dokumen, keakuratan aturan ATS, dan integritas data privasi lokal pengguna. Pengujian dibagi ke dalam piramida uji:

```text
       [  UAT & Usability (10 Penguji)  ]
      [  E2E Multi-Browser (Playwright)  ]
     [  Integration & Corpus Fidelity Test ]
    [   Unit Tests (Vitest & Pytest) ≥80%   ]
```

## 2. Tingkatan Pengujian

### 2.1 Unit Testing
- **Frontend (Vitest + React Testing Library):**
  - Validasi schema form Zod (email, telepon, rentang tanggal).
  - State reducer form CV, penambahan/penghapusan section, reorder item.
  - Komponen UI: rendering preview, dialog konfirmasi, undo snackbar.
- **Backend (Pytest):**
  - Engine kalkulasi skor ATS deterministik.
  - Keyword extractor & job matcher.
  - Validasi magic bytes dan penolakan file terenkripsi/bermakro.
  - Target coverage: Minimal 80% pada core business logic.

### 2.2 Integration Testing & Corpus Fidelity
- **DOCX ke PDF Fidelity:**
  - Pengujian terhadap dataset corpus standar (10 dokumen kantor, 10 CV bervariasi, 5 korespondensi resmi).
  - Verifikasi kelengkapan teks, margin, header/footer, dan tabel.
  - Target: Kemiripan visual ≥ 95% pada corpus referensi.
- **PDF ke DOCX Conversion:**
  - Pengujian rekonstruksi teks dan blok paragraf yang dapat disunting kembali di Microsoft Word / LibreOffice.
- **Subprocess & Cleanup Integration:**
  - Uji pembatalan proses (cancel) dan pembuktian bahwa file temporer terhapus bersih.
  - Uji timeout 5 menit pada proses berbeban ekstrem.

### 2.3 End-to-End (E2E) Testing
- **Tool:** Playwright.
- **Matriks Browser:** Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari (WebKit).
- **Skenario Kritis:**
  1. Pengguna membuka dashboard -> Buat CV dari template -> Isi data -> Live preview -> Download PDF -> Verifikasi konten berkas terunduh.
  2. Pengguna mengimpor CV lama -> Tinjau ekstraksi form -> Ekspor DOCX.
  3. Pengguna mengunggah DOCX untuk dikonversi ke PDF -> Indikator progress berjalan -> Unduh hasil.
  4. Pengguna menyunting CV -> Refresh halaman -> Data pulih dari autosave IndexedDB.

### 2.4 Security Regression Testing
- Percobaan request API tanpa cookie session (harus HTTP 401).
- Percobaan request mutasi tanpa token CSRF (harus HTTP 403).
- Percobaan akses request dengan origin selain aplikasi lokal (harus ditolak).
- Unggah file zip bomb atau payload berkas tidak valid (harus ditolak aman tanpa crash server).

### 2.5 User Acceptance Testing (UAT)
- Dilakukan oleh 10 responden uji dengan latar belakang pencari kerja dan tim HR.
- Meliputi pengujian alur kerja penuh dari pembuatan hingga ekspor dan penilaian kegunaan (usability).

## 3. Automation & Quality Commands
```yaml
frontend:
  install: "npm install"
  format: "npx @biomejs/biome format --write src"
  lint: "npx @biomejs/biome check src"
  typecheck: "npx tsc --noEmit"
  test: "npx vitest run"
  e2e: "npx playwright test"
  build: "npx vite build"

backend:
  install: "uv sync"
  format: "uv run ruff format ."
  lint: "uv run ruff check ."
  typecheck: "uv run mypy ."
  test: "uv run pytest --cov=app --cov-report=term-missing"
  security_scan: "uv run bandit -r app && uv run pip-audit"
```
