# Standard Operating Procedure (SOP) — Doc-builder

## 1. Prosedur Awal Setiap Sesi
1. Baca `AGENTS.md` dan `docs/project/SOP.md`.
2. Baca `.agent/PROJECT-STATE.md`, pastikan status proyek, security tier, dan fase aktif.
3. Baca `.agent/TASKS.md` untuk mengidentifikasi task yang siap dikerjakan.
4. Baca entri terakhir di `.agent/REPORT.md`.
5. Periksa status repository dan integritas workspace secara read-only.
6. Konfirmasi task aktif sebelum melakukan perubahan.

## 2. Prosedur Sebelum Eksekusi Task (Gerbang 3)
1. Periksa Definition of Ready (DoR) task terkait di `docs/project/phases/`.
2. Susun Task Scope dan Code Execution Plan terperinci (file terdampak, fungsi/symbol, edge cases, perintah uji, rencana rollback).
3. Ajukan permohonan persetujuan Gerbang 3 kepada pengguna.
4. Dilarang menulis, mengubah, atau mengeksekusi kode sebelum Gerbang 3 disetujui.

## 3. Aturan Coding dan Arsitektur
- **Type Safety:** Seluruh kode TypeScript dan Python wajib memiliki deklarasi tipe yang ketat (`strict: true` di TS, `mypy` strict di Python).
- **Input Validation:** Semua input eksternal (termasuk upload berkas dan payload form) wajib divalidasi pada trust boundary menggunakan Zod (frontend) dan Pydantic (backend).
- **Error Handling:** Jangan pernah menelan exception secara diam-diam. Seluruh kegagalan harus menghasilkan pesan yang informatif namun aman bagi pengguna.
- **No Secret/PII in Logs:** Dilarang mencatat nama file dokumen pengguna, isi teks CV, atau informasi identitas pribadi ke dalam log. Gunakan ID acak/UUID.
- **Fail-Closed Sandbox:** Subprocess konversi harus dieksekusi dengan timeout, isolasi jaringan, dan pembersihan direktori temporer terjamin.

## 4. Prosedur Pengujian dan Quality Gates
Setelah kode selesai dimodifikasi:
1. Jalankan linter dan formatter (`npm run lint`, `uv run ruff check .`).
2. Jalankan typechecker (`npm run typecheck`, `uv run mypy .`).
3. Jalankan unit dan integration tests (`npm run test`, `uv run pytest`).
4. Verifikasi seluruh acceptance criteria task terkait.

## 5. Prosedur Setelah Task Selesai
1. Bandingkan hasil aktual dengan Code Execution Plan yang disetujui.
2. Catat seluruh file yang dibuat/diubah dan perintah verifikasi aktual di `.agent/REPORT.md`.
3. Perbarui status task di `.agent/TASKS.md` menjadi `✅ Selesai dan terverifikasi`.
4. Perbarui status proyek di `.agent/PROJECT-STATE.md`.
5. Sinkronkan dokumen pelacakan `docs/project/TRACEABILITY.md`.
6. Berhenti dan tunggu instruksi pengguna untuk task berikutnya.

## 6. Definition of Ready (DoR) & Definition of Done (DoD)
- **DoR:** Requirement terdefinisi, acceptance criteria jelas, rencana file/simbol terdampak siap, security impact dinilai, code plan disetujui pengguna.
- **DoD:** Kode sesuai plan, linter/typecheck/test PASS, coverage ≥80% pada modul baru, tidak ada secret bocor, dokumen dan status tracking diperbarui.
