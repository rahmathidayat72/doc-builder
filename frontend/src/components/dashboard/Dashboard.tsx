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
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Zap,
  Image as ImageIcon,
  Files,
  Link2,
  LayoutGrid
} from 'lucide-react'
import { type ResumeDraft, type ResumeDraftSummary } from '../../types/resume'
import { type Workspace } from '../layout/Navbar'
import { Footer } from '../layout/Footer'

// Brand Assets
import kituMascotWebp from '../../assets/kitu-mascot.webp'
import kituFeatureCv from '../../assets/kitu-feature-cv.webp'
import kituFeaturePhoto from '../../assets/kitu-feature-photo.webp'
import kituFeatureConvert from '../../assets/kitu-feature-convert.webp'
import kituFeatureShortener from '../../assets/kitu-feature-shortener.webp'
import scenicTemple from '../../assets/satukit-scenic-temple.webp'
import batikLeft from '../../assets/satukit-batik-left.webp'
import batikRight from '../../assets/satukit-batik-right.webp'

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

const QUICK_CATEGORIES = [
  { id: 'all', label: 'Semua', icon: LayoutGrid },
  { id: 'cv', label: 'CV & Karir', icon: FileText, workspace: 'builder' as Workspace },
  { id: 'photo', label: 'Foto & Gambar', icon: ImageIcon, workspace: 'tools' as Workspace },
  { id: 'docs', label: 'Dokumen & PDF', icon: Files, workspace: 'tools' as Workspace },
  { id: 'url', label: 'Tautan & URL', icon: Link2, workspace: 'tools' as Workspace },
  { id: 'ats', label: 'Optimasi ATS', icon: ShieldCheck, workspace: 'ats' as Workspace },
  { id: 'tools', label: 'Utilitas Digital', icon: Wrench, workspace: 'tools' as Workspace },
] as const

