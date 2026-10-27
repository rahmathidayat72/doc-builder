import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeExportFilename, printResume } from '../export'

describe('Export filename handling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.title = 'Doc-builder'
  })

  it('membersihkan karakter yang tidak valid dan melepas ekstensi duplikat', () => {
    expect(normalizeExportFilename('CV: Budi/2026.pdf')).toBe('CV Budi 2026')
    expect(normalizeExportFilename('  Resume.  ')).toBe('Resume')
    expect(normalizeExportFilename('***', 'Resume')).toBe('Resume')
    expect(normalizeExportFilename('A'.repeat(150))).toHaveLength(120)
  })

  it('memakai nama berkas sebagai judul sementara saat mencetak', () => {
    vi.useFakeTimers()
    try {
      vi.spyOn(window, 'print').mockImplementation(() => {})
      document.title = 'Judul Lama'

      printResume('CV: Budi/2026')

      expect(document.title).toBe('CV Budi 2026')
      expect(window.print).toHaveBeenCalledTimes(1)

      vi.runAllTimers()
      expect(document.title).toBe('Judul Lama')
    } finally {
      vi.useRealTimers()
    }
  })
})
