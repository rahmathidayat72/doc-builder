import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  PdfSignModal,
  parseTargetPages,
  renderCursiveTextToDataUrl,
} from '../PdfSignModal'
import * as pdfToolsService from '../../../services/pdfTools'

vi.mock('../../../services/pdfTools', () => ({
  getPdfEditorPages: vi.fn(),
  applyPdfEditor: vi.fn(),
}))

describe('PdfSignModal Component & Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('parseTargetPages Helper', () => {
    it('mengembalikan halaman aktif pada targetMode=current', () => {
      expect(parseTargetPages('current', '', 2, 5)).toEqual([2])
    })

    it('mengembalikan semua halaman pada targetMode=all', () => {
      expect(parseTargetPages('all', '', 0, 3)).toEqual([0, 1, 2])
    })

    it('mengurai rentang halaman koma dan dash secara valid', () => {
      expect(parseTargetPages('range', '1-3, 5', 0, 5)).toEqual([0, 1, 2, 4])
    })

    it('menangani batas di luar jangkauan (clamping) dengan aman', () => {
      expect(parseTargetPages('range', '0-10, 99', 1, 4)).toEqual([0, 1, 2, 3])
    })

    it('fallback ke halaman aktif jika rentang kosong atau tidak valid', () => {
      expect(parseTargetPages('range', 'abc, xyz', 2, 5)).toEqual([2])
    })
  })

  describe('renderCursiveTextToDataUrl Helper', () => {
    it('menghasilkan string data URL yang valid', () => {
      const res = renderCursiveTextToDataUrl('Budi Santoso', false)
      expect(res.startsWith('data:image/png;base64,')).toBe(true)

      const initRes = renderCursiveTextToDataUrl('BS', true)
      expect(initRes.startsWith('data:image/png;base64,')).toBe(true)
    })
  })

  describe('Modal Lifecycle & Rendering', () => {
    it('tidak me-render apapun ketika isOpen=false', () => {
      const { container } = render(<PdfSignModal isOpen={false} onClose={vi.fn()} />)
      expect(container.firstChild).toBeNull()
    })

    it('merender judul, disclaimer edukatif, dan dropzone saat modal dibuka', () => {
      render(<PdfSignModal isOpen={true} onClose={vi.fn()} />)

      expect(screen.getByText('Sign PDF Visual')).toBeInTheDocument()
      expect(screen.getByText(/Catatan Keabsahan:/i)).toBeInTheDocument()
      expect(screen.getByText(/Pilih berkas PDF yang ingin ditandatangani/i)).toBeInTheDocument()
      expect(screen.getByTestId('btn-close-pdf-sign')).toBeInTheDocument()
    })

    it('memanggil onClose saat tombol tutup diklik', () => {
      const onClose = vi.fn()
      render(<PdfSignModal isOpen={true} onClose={onClose} />)

      fireEvent.click(screen.getByTestId('btn-close-pdf-sign'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Workflow Penandatanganan Dokumen', () => {
    const setupLoadedModal = async () => {
      vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
        success: true,
        filename: 'perjanjian.pdf',
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

      const utils = render(<PdfSignModal isOpen={true} onClose={vi.fn()} />)
      const fileInput = screen.getByTestId('input-pdf-sign-file')
      const testFile = new File(['%PDF-1.4 sample'], 'perjanjian.pdf', { type: 'application/pdf' })
      fireEvent.change(fileInput, { target: { files: [testFile] } })

      // Tunggu dialog pemilih penandatangan muncul, lalu pilih 'Hanya saya'
      await waitFor(() => {
        expect(screen.getByTestId('btn-choose-only-me')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('btn-choose-only-me'))

      await waitFor(() => {
        expect(screen.getByText(/Halaman 1 dari 2/i)).toBeInTheDocument()
        expect(screen.getByTestId('thumb-sign-page-0')).toBeInTheDocument()
        expect(screen.getByTestId('thumb-sign-page-1')).toBeInTheDocument()
      })

      return { ...utils, testFile }
    }

    it('membuat tanda tangan via ketik nama dan memasang ke halaman aktif', async () => {
      await setupLoadedModal()

      // Beralih ke mode ketik nama kursif
      fireEvent.click(screen.getByTestId('btn-sig-mode-type'))
      const typedInput = screen.getByTestId('input-sig-typed-name')
      fireEvent.change(typedInput, { target: { value: 'Kartini Pertiwi' } })

      // Pasang tanda tangan
      fireEvent.click(screen.getByTestId('btn-add-sig-typed-to-page'))

      // Elemen overlay muncul di panggung
      await waitFor(() => {
        expect(screen.getByText(/Elemen berhasil ditambahkan ke 1 halaman/i)).toBeInTheDocument()
      })

      const stage = screen.getByTestId('sign-active-stage')
      expect(stage).toBeInTheDocument()
      const overlayImg = screen.getByAltText('Tanda Tangan')
      expect(overlayImg).toBeInTheDocument()
    })

    it('membuat paraf dan memasang ke rentang halaman', async () => {
      await setupLoadedModal()

      // Pilih tab Paraf
      fireEvent.click(screen.getByTestId('tab-asset-initial'))

      // Pilih target rentang
      const targetSelect = screen.getByTestId('select-target-mode')
      fireEvent.change(targetSelect, { target: { value: 'range' } })

      const rangeInput = screen.getByTestId('input-target-range')
      fireEvent.change(rangeInput, { target: { value: '1, 2' } })

      // Beralih ke ketik inisial
      fireEvent.click(screen.getByTestId('btn-init-mode-type'))
      const initInput = screen.getByTestId('input-init-typed-text')
      fireEvent.change(initInput, { target: { value: 'KP' } })

      fireEvent.click(screen.getByTestId('btn-add-init-typed-to-page'))

      await waitFor(() => {
        expect(screen.getByText(/Elemen berhasil ditambahkan ke 2 halaman/i)).toBeInTheDocument()
      })
    })

    it('memasang nama terang dan tanggal penandatanganan', async () => {
      await setupLoadedModal()

      // Beralih ke tab Nama & Tanggal
      fireEvent.click(screen.getByTestId('tab-asset-text'))

      const nameInput = screen.getByTestId('input-signer-name')
      fireEvent.change(nameInput, { target: { value: 'Ir. Ahmad Dani' } })
      fireEvent.click(screen.getByTestId('btn-add-name-to-page'))

      await waitFor(() => {
        expect(screen.getByText('Ir. Ahmad Dani')).toBeInTheDocument()
      })

      const dateInput = screen.getByTestId('input-signer-date')
      fireEvent.change(dateInput, { target: { value: '2026-10-22' } })
      fireEvent.click(screen.getByTestId('btn-add-date-to-page'))

      await waitFor(() => {
        expect(screen.getByText('2026-10-22')).toBeInTheDocument()
      })
    })

    it('dapat memilih overlay, menggeser via keyboard, dan menghapusnya', async () => {
      await setupLoadedModal()

      // Pasang nama
      fireEvent.click(screen.getByTestId('tab-asset-text'))
      const nameInput = screen.getByTestId('input-signer-name')
      fireEvent.change(nameInput, { target: { value: 'Testing Move' } })
      fireEvent.click(screen.getByTestId('btn-add-name-to-page'))

      const textElem = await screen.findByText('Testing Move')
      const overlayBox = textElem.parentElement!

      // Klik untuk fokus dan mengaktifkan inspector
      fireEvent.click(overlayBox)
      expect(screen.getByText('Nama: Testing Move')).toBeInTheDocument()

      // Geser via keyboard ArrowRight
      fireEvent.keyDown(overlayBox, { key: 'ArrowRight' })
      fireEvent.keyDown(overlayBox, { key: 'ArrowDown' })

      // Resize via keyboard Shift+ArrowRight
      fireEvent.keyDown(overlayBox, { key: 'ArrowRight', shiftKey: true })

      // Hapus via keyboard Delete
      fireEvent.keyDown(overlayBox, { key: 'Delete' })
      expect(screen.queryByText('Testing Move')).toBeNull()
    })

    it('dapat menghapus overlay melalui tombol silang', async () => {
      await setupLoadedModal()

      fireEvent.click(screen.getByTestId('tab-asset-text'))
      const nameInput = screen.getByTestId('input-signer-name')
      fireEvent.change(nameInput, { target: { value: 'Bakal Dihapus' } })
      fireEvent.click(screen.getByTestId('btn-add-name-to-page'))

      expect(await screen.findByText('Bakal Dihapus')).toBeInTheDocument()
      const removeBtn = screen.getByLabelText(/Hapus Nama: Bakal Dihapus/i)
      fireEvent.click(removeBtn)

      expect(screen.queryByText('Bakal Dihapus')).toBeNull()
    })

    it('memanggil applyPdfEditor dengan output_mode signed dan mengunduh berkas', async () => {
      const { testFile } = await setupLoadedModal()

      vi.mocked(pdfToolsService.applyPdfEditor).mockResolvedValueOnce({
        success: true,
        filename: 'perjanjian_signed.pdf',
      })

      // Pasang satu tanda tangan
      fireEvent.click(screen.getByTestId('btn-sig-mode-type'))
      const typedInput = screen.getByTestId('input-sig-typed-name')
      fireEvent.change(typedInput, { target: { value: 'Signer One' } })
      fireEvent.click(screen.getByTestId('btn-add-sig-typed-to-page'))

      const applyBtn = screen.getByTestId('btn-apply-sign')
      fireEvent.click(applyBtn)

      await waitFor(() => {
        expect(pdfToolsService.applyPdfEditor).toHaveBeenCalledWith(
          testFile,
          expect.objectContaining({ pages: expect.any(Array) }),
          'signed'
        )
        expect(screen.getByText(/perjanjian_signed\.pdf/i)).toBeInTheDocument()
      })
    })

    it('menampilkan pesan galat bila ekstraksi halaman gagal', async () => {
      vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
        success: false,
        message: 'Berkas PDF terenkripsi password tidak didukung.',
      })

      render(<PdfSignModal isOpen={true} onClose={vi.fn()} />)
      const fileInput = screen.getByTestId('input-pdf-sign-file')
      fireEvent.change(fileInput, { target: { files: [new File(['bad'], 'enc.pdf', { type: 'application/pdf' })] } })

      await waitFor(() => {
        expect(screen.getByText('Berkas PDF terenkripsi password tidak didukung.')).toBeInTheDocument()
      })
    })

    it('menampilkan dialog pemilih penandatangan (Who will sign this document?) setelah berkas diunggah', async () => {
      vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
        success: true,
        filename: 'kontrak_sewa.pdf',
        total_pages: 3,
        pages: [
          { page_number: 1, original_index: 0, width: 595, height: 842, rotation: 0, thumbnail: 'data:image/jpeg;base64,t1' },
          { page_number: 2, original_index: 1, width: 595, height: 842, rotation: 0, thumbnail: 'data:image/jpeg;base64,t2' },
          { page_number: 3, original_index: 2, width: 595, height: 842, rotation: 0, thumbnail: 'data:image/jpeg;base64,t3' },
        ],
      })

      render(<PdfSignModal isOpen={true} onClose={vi.fn()} />)
      const fileInput = screen.getByTestId('input-pdf-sign-file')
      const testFile = new File(['%PDF sample content'], 'kontrak_sewa.pdf', { type: 'application/pdf' })
      fireEvent.change(fileInput, { target: { files: [testFile] } })

      // Verifikasi dialog pemilih penandatangan
      await waitFor(() => {
        expect(screen.getByText('Siapa yang akan menandatangani dokumen ini?')).toBeInTheDocument()
        expect(screen.getByText(/Only me/i)).toBeInTheDocument()
        expect(screen.getByText(/Several people/i)).toBeInTheDocument()
        expect(screen.getByTestId('btn-choose-only-me')).toBeInTheDocument()
        expect(screen.getByTestId('btn-choose-several')).toBeInTheDocument()
        expect(screen.getByText('kontrak_sewa.pdf')).toBeInTheDocument()
        expect(screen.getByText(/3 Halaman/i)).toBeInTheDocument()
      })

      // Bisa membatalkan/ganti berkas dari chooser
      fireEvent.click(screen.getByTestId('btn-chooser-change-file'))
      expect(screen.queryByText('Siapa yang akan menandatangani dokumen ini?')).toBeNull()
      expect(screen.getByText(/Pilih berkas PDF yang ingin ditandatangani/i)).toBeInTheDocument()
    })

    it('memilih mode Beberapa orang dan mengelola penandatangan multi-signer', async () => {
      vi.mocked(pdfToolsService.getPdfEditorPages).mockResolvedValueOnce({
        success: true,
        filename: 'perjanjian_bersama.pdf',
        total_pages: 2,
        pages: [
          { page_number: 1, original_index: 0, width: 595, height: 842, rotation: 0, thumbnail: 'data:image/jpeg;base64,t1' },
          { page_number: 2, original_index: 1, width: 595, height: 842, rotation: 0, thumbnail: 'data:image/jpeg;base64,t2' },
        ],
      })

      render(<PdfSignModal isOpen={true} onClose={vi.fn()} />)
      const fileInput = screen.getByTestId('input-pdf-sign-file')
      fireEvent.change(fileInput, { target: { files: [new File(['pdf'], 'perjanjian_bersama.pdf', { type: 'application/pdf' })] } })

      // Pilih 'Beberapa orang'
      await waitFor(() => {
        expect(screen.getByTestId('btn-choose-several')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('btn-choose-several'))

      // Masuk ke studio dalam mode multi-signer
      await waitFor(() => {
        expect(screen.getByTestId('badge-signing-mode')).toHaveTextContent(/Beberapa orang \(2 Pihak\)/i)
        expect(screen.getByTestId('btn-select-signer-signer-1')).toBeInTheDocument()
        expect(screen.getByTestId('btn-select-signer-signer-2')).toBeInTheDocument()
      })

      // Beralih ke pihak 2
      fireEvent.click(screen.getByTestId('btn-select-signer-signer-2'))

      // Kelola pihak: ubah nama dan tambah pihak ke-3
      fireEvent.click(screen.getByTestId('btn-toggle-manage-signers'))
      expect(screen.getByTestId('panel-manage-signers')).toBeInTheDocument()

      const inputPihak2 = screen.getByTestId('input-signer-name-signer-2')
      fireEvent.change(inputPihak2, { target: { value: 'Pihak Kedua (Vendor)' } })

      // Tambah pihak ke-3
      fireEvent.click(screen.getByTestId('btn-add-signer'))
      expect(screen.getAllByText('Pihak 3').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByTestId('badge-signing-mode')).toHaveTextContent(/Beberapa orang \(3 Pihak\)/i)

      // Bubuhkan tanda tangan untuk Pihak 2 yang aktif
      fireEvent.click(screen.getByTestId('btn-select-signer-signer-2'))
      fireEvent.click(screen.getByTestId('btn-sig-mode-type'))
      const typedInput = screen.getByTestId('input-sig-typed-name')
      fireEvent.change(typedInput, { target: { value: 'Direktur Vendor' } })
      fireEvent.click(screen.getByTestId('btn-add-sig-typed-to-page'))

      // Verifikasi overlay memiliki badge penandatangan Pihak Kedua (Vendor)
      await waitFor(() => {
        expect(screen.getByText(/Elemen berhasil ditambahkan ke 1 halaman/i)).toBeInTheDocument()
      })
      expect(screen.getAllByText('Pihak Kedua (Vendor)').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByTestId(/^badge-signer-ovl-/)).toHaveTextContent('Pihak Kedua (Vendor)')
    })

    it('dapat kembali ke dialog pemilih penandatangan via tombol ganti mode di header', async () => {
      await setupLoadedModal()

      // Di studio, klik tombol 'Ganti Mode'
      const switchModeBtn = screen.getByTestId('btn-switch-signing-mode')
      expect(switchModeBtn).toBeInTheDocument()
      fireEvent.click(switchModeBtn)

      // Dialog pemilih muncul kembali
      expect(screen.getByText('Siapa yang akan menandatangani dokumen ini?')).toBeInTheDocument()

      // Klik 'Buka Studio' untuk kembali tanpa mengubah mode
      fireEvent.click(screen.getByTestId('btn-chooser-back-studio'))
      expect(screen.getByTestId('sign-active-stage')).toBeInTheDocument()

      // Buka lagi pemilih dan ganti ke 'Beberapa orang'
      fireEvent.click(screen.getByTestId('btn-switch-signing-mode'))
      fireEvent.click(screen.getByTestId('btn-choose-several'))

      expect(screen.getByTestId('badge-signing-mode')).toHaveTextContent(/Beberapa orang/i)
    })
  })
})
