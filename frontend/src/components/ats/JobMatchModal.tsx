import React, { useState } from 'react'
import {
  Briefcase,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  ArrowRight,
  Loader2,
  FileSearch,
  Check
} from 'lucide-react'
import { type ResumeDraft } from '../../types/resume'
import { matchResumeToJob, type JobMatchResult } from '../../services/ats'

interface JobMatchModalProps {
  draft: ResumeDraft | null
  isOpen: boolean
  onClose: () => void
}

const SAMPLE_JOB_DESC = `Dibutuhkan Senior Backend Engineer.
Kualifikasi:
- Menguasai Python dan framework FastAPI atau Django.
- Mahir dalam perancangan database PostgreSQL atau MySQL.
- Pengalaman dengan Docker, Git, dan arsitektur REST API microservices.
- Nilai tambah: Pengalaman dengan Redis, Pytest, dan Linux deployment.`

export const JobMatchModal: React.FC<JobMatchModalProps> = ({
  draft,
  isOpen,
  onClose
}) => {
  const [jobText, setJobText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null)

  if (!isOpen || !draft) return null

  const handleRunMatch = async () => {
    if (!jobText.trim()) return

    setIsLoading(true)
    try {
      const result = await matchResumeToJob(draft, jobText)
      setMatchResult(result)
    } catch (err) {
      console.error('Gagal menjalankan komparasi lowongan:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-300'
    if (score >= 50) return 'text-sky-700 bg-sky-50 border-sky-300'
    return 'text-amber-700 bg-amber-50 border-amber-300'
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Pencocokan Lowongan Kerja (Job Matching)</h3>
              <p className="text-xs text-slate-500">
                Bandingkan kata kunci kualifikasi lowongan terhadap isi CV Anda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
            data-testid="btn-close-job-match"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="overflow-y-auto space-y-4 flex-1 pr-1">
          {/* Input Area Deskripsi Pekerjaan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Tempel Deskripsi Lowongan Kerja (Job Description)
              </label>
              <button
                type="button"
                onClick={() => setJobText(SAMPLE_JOB_DESC)}
                className="text-2xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                + Masukkan Contoh Lowongan
              </button>
            </div>

            <textarea
              rows={5}
              placeholder="Tempel deskripsi lowongan kerja di sini (kualifikasi, requirements, tanggung jawab)..."
              value={jobText}
              onChange={e => setJobText(e.target.value)}
              className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
              data-testid="textarea-job-desc"
            />

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!jobText.trim() || isLoading}
                onClick={handleRunMatch}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                data-testid="btn-run-match"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menganalisis Kecocokan...
                  </>
                ) : (
                  <>
                    <FileSearch className="w-3.5 h-3.5" />
                    Analisis Kecocokan Kata Kunci
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Hasil Komparasi */}
          {matchResult && (
            <div className="space-y-4 border-t pt-4">
              {/* Score Highlight Card */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${getScoreColor(matchResult.match_score)}`}>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center font-black text-xl shadow-xs">
                    {Math.round(matchResult.match_score)}%
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Skor Kecocokan Keahlian</h4>
                    <p className="text-xs text-slate-600">
                      {matchResult.matched_count} dari {matchResult.total_job_skills} kata kunci kualifikasi lowongan ditemukan di CV Anda.
                    </p>
                  </div>
                </div>

                <div className="text-right text-xs">
                  <span className="text-3xs text-slate-500 block uppercase font-bold">Konteks Relevansi</span>
                  <span className="font-bold text-slate-800 text-sm">BM25: {matchResult.bm25_score}%</span>
                </div>
              </div>

              {/* Matched Skills */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Keahlian yang Cocok ({matchResult.matched_skills.length}):
                </span>
                {matchResult.matched_skills.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Belum ada keahlian yang cocok ditemukan.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {matchResult.matched_skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3 text-emerald-700" />
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Missing Skills */}
              {matchResult.missing_skills.length > 0 && (
                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-1.5">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Keahlian yang Diminta Lowongan tapi Belum Ada di CV ({matchResult.missing_skills.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {matchResult.missing_skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-900 border border-amber-300"
                      >
                        + {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actionable Advice */}
              {matchResult.advice.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Panduan Penyesuaian CV:
                  </span>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-1 pt-1">
                    {matchResult.advice.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}
