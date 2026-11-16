import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Mp4ToMp3Modal } from '../Mp4ToMp3Modal'
import * as apiClient from '../../../services/apiClient'
import * as videoService from '../../../services/videoCompression'
import {
  MAX_VIDEO_FILE_BYTES,
  uploadMp4ToMp3Stream,
  validateMp4AudioClientFile,
  type VideoCompressionJob,
} from '../../../services/videoCompression'

function makeAudioJob(overrides: Partial<VideoCompressionJob> = {}): VideoCompressionJob {
  return {
    id: 'audio-job-1',
    job_type: 'extract_audio',
    status: 'queued',
    preset: '192k',
    original_filename: 'podcast.mp4',
    output_filename: 'podcast_audio.mp3',
    progress_percent: 0,
    input_size_bytes: 15_000_000,
    output_size_bytes: null,
    input_duration_sec: 120,
    input_width: null,
    input_height: null,
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

describe('MP4 to MP3 validation & upload service', () => {
  const originalXhr = globalThis.XMLHttpRequest

  beforeEach(() => {
    vi.restoreAllMocks()
    apiClient.setCsrfToken(null)
  })

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXhr
    apiClient.setCsrfToken(null)
  })

  it('validateMp4AudioClientFile strictly accepts .mp4 only and enforces 250 MB ceiling', () => {
    expect(validateMp4AudioClientFile(null)).toMatch(/Pilih berkas video MP4/i)
    expect(validateMp4AudioClientFile(makeSizedFile('audio.mov', 1024, 'video/quicktime'))).toMatch(
      /Hanya berkas berekstensi \.mp4 yang didukung/i
    )
    expect(validateMp4AudioClientFile(makeSizedFile('audio.webm', 1024, 'video/webm'))).toMatch(
      /Hanya berkas berekstensi \.mp4 yang didukung/i
    )
    expect(validateMp4AudioClientFile(makeSizedFile('audio.mkv', 1024, 'video/x-matroska'))).toMatch(
      /Hanya berkas berekstensi \.mp4 yang didukung/i
    )
    expect(validateMp4AudioClientFile(makeSizedFile('kosong.mp4', 0))).toMatch(/0 byte/i)
    expect(
      validateMp4AudioClientFile(makeSizedFile('big.mp4', MAX_VIDEO_FILE_BYTES + 1))
    ).toMatch(/250\.000\.000 byte/i)

    expect(validateMp4AudioClientFile(makeSizedFile('valid.mp4', 1024))).toBeNull()
    expect(validateMp4AudioClientFile(makeSizedFile('UPPER.MP4', MAX_VIDEO_FILE_BYTES))).toBeNull()
  })

  it('uploadMp4ToMp3Stream attaches extract_audio job_type and owner_confirmed flag to metadata header', async () => {
    vi.spyOn(apiClient, 'initAuthSession').mockResolvedValue('csrf-audio-token')

    let sentMetadata = ''
    class MockXhr {
      headers: Record<string, string> = {}
      upload = { onprogress: null as ((ev: ProgressEvent) => void) | null }
      status = 202
      responseText = JSON.stringify({
        success: true,
        data: makeAudioJob({ id: 'job-audio-101', status: 'queued' }),
      })
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      onabort: (() => void) | null = null

      open() {}
      setRequestHeader(key: string, val: string) {
        this.headers[key] = val
        if (key === 'X-Video-Metadata') sentMetadata = val
      }
      getResponseHeader(key: string) {
        if (key === 'X-CSRF-Token') return 'new-csrf-token'
        return null
      }
      send() {
        setTimeout(() => this.onload?.(), 0)
      }
      abort() {}
    }

    globalThis.XMLHttpRequest = MockXhr as unknown as typeof XMLHttpRequest

    const file = makeSizedFile('lecture.mp4', 5000)
    const result = await uploadMp4ToMp3Stream(file, '320k', true)

    expect(result.id).toBe('job-audio-101')
    expect(sentMetadata).toBeTruthy()
    const decoded = decodeBase64UrlJson(sentMetadata)
    expect(decoded.filename).toBe('lecture.mp4')
    expect(decoded.preset).toBe('320k')
    expect(decoded.job_type).toBe('extract_audio')
    expect(decoded.owner_confirmed).toBe(true)
  })
})

