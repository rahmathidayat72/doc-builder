import React, { useState, useEffect } from 'react'
import {
  Wrench,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  FileText,
  Info,
} from 'lucide-react'
import { repairPdf, type PdfToolResult } from '../../services/pdfTools'

interface PdfRepairModalProps {
  isOpen: boolean
  onClose: () => void
}

export const PdfRepairModal: React.FC<PdfRepairModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{
    filename: string
    recoveredPages?: number
    originalSize?: number
    repairedSize?: number
  } | null>(null)

  const resetForm = () => {
    setFile(null)
    setIsLoading(false)
    setErrorMessage(null)
    setSuccessInfo(null)
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

  const handleRepairSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setErrorMessage('Pilih berkas PDF yang ingin diperbaiki terlebih dahulu.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessInfo(null)

    const res: PdfToolResult = await repairPdf(file)
    setIsLoading(false)

    if (res.success) {
      setSuccessInfo({
        filename: res.filename || 'repaired.pdf',
        recoveredPages: res.recoveredPages,
        originalSize: res.originalSize,
        repairedSize: res.outputSize,
      })
    } else {
      setErrorMessage(res.message || 'Gagal memperbaiki berkas PDF.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modal Repair PDF"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 border border-slate-200 animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-lime-50 text-lime-700 rounded-xl">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Repair PDF
              </h3>
              <p className="text-xs text-slate-500">
                Pulihkan berkas PDF yang rusak dan selamatkan data di dalamnya.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal Repair PDF"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition"
            data-testid="btn-close-pdf-repair"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {/* File Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Berkas PDF Rusak / Korup
            </label>
            {!file ? (
              <label className="border-2 border-dashed border-slate-300 hover:border-lime-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/60 hover:bg-lime-50/20 text-center">
                <div className="p-2.5 bg-lime-50 text-lime-700 rounded-full">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Pilih atau tarik berkas PDF yang rusak
                  </span>
                  <span className="text-3xs text-slate-400 block mt-0.5">
                    Maksimum ukuran 25 MB • Pemrosesan 100% offline & lokal
                  </span>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  aria-label="Pilih berkas PDF rusak"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="input-repair-file"
                />
              </label>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-lime-700 shrink-0">
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
                  data-testid="btn-change-repair-file"
                >
                  Ganti
                </button>
              </div>
            )}
          </div>

          {/* Educational Disclaimer */}
          <div className="p-3 bg-lime-50/80 border border-lime-200/90 rounded-xl flex items-start gap-2 text-xs text-lime-900">
            <Info className="w-4 h-4 text-lime-700 shrink-0 mt-0.5" />
            <span className="text-2xs leading-relaxed">
              <strong>Cara Kerja:</strong> Engine PyMuPDF membangun ulang tabel xref yang rusak, memulihkan stream halaman terpotong, dan membersihkan objek korup. Pemrosesan berjalan aman di komputer Anda tanpa upload ke internet.
            </span>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700" data-testid="alert-error-repair">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-800" data-testid="alert-success-repair">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Dokumen PDF Berhasil Dipulihkan!</span>
              </div>
              <p className="text-2xs text-emerald-700 leading-relaxed">
                Berkas <strong>{successInfo.filename}</strong> telah diunduh otomatis.
                {successInfo.recoveredPages !== undefined && (
                  <span className="block mt-0.5 font-medium">
                    Halaman terselamatkan: {successInfo.recoveredPages} halaman.
                  </span>
                )}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleRepairSubmit}
            disabled={isLoading || !file}
            className="w-full py-2.5 px-4 bg-lime-600 hover:bg-lime-700 active:bg-lime-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
            data-testid="btn-submit-repair"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memperbaiki & Memulihkan Berkas...</span>
              </>
            ) : (
              <>
                <Wrench className="w-4 h-4" />
                <span>Perbaiki PDF Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
