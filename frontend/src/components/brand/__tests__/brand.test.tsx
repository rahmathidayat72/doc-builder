import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { BrandLogo } from '../BrandLogo'
import { BrandMascot } from '../BrandMascot'

describe('BrandLogo component', () => {
  it('merender varian horizontal secara default dengan alt text lengkap', () => {
    render(<BrandLogo />)
    const img = screen.getByTestId('satukit-horizontal-logo')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('alt', 'Satukit — Satu Tempat, Banyak Solusi Digital')
  })

  it('merender varian icon mandiri dengan ukuran yang sesuai', () => {
    render(<BrandLogo variant="icon" size="lg" />)
    const img = screen.getByTestId('satukit-icon')
    expect(img).toBeInTheDocument()
    expect(img.className).toContain('h-11 w-11')
  })

  it('merender varian app-icon squircle', () => {
    render(<BrandLogo variant="app-icon" size="md" />)
    const img = screen.getByTestId('satukit-app-icon')
    expect(img).toBeInTheDocument()
    expect(img.className).toContain('rounded-xl')
  })

  it('memenuhi standar aksesibilitas WCAG (0 axe violations)', async () => {
    const { container } = render(<BrandLogo />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})

describe('BrandMascot component', () => {
  it('merender varian hero maskot Kitu secara default', () => {
    render(<BrandMascot />)
    const mascot = screen.getByTestId('kitu-mascot')
    expect(mascot).toBeInTheDocument()
    const img = screen.getByAltText('Kitu — Maskot Resmi Satukit')
    expect(img).toBeInTheDocument()
  })

  it('merender varian avatar kepala Kitu untuk header/navbar', () => {
    render(<BrandMascot variant="avatar" size="sm" alt="Avatar Kitu" />)
    const avatar = screen.getByTestId('kitu-avatar')
    expect(avatar).toBeInTheDocument()
    const img = screen.getByAltText('Avatar Kitu')
    expect(img).toBeInTheDocument()
    expect(img.className).toContain('h-8 w-8')
  })

  it('merender caption tambahan jika disediakan', () => {
    render(<BrandMascot caption="Halo, saya Kitu!" />)
    expect(screen.getByText('Halo, saya Kitu!')).toBeInTheDocument()
  })

  it('memenuhi standar aksesibilitas WCAG (0 axe violations)', async () => {
    const { container } = render(<BrandMascot variant="hero" />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
