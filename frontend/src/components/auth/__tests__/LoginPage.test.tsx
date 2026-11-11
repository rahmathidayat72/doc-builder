import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginPage } from '../LoginPage'
import * as authService from '../../../services/auth'

vi.mock('../../../services/auth', () => ({
  loginInit: vi.fn(),
  loginVerify: vi.fn(),
  refreshLoginChallenge: vi.fn(),
  registerUser: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}))

describe('LoginPage Component', () => {
  const mockOnLoginSuccess = vi.fn()
  const mockOnNavigateHome = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hanya menampilkan form kredensial (Step 1) secara default, soal matematika BELUM muncul', () => {
    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
      />
    )

    expect(screen.getByRole('heading', { name: 'Masuk ke Satukit' })).toBeInTheDocument()
    expect(screen.getByTestId('input-auth-email')).toBeInTheDocument()
    expect(screen.getByTestId('input-auth-password')).toBeInTheDocument()
    expect(screen.getByTestId('btn-submit-step-1')).toHaveTextContent('Lanjut ke Verifikasi')

    // Soal matematika TIDAK boleh ada sebelum kredensial valid
    expect(screen.queryByTestId('challenge-question')).not.toBeInTheDocument()
    expect(screen.queryByTestId('input-challenge-answer')).not.toBeInTheDocument()
  })

  it('jika kredensial salah, tampilkan error dan soal matematika TETAP TIDAK muncul', async () => {
    vi.mocked(authService.loginInit).mockRejectedValue(
      new Error('Email atau kata sandi tidak valid.')
    )

    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
      />
    )

    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'WrongPassword' },
    })
    fireEvent.click(screen.getByTestId('btn-submit-step-1'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-error-alert')).toHaveTextContent(
        'Email atau kata sandi tidak valid.'
      )
    })

    // Soal matematika tetap tidak ada
    expect(screen.queryByTestId('challenge-question')).not.toBeInTheDocument()
    expect(screen.queryByTestId('form-step-2')).not.toBeInTheDocument()
  })

  it('jika kredensial benar, beralih ke Step 2 dan memunculkan soal matematika SD kelas 1', async () => {
    vi.mocked(authService.loginInit).mockResolvedValue({
      step: 'challenge_required',
      challenge_token: 'tok-123.nonce.uid.sig',
      question: 'Berapa hasil dari 7 + 5?',
      expires_in: 300,
      email: 'user@example.com',
      user_id: 'uid-1',
    })

    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
      />
    )

    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'CorrectPassword123' },
    })
    fireEvent.click(screen.getByTestId('btn-submit-step-1'))

    await waitFor(() => {
      expect(screen.getByTestId('form-step-2')).toBeInTheDocument()
      expect(screen.getByTestId('challenge-question')).toHaveTextContent('Berapa hasil dari 7 + 5?')
      expect(screen.getByTestId('input-challenge-answer')).toBeInTheDocument()
    })

    // Form step 1 sudah tertutup
    expect(screen.queryByTestId('form-step-1')).not.toBeInTheDocument()
  })

  it('memverifikasi jawaban matematika di Step 2 dan memanggil onLoginSuccess saat benar', async () => {
    const mockUser = { id: 'uid-1', email: 'user@example.com', name: 'User Terdaftar' }
    vi.mocked(authService.loginInit).mockResolvedValue({
      step: 'challenge_required',
      challenge_token: 'tok-123.nonce.uid.sig',
      question: 'Berapa hasil dari 7 + 5?',
      expires_in: 300,
      email: 'user@example.com',
      user_id: 'uid-1',
    })
    vi.mocked(authService.loginVerify).mockResolvedValue(mockUser)

    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
      />
    )

    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'CorrectPassword123' },
    })
    fireEvent.click(screen.getByTestId('btn-submit-step-1'))

    await waitFor(() => {
      expect(screen.getByTestId('challenge-question')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('input-challenge-answer'), {
      target: { value: '12' },
    })
    fireEvent.click(screen.getByTestId('btn-verify-and-login'))

    await waitFor(() => {
      expect(authService.loginVerify).toHaveBeenCalledWith({
        challenge_token: 'tok-123.nonce.uid.sig',
        challenge_answer: '12',
      })
      expect(mockOnLoginSuccess).toHaveBeenCalledWith(mockUser)
    })
  })

  it('jika jawaban matematika salah di Step 2, tampilkan error dan perbarui soal', async () => {
    vi.mocked(authService.loginInit).mockResolvedValue({
      step: 'challenge_required',
      challenge_token: 'tok-123.nonce.uid.sig',
      question: 'Berapa hasil dari 7 + 5?',
      expires_in: 300,
      email: 'user@example.com',
      user_id: 'uid-1',
    })
    vi.mocked(authService.loginVerify).mockRejectedValue(
      new Error('Jawaban soal anti-bot salah. Silakan coba lagi.')
    )
    vi.mocked(authService.refreshLoginChallenge).mockResolvedValue({
      challenge_token: 'tok-456.nonce.uid.sig2',
      question: 'Berapa 9 - 4?',
      expires_in: 300,
    })

    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
      />
    )

    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'CorrectPassword123' },
    })
    fireEvent.click(screen.getByTestId('btn-submit-step-1'))

    await waitFor(() => {
      expect(screen.getByTestId('challenge-question')).toHaveTextContent('Berapa hasil dari 7 + 5?')
    })

    fireEvent.change(screen.getByTestId('input-challenge-answer'), {
      target: { value: '99' },
    })
    fireEvent.click(screen.getByTestId('btn-verify-and-login'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-error-alert')).toHaveTextContent(
        'Jawaban soal anti-bot salah. Silakan coba lagi.'
      )
      expect(authService.refreshLoginChallenge).toHaveBeenCalledWith('tok-123.nonce.uid.sig')
      expect(screen.getByTestId('challenge-question')).toHaveTextContent('Berapa 9 - 4?')
    })
  })

  it('bisa mengganti soal secara manual di Step 2', async () => {
    vi.mocked(authService.loginInit).mockResolvedValue({
      step: 'challenge_required',
      challenge_token: 'tok-1.nonce.uid.sig',
      question: 'Berapa 3 + 3?',
      expires_in: 300,
      email: 'user@example.com',
      user_id: 'uid-1',
    })
    vi.mocked(authService.refreshLoginChallenge).mockResolvedValue({
      challenge_token: 'tok-2.nonce.uid.sig',
      question: 'Berapa 8 - 2?',
      expires_in: 300,
    })

    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
      />
    )

    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'pass' },
    })
    fireEvent.click(screen.getByTestId('btn-submit-step-1'))

    await waitFor(() => {
      expect(screen.getByTestId('challenge-question')).toHaveTextContent('Berapa 3 + 3?')
    })

    fireEvent.click(screen.getByTestId('btn-refresh-challenge'))

    await waitFor(() => {
      expect(authService.refreshLoginChallenge).toHaveBeenCalledWith('tok-1.nonce.uid.sig')
      expect(screen.getByTestId('challenge-question')).toHaveTextContent('Berapa 8 - 2?')
    })
  })

  it('mendukung pendaftaran akun baru di tab Daftar', async () => {
    const newUser = { id: 'u2', email: 'baru@example.com', name: 'Baru' }
    vi.mocked(authService.registerUser).mockResolvedValue(newUser)

    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
      />
    )

    fireEvent.click(screen.getByTestId('tab-register'))
    expect(screen.getByRole('heading', { name: 'Daftar Akun Baru' })).toBeInTheDocument()
    expect(screen.getByTestId('input-register-name')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('input-register-name'), {
      target: { value: 'Baru' },
    })
    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'baru@example.com' },
    })
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'Password123' },
    })
    fireEvent.click(screen.getByTestId('btn-submit-step-1'))

    await waitFor(() => {
      expect(authService.registerUser).toHaveBeenCalledWith({
        name: 'Baru',
        email: 'baru@example.com',
        password: 'Password123',
      })
      expect(mockOnLoginSuccess).toHaveBeenCalledWith(newUser)
    })
  })

  it('menampilkan notice guard dan tombol kembali ke beranda berfungsi', () => {
    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
        noticeMessage="Silakan masuk terlebih dahulu untuk mengakses 24 alat dokumen Satukit."
      />
    )

    expect(
      screen.getByText('Silakan masuk terlebih dahulu untuk mengakses 24 alat dokumen Satukit.')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-login-back-home'))
    expect(mockOnNavigateHome).toHaveBeenCalled()
  })

  it('menampilkan maskot Kitu dengan ekspresi dan animasi dinamis sesuai alur autentikasi', async () => {
    vi.mocked(authService.loginInit).mockResolvedValue({
      step: 'challenge_required',
      challenge_token: 'tok-1.nonce.uid.sig',
      question: 'Berapa hasil dari 5 + 3?',
      expires_in: 300,
      email: 'user@example.com',
      user_id: 'uid-1',
    })

    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
      />
    )

    // 1. Default login mode: ekspresi siapmembantu
    const mascot = screen.getByTestId('kitu-notice-mascot')
    expect(mascot).toBeInTheDocument()
    expect(mascot).toHaveAttribute('data-expression', 'siapmembantu')
    expect(mascot.className).toContain('animate-kitu-hop')

    // 2. Beralih ke tab daftar (sign up): ekspresi semangat
    fireEvent.click(screen.getByTestId('tab-register'))
    expect(mascot).toHaveAttribute('data-expression', 'semangat')
    expect(mascot.className).toContain('animate-kitu-wiggle')

    // 3. Kembali ke login: kembali ke siapmembantu
    fireEvent.click(screen.getByTestId('tab-login'))
    expect(mascot).toHaveAttribute('data-expression', 'siapmembantu')

    // 4. Lanjut ke Step 2: ekspresi berpikir
    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'Secret123' },
    })
    fireEvent.click(screen.getByTestId('btn-submit-step-1'))

    await waitFor(() => {
      expect(screen.getByTestId('form-step-2')).toBeInTheDocument()
      expect(screen.getByTestId('kitu-notice-mascot')).toHaveAttribute('data-expression', 'berpikir')
      expect(screen.getByTestId('kitu-notice-mascot').className).toContain('animate-kitu-bob')
    })
  })

  it('mengubah ekspresi maskot menjadi kecewa dan bergetar (shake) saat terjadi kesalahan', async () => {
    vi.mocked(authService.loginInit).mockRejectedValue(new Error('Kredensial tidak valid.'))

    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
      />
    )

    fireEvent.change(screen.getByTestId('input-auth-email'), {
      target: { value: 'wrong@example.com' },
    })
    fireEvent.change(screen.getByTestId('input-auth-password'), {
      target: { value: 'wrongpass' },
    })
    fireEvent.click(screen.getByTestId('btn-submit-step-1'))

    await waitFor(() => {
      expect(screen.getByTestId('auth-error-alert')).toBeInTheDocument()
      const mascot = screen.getByTestId('kitu-notice-mascot')
      expect(mascot).toHaveAttribute('data-expression', 'kecewa')
      expect(mascot.className).toContain('animate-kitu-shake')
    })
  })

  it('mendukung alur lupa kata sandi dan pengiriman instruksi reset', async () => {
    vi.mocked(authService.forgotPassword).mockResolvedValue({
      success: true,
      message: 'Jika email terdaftar, instruksi reset telah dikirimkan.',
    })

    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
      />
    )

    fireEvent.click(screen.getByText('Lupa kata sandi?'))
    expect(screen.getByRole('heading', { name: 'Lupa Kata Sandi' })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('nama@email.com'), {
      target: { value: 'lupa@example.com' },
    })
    fireEvent.click(screen.getByText('Kirim Instruksi Reset'))

    await waitFor(() => {
      expect(authService.forgotPassword).toHaveBeenCalledWith('lupa@example.com')
      expect(screen.getByTestId('auth-info-alert')).toHaveTextContent(
        'Jika email terdaftar, instruksi reset telah dikirimkan.'
      )
    })
  })

  it('mendukung alur verifikasi email dengan kode token', async () => {
    vi.mocked(authService.verifyEmail).mockResolvedValue({
      success: true,
      message: 'Email berhasil diverifikasi! Silakan masuk.',
    })

    render(
      <LoginPage
        onLoginSuccess={mockOnLoginSuccess}
        onNavigateHome={mockOnNavigateHome}
      />
    )

    fireEvent.click(screen.getByText('Belum verifikasi email akun? Klik di sini'))
    expect(screen.getByRole('heading', { name: 'Verifikasi Email' })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Masukkan token dari email verifikasi'), {
      target: { value: 'tok-verify-12345' },
    })
    fireEvent.click(screen.getByText('Verifikasi Akun Sekarang'))

    await waitFor(() => {
      expect(authService.verifyEmail).toHaveBeenCalledWith('tok-verify-12345')
      expect(screen.getByTestId('auth-info-alert')).toHaveTextContent(
        'Email berhasil diverifikasi! Silakan masuk.'
      )
    })
  })
})
