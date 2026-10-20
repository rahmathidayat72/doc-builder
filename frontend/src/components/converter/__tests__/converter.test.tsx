import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DocxToPdfModal } from '../DocxToPdfModal'

describe('DocxToPdfModal Converter Component Suite', () => {
  it('tidak me-render apapun saat isOpen bernilai false', () => {
    const { container } = render(
      <DocxToPdfModal isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('merender dropzone dan tombol konversi saat isOpen bernilai true', () => {
    render(
      <DocxToPdfModal isOpen={true} onClose={vi.fn()} />
    )

    expect(screen.getByText(/Konversi DOCX ke PDF/i)).toBeInTheDocument()
    expect(screen.getByTestId('dropzone-docx')).toBeInTheDocument()
    expect(screen.getByTestId('btn-start-convert')).toBeInTheDocument()
  })

  it('menolak pemilihan berkas non-DOCX dengan pesan kesalahan yang jelas', () => {
    render(
      <DocxToPdfModal isOpen={true} onClose={vi.fn()} />
    )

    const input = screen.getByTestId('input-file-docx')
    const badFile = new File(['mock content'], 'my_notes.txt', { type: 'text/plain' })

    fireEvent.change(input, { target: { files: [badFile] } })

    expect(
      screen.getByText(/Hanya berkas dokumen Microsoft Word \(\.docx\) yang didukung/i)
    ).toBeInTheDocument()
  })

  it('menerima berkas .docx yang valid dan mengaktifkan tombol mulai konversi', () => {
    render(
      <DocxToPdfModal isOpen={true} onClose={vi.fn()} />
    )

    const input = screen.getByTestId('input-file-docx')
    const docxFile = new File(['PK\x03\x04 mock docx'], 'laporan_kinerja.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    })

    fireEvent.change(input, { target: { files: [docxFile] } })

    expect(screen.getByText('laporan_kinerja.docx')).toBeInTheDocument()
    const btnConvert = screen.getByTestId('btn-start-convert')
    expect(btnConvert).not.toBeDisabled()
  })

  it('menutup modal memicu callback onClose', () => {
    const mockClose = vi.fn()
    render(
      <DocxToPdfModal isOpen={true} onClose={mockClose} />
    )

    const btnClose = screen.getByTestId('btn-close-converter')
    fireEvent.click(btnClose)
    expect(mockClose).toHaveBeenCalledTimes(1)
  })
})
