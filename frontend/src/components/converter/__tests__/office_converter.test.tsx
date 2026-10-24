import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PresentationConverterModal } from '../PresentationConverterModal'
import { SpreadsheetConverterModal } from '../SpreadsheetConverterModal'
import * as converterService from '../../../services/converter'

vi.mock('../../../services/converter', () => ({
  convertPresentationToPdf: vi.fn(),
  convertPdfToPptx: vi.fn(),
  convertSpreadsheetToPdf: vi.fn(),
  convertPdfToXlsx: vi.fn(),
}))

describe('Office Converter Modals Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PresentationConverterModal', () => {
    it('tidak me-render apapun saat isOpen bernilai false', () => {
      const { container } = render(
        <PresentationConverterModal isOpen={false} onClose={vi.fn()} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('merender judul, tab PowerPoint ke PDF, dan dropzone saat terbuka', () => {
      render(<PresentationConverterModal isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('PowerPoint & PDF')).toBeInTheDocument()
      expect(screen.getByTestId('tab-pptx2pdf')).toBeInTheDocument()
      expect(screen.getByTestId('tab-pdf2pptx')).toBeInTheDocument()
      expect(screen.getByTestId('dropzone-presentation')).toBeInTheDocument()
      expect(screen.getByTestId('btn-start-presentation-convert')).toBeDisabled()
    })

    it('menolak berkas non-PPT/PPTX pada tab pptx2pdf', () => {
      render(<PresentationConverterModal isOpen={true} onClose={vi.fn()} />)

      const input = screen.getByTestId('input-file-presentation')
      const badFile = new File(['dummy'], 'catatan.txt', { type: 'text/plain' })
      fireEvent.change(input, { target: { files: [badFile] } })

      expect(
        screen.getByText(/Hanya berkas presentasi \(\.pptx \/ \.ppt\) yang didukung/i)
      ).toBeInTheDocument()
    })

    it('menerima berkas .pptx valid dan menjalankan konversi ke PDF', async () => {
      vi.mocked(converterService.convertPresentationToPdf).mockResolvedValueOnce({
        success: true,
        filename: 'slide_presentasi.pdf'
      })

      render(<PresentationConverterModal isOpen={true} onClose={vi.fn()} />)

      const input = screen.getByTestId('input-file-presentation')
      const pptxFile = new File(['PK\x03\x04 dummy'], 'slide_presentasi.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      })
      fireEvent.change(input, { target: { files: [pptxFile] } })

      expect(screen.getByText('slide_presentasi.pptx')).toBeInTheDocument()
      const btnConvert = screen.getByTestId('btn-start-presentation-convert')
      expect(btnConvert).not.toBeDisabled()

      fireEvent.click(btnConvert)

      await waitFor(() => {
        expect(converterService.convertPresentationToPdf).toHaveBeenCalledWith(pptxFile)
        expect(screen.getByText(/Konversi Berhasil!/i)).toBeInTheDocument()
      })
    })

    it('berpindah ke tab PDF ke PowerPoint dan mengonversi berkas PDF', async () => {
      vi.mocked(converterService.convertPdfToPptx).mockResolvedValueOnce({
        success: true,
        filename: 'dokumen.pptx'
      })

      render(
        <PresentationConverterModal
          isOpen={true}
          onClose={vi.fn()}
          initialTab="pdf2pptx"
        />
      )

      expect(
        screen.getByText(/Hasil PDF ke PPTX merupakan slide visual presisi tinggi/i)
      ).toBeInTheDocument()

      const input = screen.getByTestId('input-file-presentation')
      const pdfFile = new File(['%PDF-1.4 dummy'], 'dokumen.pdf', {
        type: 'application/pdf'
      })
      fireEvent.change(input, { target: { files: [pdfFile] } })

      const btnConvert = screen.getByTestId('btn-start-presentation-convert')
      fireEvent.click(btnConvert)

      await waitFor(() => {
        expect(converterService.convertPdfToPptx).toHaveBeenCalledWith(pdfFile)
        expect(screen.getByText(/Konversi Berhasil!/i)).toBeInTheDocument()
      })
    })

    it('menutup modal memicu callback onClose', () => {
      const mockClose = vi.fn()
      render(<PresentationConverterModal isOpen={true} onClose={mockClose} />)

      const btnClose = screen.getByTestId('btn-close-presentation-modal')
      fireEvent.click(btnClose)
      expect(mockClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('SpreadsheetConverterModal', () => {
    it('tidak me-render apapun saat isOpen bernilai false', () => {
      const { container } = render(
        <SpreadsheetConverterModal isOpen={false} onClose={vi.fn()} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('merender judul, tab Excel ke PDF, dan dropzone saat terbuka', () => {
      render(<SpreadsheetConverterModal isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Excel & PDF')).toBeInTheDocument()
      expect(screen.getByTestId('tab-xlsx2pdf')).toBeInTheDocument()
      expect(screen.getByTestId('tab-pdf2xlsx')).toBeInTheDocument()
      expect(screen.getByTestId('dropzone-spreadsheet')).toBeInTheDocument()
    })

    it('menolak berkas non-XLS/XLSX pada tab xlsx2pdf', () => {
      render(<SpreadsheetConverterModal isOpen={true} onClose={vi.fn()} />)

      const input = screen.getByTestId('input-file-spreadsheet')
      const badFile = new File(['dummy'], 'data.docx', { type: 'application/docx' })
      fireEvent.change(input, { target: { files: [badFile] } })

      expect(
        screen.getByText(/Hanya berkas lembar kerja Excel \(\.xlsx \/ \.xls\) yang didukung/i)
      ).toBeInTheDocument()
    })

    it('menerima berkas .xlsx valid dan mengonversi ke PDF', async () => {
      vi.mocked(converterService.convertSpreadsheetToPdf).mockResolvedValueOnce({
        success: true,
        filename: 'keuangan.pdf'
      })

      render(<SpreadsheetConverterModal isOpen={true} onClose={vi.fn()} />)

      const input = screen.getByTestId('input-file-spreadsheet')
      const xlsxFile = new File(['PK\x03\x04 dummy'], 'keuangan.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      fireEvent.change(input, { target: { files: [xlsxFile] } })

      const btnConvert = screen.getByTestId('btn-start-spreadsheet-convert')
      fireEvent.click(btnConvert)

      await waitFor(() => {
        expect(converterService.convertSpreadsheetToPdf).toHaveBeenCalledWith(xlsxFile)
        expect(screen.getByText(/Konversi Berhasil!/i)).toBeInTheDocument()
      })
    })

    it('berpindah ke tab PDF ke Excel dan mengekstrak tabel PDF ke XLSX', async () => {
      vi.mocked(converterService.convertPdfToXlsx).mockResolvedValueOnce({
        success: true,
        filename: 'laporan_tabel.xlsx'
      })

      render(
        <SpreadsheetConverterModal
          isOpen={true}
          onClose={vi.fn()}
          initialTab="pdf2xlsx"
        />
      )

      expect(
        screen.getByText(/Hanya tabel terstruktur berbasis teks yang dapat diekstrak ke Excel/i)
      ).toBeInTheDocument()

      const input = screen.getByTestId('input-file-spreadsheet')
      const pdfFile = new File(['%PDF-1.4 dummy'], 'laporan_tabel.pdf', {
        type: 'application/pdf'
      })
      fireEvent.change(input, { target: { files: [pdfFile] } })

      const btnConvert = screen.getByTestId('btn-start-spreadsheet-convert')
      fireEvent.click(btnConvert)

      await waitFor(() => {
        expect(converterService.convertPdfToXlsx).toHaveBeenCalledWith(pdfFile)
        expect(screen.getByText(/Konversi Berhasil!/i)).toBeInTheDocument()
      })
    })

    it('menutup modal memicu callback onClose', () => {
      const mockClose = vi.fn()
      render(<SpreadsheetConverterModal isOpen={true} onClose={mockClose} />)

      const btnClose = screen.getByTestId('btn-close-spreadsheet-modal')
      fireEvent.click(btnClose)
      expect(mockClose).toHaveBeenCalledTimes(1)
    })
  })
})
