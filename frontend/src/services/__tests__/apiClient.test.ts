import { describe, expect, it } from 'vitest'
import { resolveBackendUrl } from '../apiClient'

describe('resolveBackendUrl', () => {
  it('memakai hostname localhost agar cookie sesi tetap same-site', () => {
    expect(resolveBackendUrl({ hostname: 'localhost', port: '5173' })).toBe(
      'http://localhost:8000'
    )
  })

  it('memakai loopback 127.0.0.1 ketika frontend dibuka lewat IP', () => {
    expect(resolveBackendUrl({ hostname: '127.0.0.1', port: '5173' })).toBe(
      'http://127.0.0.1:8000'
    )
  })

  it('memakai URL relatif pada bundle yang disajikan backend', () => {
    expect(resolveBackendUrl({ hostname: 'localhost', port: '8000' })).toBe('')
    expect(resolveBackendUrl({ hostname: '127.0.0.1', port: '8000' })).toBe('')
  })
})
