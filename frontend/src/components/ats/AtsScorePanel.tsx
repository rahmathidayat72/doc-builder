import React, { useState } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  X,
  Layers,
  Info,
  Download,
  FileText,
  Loader2
} from 'lucide-react'
import {
  type AtsAnalysisResult,
  exportAtsReportDocx,
  exportAtsReportPdf
} from '../../services/ats'

interface AtsScorePanelProps {
  analysis: AtsAnalysisResult | null
  resumeTitle?: string
  isOpen: boolean
  onClose: () => void
}

export const AtsScorePanel: React.FC<AtsScorePanelProps> = ({
  analysis,
  resumeTitle = 'Resume',
  isOpen,
  onClose
}) => {
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all')
  const [isExporting, setIsExporting] = useState<'pdf' | 'docx' | null>(null)

  if (!isOpen || !analysis) return null

  const getScoreColor = (score: number) => {
    if (score >= 85) return { bg: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100' }
    if (score >= 70) return { bg: 'bg-sky-500', text: 'text-sky-700', badge: 'bg-sky-100' }
    if (score >= 50) return { bg: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-100' }
    return { bg: 'bg-rose-500', text: 'text-rose-700', badge: 'bg-rose-100' }
  }

  const scoreColor = getScoreColor(analysis.score)

  const filteredChecklist = analysis.checklist.filter(item => {
    if (filter === 'passed') return item.passed
    if (filter === 'failed') return !item.passed
    return true
  })

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Evaluasi Keterbacaan ATS</h3>
              <p className="text-xs text-slate-500">
                Pemeriksaan deterministik 5 pilar format ramah mesin penyaring resume.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
            data-testid="btn-close-ats"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto pr-1 space-y-5 flex-1">
          {/* Score Header Card */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-4">
              {/* Radial Score Circle */}
              <div className="relative w-16 h-16 rounded-full flex items-center justify-center bg-white shadow-xs border-4 border-slate-100">
                <span className={`text-xl font-black ${scoreColor.text}`} data-testid="ats-score-number">
                  {analysis.score}
                </span>
                <span className="text-3xs text-slate-400 absolute bottom-1">/100</span>
              </div>

              <div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold inline-block mb-1 ${scoreColor.badge} ${scoreColor.text}`}>
                  Grade {analysis.gradeCode}: {analysis.grade}
                </span>
                <p className="text-xs text-slate-600">
                  {analysis.passedChecksCount} dari {analysis.totalChecksCount} indikator keterbacaan lolos uji.
                </p>
              </div>
            </div>

            {/* Quick Summary Pill */}
            <div className="text-xs font-medium text-slate-500 text-center sm:text-right">
              Pilar Integritas & Anti-Stuffing:{' '}
              <strong className="text-slate-800">{analysis.breakdown.integrity}/10</strong>
            </div>
          </div>

          {/* 5 Pillars Breakdown Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Rincian 5 Pilar Penilaian
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-3xs text-slate-400 font-semibold block uppercase">Kontak</span>
                <span className="text-sm font-bold text-slate-800">{analysis.breakdown.contact}/25</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-3xs text-slate-400 font-semibold block uppercase">Struktur</span>
                <span className="text-sm font-bold text-slate-800">{analysis.breakdown.structure}/25</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-3xs text-slate-400 font-semibold block uppercase">Ringkasan</span>
                <span className="text-sm font-bold text-slate-800">{analysis.breakdown.summary}/20</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                <span className="text-3xs text-slate-400 font-semibold block uppercase">Dampak Metrik</span>
                <span className="text-sm font-bold text-slate-800">{analysis.breakdown.quantified_impact}/20</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl col-span-2 sm:col-span-1">
                <span className="text-3xs text-slate-400 font-semibold block uppercase">Integritas</span>
                <span className="text-sm font-bold text-slate-800">{analysis.breakdown.integrity}/10</span>
              </div>
            </div>
          </div>

          {/* Rekomendasi Perbaikan Jika Ada */}
          {analysis.recommendations.length > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <h5 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Rekomendasi Tindakan Prioritas:
              </h5>
              <ul className="text-2xs text-amber-800 list-disc list-inside space-y-1">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Checklist Indikator Detail */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Indikator Pemeriksaan ({filteredChecklist.length})
              </h4>

              {/* Filter Tabs */}
              <div className="flex gap-1 text-3xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-2 py-0.5 rounded-md transition ${
                    filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Semua ({analysis.totalChecksCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('failed')}
                  className={`px-2 py-0.5 rounded-md transition ${
                    filter === 'failed' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Perlu Cek ({analysis.totalChecksCount - analysis.passedChecksCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('passed')}
                  className={`px-2 py-0.5 rounded-md transition ${
                    filter === 'passed' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Lolos ({analysis.passedChecksCount})
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {filteredChecklist.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition ${
                    item.passed ? 'bg-white border-slate-200' : 'bg-red-50/40 border-red-200'
                  }`}
                >
                  {item.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">{item.item}</span>
                      <span className="text-3xs font-mono text-slate-400">+{item.impact} poin</span>
                    </div>
                    <p className="text-2xs text-slate-500 mt-0.5 leading-relaxed">{item.tip}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Disclaimer & Download Buttons */}
        <div className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-2xs text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-400 flex-1">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span className="text-3xs italic leading-tight">{analysis.disclaimer}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5"
              data-testid="btn-export-report-docx"
            >
              {isExporting === 'docx' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
              )}
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
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-xs"
              data-testid="btn-export-report-pdf"
            >
              {isExporting === 'pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Unduh Laporan PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
