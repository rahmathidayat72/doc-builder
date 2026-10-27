import { type ResumeDraft } from '../types/resume'
import { apiFetch } from './apiClient'

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g
const MAX_FILENAME_LENGTH = 120

const stripControlChars = (value: string): string =>
  Array.from(value)
    .filter(char => {
      const code = char.codePointAt(0) ?? 0
      return code >= 32 && code !== 127
    })
    .join('')

/**
 * Menghasilkan nama berkas dasar yang aman untuk semua sistem operasi.
 * Ekstensi yang diketik pengguna akan dilepas agar tidak menjadi `.pdf.pdf`.
 */
export function normalizeExportFilename(value: string, fallback = 'Resume'): string {
  const withoutExtension = value.trim().replace(/\.(pdf|docx)$/i, '')
  const cleaned = stripControlChars(withoutExtension)
    .replace(INVALID_FILENAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
    .trim()

  const candidate = cleaned || fallback
  return candidate.slice(0, MAX_FILENAME_LENGTH).trim() || fallback
}

/**
 * Mengunduh Blob ke komputer pengguna
 */
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

function buildExportPayload(draft: ResumeDraft, filename?: string): ResumeDraft {
  if (!filename) return draft
  return {
    ...draft,
    title: normalizeExportFilename(filename, draft.title || 'Resume')
  }
}

/**
 * Mengekspor CV ke Microsoft Word (.docx) melalui backend lokal
 */
export async function exportResumeDocx(draft: ResumeDraft, filename?: string): Promise<void> {
  const payload = buildExportPayload(draft, filename)
  const safeName = normalizeExportFilename(payload.title)

  const response = await apiFetch('/api/export/docx', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gagal mengunduh DOCX (${response.status}): ${errorText}`)
  }

  const blob = await response.blob()
  downloadBlob(blob, `${safeName}.docx`)
}

/**
 * Mengekspor CV ke PDF melalui backend LibreOffice atau fallback ke Browser Print
 */
export async function exportResumePdf(
  draft: ResumeDraft,
  filename?: string
): Promise<{ fallbackToPrint: boolean; message?: string }> {
  const payload = buildExportPayload(draft, filename)
  const safeName = normalizeExportFilename(payload.title)

  try {
    const response = await apiFetch('/api/export/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      const blob = await response.blob()
      downloadBlob(blob, `${safeName}.pdf`)
      return { fallbackToPrint: false }
    }

    if (response.status === 422) {
      // LibreOffice tidak terpasang di host
      const data = await response.json()
      // Picu browser print fallback otomatis
      printResume(safeName)
      return {
        fallbackToPrint: true,
        message: data.message || 'LibreOffice tidak ditemukan. Menggunakan cetak PDF browser.'
      }
    }

    throw new Error(`Gagal respon server: ${response.status}`)
  } catch {
    // Backend offline atau error jaringan lokal: panggil langsung browser print fallback
    printResume(safeName)
    return {
      fallbackToPrint: true,
      message: 'Server backend tidak terhubung. Menggunakan pencetakan PDF browser langsung.'
    }
  }
}

/**
 * Mencetak CV melalui dialog cetak browser. Judul halaman sementara dipakai
 * sebagai nama berkas default pada dialog "Save as PDF".
 */
export function printResume(filename: string): void {
  const previousTitle = document.title
  document.title = normalizeExportFilename(filename)

  const restoreTitle = () => {
    document.title = previousTitle
    window.removeEventListener('afterprint', restoreTitle)
  }

  window.addEventListener('afterprint', restoreTitle)
  window.print()
  window.setTimeout(restoreTitle, 1500)
}
