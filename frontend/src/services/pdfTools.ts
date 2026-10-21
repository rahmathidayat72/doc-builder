import { apiFetch } from './apiClient'

export interface PdfToolResult {
  success: boolean
  blob?: Blob
  filename?: string
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

export async function mergePdfAndImages(files: File[]): Promise<PdfToolResult> {
  if (files.length === 0) {
    return { success: false, message: 'Pilih minimal satu berkas untuk digabungkan.' }
  }

  const formData = new FormData()
  for (const f of files) {
    formData.append('files', f)
  }

  try {
    const res = await apiFetch('/api/pdf-tools/merge', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(res.headers.get('content-disposition'), 'merged_document.pdf')
      downloadBlob(blob, filename)
      return { success: true, blob, filename }
    }

    const err = await res.json().catch(() => ({}))
    return { success: false, message: err.detail || `Gagal menggabungkan berkas (${res.status}).` }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export async function splitPdf(file: File, pages: string): Promise<PdfToolResult> {
  if (!pages.trim()) {
    return { success: false, message: 'Masukkan rentang halaman (contoh: 1-3, 5).' }
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('pages', pages)

  try {
    const res = await apiFetch('/api/pdf-tools/split', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${file.name.replace(/\.[^/.]+$/, '')}_split.pdf`
      )
      downloadBlob(blob, filename)
      return { success: true, blob, filename }
    }

    const err = await res.json().catch(() => ({}))
    return { success: false, message: err.detail || `Gagal memisahkan halaman PDF (${res.status}).` }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export async function imagesToPdf(
  files: File[],
  pageSize: 'A4' | 'LETTER' = 'A4',
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<PdfToolResult> {
  if (files.length === 0) {
    return { success: false, message: 'Pilih minimal satu gambar.' }
  }

  const formData = new FormData()
  for (const f of files) {
    formData.append('files', f)
  }
  formData.append('page_size', pageSize)
  formData.append('orientation', orientation)

  try {
    const res = await apiFetch('/api/pdf-tools/images-to-pdf', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(res.headers.get('content-disposition'), 'images.pdf')
      downloadBlob(blob, filename)
      return { success: true, blob, filename }
    }

    const err = await res.json().catch(() => ({}))
    return { success: false, message: err.detail || `Gagal mengonversi gambar ke PDF (${res.status}).` }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export async function pdfToImages(
  file: File,
  imageFormat: 'jpeg' | 'png' = 'png',
  dpi: number = 150
): Promise<PdfToolResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('image_format', imageFormat)
  formData.append('dpi', String(dpi))

  try {
    const res = await apiFetch('/api/pdf-tools/pdf-to-images', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${file.name.replace(/\.[^/.]+$/, '')}_images.zip`
      )
      downloadBlob(blob, filename)
      return { success: true, blob, filename }
    }

    const err = await res.json().catch(() => ({}))
    return { success: false, message: err.detail || `Gagal mengonversi PDF ke gambar (${res.status}).` }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}
