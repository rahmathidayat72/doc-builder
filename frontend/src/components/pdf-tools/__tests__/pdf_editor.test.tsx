import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PdfEditorModal } from '../PdfEditorModal'
import * as pdfToolsService from '../../../services/pdfTools'

vi.mock('../../../services/pdfTools', () => ({
  getPdfEditorPages: vi.fn(),
  applyPdfEditor: vi.fn(),
}))

describe('PdfEditorModal Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tidak me-render ketika isOpen=false', () => {
    const { container } = render(<PdfEditorModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('merender judul dan area unggah berkas PDF saat modal dibuka', () => {
    render(<PdfEditorModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Editor PDF Visual')).toBeInTheDocument()
    expect(screen.getByText(/Pilih atau seret berkas PDF ke sini/i)).toBeInTheDocument()
    expect(screen.getByTestId('btn-close-pdf-editor')).toBeInTheDocument()
  })

  it('memicu tombol tutup modal', () => {
    const onClose = vi.fn()
    render(<PdfEditorModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('btn-close-pdf-editor'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('memuat halaman PDF, merender thumbnail, dan mengaktifkan toolbar', async () => {
    vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
      success: true,
      filename: 'sample.pdf',
      total_pages: 2,
      pages: [
        {
          page_number: 1,
          original_index: 0,
          width: 595,
          height: 842,
          rotation: 0,
          thumbnail: 'data:image/jpeg;base64,thumb1',
        },
        {
          page_number: 2,
          original_index: 1,
          width: 595,
          height: 842,
          rotation: 0,
          thumbnail: 'data:image/jpeg;base64,thumb2',
        },
      ],
    })

    render(<PdfEditorModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('input-pdf-editor-file')
    const testFile = new File(['%PDF-1.4 test'], 'sample.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [testFile] } })

    await waitFor(() => {
      expect(pdfToolsService.getPdfEditorPages).toHaveBeenCalledWith(testFile)
      expect(screen.getByText(/Halaman 1 dari 2/i)).toBeInTheDocument()
      expect(screen.getByTestId('thumb-page-0')).toBeInTheDocument()
      expect(screen.getByTestId('thumb-page-1')).toBeInTheDocument()
    })
  })

  it('dapat memutar halaman 90 derajat', async () => {
    vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
      success: true,
      pages: [
        {
          page_number: 1,
          original_index: 0,
          width: 595,
          height: 842,
          rotation: 0,
          thumbnail: 'data:image/jpeg;base64,thumb1',
        },
      ],
    })

    render(<PdfEditorModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('input-pdf-editor-file')
    fireEvent.change(fileInput, { target: { files: [new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })] } })

    await waitFor(() => {
      expect(screen.getByText(/\(Rotasi: 0°\)/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('btn-rotate-page'))
    expect(screen.getByText(/\(Rotasi: 90°\)/i)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-rotate-page'))
    expect(screen.getByText(/\(Rotasi: 180°\)/i)).toBeInTheDocument()
  })

  it('dapat menduplikasi dan menghapus halaman', async () => {
    vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
      success: true,
      pages: [
        {
          page_number: 1,
          original_index: 0,
          width: 595,
          height: 842,
          rotation: 0,
          thumbnail: 'data:image/jpeg;base64,thumb1',
        },
      ],
    })

    render(<PdfEditorModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('input-pdf-editor-file')
    fireEvent.change(fileInput, { target: { files: [new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })] } })

    await waitFor(() => {
      expect(screen.getByText(/Halaman 1 dari 1/i)).toBeInTheDocument()
    })

    // Duplikasi
    fireEvent.click(screen.getByTestId('btn-duplicate-page'))
    expect(screen.getByText(/Halaman 2 dari 2/i)).toBeInTheDocument()
    expect(screen.getByTestId('thumb-page-0')).toBeInTheDocument()
    expect(screen.getByTestId('thumb-page-1')).toBeInTheDocument()

    // Hapus halaman
    fireEvent.click(screen.getByTestId('btn-delete-page'))
    expect(screen.getByText(/Halaman 1 dari 1/i)).toBeInTheDocument()

    // Tombol hapus sekarang disabled karena hanya tersisa 1 halaman
    expect(screen.getByTestId('btn-delete-page')).toBeDisabled()
  })

  it('dapat menambahkan teks overlay ke halaman aktif', async () => {
    vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
      success: true,
      pages: [
        {
          page_number: 1,
          original_index: 0,
          width: 595,
          height: 842,
          rotation: 0,
          thumbnail: 'data:image/jpeg;base64,thumb1',
        },
      ],
    })

    render(<PdfEditorModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('input-pdf-editor-file')
    fireEvent.change(fileInput, { target: { files: [new File(['%PDF'], 'a.pdf', { type: 'application/pdf' })] } })

    await waitFor(() => {
      expect(screen.getByTestId('btn-toggle-add-text')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('btn-toggle-add-text'))
    expect(screen.getByText(/Tambahkan Teks ke Halaman 1/i)).toBeInTheDocument()

    const textInput = screen.getByTestId('input-new-text')
    fireEvent.change(textInput, { target: { value: 'Disetujui Manajer' } })

    fireEvent.click(screen.getByTestId('btn-save-text-overlay'))

    // Teks overlay harus muncul di stage
    expect(screen.getByText('Disetujui Manajer')).toBeInTheDocument()
  })

  it('mengeksekusi applyPdfEditor dan mengunduh berkas hasil', async () => {
    const testFile = new File(['%PDF-1.4 test'], 'dokumen_asli.pdf', { type: 'application/pdf' })
    vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
      success: true,
      pages: [
        {
          page_number: 1,
          original_index: 0,
          width: 595,
          height: 842,
          rotation: 0,
          thumbnail: 'data:image/jpeg;base64,thumb1',
        },
      ],
    })

    vi.mocked(pdfToolsService.applyPdfEditor).mockResolvedValueOnce({
      success: true,
      filename: 'dokumen_asli_edited.pdf',
    })

    render(<PdfEditorModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('input-pdf-editor-file')
    fireEvent.change(fileInput, { target: { files: [testFile] } })

    await waitFor(() => {
      expect(screen.getByTestId('btn-apply-editor')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('btn-apply-editor'))

    await waitFor(() => {
      expect(pdfToolsService.applyPdfEditor).toHaveBeenCalled()
      expect(screen.getByText(/Berhasil menyimpan dan mengunduh berkas: dokumen_asli_edited\.pdf/i)).toBeInTheDocument()
    })
  })

  it('menampilkan pesan error jika getPdfEditorPages gagal', async () => {
    vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
      success: false,
      message: 'Berkas PDF terenkripsi password tidak didukung.',
    })

    render(<PdfEditorModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('input-pdf-editor-file')
    fireEvent.change(fileInput, { target: { files: [new File(['bad'], 'enc.pdf', { type: 'application/pdf' })] } })

    await waitFor(() => {
      expect(screen.getByText('Berkas PDF terenkripsi password tidak didukung.')).toBeInTheDocument()
    })
  })

  it('dapat mengatur zoom canvas dan fit page', async () => {
    vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
      success: true,
      pages: [
        {
          page_number: 1,
          original_index: 0,
          width: 600,
          height: 800,
          rotation: 0,
          thumbnail: 'data:image/jpeg;base64,t1',
        },
      ],
    })

    render(<PdfEditorModal isOpen={true} onClose={vi.fn()} />)
    const fileInput = screen.getByTestId('input-pdf-editor-file')
    fireEvent.change(fileInput, { target: { files: [new File(['%PDF'], 'test.pdf', { type: 'application/pdf' })] } })

    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Perbesar Kanvas'))
    expect(screen.getByText('115%')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Perkecil Kanvas'))
    expect(screen.getByText('100%')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Pas Halaman'))
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('dapat membuka dialog coret dan tanda tangan visual', async () => {
    vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
      success: true,
      pages: [
        {
          page_number: 1,
          original_index: 0,
          width: 600,
          height: 800,
          rotation: 0,
          thumbnail: 'data:image/jpeg;base64,t1',
        },
      ],
    })

    render(<PdfEditorModal isOpen={true} onClose={vi.fn()} />)
    const fileInput = screen.getByTestId('input-pdf-editor-file')
    fireEvent.change(fileInput, { target: { files: [new File(['%PDF'], 'test.pdf', { type: 'application/pdf' })] } })

    await waitFor(() => {
      expect(screen.getByLabelText('Tanda Tangan')).toBeInTheDocument()
    })

    // Buka dialog tanda tangan
    fireEvent.click(screen.getByLabelText('Tanda Tangan'))
    expect(screen.getByText(/Tanda Tangan Halaman 1/i)).toBeInTheDocument()
    expect(screen.getByTestId('canvas-signature')).toBeInTheDocument()

    // Batal
    fireEvent.click(screen.getByText('Batal'))
    expect(screen.queryByText(/Tanda Tangan Halaman 1/i)).not.toBeInTheDocument()

    // Buka dialog coretan
    fireEvent.click(screen.getByLabelText('Coret Bebas'))
    expect(screen.getByText(/Coret Bebas di Halaman 1/i)).toBeInTheDocument()
    expect(screen.getByTestId('canvas-drawing')).toBeInTheDocument()
  })

  it('dapat menghapus semua elemen dan mendukung undo/redo', async () => {
    vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
      success: true,
      pages: [
        {
          page_number: 1,
          original_index: 0,
          width: 600,
          height: 800,
          rotation: 0,
          thumbnail: 'data:image/jpeg;base64,t1',
        },
      ],
    })

    render(<PdfEditorModal isOpen={true} onClose={vi.fn()} />)
    const fileInput = screen.getByTestId('input-pdf-editor-file')
    fireEvent.change(fileInput, { target: { files: [new File(['%PDF'], 'test.pdf', { type: 'application/pdf' })] } })

    await waitFor(() => {
      expect(screen.getByTestId('btn-toggle-add-text')).toBeInTheDocument()
    })

    // Tambah teks pertama
    fireEvent.click(screen.getByTestId('btn-toggle-add-text'))
    fireEvent.change(screen.getByTestId('input-new-text'), { target: { value: 'Elemen A' } })
    fireEvent.click(screen.getByTestId('btn-save-text-overlay'))

    expect(screen.getByText('Elemen A')).toBeInTheDocument()

    // Tombol Hapus Semua harus muncul
    expect(screen.getByText('Hapus Semua')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Hapus Semua'))

    // Teks harus hilang
    expect(screen.queryByText('Elemen A')).not.toBeInTheDocument()

    // Undo aksi hapus semua
    fireEvent.click(screen.getByTestId('btn-undo'))
    expect(screen.getByText('Elemen A')).toBeInTheDocument()

    // Redo aksi hapus semua
    fireEvent.click(screen.getByTestId('btn-redo'))
    expect(screen.queryByText('Elemen A')).not.toBeInTheDocument()
  })
})
