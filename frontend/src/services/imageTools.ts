import { apiFetch } from './apiClient'

export interface ImageResizeResult {
  success: boolean
  blob?: Blob
  filename?: string
  originalSize?: number
  optimizedSize?: number
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
