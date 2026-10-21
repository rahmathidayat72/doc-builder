import { apiFetch } from './apiClient'

export interface ConversionResult {
  success: boolean
  blob?: Blob
  filename?: string
  libreofficeMissing?: boolean
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

/**
 * Mengonversi berkas Microsoft Word (.docx) ke PDF via backend lokal
 */
export async function convertDocxToPdf(file: File): Promise<ConversionResult> {
  const outputFilename = `${file.name.replace(/\.[^/.]+$/, '')}.pdf`

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiFetch('/api/converter/docx-to-pdf', {
      method: 'POST',
      body: formData
    })

    if (response.ok) {
      const blob = await response.blob()
      downloadBlob(blob, outputFilename)
      return {
        success: true,
        blob,
        filename: outputFilename
      }
    }

    if (response.status === 422) {
      const errData = await response.json().catch(() => ({}))
      if (errData.error_code === 'LIBREOFFICE_NOT_FOUND') {
        return {
          success: false,
          libreofficeMissing: true,
          message: errData.message || 'LibreOffice belum terpasang di komputer lokal Anda.'
        }
      }
      return {
        success: false,
        message: errData.detail || errData.message || 'Format berkas tidak valid.'
      }
    }

    const errText = await response.text()
    return {
      success: false,
      message: `Gagal memproses konversi (${response.status}): ${errText}`
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Tidak dapat terhubung ke server backend lokal.'
    }
  }
}

/**
 * Merekonstruksi berkas PDF menjadi Microsoft Word (.docx) via backend lokal.
 */
export async function convertPdfToDocx(file: File): Promise<ConversionResult> {
  const outputFilename = `${file.name.replace(/\.[^/.]+$/, '')}.docx`

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiFetch('/api/converter/pdf-to-docx', {
      method: 'POST',
      body: formData
    })

    if (response.ok) {
      const blob = await response.blob()
      downloadBlob(blob, outputFilename)
      return {
        success: true,
        blob,
        filename: outputFilename
      }
    }

    const errorData = await response.json().catch(() => ({}))
    return {
      success: false,
      message:
        errorData.detail ||
        errorData.message ||
        `Gagal merekonstruksi PDF ke DOCX (${response.status}).`
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Tidak dapat terhubung ke server backend lokal.'
    }
  }
}
