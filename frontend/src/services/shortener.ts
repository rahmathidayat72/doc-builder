import { apiFetch } from './apiClient'

const LOCAL_STORAGE_KEY = 'satukit_shortened_links'
const LEGACY_LOCAL_STORAGE_KEY = 'docbuilder_shortened_links'

export interface ShortenedLinkItem {
  id: string
  slug: string
  destination_url: string
  short_url: string
  created_at: string
}

export function getLocalShortenedLinks(): ShortenedLinkItem[] {
  try {
    let raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY)
      if (legacyRaw) {
        raw = legacyRaw
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, legacyRaw)
        } catch {
          // ignore quota
        }
      }
    }
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveLocalShortenedLink(link: Omit<ShortenedLinkItem, 'id'>): ShortenedLinkItem {
  const links = getLocalShortenedLinks()
  const newItem: ShortenedLinkItem = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    ...link,
  }

  // Simpan dan pertahankan 30 riwayat terbaru
  const updated = [newItem, ...links.filter((l) => l.slug !== newItem.slug)].slice(0, 30)
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Ignore storage quota
  }
  return newItem
}

export async function createShortUrl(
  destinationUrl: string,
  slug?: string
): Promise<{ success: boolean; short_url: string; slug: string; error?: string }> {
  try {
    const res = await apiFetch('/api/shortener/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        destination_url: destinationUrl.trim(),
        slug: slug ? slug.trim() : undefined,
      }),
    })

    if (!res.ok) {
      if (res.status === 405 || res.status === 404) {
        return {
          success: false,
          short_url: '',
          slug: '',
          error:
            'Layanan pemendek URL belum aktif di backend server. Silakan muat ulang (restart) server backend Satukit (port 8000).',
        }
      }
      const data = await res.json().catch(() => ({}))
      return {
        success: false,
        short_url: '',
        slug: '',
        error: data.detail || data.error || `Gagal memendekkan tautan (${res.status}).`,
      }
    }

    const data = await res.json()

    // Simpan ke riwayat lokal
    saveLocalShortenedLink({
      slug: data.slug,
      destination_url: data.destination_url,
      short_url: data.short_url,
      created_at: new Date().toISOString(),
    })

    return {
      success: true,
      short_url: data.short_url,
      slug: data.slug,
    }
  } catch (err: any) {
    return {
      success: false,
      short_url: '',
      slug: '',
      error: err.message || 'Terjadi kesalahan jaringan saat menghubungi server.',
    }
  }
}

export async function getShortenerConfig(): Promise<{ baseUrl: string; adminPortalUrl: string }> {
  try {
    const res = await apiFetch('/api/shortener/config')
    if (!res.ok) throw new Error('Failed to load config')
    const data = await res.json()
    return {
      baseUrl: data.base_url || 'https://s.docbuilder.local',
      adminPortalUrl: data.admin_portal_url || 'https://s.docbuilder.local/admin',
    }
  } catch {
    return {
      baseUrl: 'https://s.docbuilder.local',
      adminPortalUrl: 'https://s.docbuilder.local/admin',
    }
  }
}
