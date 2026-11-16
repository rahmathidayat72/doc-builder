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

  it('menampilkan status layanan tidak tersedia tanpa panduan instalasi perangkat saat server OCR tidak aktif', async () => {
    const onClose = vi.fn()
    vi.mocked(pdfToolsService.getOcrStatus).mockResolvedValueOnce({
      available: false,
      languages: [],
      message: 'No tessdata specified and Tesseract is not installed',
    })

    render(<PdfOcrModal isOpen={true} onClose={onClose} />)

    expect(await screen.findByTestId('card-ocr-not-available')).toBeInTheDocument()
    expect(screen.getByText(/Layanan OCR Sedang Tidak Tersedia/i)).toBeInTheDocument()
    expect(screen.getByText(/tanpa perlu memasang aplikasi di perangkat Anda/i)).toBeInTheDocument()
    expect(screen.queryByText(/UB-Mannheim Tesseract/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sudo apt install tesseract-ocr/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-close-ocr-unavailable'))
    expect(onClose).toHaveBeenCalledTimes(1)
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
    const select = screen.getByTestId('select-ocr-lang') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.value).toBe('ind+eng')
    expect((select.querySelector('option[value="ind+eng"]') as HTMLOptionElement).disabled).toBe(false)
    expect((select.querySelector('option[value="ind"]') as HTMLOptionElement).disabled).toBe(false)
    expect((select.querySelector('option[value="eng"]') as HTMLOptionElement).disabled).toBe(false)
    expect(screen.getByTestId('input-ocr-file')).toBeInTheDocument()
  })

  it('menonaktifkan ind+eng dan memilih bahasa yang tersedia saat paket bahasa server parsial', async () => {
    vi.mocked(pdfToolsService.getOcrStatus).mockResolvedValueOnce({
      available: true,
      languages: ['eng'],
      message: 'Siap',
    })

    render(<PdfOcrModal isOpen={true} onClose={vi.fn()} />)

    expect(await screen.findByTestId('badge-ocr-ready')).toBeInTheDocument()
    const select = screen.getByTestId('select-ocr-lang') as HTMLSelectElement
    expect(select.value).toBe('eng')
    expect((select.querySelector('option[value="ind+eng"]') as HTMLOptionElement).disabled).toBe(true)
    expect((select.querySelector('option[value="ind"]') as HTMLOptionElement).disabled).toBe(true)
    expect((select.querySelector('option[value="eng"]') as HTMLOptionElement).disabled).toBe(false)
  })

  it('memilih fallback ind jika hanya bahasa Indonesia yang tersedia di server', async () => {
    vi.mocked(pdfToolsService.getOcrStatus).mockResolvedValueOnce({
      available: true,
      languages: ['ind'],
      message: 'Siap',
    })

    render(<PdfOcrModal isOpen={true} onClose={vi.fn()} />)

    expect(await screen.findByTestId('badge-ocr-ready')).toBeInTheDocument()
    const select = screen.getByTestId('select-ocr-lang') as HTMLSelectElement
    expect(select.value).toBe('ind')
    expect((select.querySelector('option[value="ind+eng"]') as HTMLOptionElement).disabled).toBe(true)
    expect((select.querySelector('option[value="ind"]') as HTMLOptionElement).disabled).toBe(false)
    expect((select.querySelector('option[value="eng"]') as HTMLOptionElement).disabled).toBe(true)
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

  it('memetakan galat Tesseract tidak ditemukan menjadi pesan pemeliharaan server', async () => {
    vi.mocked(pdfToolsService.getOcrStatus).mockResolvedValueOnce({
      available: true,
      languages: ['eng', 'ind'],
      message: 'Siap',
    })
    vi.mocked(pdfToolsService.ocrPdf).mockResolvedValueOnce({
      success: false,
      message:
        'Tesseract OCR tidak ditemukan di sistem lokal. Silakan instal Tesseract OCR terlebih dahulu untuk menggunakan fitur ini.',
    })

    render(<PdfOcrModal isOpen={true} onClose={vi.fn()} />)

    expect(await screen.findByTestId('badge-ocr-ready')).toBeInTheDocument()

    const input = screen.getByTestId('input-ocr-file')
    const file = new File(['%PDF-scan'], 'scan.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })

    fireEvent.click(screen.getByTestId('btn-submit-ocr'))

    const alert = await screen.findByTestId('alert-error-ocr')
    expect(alert).toHaveTextContent(/Layanan OCR server sedang tidak tersedia atau dalam pemeliharaan/i)
    expect(alert).not.toHaveTextContent(/instal Tesseract/i)
  })
})
