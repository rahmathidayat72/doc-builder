import React, { useState, useRef, useEffect } from 'react'
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Info,
  RefreshCw,
  ExternalLink,
  ArrowRightLeft
} from 'lucide-react'
import {
  convertSpreadsheetToPdf,
  convertPdfToXlsx,
  type ConversionResult
} from '../../services/converter'

export type SpreadsheetTab = 'xlsx2pdf' | 'pdf2xlsx'

interface SpreadsheetConverterModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: SpreadsheetTab
}

export const SpreadsheetConverterModal: React.FC<SpreadsheetConverterModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'xlsx2pdf'
}) => {
  const [activeTab, setActiveTab] = useState<SpreadsheetTab>(initialTab)
  const [file, setFile] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [progressStep, setProgressStep] = useState<string>('')
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isCancelledRef = useRef<boolean>(false)

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setErrorMessage(null)
    setIsConverting(false)
    setProgressStep('')
  }

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      handleReset()
    }
  }, [isOpen, initialTab])

  if (!isOpen) return null

  const handleTabChange = (tab: SpreadsheetTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    handleReset()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      const lower = selected.name.toLowerCase()

      if (activeTab === 'xlsx2pdf') {
        if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
          setErrorMessage('Hanya berkas lembar kerja Excel (.xlsx / .xls) yang didukung.')
          return
        }
      } else {
        if (!lower.endsWith('.pdf')) {
          setErrorMessage('Hanya berkas dokumen PDF (.pdf) yang didukung.')
          return
        }
      }

      if (selected.size > 25 * 1024 * 1024) {
        setErrorMessage('Ukuran berkas melebihi batas 25 MB.')
        return
      }

      setFile(selected)
      setErrorMessage(null)
      setResult(null)
    }
  }

  const handleStartConversion = async () => {
    if (!file) return

    setIsConverting(true)
    setErrorMessage(null)
    setResult(null)
    isCancelledRef.current = false

    setProgressStep('Memeriksa integritas berkas...')
    await new Promise(r => setTimeout(r, 200))
    if (isCancelledRef.current) return

    setProgressStep('Menyiapkan sandbox eksekusi terisolasi...')
    await new Promise(r => setTimeout(r, 200))
    if (isCancelledRef.current) return

    let res: ConversionResult
    if (activeTab === 'xlsx2pdf') {
      setProgressStep('Mengonversi lembar kerja ke PDF via LibreOffice...')
      res = await convertSpreadsheetToPdf(file)
    } else {
      setProgressStep('Mendeteksi dan mengekstrak tabel PDF ke Excel...')
      res = await convertPdfToXlsx(file)
    }

    if (isCancelledRef.current) return

    setIsConverting(false)
    setResult(res)
    if (!res.success && res.message && !res.libreofficeMissing) {
      setErrorMessage(res.message)
    }
  }

  const handleCancel = () => {
    isCancelledRef.current = true
    setIsConverting(false)
    setProgressStep('')
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-overlay-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Excel & PDF</h3>
              <p className="text-xs text-slate-500">
                Konversi spreadsheet Excel ke PDF atau ekstrak tabel PDF ke Excel.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal konversi Excel"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
            data-testid="btn-close-spreadsheet-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => handleTabChange('xlsx2pdf')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'xlsx2pdf'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-xlsx2pdf"
          >
            Excel ke PDF
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('pdf2xlsx')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'pdf2xlsx'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-pdf2xlsx"
          >
            PDF ke Excel
          </button>
        </div>

        {/* Main Content Area */}
        {!isConverting && !result && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50 hover:bg-emerald-50/20 rounded-xl p-8 text-center cursor-pointer transition space-y-2"
              data-testid="dropzone-spreadsheet"
            >
              <Upload className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                {file
                  ? file.name
                  : activeTab === 'xlsx2pdf'
                    ? 'Pilih atau seret berkas Excel (.xlsx, .xls)'
                    : 'Pilih atau seret berkas PDF bertabel (.pdf)'}
              </p>
              <p className="text-xs text-slate-400">Maksimum ukuran 25 MB per berkas</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={activeTab === 'xlsx2pdf' ? '.xlsx,.xls' : '.pdf'}
                aria-label={
                  activeTab === 'xlsx2pdf'
                    ? 'Pilih berkas spreadsheet Excel'
                    : 'Pilih berkas PDF'
                }
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-file-spreadsheet"
              />
            </div>

            {activeTab === 'pdf2xlsx' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2 text-xs text-amber-800">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Hanya tabel terstruktur berbasis teks yang dapat diekstrak ke Excel. PDF hasil scan tanpa OCR atau dokumen tanpa tabel akan ditolak.
                </span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!file}
                onClick={handleStartConversion}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                data-testid="btn-start-spreadsheet-convert"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Mulai Konversi</span>
              </button>
            </div>
          </div>
        )}

        {/* Progress State */}
        {isConverting && (
          <div className="py-8 px-4 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <Loader2 className="w-16 h-16 text-emerald-600 animate-spin" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800">Sedang Memproses Konversi</h4>
              <p className="text-xs text-slate-500 font-medium">{progressStep}</p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            >
              Batalkan
            </button>
          </div>
        )}

        {/* Result: LibreOffice Not Found */}
        {result?.libreofficeMissing && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-start gap-2.5">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-amber-900">
                <h4 className="font-bold text-sm">LibreOffice Belum Terpasang</h4>
                <p className="leading-relaxed">
                  Fitur konversi spreadsheet Excel ke PDF membutuhkan aplikasi LibreOffice di komputer lokal Anda.
                </p>
                <p className="text-2xs text-amber-700">
                  Setelah memasang LibreOffice, jalankan ulang server backend atau coba lagi.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-amber-200">
              <a
                href="https://www.libreoffice.org/download/download-libreoffice/"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
              >
                Unduh LibreOffice Gratis <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        )}

        {/* Result: Success */}
        {result?.success && (
          <div className="py-6 px-4 text-center space-y-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-emerald-950">Konversi Berhasil!</h4>
              <p className="text-xs text-emerald-800">
                Berkas <strong>{result.filename}</strong> telah otomatis terunduh ke komputer Anda.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Konversi Berkas Lain
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs"
              >
                Selesai
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
