/**
 * Modul Validasi Anti-SSRF (Server-Side Request Forgery)
 * Menegakkan standar NFR-SEC-008 dan FR-048
 */

export interface ValidationResult {
  valid: boolean
  error?: string
}

function parseIpv4Octets(host: string): [number, number, number, number] | null {
  // 1. Dotted standard (a.b.c.d)
  const parts = host.split('.')
  if (parts.length === 4) {
    const octets: number[] = []
    for (const p of parts) {
      if (!/^\d+$/.test(p)) return null
      const n = parseInt(p, 10)
      if (n < 0 || n > 255) return null
      octets.push(n)
    }
    return [octets[0], octets[1], octets[2], octets[3]]
  }

  // 2. Single integer / Hex / Octal representation (mis. 2130706433 atau 0x7f000001)
  let num: number | null = null
  if (/^0x[0-9a-f]+$/i.test(host)) {
    num = parseInt(host, 16)
  } else if (/^\d+$/.test(host)) {
    num = parseInt(host, 10)
  }

  if (num !== null && !isNaN(num) && num >= 0 && num <= 0xffffffff) {
    return [
      (num >>> 24) & 255,
      (num >>> 16) & 255,
      (num >>> 8) & 255,
      num & 255,
    ]
  }

  return null
}

function isPrivateOrReservedIpv4(o: [number, number, number, number]): boolean {
  const [b0, b1] = o

  // 0.0.0.0/8 (Broadcast/Local)
  if (b0 === 0) return true

  // 10.0.0.0/8 (RFC 1918 Private)
  if (b0 === 10) return true

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true

  // 100.64.0.0/10 (Carrier-Grade NAT RFC 6598)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true

  // 169.254.0.0/16 (Link-Local & Cloud Metadata Service RFC 3927)
  if (b0 === 169 && b1 === 254) return true

  // 172.16.0.0/12 (RFC 1918 Private)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (b0 === 192 && b1 === 0 && o[2] === 0) return true

  // 192.0.2.0/24 (TEST-NET-1)
  if (b0 === 192 && b1 === 0 && o[2] === 2) return true

  // 192.168.0.0/16 (RFC 1918 Private)
  if (b0 === 192 && b1 === 168) return true

  // 198.18.0.0/15 (Network Benchmark Tests)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true

  // 198.51.100.0/24 (TEST-NET-2)
  if (b0 === 198 && b1 === 51 && o[2] === 100) return true

  // 203.0.113.0/24 (TEST-NET-3)
  if (b0 === 203 && b1 === 0 && o[2] === 113) return true

  // 224.0.0.0/4 (Multicast Class D) & 240.0.0.0/4 (Reserved Class E)
  if (b0 >= 224) return true

  return false
}

function isPrivateOrReservedIpv6(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, '').toLowerCase()

  // Loopback (::1) & Unspecified (::)
  if (clean === '::1' || clean === '::' || clean === '0:0:0:0:0:0:0:1') return true

  // Unique Local Address (fc00::/7 -> fc.. atau fd..)
  if (clean.startsWith('fc') || clean.startsWith('fd')) return true

  // Link-Local (fe80::/10 -> fe8, fe9, fea, feb)
  if (
    clean.startsWith('fe8') ||
    clean.startsWith('fe9') ||
    clean.startsWith('fea') ||
    clean.startsWith('feb')
  ) {
    return true
  }

  // IPv4-mapped IPv6 (::ffff:127.0.0.1 atau ::ffff:7f00:1)
  if (clean.includes('::ffff:')) {
    const v4Part = clean.split('::ffff:')[1]
    const octets = parseIpv4Octets(v4Part)
    if (octets && isPrivateOrReservedIpv4(octets)) return true
  }

  return false
}

export function validateDestinationUrl(rawUrl: string): ValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL tujuan wajib diisi.' }
  }

  const trimmed = rawUrl.trim()
  if (trimmed.length > 2048) {
    return { valid: false, error: 'Panjang URL tujuan melebihi batas 2048 karakter.' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { valid: false, error: 'Format URL tujuan tidak valid.' }
  }

  // 1. Skema wajib HTTPS publik
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Hanya skema HTTPS publik yang diizinkan (NFR-SEC-008).' }
  }

  // 2. Larangan kredensial dalam URL (user:pass@host)
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URL tujuan dilarang memuat kredensial pengguna.' }
  }

  const host = parsed.hostname.toLowerCase()

  // 3. Nama host kosong
  if (!host) {
    return { valid: false, error: 'Hostname URL tujuan tidak boleh kosong.' }
  }

  // 4. Deteksi localhost & domain privat/lokal
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home') ||
    host.endsWith('.corp') ||
    host.endsWith('.test')
  ) {
    return { valid: false, error: 'Hostname lokal atau internal dilarang (Anti-SSRF).' }
  }

  // 5. Deteksi IPv4 desimal/heksadesimal/dotted
  const ipv4Octets = parseIpv4Octets(host)
  if (ipv4Octets) {
    if (isPrivateOrReservedIpv4(ipv4Octets)) {
      return {
        valid: false,
        error: 'Alamat IP privat, loopback, link-local, atau reserved dilarang (Anti-SSRF).',
      }
    }
  }

  // 6. Deteksi IPv6
  if (host.includes(':') || (host.startsWith('[') && host.endsWith(']'))) {
    if (isPrivateOrReservedIpv6(host)) {
      return {
        valid: false,
        error: 'Alamat IPv6 privat atau loopback dilarang (Anti-SSRF).',
      }
    }
  }

  // 7. Domain publik harus memuat setidaknya satu titik dan TLD valid
  if (!ipv4Octets && !host.includes('.')) {
    return { valid: false, error: 'URL tujuan harus memiliki domain yang valid.' }
  }

  return { valid: true }
}
