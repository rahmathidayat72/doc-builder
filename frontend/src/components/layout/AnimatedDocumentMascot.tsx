import React, { useState, useEffect, useRef } from 'react'
import mascotFramesWebp from '../../assets/document-mascot-frames.webp'
import mascotFramesPng from '../../assets/document-mascot-frames.png'
import {
  type MascotEmotion,
  MASCOT_EMOTIONS,
  ALL_MASCOT_EMOTIONS,
} from './mascotTypes'

export type { MascotEmotion }

export interface AnimatedDocumentMascotProps {
  activeWorkspace?: 'home' | 'builder' | 'ats' | 'tools'
  isSaving?: boolean
  lastSaved?: Date | null
  isHovered?: boolean
  isClicked?: boolean
  overrideEmotion?: MascotEmotion | null
  className?: string
  idleIntervalMs?: number
}

const WORKSPACE_EMOTIONS: Record<string, MascotEmotion> = {
  home: 'sapa_salam',
  builder: 'siap_membantu',
  ats: 'penasaran',
  tools: 'semangat',
}

export const AnimatedDocumentMascot: React.FC<AnimatedDocumentMascotProps> = ({
  activeWorkspace = 'home',
  isSaving = false,
  lastSaved = null,
  isHovered = false,
  isClicked = false,
  overrideEmotion = null,
  className = 'w-11 h-11 sm:w-12 sm:h-12',
  idleIntervalMs = 5000,
}) => {
  const [currentEmotion, setCurrentEmotion] = useState<MascotEmotion>(
    WORKSPACE_EMOTIONS[activeWorkspace] || 'sapa_salam'
  )
  const [transientEmotion, setTransientEmotion] = useState<MascotEmotion | null>(null)

  const [prevWorkspace, setPrevWorkspace] = useState(activeWorkspace)
  const [prevSaved, setPrevSaved] = useState(lastSaved)

  const transientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cek preferensi aksesibilitas gerakan
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const clearTransientTimer = () => {
    if (transientTimerRef.current) {
      clearTimeout(transientTimerRef.current)
      transientTimerRef.current = null
    }
  }

  // Pola React: sinkronisasi state saat props berubah
  if (activeWorkspace !== prevWorkspace) {
    setPrevWorkspace(activeWorkspace)
    const target = WORKSPACE_EMOTIONS[activeWorkspace] || 'senang'
    setTransientEmotion(target)
  }

  if (lastSaved && prevSaved !== lastSaved && !isSaving) {
    setPrevSaved(lastSaved)
    setTransientEmotion('bangga')
  }

  // Timer untuk membersihkan transientEmotion setelah durasi tertentu
  useEffect(() => {
    if (transientEmotion) {
      clearTransientTimer()
      transientTimerRef.current = setTimeout(() => {
        setTransientEmotion(null)
        transientTimerRef.current = null
      }, 3000)
    }
    return () => clearTransientTimer()
  }, [transientEmotion])

  // Rotasi Idle: memilih dari seluruh 18 emosi tanpa repetisi berulang
  useEffect(() => {
    if (prefersReducedMotion || idleIntervalMs <= 0) return

    const interval = setInterval(() => {
      // Hanya lakukan rotasi jika tidak ada state prioritas
      if (!isSaving && !isHovered && !isClicked && !transientEmotion && !overrideEmotion) {
        setCurrentEmotion(prev => {
          const pool = ALL_MASCOT_EMOTIONS.filter(e => e !== prev)
          const next = pool[Math.floor(Math.random() * pool.length)] || 'senang'
          return next
        })
      }
    }, idleIntervalMs)

    return () => clearInterval(interval)
  }, [isSaving, isHovered, isClicked, transientEmotion, overrideEmotion, idleIntervalMs, prefersReducedMotion])

  // Tentukan emosi aktif berdasarkan hirarki prioritas:
  // Override eksplisit > Klik > Hover > Sedang Menyimpan > Transient kontekstual > Current idle
  let activeEmotion: MascotEmotion = currentEmotion

  if (overrideEmotion) {
    activeEmotion = overrideEmotion
  } else if (isClicked) {
    activeEmotion = 'tertawa'
  } else if (isHovered) {
    activeEmotion = 'berkedip'
  } else if (isSaving) {
    activeEmotion = 'semangat'
  } else if (transientEmotion) {
    activeEmotion = transientEmotion
  }

  const meta = MASCOT_EMOTIONS[activeEmotion] || MASCOT_EMOTIONS.senang
  const bgPosY = `${(meta.row / 17) * 100}%`

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      data-testid="animated-mascot"
      data-emotion={activeEmotion}
      aria-hidden="true"
    >
      <span
        key={prefersReducedMotion ? 'static' : activeEmotion}
        className={`w-full h-full bg-no-repeat bg-contain ${
          prefersReducedMotion ? '' : 'animate-mascot-frames'
        }`}
        style={{
          backgroundImage: `image-set(url(${mascotFramesWebp}) type('image/webp'), url(${mascotFramesPng}) type('image/png'))`,
          backgroundSize: '600% 1800%',
          backgroundPosition: `0% ${bgPosY}`,
          ['--mascot-duration' as string]: `${meta.durationMs}ms`,
        }}
      />
    </span>
  )
}
