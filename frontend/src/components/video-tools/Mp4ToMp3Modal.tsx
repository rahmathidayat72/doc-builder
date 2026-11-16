import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Music,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  VIDEO_COMPRESSION_POLL_INTERVAL_MS,
  VideoCompressionApiError,
  cancelVideoCompressionJob,
  downloadCompressedVideo,
  formatVideoBytes,
  getVideoCompressionJob,
  uploadMp4ToMp3Stream,
  validateMp4AudioClientFile,
  type Mp3AudioPreset,
  type VideoCompressionJob,
} from '../../services/videoCompression'
import { KituNotice } from '../brand/KituNotice'

interface Mp4ToMp3ModalProps {
  isOpen: boolean
  onClose: () => void
}

interface AudioPresetOption {
  id: Mp3AudioPreset
  name: string
  badge: string
  specs: string
  desc: string
}

const AUDIO_PRESET_OPTIONS: readonly AudioPresetOption[] = [
  {
    id: '128k',
    name: '128 kbps',
    badge: 'Hemat Kuota',
    specs: 'CBR 128 kbps • Stereo',
    desc: 'Ukuran berkas terkecil, ideal untuk rekaman suara, podcast santai, atau presentasi.',
  },
  {
    id: '192k',
    name: '192 kbps',
    badge: 'Rekomendasi',
    specs: 'CBR 192 kbps • Stereo',
    desc: 'Keseimbangan audio standar terbaik untuk musik, ceramah, dan video umum.',
  },
  {
    id: '320k',
    name: '320 kbps',
    badge: 'Kualitas Studio',
    specs: 'CBR 320 kbps • Stereo',
    desc: 'Detail audio frekuensi penuh tanpa kompromi untuk kualitas studio & audiophile.',
  },
]

const ACTIVE_WORKER_STATUSES = new Set(['queued', 'scanning', 'probing', 'encoding'])
const TERMINAL_STATUSES = new Set(['succeeded', 'claimed', 'failed', 'cancelled', 'expired'])

const STAGE_COPY: Record<
  string,
  { title: string; subtitle: string; stepLabel: string }
> = {
  queued: {
    title: 'Menunggu Giliran Antrean...',
    subtitle: 'Server memproses 1 tugas antrean sekaligus agar layanan tetap stabil.',
    stepLabel: 'Tahap 1/4: Antrean Server',
  },
  scanning: {
    title: 'Memindai Keamanan Berkas...',
    subtitle: 'Memeriksa integritas dan keamanan berkas MP4 dengan antivirus sebelum diproses.',
    stepLabel: 'Tahap 2/4: Pemindaian Antivirus',
  },
  probing: {
    title: 'Memeriksa Aliran Audio...',
    subtitle: 'Memvalidasi keberadaan stream audio, format MP4, dan durasi maksimal 10 menit.',
    stepLabel: 'Tahap 3/4: Inspeksi Stream Audio',
  },
  encoding: {
    title: 'Mengekstrak Audio MP3 (libmp3lame)...',
    subtitle: 'Mengonversi audio ke MP3 CBR, auto-downmix stereo, dan menghapus cover art & metadata.',
    stepLabel: 'Tahap 4/4: Ekstraksi MP3',
  },
}

export const Mp4ToMp3Modal: React.FC<Mp4ToMp3ModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null
  return <Mp4ToMp3DialogContent onClose={onClose} />
}

