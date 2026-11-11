/**
 * Satukit File Shelf (Rak Berkas) Client Service
 * Task: FS-08 (Phase File Shelf)
 * Raw stream octet-stream upload, base64url metadata headers, anti-BOLA listing,
 * on-the-fly decrypted download, soft-deletion, and metrics.
 */

import { apiFetch, initAuthSession, resolveBackendUrl } from './apiClient'

export interface FileShelfItem {
  id: string
  filename: string
  content_type: string
  size_bytes: number
  status: 'CHECKING' | 'AVAILABLE' | 'FAILED' | 'DELETED'
  has_exif_warning: boolean
  sha256_hash?: string | null
  uploaded_at: number
  available_at?: number | null
  expires_at?: number | null
  error_message?: string | null
}

export interface FileShelfMetrics {
  slots_used: number
  slots_total: number
  storage_used_bytes: number
  max_storage_bytes: number
  uploads_rolling_count: number
  max_uploads_per_hour: number
  downloads_rolling_count: number
  max_downloads_per_hour: number
  r2_storage_status: string
  retention_days: number
}

export function toBase64UrlJson(data: Record<string, any>): string {
  const jsonStr = JSON.stringify(data)
  const bytes = new TextEncoder().encode(jsonStr)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function fetchUserFiles(): Promise<FileShelfItem[]> {
  const res = await apiFetch('/api/files')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Gagal mengambil daftar berkas (${res.status})`)
  }
  const json = await res.json()
  return json.data || []
}

export async function fetchFileMetrics(): Promise<FileShelfMetrics> {
  const res = await apiFetch('/api/files/metrics')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Gagal mengambil metrik kuota (${res.status})`)
  }
  const json = await res.json()
  return json.data
}

export async function deleteUserFile(itemId: string): Promise<void> {
  const res = await apiFetch(`/api/files/${itemId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Gagal menghapus berkas (${res.status})`)
  }
}

export async function downloadUserFile(itemId: string, fallbackFilename?: string): Promise<Blob> {
  const res = await apiFetch(`/api/files/${itemId}/download`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Gagal mengunduh berkas (${res.status})`)
  }

  const blob = await res.blob()

  // Trigger browser download if running in DOM environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    let filename = fallbackFilename || 'download.bin'
    const disp = res.headers.get('Content-Disposition')
    if (disp) {
      const matchUtf8 = disp.match(/filename\*=UTF-8''([^;]+)/i)
      const matchStd = disp.match(/filename="([^"]+)"/i)
      if (matchUtf8) {
        try {
          filename = decodeURIComponent(matchUtf8[1])
        } catch {
          // ignore decode err
        }
      } else if (matchStd) {
        filename = matchStd[1]
      }
    }

    const blobUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(blobUrl)
    document.body.removeChild(a)
  }

  return blob
}

export function uploadFileStream(
  file: File,
  hasExifWarning: boolean = false,
  onProgress?: (percent: number) => void
): Promise<FileShelfItem> {
  return new Promise((resolve, reject) => {
    initAuthSession()
      .then((csrfToken) => {
        const metadataHeader = toBase64UrlJson({
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          has_exif_warning: hasExifWarning,
        })

        const backendUrl = resolveBackendUrl()
        const uploadUrl = `${backendUrl}/api/files/upload`

        const xhr = new XMLHttpRequest()
        xhr.open('POST', uploadUrl, true)
        xhr.withCredentials = true

        xhr.setRequestHeader('Content-Type', 'application/octet-stream')
        xhr.setRequestHeader('X-File-Metadata', metadataHeader)
        if (csrfToken) {
          xhr.setRequestHeader('X-CSRF-Token', csrfToken)
        }

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100)
              onProgress(percent)
            }
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resp = JSON.parse(xhr.responseText)
              resolve(resp.data)
            } catch {
              reject(new Error('Respon server tidak dapat diproses.'))
            }
          } else {
            let errorMsg = `Unggah gagal (HTTP ${xhr.status})`
            try {
              const resp = JSON.parse(xhr.responseText)
              if (resp.detail) {
                errorMsg = resp.detail
              }
            } catch {
              // use generic
            }
            reject(new Error(errorMsg))
          }
        }

        xhr.onerror = () => {
          reject(new Error('Koneksi jaringan terputus saat mengunggah berkas.'))
        }

        xhr.send(file)
      })
      .catch(reject)
  })
}
