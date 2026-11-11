import React from 'react'

/**
 * Lanskap hero Satukit berbentuk SVG vektor: bukit Nusantara, candi meru, bale, awan, dan motif Kawung.
 * Menggantikan potongan PNG persegi dari mockup yang menimbulkan patahan di tepi hero.
 * Semua bentuk berujung di dasar kanvas sehingga menyatu mulus dengan latar hero; warna
 * dikendalikan variabel CSS `--scn-*` (terang/gelap) pada index.css.
 */

const fill = (v: string): React.CSSProperties => ({ fill: `var(${v})` })
const stop = (v: string, opacity = 1): React.CSSProperties => ({ stopColor: `var(${v})`, stopOpacity: opacity })

/** Pagoda bertingkat (meru) dibangun dari atap melengkung + badan tiap tingkat. */
const PagodaTier: React.FC<{ cx: number; y: number; w: number }> = ({ cx, y, w }) => {
  const half = w / 2
  const inner = half * 0.72
  return (
    <g style={fill('--scn-temple')}>
      {/* badan tingkat */}
      <rect x={cx - inner * 0.62} y={y - 2} width={inner * 1.24} height={15} rx={1.5} />
      {/* atap dengan ujung melengkung ke atas */}
      <path
        d={`M${cx - half - 5},${y - 9} Q${cx - half + 4},${y + 1} ${cx - half + 12},${y} L${cx + half - 12},${y} Q${cx + half - 4},${y + 1} ${cx + half + 5},${y - 9} Q${cx + inner},${y - 17} ${cx},${y - 22} Q${cx - inner},${y - 17} ${cx - half - 5},${y - 9} Z`}
      />
    </g>
  )
}

const Pavilion: React.FC<{ x: number; y: number; scale?: number }> = ({ x, y, scale = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} style={fill('--scn-temple')}>
    <path d="M-34,0 Q-26,-4 -20,-12 L20,-12 Q26,-4 34,0 Q10,-6 0,-24 Q-10,-6 -34,0 Z" />
    <rect x="-24" y="-2" width="4" height="26" />
    <rect x="-8" y="-2" width="4" height="26" />
    <rect x="4" y="-2" width="4" height="26" />
    <rect x="20" y="-2" width="4" height="26" />
    <rect x="-28" y="22" width="56" height="5" rx="2" />
  </g>
)

const KawungPattern: React.FC<{ id: string }> = ({ id }) => (
  <pattern id={id} width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
    {/* empat kelopak elips yang berpotongan membentuk motif Kawung */}
    <g style={fill('--scn-kawung')} opacity="0.95">
      <ellipse cx="23" cy="9" rx="6.5" ry="11" />
      <ellipse cx="23" cy="37" rx="6.5" ry="11" />
      <ellipse cx="9" cy="23" rx="11" ry="6.5" />
      <ellipse cx="37" cy="23" rx="11" ry="6.5" />
    </g>
    <circle cx="23" cy="23" r="3.2" style={fill('--scn-kawung-bg-b')} />
    <circle cx="0" cy="0" r="3" style={fill('--scn-kawung-bg-b')} />
    <circle cx="46" cy="0" r="3" style={fill('--scn-kawung-bg-b')} />
    <circle cx="0" cy="46" r="3" style={fill('--scn-kawung-bg-b')} />
    <circle cx="46" cy="46" r="3" style={fill('--scn-kawung-bg-b')} />
  </pattern>
)

