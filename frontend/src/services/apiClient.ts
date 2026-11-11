type BrowserLocation = Pick<Location, 'hostname' | 'port'>

export interface ResolveBackendOptions {
  isProd?: boolean
  apiBaseUrl?: string
}

export function resolveBackendUrl(
  location: BrowserLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
  options?: ResolveBackendOptions
): string {
  const customBase =
    options?.apiBaseUrl ??
    (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : undefined)
  if (customBase !== undefined) return customBase

  const isProd =
    options?.isProd ??
    (typeof import.meta !== 'undefined' ? Boolean(import.meta.env?.PROD) : false)
  if (isProd) return ''

  if (!location || location.port === '8000') return ''
  const hostname = location.hostname === 'localhost' ? 'localhost' : '127.0.0.1'
  return `http://${hostname}:8000`
}

const BACKEND_URL = resolveBackendUrl()

export const NETWORK_ERROR_MESSAGE =
  'Layanan Satukit sedang tidak dapat dihubungi. Silakan periksa koneksi atau coba beberapa saat lagi.'

let csrfToken: string | null = null
let bootstrapPromise: Promise<string> | null = null

export async function initAuthSession(): Promise<string> {
  if (csrfToken) return csrfToken
  if (!bootstrapPromise) {
    bootstrapPromise = (async (): Promise<string> => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/bootstrap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        })
        if (!res.ok) {
          throw new Error(`Bootstrap failed: ${res.status}`)
        }
        const data = await res.json()
        const token: string = data.csrf_token || ''
        csrfToken = token
        return token
      } finally {
        bootstrapPromise = null
      }
    })()
  }
  return bootstrapPromise
}

export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = input.startsWith('http')
    ? input
    : `${BACKEND_URL}${input.startsWith('/') ? '' : '/'}${input}`
  const method = (init.method || 'GET').toUpperCase()

  let token = csrfToken
  if (!token) {
    try {
      token = await initAuthSession()
    } catch {
      // offline / backend unreachable
    }
  }

  const headers = new Headers(init.headers || {})
  if (token && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    headers.set('X-CSRF-Token', token)
  }

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
    })
  } catch (err: any) {
    if (err instanceof TypeError || (err.message && err.message.toLowerCase().includes('fetch'))) {
      throw new Error(NETWORK_ERROR_MESSAGE)
    }
    throw err
  }

  // ponytail: single retry on 401, add multi-stage refresh when session timeout policy added
  if (res.status === 401) {
    csrfToken = null
    try {
      token = await initAuthSession()
      if (token && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        headers.set('X-CSRF-Token', token)
      }
      res = await fetch(url, {
        ...init,
        headers,
        credentials: 'include',
      })
    } catch (retryErr: any) {
      if (retryErr instanceof TypeError || (retryErr.message && retryErr.message.toLowerCase().includes('fetch'))) {
        throw new Error(NETWORK_ERROR_MESSAGE)
      }
    }
  }

  return res
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token
}

export { BACKEND_URL }
