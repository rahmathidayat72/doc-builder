import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PdfToolsModal } from '../PdfToolsModal'
import * as pdfToolsService from '../../../services/pdfTools'

vi.mock('../../../services/pdfTools', () => ({
  mergePdfAndImages: vi.fn(),
  splitPdf: vi.fn(),
  imagesToPdf: vi.fn(),
  pdfToImages: vi.fn(),
}))

describe('PdfToolsModal Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tidak me-render ketika isOpen=false', () => {
    const { container } = render(<PdfToolsModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('merender judul dan 4 tab saat modal dibuka', () => {
    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('PDF Tools')).toBeInTheDocument()
    expect(screen.getByTestId('tab-merge')).toBeInTheDocument()
    expect(screen.getByTestId('tab-split')).toBeInTheDocument()
    expect(screen.getByTestId('tab-img2pdf')).toBeInTheDocument()
    expect(screen.getByTestId('tab-pdf2img')).toBeInTheDocument()
  })

  it('memicu tombol tutup modal', () => {
    const onClose = vi.fn()
    render(<PdfToolsModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('btn-close-pdf-tools'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('berpindah tab ke Split PDF dan mengeksekusi split', async () => {
    vi.mocked(pdfToolsService.splitPdf).mockResolvedValueOnce({
      success: true,
      filename: 'sample_split.pdf',
    })

    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('tab-split'))
    expect(screen.getByText(/Ekstrak halaman tertentu dari PDF/i)).toBeInTheDocument()

    const fileInput = screen.getByTestId('input-split-file')
    const testFile = new File(['%PDF-1.4 test'], 'sample.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [testFile] } })

    const rangeInput = screen.getByTestId('input-page-range')
    fireEvent.change(rangeInput, { target: { value: '1-2' } })

    const submitBtn = screen.getByTestId('btn-submit-split')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(pdfToolsService.splitPdf).toHaveBeenCalledWith(testFile, '1-2')
      expect(screen.getByText(/Berhasil memisahkan PDF: sample_split.pdf/i)).toBeInTheDocument()
    })
  })

  it('berpindah tab ke Gambar ke PDF dan mengeksekusi konversi', async () => {
    vi.mocked(pdfToolsService.imagesToPdf).mockResolvedValueOnce({
      success: true,
      filename: 'images.pdf',
    })

    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('tab-img2pdf'))
    expect(screen.getByText(/Ubah kumpulan gambar menjadi berkas PDF/i)).toBeInTheDocument()

    const fileInput = screen.getByTestId('input-img2pdf-files')
    const imgFile = new File(['fake-png-data'], 'foto.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [imgFile] } })

    const submitBtn = screen.getByTestId('btn-submit-img2pdf')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(pdfToolsService.imagesToPdf).toHaveBeenCalledWith([imgFile], 'A4', 'portrait')
      expect(screen.getByText(/Berhasil membuat PDF: images.pdf/i)).toBeInTheDocument()
    })
  })

  it('berpindah tab ke PDF ke Gambar dan mengeksekusi ekstraksi', async () => {
    vi.mocked(pdfToolsService.pdfToImages).mockResolvedValueOnce({
      success: true,
      filename: 'sample_images.zip',
    })

    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('tab-pdf2img'))
    expect(screen.getByText(/Ekstrak setiap halaman berkas PDF ke dalam arsip ZIP/i)).toBeInTheDocument()

    const fileInput = screen.getByTestId('input-pdf2img-file')
    const pdfFile = new File(['%PDF-1.4 test'], 'dokumen.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    const submitBtn = screen.getByTestId('btn-submit-pdf2img')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(pdfToolsService.pdfToImages).toHaveBeenCalledWith(pdfFile, 'png', 150)
      expect(screen.getByText(/Berhasil mengekstrak gambar: sample_images.zip/i)).toBeInTheDocument()
    })
  })

  it('menampilkan pesan error jika operasi merge gagal', async () => {
    vi.mocked(pdfToolsService.mergePdfAndImages).mockResolvedValueOnce({
      success: false,
      message: 'Header berkas rusak.',
    })

    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('input-merge-files')
    const testFile = new File(['invalid'], 'bad.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [testFile] } })

    const submitBtn = screen.getByTestId('btn-submit-merge')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(pdfToolsService.mergePdfAndImages).toHaveBeenCalled()
      expect(screen.getByText('Header berkas rusak.')).toBeInTheDocument()
    })
  })
})
