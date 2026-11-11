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
  loginInit,
  loginVerify,
  refreshLoginChallenge,
  registerUser,
  resendVerification,
  resetPassword,
  verifyEmail,
  type AuthUser,
  type LoginInitResult,
} from '../../services/auth'
import { KituMascotImg } from '../brand/KituNotice'
import type { KituExpression } from '../brand/kituExpressions'

type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify'

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void
  onNavigateHome: () => void
  noticeMessage?: string
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigateHome,
  noticeMessage,
}) => {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // State alur 2-tahap login
  const [loginStep, setLoginStep] = useState<1 | 2>(1)
  const [challengeData, setChallengeData] = useState<LoginInitResult | null>(null)
  const [challengeAnswer, setChallengeAnswer] = useState('')
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false)

  // Status proses, error, dan informasi
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode)
    setErrorMessage(null)
    setInfoMessage(null)
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
      const user = await loginVerify({
        challenge_token: challengeData.challenge_token,
        challenge_answer: challengeAnswer.trim(),
      })
      onLoginSuccess(user)
    } catch (err: any) {
      setErrorMessage(err.message || 'Jawaban soal anti-bot salah. Silakan coba lagi.')
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
      const refreshed = await refreshLoginChallenge(challengeData.challenge_token)
      setChallengeData({
        ...challengeData,
        challenge_token: refreshed.challenge_token,
        question: refreshed.question,
        expires_in: refreshed.expires_in,
      })
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat ulang soal anti-bot.')
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
        return 'Masuk ke Satukit'
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
        return loginStep === 2
          ? 'Tahap 2: Selesaikan hitungan anti-bot'
          : 'Verifikasi aman dua tahap untuk akses utilitas dokumen'
      case 'register':
        return 'Buat akun untuk akses penuh utilitas dokumen Satukit'
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
          {mode === 'login' && loginStep === 2 && challengeData ? (
            /* --- TAHAP 2: SOAL MATEMATIKA ANTI-BOT --- */
            <form onSubmit={handleChallengeSubmit} className="p-6 space-y-5" data-testid="form-step-2">
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-3xs font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                      Tahap 1: Kredensial Benar
                    </p>
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate" title={email}>
                      {email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLoginStep(1)
                    setErrorMessage(null)
                  }}
                  className="text-3xs font-bold text-emerald-800 dark:text-emerald-300 hover:underline cursor-pointer ml-2 shrink-0"
                >
                  Ubah
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
