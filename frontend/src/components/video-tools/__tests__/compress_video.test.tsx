import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CompressVideoModal } from '../CompressVideoModal'
import * as apiClient from '../../../services/apiClient'
import * as videoService from '../../../services/videoCompression'
import {
  MAX_VIDEO_FILE_BYTES,
  VideoCompressionApiError,
  cancelVideoCompressionJob,
  downloadCompressedVideo,
  formatVideoBytes,
  getVideoCompressionJob,
  uploadVideoCompressionStream,
  validateVideoClientFile,
  type VideoCompressionJob,
} from '../../../services/videoCompression'

function makeVideoJob(overrides: Partial<VideoCompressionJob> = {}): VideoCompressionJob {
  return {
    id: 'vc-job-1',
    status: 'queued',
    preset: 'balanced',
    original_filename: 'liburan.mp4',
    output_filename: 'liburan_compressed.mp4',
    progress_percent: 0,
    input_size_bytes: 10_000_000,
    output_size_bytes: null,
    input_duration_sec: 30,
    input_width: 1920,
    input_height: 1080,
    output_width: null,
    output_height: null,
    error_code: null,
    error_message: null,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
    started_at: null,
    completed_at: null,
    expires_at: null,
    download_url: null,
    ...overrides,
  }
}

function makeSizedFile(name: string, size: number, type = 'video/mp4'): File {
  const file = new File(['v'], name, { type })
  Object.defineProperty(file, 'size', { value: size, configurable: true })
  return file
}

function decodeBase64UrlJson(value: string): Record<string, unknown> {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bytes = Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
}

