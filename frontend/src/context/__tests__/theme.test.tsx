import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ThemeProvider, useTheme } from '../ThemeContext'
import { ThemeToggle } from '../../components/layout/ThemeToggle'

const TestConsumer = () => {
  const { theme, isDark, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="is-dark">{isDark ? 'true' : 'false'}</span>
      <button data-testid="toggle-btn" onClick={toggleTheme}>Toggle</button>
    </div>
  )
}

describe('ThemeContext & ThemeToggle Suite (REBRAND-SATUKIT-012)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('menginisialisasi mode terang secara default dan memperbarui class root', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    expect(screen.getByTestId('is-dark')).toHaveTextContent('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('dapat beralih ke mode gelap dan menyimpan ke localStorage', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    )

    const btn = screen.getByTestId('toggle-btn')
    fireEvent.click(btn)

    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    expect(screen.getByTestId('is-dark')).toHaveTextContent('true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('satukit_theme')).toBe('dark')

    // Beralih kembali ke mode terang
    fireEvent.click(btn)
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('satukit_theme')).toBe('light')
  })

  it('ThemeToggle merender tombol sakelar ☀️ / 🌙 dan dapat diklik', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    )

    const toggleBtn = screen.getByTestId('theme-toggle-btn')
    expect(toggleBtn).toBeInTheDocument()
    expect(toggleBtn).toHaveAttribute('aria-label', 'Beralih ke mode gelap')

    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-label', 'Beralih ke mode terang')
  })
})
