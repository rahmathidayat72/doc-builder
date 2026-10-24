import { apiFetch } from './apiClient'

export interface PdfToolResult {
  success: boolean
  blob?: Blob
  filename?: string
  message?: string
  applied?: boolean
  originalSize?: number
  outputSize?: number
  recoveredPages?: number
  ocrPages?: number
  watermarkedPages?: number
  numberedPages?: number
  markdownText?: string
  totalPages?: number
  convertedPages?: number
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
    return {
      success: false,
      message: err.message || err.detail || `Gagal menggabungkan berkas (${res.status}).`,
    }
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
  formData.append('output_mode', 'ranges')

  try {
    const res = await apiFetch('/api/pdf-tools/split', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${file.name.replace(/\.[^/.]+$/, '')}_split.zip`
      )
      downloadBlob(blob, filename)
      return { success: true, blob, filename }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.message || err.detail || `Gagal memisahkan halaman PDF (${res.status}).`,
    }
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

export async function compressPdf(
  file: File,
  level: 'light' | 'balanced' | 'maximum' = 'balanced'
): Promise<PdfToolResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('level', level)

  try {
    const res = await apiFetch('/api/pdf-tools/compress', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${file.name.replace(/\.[^/.]+$/, '')}_compressed.pdf`
      )
      const applied = res.headers.get('x-compression-applied') === 'true'
      const originalSize = parseInt(res.headers.get('x-original-size') || String(file.size), 10)
      const outputSize = parseInt(res.headers.get('x-output-size') || String(blob.size), 10)

      downloadBlob(blob, filename)
      return {
        success: true,
        blob,
        filename,
        applied,
        originalSize,
        outputSize,
      }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.message || err.detail || `Gagal mengompres berkas PDF (${res.status}).`,
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export interface PdfEditorPageInfo {
  page_number: number
  original_index: number
  width: number
  height: number
  rotation: number
  thumbnail: string
  preview?: string
}

export interface PdfEditorTextOverlay {
  id?: string
  text: string
  x_ratio: number
  y_ratio: number
  font_size?: number
  color?: string
}

export interface PdfEditorImageOverlay {
  id?: string
  image_base64: string
  x_ratio: number
  y_ratio: number
  width_ratio?: number
  height_ratio?: number
}

export interface PdfEditorUnifiedOverlay {
  id: string
  type: 'text' | 'image' | 'drawing' | 'signature'
  name?: string
  text?: string
  font_size?: number
  color?: string
  image_base64?: string
  x_ratio: number
  y_ratio: number
  width_ratio?: number
  height_ratio?: number
}

export interface PdfEditorPageSpec {
  source_index: number
  rotation: number
  text_overlays?: PdfEditorTextOverlay[]
  image_overlays?: PdfEditorImageOverlay[]
  overlays?: PdfEditorUnifiedOverlay[]
}

export interface PdfEditorManifest {
  pages: PdfEditorPageSpec[]
}

export interface PdfEditorPagesResult {
  success: boolean
  filename?: string
  total_pages?: number
  pages?: PdfEditorPageInfo[]
  message?: string
}

export async function getPdfEditorPages(file: File): Promise<PdfEditorPagesResult> {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await apiFetch('/api/pdf-tools/editor/pages', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const data = await res.json()
      return {
        success: true,
        filename: data.filename,
        total_pages: data.total_pages,
        pages: data.pages,
      }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.message || err.detail || `Gagal memuat halaman PDF (${res.status}).`,
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export async function applyPdfEditor(
  file: File,
  manifest: PdfEditorManifest,
  outputMode: 'edited' | 'signed' = 'edited'
): Promise<PdfToolResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('manifest', JSON.stringify(manifest))
  formData.append('output_mode', outputMode)

  try {
    const res = await apiFetch('/api/pdf-tools/editor/apply', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const suffix = outputMode === 'signed' ? 'signed' : 'edited'
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${file.name.replace(/\.[^/.]+$/, '')}_${suffix}.pdf`
      )
      downloadBlob(blob, filename)
      return { success: true, blob, filename }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.message || err.detail || `Gagal menyimpan perubahan PDF (${res.status}).`,
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export async function protectPdf(file: File, password: string): Promise<PdfToolResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('password', password)

  try {
    const res = await apiFetch('/api/pdf-tools/protect', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${file.name.replace(/\.[^/.]+$/, '')}_protected.pdf`
      )
      downloadBlob(blob, filename)
      return { success: true, blob, filename }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.message || err.detail || `Gagal memproteksi PDF (${res.status}).`,
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export async function unlockPdf(file: File, password: string): Promise<PdfToolResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('password', password)

  try {
    const res = await apiFetch('/api/pdf-tools/unlock', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${file.name.replace(/\.[^/.]+$/, '')}_unlocked.pdf`
      )
      downloadBlob(blob, filename)
      return { success: true, blob, filename }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.message || err.detail || `Gagal membuka proteksi PDF (${res.status}).`,
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export async function repairPdf(file: File): Promise<PdfToolResult> {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await apiFetch('/api/pdf-tools/repair', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${file.name.replace(/\.[^/.]+$/, '')}_repaired.pdf`
      )
      const recoveredPages = parseInt(res.headers.get('x-pages-recovered') || '0', 10) || undefined
      const originalSize = parseInt(res.headers.get('x-original-size') || '0', 10) || undefined
      const outputSize = parseInt(res.headers.get('x-output-size') || '0', 10) || undefined

      downloadBlob(blob, filename)
      return { success: true, blob, filename, recoveredPages, originalSize, outputSize }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.message || err.detail || `Gagal memperbaiki PDF (${res.status}).`,
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export async function getOcrStatus(): Promise<{ available: boolean; languages: string[]; message?: string }> {
  try {
    const res = await apiFetch('/api/pdf-tools/ocr/status')
    if (res.ok) {
      return await res.json()
    }
    return { available: false, languages: [], message: 'Gagal memeriksa status OCR.' }
  } catch {
    return { available: false, languages: [], message: 'Tidak dapat terhubung ke backend lokal.' }
  }
}

export async function ocrPdf(file: File, language: string = 'eng'): Promise<PdfToolResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('language', language)

  try {
    const res = await apiFetch('/api/pdf-tools/ocr', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${file.name.replace(/\.[^/.]+$/, '')}_searchable.pdf`
      )
      const ocrPages = parseInt(res.headers.get('x-ocr-pages') || '0', 10) || undefined
      const originalSize = parseInt(res.headers.get('x-original-size') || '0', 10) || undefined
      const outputSize = parseInt(res.headers.get('x-output-size') || '0', 10) || undefined

      downloadBlob(blob, filename)
      return { success: true, blob, filename, ocrPages, originalSize, outputSize }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.message || err.detail || `Gagal melakukan OCR PDF (${res.status}).`,
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export interface WatermarkOptions {
  file: File
  mode: 'text' | 'image'
  text?: string
  imageFile?: File | null
  opacity: number
  rotation: number
  position: string
  fontsize?: number
  color?: string
  pages?: string
}

export async function watermarkPdf(options: WatermarkOptions): Promise<PdfToolResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('mode', options.mode)
  formData.append('text', options.text || 'DRAFT')
  if (options.mode === 'image' && options.imageFile) {
    formData.append('image', options.imageFile)
  }
  formData.append('opacity', options.opacity.toString())
  formData.append('rotation', options.rotation.toString())
  formData.append('position', options.position)
  formData.append('fontsize', (options.fontsize || 40).toString())
  formData.append('color', options.color || '#e11d48')
  formData.append('pages', options.pages || 'all')

  try {
    const res = await apiFetch('/api/pdf-tools/watermark', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${options.file.name.replace(/\.[^/.]+$/, '')}_watermarked.pdf`
      )
      const watermarkedPages = parseInt(res.headers.get('x-watermarked-pages') || '0', 10) || undefined
      const originalSize = parseInt(res.headers.get('x-original-size') || '0', 10) || undefined
      const outputSize = parseInt(res.headers.get('x-output-size') || '0', 10) || undefined

      downloadBlob(blob, filename)
      return { success: true, blob, filename, watermarkedPages, originalSize, outputSize }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.message || err.detail || `Gagal membubuhkan watermark PDF (${res.status}).`,
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export interface PageNumbersOptions {
  file: File
  format: string
  position: string
  margin: number
  startPage: number
  startNumber: number
  fontsize: number
  color: string
  pages?: string
}

export async function addPageNumbersPdf(options: PageNumbersOptions): Promise<PdfToolResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('format', options.format)
  formData.append('position', options.position)
  formData.append('margin', options.margin.toString())
  formData.append('start_page', options.startPage.toString())
  formData.append('start_number', options.startNumber.toString())
  formData.append('fontsize', options.fontsize.toString())
  formData.append('color', options.color)
  formData.append('pages', options.pages || 'all')

  try {
    const res = await apiFetch('/api/pdf-tools/page-numbers', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${options.file.name.replace(/\.[^/.]+$/, '')}_numbered.pdf`
      )
      const numberedPages = parseInt(res.headers.get('x-numbered-pages') || '0', 10) || undefined
      const originalSize = parseInt(res.headers.get('x-original-size') || '0', 10) || undefined
      const outputSize = parseInt(res.headers.get('x-output-size') || '0', 10) || undefined

      downloadBlob(blob, filename)
      return { success: true, blob, filename, numberedPages, originalSize, outputSize }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.message || err.detail || `Gagal membubuhkan nomor halaman (${res.status}).`,
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}

export interface PdfToMarkdownOptions {
  file: File
  pages?: string
  autoDownload?: boolean
}

export async function pdfToMarkdown(options: PdfToMarkdownOptions): Promise<PdfToolResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('pages', options.pages || 'all')

  try {
    const res = await apiFetch('/api/pdf-tools/pdf-to-markdown', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const text = await blob.text()
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${options.file.name.replace(/\.[^/.]+$/, '')}.md`
      )
      const totalPages = parseInt(res.headers.get('x-total-pages') || '0', 10) || undefined
      const convertedPages = parseInt(res.headers.get('x-converted-pages') || '0', 10) || undefined
      const originalSize = parseInt(res.headers.get('x-original-size') || '0', 10) || undefined

      if (options.autoDownload !== false) {
        downloadBlob(blob, filename)
      }
      return {
        success: true,
        blob,
        filename,
        markdownText: text,
        totalPages,
        convertedPages,
        originalSize,
      }
    }

    const err = await res.json().catch(() => ({}))
    return {
      success: false,
      message: err.message || err.detail || `Gagal mengonversi PDF ke Markdown (${res.status}).`,
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Tidak dapat terhubung ke server backend lokal.' }
  }
}




