import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Printer,
  Wrench,
  X
} from 'lucide-react'
import { type ResumeDraft } from '../../types/resume'
import { type ResumeSectionId, RESUME_SECTION_LABELS } from '../../types/resumeSections'
import {
  analyzeResumeQuality,
  type ResumeQualityIssue
} from '../../services/resumeQuality'
import { normalizeExportFilename } from '../../services/export'

export type ExportFormat = 'pdf' | 'docx' | 'print'

interface ExportResumeModalProps {
  isOpen: boolean
  draft: ResumeDraft | null
  pageCount: number
  initialFormat?: ExportFormat
  isExporting?: boolean
  onClose: () => void
  onExport: (format: ExportFormat, filename: string) => Promise<void> | void
  onFixIssue: (section: ResumeSectionId) => void
}

const FORMAT_OPTIONS: Array<{
  id: ExportFormat
  label: string
  description: string
  icon: typeof FileText
  extension: string
}> = [
  {
    id: 'pdf',
    label: 'PDF',
    description: 'Paling cocok untuk melamar kerja dan menjaga tata letak.',
    icon: FileText,
    extension: '.pdf'
  },
  {
    id: 'docx',
    label: 'Word',
    description: 'Dapat diedit kembali di Microsoft Word atau aplikasi serupa.',
    icon: FileText,
    extension: '.docx'
  },
  {
    id: 'print',
    label: 'Cetak',
    description: 'Buka dialog cetak browser, termasuk opsi Save as PDF.',
    icon: Printer,
    extension: 'Cetak'
  }
]

const IssueRow: React.FC<{
  issue: ResumeQualityIssue
  onFix: (section: ResumeSectionId) => void
}> = ({ issue, onFix }) => {
  const isError = issue.severity === 'error'
  return (
    <li
      className={`flex items-start gap-2.5 rounded-lg border p-3 ${
        isError ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/70'
      }`}
      data-testid={`quality-issue-${issue.id}`}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-800">{issue.title}</span>
          <span className="rounded bg-white/80 px-1.5 py-0.5 text-3xs font-semibold text-slate-500">
            {RESUME_SECTION_LABELS[issue.section]}
          </span>
        </div>
        <p className="mt-1 text-2xs leading-relaxed text-slate-600">{issue.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onFix(issue.section)}
        className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-2xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
        data-testid={`btn-fix-${issue.id}`}
      >
        <Wrench className="h-3 w-3" aria-hidden="true" />
        Perbaiki
      </button>
    </li>
  )
}