export const Dashboard: React.FC<DashboardProps> = ({
  draft,
  draftsList,
  atsScore,
  privateMode,
  isLoadingDrafts = false,
  storageError = null,
  onRetryLoadDrafts,
  documentToolsCount = 20,
  onNavigate,
  onCreateNewResume,
  onOpenImportModal,
  onLoadDraft,
  onOpenAtsScore,
  onToggleFavorite
}) => {
  const [pendingAction, setPendingAction] = useState<'create' | 'continue' | 'import' | 'load' | null>(null)
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')
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

  const handleCategoryClick = (cat: typeof QUICK_CATEGORIES[number]) => {
    setActiveCategory(cat.id)
    if ('workspace' in cat && cat.workspace) {
      onNavigate(cat.workspace)
    }
  }

  return (
    <main
      className="flex-1 min-h-0 overflow-y-auto paper-canvas dark:bg-[#0b1120] text-stone-900 dark:text-stone-100 custom-scrollbar animate-fade-in transition-colors"
      data-testid="dashboard-view"
    >
      {/* 1. Storage Error Alert jika ada kendala */}
      {storageError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div
            role="alert"
            data-testid="dashboard-storage-error"
            className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-start gap-3 min-w-0">
              <AlertCircle className="w-5 h-5 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-rose-900 dark:text-rose-100">Kendala Penyimpanan Lokal</p>
                <p className="text-sm text-rose-800 dark:text-rose-300 mt-0.5 break-words">{storageError}</p>
              </div>
            </div>
            {onRetryLoadDrafts && (
              <button
                type="button"
                onClick={() => onRetryLoadDrafts()}
                data-testid="btn-dashboard-retry-storage"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-rose-900 hover:bg-rose-100 dark:hover:bg-rose-800 text-rose-900 dark:text-rose-100 border border-rose-300 dark:border-rose-700 text-sm font-semibold transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                <span>Coba Lagi</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Hero Section Pixel-Perfect Satukit (Landscape + Kitu Wadah Besek + Batik Kawung) */}
      <section
        aria-labelledby="dashboard-welcome-heading"
        className="relative overflow-hidden bg-gradient-to-b from-[#e3f4ee]/80 via-[#f0faf5]/90 to-[#faf9f6] dark:from-stone-900 dark:via-stone-900/90 dark:to-[#0b1120] border-b border-stone-200/80 dark:border-stone-800/80 pt-8 pb-14 sm:py-16 transition-colors"
      >
        {/* Ornamen Batik Kawung Kiri */}
        <img
          src={batikLeft}
          alt=""
          aria-hidden="true"
          className="absolute left-0 top-4 sm:top-10 w-16 sm:w-28 opacity-40 dark:opacity-10 pointer-events-none select-none"
        />

        {/* Siluet Candi & Perbukitan Kanan Atas */}
        <img
          src={scenicTemple}
          alt=""
          aria-hidden="true"
          className="absolute right-0 top-0 max-h-56 sm:max-h-72 opacity-50 dark:opacity-15 pointer-events-none select-none mix-blend-multiply dark:mix-blend-screen"
        />

        {/* Ornamen Batik Kawung Kanan Bawah */}
        <img
          src={batikRight}
          alt=""
          aria-hidden="true"
          className="absolute right-0 bottom-4 w-16 sm:w-28 opacity-35 dark:opacity-10 pointer-events-none select-none"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Kolom Kiri: Tagline, Headline dengan Brush Underline, Subteks, CTA */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-100/90 dark:bg-teal-950/80 border border-teal-300/80 dark:border-teal-700 text-teal-900 dark:text-teal-200 font-semibold text-[13px] tracking-wide shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse" aria-hidden="true" />
                <span>Satu Tempat, Banyak Solusi Digital</span>
                {privateMode && (
                  <span className="ml-1 pl-2 border-l border-teal-300 dark:border-teal-700 text-amber-700 dark:text-amber-400 font-bold">
                    Mode Privat Aktif
                  </span>
                )}
              </div>

              <h1
                id="dashboard-welcome-heading"
                className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-stone-900 dark:text-white leading-[1.2]"
              >
                <span className="sr-only">Rancang CV Unggul &amp; Kelola Dokumen di Satukit. </span>
                Semua Kebutuhan Digitalmu,{' '}
                <br className="hidden sm:inline" />
                Ada di{' '}
                <span className="relative inline-block text-teal-800 dark:text-teal-400">
                  Satu Tempat
                  {/* Brush Underline Hand-Drawn SVG */}
                  <svg
                    className="absolute -bottom-2 left-0 w-full h-3 text-amber-500/80 dark:text-amber-400/80 pointer-events-none"
                    viewBox="0 0 250 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 8.5C50 3.5 150 2 247 7.5C180 11.5 80 10.5 3 8.5Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                .
              </h1>

              <p className="text-base sm:text-lg leading-relaxed text-stone-700 dark:text-stone-300 max-w-xl">
                Dari bikin CV profesional ramah ATS, edit foto, konversi file dokumen, sampai pendekkan link — Satukit siap bantu beresin urusan digitalmu, cepat dan praktis!
              </p>

              {/* Tombol Aksi Utama */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() => runGuardedAction('create', onCreateNewResume)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-teal-800 hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-60 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  data-testid="btn-dashboard-create-cv"
                >
                  <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" aria-hidden="true" />
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
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-60 text-stone-900 dark:text-stone-100 border border-stone-300 dark:border-stone-700 text-sm font-semibold transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                    data-testid="btn-dashboard-continue-latest"
                  >
                    <FileText className="w-4 h-4 text-teal-800 dark:text-teal-400 shrink-0" aria-hidden="true" />
                    <span>Lanjutkan Terakhir</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() => runGuardedAction('import', onOpenImportModal)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 disabled:opacity-60 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 text-sm font-semibold transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  data-testid="btn-dashboard-import-cv"
                >
                  <Upload className="w-4 h-4 text-stone-600 dark:text-stone-400 shrink-0" aria-hidden="true" />
                  <span>Impor PDF / DOCX</span>
                </button>
              </div>

              {/* Populer Quick Tags */}
              <div className="pt-2 flex flex-wrap items-center gap-2 text-[13px] text-stone-600 dark:text-stone-400">
                <span className="font-semibold text-stone-800 dark:text-stone-200">Populer:</span>
                <button
                  type="button"
                  onClick={() => onNavigate('builder')}
                  className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-teal-50 dark:hover:bg-teal-950 text-stone-700 dark:text-stone-300 hover:text-teal-800 dark:hover:text-teal-300 transition cursor-pointer"
                >
                  CV Builder
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('tools')}
                  className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-teal-50 dark:hover:bg-teal-950 text-stone-700 dark:text-stone-300 hover:text-teal-800 dark:hover:text-teal-300 transition cursor-pointer"
                >
                  Hapus Background
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('tools')}
                  className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-teal-50 dark:hover:bg-teal-950 text-stone-700 dark:text-stone-300 hover:text-teal-800 dark:hover:text-teal-300 transition cursor-pointer"
                >
                  Gabung PDF
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('tools')}
                  className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-teal-50 dark:hover:bg-teal-950 text-stone-700 dark:text-stone-300 hover:text-teal-800 dark:hover:text-teal-300 transition cursor-pointer"
                >
                  Pendekkan Link
                </button>
              </div>
            </div>

            {/* Kolom Kanan: Maskot Kitu Wadah Besek + Speech Bubble + Floating Badges */}
            <div className="lg:col-span-5 flex justify-center items-center relative pt-4 pb-2 lg:py-6">
              <div className="relative w-full max-w-sm sm:max-w-md flex flex-col items-center">
                {/* Speech Bubble Kitu */}
                <div className="absolute -top-6 sm:-top-8 right-2 sm:right-6 z-20 bg-white dark:bg-stone-800 border-2 border-teal-700/30 dark:border-teal-400/40 rounded-2xl p-3 sm:p-3.5 shadow-lg max-w-[210px] text-[13px] font-bold text-teal-950 dark:text-teal-100 animate-float-delayed">
                  <span>Halo! Aku <strong>Kitu</strong>, siap bantu beresin tugasmu! ✨</span>
                  {/* Bubble pointer tail */}
                  <div className="absolute -bottom-2 left-6 w-3.5 h-3.5 bg-white dark:bg-stone-800 border-b-2 border-r-2 border-teal-700/30 dark:border-teal-400/40 rotate-45" />
                </div>

                {/* Floating Badge 1: 100% Gratis (Kiri Atas) */}
                <div className="absolute top-12 -left-2 sm:-left-4 z-10 bg-white/95 dark:bg-stone-800/95 border border-emerald-300 dark:border-emerald-700 rounded-full px-3 py-1.5 shadow-md flex items-center gap-1.5 text-[13px] font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>100% Gratis</span>
                </div>

                {/* Floating Badge 2: Super Cepat (Kiri Bawah) */}
                <div className="absolute bottom-6 -left-2 sm:left-0 z-10 bg-white/95 dark:bg-stone-800/95 border border-amber-300 dark:border-amber-700 rounded-full px-3 py-1.5 shadow-md flex items-center gap-1.5 text-[13px] font-bold text-amber-800 dark:text-amber-300">
                  <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Super Cepat</span>
                </div>

                {/* Floating Badge 3: Aman & Privat (Kanan Bawah) */}
                <div className="absolute bottom-4 right-0 sm:right-2 z-10 bg-white/95 dark:bg-stone-800/95 border border-teal-300 dark:border-teal-700 rounded-full px-3 py-1.5 shadow-md flex items-center gap-1.5 text-[13px] font-bold text-teal-800 dark:text-teal-300">
                  <Lock className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                  <span>Tanpa Login &amp; Aman</span>
                </div>

                {/* Ilustrasi Utama Kitu Wadah Besek */}
                <img
                  src={kituMascotWebp}
                  alt="Kitu — Maskot Resmi Satukit"
                  className="w-64 sm:w-80 lg:w-92 h-auto object-contain mx-auto select-none drop-shadow-2xl animate-float"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Floating Quick Category Bar (7 Utilitas) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 relative z-20">
        <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl shadow-lg p-2 sm:p-2.5 flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto custom-scrollbar">
          {QUICK_CATEGORIES.map(cat => {
            const Icon = cat.icon
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[13px] sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-lime-300' : 'text-teal-700 dark:text-teal-400'}`} />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-16">
        {/* 4. Empat Kartu Fitur Unggulan Kitu (Sesuai Konsep Landing Page) */}
        <section aria-labelledby="features-heading" className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 id="features-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">
              Fitur Unggulan Satukit
            </h2>
            <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400">
              Solusi cerdas serba bisa yang dirancang khusus untuk mempercepat pekerjaan dan karier Anda
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {/* Kartu 1: CV Builder ATS */}
            <div
              className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-teal-300 dark:hover:border-teal-700 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="h-36 sm:h-40 rounded-2xl bg-gradient-to-b from-teal-50/80 to-stone-50 dark:from-stone-800 dark:to-stone-850 border border-teal-100/60 dark:border-stone-700/60 flex items-center justify-center p-3 overflow-hidden relative">
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[13px] font-bold uppercase tracking-wider">
                    Populer
                  </span>
                  <img
                    src={kituFeatureCv}
                    alt="Kitu CV Builder"
                    className="max-h-32 w-auto object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-4 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
                  CV Builder ATS
                </h3>
                <p className="text-[13px] sm:text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                  Bikin CV profesional yang lolos seleksi ATS dalam hitungan menit. Puluhan template siap pakai dengan pratinjau A4 langsung.
                </p>
              </div>

              <div className="pt-4 mt-auto">
                <button
                  type="button"
                  onClick={() => runGuardedAction('create', onCreateNewResume)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-teal-50 dark:bg-teal-950/80 hover:bg-teal-800 dark:hover:bg-teal-700 text-teal-800 dark:text-teal-300 hover:text-white dark:hover:text-white text-[13px] font-bold transition-all cursor-pointer"
                >
                  <span>Buat CV Sekarang</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Kartu 2: Edit Foto & Background */}
            <div
              className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-teal-300 dark:hover:border-teal-700 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="h-36 sm:h-40 rounded-2xl bg-gradient-to-b from-teal-50/80 to-stone-50 dark:from-stone-800 dark:to-stone-850 border border-teal-100/60 dark:border-stone-700/60 flex items-center justify-center p-3 overflow-hidden relative">
                  <img
                    src={kituFeaturePhoto}
                    alt="Kitu Edit Foto"
                    className="max-h-32 w-auto object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-4 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
                  Edit &amp; Sentuh Foto
                </h3>
                <p className="text-[13px] sm:text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                  Hapus latar belakang foto otomatis dengan AI lokal, kompres ukuran gambar, dan ubah rasio foto formal lamaran kerja.
                </p>
              </div>

              <div className="pt-4 mt-auto">
                <button
                  type="button"
                  onClick={() => onNavigate('tools')}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-teal-800 dark:hover:bg-teal-700 text-stone-800 dark:text-stone-200 hover:text-white dark:hover:text-white text-[13px] font-bold transition-all cursor-pointer"
                >
                  <span>Mulai Edit Foto</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Kartu 3: Konversi & Kelola PDF */}
            <div
              className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-teal-300 dark:hover:border-teal-700 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="h-36 sm:h-40 rounded-2xl bg-gradient-to-b from-teal-50/80 to-stone-50 dark:from-stone-800 dark:to-stone-850 border border-teal-100/60 dark:border-stone-700/60 flex items-center justify-center p-3 overflow-hidden relative">
                  <img
                    src={kituFeatureConvert}
                    alt="Kitu Konversi File"
                    className="max-h-32 w-auto object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-4 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
                  Konversi &amp; Kelola PDF
                </h3>
                <p className="text-[13px] sm:text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                  Gabungkan PDF, pisahkan halaman, ubah Word/Excel ke PDF, kompresi cerdas, serta jalankan OCR dokumen teks.
                </p>
              </div>

              <div className="pt-4 mt-auto">
                <button
                  type="button"
                  onClick={() => onNavigate('tools')}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-teal-800 dark:hover:bg-teal-700 text-stone-800 dark:text-stone-200 hover:text-white dark:hover:text-white text-[13px] font-bold transition-all cursor-pointer"
                >
                  <span>Konversi Sekarang</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Kartu 4: Pendekkan Tautan URL */}
            <div
              className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-teal-300 dark:hover:border-teal-700 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="h-36 sm:h-40 rounded-2xl bg-gradient-to-b from-teal-50/80 to-stone-50 dark:from-stone-800 dark:to-stone-850 border border-teal-100/60 dark:border-stone-700/60 flex items-center justify-center p-3 overflow-hidden relative">
                  <img
                    src={kituFeatureShortener}
                    alt="Kitu URL Shortener"
                    className="max-h-32 w-auto object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-4 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
                  Pendekkan Tautan
                </h3>
                <p className="text-[13px] sm:text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                  Bikin tautan panjang jadi ringkas dan rapi dengan domain kustom satuk.it, cepat diakses dan mudah dibagikan ke mana pun.
                </p>
              </div>

              <div className="pt-4 mt-auto">
                <button
                  type="button"
                  onClick={() => onNavigate('tools')}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-teal-800 dark:hover:bg-teal-700 text-stone-800 dark:text-stone-200 hover:text-white dark:hover:text-white text-[13px] font-bold transition-all cursor-pointer"
                >
                  <span>Buat Tautan Pendek</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Banner "Cara Menggunakan Satukit" (3 Langkah Mudah) */}
        <section
          aria-labelledby="how-it-works-heading"
          className="rounded-3xl bg-gradient-to-r from-teal-900 via-teal-850 to-teal-950 dark:from-stone-900 dark:via-stone-900 dark:to-stone-950 text-white p-6 sm:p-10 shadow-lg border border-teal-700/50 dark:border-stone-800 relative overflow-hidden"
        >
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6 sm:space-y-8">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <span className="text-[13px] font-bold uppercase tracking-wider text-lime-400">
                Mudah &amp; Cepat
              </span>
              <h2 id="how-it-works-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                3 Langkah Mudah Pakai Satukit
              </h2>
              <p className="text-[13px] sm:text-sm text-teal-100/80">
                Bereskan dokumen dan tugas digital Anda dalam hitungan detik tanpa instalasi ribet
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Langkah 1 */}
              <div className="bg-white/10 dark:bg-stone-800/60 backdrop-blur-xs border border-white/10 dark:border-stone-700/50 rounded-2xl p-5 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-lime-400 text-teal-950 font-black text-lg flex items-center justify-center shadow-xs">
                  1
                </div>
                <h3 className="text-base font-bold text-white">Pilih Alat yang Dibutuhkan</h3>
                <p className="text-[13px] sm:text-sm text-teal-100/80 leading-relaxed">
                  Temukan alat yang kamu mau dari CV builder, konversi file PDF, kompresi, hapus background, sampai pemendek link.
                </p>
              </div>

              {/* Langkah 2 */}
              <div className="bg-white/10 dark:bg-stone-800/60 backdrop-blur-xs border border-white/10 dark:border-stone-700/50 rounded-2xl p-5 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-lime-400 text-teal-950 font-black text-lg flex items-center justify-center shadow-xs">
                  2
                </div>
                <h3 className="text-base font-bold text-white">Unggah atau Masukkan Data</h3>
                <p className="text-[13px] sm:text-sm text-teal-100/80 leading-relaxed">
                  Proses dokumen langsung di perangkat browser Anda dengan perlindungan enkripsi lokal dan privasi aman 100%.
                </p>
              </div>

              {/* Langkah 3 */}
              <div className="bg-white/10 dark:bg-stone-800/60 backdrop-blur-xs border border-white/10 dark:border-stone-700/50 rounded-2xl p-5 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-lime-400 text-teal-950 font-black text-lg flex items-center justify-center shadow-xs">
                  3
                </div>
                <h3 className="text-base font-bold text-white">Unduh Hasilnya Instan</h3>
                <p className="text-[13px] sm:text-sm text-teal-100/80 leading-relaxed">
                  Dapatkan hasil berkas beresolusi tinggi tanpa watermark, tanpa batasan langganan, dan siap digunakan seketika.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Meja Draf Pengguna & Ledger Status (Arsip & Ruang Kerja Nyata) */}
        <section aria-labelledby="recent-drafts-heading" className="space-y-6">
          <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-3xl shadow-xs overflow-hidden">
            {/* Accent Header Stripe */}
            <div className="h-1.5 w-full bg-gradient-to-r from-teal-700 via-teal-600 to-lime-500" />

            {/* Status Ledger Bar (4 Indikator) */}
            <div
              aria-label="Ringkasan status meja kerja"
              className="bg-stone-50/70 dark:bg-stone-850/80 border-b border-stone-200/90 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200/90 dark:divide-stone-800"
            >
              <div className="px-5 py-3.5 sm:px-6 sm:py-4 min-w-0">
                <span className="text-[13px] font-medium text-stone-600 dark:text-stone-400 block">
                  Draf tersimpan
                </span>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span
                    className="text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums"
                    data-testid="stat-total-drafts"
                  >
                    {isLoadingDrafts ? '…' : draftsList.length}
                  </span>
                  <span className="text-[13px] text-stone-600 dark:text-stone-400">dokumen lokal</span>
                </div>
              </div>

              <div className="px-5 py-3.5 sm:px-6 sm:py-4 min-w-0">
                <span className="text-[13px] font-medium text-stone-600 dark:text-stone-400 block">
                  Skor ATS draf
                </span>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums"
                      data-testid="stat-ats-score"
                    >
                      {atsScore !== undefined ? atsScore : '—'}
                    </span>
                    {atsScore !== undefined && (
                      <span className="text-[13px] font-medium text-stone-600 dark:text-stone-400 tabular-nums">/ 100</span>
                    )}
                  </div>
                  {atsScore !== undefined && onOpenAtsScore ? (
                    <button
                      type="button"
                      onClick={onOpenAtsScore}
                      data-testid="btn-dashboard-ats-details"
                      className="text-[13px] font-semibold text-teal-800 dark:text-teal-400 hover:text-teal-950 dark:hover:text-teal-300 underline underline-offset-2 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                    >
                      Rincian skor
                    </button>
                  ) : (
                    <span className="text-[13px] text-stone-500 dark:text-stone-400">Belum ada evaluasi</span>
                  )}
                </div>
              </div>

              <div className="px-5 py-3.5 sm:px-6 sm:py-4 min-w-0">
                <span className="text-[13px] font-medium text-stone-600 dark:text-stone-400 block">
                  Dokumen aktif
                </span>
                <span
                  className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-1 truncate block"
                  title={activeDraftTitle || 'Belum dipilih'}
                  data-testid="stat-active-draft-title"
                >
                  {isLoadingDrafts ? 'Memuat draf...' : activeDraftTitle || 'Belum ada CV'}
                </span>
              </div>

              <div className="px-5 py-3.5 sm:px-6 sm:py-4 min-w-0">
                <span className="text-[13px] font-medium text-stone-600 dark:text-stone-400 block">
                  Utilitas dokumen
                </span>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span
                    className="text-xl font-bold text-stone-900 dark:text-stone-100 tabular-nums"
                    data-testid="stat-tools-count"
                  >
                    {documentToolsCount}
                  </span>
                  <span className="text-[13px] text-stone-600 dark:text-stone-400 truncate">alat PDF &amp; konversi</span>
                </div>
              </div>
            </div>

            {/* Grid 2 Kolom Meja Kerja: Draf (7 Kolom) & Ruang Kerja (5 Kolom) */}
            <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
              {/* Kolom Kiri: Draf CV Tersimpan */}
              <div className="lg:col-span-7 space-y-4 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 id="recent-drafts-heading" className="text-lg font-bold text-stone-900 dark:text-stone-100">
                      Arsip &amp; Draf CV Tersimpan
                    </h2>
                    <p className="text-[13px] sm:text-sm text-stone-600 dark:text-stone-400 mt-0.5">
                      Pilih dokumen untuk langsung menyunting di ruang editor A4
                    </p>
                  </div>
                  {draftsList.length > 0 && !isLoadingDrafts && (
                    <button
                      type="button"
                      disabled={pendingAction !== null}
                      onClick={() => runGuardedAction('create', onCreateNewResume)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-teal-800 dark:text-teal-400 hover:text-teal-950 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/80 transition cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                      data-testid="btn-dashboard-new-inline"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
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
                        className="p-4 sm:p-5 bg-stone-50 dark:bg-stone-800/80 border border-stone-200/90 dark:border-stone-700/80 rounded-2xl flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-2.5">
                          <div className="h-4 w-48 max-w-full rounded bg-stone-200 dark:bg-stone-700" />
                          <div className="h-3.5 w-32 max-w-full rounded bg-stone-100 dark:bg-stone-800" />
                        </div>
                        <div className="h-9 w-16 rounded-xl bg-stone-100 dark:bg-stone-700 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : draftsList.length === 0 ? (
                  <div
                    className="p-6 sm:p-8 bg-stone-50/70 dark:bg-stone-800/50 border border-stone-200/90 dark:border-stone-800 rounded-2xl space-y-3.5 min-h-[220px] flex flex-col justify-center"
                    data-testid="dashboard-drafts-empty"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 flex items-center justify-center">
                      <FilePlus className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="max-w-lg">
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Belum ada CV yang dibuat</h3>
                      <p className="text-[13px] sm:text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                        Setiap draf CV yang Anda susun disimpan secara lokal di browser perangkat ini. Mulai dari lembar baru atau impor berkas resume yang sudah Anda miliki.
                      </p>
                    </div>
                    <div className="pt-1 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() => runGuardedAction('create', onCreateNewResume)}
                        className="px-4 py-2 text-[13px] font-semibold text-white bg-teal-800 hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-60 rounded-xl transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                      >
                        + Buat CV Pertama
                      </button>
                      <button
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() => runGuardedAction('import', onOpenImportModal)}
                        className="px-4 py-2 text-[13px] font-semibold text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-60 rounded-xl border border-stone-300 dark:border-stone-700 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
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
                          className={`p-4 sm:p-5 bg-white dark:bg-stone-850 border rounded-2xl transition duration-150 flex items-center justify-between gap-3 min-w-0 ${
                            isCurrentActive
                              ? 'border-teal-700 dark:border-teal-500 border-l-4 shadow-2xs'
                              : 'border-stone-200/90 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
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
                                className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 hover:text-teal-800 dark:hover:text-teal-400 truncate text-left transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                                title={item.title}
                              >
                                {item.title}
                              </button>
                              {item.favorite && (
                                <Star
                                  className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0"
                                  aria-label="Favorit"
                                />
                              )}
                              {isCurrentActive && (
                                <span className="text-[13px] font-semibold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950 text-teal-900 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0">
                                  Aktif
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[13px] text-stone-500 dark:text-stone-400 min-w-0">
                              {item.targetJobTitle ? (
                                <span
                                  className="truncate max-w-[200px] sm:max-w-[260px] text-stone-700 dark:text-stone-300 font-medium"
                                  title={item.targetJobTitle}
                                >
                                  {item.targetJobTitle}
                                </span>
                              ) : (
                                <span className="capitalize">{item.templateId}</span>
                              )}
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 shrink-0">
                                <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" aria-hidden="true" />
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
                                className="p-2 rounded-xl text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                                title={item.favorite ? 'Hapus favorit' : 'Tandai favorit'}
                                aria-label={`Favorit ${item.title}`}
                              >
                                <Star
                                  className={`w-4 h-4 ${
                                    item.favorite ? 'text-amber-500 fill-amber-500' : ''
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
                              className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 text-[13px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                              title="Buka dan sunting CV"
                            >
                              <Edit3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span className="hidden sm:inline">Sunting</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Kolom Kanan: Direktori Ruang Kerja Satukit */}
              <div className="lg:col-span-5 space-y-4 min-w-0">
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                    Direktori Ruang Kerja
                  </h3>
                  <p className="text-[13px] sm:text-sm text-stone-600 dark:text-stone-400 mt-0.5">
                    Akses cepat ke modul penyuntingan, audit ATS, atau pemrosesan berkas
                  </p>
                </div>

                <div className="bg-white dark:bg-stone-850 border border-stone-200/90 dark:border-stone-800 rounded-2xl divide-y divide-stone-200/90 dark:divide-stone-800 overflow-hidden shadow-2xs">
                  {/* Modul 1: CV Builder */}
                  <button
                    type="button"
                    onClick={() => onNavigate('builder')}
                    data-testid="card-workspace-builder"
                    className="group w-full text-left p-4 sm:p-5 hover:bg-stone-50/90 dark:hover:bg-stone-800 transition-colors flex items-start gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700"
                  >
                    <span className="p-2.5 rounded-xl bg-teal-100/70 dark:bg-teal-950 text-teal-800 dark:text-teal-400 border border-teal-200 dark:border-teal-800 shrink-0 mt-0.5">
                      <FileText className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-teal-800 dark:group-hover:text-teal-400 transition-colors">
                          Buat &amp; Sunting CV
                        </h4>
                        <span className="text-[13px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-100/60 dark:bg-teal-950 px-2 py-0.5 rounded-md">
                          Editor A4
                        </span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-stone-600 dark:text-stone-400">
                        Susun riwayat kerja, pendidikan, dan keahlian dengan pratinjau cetak A4 langsung serta pilihan template ramah ATS.
                      </p>
                    </div>
                  </button>

                  {/* Modul 2: Optimasi ATS */}
                  <button
                    type="button"
                    onClick={() => onNavigate('ats')}
                    className="group w-full text-left p-4 sm:p-5 hover:bg-stone-50/90 dark:hover:bg-stone-800 transition-colors flex items-start gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700"
                    data-testid="card-workspace-ats"
                  >
                    <span className="p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-amber-800 dark:group-hover:text-amber-400 transition-colors">
                          Optimasi ATS &amp; Job Match
                        </h4>
                        <span className="text-[13px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950 px-2 py-0.5 rounded-md">
                          Audit &amp; Skor
                        </span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-stone-600 dark:text-stone-400">
                        Periksa keterbacaan mesin ATS dan cocokkan kompetensi CV Anda dengan deskripsi lowongan pekerjaan idaman.
                      </p>
                    </div>
                  </button>

                  {/* Modul 3: Alat Dokumen & Konversi */}
                  <button
                    type="button"
                    onClick={() => onNavigate('tools')}
                    data-testid="card-workspace-tools"
                    className="group w-full text-left p-4 sm:p-5 hover:bg-stone-50/90 dark:hover:bg-stone-800 transition-colors flex items-start gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700"
                  >
                    <span className="p-2.5 rounded-xl bg-emerald-100/70 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0 mt-0.5">
                      <Wrench className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-400 transition-colors">
                          Alat Dokumen &amp; Konversi
                        </h4>
                        <span className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950 px-2 py-0.5 rounded-md tabular-nums">
                          {documentToolsCount} utilitas
                        </span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-stone-600 dark:text-stone-400">
                        Konversi DOCX, Excel, PDF, OCR lokal, gabung/pisah berkas, hapus background foto, hingga pemendek tautan.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Footer Pengembang */}
        <Footer className="mt-8" />
      </div>
    </main>
  )
}
