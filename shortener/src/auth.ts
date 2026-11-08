/**
 * Modul Autentikasi HMAC Signature dengan Timestamp & Nonce Anti-Replay
 * Menegakkan standar NFR-SEC-009 dan FR-048
 */

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000 // Maksimal toleransi 5 menit (300 detik)
const MIN_NONCE_LENGTH = 8

export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false

  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

export async function computeHmacSignature(
  secret: string,
  payload: string
): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(payload)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const hashArray = Array.from(new Uint8Array(signatureBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function buildHmacPayload(
  method: string,
  pathname: string,
  timestamp: string | number,
  nonce: string,
  bodyText: string = ''
): string {
  return `${method.toUpperCase()}:${pathname}:${timestamp}:${nonce}:${bodyText}`
}

export async function verifyHmacRequest(
  request: Request,
  secret: string,
  bodyText: string = ''
): Promise<{ valid: boolean; error?: string }> {
  if (!secret) {
    return {
      valid: false,
      error: 'Konfigurasi secret HMAC server belum disetel.',
    }
  }

  const signature = request.headers.get('X-Signature') || request.headers.get('x-signature')
  const timestampStr =
    request.headers.get('X-Timestamp') || request.headers.get('x-timestamp')
  const nonce = request.headers.get('X-Nonce') || request.headers.get('x-nonce')

  if (!signature) {
    return { valid: false, error: 'Header X-Signature wajib disertakan.' }
  }
  if (!timestampStr) {
    return { valid: false, error: 'Header X-Timestamp wajib disertakan.' }
  }
  if (!nonce || nonce.length < MIN_NONCE_LENGTH) {
    return {
      valid: false,
      error: `Header X-Nonce wajib disertakan (minimal ${MIN_NONCE_LENGTH} karakter).`,
    }
  }

  const reqTimestamp = parseInt(timestampStr, 10)
  if (isNaN(reqTimestamp)) {
    return { valid: false, error: 'Header X-Timestamp tidak valid.' }
  }

  const now = Date.now()
  if (Math.abs(now - reqTimestamp) > MAX_TIMESTAMP_DRIFT_MS) {
    return {
      valid: false,
      error: 'Stempel waktu permintaan telah kedaluwarsa (toleransi maks. 5 menit).',
    }
  }

  const url = new URL(request.url)
  const expectedPayload = buildHmacPayload(
    request.method,
    url.pathname,
    timestampStr,
    nonce,
    bodyText
  )

  const expectedSignature = await computeHmacSignature(secret, expectedPayload)

  if (!timingSafeEqual(signature.toLowerCase(), expectedSignature.toLowerCase())) {
    return { valid: false, error: 'Tanda tangan HMAC tidak valid atau tidak cocok.' }
  }

  return { valid: true }
}
