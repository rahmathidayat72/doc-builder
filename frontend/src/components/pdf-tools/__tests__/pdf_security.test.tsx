import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PdfSecurityModal } from '../PdfSecurityModal'
import * as pdfToolsService from '../../../services/pdfTools'

vi.mock('../../../services/pdfTools', () => ({
  protectPdf: vi.fn(),
  unlockPdf: vi.fn(),
}))

describe('PdfSecurityModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Modal Lifecycle & Tab Navigation', () => {
    it('tidak me-render apapun ketika isOpen=false', () => {
      const { container } = render(
        <PdfSecurityModal isOpen={false} onClose={vi.fn()} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('merender modal dengan tab unlock secara default', () => {
      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByTestId('tab-unlock')).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('tab-protect')).toHaveAttribute('aria-selected', 'false')
      expect(screen.getByTestId('form-unlock')).toBeInTheDocument()
      expect(screen.queryByTestId('form-protect')).not.toBeInTheDocument()
    })

    it('merender modal dengan tab protect ketika initialTab="protect"', () => {
      render(
        <PdfSecurityModal isOpen={true} onClose={vi.fn()} initialTab="protect" />
      )

      expect(screen.getByTestId('tab-protect')).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('tab-unlock')).toHaveAttribute('aria-selected', 'false')
      expect(screen.getByTestId('form-protect')).toBeInTheDocument()
    })

    it('dapat berpindah tab dengan klik tombol tab', () => {
      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} initialTab="unlock" />)

      const tabProtect = screen.getByTestId('tab-protect')
      fireEvent.click(tabProtect)

      expect(tabProtect).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('form-protect')).toBeInTheDocument()

      const tabUnlock = screen.getByTestId('tab-unlock')
      fireEvent.click(tabUnlock)

      expect(tabUnlock).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('form-unlock')).toBeInTheDocument()
    })

    it('menutup modal saat tombol ESC ditekan atau tombol close diklik', () => {
      const onClose = vi.fn()
      render(<PdfSecurityModal isOpen={true} onClose={onClose} />)

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)

      const btnClose = screen.getByTestId('btn-close-pdf-security')
      fireEvent.click(btnClose)
      expect(onClose).toHaveBeenCalledTimes(2)
    })
  })

  describe('File Selection & Validation', () => {
    it('menolak berkas non-PDF', () => {
      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} />)

      const fileInput = screen.getByTestId('input-security-file')
      const invalidFile = new File(['content'], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })

      fireEvent.change(fileInput, { target: { files: [invalidFile] } })

      expect(screen.getByText(/Hanya berkas dokumen PDF/i)).toBeInTheDocument()
    })

    it('menolak berkas yang melebihi batas 25 MB', () => {
      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} />)

      const fileInput = screen.getByTestId('input-security-file')
      const bigFile = new File(['x'], 'big.pdf', { type: 'application/pdf' })
      Object.defineProperty(bigFile, 'size', { value: 26 * 1024 * 1024 })

      fireEvent.change(fileInput, { target: { files: [bigFile] } })

      expect(screen.getByText(/melebihi batas maksimal 25 MB/i)).toBeInTheDocument()
    })

    it('menerima berkas PDF valid dan mengizinkan penggantian berkas', () => {
      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} />)

      const fileInput = screen.getByTestId('input-security-file')
      const validFile = new File(['%PDF-1.4'], 'dokumen_rahasia.pdf', { type: 'application/pdf' })

      fireEvent.change(fileInput, { target: { files: [validFile] } })

      expect(screen.getByText('dokumen_rahasia.pdf')).toBeInTheDocument()
      expect(screen.getByTestId('btn-change-file')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('btn-change-file'))
      expect(screen.getByTestId('input-security-file')).toBeInTheDocument()
    })
  })

  describe('Password Visibility Toggles', () => {
    it('mengubah tipe input password pada tab unlock', () => {
      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} initialTab="unlock" />)

      const input = screen.getByTestId('input-unlock-password')
      const toggle = screen.getByTestId('btn-toggle-unlock-password')

      expect(input).toHaveAttribute('type', 'password')
      fireEvent.click(toggle)
      expect(input).toHaveAttribute('type', 'text')
      fireEvent.click(toggle)
      expect(input).toHaveAttribute('type', 'password')
    })

    it('mengubah tipe input password baru dan konfirmasi pada tab protect', () => {
      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} initialTab="protect" />)

      const inputPw = screen.getByTestId('input-protect-password')
      const togglePw = screen.getByTestId('btn-toggle-protect-password')

      expect(inputPw).toHaveAttribute('type', 'password')
      fireEvent.click(togglePw)
      expect(inputPw).toHaveAttribute('type', 'text')

      const inputConf = screen.getByTestId('input-confirm-password')
      const toggleConf = screen.getByTestId('btn-toggle-confirm-password')

      expect(inputConf).toHaveAttribute('type', 'password')
      fireEvent.click(toggleConf)
      expect(inputConf).toHaveAttribute('type', 'text')
    })
  })

  describe('Unlock Flow Execution', () => {
    it('memanggil unlockPdf dan menampilkan pesan sukses', async () => {
      vi.mocked(pdfToolsService.unlockPdf).mockResolvedValueOnce({
        success: true,
        filename: 'laporan_unlocked.pdf',
        blob: new Blob(['pdf-unlocked'], { type: 'application/pdf' }),
      })

      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} initialTab="unlock" />)

      const fileInput = screen.getByTestId('input-security-file')
      const file = new File(['%PDF-1.4'], 'laporan.pdf', { type: 'application/pdf' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      const passwordInput = screen.getByTestId('input-unlock-password')
      fireEvent.change(passwordInput, { target: { value: 'Secret#2026' } })

      const submitBtn = screen.getByTestId('btn-submit-unlock')
      expect(submitBtn).not.toBeDisabled()

      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(pdfToolsService.unlockPdf).toHaveBeenCalledWith(file, 'Secret#2026')
      })

      expect(await screen.findByTestId('alert-success')).toHaveTextContent(
        'Berhasil membuka proteksi PDF: laporan_unlocked.pdf'
      )
    })

    it('menampilkan pesan galat saat unlock gagal', async () => {
      vi.mocked(pdfToolsService.unlockPdf).mockResolvedValueOnce({
        success: false,
        message: 'Password salah. Dokumen PDF gagal dibuka.',
      })

      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} initialTab="unlock" />)

      const fileInput = screen.getByTestId('input-security-file')
      const file = new File(['%PDF-1.4'], 'laporan.pdf', { type: 'application/pdf' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      const passwordInput = screen.getByTestId('input-unlock-password')
      fireEvent.change(passwordInput, { target: { value: 'Wrong#123' } })

      fireEvent.click(screen.getByTestId('btn-submit-unlock'))

      expect(await screen.findByTestId('alert-error')).toHaveTextContent(
        'Password salah. Dokumen PDF gagal dibuka.'
      )
    })
  })

  describe('Protect Flow Execution', () => {
    it('menonaktifkan tombol submit jika password belum memenuhi kriteria', () => {
      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} initialTab="protect" />)

      const fileInput = screen.getByTestId('input-security-file')
      const file = new File(['%PDF-1.4'], 'laporan.pdf', { type: 'application/pdf' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      const pwInput = screen.getByTestId('input-protect-password')
      const confInput = screen.getByTestId('input-confirm-password')
      const submitBtn = screen.getByTestId('btn-submit-protect')

      // Password lemah (terlalu pendek)
      fireEvent.change(pwInput, { target: { value: 'Kecil1#' } })
      fireEvent.change(confInput, { target: { value: 'Kecil1#' } })
      expect(submitBtn).toBeDisabled()

      // Password tidak ada simbol
      fireEvent.change(pwInput, { target: { value: 'KunciAman20267' } })
      fireEvent.change(confInput, { target: { value: 'KunciAman20267' } })
      expect(submitBtn).toBeDisabled()

      // Password valid tapi konfirmasi tidak cocok
      fireEvent.change(pwInput, { target: { value: 'KunciAman#2026' } })
      fireEvent.change(confInput, { target: { value: 'KunciAman#2027' } })
      expect(submitBtn).toBeDisabled()

      // Password valid dan konfirmasi cocok
      fireEvent.change(confInput, { target: { value: 'KunciAman#2026' } })
      expect(submitBtn).not.toBeDisabled()
    })

    it('memanggil protectPdf dan menampilkan pesan sukses', async () => {
      vi.mocked(pdfToolsService.protectPdf).mockResolvedValueOnce({
        success: true,
        filename: 'kontrak_protected.pdf',
        blob: new Blob(['pdf-encrypted'], { type: 'application/pdf' }),
      })

      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} initialTab="protect" />)

      const fileInput = screen.getByTestId('input-security-file')
      const file = new File(['%PDF-1.4'], 'kontrak.pdf', { type: 'application/pdf' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      const pwInput = screen.getByTestId('input-protect-password')
      const confInput = screen.getByTestId('input-confirm-password')
      fireEvent.change(pwInput, { target: { value: 'KunciAman#2026' } })
      fireEvent.change(confInput, { target: { value: 'KunciAman#2026' } })

      const submitBtn = screen.getByTestId('btn-submit-protect')
      fireEvent.click(submitBtn)

      await waitFor(() => {
        expect(pdfToolsService.protectPdf).toHaveBeenCalledWith(file, 'KunciAman#2026')
      })

      expect(await screen.findByTestId('alert-success')).toHaveTextContent(
        'Berhasil memproteksi PDF dengan enkripsi AES-256: kontrak_protected.pdf'
      )
    })

    it('menampilkan galat saat protect gagal di backend', async () => {
      vi.mocked(pdfToolsService.protectPdf).mockResolvedValueOnce({
        success: false,
        message: 'Berkas PDF sudah terenkripsi password.',
      })

      render(<PdfSecurityModal isOpen={true} onClose={vi.fn()} initialTab="protect" />)

      const fileInput = screen.getByTestId('input-security-file')
      const file = new File(['%PDF-1.4'], 'kontrak.pdf', { type: 'application/pdf' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      const pwInput = screen.getByTestId('input-protect-password')
      const confInput = screen.getByTestId('input-confirm-password')
      fireEvent.change(pwInput, { target: { value: 'KunciAman#2026' } })
      fireEvent.change(confInput, { target: { value: 'KunciAman#2026' } })

      fireEvent.click(screen.getByTestId('btn-submit-protect'))

      expect(await screen.findByTestId('alert-error')).toHaveTextContent(
        'Berkas PDF sudah terenkripsi password.'
      )
    })
  })
})
