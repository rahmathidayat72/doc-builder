import {
  apiFetch,
  initAuthSession,
  resolveBackendUrl,
  setCsrfToken,
} from './apiClient'
import { toBase64UrlJson } from './fileShelf'

export const MAX_VIDEO_FILE_BYTES = 250_000_000
export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'] as const
export const VIDEO_COMPRESSION_POLL_INTERVAL_MS = 2000

export type VideoCompressionPreset = 'light' | 'balanced' | 'maximum'
export type Mp3AudioPreset = '128k' | '192k' | '320k'

export type VideoCompressionStatus =
  | 'uploading'
  | 'queued'
  | 'scanning'
  | 'probing'
  | 'encoding'
  | 'succeeded'
  | 'claimed'
  | 'failed'
  | 'cancelled'
  | 'expired'

export interface VideoCompressionJob {
  id: string
  job_type?: 'compress' | 'extract_audio'
  status: VideoCompressionStatus
  preset: string
  original_filename: string
  output_filename: string
  progress_percent: number
  input_size_bytes: number
  output_size_bytes: number | null
  input_duration_sec: number | null
  input_width: number | null
  input_height: number | null
  output_width: number | null
  output_height: number | null
  error_code: string | null
  error_message: string | null
  created_at: number
  updated_at: number
  started_at: number | null
  completed_at: number | null
  expires_at: number | null
  download_url: string | null
}

export interface UploadVideoOptions {
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export interface VideoDownloadResult {
  filename: string
  originalSize?: number
  outputSize?: number
}

export class VideoCompressionApiError extends Error {
  status: number
  retryAfterSeconds?: number

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message)
    this.name = 'VideoCompressionApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function validateVideoClientFile(file: File | null | undefined): string | null {
  if (!file || !file.name) {
    return 'Pilih berkas video MP4, MOV, atau WebM terlebih dahulu.'
  }
  if (!/\.(mp4|mov|webm)$/i.test(file.name)) {
    return 'Format video tidak didukung. Gunakan MP4, MOV, atau WebM.'
  }
  if (file.size <= 0) {
    return 'Berkas video kosong (0 byte).'
  }
  if (file.size > MAX_VIDEO_FILE_BYTES) {
    return 'Ukuran berkas melebihi batas maksimal 250 MB (250.000.000 byte).'
  }
  return null
}

export function validateMp4AudioClientFile(file: File | null | undefined): string | null {
  if (!file || !file.name) {
    return 'Pilih berkas video MP4 terlebih dahulu.'
  }
  if (!/\.mp4$/i.test(file.name)) {
    return 'Hanya berkas berekstensi .mp4 yang didukung untuk ekstraksi audio MP3.'
  }
  if (file.size <= 0) {
    return 'Berkas video kosong (0 byte).'
  }
  if (file.size > MAX_VIDEO_FILE_BYTES) {
    return 'Ukuran berkas melebihi batas maksimal 250 MB (250.000.000 byte).'
  }
  return null
}