describe('videoCompression service & validation', () => {
  const originalXhr = globalThis.XMLHttpRequest
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    apiClient.setCsrfToken(null)
  })

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXhr
    globalThis.fetch = originalFetch
    apiClient.setCsrfToken(null)
  })

  it('memvalidasi ekstensi, berkas 0 byte, dan batas tepat 250.000.000 byte di sisi klien', () => {
    expect(validateVideoClientFile(null)).toMatch(/Pilih berkas video/i)
    expect(validateVideoClientFile(makeSizedFile('clip.avi', 1024, 'video/x-msvideo'))).toMatch(
      /Format video tidak didukung/i
    )
    expect(validateVideoClientFile(makeSizedFile('kosong.mp4', 0))).toMatch(/0 byte/i)
    expect(validateVideoClientFile(makeSizedFile('terlalu-besar.mov', MAX_VIDEO_FILE_BYTES + 1))).toMatch(
      /250\.000\.000 byte/i
    )

    expect(validateVideoClientFile(makeSizedFile('pas.MP4', MAX_VIDEO_FILE_BYTES))).toBeNull()
    expect(validateVideoClientFile(makeSizedFile('video.mov', 1024, 'video/quicktime'))).toBeNull()
    expect(validateVideoClientFile(makeSizedFile('video.webm', 2048, 'video/webm'))).toBeNull()

    expect(formatVideoBytes(0)).toBe('0 B')
    expect(formatVideoBytes(512)).toBe('512 B')
    expect(formatVideoBytes(1536)).toBe('1.5 KB')
    expect(formatVideoBytes(5 * 1024 * 1024)).toBe('5.00 MB')
  })

  it('mengunggah berkas via XHR raw streaming dengan header X-Video-Metadata, X-CSRF-Token, progress, abort, dan error handling', async () => {
    vi.spyOn(apiClient, 'initAuthSession').mockResolvedValue('csrf-video-123')

    const instances: MockXhr[] = []
    class MockXhr {
      method = ''
      url = ''
      withCredentials = false
      headers: Record<string, string> = {}
      responseHeaders: Record<string, string> = {}
      status = 0
      responseText = ''
      sentBody: unknown = null
      aborted = false
      upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null }
      onload: (() => void) | null = null
      onabort: (() => void) | null = null
      onerror: (() => void) | null = null

      constructor() {
        instances.push(this)
      }

      open(method: string, url: string) {
        this.method = method
        this.url = url
      }

      setRequestHeader(name: string, value: string) {
        this.headers[name] = value
      }

      getResponseHeader(name: string): string | null {
        return this.responseHeaders[name.toLowerCase()] ?? null
      }

      send(body: unknown) {
        this.sentBody = body
      }

      abort() {
        this.aborted = true
        this.onabort?.()
      }
    }

    globalThis.XMLHttpRequest = MockXhr as unknown as typeof XMLHttpRequest

    const sampleFile = makeSizedFile('klip libur.mp4', 2048)
    const progressValues: number[] = []
    const uploadPromise = uploadVideoCompressionStream(sampleFile, 'maximum', {
      onProgress: (p) => progressValues.push(p),
    })

    await waitFor(() => {
      expect(instances).toHaveLength(1)
    })

    const xhr1 = instances[0]
    expect(xhr1.method).toBe('POST')
    expect(xhr1.url).toMatch(/\/api\/video-compressions$/)
    expect(xhr1.withCredentials).toBe(true)
    expect(xhr1.headers['Content-Type']).toBe('application/octet-stream')
    expect(xhr1.headers['X-CSRF-Token']).toBe('csrf-video-123')
    expect(decodeBase64UrlJson(xhr1.headers['X-Video-Metadata'])).toEqual({
      filename: 'klip libur.mp4',
      preset: 'maximum',
    })
    expect(xhr1.sentBody).toBe(sampleFile)

    xhr1.upload.onprogress?.({ lengthComputable: true, loaded: 1024, total: 2048 } as ProgressEvent)
    xhr1.upload.onprogress?.({ lengthComputable: true, loaded: 2048, total: 2048 } as ProgressEvent)
    expect(progressValues).toEqual([50, 100])

    const expectedJob = makeVideoJob({ preset: 'maximum', original_filename: 'klip libur.mp4' })
    xhr1.status = 202
    xhr1.responseText = JSON.stringify({ data: expectedJob })
    xhr1.onload?.()

    await expect(uploadPromise).resolves.toEqual(expectedJob)

    // Uji pembatalan via AbortSignal
    const controller = new AbortController()
    const abortPromise = uploadVideoCompressionStream(sampleFile, 'balanced', {
      signal: controller.signal,
    })
    await waitFor(() => {
      expect(instances).toHaveLength(2)
    })
    controller.abort()
    expect(instances[1].aborted).toBe(true)
    await expect(abortPromise).rejects.toMatchObject({ name: 'AbortError' })

    // Uji error 429 dengan Retry-After
    const rateLimitPromise = uploadVideoCompressionStream(sampleFile, 'light')
    await waitFor(() => {
      expect(instances).toHaveLength(3)
    })
    instances[2].status = 429
    instances[2].responseHeaders['retry-after'] = '45'
    instances[2].responseText = JSON.stringify({ detail: 'Batas 3 kompresi video per jam tercapai.' })
    instances[2].onload?.()

    await expect(rateLimitPromise).rejects.toMatchObject({
      name: 'VideoCompressionApiError',
      status: 429,
      retryAfterSeconds: 45,
      message: 'Batas 3 kompresi video per jam tercapai.',
    })

    // Uji error jaringan XHR
    const netPromise = uploadVideoCompressionStream(sampleFile, 'balanced')
    await waitFor(() => {
      expect(instances).toHaveLength(4)
    })
    instances[3].onerror?.()
    await expect(netPromise).rejects.toThrow(/Koneksi jaringan terputus/)
  })

  it('memeriksa status job, membatalkan job, dan mengunduh hasil sekali pakai dengan header ukuran', async () => {
    apiClient.setCsrfToken('csrf-video-fetch')
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const queuedJob = makeVideoJob({ id: 'job-abc', status: 'encoding', progress_percent: 42 })
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: queuedJob }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    await expect(getVideoCompressionJob('job-abc')).resolves.toEqual(queuedJob)

    const cancelledJob = makeVideoJob({ id: 'job-abc', status: 'cancelled' })
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: cancelledJob }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    await expect(cancelVideoCompressionJob('job-abc')).resolves.toEqual(cancelledJob)
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE', credentials: 'include' })

    const originalCreateObjectURL = window.URL.createObjectURL
    const originalRevokeObjectURL = window.URL.revokeObjectURL
    const createUrlMock = vi.fn().mockReturnValue('blob:http://localhost/video-1')
    const revokeUrlMock = vi.fn()
    window.URL.createObjectURL = createUrlMock
    window.URL.revokeObjectURL = revokeUrlMock
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    try {
      fetchMock.mockResolvedValueOnce(
        new Response(new Blob(['compressed-mp4'], { type: 'video/mp4' }), {
          status: 200,
          headers: {
            'Content-Disposition': "attachment; filename*=UTF-8''klip%20liburan_compressed.mp4",
            'X-Original-Size': '10000000',
            'X-Output-Size': '4200000',
          },
        })
      )

      const downloaded = await downloadCompressedVideo('job-abc')
      expect(downloaded).toEqual({
        filename: 'klip liburan_compressed.mp4',
        originalSize: 10_000_000,
        outputSize: 4_200_000,
      })
      expect(createUrlMock).toHaveBeenCalledTimes(1)
      expect(anchorClickSpy).toHaveBeenCalledTimes(1)

      // Uji status 409 saat tautan sekali pakai sudah diklaim
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Tautan unduhan sudah digunakan.' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      await expect(downloadCompressedVideo('job-abc')).rejects.toMatchObject({
        name: 'VideoCompressionApiError',
        status: 409,
        message: 'Tautan unduhan sudah digunakan.',
      })
    } finally {
      window.URL.createObjectURL = originalCreateObjectURL
      window.URL.revokeObjectURL = originalRevokeObjectURL
    }
  })
})

