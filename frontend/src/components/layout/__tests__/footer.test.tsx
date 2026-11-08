import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { Footer } from '../Footer'

describe('Footer Component Suite', () => {
  it('merender tahun 2026, nama aplikasi, nama developer, dan link portofolio dengan benar', () => {
    render(<Footer />)

    const footer = screen.getByTestId('app-footer')
    expect(footer).toBeInTheDocument()

    // Verifikasi tahun dan identitas aplikasi
    expect(footer).toHaveTextContent('2026')
    expect(footer).toHaveTextContent('Doc-builder')

    // Verifikasi teks developer
    expect(footer).toHaveTextContent('Dikembangkan oleh')

    // Verifikasi link developer
    const link = screen.getByTestId('footer-developer-link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveTextContent('Rahmat Hidayat')
    expect(link).toHaveAttribute('href', 'https://porto.rahmath72.cloud/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('menerapkan kelas CSS tambahan ketika properti className diberikan', () => {
    render(<Footer className="mt-12 custom-footer-test" />)

    const footer = screen.getByTestId('app-footer')
    expect(footer.className).toContain('mt-12')
    expect(footer.className).toContain('custom-footer-test')
  })

  it('bebas dari pelanggaran aksesibilitas WCAG 2.2 AA', async () => {
    const { container } = render(<Footer />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
