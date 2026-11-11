import React, { useState, useEffect } from 'react'
import {
  X,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Clock,
} from 'lucide-react'
import {
  createShortUrl,
  getLocalShortenedLinks,
  getShortenerConfig,
  type ShortenedLinkItem,
} from '../../services/shortener'
import { KituNotice } from '../brand/KituNotice'

interface UrlShortenerModalProps {
  isOpen: boolean
  onClose: () => void
}

export const UrlShortenerModal: React.FC<UrlShortenerModalProps> = ({ isOpen, onClose }) => {
  const [destinationUrl, setDestinationUrl] = useState('')
  const [customSlug, setCustomSlug] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [createdResult, setCreatedResult] = useState<{ short_url: string; slug: string } | null>(
    null
  )
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<ShortenedLinkItem[]>([])
  const [adminUrl, setAdminUrl] = useState('https://s.docbuilder.local/admin')

  useEffect(() => {
    let isMounted = true
    if (isOpen) {
      setHistory(getLocalShortenedLinks())
      setErrorMessage(null)
      setCreatedResult(null)
      getShortenerConfig().then((cfg) => {
        if (isMounted && cfg && cfg.adminPortalUrl) {
          setAdminUrl(cfg.adminPortalUrl)
        }
      }).catch(() => {})
    }
    return () => {
      isMounted = false
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleGenerateRandomSlug = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let res = ''
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCustomSlug(res)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setCreatedResult(null)

    const trimmedDest = destinationUrl.trim()
    if (!trimmedDest) {
      setErrorMessage('URL tujuan wajib diisi.')
      return
    }

    if (!trimmedDest.startsWith('https://')) {
      setErrorMessage('Hanya skema HTTPS publik yang diizinkan (NFR-SEC-008 Anti-SSRF).')
      return
    }

    setIsLoading(true)
    try {
      const res = await createShortUrl(trimmedDest, customSlug.trim() || undefined)
      if (res.success) {
        setCreatedResult({ short_url: res.short_url, slug: res.slug })
        setDestinationUrl('')
        setCustomSlug('')
        setHistory(getLocalShortenedLinks())
      } else {
        setErrorMessage(res.error || 'Gagal memendekkan tautan.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortener-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-white border border-stone-200 rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4.5 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
              <Link2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="shortener-modal-title" className="text-lg font-bold text-stone-900 leading-tight">
                Pemendek URL Mandiri
              </h2>
              <p className="text-xs text-stone-600">
                Layanan pengalihan edge Cloudflare Workers berlatensi rendah (&le; 100 ms)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-200/60 transition-colors"
            aria-label="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Isi Modal */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Form Pembuatan */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="input-dest-url" className="block text-sm font-semibold text-stone-800 mb-1.5">
                URL Tujuan Panjang <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  id="input-dest-url"
                  type="url"
                  placeholder="https://porto.rahmath72.cloud/cv-2026 atau dokumen publik"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  disabled={isLoading}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20 text-sm text-stone-900 bg-white outline-hidden transition-all placeholder:text-stone-400"
                />
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Wajib diawali dengan <code className="font-mono text-teal-800 bg-teal-50 px-1 py-0.5 rounded">https://</code> publik. Dilindungi filter Anti-SSRF.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="input-custom-slug" className="block text-sm font-semibold text-stone-800 mb-1.5">
                  Slug Kustom (Opsional)
                </label>
                <div className="flex gap-2">
                  <input
                    id="input-custom-slug"
                    type="text"
                    placeholder="misal: cv-rahmat"
                    pattern="[a-zA-Z0-9_-]{1,100}"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20 text-sm font-mono text-stone-900 bg-white outline-hidden transition-all placeholder:text-stone-400"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateRandomSlug}
                    disabled={isLoading}
                    title="Buat slug acak otomatis"
                    className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl border border-stone-300 transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                    <span>Acak</span>
                  </button>
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isLoading || !destinationUrl.trim()}
                  className="w-full h-[42px] bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span>Memproses...</span>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      <span>Buat Tautan Pendek</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Alert Error */}
          {errorMessage && (
            <KituNotice tone="error" expression="bingung" title="Kendala Tautan">
              <span>{errorMessage}</span>
            </KituNotice>
          )}

          {/* Kartu Hasil URL Pendek */}
          {createdResult && (
            <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  Tautan Pendek Siap Digunakan
                </span>
                <span className="text-xs text-teal-800 font-medium">HTTP 302 Edge Redirect</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdResult.short_url}
                  className="flex-1 px-3.5 py-2 bg-white border border-teal-300 rounded-lg text-sm font-mono text-teal-950 font-semibold select-all"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(createdResult.short_url)}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                  <a
                    href={createdResult.short_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-white hover:bg-stone-50 border border-teal-300 text-teal-900 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                    title="Uji buka tautan di tab baru"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Uji</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Riwayat Tautan Sesi Pengguna */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                Riwayat Tautan Sesi Ini ({history.length})
              </h3>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                <p className="text-xs text-stone-500">Belum ada tautan pendek yang dibuat pada sesi ini.</p>
              </div>
            ) : (
              <div className="border border-stone-200 rounded-xl divide-y divide-stone-100 max-h-48 overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-stone-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-800">/{item.slug}</span>
                        <span className="text-[11px] text-stone-400">
                          {new Date(item.created_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 truncate" title={item.destination_url}>
                        {item.destination_url}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.short_url)}
                      className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-900 border border-stone-200 hover:border-stone-300 rounded-md bg-white transition-colors flex items-center gap-1 shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Modal dengan Link Admin Zero Trust */}
        <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50/80 flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Cloudflare Workers + D1 Serverless</span>
          </div>
          <a
            href={adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-800 hover:text-teal-950 font-semibold flex items-center gap-1 hover:underline"
          >
            <span>Portal Admin Zero Trust</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
