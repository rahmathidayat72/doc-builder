# Change Requests

Daftar perubahan ruang lingkup (scope change) setelah baseline disetujui.

| ID | Tanggal | Peminta | Deskripsi Perubahan | Dampak Scope / Arsitektur | Status |
|---|---|---|---|---|---|
| CR-007 | 2026-10-22 | User | Fitur Unlock PDF dan Protect PDF Berbasis AES-256 Lokal pada Workspace Alat Dokumen | Backend PyMuPDF AES-256 (`protect_pdf`, `unlock_pdf`), API endpoint `/protect` dan `/unlock`, frontend modal `PdfSecurityModal.tsx`, 2 kartu mandiri di workspace tools | Approved & Completed |
| CR-008 | 2026-10-22 | User | Fitur Repair PDF dan OCR PDF Lokal pada Workspace Alat Dokumen | Backend PyMuPDF (`repair_pdf`, `ocr_pdf`, `get_tesseract_status`), API endpoint `/repair`, `/ocr/status`, `/ocr`, frontend modal `PdfRepairModal.tsx` & `PdfOcrModal.tsx`, 2 kartu mandiri di workspace tools | Approved & Completed |
| CR-009 | 2026-10-22 | User | Fitur Watermark PDF dan Nomor Halaman PDF Lokal pada Workspace Alat Dokumen | Backend PyMuPDF (`watermark_pdf`, `add_page_numbers_pdf`), API endpoint `/watermark`, `/page-numbers`, frontend modal `PdfWatermarkModal.tsx` & `PdfPageNumbersModal.tsx`, 2 kartu mandiri di workspace tools | Approved & Completed |
| CR-010 | 2026-10-22 | User | Fitur PDF to Markdown Lokal Bergaya iLovePDF pada Workspace Alat Dokumen | Backend PyMuPDF (`pdf_to_markdown` via `pymupdf4llm`), API endpoint `/pdf-to-markdown`, client service `pdfToMarkdown`, frontend modal `PdfToMarkdownModal.tsx`, kartu alat mandiri ber-badge `New!` | Approved & Completed |
| CR-011 | 2026-10-24 | User | Tambah maksimal tiga alamat website/portofolio pada CV Builder; LinkedIn tetap terpisah | `ContactInfo.websites`, fallback `website`, ContactForm dinamis, 4 template, ekspor DOCX/PDF, parser compatibility | Approved & Completed |
| CR-012 | 2026-10-24 | User | Peningkatan kualitas CV pascarilis: pagination/preflight ekspor, headline, pencapaian terstruktur, reorder, CV target, impor selektif + undo, dan manajemen draft | `ResumeData.headline/achievements/sectionOrder`, `ResumeDraft.favorite/targetJob`, `resumeQuality`, `importMerge`, `ExportResumeModal`, `ResumePreview`, Navbar/App, parser & DOCX generator | Approved & Completed |
| CR-013 | 2026-10-24 | User | Perbaikan tata letak, kenyamanan UI/UX, pengelompokan/pencarian alat dokumen, serta animasi halus (`prefers-reduced-motion` aware) | Shell `h-dvh` scroll independen, navigasi langkah footer editor + progress bar, hook `useDismiss` untuk popover & modal Draft, kategorisasi + pencarian 18 alat dokumen, utilitas animasi CSS global, guard unmount `PdfOcrModal` | Approved & Completed |
