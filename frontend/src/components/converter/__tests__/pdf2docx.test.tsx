import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PdfToDocxModal } from '../PdfToDocxModal'

describe('PdfToDocxModal Component Suite', () => {
  it('tidak me-render ketika modal ditutup', () => {
    const { container } = render(<PdfToDocxModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('merender dropzone dan tombol konversi ketika modal dibuka', () => {
    render(<PdfToDocxModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/Konversi PDF ke Word DOCX/i)).toBeInTheDocument()
    expect(screen.getByTestId('dropzone-pdf')).toBeInTheDocument()
    expect(screen.getByTestId('btn-start-pdf2docx')).toBeInTheDocument()
  })

  it('menolak file selain PDF', () => {
    render(<PdfToDocxModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-file-pdf')
    const invalidFile = new File(['PK\x03\x04'], 'resume.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })

    fireEvent.change(input, { target: { files: [invalidFile] } })

    expect(screen.getByText(/Hanya berkas dokumen PDF/i)).toBeInTheDocument()
  })

  it('menerima PDF valid dan mengaktifkan tombol rekonstruksi', () => {
    render(<PdfToDocxModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-file-pdf')
    const validFile = new File(['%PDF-1.4 sample'], 'resume_lama.pdf', {
      type: 'application/pdf'
    })

    fireEvent.change(input, { target: { files: [validFile] } })

    expect(screen.getByText('resume_lama.pdf')).toBeInTheDocument()
    expect(screen.getByTestId('btn-start-pdf2docx')).not.toBeDisabled()
  })

  it('memicu callback saat tombol tutup diklik', () => {
    const onClose = vi.fn()
    render(<PdfToDocxModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('btn-close-pdf2docx'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
