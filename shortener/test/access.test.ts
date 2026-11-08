import { describe, expect, it } from 'vitest'
import { verifyCloudflareAccess, parseAllowedEmails } from '../src/access'

describe('Cloudflare Access Zero Trust Suite (TASK-12.3)', () => {
  it('mem-parsing konfigurasi email pembatas dengan benar dan case-insensitive', () => {
    const raw = 'admin@rahmath72.cloud, Owner@example.com ,  , security@docbuilder.local  '
    const parsed = parseAllowedEmails(raw)

    expect(parsed).toEqual([
      'admin@rahmath72.cloud',
      'owner@example.com',
      'security@docbuilder.local',
    ])
  })

  it('mengembalikan array kosong jika string konfigurasi kosong atau undefined', () => {
    expect(parseAllowedEmails(undefined)).toEqual([])
    expect(parseAllowedEmails('')).toEqual([])
  })

  it('menolak akses jika header Cf-Access-Authenticated-User-Email tidak ada', () => {
    const req = new Request('https://s.docbuilder.local/admin')
    const res = verifyCloudflareAccess(req, 'admin@rahmath72.cloud')

    expect(res.authenticated).toBe(false)
    expect(res.error).toContain('Header Cloudflare Access tidak ditemukan')
    expect(res.email).toBeUndefined()
  })

  it('mengizinkan akses jika email pengguna cocok dengan allowlist', () => {
    const req = new Request('https://s.docbuilder.local/admin', {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'admin@rahmath72.cloud',
      },
    })
    const res = verifyCloudflareAccess(req, 'owner@rahmath72.cloud,admin@rahmath72.cloud')

    expect(res.authenticated).toBe(true)
    expect(res.email).toBe('admin@rahmath72.cloud')
    expect(res.error).toBeUndefined()
  })

  it('mengizinkan akses dengan pencocokan case-insensitive', () => {
    const req = new Request('https://s.docbuilder.local/admin', {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'ADMIN@Rahmath72.Cloud',
      },
    })
    const res = verifyCloudflareAccess(req, 'admin@rahmath72.cloud')

    expect(res.authenticated).toBe(true)
    expect(res.email).toBe('ADMIN@Rahmath72.Cloud')
  })

  it('menolak akses jika email pengguna tidak terdaftar dalam allowlist', () => {
    const req = new Request('https://s.docbuilder.local/admin', {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'hacker@malicious.com',
      },
    })
    const res = verifyCloudflareAccess(req, 'admin@rahmath72.cloud,owner@rahmath72.cloud')

    expect(res.authenticated).toBe(false)
    expect(res.error).toContain('tidak terdaftar sebagai administrator')
  })
})
