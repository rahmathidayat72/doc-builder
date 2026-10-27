import { useEffect, useRef, type RefObject } from 'react'

/**
 * Menutup popover/menu ketika pengguna klik di luar elemen atau menekan Escape.
 * Hook hanya aktif saat `active` bernilai true.
 */
export function useDismiss<T extends HTMLElement>(
  active: boolean,
  onDismiss: () => void
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const handlerRef = useRef(onDismiss)

  useEffect(() => {
    handlerRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!active) return

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (ref.current && target && !ref.current.contains(target)) {
        handlerRef.current()
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handlerRef.current()
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [active])

  return ref
}
