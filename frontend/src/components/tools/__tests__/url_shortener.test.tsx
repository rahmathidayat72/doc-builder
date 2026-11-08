import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UrlShortenerModal } from '../UrlShortenerModal'
import * as shortenerService from '../../../services/shortener'

describe('UrlShortenerModal Component Suite (TASK-12.4)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('tidak merender modal jika isOpen bernilai false', () => {
    const { container } = render(<UrlShortenerModal isOpen={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('merender modal dengan benar saat isOpen bernilai true', () => {
    render(<UrlShortenerModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Pemendek URL Mandiri')).toBeInTheDocument()
    expect(screen.getByLabelText(/URL Tujuan Panjang/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Slug Kustom/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Buat Tautan Pendek/i })).toBeInTheDocument()
  })

  it('menolak submit dan memunculkan pesan error jika URL bukan skema HTTPS publik (Anti-SSRF)', async () => {
    render(<UrlShortenerModal isOpen={true} onClose={vi.fn()} />)

    const inputDest = screen.getByLabelText(/URL Tujuan Panjang/i)
    fireEvent.change(inputDest, { target: { value: 'http://insecure-site.com' } })

    const submitBtn = screen.getByRole('button', { name: /Buat Tautan Pendek/i })
    fireEvent.click(submitBtn)

    expect(await screen.findByText(/Hanya skema HTTPS publik yang diizinkan/i)).toBeInTheDocument()
  })

  it('menghasilkan slug acak 6 karakter ketika tombol Acak diklik', () => {
    render(<UrlShortenerModal isOpen={true} onClose={vi.fn()} />)

    const randomBtn = screen.getByTitle(/Buat slug acak otomatis/i)
    const inputSlug = screen.getByLabelText(/Slug Kustom/i) as HTMLInputElement

    expect(inputSlug.value).toBe('')
    fireEvent.click(randomBtn)

    expect(inputSlug.value.length).toBe(6)
    expect(inputSlug.value).toMatch(/^[a-zA-Z0-9]{6}$/)
  })

  it('memproses pembuatan tautan pendek dan menampilkan hasil tautan siap pakai', async () => {
    vi.spyOn(shortenerService, 'createShortUrl').mockResolvedValueOnce({
      success: true,
      short_url: 'https://s.docbuilder.local/cv-rahmat',
      slug: 'cv-rahmat',
    })

    render(<UrlShortenerModal isOpen={true} onClose={vi.fn()} />)

    const inputDest = screen.getByLabelText(/URL Tujuan Panjang/i)
    const inputSlug = screen.getByLabelText(/Slug Kustom/i)

    fireEvent.change(inputDest, { target: { value: 'https://porto.rahmath72.cloud/cv' } })
    fireEvent.change(inputSlug, { target: { value: 'cv-rahmat' } })

    const submitBtn = screen.getByRole('button', { name: /Buat Tautan Pendek/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Tautan Pendek Siap Digunakan/i)).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('https://s.docbuilder.local/cv-rahmat')).toBeInTheDocument()
  })

  it('menangani kegagalan API dan menampilkan pesan kesalahan', async () => {
    vi.spyOn(shortenerService, 'createShortUrl').mockResolvedValueOnce({
      success: false,
      short_url: '',
      slug: '',
      error: 'Slug ini telah digunakan oleh tautan aktif lain.',
    })

    render(<UrlShortenerModal isOpen={true} onClose={vi.fn()} />)

    const inputDest = screen.getByLabelText(/URL Tujuan Panjang/i)
    fireEvent.change(inputDest, { target: { value: 'https://porto.rahmath72.cloud/cv' } })

    const submitBtn = screen.getByRole('button', { name: /Buat Tautan Pendek/i })
    fireEvent.click(submitBtn)

    expect(await screen.findByText(/Slug ini telah digunakan oleh tautan aktif lain/i)).toBeInTheDocument()
  })

  it('tombol Salin memanggil navigator.clipboard.writeText', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    vi.spyOn(shortenerService, 'createShortUrl').mockResolvedValueOnce({
      success: true,
      short_url: 'https://s.docbuilder.local/my-link',
      slug: 'my-link',
    })

    render(<UrlShortenerModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/URL Tujuan Panjang/i), {
      target: { value: 'https://example.com/dest' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Buat Tautan Pendek/i }))

    await waitFor(() => {
      expect(screen.getByText(/Tautan Pendek Siap Digunakan/i)).toBeInTheDocument()
    })

    const copyBtn = screen.getByRole('button', { name: /^Salin$/i })
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('https://s.docbuilder.local/my-link')
  })

  it('melakukan dual-read fallback dari docbuilder_shortened_links jika satukit_shortened_links belum ada', () => {
    const legacyLinks = [
      {
        id: 'legacy-1',
        slug: 'legacy-slug',
        destination_url: 'https://example.com/legacy',
        short_url: 'https://s.satukit.local/legacy-slug',
        created_at: new Date().toISOString(),
      },
    ]
    localStorage.setItem('docbuilder_shortened_links', JSON.stringify(legacyLinks))

    const loaded = shortenerService.getLocalShortenedLinks()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].slug).toBe('legacy-slug')
    expect(localStorage.getItem('satukit_shortened_links')).toBeTruthy()
  })
})