/** Sisi kanan: awan, pegunungan, candi meru, bale, bukit lime, dan motif Kawung di pojok. */
const SceneryRight: React.FC = () => (
  <svg
    viewBox="0 0 640 520"
    preserveAspectRatio="xMaxYMax meet"
    className="absolute bottom-0 right-0 h-full w-auto max-w-none"
    aria-hidden="true"
    focusable="false"
    data-testid="hero-scenery-right"
  >
    <defs>
      <linearGradient id="scn-hill-front" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={stop('--scn-hill-a')} />
        <stop offset="0.55" style={stop('--scn-hill-b')} />
        <stop offset="1" style={stop('--scn-hill-c')} />
      </linearGradient>
      <linearGradient id="scn-far-fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={stop('--scn-far', 0.55)} />
        <stop offset="1" style={stop('--scn-far', 0.9)} />
      </linearGradient>
      <linearGradient id="scn-kawung-base" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={stop('--scn-kawung-bg-a')} />
        <stop offset="1" style={stop('--scn-kawung-bg-b')} />
      </linearGradient>
      <KawungPattern id="scn-kawung-r" />
      <clipPath id="scn-kawung-clip-r">
        <path d="M640,520 L640,352 C578,356 520,402 486,456 C470,484 462,506 458,520 Z" />
      </clipPath>
    </defs>

    {/* awan melayang */}
    <g className="animate-cloud-drift" style={{ ...fill('--scn-cloud'), opacity: 0.55 }}>
      <path d="M420,96 q10,-26 38,-22 q14,-22 44,-10 q30,-4 34,22 q22,2 20,20 H398 q-8,-6 22,-10 Z" />
    </g>
    <g className="animate-cloud-drift" style={{ ...fill('--scn-cloud'), opacity: 0.4, animationDelay: '-6s' }}>
      <path d="M96,150 q8,-20 30,-16 q10,-18 34,-8 q24,-2 28,16 q16,2 14,14 H78 q-6,-4 18,-6 Z" />
    </g>

    {/* pegunungan jauh (berujung di dasar kiri agar tanpa tepi vertikal) */}
    <path
      d="M0,520 C40,470 90,420 150,392 C200,368 232,350 290,318 C360,278 420,282 480,250 C540,220 590,214 640,196 L640,520 Z"
      fill="url(#scn-far-fade)"
    />
    <path
      d="M0,520 C60,486 120,462 190,446 C270,428 330,372 410,350 C480,332 560,300 640,280 L640,520 Z"
      style={{ ...fill('--scn-mid'), opacity: 0.6 }}
    />

    {/* candi meru + bale */}
    <g>
      <PagodaTier cx={304} y={352} w={132} />
      <PagodaTier cx={304} y={320} w={112} />
      <PagodaTier cx={304} y={290} w={94} />
      <PagodaTier cx={304} y={262} w={78} />
      <PagodaTier cx={304} y={236} w={62} />
      <PagodaTier cx={304} y={212} w={46} />
      <path d="M304,190 L308,150 L300,150 Z" style={fill('--scn-temple')} />
      <Pavilion x={118} y={388} scale={1.05} />
      <Pavilion x={506} y={344} scale={0.9} />
    </g>

    {/* bukit lime depan */}
    <path
      d="M0,520 C70,490 150,478 238,450 C336,418 412,396 492,366 C550,344 600,312 640,282 L640,520 Z"
      fill="url(#scn-hill-front)"
    />
    <path
      d="M0,520 C90,500 190,500 290,474 C380,450 440,430 520,420 C570,414 610,420 640,430 L640,520 Z"
      style={{ ...fill('--scn-hill-c'), opacity: 0.55 }}
    />

    {/* daun tropis kiri bawah */}
    <g style={{ ...fill('--scn-leaf'), opacity: 0.9 }}>
      <path d="M0,520 C18,470 52,444 96,438 C74,462 56,490 50,520 Z" />
      <path d="M26,520 C44,486 74,468 112,466 C92,486 78,502 74,520 Z" />
    </g>

    {/* motif Kawung di pojok kanan bawah */}
    <g clipPath="url(#scn-kawung-clip-r)">
      <rect x="440" y="340" width="200" height="180" fill="url(#scn-kawung-base)" />
      <rect x="440" y="340" width="200" height="180" fill="url(#scn-kawung-r)" />
    </g>
  </svg>
)

/** Sisi kiri: bukit hijau besar dengan lengkung garis dan motif Kawung. */
const SceneryLeft: React.FC = () => (
  <svg
    viewBox="0 0 320 520"
    preserveAspectRatio="xMinYMax meet"
    className="absolute bottom-0 left-0 h-full w-auto max-w-none"
    aria-hidden="true"
    focusable="false"
    data-testid="hero-scenery-left"
  >
    <defs>
      <linearGradient id="scn-left-hill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={stop('--scn-hill-b')} />
        <stop offset="1" style={stop('--scn-hill-c')} />
      </linearGradient>
      <linearGradient id="scn-left-light" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" style={stop('--scn-hill-a', 0.9)} />
        <stop offset="1" style={stop('--scn-hill-b', 0.85)} />
      </linearGradient>
      <linearGradient id="scn-kawung-base-l" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={stop('--scn-kawung-bg-a')} />
        <stop offset="1" style={stop('--scn-kawung-bg-b')} />
      </linearGradient>
      <KawungPattern id="scn-kawung-l" />
      <clipPath id="scn-kawung-clip-l">
        <path d="M0,520 L0,300 C58,318 112,366 148,436 C160,462 166,492 168,520 Z" />
      </clipPath>
    </defs>

    {/* bukit utama: lengkung lebar yang berakhir di dasar kanan */}
    <path
      d="M0,520 L0,86 C74,102 140,160 190,258 C226,330 244,438 320,520 Z"
      fill="url(#scn-left-hill)"
    />
    <path
      d="M0,520 L0,176 C58,196 106,246 142,318 C172,378 190,452 244,520 Z"
      fill="url(#scn-left-light)"
      opacity="0.7"
    />
    {/* garis kontur halus */}
    <path
      d="M0,132 C70,150 126,206 164,284"
      fill="none"
      style={{ stroke: 'var(--scn-cloud)', opacity: 0.35 }}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M0,218 C48,236 90,282 118,340"
      fill="none"
      style={{ stroke: 'var(--scn-cloud)', opacity: 0.3 }}
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* motif Kawung di pojok kiri bawah */}
    <g clipPath="url(#scn-kawung-clip-l)">
      <rect x="0" y="290" width="180" height="230" fill="url(#scn-kawung-base-l)" />
      <rect x="0" y="290" width="180" height="230" fill="url(#scn-kawung-l)" />
    </g>
  </svg>
)

export const HeroScenery: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 select-none overflow-hidden" aria-hidden="true" data-testid="hero-scenery">
    <div className="scenery-in absolute inset-y-0 left-0 w-[34%] min-w-[96px] max-w-[300px] sm:w-[22%]" style={{ '--d': '60ms' } as React.CSSProperties}>
      <SceneryLeft />
    </div>
    <div className="scenery-in absolute inset-y-0 right-0 w-[78%] max-w-[760px] sm:w-[52%]" style={{ '--d': '180ms' } as React.CSSProperties}>
      <SceneryRight />
    </div>
  </div>
)
