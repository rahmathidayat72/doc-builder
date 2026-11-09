import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { WebpToJpgModal } from '../WebpToJpgModal'
import * as imageToolsService from '../../../services/imageTools'

vi.mock('../../../services/imageTools', () => ({
  downloadImageBlob: vi.fn(),
}))

function createMockWebpFile(name = 'photo.webp', size = 64): File {
  const header = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x20, 0x00, 0x00, 0x00, // length
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x20, // VP8_
  ])
  const buffer = new Uint8Array(Math.max(header.length, size))
  buffer.set(header, 0)
  return new File([buffer], name, { type: 'image/webp' })
}

describe('WebpToJpgModal Component Suite', () => {
  const originalImage = window.Image

  beforeEach(() => {
    vi.clearAllMocks()
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-webp-url')
    window.URL.revokeObjectURL = vi.fn()

    class MockImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      crossOrigin = ''
      naturalWidth = 1200
      naturalHeight = 800
      width = 1200
      height = 800
      set src(val: string) {
        setTimeout(() => {
          if (val === 'blob:corrupt') {
            if (this.onerror) this.onerror()
          } else {
            if (this.onload) this.onload()
          }
        }, 0)
      }
    }
    // @ts-expect-error mock window.Image
    window.Image = MockImage
  })

  afterEach(() => {
    window.Image = originalImage
  })

  it('tidak me-render apapun saat isOpen=false', () => {
    const { container } = render(<WebpToJpgModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('merender dialog modal, dropzone, dan informasi lokal saat dibuka', () => {
    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('WebP ke JPG')).toBeInTheDocument()
    expect(screen.getByText(/Pilih atau Tarik Berkas WebP ke Sini/i)).toBeInTheDocument()
    expect(screen.getByTestId('file-input-webp')).toBeInTheDocument()
    expect(screen.getByTestId('btn-close-webp-modal')).toBeInTheDocument()
    expect(screen.getByText(/Diproses 100% lokal di browser/i)).toBeInTheDocument()
  })

  it('memanggil onClose saat tombol tutup atau tombol Escape ditekan', () => {
    const onClose = vi.fn()
    render(<WebpToJpgModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('btn-close-webp-modal'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('menolak berkas jika bukan berekstensi .webp atau type bukan image/webp', async () => {
    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    const invalidFile = new File(['dummy'], 'document.pdf', { type: 'application/pdf' })

    fireEvent.change(fileInput, { target: { files: [invalidFile] } })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText(/Hanya berkas berformat WebP \(\.webp\) yang didukung/i)
    ).toBeInTheDocument()
  })

  it('menolak berkas yang melebihi batas 25 MB', async () => {
    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    const hugeFile = createMockWebpFile('huge.webp', 100)
    Object.defineProperty(hugeFile, 'size', { value: 26 * 1024 * 1024 })

    fireEvent.change(fileInput, { target: { files: [hugeFile] } })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Ukuran berkas melebihi batas maksimal 25 MB/i)).toBeInTheDocument()
  })

  it('menolak berkas 0 byte', async () => {
    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    const emptyFile = new File([], 'empty.webp', { type: 'image/webp' })

    fireEvent.change(fileInput, { target: { files: [emptyFile] } })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Berkas kosong \(0 byte\)/i)).toBeInTheDocument()
  })

  it('menolak berkas yang tidak memiliki header magic bytes RIFF/WEBP', async () => {
    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    const fakeWebp = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])], 'fake.webp', {
      type: 'image/webp',
    })

    fireEvent.change(fileInput, { target: { files: [fakeWebp] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(
        screen.getByText(/Struktur berkas bukan WebP valid \(header RIFF\/WEBP tidak ditemukan\)/i)
      ).toBeInTheDocument()
    })
  })

  it('menolak gambar WebP dengan dimensi di atas 64 juta piksel', async () => {
    class GiantImage {
      onload: (() => void) | null = null
      crossOrigin = ''
      naturalWidth = 9000
      naturalHeight = 8000 // 72 MP
      width = 9000
      height = 8000
      set src(_val: string) {
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 0)
      }
    }
    // @ts-expect-error override
    window.Image = GiantImage

    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    const file = createMockWebpFile('giant.webp')
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(
        screen.getByText(/Dimensi gambar terlalu besar \(maksimal 64 juta piksel\)/i)
      ).toBeInTheDocument()
    })
  })

  it('menangani error ketika citra WebP rusak dan gagal dimuat oleh decoder browser', async () => {
    window.URL.createObjectURL = vi.fn(() => 'blob:corrupt')

    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    const file = createMockWebpFile('corrupt.webp')
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Gagal memproses berkas WebP/i)).toBeInTheDocument()
    })
  })

  it('memuat berkas WebP valid dan menampilkan pratinjau serta kontrol pengaturan', async () => {
    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    const file = createMockWebpFile('banner.webp', 1200)
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByTestId('img-webp-preview')).toBeInTheDocument()
      expect(screen.getByText('banner.webp')).toBeInTheDocument()
      expect(screen.getByText(/Dimensi: 1200 × 800 px/i)).toBeInTheDocument()
      expect(screen.getByTestId('btn-convert-download')).toBeInTheDocument()
      expect(screen.getByTestId('input-quality-slider')).toBeInTheDocument()
    })
  })

  it('dapat memilih warna latar preset dan kustom', async () => {
    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    fireEvent.change(fileInput, { target: { files: [createMockWebpFile()] } })

    await waitFor(() => {
      expect(screen.getByTestId('btn-bg-white')).toBeInTheDocument()
    })

    // Pilih hitam
    fireEvent.click(screen.getByTestId('btn-bg-black'))
    expect(screen.getByTestId('btn-bg-black')).toHaveClass('border-teal-800')

    // Pilih abu-abu
    fireEvent.click(screen.getByTestId('btn-bg-slate'))
    expect(screen.getByTestId('btn-bg-slate')).toHaveClass('border-teal-800')

    // Ubah warna kustom
    const customInput = screen.getByTestId('input-bg-color')
    fireEvent.change(customInput, { target: { value: '#ff5500' } })
    expect(customInput).toHaveValue('#ff5500')
  })

  it('dapat mengatur slider kualitas JPG', async () => {
    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    fireEvent.change(fileInput, { target: { files: [createMockWebpFile()] } })

    await waitFor(() => {
      expect(screen.getByTestId('input-quality-slider')).toBeInTheDocument()
    })

    const slider = screen.getByTestId('input-quality-slider')
    expect(slider).toHaveValue('92')

    fireEvent.change(slider, { target: { value: '80' } })
    expect(slider).toHaveValue('80')
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('dapat mereset pilihan berkas dan kembali ke dropzone', async () => {
    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    fireEvent.change(fileInput, { target: { files: [createMockWebpFile()] } })

    await waitFor(() => {
      expect(screen.getByTestId('btn-reset-webp')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('btn-reset-webp'))
    expect(screen.getByText(/Pilih atau Tarik Berkas WebP ke Sini/i)).toBeInTheDocument()
  })

  it('mengonversi WebP ke JPG dengan dimensi asli dan mengunduh berkas', async () => {
    const mockCtx = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    )
    const mockToBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(new Blob(['mock-jpg-bytes'], { type: 'image/jpeg' }))
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(mockToBlob)

    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    fireEvent.change(fileInput, { target: { files: [createMockWebpFile('pemandangan.webp')] } })

    await waitFor(() => {
      expect(screen.getByTestId('btn-convert-download')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('btn-convert-download'))

    await waitFor(() => {
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 1200, 800)
      expect(mockCtx.drawImage).toHaveBeenCalled()
      expect(mockToBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92)
      expect(imageToolsService.downloadImageBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'pemandangan.jpg'
      )
      expect(screen.getByText(/Gambar JPG berhasil dibuat dan diunduh/i)).toBeInTheDocument()
    })
  })

  it('menangani kegagalan canvas.toBlob dengan menampilkan pesan error', async () => {
    const mockCtx = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    )
    const mockToBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(null)
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(mockToBlob)

    render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('file-input-webp')
    fireEvent.change(fileInput, { target: { files: [createMockWebpFile()] } })

    await waitFor(() => {
      expect(screen.getByTestId('btn-convert-download')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('btn-convert-download'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/Gagal mengonversi kanvas ke berkas JPG/i)).toBeInTheDocument()
    })
  })

  it('lolos uji aksesibilitas axe', async () => {
    const { container } = render(<WebpToJpgModal isOpen={true} onClose={vi.fn()} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
