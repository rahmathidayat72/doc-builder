import { describe, expect, it, beforeEach } from 'vitest'
import { handleRequest, type Env, type UrlRecord } from '../src/index'
import { computeHmacSignature, buildHmacPayload } from '../src/auth'

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

    if (this.query.includes('UPDATE urls SET click_count = click_count + 1')) {
      const slug = this.bindings[0]
      const rec = this.db.records.get(slug)
      if (rec) {
        rec.click_count += 1
        rec.last_accessed_at = new Date().toISOString()
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

describe('Management API & HMAC Authentication Suite (TASK-12.2)', () => {
  const SECRET = 'super-secret-hmac-key-test-2026'
  let mockDb: MockD1Database
  let env: Env

  beforeEach(() => {
    mockDb = new MockD1Database()
    env = {
      DB: mockDb as unknown as D1Database,
      ADMIN_HMAC_SECRET: SECRET,
    }

    mockDb.seed({
      id: 1,
      slug: 'my-portfolio',
      destination_url: 'https://porto.rahmath72.cloud/',
      status: 'active',
      click_count: 10,
      created_at: '2026-11-01T00:00:00Z',
      revoked_at: null,
      last_accessed_at: null,
    })

    mockDb.seed({
      id: 2,
      slug: 'revoked-resume',
      destination_url: 'https://example.com/cv.pdf',
      status: 'revoked',
      click_count: 3,
      created_at: '2026-10-01T00:00:00Z',
      revoked_at: '2026-10-20T00:00:00Z',
      last_accessed_at: null,
    })
  })

  async function createSignedRequest(
    method: string,
    pathname: string,
    bodyObj?: any,
    overrideTimestamp?: number,
    overrideNonce?: string,
    overrideSignature?: string
  ): Promise<Request> {
    const timestamp = overrideTimestamp ?? Date.now()
    const nonce = overrideNonce ?? 'nonce-random-12345'
    const bodyText = bodyObj ? JSON.stringify(bodyObj) : ''

    const payload = buildHmacPayload(method, pathname, timestamp, nonce, bodyText)
    const signature = overrideSignature ?? (await computeHmacSignature(SECRET, payload))

    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Timestamp': String(timestamp),
      'X-Nonce': nonce,
    })

    return new Request(`https://s.docbuilder.local${pathname}`, {
      method,
      headers,
      body: method !== 'GET' && method !== 'HEAD' ? bodyText : undefined,
    })
  }

  it('menolak request management tanpa header HMAC (HTTP 401)', async () => {
    const req = new Request('https://s.docbuilder.local/api/links', { method: 'GET' })
    const res = await handleRequest(req, env)

    expect(res.status).toBe(401)
    const data = (await res.json()) as { success: boolean; error: string }
    expect(data.success).toBe(false)
    expect(data.error).toContain('X-Signature')
  })

  it('menolak request dengan timestamp kedaluwarsa > 5 menit (HTTP 401)', async () => {
    const expiredTimestamp = Date.now() - 6 * 60 * 1000 // 6 menit lalu
    const req = await createSignedRequest('GET', '/api/links', undefined, expiredTimestamp)
    const res = await handleRequest(req, env)

    expect(res.status).toBe(401)
    const data = (await res.json()) as { success: boolean; error: string }
    expect(data.error).toContain('kedaluwarsa')
  })

  it('menolak request dengan signature salah / payload dimanipulasi (HTTP 401)', async () => {
    const req = await createSignedRequest(
      'GET',
      '/api/links',
      undefined,
      undefined,
      undefined,
      'fake-invalid-signature-hex'
    )
    const res = await handleRequest(req, env)

    expect(res.status).toBe(401)
    const data = (await res.json()) as { success: boolean; error: string }
    expect(data.error).toContain('tidak valid')
  })

  it('mengambil daftar semua link dengan autentikasi HMAC yang sah (GET /api/links)', async () => {
    const req = await createSignedRequest('GET', '/api/links')
    const res = await handleRequest(req, env)

    expect(res.status).toBe(200)
    const data = (await res.json()) as { success: boolean; links: UrlRecord[] }
    expect(data.success).toBe(true)
    expect(data.links.length).toBe(2)
    expect(data.links[0].slug).toBe('my-portfolio')
  })

  it('membuat tautan baru yang sah (POST /api/links -> HTTP 201)', async () => {
    const payload = {
      slug: 'cv-baru',
      destination_url: 'https://porto.rahmath72.cloud/cv-2026',
    }
    const req = await createSignedRequest('POST', '/api/links', payload)
    const res = await handleRequest(req, env)

    expect(res.status).toBe(201)
    const data = (await res.json()) as { success: boolean; link: any }
    expect(data.success).toBe(true)
    expect(data.link.slug).toBe('cv-baru')
    expect(data.link.status).toBe('active')

    // Verifikasi dapat dialihkan via edge router
    const redirectReq = new Request('https://s.docbuilder.local/cv-baru')
    const redirectRes = await handleRequest(redirectReq, env)
    expect(redirectRes.status).toBe(302)
    expect(redirectRes.headers.get('Location')).toBe('https://porto.rahmath72.cloud/cv-2026')
  })

  it('menolak pembuatan link dengan URL tujuan internal / SSRF (HTTP 422)', async () => {
    const payload = {
      slug: 'ssrf-attempt',
      destination_url: 'https://169.254.169.254/latest/meta-data/',
    }
    const req = await createSignedRequest('POST', '/api/links', payload)
    const res = await handleRequest(req, env)

    expect(res.status).toBe(422)
    const data = (await res.json()) as { success: boolean; error: string }
    expect(data.success).toBe(false)
    expect(data.error).toContain('Anti-SSRF')
  })

  it('menolak pembuatan link dengan duplikasi slug aktif (HTTP 409)', async () => {
    const payload = {
      slug: 'my-portfolio', // sudah ada
      destination_url: 'https://example.com/other',
    }
    const req = await createSignedRequest('POST', '/api/links', payload)
    const res = await handleRequest(req, env)

    expect(res.status).toBe(409)
    const data = (await res.json()) as { success: boolean; error: string }
    expect(data.error).toContain('telah digunakan oleh tautan aktif')
  })

  it('menolak keras daur ulang slug yang telah dicabut (no slug reuse -> HTTP 409)', async () => {
    const payload = {
      slug: 'revoked-resume', // sudah dicabut
      destination_url: 'https://example.com/new-resume',
    }
    const req = await createSignedRequest('POST', '/api/links', payload)
    const res = await handleRequest(req, env)

    expect(res.status).toBe(409)
    const data = (await res.json()) as { success: boolean; error: string }
    expect(data.error).toContain('no slug reuse')
  })

  it('mencabut tautan aktif secara deterministik (POST /api/links/:slug/revoke)', async () => {
    const req = await createSignedRequest('POST', '/api/links/my-portfolio/revoke')
    const res = await handleRequest(req, env)

    expect(res.status).toBe(200)
    const data = (await res.json()) as { success: boolean; message: string }
    expect(data.success).toBe(true)

    // Cek bahwa status di database kini revoked
    const record = mockDb.records.get('my-portfolio')
    expect(record?.status).toBe('revoked')
    expect(record?.revoked_at).not.toBeNull()

    // Permintaan pengalihan publik selanjutnya kini wajib mengembalikan HTTP 410 Gone
    const followReq = new Request('https://s.docbuilder.local/my-portfolio')
    const followRes = await handleRequest(followReq, env)
    expect(followRes.status).toBe(410)
    expect(await followRes.text()).toContain('dicabut (revoked)')
  })

  it('mengembalikan 404 saat mencoba mencabut slug yang tidak terdaftar', async () => {
    const req = await createSignedRequest('POST', '/api/links/slug-hantu/revoke')
    const res = await handleRequest(req, env)

    expect(res.status).toBe(404)
    const data = (await res.json()) as { success: boolean; error: string }
    expect(data.error).toContain('tidak ditemukan')
  })
})
