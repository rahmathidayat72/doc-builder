import React, { useRef, useState } from 'react'
import {
  FileText,
  ShieldCheck,
  Wrench,
  Plus,
  Upload,
  Clock,
  Star,
  FilePlus,
  Edit3,
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
import { Reveal } from '../layout/Reveal'
import { HeroScenery } from '../brand/HeroScenery'
import { KituNotice } from '../brand/KituNotice'
import { KITU_EXPRESSIONS } from '../brand/kituExpressions'

// Brand Assets
import kituMascotWebp from '../../assets/kitu-mascot.webp'
import kituMascotPng from '../../assets/kitu-mascot.png'

/** Atur kelambatan animasi masuk (ms) lewat variabel CSS `--d`. */
const delay = (ms: number): React.CSSProperties => ({ '--d': `${ms}ms` } as React.CSSProperties)

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
  { id: 'cv', label: 'CV Builder', icon: FileText, workspace: 'builder' as Workspace },
  { id: 'photo', label: 'Edit Foto', icon: ImageIcon, workspace: 'tools' as Workspace },
  { id: 'background', label: 'Hapus Latar', icon: LayoutGrid, workspace: 'tools' as Workspace },
  { id: 'convert', label: 'Konversi File', icon: Files, workspace: 'tools' as Workspace },
  { id: 'files', label: 'Kelola File', icon: Wrench, workspace: 'tools' as Workspace },
  { id: 'url', label: 'Pendekkan URL', icon: Link2, workspace: 'tools' as Workspace },
  { id: 'more', label: 'Lainnya', icon: LayoutGrid, workspace: 'tools' as Workspace },
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
  const [activeCategory, setActiveCategory] = useState<string>('cv')
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
      className="flex-1 min-h-0 overflow-y-auto paper-canvas dark:bg-[#0b1120] text-[#26343a] dark:text-stone-100 custom-scrollbar animate-fade-in transition-colors"
      data-testid="dashboard-view"
    >
      {/* 1. Storage Error Alert jika ada kendala */}
      {storageError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <KituNotice
            tone="error"
            role="alert"
            data-testid="dashboard-storage-error"
            title="Kendala Penyimpanan Lokal"
            action={
              onRetryLoadDrafts && (
                <button
                  type="button"
                  onClick={() => onRetryLoadDrafts()}
                  data-testid="btn-dashboard-retry-storage"
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-rose-900 hover:bg-rose-100 dark:hover:bg-rose-800 text-rose-900 dark:text-rose-100 border border-rose-300 dark:border-rose-700 text-sm font-semibold transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  <span>Coba Lagi</span>
                </button>
              )
            }
          >
            <span className="text-sm">{storageError}</span>
          </KituNotice>
        </div>
      )}

      {/* 2. Hero Satukit: lanskap vektor (tanpa tepi persegi) + gelombang mask + Kitu */}
      <section
        aria-labelledby="dashboard-welcome-heading"
        className="hero-wave-mask relative overflow-hidden bg-[linear-gradient(110deg,#e4f9f2_0%,#d3f5ec_40%,#e9fbf5_74%,#f6fffb_100%)] dark:bg-[linear-gradient(110deg,#061a19_0%,#0a2926_46%,#071618_100%)] pt-8 pb-24 sm:pt-10 sm:pb-28 lg:pt-6 lg:pb-28 transition-colors duration-500"
      >
        <HeroScenery />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center min-h-[440px] lg:min-h-[420px]">
            {/* Kolom Kiri: Tagline, Headline dengan Brush Underline, Subteks, CTA */}
            <div className="lg:col-span-6 space-y-4 sm:space-y-6 text-left">
              <div style={delay(80)} className="hero-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c2f6ea] dark:bg-teal-950/80 border border-[#16b89a]/30 dark:border-teal-600/50 text-[#095f57] dark:text-teal-200 font-bold text-[13px] tracking-wide shadow-2xs">
                <span className="text-[#ffb22e] text-base leading-none" aria-hidden="true">✦</span>
                <span>Platform Alat Digital Serba Ada</span>
                {privateMode && (
                  <span className="ml-1 pl-2 border-l border-teal-300 dark:border-teal-700 text-amber-700 dark:text-amber-400 font-bold">
                    Mode Privat Aktif
                  </span>
                )}
              </div>

              <h1
                id="dashboard-welcome-heading"
                style={delay(170)}
                className="hero-in text-4xl sm:text-5xl lg:text-[3.8rem] font-black tracking-[-0.035em] text-[#17383c] dark:text-white leading-[1.08]"
              >
                Satu Tempat,
                <br />
                Banyak{' '}
                <span className="relative inline-block text-[#17383c] dark:text-white">
                  <span className="text-[#0f766e] dark:text-teal-300">Solusi Digital</span>
                  <svg
                    className="absolute -bottom-2 sm:-bottom-3 left-0 w-full h-3 sm:h-4 text-[#a3e635] dark:text-teal-400 overflow-visible pointer-events-none"
                    viewBox="0 0 280 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 15C60 4 160 2 277 10"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeLinecap="round"
                      className="animate-brush-draw"
                    />
                  </svg>
                </span>
              </h1>

              <p style={delay(270)} className="hero-in text-base sm:text-lg leading-relaxed text-[#40565b] dark:text-stone-300 max-w-xl">
                Buat CV profesional, edit foto, olah file, pendekkan URL, dan berbagai alat digital lainnya dalam satu platform yang mudah, cepat, dan gratis untuk dicoba.
              </p>

              {/* Tombol Aksi Utama */}
              <div style={delay(360)} className="hero-in pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() => runGuardedAction('create', onCreateNewResume)}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[#079875] hover:bg-[#068465] dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-bold shadow-[0_10px_25px_rgba(7,152,117,0.32)] hover:shadow-[0_12px_28px_rgba(7,152,117,0.45)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  data-testid="btn-dashboard-create-cv"
                >
                  <svg className="w-3.5 h-3.5 fill-white text-white shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <polygon points="6 3 20 12 6 21 6 3" />
                  </svg>
                  <span>{pendingAction === 'create' ? 'Membuat CV...' : 'Coba Sekarang Gratis'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('tools')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white dark:bg-[#0e2427] hover:bg-teal-50/70 dark:hover:bg-[#133236] text-[#17383c] dark:text-white border-2 border-stone-800/80 dark:border-teal-600/70 text-sm font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                >
                  <span>Lihat Semua Fitur</span>
                  <ArrowRight className="w-4 h-4 text-[#17383c] dark:text-teal-400 shrink-0" aria-hidden="true" />
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
                    className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-white/90 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-60 text-stone-900 dark:text-stone-100 border border-stone-300 dark:border-stone-700 text-sm font-semibold transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
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
                  className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-full bg-white/70 dark:bg-stone-800/90 hover:bg-white dark:hover:bg-stone-700 disabled:opacity-60 text-stone-700 dark:text-stone-200 border border-teal-900/10 dark:border-stone-700 text-sm font-semibold transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  data-testid="btn-dashboard-import-cv"
                >
                  <Upload className="w-4 h-4 text-stone-600 dark:text-stone-400 shrink-0" aria-hidden="true" />
                  <span>Impor CV</span>
                </button>
              </div>

              {/* 3 Trust Badges */}
              <div style={delay(450)} className="hero-in pt-2 flex flex-wrap items-center gap-x-7 gap-y-2.5 text-[13px] font-bold text-[#29484c] dark:text-stone-300">
                <span className="inline-flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#079875] dark:text-teal-400 fill-[#079875]/20" />
                  Cepat &amp; Mudah
                </span>
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#079875] dark:text-teal-400" />
                  Aman &amp; Privat
                </span>
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#079875] dark:text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/>
                  </svg>
                  Selalu Bertambah
                </span>
              </div>
            </div>

            {/* Kolom Kanan: Maskot Kitu (PNG/WebP transparan utuh, bukan potongan) + Speech Bubble */}
            <div className="lg:col-span-6 flex justify-center items-end relative pt-4 pb-2 lg:py-0 lg:self-stretch">
              <div className="relative w-full max-w-sm sm:max-w-lg flex flex-col items-center justify-end lg:h-full">
                {/* Speech Bubble Kitu */}
                <div style={delay(650)} className="hero-in absolute top-0 right-0 sm:right-2 z-20">
                  <div className="relative bg-white/98 dark:bg-[#0c2427] border-2 border-[#079875] dark:border-teal-400 rounded-[2rem] px-5 py-4 shadow-[0_12px_32px_rgba(7,152,117,0.18)] max-w-[210px] text-sm text-[#17383c] dark:text-teal-50 animate-float-balloon">
                    <span className="block text-sm font-semibold text-stone-700 dark:text-stone-300 leading-tight">Halo, aku</span>
                    <div className="flex items-center gap-1.5 my-0.5">
                      <strong className="text-3xl font-black leading-none text-[#079875] dark:text-teal-400">Kitu!</strong>
                      <div className="flex flex-col gap-0.5 text-[#ffb22e] animate-sparkle" aria-hidden="true">
                        <span className="w-2.5 h-0.5 bg-[#ffb22e] rounded-full rotate-45 transform origin-left" />
                        <span className="w-3.5 h-0.5 bg-[#ffb22e] rounded-full" />
                        <span className="w-2.5 h-0.5 bg-[#ffb22e] rounded-full -rotate-45 transform origin-left" />
                      </div>
                    </div>
                    <span className="block text-[13px] font-medium text-stone-600 dark:text-stone-300 leading-snug">
                      Asisten digitalmu di Satukit.
                    </span>
                    {/* Ekor Segitiga Balon */}
                    <div className="absolute -bottom-2.5 left-8 w-4 h-4 bg-white dark:bg-[#0c2427] border-b-2 border-r-2 border-[#079875] dark:border-teal-400 rotate-45" />
                  </div>
                </div>

                <div
                  style={delay(300)}
                  className="mascot-in relative z-10 mt-14 sm:mt-10 lg:mt-0 lg:absolute lg:bottom-[-1rem] lg:left-0"
                >
                  {/* Bayangan lantai lembut mengikuti gerak melayang */}
                  <div
                    aria-hidden="true"
                    className="absolute -bottom-1 left-1/2 h-5 w-3/5 -translate-x-1/2 rounded-[50%] bg-teal-900/20 dark:bg-black/40 blur-md animate-pulse-subtle"
                  />
                  <picture>
                    <source srcSet={kituMascotWebp} type="image/webp" />
                    <img
                      src={kituMascotPng}
                      alt="Kitu — Maskot Resmi Satukit"
                      draggable={false}
                      className="relative w-72 sm:w-96 lg:w-[28rem] h-auto object-contain mx-auto select-none drop-shadow-[0_18px_22px_rgba(8,80,70,0.22)] animate-float-gentle"
                    />
                  </picture>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Floating Quick Category Bar (7 Utilitas) */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 sm:-mt-10 lg:-mt-12 relative z-20">
        <div className="bg-white/98 dark:bg-[#0c2225]/98 backdrop-blur-md border border-teal-900/10 dark:border-teal-500/25 rounded-[2rem] shadow-[0_16px_40px_rgba(15,118,110,0.12)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.4)] p-2.5 sm:p-3 flex items-stretch justify-between gap-1 sm:gap-2 overflow-x-auto custom-scrollbar">
          {QUICK_CATEGORIES.map(cat => {
            const Icon = cat.icon
            const isActive = activeCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className={`min-w-28 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl text-[13px] sm:text-sm font-bold flex flex-col items-center justify-center gap-1.5 whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 border-r border-stone-100 dark:border-stone-800 last:border-r-0 hover:-translate-y-0.5 ${
                  isActive
                    ? 'bg-[#d2f7ed] dark:bg-teal-900/70 text-[#0f766e] dark:text-teal-200 shadow-2xs'
                    : 'text-[#40565b] dark:text-stone-300 hover:text-[#0f766e] dark:hover:text-teal-300 hover:bg-teal-50/70 dark:hover:bg-[#133236]'
                }`}
              >
                <Icon className={`w-6 h-6 transition-transform group-hover:scale-110 ${isActive ? 'text-[#079875] dark:text-teal-300' : 'text-[#0f8f7c] dark:text-teal-400'}`} />
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-12 sm:space-y-16">
        {/* 4. Empat Kartu Fitur Unggulan Kitu (Sesuai Konsep Landing Page) */}
        <Reveal>
          <section aria-labelledby="features-heading" className="space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <div className="w-12 h-1 bg-[#16b89a] rounded-full mx-auto mb-2.5" />
              <h2 id="features-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#17383c] dark:text-white">
                Fitur Unggulan Satukit
              </h2>
              <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400">
                Berbagai alat digital praktis untuk kebutuhan kerja, belajar, dan produktivitasmu.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Kartu 1: CV Builder */}
              <div
                className="relative min-w-0 overflow-hidden bg-white dark:bg-[#0c2225] border border-stone-200/90 dark:border-teal-800/50 hover:border-teal-400 dark:hover:border-teal-500 rounded-2xl p-4 shadow-[0_6px_20px_rgba(15,118,110,0.06)] hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(20,184,166,0.12)] hover:-translate-y-1.5 transition-all duration-300 min-h-34 group"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={KITU_EXPRESSIONS.buatcv}
                    alt="Kitu CV Builder"
                    className="w-18 h-18 sm:w-20 sm:h-20 object-contain shrink-0 select-none group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 drop-shadow-[0_4px_10px_rgba(7,152,117,0.18)]"
                  />
                  <div className="min-w-0 flex-1 pr-6">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#079875] dark:text-teal-400 shrink-0" />
                      <h3 className="text-base font-extrabold text-[#17383c] dark:text-stone-100 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
                        CV Builder
                      </h3>
                    </div>
                    <p className="text-[13px] text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                      Buat CV profesional dengan cepat dan mudah.
                    </p>
                  </div>
                </div>

                <div className="absolute right-3.5 bottom-3.5">
                  <button
                    type="button"
                    onClick={() => runGuardedAction('create', onCreateNewResume)}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-[#079875] hover:bg-[#068465] text-white transition-all group-hover:scale-110 group-hover:translate-x-0.5 cursor-pointer shadow-xs"
                  >
                    <span className="sr-only">Buat CV Sekarang</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Kartu 2: Edit Foto */}
              <div
                className="relative min-w-0 overflow-hidden bg-white dark:bg-[#0c2225] border border-stone-200/90 dark:border-teal-800/50 hover:border-teal-400 dark:hover:border-teal-500 rounded-2xl p-4 shadow-[0_6px_20px_rgba(15,118,110,0.06)] hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(20,184,166,0.12)] hover:-translate-y-1.5 transition-all duration-300 min-h-34 group"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={KITU_EXPRESSIONS.editfoto}
                    alt="Kitu Edit Foto"
                    className="w-18 h-18 sm:w-20 sm:h-20 object-contain shrink-0 select-none group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 drop-shadow-[0_4px_10px_rgba(7,152,117,0.18)]"
                  />
                  <div className="min-w-0 flex-1 pr-6">
                    <h3 className="text-base font-extrabold text-[#17383c] dark:text-stone-100 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
                      Edit Foto
                    </h3>
                    <p className="text-[13px] text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                      Atur ukuran, kompres, dan tingkatkan kualitas foto.
                    </p>
                  </div>
                </div>

                <div className="absolute right-3.5 bottom-3.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('tools')}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-[#079875] hover:bg-[#068465] text-white transition-all group-hover:scale-110 group-hover:translate-x-0.5 cursor-pointer shadow-xs"
                  >
                    <span className="sr-only">Mulai Edit Foto</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Kartu 3: Konversi File */}
              <div
                className="relative min-w-0 overflow-hidden bg-white dark:bg-[#0c2225] border border-stone-200/90 dark:border-teal-800/50 hover:border-teal-400 dark:hover:border-teal-500 rounded-2xl p-4 shadow-[0_6px_20px_rgba(15,118,110,0.06)] hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(20,184,166,0.12)] hover:-translate-y-1.5 transition-all duration-300 min-h-34 group"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={KITU_EXPRESSIONS.konversi}
                    alt="Kitu Konversi File"
                    className="w-18 h-18 sm:w-20 sm:h-20 object-contain shrink-0 select-none group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300 drop-shadow-[0_4px_10px_rgba(7,152,117,0.18)]"
                  />
                  <div className="min-w-0 flex-1 pr-6">
                    <div className="flex items-center gap-1.5">
                      <Files className="w-4 h-4 text-[#079875] dark:text-teal-400 shrink-0" />
                      <h3 className="text-base font-extrabold text-[#17383c] dark:text-stone-100 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
                        Konversi File
                      </h3>
                    </div>
                    <p className="text-[13px] text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                      Ubah antar format file (PDF, DOCX, JPG, dll).
                    </p>
                  </div>
                </div>

                <div className="absolute right-3.5 bottom-3.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('tools')}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-[#079875] hover:bg-[#068465] text-white transition-all group-hover:scale-110 group-hover:translate-x-0.5 cursor-pointer shadow-xs"
                  >
                    <span className="sr-only">Konversi Sekarang</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Kartu 4: Pendekkan URL */}
              <div
                className="relative min-w-0 overflow-hidden bg-white dark:bg-[#0c2225] border border-stone-200/90 dark:border-teal-800/50 hover:border-teal-400 dark:hover:border-teal-500 rounded-2xl p-4 shadow-[0_6px_20px_rgba(15,118,110,0.06)] hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgba(20,184,166,0.12)] hover:-translate-y-1.5 transition-all duration-300 min-h-34 group"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={KITU_EXPRESSIONS.pendekkanurl}
                    alt="Kitu URL Shortener"
                    className="w-18 h-18 sm:w-20 sm:h-20 object-contain shrink-0 select-none group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 drop-shadow-[0_4px_10px_rgba(7,152,117,0.18)]"
                  />
                  <div className="min-w-0 flex-1 pr-6">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-[#079875] dark:text-teal-400 shrink-0" />
                      <h3 className="text-base font-extrabold text-[#17383c] dark:text-stone-100 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
                        Pendekkan URL
                      </h3>
                    </div>
                    <p className="text-[13px] text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                      Buat tautan lebih ringkas, rapi, dan mudah dibagikan.
                    </p>
                  </div>
                </div>

                <div className="absolute right-3.5 bottom-3.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('tools')}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-[#079875] hover:bg-[#068465] text-white transition-all group-hover:scale-110 group-hover:translate-x-0.5 cursor-pointer shadow-xs"
                  >
                    <span className="sr-only">Buat Tautan Pendek</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* 5. Banner Cara Menggunakan Satukit (3 Langkah Mudah) */}
        <Reveal delay={80}>
          <section
            aria-labelledby="how-it-works-heading"
            className="rounded-[2rem] bg-[#edfcf6] dark:bg-[#092220] border border-[#bbf0dc] dark:border-teal-800/60 text-[#17383c] dark:text-white p-6 sm:p-8 shadow-xs relative overflow-hidden"
          >
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.1fr_2.9fr] gap-6 lg:gap-8 items-center">
              <div>
                <h2 id="how-it-works-heading" className="text-2xl font-black tracking-tight text-[#17383c] dark:text-white">
                  Cara Menggunakan Satukit
                </h2>
                <p className="text-sm text-[#40565b] dark:text-stone-300 mt-1 leading-relaxed">
                  Hanya 3 langkah mudah, semua urusan digital jadi beres!
                </p>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
                {/* Langkah 1 */}
                <div className="w-full flex-1 flex items-center gap-3 bg-white/80 dark:bg-[#0e2726]/80 border border-white/90 dark:border-teal-700/40 rounded-2xl p-3.5 shadow-2xs hover:-translate-y-0.5 transition-transform">
                  <div className="w-7 h-7 rounded-full bg-[#079875] text-white text-[13px] font-black flex items-center justify-center shrink-0 shadow-xs">
                    1
                  </div>
                  <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-[#079875] dark:text-teal-400 shrink-0">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-[#17383c] dark:text-white">Pilih Fitur</h3>
                    <p className="text-[13px] text-[#53676b] dark:text-stone-300 leading-tight mt-0.5">Pilih alat yang kamu butuhkan.</p>
                  </div>
                </div>

                <ArrowRight className="hidden md:block w-4 h-4 text-[#079875] dark:text-teal-400 shrink-0 animate-pulse-subtle" aria-hidden="true" />

                {/* Langkah 2 */}
                <div className="w-full flex-1 flex items-center gap-3 bg-white/80 dark:bg-[#0e2726]/80 border border-white/90 dark:border-teal-700/40 rounded-2xl p-3.5 shadow-2xs hover:-translate-y-0.5 transition-transform">
                  <div className="w-7 h-7 rounded-full bg-[#079875] text-white text-[13px] font-black flex items-center justify-center shrink-0 shadow-xs">
                    2
                  </div>
                  <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-[#079875] dark:text-teal-400 shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-[#17383c] dark:text-white">Unggah &amp; Proses</h3>
                    <p className="text-[13px] text-[#53676b] dark:text-stone-300 leading-tight mt-0.5">Masukkan file atau data, lalu proses otomatis.</p>
                  </div>
                </div>

                <ArrowRight className="hidden md:block w-4 h-4 text-[#079875] dark:text-teal-400 shrink-0 animate-pulse-subtle" aria-hidden="true" />

                {/* Langkah 3 */}
                <div className="w-full flex-1 flex items-center gap-3 bg-white/80 dark:bg-[#0e2726]/80 border border-white/90 dark:border-teal-700/40 rounded-2xl p-3.5 shadow-2xs hover:-translate-y-0.5 transition-transform">
                  <div className="w-7 h-7 rounded-full bg-[#079875] text-white text-[13px] font-black flex items-center justify-center shrink-0 shadow-xs">
                    3
                  </div>
                  <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-[#079875] dark:text-teal-400 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-[#17383c] dark:text-white">Unduh &amp; Gunakan</h3>
                    <p className="text-[13px] text-[#53676b] dark:text-stone-300 leading-tight mt-0.5">Hasilnya siap digunakan!</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* 6. Meja Draf Pengguna & Ledger Status (Arsip & Ruang Kerja Nyata) */}
        <Reveal delay={140}>
          <section aria-labelledby="recent-drafts-heading" className="space-y-6 relative">
          <div className="bg-white dark:bg-[#0c2225] border border-stone-200/90 dark:border-teal-800/40 rounded-3xl shadow-xs overflow-hidden">
            {/* Accent Header Stripe */}
            <div className="h-1.5 w-full bg-gradient-to-r from-teal-700 via-teal-600 to-lime-500" />

            {/* Status Ledger Bar (4 Indikator) */}
            <div
              aria-label="Ringkasan status meja kerja"
              className="bg-stone-50/70 dark:bg-[#081a1d] border-b border-stone-200/90 dark:border-teal-800/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-stone-200/90 dark:divide-teal-800/40"
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
                    className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl divide-y divide-stone-200/90 dark:divide-stone-800 overflow-hidden shadow-2xs min-h-[220px]"
                    data-testid="dashboard-drafts-list"
                  >
                    {recentDrafts.map(item => {
                      const isCurrentActive = draft?.id === item.id
                      return (
                        <div
                          key={item.id}
                          className={`p-4 sm:p-5 transition duration-150 flex items-center justify-between gap-3 min-w-0 ${
                            isCurrentActive
                              ? 'bg-teal-50/70 dark:bg-teal-950/50 border-l-4 border-l-teal-700 dark:border-l-teal-400'
                              : 'hover:bg-stone-50/80 dark:hover:bg-stone-800/80'
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
                                <span className="text-[13px] font-semibold px-2 py-0.5 rounded-md bg-teal-100/70 dark:bg-teal-950 text-teal-900 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0">
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

                <div className="bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl divide-y divide-stone-200/90 dark:divide-stone-800 overflow-hidden shadow-2xs">
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
      </Reveal>

      {/* 7. Footer Pengembang */}
        <div className="pt-6">
          <Footer />
        </div>
      </div>
    </main>
  )
}
