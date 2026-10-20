import { type ResumeDraft } from '../types/resume'

const BACKEND_URL = 'http://127.0.0.1:8000'

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

/**
 * Mengekspor CV ke Microsoft Word (.docx) melalui backend lokal
 */
export async function exportResumeDocx(draft: ResumeDraft): Promise<void> {
  const filename = `${draft.title.replace(/\s+/g, '_') || 'Resume'}.docx`

  const response = await fetch(`${BACKEND_URL}/api/export/docx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(draft)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gagal mengunduh DOCX (${response.status}): ${errorText}`)
  }

  const blob = await response.blob()
  downloadBlob(blob, filename)
}

/**
 * Mengekspor CV ke PDF melalui backend LibreOffice atau fallback ke Browser Print
 */
export async function exportResumePdf(draft: ResumeDraft): Promise<{ fallbackToPrint: boolean; message?: string }> {
  const filename = `${draft.title.replace(/\s+/g, '_') || 'Resume'}.pdf`

  try {
    const response = await fetch(`${BACKEND_URL}/api/export/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(draft)
    })

    if (response.ok) {
      const blob = await response.blob()
      downloadBlob(blob, filename)
      return { fallbackToPrint: false }
    }

    if (response.status === 422) {
      // LibreOffice tidak terpasang di host
      const data = await response.json()
      // Picu browser print fallback otomatis
      window.print()
      return {
        fallbackToPrint: true,
        message: data.message || 'LibreOffice tidak ditemukan. Menggunakan cetak PDF browser.'
      }
    }

    throw new Error(`Gagal respon server: ${response.status}`)
  } catch {
    // Backend offline atau error jaringan lokal: panggil langsung browser print fallback
    window.print()
    return {
      fallbackToPrint: true,
      message: 'Server backend tidak terhubung. Menggunakan pencetakan PDF browser langsung.'
    }
  }
}
