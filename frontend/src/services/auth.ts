import { apiFetch, setCsrfToken } from './apiClient'

export class AuthApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }
}

async function parseAuthError(res: Response, fallbackMessage: string): Promise<AuthApiError> {
  const err = await res.json().catch(() => ({}))
  return new AuthApiError(err.detail || fallbackMessage, res.status)
}

export interface OAuthAccount {
  provider: string
  email: string
  created_at: number
}

export interface AuthUser {
  id: string
  email: string
  name: string
  email_verified?: boolean
  has_password?: boolean
  avatar_url?: string | null
  oauth_accounts?: OAuthAccount[]
  is_admin?: boolean
  role?: string
}

export interface BotChallenge {
  challenge_token: string
  question: string
  expires_in: number
}

export interface LoginParams {
  email: string
  password: string
  challenge_token: string
  challenge_answer: number | string
}

export interface LoginInitParams {
  email: string
  password: string
}

export interface LoginInitResult {
  step: 'challenge_required'
  challenge_token: string
  question: string
  expires_in: number
  email: string
  user_id: string
}

export interface LoginVerifyParams {
  challenge_token: string
  challenge_answer: number | string
}

export interface RegisterParams {
  email: string
  password: string
  name: string
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await apiFetch('/api/auth/me', { method: 'GET' })
    if (!res.ok) return null
    const data = await res.json()
    if (data.csrf_token) {
      setCsrfToken(data.csrf_token)
    }
    if (data.user) {
      return {
        ...data.user,
        oauth_accounts: data.oauth_accounts || [],
      }
    }
    return null
  } catch {
    return null
  }
}

export async function getBotChallenge(): Promise<BotChallenge> {
  const res = await apiFetch('/api/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal memuat soal anti-bot dari server.')
  }
  return res.json()
}

export async function loginInit(params: LoginInitParams): Promise<LoginInitResult> {
  const res = await apiFetch('/api/auth/login-init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Email atau kata sandi tidak valid.')
  }
  return res.json()
}

export async function refreshLoginChallenge(challengeToken: string): Promise<BotChallenge> {
  const res = await apiFetch('/api/auth/login-challenge-refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge_token: challengeToken }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal memuat ulang soal anti-bot.')
  }
  return res.json()
}

export async function loginVerify(params: LoginVerifyParams): Promise<AuthUser> {
  const res = await apiFetch('/api/auth/login-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Jawaban soal anti-bot salah. Silakan coba lagi.')
  }
  const data = await res.json()
  if (data.csrf_token) {
    setCsrfToken(data.csrf_token)
  }
  return data.user
}

export async function getGoogleChallenge(): Promise<BotChallenge> {
  const res = await apiFetch('/api/auth/google/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    throw await parseAuthError(
      res,
      'Sesi verifikasi Google tidak ditemukan atau telah kedaluwarsa. Silakan masuk kembali dengan Google.'
    )
  }
  return res.json()
}

export async function refreshGoogleChallenge(challengeToken: string): Promise<BotChallenge> {
  const res = await apiFetch('/api/auth/google/challenge/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challenge_token: challengeToken }),
  })
  if (!res.ok) {
    throw await parseAuthError(res, 'Gagal memuat ulang soal anti-bot.')
  }
  return res.json()
}

export async function verifyGoogleChallenge(params: LoginVerifyParams): Promise<AuthUser> {
  const res = await apiFetch('/api/auth/google/challenge/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    throw await parseAuthError(res, 'Jawaban soal anti-bot salah. Silakan coba lagi.')
  }
  const data = await res.json()
  if (data.csrf_token) {
    setCsrfToken(data.csrf_token)
  }
  return data.user
}

export async function loginWithChallenge(params: LoginParams): Promise<AuthUser> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal masuk. Periksa kembali email, kata sandi, dan jawaban soal matematika.')
  }
  const data = await res.json()
  if (data.csrf_token) {
    setCsrfToken(data.csrf_token)
  }
  return data.user
}

export async function registerUser(params: RegisterParams): Promise<AuthUser> {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal mendaftar akun baru.')
  }
  const data = await res.json()
  if (data.csrf_token) {
    setCsrfToken(data.csrf_token)
  }
  return data.user
}

export async function logoutUser(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
  } catch {
    // Ignore network error on logout
  } finally {
    setCsrfToken(null)
  }
}

export async function verifyEmail(token: string): Promise<{ success: boolean; message: string; user?: AuthUser }> {
  const res = await apiFetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Verifikasi email gagal atau token kedaluwarsa.')
  }
  return res.json()
}

export async function resendVerification(email: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal mengirim ulang tautan verifikasi.')
  }
  return res.json()
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal memproses permintaan reset kata sandi.')
  }
  return res.json()
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal memperbarui kata sandi. Token mungkin tidak valid atau sudah kedaluwarsa.')
  }
  return res.json()
}

export function isValidGoogleAvatarUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return parsed.hostname === 'googleusercontent.com' || parsed.hostname.endsWith('.googleusercontent.com')
  } catch {
    return false
  }
}

export async function startGoogleLink(currentPassword: string): Promise<{ success: boolean; auth_url: string }> {
  const res = await apiFetch('/api/auth/google/link/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal memulai penautan akun Google.')
  }
  return res.json()
}

export async function unlinkGoogle(currentPassword: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/auth/google/unlink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal memutuskan tautan akun Google.')
  }
  return res.json()
}
