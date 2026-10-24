import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PdfPageNumbersModal } from '../PdfPageNumbersModal'
import * as pdfToolsService from '../../../services/pdfTools'

vi.mock('../../../services/pdfTools', () => ({
  addPageNumbersPdf: vi.fn(),
}))

describe('PdfPageNumbersModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tidak me-render apapun ketika isOpen=false', () => {
    const { container } = render(
      <PdfPageNumbersModal isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('merender dialog modal dan menutup saat tombol ESC atau tombol close ditekan', () => {
    const onClose = vi.fn()
    render(<PdfPageNumbersModal isOpen={true} onClose={onClose} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Nomor Halaman PDF')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    const btnClose = screen.getByTestId('btn-close-pdf-page-numbers')
    fireEvent.click(btnClose)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('dapat memilih format dan posisi penomoran halaman', () => {
    render(<PdfPageNumbersModal isOpen={true} onClose={vi.fn()} />)

    // Pilih format formal
    const btnFormatFormal = screen.getByTestId('btn-format-Page-{n}-of-{total}')
    fireEvent.click(btnFormatFormal)

    // Pilih posisi bottom-right
    const btnPosRight = screen.getByTestId('btn-pos-bottom-right')
    fireEvent.click(btnPosRight)

    // Ganti mulai halaman
    const inputStartPage = screen.getByTestId('input-start-page')
    fireEvent.change(inputStartPage, { target: { value: '2' } })
    expect(screen.getByText(/Sampul depan dilewati/i)).toBeInTheDocument()
  })

  it('menjalankan proses penomoran halaman dan menampilkan hasil sukses', async () => {
    vi.mocked(pdfToolsService.addPageNumbersPdf).mockResolvedValueOnce({
      success: true,
      filename: 'laporan_numbered.pdf',
      numberedPages: 5,
      blob: new Blob(['numbered'], { type: 'application/pdf' }),
    })

    render(<PdfPageNumbersModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-page-numbers-pdf-file')
    const validFile = new File(['%PDF-1.4'], 'laporan.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [validFile] } })

    const btnSubmit = screen.getByTestId('btn-submit-page-numbers')
    fireEvent.click(btnSubmit)

    await waitFor(() => {
      expect(pdfToolsService.addPageNumbersPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          file: validFile,
          format: 'Halaman {n} dari {total}',
          position: 'bottom-center',
        })
      )
    })

    expect(await screen.findByTestId('alert-success-page-numbers')).toHaveTextContent(
      'laporan_numbered.pdf telah otomatis terunduh (5 halaman dinomori).'
    )
  })

  it('menampilkan galat jika penomoran gagal di backend', async () => {
    vi.mocked(pdfToolsService.addPageNumbersPdf).mockResolvedValueOnce({
      success: false,
      message: 'Gagal menambahkan nomor halaman.',
    })

    render(<PdfPageNumbersModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-page-numbers-pdf-file')
    const validFile = new File(['%PDF-1.4'], 'laporan.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [validFile] } })

    fireEvent.click(screen.getByTestId('btn-submit-page-numbers'))

    expect(await screen.findByTestId('alert-error-page-numbers')).toHaveTextContent(
      'Gagal menambahkan nomor halaman.'
    )
  })
})
