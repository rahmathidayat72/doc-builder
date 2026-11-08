import { validateDestinationUrl } from './validation'
import { verifyHmacRequest } from './auth'
import { verifyCloudflareAccess } from './access'
import { renderAdminHtml } from './admin'

export interface Env {
  DB: D1Database
  ADMIN_HMAC_SECRET?: string
  CF_ACCESS_ALLOWED_EMAILS?: string
}

export interface UrlRecord {
  id: number
  slug: string
  destination_url: string
  status: 'active' | 'revoked' | 'tombstone'
  click_count: number
  created_at: string
  revoked_at: string | null
  last_accessed_at: string | null
}

export const SLUG_REGEX = /^[a-zA-Z0-9_-]{1,100}$/

export async function getUrlBySlug(
  db: D1Database,
  slug: string
): Promise<Pick<UrlRecord, 'destination_url' | 'status'> | null> {
  const result = await db
    .prepare('SELECT destination_url, status FROM urls WHERE slug = ?')
    .bind(slug)
    .first<Pick<UrlRecord, 'destination_url' | 'status'>>()

  return result || null
}

export async function incrementClickCount(db: D1Database, slug: string): Promise<void> {
  await db
    .prepare(
      'UPDATE urls SET click_count = click_count + 1, last_accessed_at = datetime("now") WHERE slug = ?'
    )
    .bind(slug)
    .run()
}

/**
 * Handler Management API untuk Pembuatan, Daftar, dan Pencabutan Tautan Pendek
 */
