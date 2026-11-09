import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MediaDownloaderModal } from '../MediaDownloaderModal'
import * as mediaService from '../../../services/mediaDownloader'

describe('MediaDownloaderModal Component Suite (Tool #25)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('tidak merender modal jika isOpen bernilai false', () => {
    const { container } = render(<MediaDownloaderModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('merender judul, badge platform, input URL, dan checkbox hak cipta saat isOpen true', () => {
    render(<MediaDownloaderModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Pengunduh Media Publik')).toBeInTheDocument()
    expect(screen.getByTestId('input-media-url')).toBeInTheDocument()
    expect(screen.getByTestId('btn-type-video')).toBeInTheDocument()
    expect(screen.getByTestId('btn-type-image')).toBeInTheDocument()
    expect(screen.getByTestId('checkbox-rights')).toBeInTheDocument()
    expect(screen.getByTestId('btn-submit-media')).toBeInTheDocument()
  })

  it('memvalidasi skema HTTPS dan centang hak cipta sebelum submit', async () => {
    render(<MediaDownloaderModal isOpen={true} onClose={vi.fn()} />)

    const inputUrl = screen.getByTestId('input-media-url')
    const submitBtn = screen.getByTestId('btn-submit-media')

    // URL non-HTTPS
    fireEvent.change(inputUrl, { target: { value: 'http://youtube.com/watch?v=123' } })
    const checkbox = screen.getByTestId('checkbox-rights')
    fireEvent.click(checkbox)

    fireEvent.click(submitBtn)
    expect(await screen.findByText(/Hanya skema tautan publik https:\/\/ yang diizinkan/i)).toBeInTheDocument()
  })

  it('dapat beralih antara pilihan Video dan Gambar', () => {
    render(<MediaDownloaderModal isOpen={true} onClose={vi.fn()} />)

    const btnVideo = screen.getByTestId('btn-type-video')
    const btnImage = screen.getByTestId('btn-type-image')

    expect(btnVideo).toHaveClass('border-teal-700')
    fireEvent.click(btnImage)
    expect(btnImage).toHaveClass('border-teal-700')
  })

  it('memproses pendaftaran job dan menampilkan status polling antrean/running', async () => {
    vi.spyOn(mediaService, 'createMediaDownloadJob').mockResolvedValueOnce({
      success: true,
      data: {
        job_id: 'job-12345',
        status: 'queued',
        platform: 'youtube',
        media_type: 'video',
        created_at: Date.now(),
      },
    })

    vi.spyOn(mediaService, 'getMediaDownloadStatus').mockResolvedValueOnce({
      success: true,
      data: {
        id: 'job-12345',
        platform: 'youtube',
        media_type: 'video',
        status: 'running',
        progress_percent: 15,
        filename: null,
        file_size_bytes: 0,
        error_message: null,
        error_code: null,
        created_at: Date.now(),
        completed_at: null,
        expires_at: null,
        download_url: null,
      },
    })

    render(<MediaDownloaderModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('input-media-url'), {
      target: { value: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    })
    fireEvent.click(screen.getByTestId('checkbox-rights'))
    fireEvent.click(screen.getByTestId('btn-submit-media'))

    await waitFor(() => {
      expect(screen.getByText(/Sedang Mengunduh & Memverifikasi Media/i)).toBeInTheDocument()
    })
  })

  it('menampilkan berkas siap diunduh dan memanggil fungsi download file', async () => {
    vi.spyOn(mediaService, 'createMediaDownloadJob').mockResolvedValueOnce({
      success: true,
      data: {
        job_id: 'job-999',
        status: 'queued',
        platform: 'instagram',
        media_type: 'video',
        created_at: Date.now(),
      },
    })

    vi.spyOn(mediaService, 'getMediaDownloadStatus').mockResolvedValueOnce({
      success: true,
      data: {
        id: 'job-999',
        platform: 'instagram',
        media_type: 'video',
        status: 'succeeded',
        progress_percent: 100,
        filename: 'instagram_reel.mp4',
        file_size_bytes: 5 * 1024 * 1024,
        error_message: null,
        error_code: null,
        created_at: Date.now(),
        completed_at: Date.now(),
        expires_at: Date.now() + 900,
        download_url: '/api/media-downloads/job-999/file',
      },
    })

    const downloadSpy = vi.spyOn(mediaService, 'downloadMediaFile').mockResolvedValueOnce(true)

    render(<MediaDownloaderModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('input-media-url'), {
      target: { value: 'https://www.instagram.com/reel/C4sD123efg/' },
    })
    fireEvent.click(screen.getByTestId('checkbox-rights'))
    fireEvent.click(screen.getByTestId('btn-submit-media'))

    await waitFor(() => {
      expect(screen.getByText('Media Siap Diunduh!')).toBeInTheDocument()
      expect(screen.getByText('instagram_reel.mp4')).toBeInTheDocument()
      expect(screen.getByText('5.00 MB')).toBeInTheDocument()
    })

    const downloadBtn = screen.getByTestId('btn-download-media-file')
    fireEvent.click(downloadBtn)

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith('job-999', 'instagram_reel.mp4')
      expect(screen.getByText('Berkas Telah Diunduh')).toBeInTheDocument()
    })
  })

  it('dapat membatalkan job yang sedang mengantre', async () => {
    vi.spyOn(mediaService, 'createMediaDownloadJob').mockResolvedValueOnce({
      success: true,
      data: {
        job_id: 'job-cancel-test',
        status: 'queued',
        platform: 'tiktok',
        media_type: 'video',
        created_at: Date.now(),
      },
    })

    const cancelSpy = vi.spyOn(mediaService, 'cancelMediaDownloadJob').mockResolvedValueOnce({
      success: true,
      message: 'Proses unduhan berhasil dibatalkan.',
    })

    render(<MediaDownloaderModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('input-media-url'), {
      target: { value: 'https://www.tiktok.com/@creator/video/7123456789012345678' },
    })
    fireEvent.click(screen.getByTestId('checkbox-rights'))
    fireEvent.click(screen.getByTestId('btn-submit-media'))

    await waitFor(() => {
      expect(screen.getByText('Batalkan Antrean')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Batalkan Antrean'))

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith('job-cancel-test')
      expect(screen.getByText('Proses unduhan berhasil dibatalkan.')).toBeInTheDocument()
    })
  })
})
