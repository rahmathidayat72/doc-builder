# Change Requests

Daftar perubahan ruang lingkup (scope change) setelah baseline disetujui.

| ID | Tanggal | Peminta | Deskripsi Perubahan | Dampak Scope / Arsitektur | Status |
|---|---|---|---|---|---|
| CR-007 | 2026-10-22 | User | Fitur Unlock PDF dan Protect PDF Berbasis AES-256 Lokal pada Workspace Alat Dokumen | Backend PyMuPDF AES-256 (`protect_pdf`, `unlock_pdf`), API endpoint `/protect` dan `/unlock`, frontend modal `PdfSecurityModal.tsx`, 2 kartu mandiri di workspace tools | Approved & Completed |
| CR-008 | 2026-10-22 | User | Fitur Repair PDF dan OCR PDF Lokal pada Workspace Alat Dokumen | Backend PyMuPDF (`repair_pdf`, `ocr_pdf`, `get_tesseract_status`), API endpoint `/repair`, `/ocr/status`, `/ocr`, frontend modal `PdfRepairModal.tsx` & `PdfOcrModal.tsx`, 2 kartu mandiri di workspace tools | Approved & Completed |
| CR-009 | 2026-10-22 | User | Fitur Watermark PDF dan Nomor Halaman PDF Lokal pada Workspace Alat Dokumen | Backend PyMuPDF (`watermark_pdf`, `add_page_numbers_pdf`), API endpoint `/watermark`, `/page-numbers`, frontend modal `PdfWatermarkModal.tsx` & `PdfPageNumbersModal.tsx`, 2 kartu mandiri di workspace tools | Approved & Completed |
| CR-010 | 2026-10-22 | User | Fitur PDF to Markdown Lokal Bergaya iLovePDF pada Workspace Alat Dokumen | Backend PyMuPDF (`pdf_to_markdown` via `pymupdf4llm`), API endpoint `/pdf-to-markdown`, client service `pdfToMarkdown`, frontend modal `PdfToMarkdownModal.tsx`, kartu alat mandiri ber-badge `New!` | Approved & Completed |
