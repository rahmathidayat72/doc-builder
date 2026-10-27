import React, { useState, useEffect } from 'react'
import {
  FileCode,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  FileText,
  Copy,
  Download,
  Check,
} from 'lucide-react'
import { pdfToMarkdown, type PdfToolResult } from '../../services/pdfTools'

interface PdfToMarkdownModalProps {
  isOpen: boolean
  onClose: () => void
}

export const PdfToMarkdownModal: React.FC<PdfToMarkdownModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [pagesMode, setPagesMode] = useState<'all' | 'custom'>('all')
  const [customPages, setCustomPages] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{
    filename: string
    convertedPages?: number
  } | null>(null)
  const [hasCopied, setHasCopied] = useState(false)

  const resetForm = () => {
    setFile(null)
    setPagesMode('all')
    setCustomPages('')
    setIsLoading(false)
    setErrorMessage(null)
    setMarkdownContent(null)
    setSuccessInfo(null)
    setHasCopied(false)
  }

  useEffect(() => {
    if (isOpen) {
      resetForm()
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

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setMarkdownContent(null)
      setSuccessInfo(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setErrorMessage('Pilih berkas PDF terlebih dahulu.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setMarkdownContent(null)
    setSuccessInfo(null)

    const res: PdfToolResult = await pdfToMarkdown({
      file,
      pages: pagesMode === 'all' ? 'all' : customPages,
      autoDownload: true,
    })

    setIsLoading(false)

    if (res.success) {
      setMarkdownContent(res.markdownText || '')
      setSuccessInfo({
        filename: res.filename || `${file.name.replace(/\.[^/.]+$/, '')}.md`,
        convertedPages: res.convertedPages,
      })
    } else {
      setErrorMessage(res.message || 'Gagal mengonversi PDF ke Markdown.')
    }
  }

  const handleCopy = async () => {
    if (!markdownContent) return
    try {
      await navigator.clipboard.writeText(markdownContent)
      setHasCopied(true)
      setTimeout(() => setHasCopied(false), 2000)
    } catch {
      // Fallback seleksi manual jika clipboard permission diblokir browser
      const textarea = document.createElement('textarea')
      textarea.value = markdownContent
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setHasCopied(true)
      setTimeout(() => setHasCopied(false), 2000)
    }
  }

  const handleDownloadAgain = () => {
    if (!markdownContent || !file) return
    const blob = new Blob([markdownContent], { type: 'text/markdown; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = successInfo?.filename || `${file.name.replace(/\.[^/.]+$/, '')}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modal PDF to Markdown"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-overlay-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 border border-slate-200 animate-fade-in max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  PDF to Markdown
                </h3>
                <span className="text-3xs font-extrabold uppercase px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded-md">
                  New!
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ekstrak dokumen PDF menjadi berkas Markdown (.md) lokal dengan mempertahankan heading, tabel, list & tautan.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal PDF to Markdown"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition"
            data-testid="btn-close-pdf-to-markdown"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {/* File Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Berkas Dokumen PDF
            </label>
            {!file ? (
              <label className="border-2 border-dashed border-slate-300 hover:border-purple-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/60 hover:bg-purple-50/20 text-center">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-full">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Pilih atau tarik berkas PDF ke sini
                  </span>
                  <span className="text-3xs text-slate-400 block mt-0.5">
                    Maksimum ukuran 25 MB • Ekstraksi teks & struktur 100% lokal offline
                  </span>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  aria-label="Pilih berkas PDF untuk diekstrak ke Markdown"
                  className="hidden"
                  onChange={handlePdfChange}
                  data-testid="input-pdf-to-markdown-file"
                />
              </label>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-purple-600 shrink-0">
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
                  onClick={() => {
                    setFile(null)
                    setMarkdownContent(null)
                    setSuccessInfo(null)
                  }}
                  className="text-xs font-semibold text-slate-600 hover:text-purple-600 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-200 transition shrink-0"
                  data-testid="btn-change-pdf-to-markdown-file"
                >
                  Ganti
                </button>
              </div>
            )}
          </div>

          {/* Page Target Range */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="block text-2xs font-bold text-slate-700">
              Target Halaman yang Dikonversi
            </label>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="md-pages-target"
                  checked={pagesMode === 'all'}
                  onChange={() => setPagesMode('all')}
                  className="accent-purple-600"
                />
                <span>Semua Halaman</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="md-pages-target"
                  checked={pagesMode === 'custom'}
                  onChange={() => setPagesMode('custom')}
                  className="accent-purple-600"
                />
                <span>Halaman Tertentu</span>
              </label>
            </div>
            {pagesMode === 'custom' && (
              <input
                type="text"
                value={customPages}
                onChange={e => setCustomPages(e.target.value)}
                placeholder="Contoh: 1-3, 5"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-purple-500"
                data-testid="input-pdf-to-markdown-pages-range"
              />
            )}
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700" data-testid="alert-error-pdf-to-markdown">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs text-emerald-800" data-testid="alert-success-pdf-to-markdown">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Konversi PDF ke Markdown Berhasil!</span>
              </div>
              <p className="text-2xs text-emerald-700">
                Berkas <strong>{successInfo.filename}</strong> telah otomatis terunduh
                {successInfo.convertedPages !== undefined ? ` (${successInfo.convertedPages} halaman diekstrak).` : '.'}
              </p>
            </div>
          )}

          {/* Pratinjau Markdown & Aksi Copy */}
          {markdownContent !== null && (
            <div className="space-y-2 p-3.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-2xs font-mono text-slate-400">
                  Pratinjau Sintaks Markdown ({markdownContent.length} karakter)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-3xs font-semibold px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
                    data-testid="btn-copy-markdown"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Teks</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAgain}
                    className="flex items-center gap-1 text-3xs font-semibold px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition"
                    data-testid="btn-download-markdown-again"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh .md</span>
                  </button>
                </div>
              </div>
              <pre
                className="text-xs font-mono text-slate-200 max-h-56 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed p-2 bg-slate-950/60 rounded-lg custom-scrollbar select-text"
                data-testid="preview-markdown-content"
              >
                {markdownContent}
              </pre>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !file}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
            data-testid="btn-submit-pdf-to-markdown"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengekstrak Dokumen ke Markdown...</span>
              </>
            ) : (
              <>
                <FileCode className="w-4 h-4" />
                <span>Konversi ke Markdown Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
