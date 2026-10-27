# Standard Operating Procedure (SOP) — Doc-builder

## 1. Prosedur Awal Setiap Sesi
1. Baca `AGENTS.md` dan `docs/project/SOP.md`.
2. Baca `.agent/PROJECT-STATE.md`, pastikan status proyek, security tier, dan fase aktif.
3. Baca `.agent/TASKS.md` untuk mengidentifikasi task yang siap dikerjakan.
4. Baca entri terakhir di `.agent/REPORT.md`.
5. Periksa status repository dan integritas workspace secara read-only.
6. Konfirmasi task aktif sebelum melakukan perubahan.

## 2. Prosedur Sebelum Eksekusi Task (Gerbang 3)
1. Periksa Definition of Ready (DoR) task terkait di `docs/project/phases/` jika tersedia. Untuk task pascarilis yang belum memiliki file phase, gunakan `.agent/TASKS.md` dan entri `.agent/REPORT.md` sebagai sumber konteks.
2. Susun Task Scope dan Code Execution Plan terperinci (file terdampak, fungsi/symbol, edge cases, perintah uji, rencana rollback).
3. Ajukan permohonan persetujuan Gerbang 3 kepada pengguna.
4. Dilarang menulis, mengubah, atau mengeksekusi kode sebelum Gerbang 3 disetujui.

## 3. Aturan Coding dan Arsitektur
- **Type Safety:** TypeScript menggunakan konfigurasi proyek saat ini; opsi `strict` belum diaktifkan. Python memakai `mypy` dengan `strict = false` di `backend/pyproject.toml`. Jangan mengklaim mode strict sampai konfigurasi dan verifikasinya benar-benar tersedia.
- **Input Validation:** Semua input eksternal (termasuk upload berkas dan payload form) wajib divalidasi pada trust boundary menggunakan Zod (frontend) dan Pydantic (backend).
- **Error Handling:** Jangan pernah menelan exception secara diam-diam. Seluruh kegagalan harus menghasilkan pesan yang informatif namun aman bagi pengguna.
- **No Secret/PII in Logs:** Dilarang mencatat nama file dokumen pengguna, isi teks CV, atau informasi identitas pribadi ke dalam log. Gunakan ID acak/UUID.
- **Fail-Closed Sandbox:** Subprocess konversi harus dieksekusi dengan timeout, sanitasi environment, dan pembersihan direktori temporer terjamin. Egress block OS-level **belum tersedia** (hanya proxy env); lihat `RISK-SEC-003`. Jangan mengklaim isolasi jaringan penuh sampai kontrol tersebut diimplementasikan dan diuji.
- **Preflight Ekspor CV:** Error kualitas wajib memblokir ekspor; warning hanya boleh dilewati setelah acknowledgment eksplisit. Nama berkas harus disanitasi di frontend dan backend serta tidak boleh dipakai mentah pada `Content-Disposition`.
- **Kompatibilitas Data CV:** `headline`, `achievements`, `sectionOrder`, `favorite`, dan `targetJob` adalah field opsional. Renderer/eksportir wajib memakai helper fallback bersama; draft lama tidak boleh dimigrasi secara destruktif.
- **Manajemen Draft:** Autosave tertunda harus di-flush sebelum berpindah, menduplikasi, atau membuat draft target. Inisialisasi aplikasi tidak boleh membuat draft baru sebelum daftar draft selesai dimuat.

## 4. Prosedur Pengujian dan Quality Gates
Setelah kode selesai dimodifikasi, gunakan command aktual berikut (Linux/macOS; Windows memakai `backend\.venv\Scripts\...`):
1. Frontend lint: `npm --prefix frontend run lint` (Oxlint).
2. Frontend typecheck/build: `npm --prefix frontend run build` (`tsc -b && vite build`).
3. Frontend unit test: `npm --prefix frontend test` (Vitest).
4. Backend lint: `backend/.venv/bin/ruff check backend/app backend/tests`.
5. Backend typecheck opsional: `backend/.venv/bin/mypy backend/app` (konfigurasi `strict=false`).
6. Backend test: `backend/.venv/bin/pytest backend/tests`.
7. Secret scan jika relevan: `backend/.venv/bin/python scripts/scan_secrets.py`.
8. Verifikasi seluruh acceptance criteria task terkait.

**Catatan:** Biome, Bandit, Semgrep, Playwright, dan `uv sync` tidak tersedia di repository saat ini. E2E multi-browser belum diimplementasikan (`Q-005`). Jangan menulis command yang tidak dapat dijalankan.

## 5. Prosedur Setelah Task Selesai
1. Bandingkan hasil aktual dengan Code Execution Plan yang disetujui.
2. Catat seluruh file yang dibuat/diubah dan perintah verifikasi aktual di `.agent/REPORT.md`.
3. Perbarui status task di `.agent/TASKS.md` menjadi `✅ Selesai dan terverifikasi`.
4. Perbarui status proyek di `.agent/PROJECT-STATE.md`.
5. Sinkronkan dokumen pelacakan `docs/project/TRACEABILITY.md`.
6. Berhenti dan tunggu instruksi pengguna untuk task berikutnya.

## 6. Definition of Ready (DoR) & Definition of Done (DoD)
- **DoR:** Requirement terdefinisi, acceptance criteria jelas, rencana file/simbol terdampak siap, security impact dinilai, code plan disetujui pengguna.
- **DoD:** Kode sesuai plan, linter/typecheck/test PASS, target coverage ≥80% pada modul baru diukur dan dilaporkan jika relevan, tidak ada secret bocor, dokumen dan status tracking diperbarui, serta setiap klaim tooling/verifikasi memiliki bukti command dan hasil aktual.
