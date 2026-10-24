import React, { useState, useEffect } from 'react'
import {
  FileSearch,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  FileText,
  Info,
  RefreshCw,
  ExternalLink,
  Check,
} from 'lucide-react'
import { getOcrStatus, ocrPdf, type PdfToolResult } from '../../services/pdfTools'

interface PdfOcrModalProps {
  isOpen: boolean
  onClose: () => void
}

export const PdfOcrModal: React.FC<PdfOcrModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [language, setLanguage] = useState<string>('ind+eng')
  const [ocrStatus, setOcrStatus] = useState<{
    available: boolean
    languages: string[]
    message?: string
  } | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{
    filename: string
    ocrPages?: number
  } | null>(null)

  const checkStatus = async () => {
    setIsCheckingStatus(true)
    const status = await getOcrStatus()
    setOcrStatus(status)
    setIsCheckingStatus(false)
  }

  const resetForm = () => {
    setFile(null)
    setLanguage('ind+eng')
    setIsLoading(false)
    setErrorMessage(null)
    setSuccessInfo(null)
  }

  useEffect(() => {
    if (isOpen) {
      resetForm()
      checkStatus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      if (!selected.name.toLowerCase().endsWith('.pdf')) {
        setErrorMessage('Hanya berkas dokumen PDF (.pdf) yang didukung.')
        return
      }
      if (selected.size > 25 * 1024 * 1024) {
        setErrorMessage('Ukuran berkas melebihi batas maksimal 25 MB.')
        return
      }
      setFile(selected)
      setErrorMessage(null)
      setSuccessInfo(null)
    }
  }

  const handleOcrSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setErrorMessage('Pilih berkas PDF hasil scan terlebih dahulu.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessInfo(null)

    const res: PdfToolResult = await ocrPdf(file, language)
    setIsLoading(false)

    if (res.success) {
      setSuccessInfo({
        filename: res.filename || 'searchable.pdf',
        ocrPages: res.ocrPages,
      })
    } else {
      setErrorMessage(res.message || 'Gagal menerapkan OCR pada berkas PDF.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modal OCR PDF"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 border border-slate-200 animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <FileSearch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                OCR PDF
              </h3>
              <p className="text-xs text-slate-500">
                Ubah PDF hasil scan menjadi dokumen yang teksnya dapat dicari dan disalin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal OCR PDF"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition"
            data-testid="btn-close-pdf-ocr"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {/* Tesseract Status Check Card */}
          {ocrStatus && !ocrStatus.available ? (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3" data-testid="card-ocr-not-available">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-900">
                    Engine Tesseract OCR Belum Terdeteksi
                  </h4>
                  <p className="text-2xs text-amber-800 leading-relaxed">
                    Fitur OCR PDF memerlukan perangkat lunak <strong>Tesseract OCR</strong> terpasang di komputer lokal Anda untuk membaca teks dari gambar pindaian secara privat.
                  </p>
                </div>
              </div>

              <div className="bg-white/80 border border-amber-200/80 rounded-xl p-3 space-y-2 text-2xs text-slate-700">
                <span className="font-bold text-slate-800 block">Panduan Instalasi Gratis:</span>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>
                    <strong>Windows:</strong> Unduh dan pasang installer Tesseract dari{' '}
                    <a
                      href="https://github.com/UB-Mannheim/tesseract/wiki"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-semibold underline inline-flex items-center gap-0.5"
                    >
                      UB-Mannheim Tesseract <ExternalLink className="w-3 h-3" />
                    </a>. Centang bahasa Indonesia (*ind*) saat instalasi.
                  </li>
                  <li>
                    <strong>Linux (Ubuntu/Debian):</strong> Jalankan perintah{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-3xs font-mono">
                      sudo apt install tesseract-ocr tesseract-ocr-ind
                    </code>
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-3xs text-amber-700">
                  Setelah instalasi selesai, klik tombol periksa status di bawah.
                </span>
                <button
                  type="button"
                  onClick={checkStatus}
                  disabled={isCheckingStatus}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-2xs font-bold flex items-center gap-1.5 transition"
                  data-testid="btn-recheck-ocr"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                  <span>Periksa Ulang</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Engine Ready Badge */}
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-2xs text-emerald-900" data-testid="badge-ocr-ready">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Engine Tesseract OCR lokal aktif dan siap digunakan.</span>
                </div>
                <button
                  type="button"
                  onClick={checkStatus}
                  disabled={isCheckingStatus}
                  aria-label="Segarkan status OCR"
                  className="text-emerald-700 hover:text-emerald-900 p-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Language Selection */}
              <div>
                <label htmlFor="select-ocr-lang" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Bahasa Dokumen Scan
                </label>
                <select
                  id="select-ocr-lang"
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
                  data-testid="select-ocr-lang"
                >
                  <option value="ind+eng">Bahasa Indonesia + English (ind+eng)</option>
                  <option value="ind">Bahasa Indonesia (ind)</option>
                  <option value="eng">English (eng)</option>
                </select>
                <p className="text-3xs text-slate-400 mt-1">
                  Pilih bahasa utama dokumen untuk meningkatkan akurasi pengenalan karakter teks.
                </p>
              </div>

              {/* File Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Berkas PDF Scan
                </label>
                {!file ? (
                  <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/60 hover:bg-emerald-50/20 text-center">
                    <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-full">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Pilih berkas PDF hasil scan
                      </span>
                      <span className="text-3xs text-slate-400 block mt-0.5">
                        Maksimum ukuran 25 MB • Pemrosesan 100% lokal & privat
                      </span>
                    </div>
                    <input
                      type="file"
                      accept=".pdf"
                      aria-label="Pilih berkas PDF hasil scan"
                      className="hidden"
                      onChange={handleFileChange}
                      data-testid="input-ocr-file"
                    />
                  </label>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="p-2 bg-white rounded-lg border border-slate-200 text-emerald-700 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-slate-800 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-3xs text-slate-500">
                          {(file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-xs font-semibold text-slate-600 hover:text-rose-600 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 transition shrink-0"
                      data-testid="btn-change-ocr-file"
                    >
                      Ganti
                    </button>
                  </div>
                )}
              </div>

              {/* Informational Disclaimer */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-xs text-slate-700">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-2xs leading-relaxed">
                  <strong>Hasil Searchable PDF:</strong> Sistem menyisipkan lapisan teks tak kasatmata di bawah gambar pindaian sehingga dokumen tampak persis aslinya namun teksnya dapat diseleksi, disalin, dan dicari kata kuncinya (Ctrl+F).
                </span>
              </div>

              {/* Alerts */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700" data-testid="alert-error-ocr">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successInfo && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs text-emerald-800" data-testid="alert-success-ocr">
                  <div className="flex items-center gap-2 font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>OCR Selesai! Berkas Searchable Telah Diunduh.</span>
                  </div>
                  <p className="text-2xs text-emerald-700">
                    Berkas <strong>{successInfo.filename}</strong> berhasil diproses
                    {successInfo.ocrPages !== undefined ? ` (${successInfo.ocrPages} halaman).` : '.'}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleOcrSubmit}
                disabled={isLoading || !file || (ocrStatus !== null && !ocrStatus.available)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                data-testid="btn-submit-ocr"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menerapkan OCR pada Halaman PDF...</span>
                  </>
                ) : (
                  <>
                    <FileSearch className="w-4 h-4" />
                    <span>Mulai OCR PDF</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
