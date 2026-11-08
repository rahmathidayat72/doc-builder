import { describe, expect, it, vi, beforeEach } from 'vitest'
import { handleRequest, type Env, type UrlRecord } from '../src/index'

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

  async first<T = unknown>(colName?: string): Promise<T | null> {
    if (this.query.includes('SELECT destination_url, status FROM urls WHERE slug = ?')) {
      const slug = this.bindings[0]
      const record = this.db.records.get(slug)
      if (!record) return null
      return {
        destination_url: record.destination_url,
        status: record.status,
      } as T
    }
    return null
  }

  async run(): Promise<{ success: boolean; meta: any }> {
    if (this.query.includes('UPDATE urls SET click_count = click_count + 1')) {
      const slug = this.bindings[0]
      const record = this.db.records.get(slug)
      if (record) {
        record.click_count += 1
        record.last_accessed_at = new Date().toISOString()
      }
      return { success: true, meta: { changes: record ? 1 : 0 } }
    }
    return { success: true, meta: {} }
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
    return { results: [], success: true }
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

describe('Cloudflare Workers Edge URL Shortener Suite (TASK-12.1)', () => {
  let mockDb: MockD1Database
  let mockEnv: Env

  beforeEach(() => {
    mockDb = new MockD1Database()
    mockEnv = {
      DB: mockDb as unknown as D1Database,
      ADMIN_HMAC_SECRET: 'test-secret-key-12345',
    }

    mockDb.seed({
      id: 1,
      slug: 'cv-rahmat',
      destination_url: 'https://porto.rahmath72.cloud/cv',
      status: 'active',
      click_count: 5,
      created_at: '2026-11-01T10:00:00Z',
      revoked_at: null,
      last_accessed_at: null,
    })

    mockDb.seed({
      id: 2,
      slug: 'old-project',
      destination_url: 'https://example.com/revoked-doc',
      status: 'revoked',
      click_count: 12,
      created_at: '2026-10-15T08:00:00Z',
      revoked_at: '2026-11-05T12:00:00Z',
      last_accessed_at: '2026-11-04T09:00:00Z',
    })

    mockDb.seed({
      id: 3,
      slug: 'tombstone-link',
      destination_url: 'https://example.com/tombstone',
      status: 'tombstone',
      click_count: 40,
      created_at: '2026-08-01T00:00:00Z',
      revoked_at: '2026-08-10T00:00:00Z',
      last_accessed_at: '2026-08-09T00:00:00Z',
    })
  })

  it('endpoint /health mengembalikan status 200 OK dengan JSON payload', async () => {
    const req = new Request('https://s.satukit.local/health')
    const res = await handleRequest(req, mockEnv)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/json')
    const data = (await res.json()) as { status: string; service: string }
    expect(data.status).toBe('ok')
    expect(data.service).toBe('satukit-url-shortener')
  })

  it('endpoint root / mengembalikan informasi layanan 200 OK', async () => {
    const req = new Request('https://s.satukit.local/')
    const res = await handleRequest(req, mockEnv)

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Satukit URL Shortener')
  })

  it('mengabaikan favicon.ico dengan status 404', async () => {
    const req = new Request('https://s.docbuilder.local/favicon.ico')
    const res = await handleRequest(req, mockEnv)
    expect(res.status).toBe(404)
  })

  it('menolak slug dengan karakter tidak valid dengan status 400', async () => {
    const req = new Request('https://s.docbuilder.local/invalid!@slug#')
    const res = await handleRequest(req, mockEnv)

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Format tautan pendek tidak valid')
  })

  it('mengembalikan status 404 jika slug tidak terdaftar di D1', async () => {
    const req = new Request('https://s.docbuilder.local/slug-tidak-ada')
    const res = await handleRequest(req, mockEnv)

    expect(res.status).toBe(404)
    expect(await res.text()).toContain('Tautan pendek tidak ditemukan')
  })

  it('mengalihkan tautan aktif dengan direct HTTP 302 ke destination URL', async () => {
    const waitUntilSpy = vi.fn((promise: Promise<any>) => promise)
    const mockCtx = {
      waitUntil: waitUntilSpy,
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext

    const req = new Request('https://s.docbuilder.local/cv-rahmat')
    const res = await handleRequest(req, mockEnv, mockCtx)

    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://porto.rahmath72.cloud/cv')
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=60')

    // Verifikasi pemanggilan ctx.waitUntil untuk inkremen analitik
    expect(waitUntilSpy).toHaveBeenCalledTimes(1)
    await waitUntilSpy.mock.results[0].value

    // Periksa bahwa click_count bertambah dari 5 menjadi 6
    const record = mockDb.records.get('cv-rahmat')
    expect(record?.click_count).toBe(6)
    expect(record?.last_accessed_at).not.toBeNull()
  })

  it('mengembalikan HTTP 410 Gone untuk tautan yang berstatus revoked', async () => {
    const req = new Request('https://s.docbuilder.local/old-project')
    const res = await handleRequest(req, mockEnv)

    expect(res.status).toBe(410)
    expect(await res.text()).toContain('Tautan ini telah dicabut (revoked)')
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400')

    // Tidak boleh menambah click_count pada tautan revoked
    const record = mockDb.records.get('old-project')
    expect(record?.click_count).toBe(12)
  })

  it('mengembalikan HTTP 410 Gone untuk tautan yang berstatus tombstone', async () => {
    const req = new Request('https://s.docbuilder.local/tombstone-link')
    const res = await handleRequest(req, mockEnv)

    expect(res.status).toBe(410)
    expect(await res.text()).toContain('Tautan ini telah dicabut (revoked)')
  })

  it('menangani kesalahan koneksi database D1 dengan HTTP 500', async () => {
    const brokenDb = {
      prepare: vi.fn(() => {
        throw new Error('D1 Connection Timeout')
      }),
    } as unknown as D1Database

    const req = new Request('https://s.docbuilder.local/cv-rahmat')
    const res = await handleRequest(req, { DB: brokenDb })

    expect(res.status).toBe(500)
    expect(await res.text()).toContain('Terjadi kesalahan internal')
  })
})
