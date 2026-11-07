import React from 'react'
import {
  FileText,
  ShieldCheck,
  Wrench,
  Plus,
  Upload,
  ArrowRight,
  Clock,
  Star,
  Sparkles,
  CheckCircle2,
  Lock,
  FilePlus,
  Edit3
} from 'lucide-react'
import { type ResumeDraft, type ResumeDraftSummary } from '../../types/resume'
import { type Workspace } from '../layout/Navbar'

interface DashboardProps {
  draft: ResumeDraft | null
  draftsList: ResumeDraftSummary[]
  atsScore?: number
  privateMode: boolean
  onNavigate: (workspace: Workspace) => void
  onCreateNewResume: () => void
  onOpenImportModal: () => void
  onLoadDraft: (id: string) => void
  onOpenAtsScore?: () => void
  onToggleFavorite?: (id: string) => void
}

const formatRelativeTime = (timestamp: number): string => {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 60) return 'Baru saja'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} menit yang lalu`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam yang lalu`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay} hari yang lalu`
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

export const Dashboard: React.FC<DashboardProps> = ({
  draft,
  draftsList,
  atsScore,
  privateMode,
  onNavigate,
  onCreateNewResume,
  onOpenImportModal,
  onLoadDraft,
  onOpenAtsScore,
  onToggleFavorite
}) => {
  const recentDrafts = [...draftsList]
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
    .slice(0, 4)

  const activeDraftTitle = draft?.title || draftsList[0]?.title || null

  return (
    <main
      className="flex-1 min-h-0 overflow-y-auto bg-slate-50 custom-scrollbar animate-fade-in"
      data-testid="dashboard-view"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero Section */}
        <section
          aria-labelledby="dashboard-welcome-heading"
          className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-indigo-50/30 to-violet-50/40 p-6 sm:p-8 shadow-xs animate-fade-up"
        >
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-2xs font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Studio CV &amp; Pengolah Dokumen Lokal</span>
            </div>

            <h1
              id="dashboard-welcome-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900"
            >
              Rancang CV Unggul &amp; Olah Dokumen Tanpa Hambatan
            </h1>

            <p className="text-sm leading-relaxed text-slate-600">
              Buat resume berstandar ATS, audit kecocokan lowongan kerja, dan akses utilitas
              dokumen lengkap langsung dari komputer Anda—100% offline, cepat, dan privat.
            </p>

            {/* Badges Keamanan & Privasi */}
            <div className="pt-1 flex flex-wrap items-center gap-3 text-2xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1 bg-white/80 border border-slate-200 px-2.5 py-1 rounded-lg text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 100% Offline &amp; Privat
              </span>
              <span className="inline-flex items-center gap-1 bg-white/80 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700">
                <Lock className="w-3.5 h-3.5 text-slate-500" /> Tersimpan di Browser Lokal
              </span>
              {privateMode && (
                <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-amber-800">
                  Mode Privat Aktif
                </span>
              )}
            </div>

            {/* Aksi Cepat Hero */}
            <div className="pt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onCreateNewResume}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs active:scale-[0.98] transition cursor-pointer"
                data-testid="btn-dashboard-create-cv"
              >
                <Plus className="w-4 h-4" /> Buat CV Baru
              </button>

              {activeDraftTitle && (
                <button
                  type="button"
                  onClick={() => {
                    if (draft) {
                      onNavigate('builder')
                    } else if (draftsList.length > 0) {
                      onLoadDraft(draftsList[0].id)
                      onNavigate('builder')
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs sm:text-sm font-semibold shadow-2xs active:scale-[0.98] transition cursor-pointer"
                  data-testid="btn-dashboard-continue-latest"
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Lanjutkan Terakhir</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenImportModal}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-semibold shadow-2xs active:scale-[0.98] transition cursor-pointer"
                data-testid="btn-dashboard-import-cv"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Impor PDF / DOCX</span>
              </button>
            </div>
          </div>
        </section>

        {/* Ringkasan Metrik / Status Singkat */}
        <section aria-label="Status Cepat Dokumen" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">Total CV</span>
            <span className="text-xl sm:text-2xl font-black text-slate-800 mt-1 block" data-testid="stat-total-drafts">
              {draftsList.length}
            </span>
            <span className="text-3xs text-slate-500 mt-0.5 block">Tersimpan di perangkat ini</span>
          </div>

          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">Skor ATS Draft</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-600" data-testid="stat-ats-score">
                {atsScore !== undefined ? atsScore : '—'}
              </span>
              {atsScore !== undefined && <span className="text-2xs text-slate-400">/ 100</span>}
            </div>
            <button
              type="button"
              onClick={onOpenAtsScore}
              disabled={atsScore === undefined}
              className="text-3xs font-semibold text-indigo-600 hover:text-indigo-800 mt-0.5 block disabled:text-slate-400 disabled:cursor-default"
            >
              {atsScore !== undefined ? 'Lihat rincian skor →' : 'Belum ada evaluasi'}
            </button>
          </div>

          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">CV Terpilih</span>
            <span className="text-sm font-bold text-slate-800 mt-1.5 truncate block" title={activeDraftTitle || 'Belum dipilih'}>
              {activeDraftTitle || 'Belum ada CV'}
            </span>
            <span className="text-3xs text-slate-500 mt-0.5 block">
              {draft ? 'Sedang aktif di memori' : 'Pilih untuk mengedit'}
            </span>
          </div>

          <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 block">Alat Dokumen</span>
            <span className="text-xl sm:text-2xl font-black text-sky-600 mt-1 block">
              12+
            </span>
            <span className="text-3xs text-slate-500 mt-0.5 block">Konversi, OCR, Split &amp; Merge</span>
          </div>
        </section>

        {/* Kartu Workspace Utama */}
        <section aria-labelledby="workspaces-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="workspaces-heading" className="text-base sm:text-lg font-bold text-slate-900">
                Menu &amp; Workspace Utama
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Pilih fitur yang ingin Anda gunakan sekarang</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
            {/* Kartu 1: CV Builder */}
            <button
              type="button"
              onClick={() => onNavigate('builder')}
              className="group text-left p-5 sm:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5 transition duration-200 flex flex-col justify-between cursor-pointer"
              data-testid="card-workspace-builder"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="p-3 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
                    <FileText className="w-6 h-6" />
                  </span>
                  <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Editor
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Buat &amp; Edit CV
                </h3>
                <p className="text-xs leading-relaxed text-slate-500">
                  Rancang CV profesional dengan live preview A4, template ramah ATS, kontrol font, dan penyesuaian tata letak bagian yang fleksibel.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600">
                <span>Buka CV Builder</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Kartu 2: Optimasi ATS */}
            <button
              type="button"
              onClick={() => onNavigate('ats')}
              className="group text-left p-5 sm:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-emerald-300 hover:shadow-lg hover:-translate-y-0.5 transition duration-200 flex flex-col justify-between cursor-pointer"
              data-testid="card-workspace-ats"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="p-3 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-6 h-6" />
                  </span>
                  <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                    Analisis
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  Optimasi ATS &amp; Job Match
                </h3>
                <p className="text-xs leading-relaxed text-slate-500">
                  Audit struktur keterbacaan mesin ATS dan bandingkan keahlian CV terhadap kualifikasi lowongan pekerjaan secara mendalam.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                <span>Buka Optimasi ATS</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Kartu 3: Alat Dokumen */}
            <button
              type="button"
              onClick={() => onNavigate('tools')}
              className="group text-left p-5 sm:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-sky-300 hover:shadow-lg hover:-translate-y-0.5 transition duration-200 flex flex-col justify-between cursor-pointer"
              data-testid="card-workspace-tools"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="p-3 rounded-xl bg-sky-50 text-sky-600 group-hover:scale-105 transition-transform">
                    <Wrench className="w-6 h-6" />
                  </span>
                  <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                    Alat PDF
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                  Alat Dokumen &amp; Konversi
                </h3>
                <p className="text-xs leading-relaxed text-slate-500">
                  Ubah format DOCX, Excel, PPTX ke PDF, jalankan OCR scan lokal, split &amp; merge, kompresi berkas, hingga proteksi sandi dokumen.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-600">
                <span>Jelajahi Alat Dokumen</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </section>

        {/* Section CV & Draft Terbaru */}
        <section aria-labelledby="recent-drafts-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="recent-drafts-heading" className="text-base sm:text-lg font-bold text-slate-900">
                CV &amp; Draf Tersimpan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Lanjutkan pekerjaan Anda atau kelola draft yang ada</p>
            </div>
            {draftsList.length > 0 && (
              <button
                type="button"
                onClick={onCreateNewResume}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                data-testid="btn-dashboard-new-inline"
              >
                <Plus className="w-3.5 h-3.5" /> Buat CV Baru
              </button>
            )}
          </div>

          {draftsList.length === 0 ? (
            <div
              className="p-8 text-center bg-white border border-dashed border-slate-300 rounded-2xl space-y-3 animate-fade-in"
              data-testid="dashboard-drafts-empty"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <FilePlus className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-sm font-bold text-slate-800">Belum ada CV yang dibuat</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Semua CV yang Anda buat akan tersimpan aman di browser perangkat ini. Mulai dengan membuat draf baru atau impor resume yang sudah ada.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={onCreateNewResume}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs"
                >
                  + Buat CV Pertama
                </button>
                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Impor CV
                </button>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3" data-testid="dashboard-drafts-list">
              {recentDrafts.map(item => {
                const isCurrentActive = draft?.id === item.id
                return (
                  <div
                    key={item.id}
                    className={`p-4 bg-white border rounded-2xl transition duration-150 flex items-center justify-between gap-3 ${
                      isCurrentActive
                        ? 'border-indigo-400 ring-1 ring-indigo-400/40 shadow-xs'
                        : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadDraft(item.id)
                            onNavigate('builder')
                          }}
                          className="text-sm font-bold text-slate-900 hover:text-indigo-600 truncate text-left transition-colors cursor-pointer"
                        >
                          {item.title}
                        </button>
                        {item.favorite && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" aria-label="Favorit" />
                        )}
                        {isCurrentActive && (
                          <span className="text-3xs font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 shrink-0">
                            Aktif
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-2xs text-slate-500">
                        {item.targetJobTitle ? (
                          <span className="truncate max-w-44 text-slate-600 font-medium">
                            {item.targetJobTitle}
                          </span>
                        ) : (
                          <span className="capitalize">{item.templateId}</span>
                        )}
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatRelativeTime(item.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onToggleFavorite && (
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-50 transition"
                          title={item.favorite ? 'Hapus favorit' : 'Tandai favorit'}
                          aria-label={`Favorit ${item.title}`}
                        >
                          <Star className={`w-4 h-4 ${item.favorite ? 'text-amber-500 fill-amber-500' : ''}`} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onLoadDraft(item.id)
                          onNavigate('builder')
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-xs font-semibold flex items-center gap-1 transition"
                        title="Buka dan edit CV"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Footer info lokal */}
        <section
          aria-label="Informasi Keamanan & Lisensi"
          className="p-4 bg-white border border-slate-200/80 rounded-2xl flex items-start gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-500 leading-relaxed">
            <strong className="text-slate-700 block font-semibold">Doc-builder Beroperasi Secara Mandiri</strong>
            Aplikasi ini tidak mengirim draf resume atau berkas dokumen Anda ke server luar. Semua berkas sementara hasil konversi dibersihkan secara otomatis.
          </div>
        </section>
      </div>
    </main>
  )
}