async function handleManagementApi(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response> {
  const method = request.method.toUpperCase()

  // Ambil body teks jika request memiliki payload
  let bodyText = ''
  if (method === 'POST' || method === 'PUT') {
    bodyText = await request.text()
  }

  // 1. Verifikasi Autentikasi: Prioritaskan Cloudflare Access Zero Trust, fallback ke HMAC-SHA256
  const accessResult = verifyCloudflareAccess(request, env.CF_ACCESS_ALLOWED_EMAILS)
  let isAuthenticated = accessResult.authenticated

  if (!isAuthenticated) {
    const secret = env.ADMIN_HMAC_SECRET || ''
    const hmacResult = await verifyHmacRequest(request, secret, bodyText)
    if (hmacResult.valid) {
      isAuthenticated = true
    } else {
      const hasAccessHeader =
        request.headers.has('Cf-Access-Authenticated-User-Email') ||
        request.headers.has('cf-access-authenticated-user-email')

      return new Response(
        JSON.stringify({
          success: false,
          error:
            (hasAccessHeader ? accessResult.error : hmacResult.error) ||
            'Akses ditolak: autentikasi Cloudflare Access atau HMAC tidak valid.',
        }),
        {
          status: hasAccessHeader ? 403 : 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  // 2. GET /api/links — Daftar semua tautan
  if (pathname === '/api/links' && method === 'GET') {
    const records = await env.DB.prepare(
      'SELECT id, slug, destination_url, status, click_count, created_at, revoked_at, last_accessed_at FROM urls ORDER BY id DESC LIMIT 200'
    ).all<UrlRecord>()

    return new Response(
      JSON.stringify({
        success: true,
        links: records.results || [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // 3. POST /api/links — Buat tautan baru
  if (pathname === '/api/links' && method === 'POST') {
    let payload: { slug?: string; destination_url?: string }
    try {
      payload = JSON.parse(bodyText)
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Format JSON payload tidak valid.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const rawSlug = (payload.slug || '').trim()
    const rawDest = (payload.destination_url || '').trim()

    // Validasi format slug
    if (!rawSlug || !SLUG_REGEX.test(rawSlug)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Format slug tidak valid (hanya huruf, angka, dash, underscore, 1-100 karakter).',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validasi Anti-SSRF pada URL Tujuan (NFR-SEC-008)
    const ssrfCheck = validateDestinationUrl(rawDest)
    if (!ssrfCheck.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: ssrfCheck.error || 'URL tujuan ditolak oleh filter Anti-SSRF.',
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Cek apakah slug sudah terdaftar
    const existing = await env.DB.prepare(
      'SELECT id, status FROM urls WHERE slug = ?'
    )
      .bind(rawSlug)
      .first<{ id: number; status: string }>()

    if (existing) {
      if (existing.status === 'revoked' || existing.status === 'tombstone') {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              'Slug ini telah dicabut dan dilarang digunakan kembali secara permanen (no slug reuse).',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Slug ini telah digunakan oleh tautan aktif lain.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Simpan tautan baru ke database D1
    await env.DB.prepare(
      'INSERT INTO urls (slug, destination_url, status) VALUES (?, ?, "active")'
    )
      .bind(rawSlug, rawDest)
      .run()

    return new Response(
      JSON.stringify({
        success: true,
        link: {
          slug: rawSlug,
          destination_url: rawDest,
          status: 'active',
          click_count: 0,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 4. POST /api/links/:slug/revoke — Cabut tautan
  const revokeMatch = pathname.match(/^\/api\/links\/([a-zA-Z0-9_-]+)\/revoke$/)
  if (revokeMatch && method === 'POST') {
    const slugToRevoke = revokeMatch[1]

    const existing = await env.DB.prepare(
      'SELECT id, status FROM urls WHERE slug = ?'
    )
      .bind(slugToRevoke)
      .first<{ id: number; status: string }>()

    if (!existing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tautan pendek tidak ditemukan.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (existing.status === 'revoked' || existing.status === 'tombstone') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Tautan sudah berada dalam status dicabut.',
          status: existing.status,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    await env.DB.prepare(
      'UPDATE urls SET status = "revoked", revoked_at = datetime("now") WHERE slug = ?'
    )
      .bind(slugToRevoke)
      .run()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tautan berhasil dicabut (revoked). Permintaan selanjutnya akan mengembalikan HTTP 410.',
        slug: slugToRevoke,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: false, error: 'Endpoint API tidak ditemukan.' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  )
}

export async function handleRequest(
  request: Request,
  env: Env,
  ctx?: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname

  // 1. Health check endpoint
  if (pathname === '/health' || pathname === '/api/health') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        service: 'satukit-url-shortener',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    )
  }

  // 2. Beranda root
  if (pathname === '/' || pathname === '') {
    return new Response(
      'Satukit URL Shortener • Edge Redirection Service',
      {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      }
    )
  }

  // 3. Portal Admin Web (/admin atau /admin/) terlindungi Cloudflare Access
  if (pathname === '/admin' || pathname === '/admin/') {
    const accessResult = verifyCloudflareAccess(request, env.CF_ACCESS_ALLOWED_EMAILS)
    if (!accessResult.authenticated) {
      return new Response(
        `Akses Ditolak (HTTP 403): Verifikasi Zero Trust Cloudflare Access gagal.\n${accessResult.error || ''}`,
        {
          status: 403,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
          },
        }
      )
    }

    const html = renderAdminHtml(accessResult.email)
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, must-revalidate',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    })
  }

  // 4. Management API Endpoint (/api/links...)
  if (pathname.startsWith('/api/links')) {
    return handleManagementApi(request, env, pathname)
  }

  // 5. Ekstraksi slug untuk pengalihan publik
  const slug = pathname.replace(/^\/+/, '').split('/')[0]

  // Abaikan favicon atau file statis umum
  if (slug === 'favicon.ico' || slug === 'robots.txt') {
    return new Response(null, { status: 404 })
  }

  // Validasi format slug
  if (!SLUG_REGEX.test(slug)) {
    return new Response('Format tautan pendek tidak valid.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  try {
    const record = await getUrlBySlug(env.DB, slug)

    // Slug tidak ditemukan (HTTP 404)
    if (!record) {
      return new Response(
        'Tautan pendek tidak ditemukan atau telah kedaluwarsa.',
        {
          status: 404,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=60',
          },
        }
      )
    }

    // Tautan dicabut/dinonaktifkan (HTTP 410 Gone)
    if (record.status === 'revoked' || record.status === 'tombstone') {
      return new Response(
        'Tautan ini telah dicabut (revoked) oleh pemilik dan tidak dapat diakses kembali.',
        {
          status: 410,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
          },
        }
      )
    }

    // Tautan aktif: Agregasi analitik hit tanpa PII via waitUntil
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(
        incrementClickCount(env.DB, slug).catch((err) => {
          console.error(`[Analytics] Gagal mencatat hit slug ${slug}:`, err)
        })
      )
    } else {
      // Fallback eksekusi inline jika ctx tidak tersedia (misal saat testing)
      await incrementClickCount(env.DB, slug).catch(() => {})
    }

    // Pengalihan cepat HTTP 302
    return new Response(null, {
      status: 302,
      headers: {
        Location: record.destination_url,
        'Cache-Control': 'private, max-age=60',
      },
    })
  } catch (error) {
    console.error(`[Error] Gagal memproses slug ${slug}:`, error)
    return new Response('Terjadi kesalahan internal pada edge router.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

export default {
  fetch: handleRequest,
}