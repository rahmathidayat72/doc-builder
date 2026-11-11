import React, { useRef, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileText,
  Info,
  Loader2,
  Upload,
  X
} from 'lucide-react'
import { type ResumeData } from '../../types/resume'
import {
  DEFAULT_IMPORT_SECTIONS,
  type ImportMode,
  type ImportSectionId
} from '../../services/importMerge'
import { apiFetch } from '../../services/apiClient'
import { KituNotice } from '../brand/KituNotice'

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
  onApply: (
    extractedData: ResumeData,
    selectedSections: ImportSectionId[],
    mode: ImportMode
  ) => void
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
  const [confirmApply, setConfirmApply] = useState(false)
  const [selectedSections, setSelectedSections] = useState<ImportSectionId[]>([
    ...DEFAULT_IMPORT_SECTIONS
  ])
  const [importMode, setImportMode] = useState<ImportMode>('merge')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const resetResult = () => {
    setParsedResult(null)
    setConfirmApply(false)
    setSelectedSections([...DEFAULT_IMPORT_SECTIONS])
    setImportMode('merge')
  }

  const toggleSection = (section: ImportSectionId) => {
    setSelectedSections(current =>
      current.includes(section)
        ? current.filter(item => item !== section)
        : [...current, section]
    )
    setConfirmApply(false)
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
    if (!parsedResult || !confirmApply || selectedSections.length === 0) return
    onApply(parsedResult.data, selectedSections, importMode)
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

  const previewSections: {
    id: ImportSectionId
    title: string
    count: string
    confidence: number
    content: string
  }[] = parsedResult ? [
    {
      id: 'summary',
      title: 'Ringkasan',
      count: parsedResult.data.summary ? 'Terdeteksi' : 'Kosong',
      confidence: parsedResult.confidence.summary,
      content: parsedResult.data.summary || 'Tidak terdeteksi.'
    },
    {
      id: 'experiences',
      title: 'Pengalaman Kerja',
      count: `${parsedResult.data.experiences.length} posisi`,
      confidence: parsedResult.confidence.experiences,
      content: parsedResult.data.experiences.map(item =>
        `${item.jobTitle || 'Jabatan belum terbaca'} — ${item.company || 'Perusahaan belum terbaca'}${item.startDate || item.endDate ? ` (${item.startDate || '?'}–${item.endDate || '?'})` : ''}`
      ).join('\n') || 'Tidak terdeteksi.'
    },
    {
      id: 'education',
      title: 'Pendidikan',
      count: `${parsedResult.data.education.length} institusi`,
      confidence: parsedResult.confidence.education,
      content: parsedResult.data.education.map(item =>
        `${item.institution || 'Institusi belum terbaca'}${item.degree || item.fieldOfStudy ? ` — ${[item.degree, item.fieldOfStudy].filter(Boolean).join(', ')}` : ''}`
      ).join('\n') || 'Tidak terdeteksi.'
    },
    {
      id: 'skills',
      title: 'Keahlian',
      count: `${parsedResult.data.skills.length} item`,
      confidence: parsedResult.confidence.skills,
      content: parsedResult.data.skills.map(item => item.name).join(', ') || 'Tidak terdeteksi.'
    },
    {
      id: 'languages',
      title: 'Bahasa',
      count: `${parsedResult.data.languages.length} bahasa`,
      confidence: parsedResult.confidence.languages,
      content: parsedResult.data.languages.map(item => `${item.language} (${item.proficiency})`).join(', ') || 'Tidak terdeteksi.'
    },
    {
      id: 'customSections',
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 sm:items-center sm:p-4 animate-overlay-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-resume-title"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-stone-200"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200 px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-teal-50 p-2.5 text-teal-800 border border-teal-200"><Upload className="h-5 w-5" /></span>
            <div>
              <h2 id="import-resume-title" className="text-base font-bold text-stone-900">Impor Data CV</h2>
              <p className="mt-0.5 text-xs text-stone-600">Ekstrak data PDF/DOCX, tinjau hasil, lalu terapkan ke editor.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup impor CV" className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {!parsedResult ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed text-stone-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" />
                <p><strong>Yang diimpor hanya data teks.</strong> Desain, font, warna, gambar, dan posisi kolom asli tidak ikut. PDF hasil scan belum didukung.</p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 p-8 text-center transition hover:border-teal-700 hover:bg-teal-50/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                data-testid="dropzone-import"
              >
                <FileText className="mx-auto h-10 w-10 text-teal-800" />
                <span className="mt-3 block text-sm font-semibold text-stone-900">{file ? file.name : 'Pilih berkas CV'}</span>
                <span className="mt-1 block text-xs text-stone-600">PDF atau DOCX berbasis teks, maksimal 25 MB</span>
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx" onChange={handleFileChange} className="hidden" data-testid="input-file-import" />

              {errorMessage && (
                <KituNotice tone="error" expression="kecewa" title="Kendala Berkas">
                  <span>{errorMessage}</span>
                </KituNotice>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <section className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-stone-900">{parsedResult.filename}</p>
                    <p className="mt-1 text-xs text-stone-700">
                      {parsedResult.extraction.sourceFormat} · {parsedResult.extraction.lineCount} baris teks · {parsedResult.extraction.detectedSections.length} bagian terdeteksi
                    </p>
                  </div>
                  {getConfidenceBadge(parsedResult.confidence.overall)}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {parsedResult.extraction.detectedSections.map(section => (
                    <span key={section} className="rounded-md bg-white border border-stone-200 px-2.5 py-1 text-[10px] font-semibold text-stone-800">{section}</span>
                  ))}
                </div>
              </section>

              <section aria-labelledby="import-contact-title">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="import-contact-title" className="text-xs font-bold text-stone-800">Kontak Terdeteksi</h3>
                  <div className="flex items-center gap-2">
                    {getConfidenceBadge(parsedResult.confidence.fullName)}
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2 py-1 text-2xs font-semibold text-stone-700">
                      <input
                        type="checkbox"
                        checked={selectedSections.includes('contact')}
                        onChange={() => toggleSection('contact')}
                        className="h-3.5 w-3.5 rounded border-stone-300 text-teal-800 focus:ring-teal-700 accent-teal-800"
                        data-testid="import-section-contact"
                      />
                      Impor
                    </label>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs sm:grid-cols-2">
                  <p><span className="text-stone-600">Nama:</span> <strong>{parsedResult.data.contact.fullName || 'Tidak terdeteksi'}</strong></p>
                  <p><span className="text-stone-600">Headline:</span> <strong>{parsedResult.data.contact.headline || 'Tidak terdeteksi'}</strong></p>
                  <p><span className="text-stone-600">Email:</span> <strong>{parsedResult.data.contact.email || 'Tidak terdeteksi'}</strong></p>
                  <p><span className="text-stone-600">Telepon:</span> <strong>{parsedResult.data.contact.phone || 'Tidak terdeteksi'}</strong></p>
                  <p><span className="text-stone-600">Lokasi:</span> <strong>{parsedResult.data.contact.location || 'Tidak terdeteksi'}</strong></p>
                </div>
              </section>

              <section className="rounded-xl border border-stone-200 bg-white p-3" aria-labelledby="import-mode-title">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="import-mode-title" className="text-xs font-bold text-stone-800">Cara menerapkan</h3>
                  <div className="flex gap-2 text-2xs font-semibold">
                    <button type="button" onClick={() => setSelectedSections([...DEFAULT_IMPORT_SECTIONS])} className="text-teal-800 hover:text-teal-950">Pilih semua</button>
                    <span className="text-stone-300">•</span>
                    <button type="button" onClick={() => setSelectedSections([])} className="text-stone-600 hover:text-stone-900">Kosongkan</button>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className={`cursor-pointer rounded-lg border p-2.5 text-xs ${importMode === 'merge' ? 'border-teal-700 bg-teal-50/70' : 'border-stone-200'}`}>
                    <span className="flex items-start gap-2">
                      <input type="radio" name="import-mode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} className="mt-0.5 h-3.5 w-3.5 text-teal-800 accent-teal-800" data-testid="import-mode-merge" />
                      <span><strong className="block text-stone-900">Gabungkan</strong><span className="text-stone-600">Tambah item baru, pertahankan isi CV saat ini.</span></span>
                    </span>
                  </label>
                  <label className={`cursor-pointer rounded-lg border p-2.5 text-xs ${importMode === 'replace' ? 'border-amber-400 bg-amber-50' : 'border-stone-200'}`}>
                    <span className="flex items-start gap-2">
                      <input type="radio" name="import-mode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="mt-0.5 h-3.5 w-3.5 text-amber-600" data-testid="import-mode-replace" />
                      <span><strong className="block text-stone-900">Timpa bagian terpilih</strong><span className="text-stone-600">Ganti bagian yang dicentang dengan hasil impor.</span></span>
                    </span>
                  </label>
                </div>
              </section>

              <section className="space-y-2" aria-labelledby="import-preview-title">
                <div>
                  <h3 id="import-preview-title" className="text-xs font-bold text-stone-800">Tinjau Semua Bagian</h3>
                  <p className="mt-1 text-xs text-stone-600">Centang bagian yang ingin diterapkan, lalu buka untuk memeriksa datanya.</p>
                </div>
                {previewSections.map((section, index) => (
                  <div key={section.id} className="flex items-start gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 py-3 text-2xs font-semibold text-stone-700">
                      <input
                        type="checkbox"
                        checked={selectedSections.includes(section.id)}
                        onChange={() => toggleSection(section.id)}
                        className="h-4 w-4 rounded border-stone-300 text-teal-800 focus:ring-teal-700 accent-teal-800"
                        aria-label={`Impor bagian ${section.title}`}
                        data-testid={`import-section-${section.id}`}
                      />
                      Impor
                    </label>
                    <details open={index < 2} className="group min-w-0 flex-1 rounded-xl border border-stone-200 bg-white">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                        <div>
                          <span className="text-sm font-semibold text-stone-900">{section.title}</span>
                          <span className="ml-2 text-xs text-stone-600">{section.count}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getConfidenceBadge(section.confidence)}
                          <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
                        </div>
                      </summary>
                      <div className="border-t border-stone-200 bg-stone-50 px-3 py-3 text-xs leading-relaxed text-stone-800 whitespace-pre-line">
                        {section.content}
                      </div>
                    </details>
                  </div>
                ))}
              </section>

              {parsedResult.extraction.missingSections.length > 0 && (
                <KituNotice tone="warning" expression="penasaran" title="Bagian Belum Terdeteksi">
                  <span>
                    <strong>Belum terdeteksi:</strong> {parsedResult.extraction.missingSections.join(', ')}. Data bagian ini akan kosong bila impor diterapkan.
                  </span>
                </KituNotice>
              )}

              <section className="rounded-xl border border-stone-200 p-3">
                <h3 className="flex items-center gap-2 text-xs font-bold text-stone-900"><Info className="h-4 w-4 text-amber-600" /> Catatan Verifikasi</h3>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-stone-700">
                  {parsedResult.warnings.map(warning => <li key={warning}>• {warning}</li>)}
                </ul>
              </section>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                <input
                  type="checkbox"
                  checked={confirmApply}
                  onChange={event => setConfirmApply(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-rose-300 text-teal-800 focus:ring-teal-700 accent-teal-800"
                  data-testid="confirm-replace-import"
                />
                <span className="text-xs leading-relaxed text-rose-900">
                  Saya sudah meninjau hasil. Terapkan <strong>{selectedSections.length} bagian terpilih</strong> dengan mode <strong>{importMode === 'merge' ? 'gabungkan' : 'timpa bagian terpilih'}</strong>. Perubahan dapat diurungkan setelah diterapkan.
                </span>
              </label>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-stone-200 bg-white px-4 py-3 sm:px-6">
          {!parsedResult ? (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100">Batal</button>
              <button
                type="button"
                disabled={!file || isLoading}
                onClick={handleUploadAndParse}
                className="flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
                data-testid="btn-start-parse"
              >
                {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengekstrak...</> : <>Tinjau Hasil <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <button type="button" onClick={resetResult} className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100">Pilih Berkas Lain</button>
              <button
                type="button"
                onClick={handleConfirmApply}
                disabled={!confirmApply || selectedSections.length === 0}
                className="flex items-center justify-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
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
