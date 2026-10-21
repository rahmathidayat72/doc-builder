import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ImageResizeModal } from '../ImageResizeModal'
import * as imageToolsService from '../../../services/imageTools'

vi.mock('../../../services/imageTools', () => ({
  resizeImage: vi.fn(),
}))

describe('ImageResizeModal Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tidak me-render ketika isOpen=false', () => {
    const { container } = render(<ImageResizeModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('merender judul dan elemen form ketika dibuka', () => {
    render(<ImageResizeModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/Resize & Kompres Gambar/i)).toBeInTheDocument()
    expect(screen.getByTestId('input-image-file')).toBeInTheDocument()
    expect(screen.getByTestId('input-target-kb')).toBeInTheDocument()
    expect(screen.getByTestId('select-output-format')).toBeInTheDocument()
    expect(screen.getByTestId('checkbox-strip-exif')).toBeInTheDocument()
    expect(screen.getByTestId('btn-submit-resize')).toBeInTheDocument()
  })

  it('memicu tombol tutup modal', () => {
    const onClose = vi.fn()
    render(<ImageResizeModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('btn-close-image-resize'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('memperbarui target KB saat preset diklik', () => {
    render(<ImageResizeModal isOpen={true} onClose={vi.fn()} />)

    const preset50 = screen.getByText('50 KB')
    fireEvent.click(preset50)

    const input = screen.getByTestId('input-target-kb') as HTMLInputElement
    expect(input.value).toBe('50')
  })

  it('mengeksekusi resize dan menampilkan hasil optimasi', async () => {
    vi.mocked(imageToolsService.resizeImage).mockResolvedValueOnce({
      success: true,
      filename: 'foto_profil_resized.jpg',
      originalSize: 500 * 1024,
      optimizedSize: 45 * 1024,
    })

    render(<ImageResizeModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('input-image-file')
    const imgFile = new File(['fake-jpg-content'], 'foto_profil.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [imgFile] } })

    const submitBtn = screen.getByTestId('btn-submit-resize')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(imageToolsService.resizeImage).toHaveBeenCalledWith(
        imgFile,
        expect.any(Number),
        'jpeg',
        true
      )
      expect(screen.getByText(/Gambar berhasil dioptimasi & diunduh!/i)).toBeInTheDocument()
      expect(screen.getByText(/Hemat 91%/i)).toBeInTheDocument()
    })
  })

  it('menampilkan pesan error jika resize gagal', async () => {
    vi.mocked(imageToolsService.resizeImage).mockResolvedValueOnce({
      success: false,
      message: 'Format gambar tidak didukung.',
    })

    render(<ImageResizeModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('input-image-file')
    const imgFile = new File(['bad'], 'bad.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [imgFile] } })

    const submitBtn = screen.getByTestId('btn-submit-resize')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(imageToolsService.resizeImage).toHaveBeenCalled()
      expect(screen.getByText('Format gambar tidak didukung.')).toBeInTheDocument()
    })
  })
})
