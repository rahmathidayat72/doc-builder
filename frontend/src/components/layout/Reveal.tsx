import React, { useEffect, useRef, useState } from 'react'

interface RevealProps {
  children: React.ReactNode
  className?: string
  /** Jeda animasi dalam ms (untuk efek berurutan). */
  delay?: number
  as?: 'div' | 'section'
  'aria-labelledby'?: string
}

/**
 * Memunculkan konten dengan transisi halus (fade + naik) saat masuk viewport.
 * Tanpa IntersectionObserver (mis. jsdom/browser lama) konten langsung tampil.
 */
export const Reveal: React.FC<RevealProps> = ({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
  'aria-labelledby': labelledBy,
}) => {
  const ref = useRef<HTMLElement | null>(null)
  const supportsObserver = typeof IntersectionObserver !== 'undefined'
  const [visible, setVisible] = useState(!supportsObserver)

  useEffect(() => {
    if (!supportsObserver || visible) return
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [supportsObserver, visible])

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      aria-labelledby={labelledBy}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ '--d': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  )
}
