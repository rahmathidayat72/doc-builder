import React, { useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileText,
  Info,
  Loader2,
  Sparkles,
  Upload,
  X
} from 'lucide-react'
import { type ResumeData } from '../../types/resume'
import { apiFetch } from '../../services/apiClient'

interface ConfidenceMap {
  overall: number
  fullName: number
  email: number
  phone: number
  summary: number
  experiences: number
  education: number
  skills: number
  languages: number
  customSections: number
}

interface ExtractionSummary {
  sourceFormat: string
  lineCount: number
  textCharacters: number
  detectedSections: string[]
  missingSections: string[]
  layoutPreserved: boolean
}

interface ParsedResumeResponse {
  success: boolean
  filename: string
  data: ResumeData
  confidence: ConfidenceMap
  extraction: ExtractionSummary
  warnings: string[]
}

interface ImportResumeModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (extractedData: ResumeData) => void
}

export const ImportResumeModal: React.FC<ImportResumeModalProps> = ({
  isOpen,
  onClose,
  onApply
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [parsedResult, setParsedResult] = useState<ParsedResumeResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const resetResult = () => {
    setParsedResult(null)
    setConfirmReplace(false)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return

    const extension = selected.name.toLowerCase().split('.').pop()
    if (extension !== 'pdf' && extension !== 'docx') {
      setErrorMessage('Hanya berkas format .pdf dan .docx yang didukung.')
      return
    }
    setFile(selected)
    setErrorMessage(null)
    resetResult()
  }

  const handleUploadAndParse = async () => {
    if (!file) return

    setIsLoading(true)
    setErrorMessage(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await apiFetch('/api/import/resume', { method: 'POST', body: formData })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.error || `Server error (${response.status})`)
      }
      setParsedResult(await response.json())
    } catch (error: any) {
      const msg = error?.message || ''
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        setErrorMessage(
          'Server backend lokal (port 8000) tidak terhubung. Jalankan start-docbuilder.bat lalu coba lagi.'
        )
      } else {
        setErrorMessage(msg || 'Gagal mem-parsing berkas CV.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmApply = () => {
    if (!parsedResult || !confirmReplace) return
    onApply(parsedResult.data)
    onClose()
  }

  const getConfidenceBadge = (value: number) => {
    const percent = Math.round(value * 100)
    if (percent >= 80) {
      return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Tinggi {percent}%</span>
    }
    if (percent >= 50) {
      return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Perlu cek {percent}%</span>
    }
    return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">Rendah {percent}%</span>
  }

  const previewSections = parsedResult ? [
    {
      title: 'Ringkasan',
      count: parsedResult.data.summary ? 'Terdeteksi' : 'Kosong',
      confidence: parsedResult.confidence.summary,
      content: parsedResult.data.summary || 'Tidak terdeteksi.'
    },
    {
      title: 'Pengalaman Kerja',
      count: `${parsedResult.data.experiences.length} posisi`,
      confidence: parsedResult.confidence.experiences,
      content: parsedResult.data.experiences.map(item =>
        `${item.jobTitle || 'Jabatan belum terbaca'} — ${item.company || 'Perusahaan belum terbaca'}${item.startDate || item.endDate ? ` (${item.startDate || '?'}–${item.endDate || '?'})` : ''}`
      ).join('\n') || 'Tidak terdeteksi.'
    },
    {
      title: 'Pendidikan',
      count: `${parsedResult.data.education.length} institusi`,
      confidence: parsedResult.confidence.education,
      content: parsedResult.data.education.map(item =>
        `${item.institution || 'Institusi belum terbaca'}${item.degree || item.fieldOfStudy ? ` — ${[item.degree, item.fieldOfStudy].filter(Boolean).join(', ')}` : ''}`
      ).join('\n') || 'Tidak terdeteksi.'
    },
    {
      title: 'Keahlian',
      count: `${parsedResult.data.skills.length} item`,
      confidence: parsedResult.confidence.skills,
      content: parsedResult.data.skills.map(item => item.name).join(', ') || 'Tidak terdeteksi.'
    },
    {
      title: 'Bahasa',
      count: `${parsedResult.data.languages.length} bahasa`,
      confidence: parsedResult.confidence.languages,
      content: parsedResult.data.languages.map(item => `${item.language} (${item.proficiency})`).join(', ') || 'Tidak terdeteksi.'
    },
    {
      title: 'Bagian Lain',
      count: `${parsedResult.data.customSections.length} bagian`,
      confidence: parsedResult.confidence.customSections,
      content: parsedResult.data.customSections.map(section => {
        const details = section.items
          .map(item => [item.title, item.subtitle, item.date, item.description].filter(Boolean).join(' — '))
          .filter(Boolean)
          .join('\n')
        return details ? `${section.sectionTitle}\n${details}` : section.sectionTitle
      }).join('\n\n') || 'Tidak terdeteksi.'
    }
  ] : []

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-resume-title"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-slate-200"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><Upload className="h-5 w-5" /></span>
            <div>
              <h2 id="import-resume-title" className="text-base font-bold text-slate-900">Impor Data CV</h2>
              <p className="mt-0.5 text-xs text-slate-500">Ekstrak data PDF/DOCX, tinjau hasil, lalu terapkan ke editor.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup impor CV" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {!parsedResult ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p><strong>Yang diimpor hanya data teks.</strong> Desain, font, warna, gambar, dan posisi kolom asli tidak ikut. PDF hasil scan belum didukung.</p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                data-testid="dropzone-import"
              >
                <FileText className="mx-auto h-10 w-10 text-indigo-500" />
                <span className="mt-3 block text-sm font-semibold text-slate-800">{file ? file.name : 'Pilih berkas CV'}</span>
                <span className="mt-1 block text-xs text-slate-500">PDF atau DOCX berbasis teks, maksimal 25 MB</span>
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx" onChange={handleFileChange} className="hidden" data-testid="input-file-import" />

              {errorMessage && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-indigo-950">{parsedResult.filename}</p>
                    <p className="mt-1 text-xs text-indigo-800">
                      {parsedResult.extraction.sourceFormat} · {parsedResult.extraction.lineCount} baris teks · {parsedResult.extraction.detectedSections.length} bagian terdeteksi
                    </p>
                  </div>
                  {getConfidenceBadge(parsedResult.confidence.overall)}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {parsedResult.extraction.detectedSections.map(section => (
                    <span key={section} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-indigo-700">{section}</span>
                  ))}
                </div>
              </section>

              <section aria-labelledby="import-contact-title">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="import-contact-title" className="text-xs font-bold uppercase tracking-wider text-slate-700">Kontak Terdeteksi</h3>
                  {getConfidenceBadge(parsedResult.confidence.fullName)}
                </div>
                <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2">
                  <p><span className="text-slate-500">Nama:</span> <strong>{parsedResult.data.contact.fullName || 'Tidak terdeteksi'}</strong></p>
                  <p><span className="text-slate-500">Email:</span> <strong>{parsedResult.data.contact.email || 'Tidak terdeteksi'}</strong></p>
                  <p><span className="text-slate-500">Telepon:</span> <strong>{parsedResult.data.contact.phone || 'Tidak terdeteksi'}</strong></p>
                  <p><span className="text-slate-500">Lokasi:</span> <strong>{parsedResult.data.contact.location || 'Tidak terdeteksi'}</strong></p>
                </div>
              </section>

              <section className="space-y-2" aria-labelledby="import-preview-title">
                <div>
                  <h3 id="import-preview-title" className="text-xs font-bold uppercase tracking-wider text-slate-700">Tinjau Semua Bagian</h3>
                  <p className="mt-1 text-xs text-slate-500">Buka setiap bagian dan periksa data sebelum mengganti editor.</p>
                </div>
                {previewSections.map((section, index) => (
                  <details key={section.title} open={index < 2} className="group rounded-xl border border-slate-200 bg-white">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                      <div>
                        <span className="text-sm font-semibold text-slate-900">{section.title}</span>
                        <span className="ml-2 text-xs text-slate-500">{section.count}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getConfidenceBadge(section.confidence)}
                        <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                      </div>
                    </summary>
                    <div className="border-t border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                      {section.content}
                    </div>
                  </details>
                ))}
              </section>

              {parsedResult.extraction.missingSections.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <strong>Belum terdeteksi:</strong> {parsedResult.extraction.missingSections.join(', ')}. Data bagian ini akan kosong bila impor diterapkan.
                </div>
              )}

              <section className="rounded-xl border border-slate-200 p-3">
                <h3 className="flex items-center gap-2 text-xs font-bold text-slate-800"><Sparkles className="h-4 w-4 text-amber-600" /> Catatan Verifikasi</h3>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
                  {parsedResult.warnings.map(warning => <li key={warning}>• {warning}</li>)}
                </ul>
              </section>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                <input
                  type="checkbox"
                  checked={confirmReplace}
                  onChange={event => setConfirmReplace(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-rose-300 text-indigo-600 focus:ring-indigo-500"
                  data-testid="confirm-replace-import"
                />
                <span className="text-xs leading-relaxed text-rose-900">
                  Saya sudah meninjau hasil. Terapkan data ini dan <strong>ganti seluruh isi CV pada editor saat ini</strong>.
                </span>
              </label>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          {!parsedResult ? (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Batal</button>
              <button
                type="button"
                disabled={!file || isLoading}
                onClick={handleUploadAndParse}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                data-testid="btn-start-parse"
              >
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengekstrak...</> : <>Tinjau Hasil <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <button type="button" onClick={resetResult} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Pilih Berkas Lain</button>
              <button
                type="button"
                onClick={handleConfirmApply}
                disabled={!confirmReplace}
                className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                data-testid="btn-confirm-apply"
              >
                <CheckCircle2 className="h-4 w-4" /> Terapkan ke Editor
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}