export function formatVideoBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function parseRetryAfter(headerValue: string | null | undefined): number | undefined {
  if (!headerValue) return undefined
  const parsed = Number.parseInt(headerValue, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parseSizeHeader(headerValue: string | null | undefined): number | undefined {
  if (!headerValue) return undefined
  const parsed = Number.parseInt(headerValue, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function extractDownloadFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback
  const matchUtf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (matchUtf8?.[1]) {
    try {
      return decodeURIComponent(matchUtf8[1])
    } catch {
      // Fallback ke header filename standar
    }
  }
  const matchStd = disposition.match(/filename="([^"]+)"/i)
  if (matchStd?.[1]) {
    return matchStd[1]
  }
  return fallback
}

function createAbortError(): Error {
  const err = new Error('Unggahan video dibatalkan.')
  err.name = 'AbortError'
  return err
}

interface VideoUploadMetadataPayload {
  filename: string
  preset: string
  job_type?: 'compress' | 'extract_audio'
  owner_confirmed?: boolean
}

async function _uploadVideoInternal(
  file: File,
  metaPayload: VideoUploadMetadataPayload,
  options: UploadVideoOptions = {}
): Promise<VideoCompressionJob> {
  const { onProgress, signal } = options
  if (signal?.aborted) {
    throw createAbortError()
  }

  const csrfToken = await initAuthSession()
  if (signal?.aborted) {
    throw createAbortError()
  }

  const metadataHeader = toBase64UrlJson(metaPayload)
  const uploadUrl = `${resolveBackendUrl()}/api/video-compressions`

  return new Promise<VideoCompressionJob>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let settled = false

    const cleanup = () => {
      if (signal) {
        signal.removeEventListener('abort', handleAbort)
      }
    }

    const handleAbort = () => {
      if (settled) return
      try {
        xhr.abort()
      } catch {
        // Ignore abort cleanup error
      }
      settled = true
      cleanup()
      reject(createAbortError())
    }

    if (signal) {
      signal.addEventListener('abort', handleAbort, { once: true })
    }

    xhr.open('POST', uploadUrl, true)
    xhr.withCredentials = true
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.setRequestHeader('X-Video-Metadata', metadataHeader)
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken)
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)))
          onProgress(percent)
        }
      }
    }

    xhr.onload = () => {
      if (settled) return
      settled = true
      cleanup()

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText)
          if (!resp?.data) {
            reject(new Error('Respon antrean kompresi video tidak valid.'))
            return
          }
          resolve(resp.data as VideoCompressionJob)
        } catch {
          reject(new Error('Respon server tidak dapat diproses.'))
        }
        return
      }

      if (xhr.status === 401) {
        setCsrfToken(null)
      }

      const retryAfter = parseRetryAfter(
        typeof xhr.getResponseHeader === 'function'
          ? xhr.getResponseHeader('Retry-After')
          : null
      )
      let errorMsg = `Unggahan video gagal (HTTP ${xhr.status}).`
      try {
        const resp = JSON.parse(xhr.responseText)
        if (typeof resp?.detail === 'string' && resp.detail.trim()) {
          errorMsg = resp.detail
        }
      } catch {
        // Gunakan pesan default
      }
      reject(new VideoCompressionApiError(errorMsg, xhr.status, retryAfter))
    }

    xhr.onabort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(createAbortError())
    }

    xhr.onerror = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('Koneksi jaringan terputus saat mengunggah berkas video.'))
    }

    xhr.send(file)
  })
}

export async function uploadVideoCompressionStream(
  file: File,
  preset: VideoCompressionPreset,
  options: UploadVideoOptions = {}
): Promise<VideoCompressionJob> {
  return _uploadVideoInternal(file, { filename: file.name, preset }, options)
}

export async function uploadMp4ToMp3Stream(
  file: File,
  preset: Mp3AudioPreset = '192k',
  ownerConfirmed: boolean = true,
  options: UploadVideoOptions = {}
): Promise<VideoCompressionJob> {
  return _uploadVideoInternal(
    file,
    {
      filename: file.name,
      preset,
      job_type: 'extract_audio',
      owner_confirmed: ownerConfirmed,
    },
    options
  )
}

export async function getVideoCompressionJob(jobId: string): Promise<VideoCompressionJob> {
  const res = await apiFetch(`/api/video-compressions/${encodeURIComponent(jobId)}`)
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new VideoCompressionApiError(
      json?.detail || `Gagal memeriksa status kompresi video (HTTP ${res.status}).`,
      res.status
    )
  }
  if (!json?.data) {
    throw new Error('Data status tugas kompresi video tidak ditemukan.')
  }
  return json.data as VideoCompressionJob
}

export async function cancelVideoCompressionJob(jobId: string): Promise<VideoCompressionJob> {
  const res = await apiFetch(`/api/video-compressions/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new VideoCompressionApiError(
      json?.detail || `Gagal membatalkan kompresi video (HTTP ${res.status}).`,
      res.status
    )
  }
  return json?.data as VideoCompressionJob
}

export async function downloadCompressedVideo(
  jobId: string,
  fallbackFilename: string = 'video_compressed.mp4'
): Promise<VideoDownloadResult> {
  const res = await apiFetch(`/api/video-compressions/${encodeURIComponent(jobId)}/download`)
  if (!res.ok) {
    const json = await res.json().catch(() => null)
    throw new VideoCompressionApiError(
      json?.detail || 'Berkas hasil kompresi tidak dapat diunduh atau sudah kedaluwarsa.',
      res.status
    )
  }

  const filename = extractDownloadFilename(res.headers.get('Content-Disposition'), fallbackFilename)
  const originalSize = parseSizeHeader(res.headers.get('X-Original-Size'))
  const outputSize = parseSizeHeader(res.headers.get('X-Output-Size'))
  const blob = await res.blob()

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000)
  }

  return {
    filename,
    originalSize,
    outputSize,
  }
}
