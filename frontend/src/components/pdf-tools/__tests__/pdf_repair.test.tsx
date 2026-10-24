import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PdfRepairModal } from '../PdfRepairModal'
import * as pdfToolsService from '../../../services/pdfTools'

vi.mock('../../../services/pdfTools', () => ({
  repairPdf: vi.fn(),
}))

describe('PdfRepairModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tidak me-render apapun ketika isOpen=false', () => {
    const { container } = render(
      <PdfRepairModal isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('merender dialog modal dan menutup saat tombol ESC atau tombol close ditekan', () => {
    const onClose = vi.fn()
    render(<PdfRepairModal isOpen={true} onClose={onClose} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Repair PDF')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    const btnClose = screen.getByTestId('btn-close-pdf-repair')
    fireEvent.click(btnClose)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('menolak berkas non-PDF atau melebihi 25 MB', () => {
    render(<PdfRepairModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-repair-file')

    // Non-PDF
    const invalidFile = new File(['data'], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    fireEvent.change(input, { target: { files: [invalidFile] } })
    expect(screen.getByText(/Hanya berkas dokumen PDF/i)).toBeInTheDocument()

    // > 25 MB
    const bigFile = new File(['big'], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(bigFile, 'size', { value: 30 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [bigFile] } })
    expect(screen.getByText(/melebihi batas maksimal 25 MB/i)).toBeInTheDocument()
  })

  it('menerima berkas valid dan dapat mengganti berkas', () => {
    render(<PdfRepairModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-repair-file')
    const validFile = new File(['%PDF-corrupt'], 'rusak.pdf', { type: 'application/pdf' })

    fireEvent.change(input, { target: { files: [validFile] } })

    expect(screen.getByText('rusak.pdf')).toBeInTheDocument()
    expect(screen.getByTestId('btn-change-repair-file')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-change-repair-file'))
    expect(screen.getByTestId('input-repair-file')).toBeInTheDocument()
  })

  it('menjalankan proses perbaikan dan menampilkan hasil sukses', async () => {
    vi.mocked(pdfToolsService.repairPdf).mockResolvedValueOnce({
      success: true,
      filename: 'rusak_repaired.pdf',
      recoveredPages: 5,
      originalSize: 12000,
      outputSize: 11000,
      blob: new Blob(['repaired'], { type: 'application/pdf' }),
    })

    render(<PdfRepairModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-repair-file')
    const validFile = new File(['%PDF-corrupt'], 'rusak.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [validFile] } })

    const btnSubmit = screen.getByTestId('btn-submit-repair')
    expect(btnSubmit).not.toBeDisabled()

    fireEvent.click(btnSubmit)

    await waitFor(() => {
      expect(pdfToolsService.repairPdf).toHaveBeenCalledWith(validFile)
    })

    expect(await screen.findByTestId('alert-success-repair')).toBeInTheDocument()
    expect(screen.getByText(/Halaman terselamatkan: 5 halaman/i)).toBeInTheDocument()
  })

  it('menampilkan pesan galat jika perbaikan gagal', async () => {
    vi.mocked(pdfToolsService.repairPdf).mockResolvedValueOnce({
      success: false,
      message: 'Berkas PDF rusak parah dan tidak dapat dipulihkan.',
    })

    render(<PdfRepairModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-repair-file')
    const validFile = new File(['%PDF-fatal'], 'fatal.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [validFile] } })

    fireEvent.click(screen.getByTestId('btn-submit-repair'))

    expect(await screen.findByTestId('alert-error-repair')).toHaveTextContent(
      'Berkas PDF rusak parah dan tidak dapat dipulihkan.'
    )
  })
})
