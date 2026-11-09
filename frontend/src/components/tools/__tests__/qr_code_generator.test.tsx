import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { QrCodeGeneratorModal } from '../QrCodeGeneratorModal'
import * as imageToolsService from '../../../services/imageTools'
import QRCode from 'qrcode'

vi.mock('../../../services/imageTools', () => ({
  downloadImageBlob: vi.fn(),
}))

vi.mock('qrcode', () => ({
  default: {
    toCanvas: vi.fn().mockResolvedValue(undefined),
    toString: vi.fn().mockResolvedValue('<svg>mock-qr-code</svg>'),
  },
}))

describe('QrCodeGeneratorModal Component Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tidak me-render apapun saat isOpen=false', () => {
    const { container } = render(<QrCodeGeneratorModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('merender dialog modal, tabs mode, input, dan panduan saat dibuka', () => {
    render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Generate QR Code' })).toBeInTheDocument()
    expect(screen.getByTestId('tab-mode-text')).toBeInTheDocument()
    expect(screen.getByTestId('tab-mode-url')).toBeInTheDocument()
    expect(screen.getByTestId('input-qr-text')).toBeInTheDocument()
    expect(screen.getByTestId('btn-generate-qr')).toBeInTheDocument()
    expect(screen.getByTestId('btn-close-qr-modal')).toBeInTheDocument()
    expect(screen.getByText(/Diproses 100% lokal di browser/i)).toBeInTheDocument()
  })

  it('memanggil onClose saat tombol tutup atau Escape ditekan', () => {
    const onClose = vi.fn()
    render(<QrCodeGeneratorModal isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('btn-close-qr-modal'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('menolak input kosong saat tombol Generate ditekan', async () => {
    render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('btn-generate-qr'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Konten teks atau tautan tidak boleh kosong/i)).toBeInTheDocument()
    expect(QRCode.toCanvas).not.toHaveBeenCalled()
  })

  it('menolak payload yang melebihi batas 2.000 byte', async () => {
    render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-qr-text')
    const longText = 'a'.repeat(2005)

    fireEvent.change(input, { target: { value: longText } })
    expect(screen.getByTestId('text-byte-count')).toHaveTextContent('2005 / 2000 byte')

    fireEvent.click(screen.getByTestId('btn-generate-qr'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Ukuran payload melebihi batas maksimal 2.000 byte/i)).toBeInTheDocument()
    expect(QRCode.toCanvas).not.toHaveBeenCalled()
  })

  it('menolak URL dengan skema tidak aman (javascript:, data:, file:) pada mode URL', async () => {
    render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('tab-mode-url'))
    const urlInput = screen.getByTestId('input-qr-url')

    fireEvent.change(urlInput, { target: { value: 'javascript:alert(1)' } })
    fireEvent.click(screen.getByTestId('btn-generate-qr'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText(/Hanya tautan berprotokol HTTP atau HTTPS yang diperbolehkan/i)
    ).toBeInTheDocument()
  })

  it('menolak URL yang memuat kredensial pengguna (user:pass@host)', async () => {
    render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('tab-mode-url'))
    const urlInput = screen.getByTestId('input-qr-url')

    fireEvent.change(urlInput, { target: { value: 'https://admin:secret123@example.com' } })
    fireEvent.click(screen.getByTestId('btn-generate-qr'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText(/Tautan tidak boleh memuat kredensial pengguna/i)
    ).toBeInTheDocument()
  })

  it('memblokir generate jika kontras warna tidak layak atau modul lebih terang dari latar', async () => {
    render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)

    // Putih di atas hitam (terbalik)
    const darkInput = screen.getByTestId('input-color-dark')
    const lightInput = screen.getByTestId('input-color-light')

    fireEvent.change(darkInput, { target: { value: '#FFFFFF' } })
    fireEvent.change(lightInput, { target: { value: '#000000' } })

    expect(
      screen.getByText(/Warna modul QR harus lebih gelap daripada warna latar belakang/i)
    ).toBeInTheDocument()
    expect(screen.getByTestId('btn-generate-qr')).toBeDisabled()
  })

  it('menghasilkan QR code ke kanvas saat input teks valid', async () => {
    render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-qr-text')
    fireEvent.change(input, { target: { value: 'Halo Dunia Satukit' } })

    fireEvent.click(screen.getByTestId('btn-generate-qr'))

    await waitFor(() => {
      expect(QRCode.toCanvas).toHaveBeenCalledWith(
        expect.any(HTMLCanvasElement),
        'Halo Dunia Satukit',
        expect.objectContaining({
          width: 512,
          margin: 4,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        })
      )
    })

    expect(screen.getByText(/Kode QR siap diunduh \(512 × 512 px\)/i)).toBeInTheDocument()
    expect(screen.getByTestId('btn-download-png')).not.toBeDisabled()
    expect(screen.getByTestId('btn-download-svg')).not.toBeDisabled()
  })

  it('menandai QR sebagai usang jika input diubah setelah generate', async () => {
    render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-qr-text')
    fireEvent.change(input, { target: { value: 'Versi Satu' } })
    fireEvent.click(screen.getByTestId('btn-generate-qr'))

    await waitFor(() => {
      expect(screen.getByText(/Kode QR siap diunduh/i)).toBeInTheDocument()
    })

    // Ubah teks
    fireEvent.change(input, { target: { value: 'Versi Dua' } })
    expect(screen.getByTestId('badge-qr-stale')).toBeInTheDocument()
    expect(screen.getByTestId('btn-download-png')).toBeDisabled()
    expect(screen.getByTestId('btn-download-svg')).toBeDisabled()
  })

  it('dapat mengubah ukuran resolusi (256, 512, 1024)', async () => {
    render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('btn-size-1024'))
    expect(screen.getByTestId('btn-size-1024')).toHaveClass('border-teal-800')

    const input = screen.getByTestId('input-qr-text')
    fireEvent.change(input, { target: { value: 'https://satukit.id' } })
    fireEvent.click(screen.getByTestId('btn-generate-qr'))

    await waitFor(() => {
      expect(QRCode.toCanvas).toHaveBeenCalledWith(
        expect.any(HTMLCanvasElement),
        'https://satukit.id',
        expect.objectContaining({
          width: 1024,
        })
      )
    })
  })

  it('dapat mengunduh berkas PNG dengan nama satukit-qr-code.png', async () => {
    const mockToBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(new Blob(['mock-png-bytes'], { type: 'image/png' }))
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(mockToBlob)

    render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-qr-text')
    fireEvent.change(input, { target: { value: 'Unduh Test PNG' } })
    fireEvent.click(screen.getByTestId('btn-generate-qr'))

    await waitFor(() => {
      expect(screen.getByTestId('btn-download-png')).not.toBeDisabled()
    })

    fireEvent.click(screen.getByTestId('btn-download-png'))

    expect(imageToolsService.downloadImageBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      'satukit-qr-code.png'
    )
  })

  it('dapat mengunduh berkas SVG dengan nama satukit-qr-code.svg', async () => {
    render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)

    const input = screen.getByTestId('input-qr-text')
    fireEvent.change(input, { target: { value: 'Unduh Test SVG' } })
    fireEvent.click(screen.getByTestId('btn-generate-qr'))

    await waitFor(() => {
      expect(screen.getByTestId('btn-download-svg')).not.toBeDisabled()
    })

    fireEvent.click(screen.getByTestId('btn-download-svg'))

    await waitFor(() => {
      expect(QRCode.toString).toHaveBeenCalledWith(
        'Unduh Test SVG',
        expect.objectContaining({
          type: 'svg',
          errorCorrectionLevel: 'M',
        })
      )
      expect(imageToolsService.downloadImageBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'satukit-qr-code.svg'
      )
    })
  })

  it('lolos uji aksesibilitas axe', async () => {
    const { container } = render(<QrCodeGeneratorModal isOpen={true} onClose={vi.fn()} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
