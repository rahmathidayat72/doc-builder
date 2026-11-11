import React, { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Layers,
  Loader2,
  ShieldCheck,
  X
} from 'lucide-react'
import {
  type AtsAnalysisResult,
  exportAtsReportDocx,
  exportAtsReportPdf
} from '../../services/ats'
import { KITU_EXPRESSIONS, type KituExpression } from '../brand/kituExpressions'

interface AtsScorePanelProps {
  analysis: AtsAnalysisResult | null
  resumeTitle?: string
  isOpen: boolean
  onClose: () => void
  onEditResume?: () => void
}

export const AtsScorePanel: React.FC<AtsScorePanelProps> = ({
  analysis,
  resumeTitle = 'Resume',
  isOpen,
  onClose,
  onEditResume
}) => {
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all')
  const [isExporting, setIsExporting] = useState<'pdf' | 'docx' | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    dialogRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !analysis) return null

  const getScoreColor = (score: number) => {
    if (score >= 85) return {
      bar: 'bg-emerald-500',
      text: 'text-emerald-700',
      badge: 'bg-emerald-100 text-emerald-800',
      ring: 'border-emerald-200'
    }
    if (score >= 70) return {
      bar: 'bg-sky-500',
      text: 'text-sky-700',
      badge: 'bg-sky-100 text-sky-800',
      ring: 'border-sky-200'
    }
    if (score >= 50) return {
      bar: 'bg-amber-500',
      text: 'text-amber-700',
      badge: 'bg-amber-100 text-amber-800',
      ring: 'border-amber-200'
    }
    return {
      bar: 'bg-rose-500',
      text: 'text-rose-700',
      badge: 'bg-rose-100 text-rose-800',
      ring: 'border-rose-200'
    }
  }

  const getKituExpression = (score: number): KituExpression => {
    if (score >= 85) return 'hore'
    if (score >= 70) return 'semangat'
    if (score >= 50) return 'berpikir'
    return 'kecewa'
  }

  const scoreColor = getScoreColor(analysis.score)
  const failedChecksCount = analysis.totalChecksCount - analysis.passedChecksCount
  const filteredChecklist = analysis.checklist.filter(item => {
    if (filter === 'passed') return item.passed
    if (filter === 'failed') return !item.passed
    return true
  })
  const pillars = [
    { label: 'Kontak', score: analysis.breakdown.contact, total: 25 },
    { label: 'Struktur', score: analysis.breakdown.structure, total: 25 },
    { label: 'Ringkasan', score: analysis.breakdown.summary, total: 20 },
    { label: 'Dampak', score: analysis.breakdown.quantified_impact, total: 20 },
    { label: 'Integritas', score: analysis.breakdown.integrity, total: 10 }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 sm:items-center sm:p-4 animate-overlay-in">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ats-dialog-title"
        aria-describedby="ats-dialog-description"
        tabIndex={-1}
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl outline-none sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl sm:border sm:border-stone-200"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-xl bg-teal-50 p-2.5 text-teal-800 border border-teal-200">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="ats-dialog-title" className="text-base font-bold text-stone-900 sm:text-lg">
                Evaluasi Keterbacaan ATS
              </h2>
              <p id="ats-dialog-description" className="mt-0.5 text-xs text-stone-600">
                Lihat masalah utama, perbaiki CV, lalu evaluasi ulang.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            aria-label="Tutup evaluasi ATS"
            data-testid="btn-close-ats"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="space-y-5">
            <section className="grid gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-[auto_1fr] sm:items-center sm:p-5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 bg-white shadow-2xs ${scoreColor.ring}`}>
                    <span className={`text-3xl font-black leading-none ${scoreColor.text}`} data-testid="ats-score-number">
                      {analysis.score}
                    </span>
                    <span className="mt-1 text-[10px] font-semibold text-stone-500">dari 100</span>
                  </div>
                  <img
                    src={KITU_EXPRESSIONS[getKituExpression(analysis.score)]}
                    alt="Ekspresi Kitu"
                    className="absolute -bottom-2 -right-3 w-10 h-10 object-contain drop-shadow-sm select-none pointer-events-none"
                  />
                </div>
                <div className="sm:hidden">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${scoreColor.badge}`}>
                    Grade {analysis.gradeCode}
                  </span>
                  <p className="mt-2 text-xs text-stone-600">{analysis.grade}</p>
                </div>
              </div>

              <div className="min-w-0">
                <div className="hidden items-center justify-between gap-3 sm:flex">
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${scoreColor.badge}`}>
                      Grade {analysis.gradeCode}: {analysis.grade}
                    </span>
                    <p className="mt-2 text-sm text-stone-600">
                      {analysis.passedChecksCount} indikator lolos, {failedChecksCount} perlu diperbaiki.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-stone-600">{analysis.score}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-stone-200 sm:mt-4">
                  <div
                    className={`h-full rounded-full transition-all ${scoreColor.bar}`}
                    style={{ width: `${analysis.score}%` }}
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 text-xs text-stone-600 sm:hidden">
                  {analysis.passedChecksCount} indikator lolos, {failedChecksCount} perlu diperbaiki.
                </p>
              </div>
            </section>

            {analysis.recommendations.length > 0 ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5" aria-labelledby="ats-priority-title">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-amber-100 p-2 text-amber-700">
                    <Info className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 id="ats-priority-title" className="text-sm font-bold text-amber-950">
                      Perbaiki ini lebih dulu
                    </h3>
                    <p className="mt-1 text-xs text-amber-800">
                      Mulai dari urutan teratas untuk menaikkan skor secara bertahap.
                    </p>
                  </div>
                </div>
                <ol className="mt-4 space-y-2.5">
                  {analysis.recommendations.map((recommendation, index) => (
                    <li key={recommendation} className="flex items-start gap-3 text-sm text-amber-950">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-amber-700 shadow-2xs">
                        {index + 1}
                      </span>
                      <span className="pt-0.5 leading-relaxed">{recommendation}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : (
              <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-900">Semua pemeriksaan utama lolos</h3>
                  <p className="mt-1 text-xs text-emerald-800">CV sudah memiliki struktur dasar yang ramah ATS.</p>
                </div>
              </section>
            )}

            <section aria-labelledby="ats-pillars-title">
              <h3 id="ats-pillars-title" className="flex items-center gap-2 text-xs font-bold text-stone-800">
                <Layers className="h-4 w-4 text-teal-800" />
                Rincian 5 Pilar Penilaian
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {pillars.map(pillar => (
                  <div key={pillar.label} className="rounded-xl border border-stone-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-stone-600">{pillar.label}</span>
                      <span className="text-xs font-bold text-stone-900 tabular-nums">{pillar.score}/{pillar.total}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-teal-800"
                        style={{ width: `${(pillar.score / pillar.total) * 100}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="ats-checklist-title">
              <div className="flex flex-col gap-3 border-b border-stone-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 id="ats-checklist-title" className="text-xs font-bold text-stone-800">
                    Detail Pemeriksaan
                  </h3>
                  <p className="mt-1 text-xs text-stone-600">Pilih status untuk mempersempit daftar.</p>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-200/70 p-1 text-[11px] font-semibold" aria-label="Filter pemeriksaan">
                  {([
                    ['all', `Semua (${analysis.totalChecksCount})`],
                    ['failed', `Perlu Cek (${failedChecksCount})`],
                    ['passed', `Lolos (${analysis.passedChecksCount})`]
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      aria-pressed={filter === value}
                      className={`rounded-lg px-2 py-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                        filter === value ? 'bg-white text-teal-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {filteredChecklist.map(item => (
                  <div
                    key={`${item.category}-${item.item}`}
                    className={`flex items-start gap-3 rounded-xl border p-3 ${
                      item.passed ? 'border-stone-200 bg-white' : 'border-rose-200 bg-rose-50/60'
                    }`}
                  >
                    {item.passed ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <span className="text-xs font-semibold text-stone-900">{item.item}</span>
                        <span className="shrink-0 text-[10px] font-semibold text-stone-500">Bobot {item.impact} poin</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-stone-600">{item.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex items-start gap-2 rounded-xl bg-stone-100 p-3 text-xs leading-relaxed text-stone-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
              <p>{analysis.disclaimer}</p>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-stone-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                disabled={isExporting !== null}
                onClick={async () => {
                  setIsExporting('docx')
                  try {
                    await exportAtsReportDocx(analysis, resumeTitle)
                  } catch (err: any) {
                    alert(err.message)
                  } finally {
                    setIsExporting(null)
                  }
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-800 transition hover:bg-stone-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                data-testid="btn-export-report-docx"
              >
                {isExporting === 'docx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Laporan Word
              </button>
              <button
                type="button"
                disabled={isExporting !== null}
                onClick={async () => {
                  setIsExporting('pdf')
                  try {
                    await exportAtsReportPdf(analysis, resumeTitle)
                  } catch (err: any) {
                    alert(err.message)
                  } finally {
                    setIsExporting(null)
                  }
                }}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-800 transition hover:bg-stone-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                data-testid="btn-export-report-pdf"
              >
                {isExporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Laporan PDF
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onEditResume?.()
                onClose()
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-bold text-white shadow-2xs transition hover:bg-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              data-testid="btn-edit-resume"
            >
              {failedChecksCount > 0 ? 'Perbaiki CV Sekarang' : 'Kembali ke Editor'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
