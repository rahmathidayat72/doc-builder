import React, { useState } from 'react'
import {
  Lock,
  Mail,
  User,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  LogIn,
  UserPlus,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Send,
} from 'lucide-react'
import {
  forgotPassword,
  getGoogleChallenge,
  loginInit,
  loginVerify,
  refreshGoogleChallenge,
  refreshLoginChallenge,
  registerUser,
  resendVerification,
  resetPassword,
  verifyEmail,
  verifyGoogleChallenge,
  type AuthUser,
  type BotChallenge,
} from '../../services/auth'
import { KituMascotImg } from '../brand/KituNotice'
import type { KituExpression } from '../brand/kituExpressions'

type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify'

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void
  onNavigateHome: () => void
  noticeMessage?: string
  initialErrorMessage?: string
  googleChallengeRequired?: boolean
  onGoogleChallengeReset?: () => void
}

function isExpiredGooglePendingError(err: unknown): boolean {
  if (
    err &&
    typeof err === 'object' &&
    'status' in err &&
    (err as { status?: unknown }).status === 401
  ) {
    return true
  }
  const message = err instanceof Error ? err.message.toLowerCase() : ''
  return message.includes('masuk kembali dengan google')
}

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
)

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigateHome,
  noticeMessage,
  initialErrorMessage,
  googleChallengeRequired = false,
  onGoogleChallengeReset,
}) => {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // State alur 2-tahap login (password maupun Google OIDC)
  const [loginStep, setLoginStep] = useState<1 | 2>(googleChallengeRequired ? 2 : 1)
  const [challengeKind, setChallengeKind] = useState<'password' | 'google'>(
    googleChallengeRequired ? 'google' : 'password'
  )
  const [challengeData, setChallengeData] = useState<BotChallenge | null>(null)
  const [challengeAnswer, setChallengeAnswer] = useState('')
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(Boolean(googleChallengeRequired))

  // Status proses, error, dan informasi
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage || null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const resetGoogleChallengeRef = React.useRef(onGoogleChallengeReset)

  React.useEffect(() => {
    resetGoogleChallengeRef.current = onGoogleChallengeReset
  }, [onGoogleChallengeReset])

  React.useEffect(() => {
    if (initialErrorMessage) {
      setErrorMessage(initialErrorMessage)
    }
  }, [initialErrorMessage])

  React.useEffect(() => {
    if (!googleChallengeRequired) return
    let cancelled = false

    const startGoogleChallenge = async () => {
      const challengePromise = getGoogleChallenge()
      await Promise.resolve()
      if (cancelled) return

      setMode('login')
      setErrorMessage(null)
      setInfoMessage(null)
      setChallengeKind('google')
      setLoginStep(2)
      setChallengeData(null)
      setChallengeAnswer('')
      setIsLoadingChallenge(true)

      try {
        const challenge = await challengePromise
        if (cancelled) return
        setChallengeData(challenge)
      } catch (err: unknown) {
        if (cancelled) return
        setLoginStep(1)
        setChallengeKind('password')
        setChallengeData(null)
        setErrorMessage(
          (err instanceof Error && err.message) ||
            'Sesi verifikasi Google tidak ditemukan atau telah kedaluwarsa. Silakan masuk kembali dengan Google.'
        )
        resetGoogleChallengeRef.current?.()
      } finally {
        if (!cancelled) {
          setIsLoadingChallenge(false)
        }
      }
    }

    void startGoogleChallenge()

    return () => {
      cancelled = true
    }
  }, [googleChallengeRequired])

  const handleGoogleAuth = () => {
    window.location.href = '/api/auth/google/start'
  }

  const handleModeChange = (newMode: AuthMode) => {
    if (challengeKind === 'google') {
      resetGoogleChallengeRef.current?.()
    }
    setMode(newMode)
    setErrorMessage(null)
    setInfoMessage(null)
    setChallengeKind('password')
    setLoginStep(1)
    setChallengeData(null)
    setChallengeAnswer('')
  }

  // Tahap 1: Verifikasi Kredensial / Registrasi
  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)

    if (!email.trim() || !password) {
      setErrorMessage('Email dan kata sandi wajib diisi.')
      return
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMessage('Nama lengkap wajib diisi.')
        return
      }
      if (password.length < 8) {
        setErrorMessage('Kata sandi minimal 8 karakter.')
        return
      }

      setIsSubmitting(true)
      try {
        const user = await registerUser({
          email: email.trim(),
          password,
          name: name.trim(),
        })
        onLoginSuccess(user)
      } catch (err: any) {
        setErrorMessage(err.message || 'Pendaftaran gagal.')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // Mode Login -> Jalankan Step 1: cek email & kata sandi di server
    setIsSubmitting(true)
    try {
      const result = await loginInit({
        email: email.trim(),
        password,
      })
      setChallengeKind('password')
      setChallengeData(result)
      setLoginStep(2)
      setChallengeAnswer('')
    } catch (err: any) {
      setErrorMessage(err.message || 'Email atau kata sandi tidak valid.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Tahap 2: Verifikasi Jawaban Matematika Anti-Bot
  const handleChallengeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)

    if (!challengeData) {
      setErrorMessage('Data tantangan tidak ditemukan. Silakan ulangi proses masuk.')
      setLoginStep(1)
      return
    }

    if (!challengeAnswer.trim()) {
      setErrorMessage('Jawaban soal matematika wajib diisi.')
      return
    }

    setIsSubmitting(true)
    try {
      const user =
        challengeKind === 'google'
          ? await verifyGoogleChallenge({
              challenge_token: challengeData.challenge_token,
              challenge_answer: challengeAnswer.trim(),
            })
          : await loginVerify({
              challenge_token: challengeData.challenge_token,
              challenge_answer: challengeAnswer.trim(),
            })
      onLoginSuccess(user)
    } catch (err: unknown) {
      if (challengeKind === 'google' && isExpiredGooglePendingError(err)) {
        setLoginStep(1)
        setChallengeKind('password')
        setChallengeData(null)
        setChallengeAnswer('')
        setErrorMessage(
          (err instanceof Error && err.message) ||
            'Sesi verifikasi Google telah kedaluwarsa. Silakan masuk kembali dengan Google.'
        )
        resetGoogleChallengeRef.current?.()
        return
      }
      setErrorMessage(
        (err instanceof Error && err.message) || 'Jawaban soal anti-bot salah. Silakan coba lagi.'
      )
      await handleRefreshChallenge()
    } finally {
      setIsSubmitting(false)
    }
  }

  // Muat ulang soal matematika pada Step 2
  const handleRefreshChallenge = async () => {
    if (!challengeData) return
    setIsLoadingChallenge(true)
    setChallengeAnswer('')
    try {
      const refreshed =
        challengeKind === 'google'
          ? await refreshGoogleChallenge(challengeData.challenge_token)
          : await refreshLoginChallenge(challengeData.challenge_token)
      setChallengeData(refreshed)
    } catch (err: unknown) {
      if (challengeKind === 'google' && isExpiredGooglePendingError(err)) {
        setLoginStep(1)
        setChallengeKind('password')
        setChallengeData(null)
        setErrorMessage(
          (err instanceof Error && err.message) ||
            'Sesi verifikasi Google telah kedaluwarsa. Silakan masuk kembali dengan Google.'
        )
        resetGoogleChallengeRef.current?.()
        return
      }
      setErrorMessage(
        (err instanceof Error && err.message) || 'Gagal memuat ulang soal anti-bot.'
      )
    } finally {
      setIsLoadingChallenge(false)
    }
  }

  // Permintaan Lupa Kata Sandi
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setErrorMessage('Alamat email wajib diisi.')
      return
    }
    setIsSubmitting(true)
    setErrorMessage(null)
    setInfoMessage(null)
    try {
      const res = await forgotPassword(email.trim())
      setInfoMessage(res.message || 'Jika email terdaftar, instruksi reset telah dikirimkan.')
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengirim instruksi reset kata sandi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset Kata Sandi Baru
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tokenInput.trim() || !newPassword) {
      setErrorMessage('Token dan kata sandi baru wajib diisi.')
      return
    }
    if (newPassword.length < 8) {
      setErrorMessage('Kata sandi minimal 8 karakter.')
      return
    }
    setIsSubmitting(true)
    setErrorMessage(null)
    setInfoMessage(null)
    try {
      const res = await resetPassword(tokenInput.trim(), newPassword)
      setInfoMessage(res.message || 'Kata sandi berhasil diperbarui. Silakan masuk.')
      setMode('login')
      setPassword('')
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mereset kata sandi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Verifikasi Email
  const handleVerifyEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tokenInput.trim()) {
      setErrorMessage('Kode token verifikasi wajib diisi.')
      return
    }
    setIsSubmitting(true)
    setErrorMessage(null)
    setInfoMessage(null)
    try {
      const res = await verifyEmail(tokenInput.trim())
      setInfoMessage(res.message || 'Email berhasil diverifikasi! Silakan masuk.')
      setMode('login')
    } catch (err: any) {
      setErrorMessage(err.message || 'Verifikasi email gagal.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Kirim Ulang Verifikasi Email
  const handleResendVerification = async () => {
    if (!email.trim()) {
      setErrorMessage('Masukkan alamat email Anda terlebih dahulu.')
      return
    }
    setIsSubmitting(true)
    setErrorMessage(null)
    setInfoMessage(null)
    try {
      const res = await resendVerification(email.trim())
      setInfoMessage(res.message || 'Tautan verifikasi baru telah dikirimkan.')
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengirim ulang email verifikasi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Ekspresi dan animasi maskot Kitu dinamis
  const getMascotState = (): { expression: KituExpression; motion: string } => {
    if (errorMessage) {
      return { expression: 'kecewa', motion: 'animate-kitu-shake' }
    }
    if (infoMessage) {
      return { expression: 'hore', motion: 'animate-kitu-hop' }
    }
    if (isSubmitting || isLoadingChallenge) {
      return { expression: 'fokus', motion: 'animate-kitu-bob' }
    }
    if (mode === 'login' && loginStep === 2) {
      return { expression: 'berpikir', motion: 'animate-kitu-bob' }
    }
    if (mode === 'register') {
      return { expression: 'semangat', motion: 'animate-kitu-wiggle' }
    }
    if (mode === 'forgot' || mode === 'reset') {
      return { expression: 'penasaran', motion: 'animate-kitu-bob' }
    }
    return { expression: 'siapmembantu', motion: 'animate-kitu-hop' }
  }

  const { expression: mascotExpression, motion: mascotMotion } = getMascotState()

  const getTitle = () => {
    switch (mode) {
      case 'login':
        return 'Masuk ke Beresin'
      case 'register':
        return 'Daftar Akun Baru'
      case 'forgot':
        return 'Lupa Kata Sandi'
      case 'reset':
        return 'Atur Kata Sandi Baru'
      case 'verify':
        return 'Verifikasi Email'
    }
  }

  const getSubtitle = () => {
    switch (mode) {
      case 'login':
        if (loginStep === 2) {
          return challengeKind === 'google'
            ? 'Verifikasi anti-bot untuk menyelesaikan login Google'
            : 'Tahap 2: Selesaikan hitungan anti-bot'
        }
        return 'Verifikasi aman dua tahap untuk akses utilitas dokumen'
      case 'register':
        return 'Buat akun untuk akses penuh utilitas dokumen Beresin by Satukit'
      case 'forgot':
        return 'Masukkan email untuk menerima instruksi reset kata sandi'
      case 'reset':
        return 'Masukkan kode token verifikasi dan kata sandi baru Anda'
      case 'verify':
        return 'Masukkan kode token dari email untuk mengaktifkan akun Anda'
    }
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center min-h-[calc(100dvh-64px)]"
      data-testid="login-page-container"
    >
      <div className="w-full max-w-md space-y-6">
        {/* Tombol Kembali ke Beranda */}
        <div>
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition cursor-pointer"
            data-testid="btn-login-back-home"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </button>
        </div>

        {/* Kartu Utama Halaman Login */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-teal-900/10 dark:border-stone-800 shadow-xl overflow-hidden flex flex-col">
          {/* Header Card */}
          <div className="px-6 pt-6 pb-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-800 dark:text-teal-300 shrink-0">
                {mode === 'forgot' || mode === 'reset' ? (
                  <KeyRound className="w-6 h-6" />
                ) : (
                  <ShieldCheck className="w-6 h-6" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-black text-[#17383c] dark:text-stone-100">
                  {getTitle()}
                </h1>
                <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                  {getSubtitle()}
                </p>
              </div>
            </div>
            <div
              className="shrink-0 -my-2 flex items-center justify-center"
              data-testid="auth-mascot-container"
            >
              <KituMascotImg
                expression={mascotExpression}
                size="md"
                motion={mascotMotion}
                className="transition-transform duration-300 drop-shadow-md"
              />
            </div>
          </div>

          {/* Mode Switcher untuk Login / Register */}
          {(mode === 'login' || mode === 'register') && (
            <div className="px-6 pt-5">
              <div className="grid grid-cols-2 p-1 bg-stone-100 dark:bg-stone-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white dark:bg-stone-900 text-teal-900 dark:text-teal-300 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                  data-testid="tab-login"
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('register')}
                  className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white dark:bg-stone-900 text-teal-900 dark:text-teal-300 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                  data-testid="tab-register"
                >
                  Daftar
                </button>
              </div>
            </div>
          )}

          {/* Banner Pemberitahuan jika dialihkan oleh guard */}
          {noticeMessage && (
            <div className="px-6 pt-4">
              <div className="p-3.5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">{noticeMessage}</p>
              </div>
            </div>
          )}

          {/* Banner Informasi Berhasil */}
          {infoMessage && (
            <div className="px-6 pt-4">
              <div
                role="status"
                className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5"
                data-testid="auth-info-alert"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-semibold">{infoMessage}</span>
              </div>
            </div>
          )}

          {/* Alert Pesan Kesalahan */}
          {errorMessage && (
            <div className="px-6 pt-4">
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
                data-testid="auth-error-alert"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-semibold">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* --- VIEW: LUPA KATA SANDI --- */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPasswordSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-2xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  Alamat Email Terdaftar
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:border-teal-600 focus:bg-white dark:focus:bg-stone-900 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs text-white bg-[#079875] hover:bg-[#087b64] active:scale-[0.99] transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Kirim Instruksi Reset</span>
              </button>

              <div className="flex items-center justify-between pt-2 text-2xs">
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className="font-bold text-teal-800 dark:text-teal-300 hover:underline cursor-pointer"
                >
                  &larr; Kembali ke Masuk
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('reset')}
                  className="font-bold text-stone-600 dark:text-stone-400 hover:underline cursor-pointer"
                >
                  Sudah punya kode token?
                </button>
              </div>
            </form>
          )}

          {/* --- VIEW: RESET KATA SANDI BARU --- */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-2xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  Kode Token Reset (dari Email)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="Masukkan kode token 32 karakter"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:border-teal-600 focus:bg-white dark:focus:bg-stone-900 transition font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-2xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  Kata Sandi Baru
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:border-teal-600 focus:bg-white dark:focus:bg-stone-900 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs text-white bg-[#079875] hover:bg-[#087b64] active:scale-[0.99] transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>Simpan Kata Sandi Baru</span>
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className="text-2xs font-bold text-teal-800 dark:text-teal-300 hover:underline cursor-pointer"
                >
                  &larr; Batal &amp; Kembali ke Masuk
                </button>
              </div>
            </form>
          )}

          {/* --- VIEW: VERIFIKASI EMAIL --- */}
          {mode === 'verify' && (
            <form onSubmit={handleVerifyEmailSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-2xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  Kode Token Verifikasi Email
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="Masukkan token dari email verifikasi"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:border-teal-600 focus:bg-white dark:focus:bg-stone-900 transition font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs text-white bg-[#079875] hover:bg-[#087b64] active:scale-[0.99] transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Verifikasi Akun Sekarang</span>
              </button>

              <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-center">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isSubmitting}
                  className="text-2xs font-bold text-stone-700 dark:text-stone-300 hover:text-teal-700 cursor-pointer block mx-auto"
                >
                  Kirim Ulang Email Verifikasi
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className="text-2xs font-bold text-teal-800 dark:text-teal-300 hover:underline cursor-pointer block mx-auto"
                >
                  &larr; Kembali ke Masuk
                </button>
              </div>
            </form>
          )}

          {/* Form Content: Step 1 vs Step 2 (Mode Login & Register) */}
          {mode === 'login' && loginStep === 2 && !challengeData ? (
            <div className="p-6 text-center space-y-3" data-testid="google-challenge-loading">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <p className="text-xs font-bold text-stone-700 dark:text-stone-300">
                Menyiapkan verifikasi anti-bot untuk akun Google Anda...
              </p>
            </div>
          ) : mode === 'login' && loginStep === 2 && challengeData ? (
            /* --- TAHAP 2: SOAL MATEMATIKA ANTI-BOT --- */
            <form onSubmit={handleChallengeSubmit} className="p-6 space-y-5" data-testid="form-step-2">
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  {challengeKind === 'google' ? (
                    <GoogleIcon className="w-5 h-5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-3xs font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                      {challengeKind === 'google'
                        ? 'Tahap 1: Akun Google Terverifikasi'
                        : 'Tahap 1: Kredensial Benar'}
                    </p>
                    <p
                      className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate"
                      title={challengeKind === 'google' ? 'Autentikasi Google' : email}
                    >
                      {challengeKind === 'google'
                        ? 'Selesaikan soal matematika untuk mengaktifkan sesi Anda'
                        : email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (challengeKind === 'google') {
                      setChallengeKind('password')
                      setChallengeData(null)
                      resetGoogleChallengeRef.current?.()
                    }
                    setLoginStep(1)
                    setErrorMessage(null)
                  }}
                  className="text-3xs font-bold text-emerald-800 dark:text-emerald-300 hover:underline cursor-pointer ml-2 shrink-0"
                  data-testid={
                    challengeKind === 'google' ? 'btn-cancel-google-challenge' : undefined
                  }
                >
                  {challengeKind === 'google' ? 'Batal' : 'Ubah'}
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                    Tahap 2: Verifikasi Anti-Bot
                  </span>
                  <button
                    type="button"
                    onClick={handleRefreshChallenge}
                    disabled={isLoadingChallenge}
                    className="inline-flex items-center gap-1 text-3xs font-bold text-amber-900 dark:text-amber-300 hover:text-amber-950 cursor-pointer disabled:opacity-50"
                    data-testid="btn-refresh-challenge"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingChallenge ? 'animate-spin' : ''}`} />
                    <span>Ganti Soal</span>
                  </button>
                </div>

                <div className="py-3 px-4 rounded-xl bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-900 text-center">
                  <p className="text-base font-black tracking-wide text-stone-900 dark:text-stone-100" data-testid="challenge-question">
                    {challengeData.question}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-2xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    Jawaban Anda
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    autoFocus
                    value={challengeAnswer}
                    onChange={e => setChallengeAnswer(e.target.value)}
                    placeholder="Tulis angka jawaban di sini"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 outline-none focus:border-amber-600 transition text-center"
                    data-testid="input-challenge-answer"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isLoadingChallenge}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs text-white bg-[#079875] hover:bg-[#087b64] active:scale-[0.99] transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                data-testid="btn-verify-and-login"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi jawaban...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Verifikasi &amp; Masuk Sekarang</span>
                  </>
                )}
              </button>
            </form>
          ) : (mode === 'login' || mode === 'register') && (
            /* --- TAHAP 1: INPUT KREDENSIAL ATAU DAFTAR --- */
            <form onSubmit={handleCredentialSubmit} className="p-6 space-y-4" data-testid="form-step-1">
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label className="block text-2xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Nama lengkap Anda"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:border-teal-600 focus:bg-white dark:focus:bg-stone-900 transition"
                      data-testid="input-register-name"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-2xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:border-teal-600 focus:bg-white dark:focus:bg-stone-900 transition"
                    data-testid="input-auth-email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-2xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-300">
                    Kata Sandi
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => handleModeChange('forgot')}
                      className="text-3xs font-bold text-teal-800 dark:text-teal-300 hover:underline cursor-pointer"
                    >
                      Lupa kata sandi?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Minimal 8 karakter' : 'Kata sandi akun'}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800 text-stone-900 dark:text-stone-100 outline-none focus:border-teal-600 focus:bg-white dark:focus:bg-stone-900 transition"
                    data-testid="input-auth-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs text-white bg-[#079875] hover:bg-[#087b64] active:scale-[0.99] transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                data-testid="btn-submit-step-1"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memeriksa kredensial...</span>
                  </>
                ) : mode === 'login' ? (
                  <>
                    <span>Lanjut ke Verifikasi</span>
                    <ShieldCheck className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Daftar Akun Baru</span>
                  </>
                )}
              </button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200 dark:border-stone-700" />
                </div>
                <div className="relative flex justify-center text-3xs uppercase font-extrabold tracking-wider">
                  <span className="bg-white dark:bg-stone-900 px-3 text-stone-400">atau</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs text-stone-700 dark:text-stone-200 bg-stone-50 hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 active:scale-[0.99] transition shadow-xs flex items-center justify-center gap-2.5 cursor-pointer"
                data-testid="btn-google-auth"
              >
                <GoogleIcon className="w-4 h-4 shrink-0" />
                <span>{mode === 'register' ? 'Daftar dengan Google' : 'Lanjutkan dengan Google'}</span>
              </button>

              {mode === 'login' && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => handleModeChange('verify')}
                    className="text-3xs font-medium text-stone-500 dark:text-stone-400 hover:underline cursor-pointer"
                  >
                    Belum verifikasi email akun? Klik di sini
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Footer Kartu */}
          <footer className="px-6 py-4 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-800 text-center">
            <p className="text-3xs font-medium text-stone-500 dark:text-stone-400 leading-relaxed">
              Pembuat CV &amp; Evaluasi ATS tetap bebas biaya dan dapat digunakan langsung di browser Anda.
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
