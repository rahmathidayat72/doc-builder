import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Download,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Film,
  Image as ImageIcon,
  ShieldCheck,
  RefreshCw,
  Info,
} from 'lucide-react'
import {
  createMediaDownloadJob,
  getMediaDownloadStatus,
  cancelMediaDownloadJob,
  downloadMediaFile,
  type MediaDownloadJobStatus,
} from '../../services/mediaDownloader'

interface MediaDownloaderModalProps {
  isOpen: boolean
  onClose: () => void
}

export const MediaDownloaderModal: React.FC<MediaDownloaderModalProps> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState('')
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)

  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<MediaDownloadJobStatus | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasDownloaded, setHasDownloaded] = useState(false)

  const pollTimerRef = useRef<number | null>(null)

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      clearPolling()
      setUrl('')
      setMediaType('video')
      setRightsConfirmed(false)
      setActiveJobId(null)
      setJobStatus(null)
      setIsSubmitting(false)
      setIsDownloading(false)
      setErrorMessage(null)
      setHasDownloaded(false)
    }
    return () => {
      clearPolling()
    }
  }, [isOpen, clearPolling])

  const pollJob = useCallback(
    async (jobId: string) => {
      const res = await getMediaDownloadStatus(jobId)
      if (res.success && res.data) {
        setJobStatus(res.data)
        if (
          res.data.status === 'succeeded' ||
          res.data.status === 'failed' ||
          res.data.status === 'cancelled' ||
          res.data.status === 'expired'
        ) {
          clearPolling()
          if (res.data.status === 'failed') {
            setErrorMessage(res.data.error_message || 'Gagal mengunduh media dari platform sumber.')
          }
        }
      } else {
        clearPolling()
        if (res.error) setErrorMessage(res.error)
      }
    },
    [clearPolling]
  )

  useEffect(() => {
    if (activeJobId && !['succeeded', 'failed', 'cancelled', 'expired'].includes(jobStatus?.status || '')) {
      clearPolling()
      pollTimerRef.current = window.setInterval(() => {
        pollJob(activeJobId)
      }, 2000)
    }
    return () => clearPolling()
  }, [activeJobId, jobStatus?.status, pollJob, clearPolling])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const cleanUrl = url.trim()
    if (!cleanUrl) {
      setErrorMessage('URL media wajib diisi.')
      return
    }

    if (!cleanUrl.startsWith('https://')) {
      setErrorMessage('Hanya skema tautan publik https:// yang diizinkan.')
      return
    }

    if (!rightsConfirmed) {
      setErrorMessage('Anda wajib menyetujui pernyataan izin/kepemilikan hak cipta.')
      return
    }

    setIsSubmitting(true)
    setHasDownloaded(false)
    try {
      const res = await createMediaDownloadJob(cleanUrl, mediaType, rightsConfirmed)
      if (res.success && res.data) {
        setActiveJobId(res.data.job_id)
        setJobStatus({
          id: res.data.job_id,
          platform: res.data.platform as any,
          media_type: res.data.media_type as any,
          status: 'queued',
          progress_percent: 0,
          filename: null,
          file_size_bytes: 0,
          error_message: null,
          error_code: null,
          created_at: res.data.created_at,
          completed_at: null,
          expires_at: null,
          download_url: null,
        })
        // Segera ambil status awal
        pollJob(res.data.job_id)
      } else {
        setErrorMessage(res.error || 'Gagal memproses permintaan unduhan.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!activeJobId) return
    clearPolling()
    await cancelMediaDownloadJob(activeJobId)
    setActiveJobId(null)
    setJobStatus(null)
    setErrorMessage('Proses unduhan berhasil dibatalkan.')
  }

  const handleDownloadFile = async () => {
    if (!activeJobId || !jobStatus?.filename) return
    setIsDownloading(true)
    setErrorMessage(null)
    try {
      await downloadMediaFile(activeJobId, jobStatus.filename)
      setHasDownloaded(true)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal mengunduh berkas.')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleReset = () => {
    clearPolling()
    setActiveJobId(null)
    setJobStatus(null)
    setUrl('')
    setRightsConfirmed(false)
    setErrorMessage(null)
    setHasDownloaded(false)
  }

  const isBusy = isSubmitting || jobStatus?.status === 'queued' || jobStatus?.status === 'running'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-downloader-title"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 bg-[#f8fcfb] dark:bg-stone-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 id="media-downloader-title" className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
                Pengunduh Media Publik
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                YouTube, Instagram, dan TikTok • Video MP4 maks 720p &amp; Gambar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Platform Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">Platform didukung:</span>
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
              YouTube (Video/Shorts)
            </span>
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 border border-pink-200 dark:border-pink-900/50">
              Instagram (Reel/Post)
            </span>
            <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700">
              TikTok (Video/Foto)
            </span>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-2.5 animate-shake"
              role="alert"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {!activeJobId || jobStatus?.status === 'failed' || jobStatus?.status === 'cancelled' ? (
            /* Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="media-url" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Tautan Konten Publik (HTTPS)
                </label>
                <input
                  id="media-url"
                  data-testid="input-media-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... atau https://www.instagram.com/p/... atau TikTok"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-teal-700 dark:focus:ring-teal-500 placeholder:text-stone-400"
                  required
                />
              </div>

              {/* Media Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
                  Format Keluaran Media
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    data-testid="btn-type-video"
                    onClick={() => setMediaType('video')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${
                      mediaType === 'video'
                        ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-200'
                        : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <Film className="w-4 h-4" />
                    <span>Video MP4 (maks 720p)</span>
                  </button>
                  <button
                    type="button"
                    data-testid="btn-type-image"
                    onClick={() => setMediaType('image')}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${
                      mediaType === 'image'
                        ? 'border-teal-700 bg-teal-50 text-teal-900 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-200'
                        : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Gambar / Foto Publik</span>
                  </button>
                </div>
              </div>

              {/* Rights confirmation checkbox */}
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/60">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="checkbox-rights"
                    checked={rightsConfirmed}
                    onChange={(e) => setRightsConfirmed(e.target.checked)}
                    className="mt-0.5 rounded text-teal-700 focus:ring-teal-700"
                    required
                  />
                  <span className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                    Saya menyatakan bahwa konten yang diunduh adalah milik saya, berlisensi terbuka, atau saya telah
                    memiliki izin sah dari pemilik hak cipta untuk mengunduh media ini untuk keperluan pribadi.
                  </span>
                </label>
              </div>

              {/* Policy notes */}
              <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/40 text-xs text-teal-900 dark:text-teal-200/90 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-teal-800 dark:text-teal-300">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Ketentuan &amp; Batasan Sistem:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1 opacity-90">
                  <li>Hanya 1 tautan per proses (playlist, channel, profil, dan feed ditolak).</li>
                  <li>Batas ukuran video 250 MB &amp; durasi maks 30 menit tanpa transcoding CPU.</li>
                  <li>Konten live stream dan siaran premiere ditolak.</li>
                  <li>Batas frekuensi: 3 proses/jam dan kuota 1 GB/hari per pengguna &amp; IP.</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  data-testid="btn-submit-media"
                  disabled={isSubmitting || !url.trim() || !rightsConfirmed}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-teal-800 hover:bg-teal-700 text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mendaftarkan...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Proses Unduhan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Progress / Result Display */
            <div className="space-y-4">
              {jobStatus?.status === 'queued' && (
                <div className="p-6 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-700 dark:text-teal-400" />
                  <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                    Menunggu Giliran Antrean...
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                    Server membatasi 1 pemrosesan media secara bersamaan untuk menjaga keandalan sistem. Mohon jangan menutup jendela ini.
                  </p>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/50 transition-colors"
                  >
                    Batalkan Antrean
                  </button>
                </div>
              )}

              {jobStatus?.status === 'running' && (
                <div className="p-6 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/60 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-800 dark:text-teal-400" />
                  <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                    Sedang Mengunduh &amp; Memverifikasi Media...
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                    Mengekstrak stream MP4 (maks 720p) atau citra publik tanpa transcoding CPU. Proses berlangsung maksimal beberapa menit.
                  </p>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/50 transition-colors"
                  >
                    Batalkan Proses
                  </button>
                </div>
              )}

              {jobStatus?.status === 'succeeded' && (
                <div className="p-6 rounded-2xl bg-teal-50/40 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/50 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-300 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base">
                        Media Siap Diunduh!
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        Berkas telah diekstrak dan siap disimpan ke perangkat Anda.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-stone-500 dark:text-stone-400">Nama berkas:</span>
                      <span className="font-semibold text-stone-800 dark:text-stone-200 truncate max-w-[240px]">
                        {jobStatus.filename || 'media.bin'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500 dark:text-stone-400">Ukuran berkas:</span>
                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                        {(jobStatus.file_size_bytes / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500 dark:text-stone-400">Masa berlaku tautan:</span>
                      <span className="font-semibold text-stone-800 dark:text-stone-200">15 menit (Single-Use Delivery)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                    <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span>Untuk menjaga privasi dan ruang disk server, berkas otomatis dibersihkan setelah Anda unduh.</span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Unduh Media Lain</span>
                    </button>

                    <button
                      type="button"
                      data-testid="btn-download-media-file"
                      onClick={handleDownloadFile}
                      disabled={isDownloading || hasDownloaded}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-teal-800 hover:bg-teal-700 text-white shadow-xs transition-colors disabled:opacity-50"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Mengirim Berkas...</span>
                        </>
                      ) : hasDownloaded ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Berkas Telah Diunduh</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Unduh Berkas Sekarang</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
