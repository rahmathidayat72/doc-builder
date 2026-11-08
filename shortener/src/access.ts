/**
 * Modul Integrasi Cloudflare Access Zero Trust
 * Menegakkan perlindungan akses admin portal dan API sesuai FR-048 & ARCH-05
 */

export interface AccessAuthResult {
  authenticated: boolean
  email?: string
  error?: string
}

export function parseAllowedEmails(configStr?: string): string[] {
  if (!configStr) return []
  return configStr
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
}

export function verifyCloudflareAccess(
  request: Request,
  allowedEmailsConfig?: string
): AccessAuthResult {
  const allowedEmails = parseAllowedEmails(allowedEmailsConfig)

  // 1. Ekstraksi header Cloudflare Access
  const userEmail =
    request.headers.get('Cf-Access-Authenticated-User-Email') ||
    request.headers.get('cf-access-authenticated-user-email')

  if (!userEmail || typeof userEmail !== 'string') {
    return {
      authenticated: false,
      error: 'Header Cloudflare Access tidak ditemukan. Akses ditolak.',
    }
  }

  const cleanEmail = userEmail.trim().toLowerCase()

  // 2. Jika daftar email pembatas disetel, lakukan validasi allowlist
  if (allowedEmails.length > 0) {
    if (!allowedEmails.includes(cleanEmail)) {
      return {
        authenticated: false,
        error: `Email "${userEmail.trim()}" tidak terdaftar sebagai administrator yang berwenang.`,
      }
    }
  }

  return {
    authenticated: true,
    email: userEmail.trim(),
  }
}
