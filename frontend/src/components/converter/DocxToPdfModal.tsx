import React, { useState, useRef } from 'react'
import {
  FileCode,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Info,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import { convertDocxToPdf, type ConversionResult } from '../../services/converter'

interface DocxToPdfModalProps {
  isOpen: boolean
  onClose: () => void
}

export const DocxToPdfModal: React.FC<DocxToPdfModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [progressStep, setProgressStep] = useState<string>('')
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isCancelledRef = useRef<boolean>(false)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      if (!selected.name.toLowerCase().endsWith('.docx')) {
        setErrorMessage('Hanya berkas dokumen Microsoft Word (.docx) yang didukung.')
        return
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

    setProgressStep('Memeriksa integritas berkas DOCX...')
    await new Promise(r => setTimeout(r, 200))
    if (isCancelledRef.current) return

    setProgressStep('Menyiapkan sandbox eksekusi terisolasi...')
    await new Promise(r => setTimeout(r, 200))
    if (isCancelledRef.current) return

    setProgressStep('Mengonversi dokumen ke PDF via LibreOffice...')
    const res = await convertDocxToPdf(file)

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

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setErrorMessage(null)
    setIsConverting(false)
    setProgressStep('')
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-overlay-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Konversi DOCX ke PDF</h3>
              <p className="text-xs text-slate-500">
                Ubah dokumen Microsoft Word ke format PDF di sandbox lokal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal konversi Word ke PDF"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
            data-testid="btn-close-converter"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Area */}
        {!isConverting && !result && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/20 rounded-xl p-8 text-center cursor-pointer transition space-y-2"
              data-testid="dropzone-docx"
            >
              <Upload className="w-10 h-10 text-indigo-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                {file ? file.name : 'Pilih atau seret berkas Word (.docx) ke sini'}
              </p>
              <p className="text-xs text-slate-400">Maksimum ukuran 25 MB per berkas</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                aria-label="Pilih berkas Word DOCX"
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-file-docx"
              />
            </div>

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
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                data-testid="btn-start-convert"
              >
                Mulai Konversi
              </button>
            </div>
          </div>
        )}

        {/* Progress State */}
        {isConverting && (
          <div className="py-8 px-4 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
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
                  Fitur konversi dokumen offline berfidelitas tinggi membutuhkan aplikasi gratis LibreOffice di komputer lokal Anda.
                </p>
                <p className="text-2xs text-amber-700">
                  Setelah memasang LibreOffice, jalankan ulang server backend atau refresh halaman ini.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-amber-200">
              <a
                href="https://www.libreoffice.org/download/download-libreoffice/"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
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
              <h4 className="text-sm font-bold text-emerald-950">Konversi PDF Berhasil!</h4>
              <p className="text-xs text-emerald-800">
                Berkas <strong>{result.filename}</strong> telah otomatis terunduh ke komputer Anda.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Konversi Berkas Lain
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
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
