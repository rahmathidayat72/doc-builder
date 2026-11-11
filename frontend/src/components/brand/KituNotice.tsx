import React from 'react'
import { KITU_EXPRESSIONS, type KituExpression } from './kituExpressions'

export type KituTone = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'confirm'

interface ToneConfig {
  expression: KituExpression
  /** Sapaan Kitu mengikuti gaya bahasa pada Brand Guidelines. */
  title: string
  motion: string
  surface: string
  title_color: string
  body_color: string
}

const TONES: Record<KituTone, ToneConfig> = {
  success: {
    expression: 'selesai',
    title: 'Sip, sudah beres!',
    motion: 'animate-kitu-hop',
    surface:
      'border-emerald-200 bg-emerald-50 dark:border-emerald-700/50 dark:bg-emerald-950/50',
    title_color: 'text-emerald-900 dark:text-emerald-200',
    body_color: 'text-emerald-800 dark:text-emerald-100/90',
  },
  error: {
    expression: 'sedih',
    title: 'Waduh, belum berhasil. Yuk, coba lagi!',
    motion: 'animate-kitu-shake',
    surface: 'border-rose-200 bg-rose-50 dark:border-rose-700/50 dark:bg-rose-950/50',
    title_color: 'text-rose-900 dark:text-rose-200',
    body_color: 'text-rose-800 dark:text-rose-100/90',
  },
  warning: {
    expression: 'kaget',
    title: 'Eits, perhatikan dulu ya!',
    motion: 'animate-kitu-wiggle',
    surface: 'border-amber-200 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/40',
    title_color: 'text-amber-900 dark:text-amber-200',
    body_color: 'text-amber-800 dark:text-amber-100/90',
  },
  info: {
    expression: 'ide',
    title: 'Info dari Kitu',
    motion: 'animate-float-gentle',
    surface: 'border-teal-200 bg-teal-50 dark:border-teal-700/50 dark:bg-teal-950/50',
    title_color: 'text-teal-900 dark:text-teal-200',
    body_color: 'text-teal-800 dark:text-teal-100/90',
  },
  loading: {
    expression: 'fokus',
    title: 'Sebentar, Kitu lagi proses ya!',
    motion: 'animate-kitu-bob',
    surface: 'border-teal-200 bg-teal-50 dark:border-teal-700/50 dark:bg-teal-950/50',
    title_color: 'text-teal-900 dark:text-teal-200',
    body_color: 'text-teal-800 dark:text-teal-100/90',
  },
  confirm: {
    expression: 'berpikir',
    title: 'Yakin nih?',
    motion: 'animate-kitu-bob',
    surface: 'border-amber-200 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/40',
    title_color: 'text-amber-900 dark:text-amber-200',
    body_color: 'text-amber-800 dark:text-amber-100/90',
  },
}

const MASCOT_SIZE = {
  xs: 'h-9 w-9',
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
} as const

interface KituMascotImgProps {
  expression: KituExpression
  size?: keyof typeof MASCOT_SIZE
  className?: string
  /** Kelas animasi (mis. `animate-kitu-hop`). Hormati prefers-reduced-motion lewat CSS global. */
  motion?: string
  alt?: string
}

/** Gambar ekspresi Kitu tanpa potongan/latar; dekoratif secara default. */
export const KituMascotImg: React.FC<KituMascotImgProps> = ({
  expression,
  size = 'sm',
  className = '',
  motion = '',
  alt = '',
}) => (
  <img
    src={KITU_EXPRESSIONS[expression]}
    alt={alt}
    aria-hidden={alt ? undefined : true}
    draggable={false}
    decoding="async"
    data-testid="kitu-notice-mascot"
    data-expression={expression}
    className={`${MASCOT_SIZE[size]} shrink-0 select-none object-contain drop-shadow-sm ${motion} ${className}`}
  />
)

interface KituNoticeProps {
  tone: KituTone
  /** Teks pendamping; `false` menyembunyikan sapaan bawaan Kitu. */
  title?: string | false
  /** Ganti ekspresi bawaan nada (mis. `terimakasih` untuk sukses unduh). */
  expression?: KituExpression
  children?: React.ReactNode
  /** Tombol/aksi di sisi kanan (mis. Urungkan, Coba Lagi). */
  action?: React.ReactNode
  /** `inline` untuk banner dalam modal/halaman, `toast` untuk popup melayang. */
  variant?: 'inline' | 'toast'
  size?: keyof typeof MASCOT_SIZE
  className?: string
  role?: 'alert' | 'status' | 'none'
  'data-testid'?: string
}

/**
 * Notifikasi bermaskot: ekspresi Kitu menyesuaikan jenis pesan
 * (sukses → "Selesai!", error → "Sedih", peringatan → "Kaget", info → "Ide!", proses → "Fokus").
 */
export const KituNotice: React.FC<KituNoticeProps> = ({
  tone,
  title,
  expression,
  children,
  action,
  variant = 'inline',
  size,
  className = '',
  role,
  'data-testid': testId,
}) => {
  const cfg = TONES[tone]
  const heading = title === undefined ? cfg.title : title
  const resolvedRole = role ?? (tone === 'error' || tone === 'warning' ? 'alert' : 'status')
  const mascotSize = size ?? (variant === 'toast' ? 'sm' : 'sm')

  if (variant === 'toast') {
    return (
      <div
        role={resolvedRole === 'none' ? undefined : resolvedRole}
        data-testid={testId}
        data-tone={tone}
        className={`flex max-w-sm items-center gap-3 rounded-2xl border border-teal-700/40 bg-[#0c2225] py-3 pl-2 pr-4 text-white shadow-2xl shadow-teal-950/30 animate-toast-in ${className}`}
      >
        <KituMascotImg
          expression={expression ?? cfg.expression}
          size={mascotSize}
          motion={cfg.motion}
          className="-my-4"
        />
        <div className="min-w-0 flex-1 text-xs leading-snug">
          {heading && <p className="mb-0.5 font-extrabold text-teal-300">{heading}</p>}
          {children && <div className="text-stone-100">{children}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )
  }

  return (
    <div
      role={resolvedRole === 'none' ? undefined : resolvedRole}
      data-testid={testId}
      data-tone={tone}
      className={`flex items-center gap-3 rounded-2xl border py-2.5 pl-2.5 pr-3.5 text-xs animate-fade-up ${cfg.surface} ${className}`}
    >
      <KituMascotImg expression={expression ?? cfg.expression} size={mascotSize} motion={cfg.motion} />
      <div className="min-w-0 flex-1 leading-relaxed">
        {heading && <p className={`mb-0.5 font-extrabold ${cfg.title_color}`}>{heading}</p>}
        {children && <div className={`break-words ${cfg.body_color}`}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