describe('Mp4ToMp3Modal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders modal dialog with presets, dropzone, copyright checkbox, and disabled button initially', () => {
    render(<Mp4ToMp3Modal isOpen={true} onClose={() => {}} />)

    expect(screen.getByRole('dialog', { name: /mp4 ke mp3/i })).toBeInTheDocument()
    expect(screen.getByText('128 kbps')).toBeInTheDocument()
    expect(screen.getByText('192 kbps')).toBeInTheDocument()
    expect(screen.getByText('320 kbps')).toBeInTheDocument()

    const submitBtn = screen.getByTestId('btn-submit-mp4-to-mp3')
    expect(submitBtn).toBeDisabled()

    const checkbox = screen.getByTestId('checkbox-copyright-confirm')
    expect(checkbox).not.toBeChecked()
  })

  it('shows error when non-mp4 is selected and leaves submit button disabled', () => {
    render(<Mp4ToMp3Modal isOpen={true} onClose={() => {}} />)

    const input = screen.getByTestId('input-mp4-file')
    const badFile = makeSizedFile('recording.mov', 1024, 'video/quicktime')

    fireEvent.change(input, { target: { files: [badFile] } })

    expect(
      screen.getByText(/Hanya berkas berekstensi \.mp4 yang didukung untuk ekstraksi audio MP3/i)
    ).toBeInTheDocument()
    expect(screen.getByTestId('btn-submit-mp4-to-mp3')).toBeDisabled()
  })

  it('enables submit button only when valid MP4 file is selected AND copyright checkbox is checked', () => {
    render(<Mp4ToMp3Modal isOpen={true} onClose={() => {}} />)

    const input = screen.getByTestId('input-mp4-file')
    const validFile = makeSizedFile('speech.mp4', 1024)

    fireEvent.change(input, { target: { files: [validFile] } })

    const submitBtn = screen.getByTestId('btn-submit-mp4-to-mp3')
    const checkbox = screen.getByTestId('checkbox-copyright-confirm')

    // File selected, checkbox unchecked -> disabled
    expect(submitBtn).toBeDisabled()

    // Check copyright
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
    expect(submitBtn).not.toBeDisabled()

    // Uncheck copyright -> disabled again
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()
    expect(submitBtn).toBeDisabled()
  })

  it('runs upload and polling workflow to success and triggers single-use download', async () => {
    vi.useFakeTimers()

    const uploadSpy = vi
      .spyOn(videoService, 'uploadMp4ToMp3Stream')
      .mockResolvedValueOnce(makeAudioJob({ id: 'job-101', status: 'queued' }))

    const getJobSpy = vi
      .spyOn(videoService, 'getVideoCompressionJob')
      .mockResolvedValueOnce(makeAudioJob({ id: 'job-101', status: 'queued', progress_percent: 0 }))
      .mockResolvedValueOnce(
        makeAudioJob({ id: 'job-101', status: 'encoding', progress_percent: 50 })
      )
      .mockResolvedValueOnce(
        makeAudioJob({
          id: 'job-101',
          status: 'succeeded',
          progress_percent: 100,
          output_size_bytes: 2_500_000,
          download_url: '/api/video-compressions/job-101/download',
        })
      )

    const downloadSpy = vi
      .spyOn(videoService, 'downloadCompressedVideo')
      .mockResolvedValueOnce({ filename: 'podcast_audio.mp3', outputSize: 2_500_000 })

    render(<Mp4ToMp3Modal isOpen={true} onClose={() => {}} />)

    const input = screen.getByTestId('input-mp4-file')
    fireEvent.change(input, { target: { files: [makeSizedFile('podcast.mp4', 15_000_000)] } })

    const checkbox = screen.getByTestId('checkbox-copyright-confirm')
    fireEvent.click(checkbox)

    const presetBtn = screen.getByTestId('btn-audio-preset-320k')
    fireEvent.click(presetBtn)

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-submit-mp4-to-mp3'))
      await Promise.resolve()
    })

    expect(uploadSpy).toHaveBeenCalledWith(
      expect.any(File),
      '320k',
      true,
      expect.any(Object)
    )

    // Advance to encoding
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.getByText('Tahap 4/4: Ekstraksi MP3')).toBeInTheDocument()

    // Advance to succeeded
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(getJobSpy).toHaveBeenCalled()
    expect(screen.getByTestId('audio-success-panel')).toBeInTheDocument()
    expect(screen.getByText(/Audio MP3 Berhasil Diekstrak!/i)).toBeInTheDocument()

    // Trigger download
    const downloadBtn = screen.getByTestId('btn-download-mp3-audio')
    await act(async () => {
      fireEvent.click(downloadBtn)
      await Promise.resolve()
    })

    expect(downloadSpy).toHaveBeenCalledWith('job-101', 'podcast_audio.mp3')
    expect(screen.getByText('Audio Telah Diunduh')).toBeInTheDocument()
  })

  it('displays informative error notice when worker fails with NO_AUDIO_STREAM', async () => {
    vi.useFakeTimers()

    vi.spyOn(videoService, 'uploadMp4ToMp3Stream').mockResolvedValueOnce(
      makeAudioJob({ id: 'job-silent', status: 'queued' })
    )

    vi.spyOn(videoService, 'getVideoCompressionJob').mockResolvedValueOnce(
      makeAudioJob({
        id: 'job-silent',
        status: 'failed',
        error_code: 'NO_AUDIO_STREAM',
        error_message: 'Video tidak memiliki audio',
      })
    )

    render(<Mp4ToMp3Modal isOpen={true} onClose={() => {}} />)

    const input = screen.getByTestId('input-mp4-file')
    fireEvent.change(input, { target: { files: [makeSizedFile('silent.mp4', 1000)] } })
    fireEvent.click(screen.getByTestId('checkbox-copyright-confirm'))

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-submit-mp4-to-mp3'))
      await Promise.resolve()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(
      screen.getByText('Berkas MP4 tidak mengandung aliran audio untuk diekstrak.')
    ).toBeInTheDocument()
  })
})