const Mp4ToMp3DialogContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preset, setPreset] = useState<Mp3AudioPreset>('192k')
  const [ownerConfirmed, setOwnerConfirmed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [job, setJob] = useState<VideoCompressionJob | null>(null)

  const [isCancelling, setIsCancelling] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [hasDownloaded, setHasDownloaded] = useState(false)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const pollInFlightRef = useRef(false)
  const isMountedRef = useRef(true)

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const isWorkerBusy = Boolean(job && ACTIVE_WORKER_STATUSES.has(job.status))
  const isBusy = isUploading || isWorkerBusy || isCancelling

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      clearPolling()
      abortControllerRef.current?.abort()
    }
  }, [clearPolling])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy && !isDownloading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isBusy, isDownloading, onClose])

  const pollJobStatus = useCallback(
    async (jobId: string) => {
      if (pollInFlightRef.current || !isMountedRef.current) return
      pollInFlightRef.current = true
      try {
        const latest = await getVideoCompressionJob(jobId)
        if (!isMountedRef.current) return
        setJob(latest)

        if (TERMINAL_STATUSES.has(latest.status)) {
          clearPolling()
          if (latest.status === 'failed') {
            if (latest.error_code === 'NO_AUDIO_STREAM') {
              setErrorMessage('Berkas MP4 tidak mengandung aliran audio untuk diekstrak.')
            } else {
              setErrorMessage(
                latest.error_message || 'Ekstraksi audio MP3 gagal diproses oleh server.'
              )
            }
          } else if (latest.status === 'expired') {
            setErrorMessage(
              'Masa berlaku berkas hasil ekstraksi (15 menit) telah habis. Silakan unggah ulang.'
            )
          } else if (latest.status === 'cancelled') {
            setInfoMessage('Tugas ekstraksi audio telah dibatalkan.')
          }
        }
      } catch (err) {
        if (!isMountedRef.current) return
        clearPolling()
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Koneksi terputus saat memantau progres ekstraksi audio.'
        )
      } finally {
        pollInFlightRef.current = false
      }
    },
    [clearPolling]
  )

  useEffect(() => {
    if (job && ACTIVE_WORKER_STATUSES.has(job.status)) {
      clearPolling()
      pollTimerRef.current = window.setInterval(() => {
        void pollJobStatus(job.id)
      }, VIDEO_COMPRESSION_POLL_INTERVAL_MS)
    } else {
      clearPolling()
    }
    return () => clearPolling()
  }, [job, clearPolling, pollJobStatus])

  const handleSelectFile = (file: File | null) => {
    setErrorMessage(null)
    setInfoMessage(null)
    setHasDownloaded(false)
    if (job && TERMINAL_STATUSES.has(job.status)) {
      setJob(null)
    }

    if (!file) {
      setSelectedFile(null)
      return
    }

    const validationError = validateMp4AudioClientFile(file)
    if (validationError) {
      setSelectedFile(null)
      setErrorMessage(validationError)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }
    setSelectedFile(file)
  }

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (isBusy) return
    const droppedFile = event.dataTransfer.files?.[0] || null
    handleSelectFile(droppedFile)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)
    setHasDownloaded(false)

    const validationError = validateMp4AudioClientFile(selectedFile)
    if (validationError || !selectedFile) {
      setErrorMessage(validationError || 'Pilih berkas video MP4 terlebih dahulu.')
      return
    }

    if (!ownerConfirmed) {
      setErrorMessage('Konfirmasi kepemilikan atau hak penggunaan audio wajib dicentang.')
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsUploading(true)
    setUploadPercent(0)
    setJob(null)

    try {
      const queuedJob = await uploadMp4ToMp3Stream(selectedFile, preset, ownerConfirmed, {
        onProgress: (percent) => {
          if (isMountedRef.current) setUploadPercent(percent)
        },
        signal: controller.signal,
      })
      if (!isMountedRef.current) return
      setJob(queuedJob)
      setUploadPercent(100)
      void pollJobStatus(queuedJob.id)
    } catch (err) {
      if (!isMountedRef.current) return
      if (err instanceof Error && err.name === 'AbortError') {
        setInfoMessage('Unggahan video dibatalkan.')
      } else if (err instanceof VideoCompressionApiError && err.retryAfterSeconds) {
        setErrorMessage(`${err.message} Coba lagi dalam sekitar ${err.retryAfterSeconds} detik.`)
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : 'Gagal mengunggah berkas MP4 ke server.'
        )
      }
    } finally {
      if (isMountedRef.current) {
        setIsUploading(false)
      }
      abortControllerRef.current = null
    }
  }

  const handleCancelUpload = () => {
    abortControllerRef.current?.abort()
  }

  const handleCancelJob = async () => {
    if (!job || !ACTIVE_WORKER_STATUSES.has(job.status)) return
    setIsCancelling(true)
    setErrorMessage(null)
    clearPolling()
    try {
      const cancelled = await cancelVideoCompressionJob(job.id)
      if (!isMountedRef.current) return
      setJob(cancelled)
      setInfoMessage('Ekstraksi audio MP3 berhasil dibatalkan.')
    } catch (err) {
      if (!isMountedRef.current) return
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal membatalkan tugas ekstraksi audio.'
      )
      if (ACTIVE_WORKER_STATUSES.has(job.status)) {
        void pollJobStatus(job.id)
      }
    } finally {
      if (isMountedRef.current) {
        setIsCancelling(false)
      }
    }
  }

  const handleDownload = async () => {
    if (!job || job.status !== 'succeeded' || isDownloading || hasDownloaded) return
    setIsDownloading(true)
    setErrorMessage(null)
    try {
      await downloadCompressedVideo(job.id, job.output_filename || 'audio.mp3')
      if (!isMountedRef.current) return
      setHasDownloaded(true)
      setJob((prev) => (prev ? { ...prev, status: 'claimed', download_url: null } : prev))
    } catch (err) {
      if (!isMountedRef.current) return
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal mengunduh berkas audio MP3 hasil ekstraksi.'
      )
      if (err instanceof VideoCompressionApiError && (err.status === 409 || err.status === 410)) {
        setJob((prev) =>
          prev
            ? {
                ...prev,
                status: err.status === 410 ? 'expired' : 'claimed',
                download_url: null,
              }
            : prev
        )
      }
    } finally {
      if (isMountedRef.current) {
        setIsDownloading(false)
      }
    }
  }

  const handleReset = () => {
    clearPolling()
    abortControllerRef.current?.abort()
    setSelectedFile(null)
    setPreset('192k')
    setOwnerConfirmed(false)
    setIsUploading(false)
    setUploadPercent(0)
    setJob(null)
    setIsCancelling(false)
    setIsDownloading(false)
    setHasDownloaded(false)
    setErrorMessage(null)
    setInfoMessage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const showForm =
    !isUploading &&
    (!job || job.status === 'failed' || job.status === 'cancelled' || job.status === 'expired')

  const showSuccess =
    !isUploading &&
    job !== null &&
    (job.status === 'succeeded' || (job.status === 'claimed' && hasDownloaded))

  const activeStage = job ? STAGE_COPY[job.status] || STAGE_COPY.queued : STAGE_COPY.queued
  const workerProgress = Math.min(100, Math.max(0, Math.round(job?.progress_percent ?? 0)))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mp4-to-mp3-title"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800 bg-[#f8fcfb] dark:bg-stone-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200/70 dark:border-teal-800 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="mp4-to-mp3-title"
                className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 truncate"
              >
                MP4 ke MP3
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Berkas MP4 (maks 250 MB / 10 menit) • Ekstraksi MP3 (128k, 192k, 320k) tanpa metadata &amp; cover art
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy || isDownloading}
            data-testid="btn-close-mp4-to-mp3"
            aria-label="Tutup modal MP4 ke MP3"
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Error Banner */}
          {errorMessage && (
            <KituNotice
              tone="error"
              expression="sedih"
              title="Kendala Ekstraksi Audio"
              role="alert"
              data-testid="notice-audio-error"
            >
              <span>{errorMessage}</span>
            </KituNotice>
          )}

          {/* Info Banner */}
          {infoMessage && !errorMessage && (
            <KituNotice
              tone="info"
              expression="ide"
              title="Informasi Proses"
              role="status"
              data-testid="notice-audio-info"
            >
              <span>{infoMessage}</span>
            </KituNotice>
          )}

          {/* Form State */}
          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* File Dropzone */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                    Pilih Berkas MP4 Lokal
                  </span>
                  {selectedFile && (
                    <button
                      type="button"
                      onClick={() => handleSelectFile(null)}
                      data-testid="btn-clear-audio-file"
                      className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus pilihan</span>
                    </button>
                  )}
                </div>

                <label
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-center transition cursor-pointer focus-within:ring-2 focus-within:ring-teal-700 dark:focus-within:ring-teal-400 ${
                    isDragging || selectedFile
                      ? 'border-teal-700 bg-teal-50/40 dark:border-teal-500 dark:bg-teal-950/20'
                      : 'border-stone-300 dark:border-stone-700 bg-stone-50/70 dark:bg-stone-800/40 hover:border-teal-700 dark:hover:border-teal-500'
                  }`}
                >
                  <Upload className="w-7 h-7 text-teal-800 dark:text-teal-400" />
                  <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 break-all max-w-full px-2">
                    {selectedFile ? selectedFile.name : 'Klik atau seret berkas MP4 ke sini'}
                  </span>
                  <span className="text-xs text-stone-600 dark:text-stone-400">
                    {selectedFile
                      ? `${formatVideoBytes(selectedFile.size)} • Klik untuk mengganti berkas`
                      : 'Hanya format .mp4 • Maksimal 250 MB (250.000.000 byte)'}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp4,video/mp4"
                    aria-label="Pilih berkas video MP4"
                    data-testid="input-mp4-file"
                    className="sr-only"
                    onChange={(e) => {
                      const picked = e.target.files?.[0] || null
                      handleSelectFile(picked)
                    }}
                  />
                </label>
              </div>

              {/* Bitrate Preset Selector */}
              <div className="space-y-2">
                <div id="mp3-preset-label" className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                  Pilih Kualitas Bitrate MP3
                </div>
                <div
                  role="radiogroup"
                  aria-labelledby="mp3-preset-label"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  {AUDIO_PRESET_OPTIONS.map((opt) => {
                    const isSelected = preset === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        data-testid={`btn-audio-preset-${opt.id}`}
                        onClick={() => {
                          setPreset(opt.id)
                          setErrorMessage(null)
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'border-teal-700 bg-teal-50/70 dark:border-teal-400 dark:bg-teal-950/40 ring-1 ring-teal-700 dark:ring-teal-400'
                            : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/60 hover:border-teal-600/60 dark:hover:border-teal-500/60'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                              {opt.name}
                            </span>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                isSelected
                                  ? 'bg-teal-800 text-white dark:bg-teal-700'
                                  : 'bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-200'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-teal-900 dark:text-teal-300">
                            {opt.specs}
                          </div>
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                          {opt.desc}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Copyright Confirmation Checkbox */}
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex items-start gap-3">
                <input
                  id="mp4-mp3-copyright-consent"
                  type="checkbox"
                  checked={ownerConfirmed}
                  onChange={(e) => {
                    setOwnerConfirmed(e.target.checked)
                    setErrorMessage(null)
                  }}
                  data-testid="checkbox-copyright-confirm"
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-teal-800 focus:ring-teal-700 dark:border-stone-600 dark:focus:ring-teal-400 cursor-pointer"
                />
                <label
                  htmlFor="mp4-mp3-copyright-consent"
                  className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed cursor-pointer select-none"
                >
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    Konfirmasi Hak Cipta &amp; Izin Penggunaan:
                  </span>{' '}
                  Saya menyatakan bahwa video ini adalah milik saya atau saya memiliki hak/izin untuk mengekstrak audionya.
                </label>
              </div>

              {/* Policy Notes */}
              <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-900/50 text-xs text-teal-950 dark:text-teal-100 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-teal-900 dark:text-teal-300">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Ketentuan Ekstraksi Audio MP3:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1 opacity-90">
                  <li>Hanya berkas berekstensi .mp4 dengan durasi maksimal 10 menit (600 detik).</li>
                  <li>Video tanpa stream audio akan ditolak server secara otomatis.</li>
                  <li>Channel surround (&gt;2 ch) otomatis di-downmix ke stereo 2 channel tanpa metadata privasi.</li>
                  <li>Batas kuota bersama: 1 tugas aktif &amp; 3 tugas/jam per akun &amp; IP.</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="pt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  data-testid="btn-submit-mp4-to-mp3"
                  disabled={!selectedFile || !ownerConfirmed}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-teal-800 hover:bg-teal-900 text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Music className="w-4 h-4" />
                  <span>Ekstrak Audio MP3</span>
                </button>
              </div>
            </form>
          )}

          {/* Uploading State */}
          {isUploading && (
            <div
              className="p-6 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-center space-y-4"
              data-testid="audio-upload-progress-panel"
            >
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-800 dark:text-teal-400" />
              <div className="space-y-1" aria-live="polite">
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Mengunggah Berkas MP4... {uploadPercent}%
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Berkas dikirim ke server secara bertahap. Mohon tetap buka jendela ini hingga unggahan selesai.
                </p>
              </div>
              <div
                role="progressbar"
                aria-label="Progres unggahan berkas MP4"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadPercent}
                className="w-full h-2.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-teal-700 dark:bg-teal-400 transition-[width] duration-200"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
              <button
                type="button"
                onClick={handleCancelUpload}
                data-testid="btn-cancel-audio-upload"
                className="px-4 py-2 text-xs font-semibold rounded-lg text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
              >
                Batalkan Unggahan
              </button>
            </div>
          )}

          {/* Active Worker State */}
          {!isUploading && isWorkerBusy && job && (
            <div
              className="p-6 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-900/60 text-center space-y-4"
              data-testid="audio-worker-progress-panel"
            >
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-800 dark:text-teal-400" />
              <div className="space-y-1" aria-live="polite">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200">
                  {activeStage.stepLabel}
                </span>
                <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 pt-1">
                  {activeStage.title}
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 max-w-md mx-auto">
                  {activeStage.subtitle}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-stone-700 dark:text-stone-300">
                  <span>Progres Ekstraksi</span>
                  <span className="tabular-nums">{workerProgress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Progres pemrosesan ekstraksi audio MP3"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={workerProgress}
                  className="w-full h-2.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden"
                >
                  <div
                    className="h-full rounded-full bg-teal-700 dark:bg-teal-400 transition-[width] duration-300"
                    style={{ width: `${workerProgress}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelJob}
                disabled={isCancelling}
                data-testid="btn-cancel-audio-job"
                className="px-4 py-2 text-xs font-semibold rounded-lg text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isCancelling ? 'Membatalkan...' : 'Batalkan Ekstraksi'}
              </button>
            </div>
          )}

          {/* Succeeded State */}
          {showSuccess && job && (
            <div
              className="p-6 rounded-2xl bg-teal-50/40 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 space-y-4"
              data-testid="audio-success-panel"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base">
                    Audio MP3 Berhasil Diekstrak!
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Berkas audio siap diunduh satu kali sebelum otomatis dibersihkan dari server.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-stone-600 dark:text-stone-400">Nama berkas:</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100 truncate max-w-[260px]">
                    {job.output_filename}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-stone-600 dark:text-stone-400">Ukuran berkas:</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                    {formatVideoBytes(job.input_size_bytes)} (Video) → {formatVideoBytes(job.output_size_bytes ?? 0)} (Audio)
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-stone-600 dark:text-stone-400">Kualitas:</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    MP3 {job.preset} CBR Stereo
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-stone-600 dark:text-stone-400">Masa berlaku tautan:</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    15 menit (Unduhan sekali pakai)
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-stone-600 dark:text-stone-400">
                <ShieldCheck className="w-4 h-4 text-teal-800 dark:text-teal-400 shrink-0 mt-0.5" />
                <span>
                  Setelah diunduh sekali, berkas hasil dan berkas MP4 sementara segera dihapus permanen dari server.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  data-testid="btn-reset-mp4-to-mp3"
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Ekstrak Berkas Lain</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading || hasDownloaded}
                  data-testid="btn-download-mp3-audio"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-teal-800 hover:bg-teal-900 text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengunduh Audio...</span>
                    </>
                  ) : hasDownloaded ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Audio Telah Diunduh</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Unduh Audio MP3</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
