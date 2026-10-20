import React, { useState, useRef } from 'react'
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Sparkles,
  ArrowRight
} from 'lucide-react'
import { type ResumeData } from '../../types/resume'

interface ConfidenceMap {
  overall: number
  fullName: number
  email: number
  phone: number
  summary: number
  experiences: number
  education: number
  skills: number
}

interface ParsedResumeResponse {
  success: boolean
  filename: string
  data: ResumeData
  confidence: ConfidenceMap
  warnings: string[]
}

interface ImportResumeModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (extractedData: ResumeData) => void
}

const BACKEND_URL = 'http://127.0.0.1:8000'

export const ImportResumeModal: React.FC<ImportResumeModalProps> = ({
  isOpen,
  onClose,
  onApply
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [parsedResult, setParsedResult] = useState<ParsedResumeResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      const ext = selected.name.toLowerCase().split('.').pop()
      if (ext !== 'pdf' && ext !== 'docx') {
        setErrorMessage('Hanya berkas format .pdf dan .docx yang didukung.')
        return
      }
      setFile(selected)
      setErrorMessage(null)
      setParsedResult(null)
    }
  }

  const handleUploadAndParse = async () => {
    if (!file) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${BACKEND_URL}/api/import/resume`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Gagal memproses berkas' }))
        throw new Error(errorData.detail || `Server error (${response.status})`)
      }

      const result: ParsedResumeResponse = await response.json()
      setParsedResult(result)
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mem-parsing berkas CV.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmApply = () => {
    if (parsedResult) {
      onApply(parsedResult.data)
      onClose()
    }
  }

  const getConfidenceBadge = (val: number) => {
    const percent = Math.round(val * 100)
    if (percent >= 80) {
      return (
        <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Tinggi ({percent}%)
        </span>
      )
    }
    if (percent >= 50) {
      return (
        <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Perlu Dicek ({percent}%)
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-3xs font-bold bg-slate-100 text-slate-500">
        Rendah ({percent}%)
      </span>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Impor CV Lama (PDF / DOCX)</h3>
              <p className="text-xs text-slate-500">
                Ekstrak teks ke formulir editor dengan tinjauan kepastian (confidence).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tahap 1: Pilih Berkas */}
        {!parsedResult && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/20 rounded-xl p-8 text-center cursor-pointer transition space-y-2"
              data-testid="dropzone-import"
            >
              <FileText className="w-10 h-10 text-indigo-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                {file ? file.name : 'Pilih atau seret berkas CV ke sini'}
              </p>
              <p className="text-xs text-slate-400">Mendukung format PDF atau Word (.docx) hingga 25 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-file-import"
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
                disabled={!file || isLoading}
                onClick={handleUploadAndParse}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-xs"
                data-testid="btn-start-parse"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Mengekstrak Dokumen...
                  </>
                ) : (
                  <>
                    Ekstrak Dokumen
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tahap 2: Tinjauan Hasil Ekstraksi (Review Confidence) */}
        {parsedResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div>
                <span className="text-xs font-bold text-indigo-900 block">
                  Ekstraksi Berhasil: {parsedResult.filename}
                </span>
                <span className="text-2xs text-indigo-700">
                  Periksa hasil penguraian sebelum menerapkan data ke formulir editor.
                </span>
              </div>
              <div className="text-right">
                <span className="text-3xs text-indigo-600 uppercase font-bold block">Skor Rata-Rata</span>
                {getConfidenceBadge(parsedResult.confidence.overall)}
              </div>
            </div>

            {/* Rincian Bidang Terdeteksi */}
            <div className="max-h-60 overflow-y-auto space-y-2 text-xs border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                <div>
                  <span className="text-slate-500 block text-2xs">Nama Lengkap</span>
                  <span className="font-semibold text-slate-800">
                    {parsedResult.data.contact.fullName || '(Tidak terdeteksi)'}
                  </span>
                </div>
                {getConfidenceBadge(parsedResult.confidence.fullName)}
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                <div>
                  <span className="text-slate-500 block text-2xs">Email</span>
                  <span className="font-semibold text-slate-800">
                    {parsedResult.data.contact.email || '(Tidak terdeteksi)'}
                  </span>
                </div>
                {getConfidenceBadge(parsedResult.confidence.email)}
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                <div>
                  <span className="text-slate-500 block text-2xs">Nomor Telepon</span>
                  <span className="font-semibold text-slate-800">
                    {parsedResult.data.contact.phone || '(Tidak terdeteksi)'}
                  </span>
                </div>
                {getConfidenceBadge(parsedResult.confidence.phone)}
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                <div>
                  <span className="text-slate-500 block text-2xs">Pengalaman Kerja</span>
                  <span className="font-semibold text-slate-800">
                    {parsedResult.data.experiences.length} posisi terdeteksi
                  </span>
                </div>
                {getConfidenceBadge(parsedResult.confidence.experiences)}
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                <div>
                  <span className="text-slate-500 block text-2xs">Riwayat Pendidikan</span>
                  <span className="font-semibold text-slate-800">
                    {parsedResult.data.education.length} institusi terdeteksi
                  </span>
                </div>
                {getConfidenceBadge(parsedResult.confidence.education)}
              </div>

              <div className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-slate-500 block text-2xs">Keahlian (Skills)</span>
                  <span className="font-semibold text-slate-800">
                    {parsedResult.data.skills.length} keahlian terdeteksi
                  </span>
                </div>
                {getConfidenceBadge(parsedResult.confidence.skills)}
              </div>
            </div>

            {/* Peringatan Edukatif */}
            {parsedResult.warnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Catatan Verifikasi:
                </span>
                <ul className="text-2xs text-amber-800 list-disc list-inside space-y-0.5">
                  {parsedResult.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setParsedResult(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Unggah Ulang
              </button>
              <button
                type="button"
                onClick={handleConfirmApply}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-xs flex items-center gap-1.5"
                data-testid="btn-confirm-apply"
              >
                <CheckCircle2 className="w-4 h-4" />
                Terapkan ke Editor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