export const ExportResumeModal: React.FC<ExportResumeModalProps> = ({
  isOpen,
  draft,
  pageCount,
  initialFormat = 'pdf',
  isExporting = false,
  onClose,
  onExport,
  onFixIssue
}) => {
  const [format, setFormat] = useState<ExportFormat>(initialFormat)
  const [filename, setFilename] = useState(draft?.title || 'Resume')
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting && !isExporting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isExporting, isOpen, isSubmitting, onClose])

  if (!isOpen || !draft) return null

  const report = analyzeResumeQuality(draft, { pageCount })
  const safeFilename = normalizeExportFilename(filename, '')
  const filenameIsValid = safeFilename.length > 0
  const busy = isSubmitting || isExporting
  const canExport =
    report.errors.length === 0 &&
    filenameIsValid &&
    (report.warnings.length === 0 || acknowledgedWarnings) &&
    !busy

  const selectedFormat = FORMAT_OPTIONS.find(option => option.id === format) ?? FORMAT_OPTIONS[0]

  const handleExport = async () => {
    if (!canExport) return
    setIsSubmitting(true)
    setExportError(null)
    try {
      await onExport(format, safeFilename)
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Ekspor gagal. Silakan coba lagi.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-overlay-in"
      role="presentation"
      data-testid="export-modal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <p className="text-2xs font-bold uppercase tracking-widest text-indigo-600">
              Pemeriksaan sebelum ekspor
            </p>
            <h2 id="export-modal-title" className="mt-1 text-lg font-black text-slate-900">
              Unduh CV
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Periksa hasil akhir agar CV tidak terpotong atau kehilangan informasi penting.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Tutup modal ekspor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Halaman</p>
              <p className="mt-1 text-lg font-black text-slate-900" data-testid="export-page-count">
                {report.pageCount}
              </p>
            </div>
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Skor kesiapan</p>
              <p
                className={`mt-1 text-lg font-black ${
                  report.errors.length > 0
                    ? 'text-red-600'
                    : report.warnings.length > 0
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                }`}
                data-testid="export-quality-score"
              >
                {report.score}/100
              </p>
            </div>
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Temuan</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">
                {report.errors.length} error · {report.warnings.length} peringatan
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-800">Format berkas</p>
            <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Format ekspor">
              {FORMAT_OPTIONS.map(option => {
                const Icon = option.icon
                const selected = option.id === format
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFormat(option.id)}
                    disabled={busy}
                    aria-pressed={selected}
                    className={`rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    data-testid={`export-format-${option.id}`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Icon className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                      {option.label}
                    </span>
                    <span className="mt-1 block text-2xs leading-relaxed text-slate-500">
                      {option.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="export-filename" className="block text-xs font-bold text-slate-800">
              Nama berkas
            </label>
            <div className="mt-1.5 flex overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-indigo-500">
              <input
                id="export-filename"
                type="text"
                value={filename}
                onChange={event => setFilename(event.target.value)}
                disabled={busy}
                maxLength={120}
                className="min-w-0 flex-1 px-3 py-2 text-sm text-slate-800 outline-none disabled:bg-slate-50"
                data-testid="input-export-filename"
              />
              <span className="flex items-center border-l border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-500">
                {selectedFormat.extension}
              </span>
            </div>
            {!filenameIsValid && (
              <p className="mt-1 text-2xs font-medium text-red-600">Nama berkas wajib diisi.</p>
            )}
          </div>

          <div className="space-y-3">
            {report.errors.length === 0 && report.warnings.length === 0 ? (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <p className="text-xs text-emerald-800">
                  Semua pemeriksaan penting terpenuhi. CV siap diekspor.
                </p>
              </div>
            ) : null}

            {report.errors.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
                  <h3 className="text-xs font-bold text-slate-800">Harus diperbaiki</h3>
                </div>
                <ul className="space-y-2">
                  {report.errors.map(issue => (
                    <IssueRow key={issue.id} issue={issue} onFix={onFixIssue} />
                  ))}
                </ul>
              </div>
            )}

            {report.warnings.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  <h3 className="text-xs font-bold text-slate-800">Saran perbaikan</h3>
                </div>
                <ul className="space-y-2">
                  {report.warnings.map(issue => (
                    <IssueRow key={issue.id} issue={issue} onFix={onFixIssue} />
                  ))}
                </ul>
                <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <input
                    type="checkbox"
                    checked={acknowledgedWarnings}
                    onChange={event => setAcknowledgedWarnings(event.target.checked)}
                    disabled={busy}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    data-testid="checkbox-ack-warnings"
                  />
                  <span className="text-2xs leading-relaxed text-amber-800">
                    Saya sudah memeriksa peringatan ini dan tetap ingin melanjutkan ekspor.
                  </span>
                </label>
              </div>
            )}
          </div>

          {exportError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
              {exportError}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-2xs leading-relaxed text-slate-500">
            {report.errors.length > 0
              ? 'Perbaiki error terlebih dahulu sebelum mengunduh.'
              : report.warnings.length > 0 && !acknowledgedWarnings
                ? 'Centang konfirmasi peringatan untuk melanjutkan.'
                : `Berkas akan disimpan sebagai ${safeFilename || 'Resume'}${selectedFormat.extension === 'Cetak' ? '' : selectedFormat.extension}.`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!canExport}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              data-testid="btn-confirm-export"
            >
              {busy ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : format === 'print' ? (
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {busy ? 'Memproses...' : format === 'print' ? 'Buka Cetak' : `Unduh ${selectedFormat.label}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
