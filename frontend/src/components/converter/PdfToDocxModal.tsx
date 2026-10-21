import React, { useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  Upload,
  X
} from 'lucide-react'
import { convertPdfToDocx, type ConversionResult } from '../../services/converter'

interface PdfToDocxModalProps {
  isOpen: boolean
  onClose: () => void
}

export const PdfToDocxModal: React.FC<PdfToDocxModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [progressStep, setProgressStep] = useState('')
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isCancelledRef = useRef(false)

  if (!isOpen) return null

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return

    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Hanya berkas dokumen PDF (.pdf) yang didukung.')
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

  const handleStartConversion = async () => {
    if (!file) return

    setIsConverting(true)
    setErrorMessage(null)
    setResult(null)
    isCancelledRef.current = false

    setProgressStep('Memvalidasi struktur dan magic bytes PDF...')
    await new Promise(resolve => setTimeout(resolve, 200))
    if (isCancelledRef.current) return

    setProgressStep('Menyiapkan worker sandbox terisolasi...')
    await new Promise(resolve => setTimeout(resolve, 200))
    if (isCancelledRef.current) return

    setProgressStep('Merekonstruksi teks, tabel, dan layout ke DOCX...')
    const conversionResult = await convertPdfToDocx(file)
    if (isCancelledRef.current) return

    setIsConverting(false)
    setResult(conversionResult)
    if (!conversionResult.success && conversionResult.message) {
      setErrorMessage(conversionResult.message)
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Konversi PDF ke Word DOCX</h3>
              <p className="text-xs text-slate-500">Rekonstruksi dokumen secara lokal dan terisolasi.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal konversi PDF ke Word"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            data-testid="btn-close-pdf2docx"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isConverting && !result?.success && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 rounded-xl p-8 text-center cursor-pointer transition space-y-2"
              data-testid="dropzone-pdf"
            >
              <Upload className="w-10 h-10 text-indigo-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                {file ? file.name : 'Pilih atau seret berkas PDF ke sini'}
              </p>
              <p className="text-xs text-slate-400">Maksimum ukuran 25 MB per berkas</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                aria-label="Pilih berkas PDF"
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-file-pdf"
              />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2 text-xs text-amber-800">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Hasil PDF→DOCX bersifat best-effort. Layout kompleks, font khusus, atau objek mengambang
                mungkin memerlukan penyesuaian setelah dibuka di Word.
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!file}
                onClick={handleStartConversion}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg"
                data-testid="btn-start-pdf2docx"
              >
                Mulai Rekonstruksi
              </button>
            </div>
          </div>
        )}

        {isConverting && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="w-14 h-14 text-indigo-600 animate-spin mx-auto" />
            <div>
              <h4 className="text-sm font-bold text-slate-800">Sedang Merekonstruksi Dokumen</h4>
              <p className="text-xs text-slate-500">{progressStep}</p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg"
            >
              Batalkan
            </button>
          </div>
        )}

        {result?.success && (
          <div className="py-6 text-center space-y-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">Konversi DOCX Berhasil</h4>
              <p className="text-xs text-emerald-800">
                Berkas <strong>{result.filename}</strong> telah otomatis diunduh.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Konversi Berkas Lain
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg"
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
