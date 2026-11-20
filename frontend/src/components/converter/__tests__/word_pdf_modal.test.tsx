import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WordPdfModal } from '../WordPdfModal'

describe('WordPdfModal Component Suite', () => {
  it('tidak me-render apapun saat isOpen bernilai false', () => {
    const { container } = render(
      <WordPdfModal isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('menampilkan tab Word ke PDF & PDF ke Word dengan konten tersemat tanpa overlay ganda', () => {
    render(<WordPdfModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Word & PDF' })).toBeInTheDocument()
    expect(screen.getByTestId('tab-docx2pdf')).toHaveTextContent('Word ke PDF')
    expect(screen.getByTestId('tab-pdf2docx')).toHaveTextContent('PDF ke Word')

    // Default tab: Word ke PDF
    expect(screen.getByTestId('dropzone-docx')).toBeInTheDocument()
    expect(screen.getByTestId('input-file-docx')).toBeInTheDocument()
    expect(screen.getByTestId('btn-start-convert')).toBeInTheDocument()
    expect(screen.getAllByTestId('btn-close-converter')).toHaveLength(1)
    expect(screen.queryByTestId('dropzone-pdf')).not.toBeInTheDocument()
  })

  it('berpindah antar tab dan mereset state berkas yang sudah dipilih', () => {
    render(<WordPdfModal isOpen={true} onClose={vi.fn()} />)

    const docxInput = screen.getByTestId('input-file-docx')
    const docxFile = new File(['PK\x03\x04 mock docx'], 'kontrak.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    fireEvent.change(docxInput, { target: { files: [docxFile] } })
    expect(screen.getByText('kontrak.docx')).toBeInTheDocument()
    expect(screen.getByTestId('btn-start-convert')).not.toBeDisabled()

    // Pindah ke tab PDF ke Word
    fireEvent.click(screen.getByTestId('tab-pdf2docx'))
    expect(screen.queryByTestId('dropzone-docx')).not.toBeInTheDocument()
    expect(screen.getByTestId('dropzone-pdf')).toBeInTheDocument()
    expect(screen.getByTestId('input-file-pdf')).toBeInTheDocument()
    expect(screen.getAllByTestId('btn-close-pdf2docx')).toHaveLength(1)

    const pdfInput = screen.getByTestId('input-file-pdf')
    const pdfFile = new File(['%PDF-1.4 mock'], 'lamaran.pdf', {
      type: 'application/pdf',
    })
    fireEvent.change(pdfInput, { target: { files: [pdfFile] } })
    expect(screen.getByText('lamaran.pdf')).toBeInTheDocument()
    expect(screen.getByTestId('btn-start-pdf2docx')).not.toBeDisabled()

    // Kembali ke tab Word ke PDF -> state file lama harus sudah ter-reset
    fireEvent.click(screen.getByTestId('tab-docx2pdf'))
    expect(screen.queryByText('kontrak.docx')).not.toBeInTheDocument()
    expect(screen.getByTestId('btn-start-convert')).toBeDisabled()
  })

  it('tombol tutup pada WordPdfModal memanggil onClose', () => {
    const onClose = vi.fn()
    render(<WordPdfModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('btn-close-converter'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
