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

  it('dapat memilih opsi ukuran pasfoto (2x3, 3x4, 4x6, 1:1, Asli) dan menyesuaikan frame pratinjau', async () => {
    const fakeBlob = new Blob(['mock-png-bytes'], { type: 'image/png' })
    vi.mocked(imageToolsService.removeBackground).mockResolvedValueOnce({
      success: true,
      blob: fakeBlob,
      filename: 'foto_profil_nobg.png',
    })

    render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-remove-bg')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'foto.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('result-preview-image')).toBeInTheDocument()
    })

    const frame = screen.getByTestId('preview-frame-container')
    expect(frame.style.aspectRatio).toBe('') // Asli, tanpa rasio paksa

    // Pilih 3x4
    const btn3x4 = screen.getByTestId('preset-size-3x4')
    fireEvent.click(btn3x4)
    expect(screen.getByText('354×472 px')).toBeInTheDocument()
    expect(frame.style.aspectRatio).toBe('3 / 4')

    // Pilih 2x3
    const btn2x3 = screen.getByTestId('preset-size-2x3')
    fireEvent.click(btn2x3)
    expect(screen.getByText('236×354 px')).toBeInTheDocument()
    expect(frame.style.aspectRatio).toBe('2 / 3')

    // Pilih 4x6
    const btn4x6 = screen.getByTestId('preset-size-4x6')
    fireEvent.click(btn4x6)
    expect(screen.getByText('472×709 px')).toBeInTheDocument()
    expect(frame.style.aspectRatio).toBe('4 / 6')

    // Pilih 1:1 Persegi
    const btn1x1 = screen.getByTestId('preset-size-1x1')
    fireEvent.click(btn1x1)
    expect(screen.getByText('600×600 px')).toBeInTheDocument()
    expect(frame.style.aspectRatio).toBe('1 / 1')

    // Kembalikan ke Asli
    const btnOrig = screen.getByTestId('preset-size-original')
    fireEvent.click(btnOrig)
    expect(screen.getByText('Resolusi penuh')).toBeInTheDocument()
    expect(frame.style.aspectRatio).toBe('')
  })

  it('mengomposisikan ukuran pasfoto dan latar belakang warna saat diunduh via canvas', async () => {
    const fakeBlob = new Blob(['mock-png-bytes'], { type: 'image/png' })
    vi.mocked(imageToolsService.removeBackground).mockResolvedValueOnce({
      success: true,
      blob: fakeBlob,
      filename: 'foto_profil_nobg.png',
    })

    // Mock HTMLCanvasElement dan Image
    const mockCtx = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    }
    const mockToBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(new Blob(['canvas-blob'], { type: 'image/png' }))
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(mockToBlob)

    const originalImage = window.Image
    class MockImage {
      onload: (() => void) | null = null
      crossOrigin: string = ''
      width: number = 800
      height: number = 1000
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }
    }
    // @ts-expect-error mock window.Image
    window.Image = MockImage

    render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-remove-bg')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'ijazah.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('result-preview-image')).toBeInTheDocument()
    })

    // Pilih ukuran 3x4 dan warna merah pasfoto
    fireEvent.click(screen.getByTestId('preset-size-3x4'))
    fireEvent.click(screen.getByTestId('preset-color-red'))

    // Klik tombol unduh
    fireEvent.click(screen.getByTestId('btn-download-nobg'))

    await waitFor(() => {
      expect(imageToolsService.downloadImageBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'ijazah_3x4_red.png'
      )
    })

    window.Image = originalImage
  })

  it('dapat memilih opsi Blur Latar, mengubah intensitas slider & preset, serta pratinjau bokeh aktif', async () => {
    const fakeBlob = new Blob(['mock-png-bytes'], { type: 'image/png' })
    vi.mocked(imageToolsService.removeBackground).mockResolvedValueOnce({
      success: true,
      blob: fakeBlob,
      filename: 'foto_profil_nobg.png',
    })

    render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-remove-bg')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'portrait.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('result-preview-image')).toBeInTheDocument()
    })

    // Belum memilih blur: panel blur tidak muncul
    expect(screen.queryByTestId('blur-controls-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('preview-blur-image')).not.toBeInTheDocument()

    // Pilih opsi Blur Latar
    const blurBtn = screen.getByTestId('preset-color-blur')
    fireEvent.click(blurBtn)

    // Panel kontrol blur muncul dengan default 16 px
    expect(screen.getByTestId('blur-controls-panel')).toBeInTheDocument()
    expect(screen.getByTestId('blur-radius-display')).toHaveTextContent('16 px')

    // Citra pratinjau blur di lapisan belakang muncul dengan filter blur 16px
    const blurImg = screen.getByTestId('preview-blur-image')
    expect(blurImg).toBeInTheDocument()
    expect(blurImg.style.filter).toBe('blur(16px)')

    // Klik preset Ringan (8px)
    fireEvent.click(screen.getByTestId('btn-blur-preset-ringan'))
    expect(screen.getByTestId('blur-radius-display')).toHaveTextContent('8 px')
    expect(blurImg.style.filter).toBe('blur(8px)')

    // Klik preset Kuat (28px)
    fireEvent.click(screen.getByTestId('btn-blur-preset-kuat'))
    expect(screen.getByTestId('blur-radius-display')).toHaveTextContent('28 px')
    expect(blurImg.style.filter).toBe('blur(28px)')

    // Geser slider manual ke 32 px
    const slider = screen.getByTestId('input-blur-radius')
    fireEvent.change(slider, { target: { value: '32' } })
    expect(screen.getByTestId('blur-radius-display')).toHaveTextContent('32 px')
    expect(blurImg.style.filter).toBe('blur(32px)')

    // Selector format unduhan muncul saat blur aktif
    expect(screen.getByTestId('export-format-selector')).toBeInTheDocument()
    expect(screen.getByTestId('btn-download-nobg')).toHaveTextContent('Unduh PNG')

    // Ubah format ke JPG
    fireEvent.click(screen.getByTestId('btn-format-jpeg'))
    expect(screen.getByTestId('btn-download-nobg')).toHaveTextContent('Unduh JPEG')
  })

  it('mengomposisikan latar blur dengan subjek tajam saat diunduh via canvas', async () => {
    const fakeBlob = new Blob(['mock-png-bytes'], { type: 'image/png' })
    vi.mocked(imageToolsService.removeBackground).mockResolvedValueOnce({
      success: true,
      blob: fakeBlob,
      filename: 'foto_profil_nobg.png',
    })

    const mockCtx = {
      fillStyle: '',
      filter: 'none',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    }
    const mockToBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(new Blob(['canvas-blur-bytes'], { type: 'image/jpeg' }))
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(mockToBlob)

    const originalImage = window.Image
    class MockImage {
      onload: (() => void) | null = null
      crossOrigin: string = ''
      width: number = 800
      height: number = 1000
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }
    }
    // @ts-expect-error mock window.Image
    window.Image = MockImage

    render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-remove-bg')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'profil.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('result-preview-image')).toBeInTheDocument()
    })

    // Pilih Blur Latar dan format JPG
    fireEvent.click(screen.getByTestId('preset-color-blur'))
    fireEvent.click(screen.getByTestId('btn-format-jpeg'))

    // Klik Unduh
    fireEvent.click(screen.getByTestId('btn-download-nobg'))

    await waitFor(() => {
      expect(imageToolsService.downloadImageBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'profil_blur.jpg'
      )
    })

    window.Image = originalImage
  })

  it('bebas dari pelanggaran aksesibilitas WCAG (axe)', async () => {
    const { container } = render(<RemoveBackgroundModal isOpen={true} onClose={vi.fn()} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
