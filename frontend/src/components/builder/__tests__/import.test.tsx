import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImportResumeModal } from '../ImportResumeModal'

describe('ImportResumeModal Component', () => {
  it('tidak me-render apapun ketika isOpen bernilai false', () => {
    const { container } = render(
      <ImportResumeModal isOpen={false} onClose={vi.fn()} onApply={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('merender area upload dan tombol ketika isOpen bernilai true', () => {
    render(
      <ImportResumeModal isOpen={true} onClose={vi.fn()} onApply={vi.fn()} />
    )
    expect(screen.getByText(/Impor CV Lama/i)).toBeInTheDocument()
    expect(screen.getByTestId('dropzone-import')).toBeInTheDocument()
    expect(screen.getByTestId('btn-start-parse')).toBeInTheDocument()
  })

  it('menolak pemilihan berkas selain .pdf dan .docx', () => {
    render(
      <ImportResumeModal isOpen={true} onClose={vi.fn()} onApply={vi.fn()} />
    )

    const input = screen.getByTestId('input-file-import')
    const badFile = new File(['dummy content'], 'document.txt', { type: 'text/plain' })

    fireEvent.change(input, { target: { files: [badFile] } })

    expect(
      screen.getByText(/Hanya berkas format \.pdf dan \.docx yang didukung/i)
    ).toBeInTheDocument()
  })

  it('menerima berkas .pdf yang valid dan mengaktifkan tombol ekstrak', () => {
    render(
      <ImportResumeModal isOpen={true} onClose={vi.fn()} onApply={vi.fn()} />
    )

    const input = screen.getByTestId('input-file-import')
    const pdfFile = new File(['%PDF-1.4 content'], 'my_old_resume.pdf', { type: 'application/pdf' })

    fireEvent.change(input, { target: { files: [pdfFile] } })

    expect(screen.getByText('my_old_resume.pdf')).toBeInTheDocument()
    const btnParse = screen.getByTestId('btn-start-parse')
    expect(btnParse).not.toBeDisabled()
  })
})
