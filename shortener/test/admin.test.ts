import { describe, expect, it, beforeEach } from 'vitest'
import { handleRequest, type Env, type UrlRecord } from '../src/index'
import { escapeHtml } from '../src/admin'

class MockD1PreparedStatement {
  private query: string
  private bindings: any[] = []
  private db: MockD1Database

  constructor(query: string, db: MockD1Database) {
    this.query = query
    this.db = db
  }

  bind(...values: any[]): MockD1PreparedStatement {
    this.bindings = values
    return this
  }

  async first<T = unknown>(): Promise<T | null> {
    if (this.query.includes('SELECT destination_url, status FROM urls WHERE slug = ?')) {
      const slug = this.bindings[0]
      const rec = this.db.records.get(slug)
      if (!rec) return null
      return { destination_url: rec.destination_url, status: rec.status } as T
    }
    if (this.query.includes('SELECT id, status FROM urls WHERE slug = ?')) {
      const slug = this.bindings[0]
      const rec = this.db.records.get(slug)
      if (!rec) return null
      return { id: rec.id, status: rec.status } as T
    }
    return null
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
    if (this.query.includes('SELECT id, slug, destination_url')) {
      return {
        results: Array.from(this.db.records.values()) as T[],
        success: true,
      }
    }
    return { results: [], success: true }
  }

  async run(): Promise<{ success: boolean; meta: any }> {
    if (this.query.includes('INSERT INTO urls')) {
      const [slug, dest, status] = this.bindings
      const id = this.db.records.size + 1
      this.db.records.set(slug, {
        id,
        slug,
        destination_url: dest,
        status: status || 'active',
        click_count: 0,
        created_at: new Date().toISOString(),
        revoked_at: null,
        last_accessed_at: null,
      })
      return { success: true, meta: { last_row_id: id } }
    }
    if (this.query.includes('UPDATE urls SET status = "revoked"')) {
      const slug = this.bindings[0]
      const rec = this.db.records.get(slug)
      if (rec) {
        rec.status = 'revoked'
        rec.revoked_at = new Date().toISOString()
      }
      return { success: true, meta: { changes: rec ? 1 : 0 } }
    }
    return { success: true, meta: {} }
  }
}

class MockD1Database {
  public records = new Map<string, UrlRecord>()

  prepare(query: string): MockD1PreparedStatement {
    return new MockD1PreparedStatement(query, this)
  }

  seed(record: UrlRecord) {
    this.records.set(record.slug, { ...record })
  }
}

describe('Admin Portal UI & Zero Trust Endpoints Suite (TASK-12.3)', () => {
  let mockDb: MockD1Database
  let env: Env

  beforeEach(() => {
    mockDb = new MockD1Database()
    env = {
      DB: mockDb as unknown as D1Database,
      ADMIN_HMAC_SECRET: 'test-secret-12345',
      CF_ACCESS_ALLOWED_EMAILS: 'admin@rahmath72.cloud,owner@rahmath72.cloud',
    }

    mockDb.seed({
      id: 1,
      slug: 'cv-rahmat',
      destination_url: 'https://porto.rahmath72.cloud/cv',
      status: 'active',
      click_count: 25,
      created_at: '2026-11-01T10:00:00Z',
      revoked_at: null,
      last_accessed_at: null,
    })
  })

  it('escapeHtml menyaring karakter berbahaya pencegah XSS', () => {
    const malicious = '<script>alert("xss")</script>&foo=\'bar\''
    const escaped = escapeHtml(malicious)
    expect(escaped).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;foo=&#039;bar&#039;'
    )
  })

  it('menolak akses ke GET /admin jika header Cloudflare Access tidak ada (HTTP 403)', async () => {
    const req = new Request('https://s.docbuilder.local/admin')
    const res = await handleRequest(req, env)

    expect(res.status).toBe(403)
    expect(await res.text()).toContain('Verifikasi Zero Trust Cloudflare Access gagal')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('menolak akses ke GET /admin jika email tidak terdaftar di allowlist (HTTP 403)', async () => {
    const req = new Request('https://s.docbuilder.local/admin', {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'stranger@external.com',
      },
    })
    const res = await handleRequest(req, env)

    expect(res.status).toBe(403)
    expect(await res.text()).toContain('tidak terdaftar sebagai administrator')
  })

  it('mengizinkan akses ke GET /admin dengan Cloudflare Access valid (HTTP 200 HTML)', async () => {
    const req = new Request('https://s.docbuilder.local/admin', {
      headers: {
        'Cf-Access-Authenticated-User-Email': 'admin@rahmath72.cloud',
      },
    })
    const res = await handleRequest(req, env)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer')

    const html = await res.text()
    expect(html).toContain('Satukit Shortener • Portal Admin')
    expect(html).toContain('admin@rahmath72.cloud')
    expect(html).toContain('Daftar Tautan Terdaftar')
    expect(html).toContain('Konfirmasi Pencabutan Tautan')
  })

  it('mengizinkan akses Management API GET /api/links dengan header Cloudflare Access sah', async () => {
    const req = new Request('https://s.docbuilder.local/api/links', {
      method: 'GET',
      headers: {
        'Cf-Access-Authenticated-User-Email': 'owner@rahmath72.cloud',
      },
    })
    const res = await handleRequest(req, env)

    expect(res.status).toBe(200)
    const data = (await res.json()) as { success: boolean; links: UrlRecord[] }
    expect(data.success).toBe(true)
    expect(data.links.length).toBe(1)
    expect(data.links[0].slug).toBe('cv-rahmat')
  })

  it('mengizinkan pembuatan tautan POST /api/links dengan Cloudflare Access sah', async () => {
    const req = new Request('https://s.docbuilder.local/api/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Authenticated-User-Email': 'admin@rahmath72.cloud',
      },
      body: JSON.stringify({
        slug: 'link-access-test',
        destination_url: 'https://example.com/secured',
      }),
    })
    const res = await handleRequest(req, env)

    expect(res.status).toBe(201)
    const data = (await res.json()) as { success: boolean; link: any }
    expect(data.success).toBe(true)
    expect(data.link.slug).toBe('link-access-test')

    // Verifikasi dapat dialihkan
    const redirectRes = await handleRequest(
      new Request('https://s.docbuilder.local/link-access-test'),
      env
    )
    expect(redirectRes.status).toBe(302)
    expect(redirectRes.headers.get('Location')).toBe('https://example.com/secured')
  })

  it('menolak POST /api/links dengan status 403 jika email header Access tidak diizinkan', async () => {
    const req = new Request('https://s.docbuilder.local/api/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Authenticated-User-Email': 'attacker@outside.com',
      },
      body: JSON.stringify({
        slug: 'should-fail',
        destination_url: 'https://example.com/fail',
      }),
    })
    const res = await handleRequest(req, env)

    expect(res.status).toBe(403)
    const data = (await res.json()) as { success: boolean; error: string }
    expect(data.success).toBe(false)
    expect(data.error).toContain('tidak terdaftar')
  })
})
