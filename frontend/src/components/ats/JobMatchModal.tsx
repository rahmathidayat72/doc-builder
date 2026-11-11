import React, { useState } from 'react'
import {
  Briefcase,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  Loader2,
  FileSearch,
  Check,
  CopyPlus
} from 'lucide-react'
import { type ResumeDraft } from '../../types/resume'
import { matchResumeToJob, type JobMatchResult } from '../../services/ats'
import { KituNotice } from '../brand/KituNotice'

export interface TargetedDraftRequest {
  title: string
  company: string
  description: string
  matchedSkills: string[]
}

interface JobMatchModalProps {
  draft: ResumeDraft | null
  isOpen: boolean
  onClose: () => void
  onCreateTargetedDraft?: (target: TargetedDraftRequest) => Promise<void>
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
  onClose,
  onCreateTargetedDraft
}) => {
  const [jobText, setJobText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null)
  const [targetTitle, setTargetTitle] = useState('')
  const [targetCompany, setTargetCompany] = useState('')
  const [isCreatingTarget, setIsCreatingTarget] = useState(false)
  const [targetError, setTargetError] = useState<string | null>(null)

  if (!isOpen || !draft) return null

  const handleRunMatch = async () => {
    if (!jobText.trim()) return

    setIsLoading(true)
    setTargetError(null)
    try {
      const result = await matchResumeToJob(draft, jobText)
      setMatchResult(result)
      if (!targetTitle.trim()) {
        const firstLine = jobText
          .split('\n')
          .map(line => line.trim())
          .find(line => line && !/^(kualifikasi|qualifications|tanggung jawab|responsibilities)/i.test(line))
        if (firstLine) {
          const suggested = firstLine
            .replace(/^dibutuhkan\s+/i, '')
            .replace(/[.:;]+$/, '')
            .slice(0, 100)
          setTargetTitle(suggested)
        }
      }
    } catch (err) {
      console.error('Gagal menjalankan komparasi lowongan:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTargetedDraft = async () => {
    if (!onCreateTargetedDraft || !matchResult || !targetTitle.trim()) return
    setIsCreatingTarget(true)
    setTargetError(null)
    try {
      await onCreateTargetedDraft({
        title: targetTitle.trim(),
        company: targetCompany.trim(),
        description: jobText,
        matchedSkills: matchResult.matched_skills
      })
      onClose()
    } catch (err) {
      setTargetError(
        err instanceof Error ? err.message : 'Gagal membuat draft target.'
      )
    } finally {
      setIsCreatingTarget(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-300'
    if (score >= 50) return 'text-sky-700 bg-sky-50 border-sky-300'
    return 'text-amber-700 bg-amber-50 border-amber-300'
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-overlay-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-stone-200 animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 text-teal-800 border border-teal-200 rounded-lg">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Pencocokan Lowongan Kerja (Job Matching)</h3>
              <p className="text-xs text-stone-600">
                Bandingkan kata kunci kualifikasi lowongan terhadap isi CV Anda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-500 hover:text-stone-800 p-1.5 rounded-lg transition"
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
              <label className="block text-xs font-semibold text-stone-800">
                Tempel Deskripsi Lowongan Kerja (Job Description)
              </label>
              <button
                type="button"
                onClick={() => setJobText(SAMPLE_JOB_DESC)}
                className="text-2xs text-teal-800 hover:text-teal-950 font-semibold cursor-pointer"
              >
                + Masukkan Contoh Lowongan
              </button>
            </div>

            <textarea
              rows={5}
              placeholder="Tempel deskripsi lowongan kerja di sini (kualifikasi, requirements, tanggung jawab)..."
              value={jobText}
              onChange={e => setJobText(e.target.value)}
              className="w-full p-3 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-teal-700 outline-none leading-relaxed"
              data-testid="textarea-job-desc"
            />

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!jobText.trim() || isLoading}
                onClick={handleRunMatch}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
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
            <div className="space-y-4 border-t border-stone-200 pt-4">
              {matchResult.analysis_status === 'insufficient_data' ? (
                <div data-testid="insufficient-data-alert">
                  <KituNotice tone="warning" expression="bingung" title="Data Kualifikasi Belum Cukup">
                    <span>
                      {matchResult.advice[0] || 'Deskripsi lowongan belum memuat informasi kualifikasi atau posisi yang memadai untuk dievaluasi.'}
                    </span>
                  </KituNotice>
                </div>
              ) : (
                <>
                  {/* Target Role & Seniority Badge */}
                  {(matchResult.target_role || matchResult.detected_seniority) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {matchResult.target_role && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-teal-50 text-teal-900 border border-teal-200">
                          <Briefcase className="w-3.5 h-3.5 text-teal-800" />
                          Target: {matchResult.target_role}
                        </span>
                      )}
                      {matchResult.detected_seniority && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-stone-100 text-stone-800 border border-stone-200">
                          Tingkat: {matchResult.detected_seniority}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Score Highlight Card */}
                  <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${getScoreColor(matchResult.match_score)}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center font-black text-xl shadow-2xs tabular-nums">
                        {Math.round(matchResult.match_score)}%
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-stone-900">Skor Kecocokan Profil</h4>
                        <p className="text-xs text-stone-700">
                          {matchResult.score_breakdown ? (
                            'Evaluasi komprehensif mencakup posisi, keahlian, pengalaman, dan kualifikasi lowongan.'
                          ) : (
                            `${matchResult.matched_count} dari ${matchResult.total_job_skills} kata kunci kualifikasi lowongan ditemukan di CV Anda.`
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs">
                      <span className="text-3xs text-stone-600 block font-semibold">Konteks relevansi</span>
                      <span className="font-bold text-stone-900 text-sm tabular-nums">BM25: {matchResult.bm25_score}%</span>
                    </div>
                  </div>

                  {/* Peringatan Batas Skor Maksimal 69 */}
                  {matchResult.capped_by_required && (
                    <KituNotice
                      tone="error"
                      expression="kaget"
                      title="Batas Skor Maksimal 69 Aktif"
                      role="alert"
                      data-testid="capped-by-required-alert"
                    >
                      <span>
                        Skor dibatasi maksimal 69 karena ada kualifikasi wajib (required) yang belum terpenuhi di CV.
                      </span>
                    </KituNotice>
                  )}

                  {/* Rincian Dimensi Evaluasi (Score Breakdown) */}
                  {matchResult.score_breakdown && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-stone-900 block">Rincian Evaluasi Dimensi:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {matchResult.score_breakdown.role && matchResult.score_breakdown.role.status !== 'not_evaluated' && (
                          <div className="p-2.5 rounded-lg border border-stone-200 bg-stone-50/70">
                            <span className="text-3xs font-semibold text-stone-600 block">Posisi & Peran</span>
                            <span className="font-bold text-stone-900 text-sm tabular-nums">{Math.round(matchResult.score_breakdown.role.score)}%</span>
                            {matchResult.score_breakdown.role.evidence && (
                              <p className="text-3xs text-stone-600 mt-0.5 truncate">{matchResult.score_breakdown.role.evidence}</p>
                            )}
                          </div>
                        )}
                        {matchResult.score_breakdown.skills && (
                          <div className="p-2.5 rounded-lg border border-stone-200 bg-stone-50/70">
                            <span className="text-3xs font-semibold text-stone-600 block">Keahlian</span>
                            <span className="font-bold text-stone-900 text-sm tabular-nums">{Math.round(matchResult.score_breakdown.skills.score)}%</span>
                            <p className="text-3xs text-stone-600 mt-0.5">
                              {matchResult.matched_skills.length} / {matchResult.total_job_skills} keahlian
                            </p>
                          </div>
                        )}
                        {matchResult.score_breakdown.responsibilities && matchResult.score_breakdown.responsibilities.status !== 'not_evaluated' && (
                          <div className="p-2.5 rounded-lg border border-stone-200 bg-stone-50/70">
                            <span className="text-3xs font-semibold text-stone-600 block">Tanggung Jawab</span>
                            <span className="font-bold text-stone-900 text-sm tabular-nums">{Math.round(matchResult.score_breakdown.responsibilities.score)}%</span>
                            <p className="text-3xs text-stone-600 mt-0.5">Bukti pengalaman kerja</p>
                          </div>
                        )}
                        {matchResult.score_breakdown.experience && matchResult.score_breakdown.experience.status !== 'not_evaluated' && (
                          <div className="p-2.5 rounded-lg border border-stone-200 bg-stone-50/70">
                            <span className="text-3xs font-semibold text-stone-600 block">Durasi Pengalaman</span>
                            <span className="font-bold text-stone-900 text-sm tabular-nums">{Math.round(matchResult.score_breakdown.experience.score)}%</span>
                            <p className="text-3xs text-stone-600 mt-0.5">
                              {matchResult.score_breakdown.experience.cv_years ?? 0} thn terakumulasi
                            </p>
                          </div>
                        )}
                        {matchResult.score_breakdown.education && matchResult.score_breakdown.education.status !== 'not_evaluated' && (
                          <div className="p-2.5 rounded-lg border border-stone-200 bg-stone-50/70">
                            <span className="text-3xs font-semibold text-stone-600 block">Pendidikan</span>
                            <span className="font-bold text-stone-900 text-sm tabular-nums">{Math.round(matchResult.score_breakdown.education.score)}%</span>
                            <p className="text-3xs text-stone-600 mt-0.5">Kualifikasi akademik</p>
                          </div>
                        )}
                        {matchResult.score_breakdown.languages && matchResult.score_breakdown.languages.status !== 'not_evaluated' && (
                          <div className="p-2.5 rounded-lg border border-stone-200 bg-stone-50/70">
                            <span className="text-3xs font-semibold text-stone-600 block">Bahasa</span>
                            <span className="font-bold text-stone-900 text-sm tabular-nums">{Math.round(matchResult.score_breakdown.languages.score)}%</span>
                            <p className="text-3xs text-stone-600 mt-0.5">Kemampuan bahasa</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Kualifikasi Wajib yang Belum Terpenuhi */}
                  {matchResult.missing_requirements && matchResult.missing_requirements.length > 0 && (
                    <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl space-y-1.5" data-testid="missing-requirements-box">
                      <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        Kualifikasi Utama yang Belum Ditemukan ({matchResult.missing_requirements.length}):
                      </span>
                      <ul className="text-xs text-rose-800 list-disc list-inside space-y-0.5 pt-0.5">
                        {matchResult.missing_requirements.map((req, idx) => (
                          <li key={idx} className="leading-relaxed">{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Matched Skills */}
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Keahlian yang Cocok ({matchResult.matched_skills.length}):
                    </span>
                    {matchResult.matched_skills.length === 0 ? (
                      <p className="text-xs text-stone-500 italic">Belum ada keahlian yang cocok ditemukan.</p>
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
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                      <span className="text-xs font-bold text-stone-900 block">
                        Panduan Penyesuaian CV:
                      </span>
                      <ul className="text-xs text-stone-700 list-disc list-inside space-y-1 pt-1">
                        {matchResult.advice.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {onCreateTargetedDraft && (
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 space-y-2.5" data-testid="target-draft-panel">
                  <div>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                      <CopyPlus className="h-4 w-4 text-teal-800" />
                      Buat CV Target
                    </span>
                    <p className="mt-1 text-2xs leading-relaxed text-stone-700">
                      Salin CV ini menjadi draft terpisah, urutkan keahlian yang cocok di atas, dan simpan konteks lowongan. Draft asli tidak berubah.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-2xs font-semibold text-stone-800">
                      Posisi target <span className="text-rose-500">*</span>
                      <input
                        type="text"
                        value={targetTitle}
                        onChange={event => setTargetTitle(event.target.value)}
                        placeholder="Contoh: Senior Backend Engineer"
                        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-700"
                        data-testid="input-target-title"
                      />
                    </label>
                    <label className="block text-2xs font-semibold text-stone-800">
                      Perusahaan (opsional)
                      <input
                        type="text"
                        value={targetCompany}
                        onChange={event => setTargetCompany(event.target.value)}
                        placeholder="Contoh: PT Maju Digital"
                        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-teal-700"
                        data-testid="input-target-company"
                      />
                    </label>
                  </div>
                  {matchResult.matched_skills.length > 0 && (
                    <p className="text-2xs text-stone-700">
                      Keahlian cocok yang akan diprioritaskan: {matchResult.matched_skills.slice(0, 6).join(', ')}
                    </p>
                  )}
                  {targetError && <p className="text-2xs font-medium text-rose-700" role="alert">{targetError}</p>}
                  <button
                    type="button"
                    onClick={handleCreateTargetedDraft}
                    disabled={!targetTitle.trim() || isCreatingTarget}
                    className="flex items-center gap-1.5 rounded-lg bg-teal-800 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="btn-create-targeted-draft"
                  >
                    {isCreatingTarget ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CopyPlus className="h-3.5 w-3.5" />}
                    {isCreatingTarget ? 'Membuat draft...' : 'Buat Draft Target'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-stone-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}
