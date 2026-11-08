import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { RemoveBackgroundModal } from '../RemoveBackgroundModal'
import * as imageToolsService from '../../../services/imageTools'

vi.mock('../../../services/imageTools', () => ({
  removeBackground: vi.fn(),
  downloadImageBlob: vi.fn(),
}))

describe('RemoveBackgroundModal Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-image-url')
    window.URL.revokeObjectURL = vi.fn()
  })

  it('tidak me-render apapun saat isOpen=false', () => {
    const { container } = render(<RemoveBackgroundModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('merender dialog modal, dropzone, dan panduan saat dibuka', () => {
    render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Hapus Latar Belakang Foto')).toBeInTheDocument()
    expect(screen.getByText(/Pilih atau Tarik Foto ke Sini/i)).toBeInTheDocument()
    expect(screen.getByTestId('file-input-remove-bg')).toBeInTheDocument()
    expect(screen.getByTestId('btn-close-remove-bg')).toBeInTheDocument()
  })

  it('memanggil onClose saat tombol tutup atau Escape ditekan', () => {
    const onClose = vi.fn()
    render(<RemoveBackgroundModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('btn-close-remove-bg'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('menolak berkas yang melebihi batas 10 MB', async () => {
    render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-remove-bg')
    const largeFile = new File(['a'.repeat(100)], 'large_photo.png', { type: 'image/png' })
    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 })

    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Ukuran berkas melebihi batas 10 MB/i)).toBeInTheDocument()
    expect(imageToolsService.removeBackground).not.toHaveBeenCalled()
  })

  it('menampilkan loading state lalu pratinjau hasil transparan saat inferensi sukses', async () => {
    const fakeBlob = new Blob(['mock-png-bytes'], { type: 'image/png' })
    vi.mocked(imageToolsService.removeBackground).mockResolvedValueOnce({
      success: true,
      blob: fakeBlob,
      filename: 'foto_profil_nobg.png',
      originalSize: 850 * 1024,
      processedSize: 320 * 1024,
      inferenceTimeMs: 1420,
    })

    render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-remove-bg')
    const validFile = new File(['mock-raw-image'], 'pasfoto.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(imageToolsService.removeBackground).toHaveBeenCalledWith(validFile)
    })

    await waitFor(() => {
      expect(screen.getByTestId('result-preview-image')).toBeInTheDocument()
      expect(screen.getByTestId('btn-download-nobg')).toBeInTheDocument()
      expect(screen.getByText(/Selesai diproses/i)).toBeInTheDocument()
      expect(screen.getByText(/Ukuran Asli: 850.0 KB/i)).toBeInTheDocument()
      expect(screen.getByText(/Hasil: 320.0 KB/i)).toBeInTheDocument()
    })
  })

  it('mengganti latar belakang warna preset (merah pasfoto, biru, putih) dan mengunduh', async () => {
    const fakeBlob = new Blob(['mock-png-bytes'], { type: 'image/png' })
    vi.mocked(imageToolsService.removeBackground).mockResolvedValueOnce({
      success: true,
      blob: fakeBlob,
      filename: 'foto_profil_nobg.png',
      originalSize: 500 * 1024,
      processedSize: 200 * 1024,
      inferenceTimeMs: 1200,
    })

    render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-remove-bg')
    const validFile = new File(['dummy'], 'foto.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.getByTestId('result-preview-image')).toBeInTheDocument()
    })

    // Pilih warna latar merah pasfoto
    const redBtn = screen.getByTestId('preset-color-red')
    fireEvent.click(redBtn)

    const bgLayer = screen.getByTestId('preview-bg-layer')
    expect(bgLayer.style.backgroundColor).toBe('rgb(211, 47, 47)') // #D32F2F

    // Pilih warna biru pasfoto
    const blueBtn = screen.getByTestId('preset-color-blue')
    fireEvent.click(blueBtn)
    expect(bgLayer.style.backgroundColor).toBe('rgb(25, 118, 210)') // #1976D2

    // Kembali ke transparan
    const transBtn = screen.getByTestId('preset-color-transparent')
    fireEvent.click(transBtn)
    expect(bgLayer.style.backgroundColor).toBe('transparent')

    // Klik unduh transparan
    const downloadBtn = screen.getByTestId('btn-download-nobg')
    fireEvent.click(downloadBtn)

    expect(imageToolsService.downloadImageBlob).toHaveBeenCalledWith(
      fakeBlob,
      'foto_nobg.png'
    )
  })

  it('menangani kesalahan antrean penuh (HTTP 429)', async () => {
    vi.mocked(imageToolsService.removeBackground).mockResolvedValueOnce({
      success: false,
      message:
        'Server sedang memproses gambar lain. Antrean penuh, silakan coba kembali dalam 30 detik.',
    })

    render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-remove-bg')
    const validFile = new File(['dummy'], 'foto.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Antrean penuh, silakan coba kembali dalam 30 detik/i)).toBeInTheDocument()
    })
  })

  it('tombol "Ganti Foto Lain" mengembalikan modal ke dropzone awal', async () => {
    const fakeBlob = new Blob(['mock-png-bytes'], { type: 'image/png' })
    vi.mocked(imageToolsService.removeBackground).mockResolvedValueOnce({
      success: true,
      blob: fakeBlob,
      filename: 'foto_profil_nobg.png',
    })

    render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-remove-bg')
    fireEvent.change(fileInput, { target: { files: [new File([''], 'foto.png')] } })

    await waitFor(() => {
      expect(screen.getByTestId('result-preview-image')).toBeInTheDocument()
    })

    const resetBtn = screen.getByRole('button', { name: /Ganti Foto Lain/i })
    fireEvent.click(resetBtn)

    expect(screen.getByText(/Pilih atau Tarik Foto ke Sini/i)).toBeInTheDocument()
    expect(screen.queryByTestId('result-preview-image')).not.toBeInTheDocument()
  })

  it('bebas dari pelanggaran aksesibilitas WCAG (axe)', async () => {
    const { container } = render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
