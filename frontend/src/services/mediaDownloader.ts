import { apiFetch } from './apiClient'

export interface MediaDownloadJobStatus {
  id: string
  platform: 'youtube' | 'instagram' | 'tiktok'
  media_type: 'video' | 'image'
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'claimed' | 'expired'
  progress_percent: number
  filename: string | null
  file_size_bytes: number
  error_message: string | null
  error_code: string | null
  created_at: number
  completed_at: number | null
  expires_at: number | null
  download_url: string | null
}

export interface CreateMediaJobResponse {
  success: boolean
  data?: {
    job_id: string
    status: string
    platform: string
    media_type: string
    created_at: number
  }
  error?: string
}

export async function createMediaDownloadJob(
  url: string,
  mediaType: 'video' | 'image',
  rightsConfirmed: boolean
): Promise<CreateMediaJobResponse> {
  try {
    const res = await apiFetch('/api/media-downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        media_type: mediaType,
        rights_confirmed: rightsConfirmed,
      }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        success: false,
        error: data?.detail || `Gagal mendaftarkan unduhan media (HTTP ${res.status}).`,
      }
    }

    return {
      success: true,
      data: data?.data,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Koneksi ke backend gagal.',
    }
  }
}

export async function getMediaDownloadStatus(
  jobId: string
): Promise<{ success: boolean; data?: MediaDownloadJobStatus; error?: string }> {
  try {
    const res = await apiFetch(`/api/media-downloads/${jobId}`)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        success: false,
        error: data?.detail || `Gagal mengambil status unduhan (HTTP ${res.status}).`,
      }
    }
    return {
      success: true,
      data: data?.data,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Koneksi ke server gagal.',
    }
  }
}

export async function cancelMediaDownloadJob(
  jobId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await apiFetch(`/api/media-downloads/${jobId}`, {
      method: 'DELETE',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        success: false,
        error: data?.detail || data?.error || 'Gagal membatalkan proses unduhan.',
      }
    }
    return {
      success: true,
      message: data?.message || 'Proses unduhan berhasil dibatalkan.',
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Koneksi ke server gagal.',
    }
  }
}

export async function downloadMediaFile(jobId: string, filename: string): Promise<boolean> {
  const res = await apiFetch(`/api/media-downloads/${jobId}/file`)
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.detail || 'Berkas tidak dapat diunduh atau sudah kedaluwarsa.')
  }

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  return true
}
