import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { PhotoProfileMakerModal } from '../PhotoProfileMakerModal'
import * as imageToolsService from '../../../services/imageTools'

vi.mock('../../../services/imageTools', () => ({
  removeBackground: vi.fn(),
  downloadImageBlob: vi.fn(),
}))

describe('PhotoProfileMakerModal Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-image-url')
    window.URL.revokeObjectURL = vi.fn()
  })

  it('tidak me-render apapun saat isOpen=false', () => {
    const { container } = render(
      <PhotoProfileMakerModal isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('merender dialog modal, dropzone, dan panduan saat dibuka', () => {
    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Photo Profile Maker')).toBeInTheDocument()
    expect(screen.getByText(/Pilih atau Tarik Foto ke Sini/i)).toBeInTheDocument()
    expect(screen.getByTestId('file-input-profile-maker')).toBeInTheDocument()
    expect(screen.getByTestId('btn-close-profile-maker')).toBeInTheDocument()
  })

  it('memanggil onClose saat tombol tutup atau Escape ditekan', () => {
    const onClose = vi.fn()
    render(<PhotoProfileMakerModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('btn-close-profile-maker'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('menolak berkas yang melebihi batas 10 MB', async () => {
    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    const largeFile = new File(['x'.repeat(100)], 'huge.png', { type: 'image/png' })
    Object.defineProperty(largeFile, 'size', { value: 12 * 1024 * 1024 })

    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Ukuran berkas melebihi batas 10 MB/i)).toBeInTheDocument()
    expect(imageToolsService.removeBackground).not.toHaveBeenCalled()
  })

  it('masuk ke mode meja kerja Foto Asli secara instan tanpa panggilan AI backend', async () => {
    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    const validFile = new File(['dummy-bytes'], 'avatar.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
      expect(screen.getByTestId('avatar-subject-image')).toBeInTheDocument()
      expect(screen.getByTestId('btn-download-profile')).toBeInTheDocument()
    })

    // Pastikan tidak ada panggilan API AI saat mode foto asli
    expect(imageToolsService.removeBackground).not.toHaveBeenCalled()
    expect(screen.getByTestId('btn-mode-original')).toHaveClass('bg-teal-50')
  })

  it('dapat mengubah bentuk avatar antara Lingkaran dan Persegi', async () => {
    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'foto.png', { type: 'image/png' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
    })

    const canvas = screen.getByTestId('avatar-preview-canvas')
    // Default: lingkaran
    expect(canvas).toHaveClass('rounded-full')

    // Ubah ke persegi
    fireEvent.click(screen.getByTestId('btn-shape-square'))
    expect(canvas).toHaveClass('rounded-2xl')

    // Kembalikan ke lingkaran
    fireEvent.click(screen.getByTestId('btn-shape-circle'))
    expect(canvas).toHaveClass('rounded-full')
  })

  it('dapat mengubah tingkat zoom dan posisi nudge serta reset posisi', async () => {
    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'foto.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
    })

    const zoomSlider = screen.getByTestId('input-zoom-slider')
    fireEvent.change(zoomSlider, { target: { value: '150' } })

    expect(screen.getByTestId('zoom-level-display')).toHaveTextContent('150%')

    // Geser posisi dengan tombol nudge
    fireEvent.click(screen.getByLabelText('Geser ke kanan'))
    fireEvent.click(screen.getByLabelText('Geser ke bawah'))

    const subject = screen.getByTestId('avatar-subject-image')
    expect(subject.style.transform).toContain('translate(10px, 10px)')

    // Reset posisi ke tengah
    fireEvent.click(screen.getByTestId('btn-reset-position'))
    expect(screen.getByTestId('zoom-level-display')).toHaveTextContent('100%')
    expect(subject.style.transform).toContain('translate(0px, 0px)')
  })

  it('dapat melakukan zoom out di bawah 100%, menggunakan tombol - / +, dan preset Pas Utuh', async () => {
    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'portrait.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
    })

    const zoomSlider = screen.getByTestId('input-zoom-slider')
    const btnZoomOut = screen.getByTestId('btn-zoom-out')
    const btnZoomIn = screen.getByTestId('btn-zoom-in')
    const btnZoomFit = screen.getByTestId('btn-zoom-fit')
    const btnZoom100 = screen.getByTestId('btn-zoom-100')
    const display = screen.getByTestId('zoom-level-display')
    const subject = screen.getByTestId('avatar-subject-image')

    // 1. Zoom out ke 50% via slider
    fireEvent.change(zoomSlider, { target: { value: '50' } })
    expect(display).toHaveTextContent('50%')
    expect(subject.style.transform).toContain('scale(0.5)')

    // 2. Tombol zoom out (-) mengurangi 10%
    fireEvent.click(btnZoomOut)
    expect(display).toHaveTextContent('40%')
    expect(subject.style.transform).toContain('scale(0.4)')

    // 3. Tombol zoom in (+) menambah 10%
    fireEvent.click(btnZoomIn)
    expect(display).toHaveTextContent('50%')

    // 4. Preset Pas Utuh menyesuaikan agar objek tidak terpotong
    fireEvent.click(btnZoomFit)
    const fitVal = parseInt(display.textContent || '0', 10)
    expect(fitVal).toBeLessThanOrEqual(100)
    expect(fitVal).toBeGreaterThanOrEqual(20)

    // 5. Kembalikan ke 100% via tombol preset
    fireEvent.click(btnZoom100)
    expect(display).toHaveTextContent('100%')
    expect(subject.style.transform).toContain('scale(1)')

    // 6. Wheel scroll pada kanvas pratinjau
    const canvas = screen.getByTestId('avatar-preview-canvas')
    fireEvent.wheel(canvas, { deltaY: 100 }) // scroll down -> zoom out
    expect(display).toHaveTextContent('95%')
    fireEvent.wheel(canvas, { deltaY: -100 }) // scroll up -> zoom in
    expect(display).toHaveTextContent('100%')
  })

  it('dapat mengganti warna latar (Solid, Gradasi, Blur, Custom)', async () => {
    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'foto.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
    })

    const bgLayer = screen.getByTestId('avatar-bg-layer')

    // Pilih Forest Teal
    fireEvent.click(screen.getByTestId('btn-bg-teal'))
    expect(bgLayer.style.backgroundColor).toBe('rgb(15, 118, 110)') // #0f766e

    // Pilih Gradasi Sunset
    fireEvent.click(screen.getByTestId('btn-bg-grad-sunset'))
    expect(bgLayer.style.backgroundImage).toContain('linear-gradient')

    // Pilih Blur Latar
    fireEvent.click(screen.getByTestId('btn-bg-blur'))
    expect(screen.getByTestId('avatar-blur-bg')).toBeInTheDocument()
  })

  it('dapat mengatur ketebalan dan warna border', async () => {
    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'foto.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
    })

    const canvas = screen.getByTestId('avatar-preview-canvas')
    expect(canvas.style.border).toContain('1px solid')

    // Pilih border 8px
    fireEvent.click(screen.getByTestId('btn-border-width-medium'))
    expect(canvas.style.border).toContain('8px solid')

    // Pilih warna border Teal
    fireEvent.click(screen.getByTestId('btn-border-color-teal'))
    expect(canvas.style.border).toContain('15, 118, 110')
  })

  it('dapat memilih preset platform (LinkedIn, WhatsApp, Instagram, HD, Umum)', async () => {
    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'foto.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
    })

    const downloadBtn = screen.getByTestId('btn-download-profile')
    expect(downloadBtn).toHaveTextContent('512px')

    // Pilih LinkedIn (400px)
    fireEvent.click(screen.getByTestId('btn-preset-linkedin'))
    expect(downloadBtn).toHaveTextContent('400px')

    // Pilih Instagram (1080px)
    fireEvent.click(screen.getByTestId('btn-preset-instagram'))
    expect(downloadBtn).toHaveTextContent('1080px')

    // Pilih WhatsApp (500px)
    fireEvent.click(screen.getByTestId('btn-preset-whatsapp'))
    expect(downloadBtn).toHaveTextContent('500px')
  })

  it('memanggil AI segmentasi U2NetP saat memilih mode Hapus Latar Belakang', async () => {
    const fakeBlob = new Blob(['mock-png-bytes'], { type: 'image/png' })
    vi.mocked(imageToolsService.removeBackground).mockResolvedValueOnce({
      success: true,
      blob: fakeBlob,
      filename: 'avatar_nobg.png',
    })

    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    const validFile = new File(['raw-bytes'], 'portrait.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [validFile] } })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
    })

    // Klik tombol Hapus Latar Belakang
    fireEvent.click(screen.getByTestId('btn-mode-nobg'))

    await waitFor(() => {
      expect(imageToolsService.removeBackground).toHaveBeenCalledWith(validFile)
      expect(screen.getByTestId('btn-mode-nobg')).toHaveClass('bg-teal-50')
      // Memastikan mode pas utuh (object-contain) otomatis aktif tanpa terpotong
      expect(screen.getByTestId('avatar-subject-image')).toHaveClass('object-contain')
      expect(screen.getByTestId('btn-fit-contain')).toHaveClass('border-teal-800')
    })
  })

  it('dapat mengubah mode pemotongan objek antara Pas Utuh dan Isi Penuh', async () => {
    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'portrait.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
    })

    const subject = screen.getByTestId('avatar-subject-image')
    const btnContain = screen.getByTestId('btn-fit-contain')
    const btnCover = screen.getByTestId('btn-fit-cover')

    // Awal: Default Pas Utuh (contain) - langsung utuh tanpa terpotong (lingkaran: 32px safe headroom)
    expect(subject).toHaveClass('object-contain')
    expect(btnContain).toHaveClass('border-teal-800')
    expect(subject.style.padding).toBe('32px')

    // Beralih ke Isi Penuh (cover)
    fireEvent.click(btnCover)
    expect(subject).toHaveClass('object-cover')
    expect(btnCover).toHaveClass('border-teal-800')
    expect(subject.style.padding).toBe('0px')

    // Kembalikan ke Pas Utuh (contain)
    fireEvent.click(btnContain)
    expect(subject).toHaveClass('object-contain')
    expect(btnContain).toHaveClass('border-teal-800')
    expect(subject.style.padding).toBe('32px')

    // Ubah bentuk ke persegi (12px safe headroom)
    fireEvent.click(screen.getByTestId('btn-shape-square'))
    expect(subject.style.padding).toBe('12px')

    // Kembalikan ke lingkaran
    fireEvent.click(screen.getByTestId('btn-shape-circle'))
    expect(subject.style.padding).toBe('32px')
  })

  it('menangani kesalahan saat pemanggilan AI segmentasi gagal', async () => {
    vi.mocked(imageToolsService.removeBackground).mockResolvedValueOnce({
      success: false,
      message: 'Server sedang memproses gambar lain. Antrean penuh.',
    })

    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'portrait.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('btn-mode-nobg'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Antrean penuh/i)).toBeInTheDocument()
    })
  })

  it('mengomposisikan avatar dan mengunduh via Canvas (PNG dan JPG)', async () => {
    const mockCtx = {
      fillStyle: '',
      lineWidth: 0,
      strokeStyle: '',
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
    }

    const mockToBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(new Blob(['canvas-profile-bytes'], { type: 'image/png' }))
    })

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(mockToBlob)

    const originalImage = window.Image
    class MockImage {
      onload: (() => void) | null = null
      crossOrigin: string = ''
      width: number = 600
      height: number = 600
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }
    }
    // @ts-expect-error mock window.Image
    window.Image = MockImage

    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'my_pic.jpg', { type: 'image/jpeg' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
    })

    // Pilih preset LinkedIn (400px), border 8px, format JPG
    fireEvent.click(screen.getByTestId('btn-preset-linkedin'))
    fireEvent.click(screen.getByTestId('btn-border-width-medium'))
    fireEvent.click(screen.getByTestId('btn-format-jpeg'))

    // Klik Unduh Avatar
    fireEvent.click(screen.getByTestId('btn-download-profile'))

    await waitFor(() => {
      expect(imageToolsService.downloadImageBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'my_pic_profile_circle_400x400.jpg'
      )
    })

    window.Image = originalImage
  })

  it('tombol "Ganti Foto" mengembalikan ke dropzone awal', async () => {
    render(<PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-profile-maker')
    fireEvent.change(fileInput, {
      target: { files: [new File(['dummy'], 'test.png', { type: 'image/png' })] },
    })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-preview-canvas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Ganti Foto/i }))

    expect(screen.getByText(/Pilih atau Tarik Foto ke Sini/i)).toBeInTheDocument()
    expect(screen.queryByTestId('avatar-preview-canvas')).not.toBeInTheDocument()
  })

  it('bebas dari pelanggaran aksesibilitas WCAG (axe)', async () => {
    const { container } = render(
      <PhotoProfileMakerModal isOpen={true} onClose={vi.fn()} />
    )
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
