import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import {
  AnimatedDocumentMascot,
} from '../AnimatedDocumentMascot'
import {
  MASCOT_EMOTIONS,
  type MascotEmotion,
} from '../mascotTypes'

describe('AnimatedDocumentMascot', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('memiliki total 18 emosi yang terdaftar dengan metadata baris dan durasi valid', () => {
    const keys = Object.keys(MASCOT_EMOTIONS) as MascotEmotion[]
    expect(keys.length).toBe(18)

    keys.forEach(key => {
      const { row, label, durationMs } = MASCOT_EMOTIONS[key]
      expect(row).toBeGreaterThanOrEqual(0)
      expect(row).toBeLessThanOrEqual(17)
      expect(durationMs).toBeGreaterThan(0)
      expect(label).toBeTruthy()
    })
  })

  it('merender maskot secara default dengan aria-hidden="true" dan emosi awal sapa/salam di workspace home', () => {
    render(<AnimatedDocumentMascot activeWorkspace="home" />)
    const mascot = screen.getByTestId('animated-mascot')

    expect(mascot).toBeInTheDocument()
    expect(mascot).toHaveAttribute('aria-hidden', 'true')
    expect(mascot).toHaveAttribute('data-emotion', 'sapa_salam')
  })

  it('menerapkan backgroundPosition persentase dan backgroundSize multi-frame', () => {
    const { rerender } = render(<AnimatedDocumentMascot overrideEmotion="senang" />)
    let spriteFrame = screen.getByTestId('animated-mascot').firstChild as HTMLElement
    // row 0 -> 0% 0%
    expect(spriteFrame.style.backgroundPosition).toBe('0% 0%')
    expect(spriteFrame.style.backgroundSize).toBe('600% 1800%')

    rerender(<AnimatedDocumentMascot overrideEmotion="sapa_salam" />)
    spriteFrame = screen.getByTestId('animated-mascot').firstChild as HTMLElement
    // row 17 -> 0% 100%
    expect(spriteFrame.style.backgroundPosition).toBe('0% 100%')

    rerender(<AnimatedDocumentMascot overrideEmotion="bangga" />)
    spriteFrame = screen.getByTestId('animated-mascot').firstChild as HTMLElement
    // row 5 -> (5/17)*100% ~ 29.4118%
    const expectedPosY = `${(5 / 17) * 100}%`
    expect(spriteFrame.style.backgroundPosition).toBe(`0% ${expectedPosY}`)
  })

  it('merespon state hover dengan emosi berkedip', () => {
    const { rerender } = render(<AnimatedDocumentMascot isHovered={false} />)
    expect(screen.getByTestId('animated-mascot')).toHaveAttribute('data-emotion', 'sapa_salam')

    rerender(<AnimatedDocumentMascot isHovered={true} />)
    expect(screen.getByTestId('animated-mascot')).toHaveAttribute('data-emotion', 'berkedip')
  })

  it('merespon interaksi klik dengan emosi tertawa', () => {
    render(<AnimatedDocumentMascot isClicked={true} />)
    expect(screen.getByTestId('animated-mascot')).toHaveAttribute('data-emotion', 'tertawa')
  })

  it('merespon status menyimpan (isSaving) dengan emosi semangat', () => {
    render(<AnimatedDocumentMascot isSaving={true} />)
    expect(screen.getByTestId('animated-mascot')).toHaveAttribute('data-emotion', 'semangat')
  })

  it('merespon penyimpanan berhasil (lastSaved diperbarui) dengan emosi bangga transient', () => {
    const { rerender } = render(
      <AnimatedDocumentMascot activeWorkspace="builder" isSaving={false} lastSaved={null} />
    )

    const savedDate = new Date()
    rerender(
      <AnimatedDocumentMascot activeWorkspace="builder" isSaving={false} lastSaved={savedDate} />
    )

    expect(screen.getByTestId('animated-mascot')).toHaveAttribute('data-emotion', 'bangga')

    // Setelah 3200ms kembali dari transient
    act(() => {
      vi.advanceTimersByTime(3200)
    })
    expect(screen.getByTestId('animated-mascot')).not.toHaveAttribute('data-emotion', 'bangga')
  })

  it('merespon perpindahan workspace ke ats (penasaran) dan tools (semangat)', () => {
    const { rerender } = render(<AnimatedDocumentMascot activeWorkspace="home" />)

    rerender(<AnimatedDocumentMascot activeWorkspace="ats" />)
    expect(screen.getByTestId('animated-mascot')).toHaveAttribute('data-emotion', 'penasaran')

    rerender(<AnimatedDocumentMascot activeWorkspace="tools" />)
    expect(screen.getByTestId('animated-mascot')).toHaveAttribute('data-emotion', 'semangat')
  })

  it('menjalankan rotasi idle otomatis secara berkala tanpa repetisi berturut-turut', () => {
    render(<AnimatedDocumentMascot idleIntervalMs={2000} />)

    const recordedEmotions: string[] = []
    recordedEmotions.push(screen.getByTestId('animated-mascot').getAttribute('data-emotion') || '')

    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      const current = screen.getByTestId('animated-mascot').getAttribute('data-emotion') || ''
      const prev = recordedEmotions[recordedEmotions.length - 1]
      // Tidak boleh sama persis berturut-turut
      expect(current).not.toBe(prev)
      recordedEmotions.push(current)
    }

    expect(recordedEmotions.length).toBe(6)
  })

  it('menghormati prefers-reduced-motion tanpa rotasi idle dan tanpa class animasi frame', () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(<AnimatedDocumentMascot idleIntervalMs={1000} />)
    const mascot = screen.getByTestId('animated-mascot')
    const spriteFrame = mascot.firstChild as HTMLElement

    // Tidak ada class animate-mascot-frames saat reduced motion aktif
    expect(spriteFrame.className).not.toContain('animate-mascot-frames')

    // Maju waktu, emosi tetap stabil tidak berputar
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(mascot).toHaveAttribute('data-emotion', 'sapa_salam')

    window.matchMedia = originalMatchMedia
  })
})
