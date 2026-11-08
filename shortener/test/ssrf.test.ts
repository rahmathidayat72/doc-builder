import { describe, expect, it } from 'vitest'
import { validateDestinationUrl } from '../src/validation'

describe('Anti-SSRF Validation Matrix Suite (NFR-SEC-008)', () => {
  it('menerima URL publik HTTPS yang valid', () => {
    const validUrls = [
      'https://porto.rahmath72.cloud/cv',
      'https://github.com/user/project',
      'https://subdomain.example.com:443/path?query=val#section',
      'https://www.google.com',
      'https://docs.cloudflare.com/workers',
    ]

    for (const url of validUrls) {
      const res = validateDestinationUrl(url)
      expect(res.valid, `Expected valid: ${url}`).toBe(true)
      expect(res.error).toBeUndefined()
    }
  })

  it('menolak skema non-HTTPS (http, ftp, file, javascript, data)', () => {
    const nonHttpsUrls = [
      'http://example.com/insecure',
      'ftp://files.example.com/data',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<h1>Hello</h1>',
    ]

    for (const url of nonHttpsUrls) {
      const res = validateDestinationUrl(url)
      expect(res.valid, `Expected rejected: ${url}`).toBe(false)
      expect(res.error).toContain('Hanya skema HTTPS publik yang diizinkan')
    }
  })

  it('menolak URL yang memuat username atau password (kredensial)', () => {
    const credentialUrls = [
      'https://admin:secret123@example.com/api',
      'https://user@example.com/dashboard',
      'https://:nopassword@example.com',
    ]

    for (const url of credentialUrls) {
      const res = validateDestinationUrl(url)
      expect(res.valid, `Expected rejected: ${url}`).toBe(false)
      expect(res.error).toContain('dilarang memuat kredensial pengguna')
    }
  })

  it('menolak localhost dan domain internal / privat', () => {
    const localHosts = [
      'https://localhost',
      'https://localhost:8080',
      'https://sub.localhost/api',
      'https://service.local/status',
      'https://internal.lan/db',
      'https://server.home/admin',
      'https://cluster.internal/secret',
      'https://site.test',
    ]

    for (const url of localHosts) {
      const res = validateDestinationUrl(url)
      expect(res.valid, `Expected rejected: ${url}`).toBe(false)
      expect(res.error).toContain('Hostname lokal atau internal dilarang')
    }
  })

  it('menolak alamat IPv4 loopback (127.0.0.0/8)', () => {
    const loopbacks = [
      'https://127.0.0.1',
      'https://127.0.0.1:8443',
      'https://127.0.0.2',
      'https://127.255.255.254',
    ]

    for (const url of loopbacks) {
      const res = validateDestinationUrl(url)
      expect(res.valid, `Expected rejected: ${url}`).toBe(false)
      expect(res.error).toContain('Alamat IP privat, loopback, link-local, atau reserved dilarang')
    }
  })

  it('menolak alamat IP metadata cloud dan link-local (169.254.169.254)', () => {
    const metadataUrls = [
      'https://169.254.169.254/latest/meta-data/',
      'https://169.254.1.1',
      'https://169.254.254.254',
    ]

    for (const url of metadataUrls) {
      const res = validateDestinationUrl(url)
      expect(res.valid, `Expected rejected: ${url}`).toBe(false)
      expect(res.error).toContain('Alamat IP privat, loopback, link-local, atau reserved dilarang')
    }
  })

  it('menolak alamat IPv4 privat RFC 1918 (10.x, 172.16-31.x, 192.168.x)', () => {
    const privateIps = [
      'https://10.0.0.1',
      'https://10.255.255.255',
      'https://172.16.0.1',
      'https://172.20.10.5',
      'https://172.31.255.254',
      'https://192.168.1.1',
      'https://192.168.0.100',
    ]

    for (const url of privateIps) {
      const res = validateDestinationUrl(url)
      expect(res.valid, `Expected rejected: ${url}`).toBe(false)
      expect(res.error).toContain('Alamat IP privat, loopback, link-local, atau reserved dilarang')
    }
  })

  it('menolak obfuski IP desimal dan heksadesimal', () => {
    const obfuscatedUrls = [
      'https://2130706433', // 127.0.0.1 dalam integer desimal
      'https://0x7f000001', // 127.0.0.1 dalam hex
      'https://2886729729', // 172.16.0.1 dalam integer desimal
      'https://3232235777', // 192.168.1.1 dalam integer desimal
    ]

    for (const url of obfuscatedUrls) {
      const res = validateDestinationUrl(url)
      expect(res.valid, `Expected rejected: ${url}`).toBe(false)
    }
  })

  it('menolak alamat IPv6 loopback dan privat ([::1], [fe80::], [fc00::])', () => {
    const ipv6Urls = [
      'https://[::1]',
      'https://[::1]:8443',
      'https://[fe80::1ff:fe23:4567]',
      'https://[fc00::1]',
      'https://[fd12:3456:789a:1::1]',
    ]

    for (const url of ipv6Urls) {
      const res = validateDestinationUrl(url)
      expect(res.valid, `Expected rejected: ${url}`).toBe(false)
      expect(res.error).toContain('Alamat IPv6 privat atau loopback dilarang')
    }
  })

  it('menolak URL kosong atau format tidak teratur', () => {
    expect(validateDestinationUrl('').valid).toBe(false)
    expect(validateDestinationUrl('bukan-url-sama-sekali').valid).toBe(false)
    expect(validateDestinationUrl('https://').valid).toBe(false)
  })
})