describe('CompressVideoModal Component Suite (Tool #26)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tidak merender modal saat isOpen bernilai false', () => {
    const { container } = render(<CompressVideoModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('merender 3 preset dengan Seimbang terpilih default dan menolak berkas invalid di klien', () => {
    const uploadSpy = vi.spyOn(videoService, 'uploadVideoCompressionStream')
    render(<CompressVideoModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Compress Video')).toBeInTheDocument()
    expect(screen.getByTestId('btn-video-preset-light')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('btn-video-preset-balanced')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('btn-video-preset-maximum')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('btn-submit-video-compression')).toBeDisabled()

    const fileInput = screen.getByTestId('input-video-file')
    fireEvent.change(fileInput, {
      target: { files: [makeSizedFile('salah.mkv', 2048, 'video/x-matroska')] },
    })
    expect(screen.getByTestId('notice-video-error')).toHaveTextContent(/Format video tidak didukung/i)
    expect(screen.getByTestId('btn-submit-video-compression')).toBeDisabled()

    fireEvent.change(fileInput, {
      target: { files: [makeSizedFile('raksasa.mp4', MAX_VIDEO_FILE_BYTES + 10)] },
    })
    expect(screen.getByTestId('notice-video-error')).toHaveTextContent(/250\.000\.000 byte/i)
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('menampilkan progres unggahan dan mendukung pembatalan unggahan sebelum masuk antrean', async () => {
    let capturedSignal: AbortSignal | undefined
    vi.spyOn(videoService, 'uploadVideoCompressionStream').mockImplementation(
      (_file, _preset, options) => {
        capturedSignal = options?.signal
        options?.onProgress?.(42)
        return new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            const err = new Error('Unggahan video dibatalkan.')
            err.name = 'AbortError'
            reject(err)
          })
        })
      }
    )

    render(<CompressVideoModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('input-video-file'), {
      target: { files: [makeSizedFile('presentasi.mp4', 4_000_000)] },
    })
    fireEvent.click(screen.getByTestId('btn-submit-video-compression'))

    expect(await screen.findByTestId('video-upload-progress-panel')).toBeInTheDocument()
    expect(screen.getByText(/Mengunggah Video ke Server\.\.\. 42%/i)).toBeInTheDocument()
    expect(screen.getByTestId('btn-close-compress-video')).toBeDisabled()

    fireEvent.click(screen.getByTestId('btn-cancel-video-upload'))
    expect(capturedSignal?.aborted).toBe(true)

    expect(await screen.findByTestId('notice-video-info')).toHaveTextContent(
      /Unggahan video dibatalkan/i
    )
    expect(screen.getByTestId('btn-submit-video-compression')).toBeEnabled()
  })

  it('memantau tahap polling worker hingga succeeded lalu menjalankan unduhan sekali pakai', async () => {
    vi.useFakeTimers()

    vi.spyOn(videoService, 'uploadVideoCompressionStream').mockResolvedValueOnce(
      makeVideoJob({ id: 'vc-poll-1', status: 'queued', progress_percent: 0 })
    )
    const getJobSpy = vi
      .spyOn(videoService, 'getVideoCompressionJob')
      .mockResolvedValueOnce(
        makeVideoJob({ id: 'vc-poll-1', status: 'queued', progress_percent: 0 })
      )
      .mockResolvedValueOnce(
        makeVideoJob({ id: 'vc-poll-1', status: 'scanning', progress_percent: 15 })
      )
      .mockResolvedValueOnce(
        makeVideoJob({ id: 'vc-poll-1', status: 'probing', progress_percent: 30 })
      )
      .mockResolvedValueOnce(
        makeVideoJob({ id: 'vc-poll-1', status: 'encoding', progress_percent: 65 })
      )
      .mockResolvedValueOnce(
        makeVideoJob({
          id: 'vc-poll-1',
          status: 'succeeded',
          progress_percent: 100,
          input_size_bytes: 10_000_000,
          output_size_bytes: 3_500_000,
          input_width: 1920,
          input_height: 1080,
          output_width: 1280,
          output_height: 720,
          output_filename: 'liburan_compressed.mp4',
          download_url: '/api/video-compressions/vc-poll-1/download',
        })
      )
    const downloadSpy = vi.spyOn(videoService, 'downloadCompressedVideo').mockResolvedValueOnce({
      filename: 'liburan_compressed.mp4',
      originalSize: 10_000_000,
      outputSize: 3_500_000,
    })

    render(<CompressVideoModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('input-video-file'), {
      target: { files: [makeSizedFile('liburan.mp4', 10_000_000)] },
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-submit-video-compression'))
      await Promise.resolve()
    })

    expect(screen.getByTestId('video-worker-progress-panel')).toBeInTheDocument()
    expect(screen.getByText('Tahap 1/4: Antrean Server')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.getByText('Tahap 2/4: Pemindaian Antivirus')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.getByText('Tahap 3/4: Inspeksi Metadata')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.getByText('Tahap 4/4: Kompresi Video')).toBeInTheDocument()
    expect(screen.getByText('65%')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(getJobSpy).toHaveBeenCalledTimes(5)
    expect(screen.getByTestId('video-success-panel')).toBeInTheDocument()
    expect(screen.getByText(/Hemat 65%/i)).toBeInTheDocument()
    expect(screen.getByText('1920×1080 → 1280×720')).toBeInTheDocument()

    const downloadBtn = screen.getByTestId('btn-download-compressed-video')
    await act(async () => {
      fireEvent.click(downloadBtn)
      await Promise.resolve()
    })

    expect(downloadSpy).toHaveBeenCalledWith('vc-poll-1', 'liburan_compressed.mp4')
    expect(screen.getByTestId('btn-download-compressed-video')).toBeDisabled()
    expect(screen.getByText('Video Telah Diunduh')).toBeInTheDocument()
  })

  it('dapat membatalkan job aktif di server melalui tombol Batalkan Kompresi', async () => {
    vi.spyOn(videoService, 'uploadVideoCompressionStream').mockResolvedValueOnce(
      makeVideoJob({ id: 'vc-cancel-1', status: 'queued' })
    )
    const cancelSpy = vi.spyOn(videoService, 'cancelVideoCompressionJob').mockResolvedValueOnce(
      makeVideoJob({ id: 'vc-cancel-1', status: 'cancelled' })
    )

    render(<CompressVideoModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('input-video-file'), {
      target: { files: [makeSizedFile('rapat.webm', 5_000_000, 'video/webm')] },
    })
    fireEvent.click(screen.getByTestId('btn-submit-video-compression'))

    expect(await screen.findByTestId('btn-cancel-video-job')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-cancel-video-job'))

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith('vc-cancel-1')
      expect(screen.getByTestId('notice-video-info')).toHaveTextContent(
        /Kompresi video berhasil dibatalkan/i
      )
    })
    expect(screen.getByTestId('btn-submit-video-compression')).toBeInTheDocument()
  })

  it('menangani OUTPUT_NOT_SMALLER dengan tombol pindah preset lebih agresif serta menampilkannya untuk preset maximum', async () => {
    vi.useFakeTimers()

    const uploadSpy = vi
      .spyOn(videoService, 'uploadVideoCompressionStream')
      .mockResolvedValueOnce(makeVideoJob({ id: 'vc-small-1', status: 'queued', preset: 'light' }))
      .mockResolvedValueOnce(makeVideoJob({ id: 'vc-small-2', status: 'queued', preset: 'maximum' }))

    vi.spyOn(videoService, 'getVideoCompressionJob')
      .mockResolvedValueOnce(
        makeVideoJob({
          id: 'vc-small-1',
          status: 'failed',
          preset: 'light',
          error_code: 'OUTPUT_NOT_SMALLER',
          error_message: 'Hasil kompresi tidak lebih kecil daripada video asli.',
        })
      )
      .mockResolvedValueOnce(
        makeVideoJob({
          id: 'vc-small-2',
          status: 'failed',
          preset: 'maximum',
          error_code: 'OUTPUT_NOT_SMALLER',
          error_message: 'Hasil kompresi tetap lebih besar dari video asli.',
        })
      )

    render(<CompressVideoModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('btn-video-preset-light'))
    expect(screen.getByTestId('btn-video-preset-light')).toHaveAttribute('aria-checked', 'true')

    fireEvent.change(screen.getByTestId('input-video-file'), {
      target: { files: [makeSizedFile('sudah-kecil.mp4', 1_500_000)] },
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-submit-video-compression'))
      await Promise.resolve()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(screen.getByTestId('notice-output-not-smaller')).toBeInTheDocument()
    expect(screen.getByTestId('btn-suggest-preset-balanced')).toBeInTheDocument()
    expect(screen.getByTestId('btn-suggest-preset-maximum')).toBeInTheDocument()

    // Klik preset Seimbang lalu Maksimum
    fireEvent.click(screen.getByTestId('btn-suggest-preset-balanced'))
    expect(screen.getByTestId('btn-video-preset-balanced')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('notice-video-info')).toHaveTextContent(/Preset diubah ke Seimbang/i)

    fireEvent.click(screen.getByTestId('btn-video-preset-maximum'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-submit-video-compression'))
      await Promise.resolve()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(uploadSpy).toHaveBeenNthCalledWith(1, expect.any(File), 'light', expect.any(Object))
    expect(uploadSpy).toHaveBeenNthCalledWith(2, expect.any(File), 'maximum', expect.any(Object))
    expect(screen.getByTestId('notice-output-not-smaller')).toHaveTextContent(
      /Preset Maksimum sudah digunakan/i
    )
    expect(screen.queryByTestId('btn-suggest-preset-balanced')).not.toBeInTheDocument()
    expect(screen.queryByTestId('btn-suggest-preset-maximum')).not.toBeInTheDocument()
  })

  it('menampilkan pesan retry-after saat rate limit dan menutup modal dengan Escape ketika idle', async () => {
    const onClose = vi.fn()
    vi.spyOn(videoService, 'uploadVideoCompressionStream').mockRejectedValueOnce(
      new VideoCompressionApiError('Batas antrean penuh.', 429, 45)
    )

    render(<CompressVideoModal isOpen={true} onClose={onClose} />)

    fireEvent.change(screen.getByTestId('input-video-file'), {
      target: { files: [makeSizedFile('klip.mov', 2_000_000, 'video/quicktime')] },
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-submit-video-compression'))
      await Promise.resolve()
    })

    expect(screen.getByTestId('notice-video-error')).toHaveTextContent(
      /Batas antrean penuh\. Coba lagi dalam sekitar 45 detik\./
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
