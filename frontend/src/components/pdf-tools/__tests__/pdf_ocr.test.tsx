import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PdfOcrModal } from '../PdfOcrModal'
import * as pdfToolsService from '../../../services/pdfTools'

vi.mock('../../../services/pdfTools', () => ({
  getOcrStatus: vi.fn(),
  ocrPdf: vi.fn(),
}))

describe('PdfOcrModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tidak me-render apapun ketika isOpen=false', () => {
    const { container } = render(
      <PdfOcrModal isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('menampilkan panduan instalasi jika Tesseract tidak terdeteksi', async () => {
    vi.mocked(pdfToolsService.getOcrStatus).mockResolvedValueOnce({
      available: false,
      languages: [],
      message: 'No tessdata specified and Tesseract is not installed',
    })

    render(<PdfOcrModal isOpen={true} onClose={vi.fn()} />)

    expect(await screen.findByTestId('card-ocr-not-available')).toBeInTheDocument()
    expect(screen.getByText(/Engine Tesseract OCR Belum Terdeteksi/i)).toBeInTheDocument()
    expect(screen.getByText(/UB-Mannheim Tesseract/i)).toBeInTheDocument()
    expect(screen.getByText(/sudo apt install tesseract-ocr/i)).toBeInTheDocument()
  })

  it('dapat melakukan periksa ulang status OCR', async () => {
    vi.mocked(pdfToolsService.getOcrStatus)
      .mockResolvedValueOnce({
        available: false,
        languages: [],
        message: 'Belum terpasang',
      })
      .mockResolvedValueOnce({
        available: true,
        languages: ['eng', 'ind'],
        message: 'Siap',
      })

    render(<PdfOcrModal isOpen={true} onClose={vi.fn()} />)

    expect(await screen.findByTestId('card-ocr-not-available')).toBeInTheDocument()

    const btnRecheck = screen.getByTestId('btn-recheck-ocr')
    fireEvent.click(btnRecheck)

    expect(await screen.findByTestId('badge-ocr-ready')).toBeInTheDocument()
  })

  it('merender pemilih bahasa dan dropzone ketika OCR siap digunakan', async () => {
    vi.mocked(pdfToolsService.getOcrStatus).mockResolvedValueOnce({
      available: true,
      languages: ['eng', 'ind'],
      message: 'Siap',
    })

    render(<PdfOcrModal isOpen={true} onClose={vi.fn()} />)

    expect(await screen.findByTestId('badge-ocr-ready')).toBeInTheDocument()
    expect(screen.getByTestId('select-ocr-lang')).toBeInTheDocument()
    expect(screen.getByTestId('input-ocr-file')).toBeInTheDocument()
  })

  it('menjalankan proses OCR dan menampilkan pesan sukses saat berhasil', async () => {
    vi.mocked(pdfToolsService.getOcrStatus).mockResolvedValueOnce({
      available: true,
      languages: ['eng', 'ind'],
      message: 'Siap',
    })
    vi.mocked(pdfToolsService.ocrPdf).mockResolvedValueOnce({
      success: true,
      filename: 'scan_searchable.pdf',
      ocrPages: 2,
      blob: new Blob(['searchable-pdf'], { type: 'application/pdf' }),
    })

    render(<PdfOcrModal isOpen={true} onClose={vi.fn()} />)

    expect(await screen.findByTestId('badge-ocr-ready')).toBeInTheDocument()

    const input = screen.getByTestId('input-ocr-file')
    const file = new File(['%PDF-scan'], 'scan.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })

    const btnSubmit = screen.getByTestId('btn-submit-ocr')
    fireEvent.click(btnSubmit)

    await waitFor(() => {
      expect(pdfToolsService.ocrPdf).toHaveBeenCalledWith(file, 'ind+eng')
    })

    expect(await screen.findByTestId('alert-success-ocr')).toHaveTextContent(
      'scan_searchable.pdf berhasil diproses (2 halaman).'
    )
  })

  it('menampilkan galat jika proses OCR gagal di backend', async () => {
    vi.mocked(pdfToolsService.getOcrStatus).mockResolvedValueOnce({
      available: true,
      languages: ['eng'],
      message: 'Siap',
    })
    vi.mocked(pdfToolsService.ocrPdf).mockResolvedValueOnce({
      success: false,
      message: 'Gagal memproses OCR pada halaman 1.',
    })

    render(<PdfOcrModal isOpen={true} onClose={vi.fn()} />)

    expect(await screen.findByTestId('badge-ocr-ready')).toBeInTheDocument()

    const input = screen.getByTestId('input-ocr-file')
    const file = new File(['%PDF-scan'], 'scan.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })

    fireEvent.click(screen.getByTestId('btn-submit-ocr'))

    expect(await screen.findByTestId('alert-error-ocr')).toHaveTextContent(
      'Gagal memproses OCR pada halaman 1.'
    )
  })
})
