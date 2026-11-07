import React, { useRef, useState } from 'react'
import {
  FileText,
  ShieldCheck,
  Wrench,
  Plus,
  Upload,
  Clock,
  Star,
  Lock,
  FilePlus,
  Edit3,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { type ResumeDraft, type ResumeDraftSummary } from '../../types/resume'
import { type Workspace } from '../layout/Navbar'

interface DashboardProps {
  draft: ResumeDraft | null
  draftsList: ResumeDraftSummary[]
  atsScore?: number
  privateMode: boolean
  isLoadingDrafts?: boolean
  storageError?: string | null
  onRetryLoadDrafts?: () => void | Promise<void>
  documentToolsCount?: number
  onNavigate: (workspace: Workspace) => void
  onCreateNewResume: () => void | Promise<void>
  onOpenImportModal: () => void | Promise<void>
  onLoadDraft: (id: string) => void | Promise<void>
  onOpenAtsScore?: () => void
  onToggleFavorite?: (id: string) => void | Promise<void>
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
  isLoadingDrafts = false,
  storageError = null,
  onRetryLoadDrafts,
  documentToolsCount = 18,
  onNavigate,
  onCreateNewResume,
  onOpenImportModal,
  onLoadDraft,
  onOpenAtsScore,
  onToggleFavorite
}) => {
  const [pendingAction, setPendingAction] = useState<'create' | 'continue' | 'import' | 'load' | null>(null)
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null)
  const isBusyRef = useRef(false)
  const isFavoriteBusyRef = useRef(false)

  const recentDrafts = [...draftsList]
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
      return b.updatedAt - a.updatedAt
    })
    .slice(0, 6)

  const activeDraftTitle = draft?.title || draftsList[0]?.title || null

  const runGuardedAction = async (
    actionType: 'create' | 'continue' | 'import' | 'load',
    fn: () => void | Promise<void>
  ) => {
    if (isBusyRef.current) return
    isBusyRef.current = true
    setPendingAction(actionType)
    try {
      await fn()
    } finally {
      isBusyRef.current = false
      setPendingAction(null)
    }
  }

  const handleToggleFavoriteGuarded = async (id: string) => {
    if (!onToggleFavorite || isFavoriteBusyRef.current) return
    isFavoriteBusyRef.current = true
    setPendingFavoriteId(id)
    try {
      await onToggleFavorite(id)
    } finally {
      isFavoriteBusyRef.current = false
      setPendingFavoriteId(null)
    }
  }

  return (
    <main
      className="flex-1 min-h-0 overflow-y-auto paper-canvas text-stone-900 custom-scrollbar animate-fade-in"
      data-testid="dashboard-view"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Alert Penyimpanan Lokal jika Gagal */}
        {storageError && (
          <div
            role="alert"
            data-testid="dashboard-storage-error"
            className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-rose-900">Kendala Penyimpanan Lokal</p>
                <p className="text-sm text-rose-800 mt-0.5 break-words">{storageError}</p>
              </div>
            </div>
            {onRetryLoadDrafts && (
              <button
                type="button"
                onClick={() => onRetryLoadDrafts()}
                data-testid="btn-dashboard-retry-storage"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 text-sm font-semibold transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                <span>Coba Lagi</span>
              </button>
            )}
          </div>
        )}

        {/* Lembar Meja Kerja Utama: Header Editorial + Ledger Status Dokumen */}
        <section
          aria-labelledby="dashboard-welcome-heading"
          className="bg-white border border-stone-200/90 rounded-2xl shadow-2xs overflow-hidden"
        >
          <div className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-medium text-stone-600">
                <span className="inline-flex items-center gap-1.5 text-stone-700 font-semibold">
                  <Lock className="w-3.5 h-3.5 text-teal-800 shrink-0" aria-hidden="true" />
                  <span>Penyimpanan lokal perangkat</span>
                </span>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span>100% offline &amp; privat</span>
                {privateMode && (
                  <>
                    <span aria-hidden="true" className="text-stone-300">·</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-amber-900 font-semibold">
                      Mode Privat Aktif
                    </span>
                  </>
                )}
              </div>

              <h1
                id="dashboard-welcome-heading"
                className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 leading-tight"
              >
                Rancang CV Unggul &amp; Kelola Dokumen di Meja Kerja Lokal
              </h1>

              <p className="text-base leading-relaxed text-stone-700">
                Susun resume berstandar ATS dengan pratinjau kertas A4 langsung, evaluasi kecocokan deskripsi pekerjaan, dan jalankan utilitas berkas PDF/Office tanpa mengirim data keluar dari perangkat Anda.
              </p>
            </div>

            {/* Aksi Utama Meja Kerja (1 CTA Terisi + Aksi Sekunder Netral) */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={() => runGuardedAction('create', onCreateNewResume)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 disabled:opacity-60 text-white text-sm font-semibold shadow-2xs transition cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                data-testid="btn-dashboard-create-cv"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{pendingAction === 'create' ? 'Membuat CV...' : 'Buat CV Baru'}</span>
              </button>

              {activeDraftTitle && !isLoadingDrafts && (
                <button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    runGuardedAction('continue', async () => {
                      if (draft) {
                        onNavigate('builder')
                      } else if (draftsList.length > 0) {
                        await onLoadDraft(draftsList[0].id)
                        onNavigate('builder')
                      }
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200/80 disabled:opacity-60 text-stone-900 border border-stone-300/80 text-sm font-semibold transition cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                  data-testid="btn-dashboard-continue-latest"
                >
                  <FileText className="w-4 h-4 text-teal-800 shrink-0" aria-hidden="true" />
                  <span>Lanjutkan Terakhir</span>
                </button>
              )}

              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={() => runGuardedAction('import', onOpenImportModal)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 disabled:opacity-60 text-stone-800 border border-stone-300 text-sm font-semibold transition cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                data-testid="btn-dashboard-import-cv"
              >
                <Upload className="w-4 h-4 text-stone-600 shrink-0" aria-hidden="true" />
                <span>Impor PDF / DOCX</span>
              </button>
            </div>
          </div>

          {/* Ledger Status Dokumen (Garis Arsitektural 1px, Sentence Case, Tabular Nums) */}
          <div
            aria-label="Ringkasan status meja kerja"
            className="border-t border-stone-200 bg-stone-50/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200/90"
          >
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 min-w-0">
              <span className="text-[13px] font-medium text-stone-600 block">
                Draf tersimpan
              </span>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span
                  className="text-xl font-bold text-stone-900 tabular-nums"
                  data-testid="stat-total-drafts"
                >
                  {isLoadingDrafts ? '…' : draftsList.length}
                </span>
                <span className="text-[13px] text-stone-600">dokumen lokal</span>
              </div>
            </div>

            <div className="px-5 py-3.5 sm:px-6 sm:py-4 min-w-0">
              <span className="text-[13px] font-medium text-stone-600 block">
                Skor ATS draf
              </span>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-xl font-bold text-stone-900 tabular-nums"
                    data-testid="stat-ats-score"
                  >
                    {atsScore !== undefined ? atsScore : '—'}
                  </span>
                  {atsScore !== undefined && (
                    <span className="text-[13px] font-medium text-stone-600 tabular-nums">/ 100</span>
                  )}
                </div>
                {atsScore !== undefined && onOpenAtsScore ? (
                  <button
                    type="button"
                    onClick={onOpenAtsScore}
                    data-testid="btn-dashboard-ats-details"
                    className="text-[13px] font-semibold text-teal-800 hover:text-teal-950 underline underline-offset-2 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  >
                    Rincian skor
                  </button>
                ) : (
                  <span className="text-[13px] text-stone-600">Belum ada evaluasi</span>
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 sm:px-6 sm:py-4 min-w-0">
              <span className="text-[13px] font-medium text-stone-600 block">
                Dokumen aktif
              </span>
              <span
                className="text-sm font-bold text-stone-900 mt-1 truncate block"
                title={activeDraftTitle || 'Belum dipilih'}
                data-testid="stat-active-draft-title"
              >
                {isLoadingDrafts ? 'Memuat draf...' : activeDraftTitle || 'Belum ada CV'}
              </span>
            </div>

            <div className="px-5 py-3.5 sm:px-6 sm:py-4 min-w-0">
              <span className="text-[13px] font-medium text-stone-600 block">
                Utilitas dokumen
              </span>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span
                  className="text-xl font-bold text-stone-900 tabular-nums"
                  data-testid="stat-tools-count"
                >
                  {documentToolsCount}
                </span>
                <span className="text-[13px] text-stone-600 truncate">alat PDF &amp; konversi</span>
              </div>
            </div>
          </div>
        </section>

        {/* Area Kerja Asimetris 2 Kolom: Meja Draf CV (7 Kolom) & Direktori Ruang Kerja (5 Kolom) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Kolom Kiri (Utama): Daftar Draf CV Tersimpan */}
          <section
            aria-labelledby="recent-drafts-heading"
            className="lg:col-span-7 space-y-3.5 min-w-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="recent-drafts-heading" className="text-lg font-bold text-stone-900">
                  Arsip &amp; Draf CV Tersimpan
                </h2>
                <p className="text-base text-stone-600 mt-0.5">
                  Pilih dokumen untuk langsung menyunting di ruang editor A4
                </p>
              </div>
              {draftsList.length > 0 && !isLoadingDrafts && (
                <button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() => runGuardedAction('create', onCreateNewResume)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-teal-800 hover:text-teal-950 hover:bg-teal-50/70 transition cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  data-testid="btn-dashboard-new-inline"
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Draf Baru</span>
                </button>
              )}
            </div>

            {isLoadingDrafts ? (
              <div
                className="space-y-3 min-h-[220px]"
                data-testid="dashboard-drafts-loading"
                aria-busy="true"
                aria-live="polite"
              >
                {[0, 1].map(skeletonIndex => (
                  <div
                    key={skeletonIndex}
                    className="p-4 sm:p-5 bg-white border border-stone-200/90 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="h-4 w-48 max-w-full rounded bg-stone-200/80" />
                      <div className="h-3.5 w-32 max-w-full rounded bg-stone-100" />
                    </div>
                    <div className="h-9 w-16 rounded-lg bg-stone-100 shrink-0" />
                  </div>
                ))}
              </div>
            ) : draftsList.length === 0 ? (
              <div
                className="p-6 sm:p-8 bg-white border border-stone-200/90 rounded-2xl space-y-3.5 min-h-[220px] flex flex-col justify-center"
                data-testid="dashboard-drafts-empty"
              >
                <div className="w-11 h-11 rounded-xl bg-stone-100 text-stone-700 border border-stone-200 flex items-center justify-center">
                  <FilePlus className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="max-w-lg">
                  <h3 className="text-base font-bold text-stone-900">Belum ada CV yang dibuat</h3>
                  <p className="text-base text-stone-600 mt-1 leading-relaxed">
                    Setiap draf CV yang Anda susun disimpan secara lokal di browser perangkat ini. Mulai dari lembar baru atau impor berkas resume yang sudah Anda miliki.
                  </p>
                </div>
                <div className="pt-1 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => runGuardedAction('create', onCreateNewResume)}
                    className="px-4 py-2.5 text-sm font-semibold text-white bg-teal-800 hover:bg-teal-900 disabled:opacity-60 rounded-xl transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                  >
                    + Buat CV Pertama
                  </button>
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => runGuardedAction('import', onOpenImportModal)}
                    className="px-4 py-2.5 text-sm font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200/80 disabled:opacity-60 rounded-xl transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                  >
                    Impor CV
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="space-y-2.5 min-h-[220px]"
                data-testid="dashboard-drafts-list"
              >
                {recentDrafts.map(item => {
                  const isCurrentActive = draft?.id === item.id
                  return (
                    <div
                      key={item.id}
                      className={`p-4 sm:p-5 bg-white border rounded-xl transition duration-150 flex items-center justify-between gap-3 min-w-0 ${
                        isCurrentActive
                          ? 'border-stone-300 border-l-4 border-l-teal-800 shadow-2xs'
                          : 'border-stone-200/90 hover:border-stone-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            disabled={pendingAction !== null}
                            onClick={() =>
                              runGuardedAction('load', async () => {
                                await onLoadDraft(item.id)
                                onNavigate('builder')
                              })
                            }
                            className="text-base font-bold text-stone-900 hover:text-teal-800 truncate text-left transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                            title={item.title}
                          >
                            {item.title}
                          </button>
                          {item.favorite && (
                            <Star
                              className="w-4 h-4 text-amber-600 fill-amber-500 shrink-0"
                              aria-label="Favorit"
                            />
                          )}
                          {isCurrentActive && (
                            <span className="text-[13px] font-semibold px-2 py-0.5 rounded-md bg-teal-50/90 text-teal-900 border border-teal-200 shrink-0">
                              Aktif
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[13px] text-stone-600 min-w-0">
                          {item.targetJobTitle ? (
                            <span
                              className="truncate max-w-[200px] sm:max-w-[260px] text-stone-700 font-medium"
                              title={item.targetJobTitle}
                            >
                              {item.targetJobTitle}
                            </span>
                          ) : (
                            <span className="capitalize">{item.templateId}</span>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <Clock className="w-3.5 h-3.5 text-stone-500 shrink-0" aria-hidden="true" />
                            <span>{formatRelativeTime(item.updatedAt)}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onToggleFavorite && (
                          <button
                            type="button"
                            disabled={pendingFavoriteId === item.id}
                            onClick={() => handleToggleFavoriteGuarded(item.id)}
                            className="p-2 rounded-lg text-stone-500 hover:text-amber-700 hover:bg-stone-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                            title={item.favorite ? 'Hapus favorit' : 'Tandai favorit'}
                            aria-label={`Favorit ${item.title}`}
                          >
                            <Star
                              className={`w-4 h-4 ${
                                item.favorite ? 'text-amber-600 fill-amber-500' : ''
                              }`}
                            />
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={pendingAction !== null}
                          onClick={() =>
                            runGuardedAction('load', async () => {
                              await onLoadDraft(item.id)
                              onNavigate('builder')
                            })
                          }
                          className="px-3 py-2 rounded-lg bg-stone-100 hover:bg-stone-200/80 text-stone-900 text-sm font-semibold inline-flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                          title="Buka dan sunting CV"
                        >
                          <Edit3 className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span className="hidden sm:inline">Sunting</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Kolom Kanan: Direktori Ruang Kerja & Utilitas (Tanpa Kartu Pelangi / Panah Otomatis) */}
          <section
            aria-labelledby="workspaces-heading"
            className="lg:col-span-5 space-y-3.5 min-w-0"
          >
            <div>
              <h2 id="workspaces-heading" className="text-lg font-bold text-stone-900">
                Direktori Ruang Kerja
              </h2>
              <p className="text-base text-stone-600 mt-0.5">
                Buka modul penyuntingan, audit ATS, atau pemrosesan berkas
              </p>
            </div>

            <div className="bg-white border border-stone-200/90 rounded-2xl divide-y divide-stone-200/90 overflow-hidden shadow-2xs">
              {/* Modul 1: CV Builder */}
              <button
                type="button"
                onClick={() => onNavigate('builder')}
                className="group w-full text-left p-5 hover:bg-stone-50/90 transition-colors flex items-start gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700"
                data-testid="card-workspace-builder"
              >
                <span className="p-2.5 rounded-xl bg-stone-100 text-stone-800 border border-stone-200/80 group-hover:bg-teal-50 group-hover:text-teal-900 group-hover:border-teal-200 transition-colors shrink-0 mt-0.5">
                  <FileText className="w-5 h-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-stone-900 group-hover:text-teal-900 transition-colors">
                      Buat &amp; Edit CV
                    </h3>
                    <span className="text-[13px] font-medium text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-md">
                      Editor A4
                    </span>
                  </div>
                  <p className="text-base leading-relaxed text-stone-600">
                    Susun bagian riwayat kerja, pendidikan, dan keahlian dengan pratinjau cetak A4 langsung serta pilihan template ramah ATS.
                  </p>
                </div>
              </button>

              {/* Modul 2: Optimasi ATS */}
              <button
                type="button"
                onClick={() => onNavigate('ats')}
                className="group w-full text-left p-5 hover:bg-stone-50/90 transition-colors flex items-start gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700"
                data-testid="card-workspace-ats"
              >
                <span className="p-2.5 rounded-xl bg-stone-100 text-stone-800 border border-stone-200/80 group-hover:bg-teal-50 group-hover:text-teal-900 group-hover:border-teal-200 transition-colors shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-stone-900 group-hover:text-teal-900 transition-colors">
                      Optimasi ATS &amp; Job Match
                    </h3>
                    <span className="text-[13px] font-medium text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-md">
                      Audit &amp; kecocokan
                    </span>
                  </div>
                  <p className="text-base leading-relaxed text-stone-600">
                    Periksa struktur keterbacaan mesin ATS dan bandingkan kompetensi CV Anda terhadap kualifikasi lowongan target.
                  </p>
                </div>
              </button>

              {/* Modul 3: Alat Dokumen */}
              <button
                type="button"
                onClick={() => onNavigate('tools')}
                className="group w-full text-left p-5 hover:bg-stone-50/90 transition-colors flex items-start gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700"
                data-testid="card-workspace-tools"
              >
                <span className="p-2.5 rounded-xl bg-stone-100 text-stone-800 border border-stone-200/80 group-hover:bg-teal-50 group-hover:text-teal-900 group-hover:border-teal-200 transition-colors shrink-0 mt-0.5">
                  <Wrench className="w-5 h-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-stone-900 group-hover:text-teal-900 transition-colors">
                      Alat Dokumen &amp; Konversi
                    </h3>
                    <span className="text-[13px] font-medium text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-md tabular-nums">
                      {documentToolsCount} utilitas lokal
                    </span>
                  </div>
                  <p className="text-base leading-relaxed text-stone-600">
                    Konversi DOCX, Excel, dan PPTX ke PDF, jalankan OCR lokal, gabung/pisah halaman, kompresi, hingga enkripsi sandi berkas.
                  </p>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
