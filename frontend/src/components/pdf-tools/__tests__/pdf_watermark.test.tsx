import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PdfWatermarkModal } from '../PdfWatermarkModal'
import * as pdfToolsService from '../../../services/pdfTools'

vi.mock('../../../services/pdfTools', () => ({
  watermarkPdf: vi.fn(),
}))

describe('PdfWatermarkModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tidak me-render apapun ketika isOpen=false', () => {
    const { container } = render(
      <PdfWatermarkModal isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('merender dialog modal dan menutup saat tombol ESC atau tombol close ditekan', () => {
    const onClose = vi.fn()
    render(<PdfWatermarkModal isOpen={true} onClose={onClose} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Watermark PDF')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    const btnClose = screen.getByTestId('btn-close-pdf-watermark')
    fireEvent.click(btnClose)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('dapat beralih antara mode teks dan mode gambar', () => {
    render(<PdfWatermarkModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByTestId('input-watermark-text')).toBeInTheDocument()

    // Beralih ke mode gambar
    fireEvent.click(screen.getByTestId('tab-watermark-image'))
    expect(screen.getByTestId('input-watermark-image-file')).toBeInTheDocument()

    // Beralih kembali ke mode teks
    fireEvent.click(screen.getByTestId('tab-watermark-text'))
    expect(screen.getByTestId('input-watermark-text')).toBeInTheDocument()
  })

  it('menolak berkas non-PDF atau melebihi 25 MB', () => {
    render(<PdfWatermarkModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-watermark-pdf-file')

    // Non-PDF
    const invalidFile = new File(['data'], 'test.docx', { type: 'application/docx' })
    fireEvent.change(input, { target: { files: [invalidFile] } })
    expect(screen.getByText(/Hanya berkas dokumen PDF/i)).toBeInTheDocument()

    // > 25 MB
    const bigFile = new File(['big'], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(bigFile, 'size', { value: 30 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [bigFile] } })
    expect(screen.getByText(/melebihi batas maksimal 25 MB/i)).toBeInTheDocument()
  })

  it('menjalankan proses watermark teks dan menampilkan pesan sukses', async () => {
    vi.mocked(pdfToolsService.watermarkPdf).mockResolvedValueOnce({
      success: true,
      filename: 'dokumen_watermarked.pdf',
      watermarkedPages: 3,
      blob: new Blob(['watermarked'], { type: 'application/pdf' }),
    })

    render(<PdfWatermarkModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-watermark-pdf-file')
    const validFile = new File(['%PDF-1.4'], 'dokumen.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [validFile] } })

    // Ganti teks watermark
    const textInput = screen.getByTestId('input-watermark-text')
    fireEvent.change(textInput, { target: { value: 'RAHASIA' } })

    // Pilih posisi center
    fireEvent.click(screen.getByTestId('btn-pos-center'))

    const btnSubmit = screen.getByTestId('btn-submit-watermark')
    fireEvent.click(btnSubmit)

    await waitFor(() => {
      expect(pdfToolsService.watermarkPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          file: validFile,
          mode: 'text',
          text: 'RAHASIA',
          position: 'center',
        })
      )
    })

    expect(await screen.findByTestId('alert-success-watermark')).toHaveTextContent(
      'dokumen_watermarked.pdf telah otomatis terunduh (3 halaman).'
    )
  })

  it('menampilkan pesan galat jika proses watermark gagal', async () => {
    vi.mocked(pdfToolsService.watermarkPdf).mockResolvedValueOnce({
      success: false,
      message: 'Berkas PDF terenkripsi password.',
    })

    render(<PdfWatermarkModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-watermark-pdf-file')
    const validFile = new File(['%PDF-1.4'], 'terenkripsi.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [validFile] } })

    fireEvent.click(screen.getByTestId('btn-submit-watermark'))

    expect(await screen.findByTestId('alert-error-watermark')).toHaveTextContent(
      'Berkas PDF terenkripsi password.'
    )
  })
})
