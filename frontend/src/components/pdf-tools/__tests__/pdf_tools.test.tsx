import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PdfToolsModal } from '../PdfToolsModal'
import * as pdfToolsService from '../../../services/pdfTools'

vi.mock('../../../services/pdfTools', () => ({
  mergePdfAndImages: vi.fn(),
  splitPdf: vi.fn(),
  compressPdf: vi.fn(),
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

  it('merender judul dan 5 tab saat modal dibuka', () => {
    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('PDF Tools')).toBeInTheDocument()
    expect(screen.getByTestId('tab-merge')).toBeInTheDocument()
    expect(screen.getByTestId('tab-split')).toBeInTheDocument()
    expect(screen.getByTestId('tab-compress')).toBeInTheDocument()
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

  it('merender modal langsung ke tab split ketika initialTab="split"', () => {
    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} initialTab="split" />)

    expect(screen.getByText(/Ekstrak halaman tertentu dari PDF menjadi beberapa berkas PDF terpisah yang dikemas dalam arsip ZIP/i)).toBeInTheDocument()
    expect(screen.getByTestId('btn-submit-split')).toBeInTheDocument()
  })

  it('mengatur urutan berkas merge dengan tombol panah naik dan turun', async () => {
    vi.mocked(pdfToolsService.mergePdfAndImages).mockResolvedValueOnce({
      success: true,
      filename: 'merged.pdf',
    })

    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} initialTab="merge" />)

    const fileInput = screen.getByTestId('input-merge-files')
    const fileA = new File(['a'], 'doc_a.pdf', { type: 'application/pdf' })
    const fileB = new File(['b'], 'doc_b.docx', { type: 'application/vnd.openxmlformats' })
    const fileC = new File(['c'], 'doc_c.png', { type: 'image/png' })

    fireEvent.change(fileInput, { target: { files: [fileA, fileB, fileC] } })

    expect(screen.getByText(/1\. doc_a\.pdf/i)).toBeInTheDocument()
    expect(screen.getByText(/2\. doc_b\.docx/i)).toBeInTheDocument()
    expect(screen.getByText(/3\. doc_c\.png/i)).toBeInTheDocument()

    // Move fileB down -> order becomes: fileA, fileC, fileB
    const btnDown1 = screen.getByTestId('btn-move-down-1')
    fireEvent.click(btnDown1)

    expect(screen.getByText(/2\. doc_c\.png/i)).toBeInTheDocument()
    expect(screen.getByText(/3\. doc_b\.docx/i)).toBeInTheDocument()

    // Move fileC up -> order becomes: fileC, fileA, fileB
    const btnUp1 = screen.getByTestId('btn-move-up-1')
    fireEvent.click(btnUp1)

    expect(screen.getByText(/1\. doc_c\.png/i)).toBeInTheDocument()
    expect(screen.getByText(/2\. doc_a\.pdf/i)).toBeInTheDocument()

    const submitBtn = screen.getByTestId('btn-submit-merge')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(pdfToolsService.mergePdfAndImages).toHaveBeenCalledWith([fileC, fileA, fileB])
    })
  })

  it('mengeksekusi split PDF dengan rentang halaman dan menghasilkan arsip ZIP', async () => {
    vi.mocked(pdfToolsService.splitPdf).mockResolvedValueOnce({
      success: true,
      filename: 'sample_split.zip',
    })

    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} initialTab="split" />)

    const fileInput = screen.getByTestId('input-split-file')
    const pdfFile = new File(['%PDF-1.4 test'], 'sample.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    const rangeInput = screen.getByTestId('input-page-range')
    fireEvent.change(rangeInput, { target: { value: '1-2, 4-5' } })

    const submitBtn = screen.getByTestId('btn-submit-split')
    expect(submitBtn).toHaveTextContent('Pisahkan PDF (Arsip ZIP)')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(pdfToolsService.splitPdf).toHaveBeenCalledWith(pdfFile, '1-2, 4-5')
      expect(screen.getByText(/Berhasil memisahkan PDF: sample_split.zip/i)).toBeInTheDocument()
    })
  })

  it('merender modal langsung ke tab compress ketika initialTab="compress"', () => {
    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} initialTab="compress" />)

    expect(
      screen.getByText(/Perkecil ukuran dokumen PDF secara lokal dengan 3 tingkat kompresi cerdas/i)
    ).toBeInTheDocument()
    expect(screen.getByTestId('btn-submit-compress')).toBeInTheDocument()
  })

  it('berpindah tab ke Kompres PDF dan mengeksekusi kompresi dengan level pilihan', async () => {
    vi.mocked(pdfToolsService.compressPdf).mockResolvedValueOnce({
      success: true,
      filename: 'dokumen_compressed.pdf',
      applied: true,
      originalSize: 2_000_000,
      outputSize: 500_000,
    })

    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} initialTab="compress" />)

    const fileInput = screen.getByTestId('input-compress-file')
    const pdfFile = new File(['%PDF-1.4 big file'], 'dokumen.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    // Pilih level maksimum
    const btnMax = screen.getByTestId('btn-compress-level-maximum')
    fireEvent.click(btnMax)

    const submitBtn = screen.getByTestId('btn-submit-compress')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(pdfToolsService.compressPdf).toHaveBeenCalledWith(pdfFile, 'maximum')
      expect(screen.getByText(/hemat 75\.0%/i)).toBeInTheDocument()
    })
  })

  it('menampilkan pesan bahwa PDF sudah optimal ketika compression applied=false', async () => {
    vi.mocked(pdfToolsService.compressPdf).mockResolvedValueOnce({
      success: true,
      filename: 'dokumen_compressed.pdf',
      applied: false,
      originalSize: 50_000,
      outputSize: 50_000,
    })

    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} initialTab="compress" />)

    const fileInput = screen.getByTestId('input-compress-file')
    const pdfFile = new File(['%PDF-1.4 small'], 'dokumen.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    const submitBtn = screen.getByTestId('btn-submit-compress')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(pdfToolsService.compressPdf).toHaveBeenCalledWith(pdfFile, 'balanced')
      expect(screen.getByText(/PDF sudah optimal: dokumen_compressed\.pdf/i)).toBeInTheDocument()
    })
  })

  it('menampilkan pesan error jika kompresi PDF gagal', async () => {
    vi.mocked(pdfToolsService.compressPdf).mockResolvedValueOnce({
      success: false,
      message: 'Berkas PDF memuat tanda tangan digital.',
    })

    render(<PdfToolsModal isOpen={true} onClose={vi.fn()} initialTab="compress" />)

    const fileInput = screen.getByTestId('input-compress-file')
    const pdfFile = new File(['%PDF-1.4 signed'], 'signed.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [pdfFile] } })

    const submitBtn = screen.getByTestId('btn-submit-compress')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Berkas PDF memuat tanda tangan digital.')).toBeInTheDocument()
    })
  })
})
