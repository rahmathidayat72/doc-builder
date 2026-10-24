import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PdfToMarkdownModal } from '../PdfToMarkdownModal'
import * as pdfToolsService from '../../../services/pdfTools'

vi.mock('../../../services/pdfTools', () => ({
  pdfToMarkdown: vi.fn(),
}))

describe('PdfToMarkdownModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tidak me-render apapun ketika isOpen=false', () => {
    const { container } = render(
      <PdfToMarkdownModal isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('merender dialog modal dan menutup saat tombol ESC atau tombol close ditekan', () => {
    const onClose = vi.fn()
    render(<PdfToMarkdownModal isOpen={true} onClose={onClose} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('PDF to Markdown')).toBeInTheDocument()
    expect(screen.getByText('New!')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    const btnClose = screen.getByTestId('btn-close-pdf-to-markdown')
    fireEvent.click(btnClose)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('menolak berkas non-PDF atau melebihi 25 MB', () => {
    render(<PdfToMarkdownModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-pdf-to-markdown-file')

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

  it('dapat mengatur rentang halaman target kustom', () => {
    render(<PdfToMarkdownModal isOpen={true} onClose={vi.fn()} />)

    const radioCustom = screen.getByLabelText('Halaman Tertentu')
    fireEvent.click(radioCustom)

    const inputPages = screen.getByTestId('input-pdf-to-markdown-pages-range')
    expect(inputPages).toBeInTheDocument()
    fireEvent.change(inputPages, { target: { value: '1-3, 5' } })
    expect(inputPages).toHaveValue('1-3, 5')
  })

  it('menjalankan proses ekstraksi Markdown, menampilkan pratinjau teks, dan mendukung copy to clipboard', async () => {
    const fakeMarkdown = '# Judul Dokumen\n\n- Poin pertama\n- Poin kedua'
    vi.mocked(pdfToolsService.pdfToMarkdown).mockResolvedValueOnce({
      success: true,
      filename: 'dokumen.md',
      markdownText: fakeMarkdown,
      convertedPages: 2,
      totalPages: 2,
      blob: new Blob([fakeMarkdown], { type: 'text/markdown' }),
    })

    // Mock navigator.clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(<PdfToMarkdownModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-pdf-to-markdown-file')
    const validFile = new File(['%PDF-1.4'], 'dokumen.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [validFile] } })

    const btnSubmit = screen.getByTestId('btn-submit-pdf-to-markdown')
    fireEvent.click(btnSubmit)

    await waitFor(() => {
      expect(pdfToolsService.pdfToMarkdown).toHaveBeenCalledWith(
        expect.objectContaining({
          file: validFile,
          pages: 'all',
          autoDownload: true,
        })
      )
    })

    expect(await screen.findByTestId('alert-success-pdf-to-markdown')).toHaveTextContent(
      'dokumen.md telah otomatis terunduh (2 halaman diekstrak).'
    )

    // Periksa panggung pratinjau markdown
    const preview = screen.getByTestId('preview-markdown-content')
    expect(preview).toHaveTextContent('# Judul Dokumen')

    // Salin ke clipboard
    const btnCopy = screen.getByTestId('btn-copy-markdown')
    fireEvent.click(btnCopy)
    expect(writeTextMock).toHaveBeenCalledWith(fakeMarkdown)
    expect(await screen.findByText('Tersalin!')).toBeInTheDocument()
  })

  it('menampilkan galat jika ekstraksi gagal di backend', async () => {
    vi.mocked(pdfToolsService.pdfToMarkdown).mockResolvedValueOnce({
      success: false,
      message: 'Berkas PDF terenkripsi password. Buka proteksi berkas terlebih dahulu.',
    })

    render(<PdfToMarkdownModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-pdf-to-markdown-file')
    const validFile = new File(['%PDF-1.4'], 'terkunci.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [validFile] } })

    fireEvent.click(screen.getByTestId('btn-submit-pdf-to-markdown'))

    expect(await screen.findByTestId('alert-error-pdf-to-markdown')).toHaveTextContent(
      'Berkas PDF terenkripsi password. Buka proteksi berkas terlebih dahulu.'
    )
  })
})
