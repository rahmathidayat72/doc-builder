import { apiFetch } from './apiClient'

export interface ImageResizeResult {
  success: boolean
  blob?: Blob
  filename?: string
  originalSize?: number
  optimizedSize?: number
  message?: string
}

export interface RemoveBackgroundResult {
  success: boolean
  blob?: Blob
  filename?: string
  originalSize?: number
  processedSize?: number
  inferenceTimeMs?: number
  message?: string
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getFilenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback
  const match = header.match(/filename="?([^";]+)"?/)
  return match ? match[1] : fallback
}

export async function resizeImage(
  file: File,
  targetKb: number,
  outputFormat: 'jpeg' | 'png' | 'webp' = 'jpeg',
  stripExif: boolean = true
): Promise<ImageResizeResult> {
  if (!file) {
    return { success: false, message: 'Pilih berkas gambar terlebih dahulu.' }
  }
  if (targetKb < 5) {
    return { success: false, message: 'Target ukuran minimal 5 KB.' }
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('target_kb', String(targetKb))
  formData.append('output_format', outputFormat)
  formData.append('strip_exif', String(stripExif))

  try {
    const res = await apiFetch('/api/image-tools/resize', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${file.name.replace(/\.[^/.]+$/, '')}_resized.${outputFormat === 'jpeg' ? 'jpg' : outputFormat}`
      )
      const origSize = Number(res.headers.get('x-original-size')) || file.size
      const optSize = Number(res.headers.get('x-optimized-size')) || blob.size

      downloadBlob(blob, filename)
      return {
        success: true,
        blob,
        filename,
        originalSize: origSize,
        optimizedSize: optSize,
      }
    }

    const err = await res.json().catch(() => ({}))
    return { success: false, message: err.detail || `Gagal mengubah ukuran citra (${res.status}).` }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export async function removeBackground(file: File): Promise<RemoveBackgroundResult> {
  if (!file) {
    return { success: false, message: 'Pilih berkas gambar terlebih dahulu.' }
  }
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, message: 'Ukuran berkas melebihi batas maksimal 10 MB.' }
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await apiFetch('/api/image-tools/remove-background', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const cleanStem = file.name.replace(/\.[^/.]+$/, '')
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${cleanStem}_nobg.png`
      )
      const origSize = Number(res.headers.get('x-original-size')) || file.size
      const procSize = Number(res.headers.get('x-processed-size')) || blob.size
      const infTime = Number(res.headers.get('x-inference-time-ms')) || 0

      return {
        success: true,
        blob,
        filename,
        originalSize: origSize,
        processedSize: procSize,
        inferenceTimeMs: infTime,
      }
    }

    if (res.status === 429) {
      return {
        success: false,
        message:
          'Server sedang memproses gambar lain. Antrean penuh, silakan coba kembali dalam 30 detik.',
      }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.detail || `Gagal menghapus latar belakang (${res.status}).`,
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Tidak dapat terhubung ke server backend lokal.',
    }
  }
}

export function downloadImageBlob(blob: Blob, filename: string): void {
  downloadBlob(blob, filename)
}
