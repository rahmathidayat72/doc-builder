import React, { useState, useEffect } from 'react'
import {
  Unlock,
  Shield,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Eye,
  EyeOff,
  FileText,
  Info,
  Check,
} from 'lucide-react'
import { protectPdf, unlockPdf, type PdfToolResult } from '../../services/pdfTools'

export type SecurityTab = 'unlock' | 'protect'

interface PdfSecurityModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: SecurityTab
}

export const PdfSecurityModal: React.FC<PdfSecurityModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'unlock',
}) => {
  const [activeTab, setActiveTab] = useState<SecurityTab>(initialTab)
  const [file, setFile] = useState<File | null>(null)

  // Passwords
  const [unlockPassword, setUnlockPassword] = useState('')
  const [showUnlockPassword, setShowUnlockPassword] = useState(false)

  const [protectPassword, setProtectPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showProtectPassword, setShowProtectPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const resetForm = () => {
    setFile(null)
    setUnlockPassword('')
    setProtectPassword('')
    setConfirmPassword('')
    setShowUnlockPassword(false)
    setShowProtectPassword(false)
    setShowConfirmPassword(false)
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsLoading(false)
  }

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      resetForm()
    }
  }, [isOpen, initialTab])

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleTabChange = (tab: SecurityTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      if (!selected.name.toLowerCase().endsWith('.pdf')) {
        setErrorMessage('Hanya berkas dokumen PDF (.pdf) yang didukung.')
        return
      }
      if (selected.size > 25 * 1024 * 1024) {
        setErrorMessage('Ukuran berkas melebihi batas maksimal 25 MB.')
        return
      }
      setFile(selected)
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }

  // Validasi kekuatan password protect
  const pwBytes = new TextEncoder().encode(protectPassword).length
  const hasMinLength = pwBytes >= 12
  const hasMaxLength = pwBytes <= 40
  const hasUpper = /[A-Z]/.test(protectPassword)
  const hasLower = /[a-z]/.test(protectPassword)
  const hasDigit = /[0-9]/.test(protectPassword)
  const hasSymbol = /[^a-zA-Z0-9\s]/.test(protectPassword)
  const isMatch = protectPassword !== '' && protectPassword === confirmPassword

  const isProtectValid =
    hasMinLength &&
    hasMaxLength &&
    hasUpper &&
    hasLower &&
    hasDigit &&
    hasSymbol &&
    isMatch

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setErrorMessage('Pilih berkas PDF terenkripsi terlebih dahulu.')
      return
    }
    if (!unlockPassword.trim()) {
      setErrorMessage('Masukkan password untuk membuka dokumen PDF.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const res: PdfToolResult = await unlockPdf(file, unlockPassword)
    setIsLoading(false)

    if (res.success) {
      setSuccessMessage(`Berhasil membuka proteksi PDF: ${res.filename}`)
    } else {
      setErrorMessage(res.message || 'Gagal membuka proteksi PDF.')
    }
  }

  const handleProtectSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setErrorMessage('Pilih berkas PDF terlebih dahulu.')
      return
    }
    if (!isProtectValid) {
      setErrorMessage('Pastikan seluruh kriteria password terpenuhi dan konfirmasi cocok.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const res: PdfToolResult = await protectPdf(file, protectPassword)
    setIsLoading(false)

    if (res.success) {
      setSuccessMessage(`Berhasil memproteksi PDF dengan enkripsi AES-256: ${res.filename}`)
    } else {
      setErrorMessage(res.message || 'Gagal memproteksi PDF.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modal Keamanan PDF (Unlock & Protect)"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-overlay-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 border border-slate-200 animate-fade-in max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${activeTab === 'unlock' ? 'bg-sky-50 text-sky-600' : 'bg-indigo-50 text-indigo-600'}`}>
              {activeTab === 'unlock' ? <Unlock className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {activeTab === 'unlock' ? 'Unlock PDF' : 'Protect PDF'}
              </h3>
              <p className="text-xs text-slate-500">
                {activeTab === 'unlock'
                  ? 'Hapus proteksi password dokumen PDF secara lokal & aman.'
                  : 'Enkripsi berkas PDF dengan password AES-256 kuat.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal Keamanan PDF"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition"
            data-testid="btn-close-pdf-security"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tab Control */}
        <div className="flex p-1 bg-slate-100 rounded-xl" role="tablist" aria-label="Pilih Mode Keamanan PDF">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'unlock'}
            onClick={() => handleTabChange('unlock')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'unlock'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-unlock"
          >
            <Unlock className="w-4 h-4" />
            <span>Unlock PDF</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'protect'}
            onClick={() => handleTabChange('protect')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'protect'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="tab-protect"
          >
            <Shield className="w-4 h-4" />
            <span>Protect PDF</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {/* File Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Berkas PDF
            </label>
            {!file ? (
              <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/60 hover:bg-indigo-50/20 text-center">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-full">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Pilih berkas PDF ({activeTab === 'unlock' ? 'terenkripsi password' : 'yang ingin diproteksi'})
                  </span>
                  <span className="text-3xs text-slate-400 block mt-0.5">
                    Maksimum ukuran 25 MB • Pemrosesan 100% lokal di perangkat Anda
                  </span>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  aria-label="Pilih berkas PDF"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="input-security-file"
                />
              </label>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-indigo-600 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-slate-800 truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-3xs text-slate-500">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-xs font-semibold text-slate-600 hover:text-rose-600 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 transition shrink-0"
                  data-testid="btn-change-file"
                >
                  Ganti
                </button>
              </div>
            )}
          </div>

          {/* Tab Specific Password Controls */}
          {activeTab === 'unlock' ? (
            <form onSubmit={handleUnlockSubmit} className="space-y-4" data-testid="form-unlock">
              <div>
                <label
                  htmlFor="input-unlock-password"
                  className="block text-xs font-bold text-slate-700 mb-1"
                >
                  Password Pembuka PDF
                </label>
                <div className="relative">
                  <input
                    id="input-unlock-password"
                    type={showUnlockPassword ? 'text' : 'password'}
                    value={unlockPassword}
                    onChange={e => setUnlockPassword(e.target.value)}
                    placeholder="Masukkan password dokumen..."
                    autoComplete="current-password"
                    aria-label="Password pembuka PDF"
                    className="w-full p-2.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition"
                    data-testid="input-unlock-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPassword(prev => !prev)}
                    aria-label={showUnlockPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-md"
                    data-testid="btn-toggle-unlock-password"
                  >
                    {showUnlockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-3xs text-slate-400 mt-1">
                  Masukkan password yang sah untuk mendekripsi isi dokumen dan mengunduh salinan bebas proteksi.
                </p>
              </div>

              {/* Informational Disclaimer */}
              <div className="p-3 bg-sky-50/70 border border-sky-200/80 rounded-xl flex items-start gap-2 text-xs text-sky-900">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <span className="text-2xs leading-relaxed">
                  <strong>Privasi Terjamin:</strong> Proses dekripsi berlangsung sepenuhnya di komputer Anda. Password tidak dikirim ke internet, tidak disimpan, dan tidak dicatat ke log sistem.
                </span>
              </div>

              {/* Alerts */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700" data-testid="alert-error">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-700" data-testid="alert-success">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !file || !unlockPassword.trim()}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                data-testid="btn-submit-unlock"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Membuka Proteksi PDF...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Buka Proteksi PDF</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleProtectSubmit} className="space-y-4" data-testid="form-protect">
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="input-protect-password"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Password Baru
                  </label>
                  <div className="relative">
                    <input
                      id="input-protect-password"
                      type={showProtectPassword ? 'text' : 'password'}
                      value={protectPassword}
                      onChange={e => setProtectPassword(e.target.value)}
                      placeholder="Masukkan password pengunci (12-40 karakter)..."
                      autoComplete="new-password"
                      aria-label="Password baru untuk memproteksi PDF"
                      className="w-full p-2.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                      data-testid="input-protect-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowProtectPassword(prev => !prev)}
                      aria-label={showProtectPassword ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-md"
                      data-testid="btn-toggle-protect-password"
                    >
                      {showProtectPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="input-confirm-password"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    Konfirmasi Password
                  </label>
                  <div className="relative">
                    <input
                      id="input-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Ketik ulang password untuk konfirmasi..."
                      autoComplete="new-password"
                      aria-label="Konfirmasi password baru"
                      className="w-full p-2.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                      data-testid="input-confirm-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(prev => !prev)}
                      aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-md"
                      data-testid="btn-toggle-confirm-password"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Strength Checklist */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-2xs text-slate-600" data-testid="checklist-password-strength">
                <span className="font-bold text-slate-700 block mb-1">Kriteria Password Kuat (AES-256):</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className={`flex items-center gap-1.5 ${hasMinLength && hasMaxLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-3xs ${hasMinLength && hasMaxLength ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                      <Check className="w-2.5 h-2.5" />
                    </span>
                    <span>12 - 40 byte ({pwBytes}/40 byte)</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${hasUpper && hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-3xs ${hasUpper && hasLower ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                      <Check className="w-2.5 h-2.5" />
                    </span>
                    <span>Huruf besar & huruf kecil</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${hasDigit ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-3xs ${hasDigit ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                      <Check className="w-2.5 h-2.5" />
                    </span>
                    <span>Minimal 1 angka (0-9)</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${hasSymbol ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-3xs ${hasSymbol ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                      <Check className="w-2.5 h-2.5" />
                    </span>
                    <span>Minimal 1 simbol / tanda baca</span>
                  </div>
                </div>

                <div className={`flex items-center gap-1.5 pt-1 border-t border-slate-200/80 ${isMatch ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-3xs ${isMatch ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  <span>Konfirmasi password cocok</span>
                </div>
              </div>

              {/* Informational Disclaimer */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-start gap-2 text-xs text-indigo-900">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span className="text-2xs leading-relaxed">
                  <strong>Penting:</strong> Dokumen dienkripsi dengan standar AES-256. Simpan password Anda di tempat aman. Tidak ada backdoor atau pemulihan darurat jika Anda lupa password.
                </span>
              </div>

              {/* Alerts */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700" data-testid="alert-error">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-700" data-testid="alert-success">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !file || !isProtectValid}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                data-testid="btn-submit-protect"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menerapkan Enkripsi AES-256...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Proteksi PDF dengan Password</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
