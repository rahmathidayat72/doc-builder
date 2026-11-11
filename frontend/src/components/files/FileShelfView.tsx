import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Clock,
  Shield,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  FileCode,
  File,
  Lock,
  Loader2,
  X,
} from 'lucide-react'
import { type AuthUser } from '../../services/auth'
import { type Workspace } from '../layout/Navbar'
import {
  type FileShelfItem,
  type FileShelfMetrics,
  fetchUserFiles,
  fetchFileMetrics,
  deleteUserFile,
  downloadUserFile,
  uploadFileStream,
} from '../../services/fileShelf'
import kituFeatureFilesWebp from '../../assets/kitu-feature-files.webp'
import kituFeatureFilesPng from '../../assets/kitu-feature-files.png'

interface FileShelfViewProps {
  currentUser: AuthUser | null
  onNavigate: (workspace: Workspace) => void
}

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.md',
]

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDaysRemaining(expiresAt?: number | null): string {
  if (!expiresAt) return '30 hari tersisa'
  const diffSec = expiresAt - timeNowSec()
  if (diffSec <= 0) return 'Kedaluwarsa'
  const days = Math.ceil(diffSec / 86400)
  return `${days} hari tersisa`
}

function timeNowSec(): number {
  return Math.floor(Date.now() / 1000)
}

function getFileIcon(filename: string) {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return <FileText className="w-5 h-5 text-red-500" />
  if (lower.endsWith('.docx')) return <FileText className="w-5 h-5 text-blue-500" />
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) {
    return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
  }
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) {
    return <Presentation className="w-5 h-5 text-amber-500" />
  }
  if (IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return <ImageIcon className="w-5 h-5 text-teal-600" />
  }
  if (lower.endsWith('.md')) return <FileCode className="w-5 h-5 text-teal-600" />
  return <File className="w-5 h-5 text-stone-500" />
}

export function FileShelfView({ currentUser, onNavigate }: FileShelfViewProps) {
  const [items, setItems] = useState<FileShelfItem[]>([])
  const [metrics, setMetrics] = useState<FileShelfMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadingFilename, setUploadingFilename] = useState<string | null>(null)

  // EXIF Dialog state
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [exifAgreed, setExifAgreed] = useState(false)
  const [showExifModal, setShowExifModal] = useState(false)

  // Download & Delete action states
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEmailVerified = currentUser?.email_verified !== false

  const loadData = useCallback(async () => {
    if (!currentUser || !isEmailVerified) return
    setIsLoading(true)
    try {
      const [files, m] = await Promise.all([fetchUserFiles(), fetchFileMetrics()])
      setItems(files)
      setMetrics(m)
      setErrorMessage(null)
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat data Rak Berkas.')
    } finally {
      setIsLoading(false)
    }
  }, [currentUser, isEmailVerified])

  useEffect(() => {
    if (currentUser && isEmailVerified) {
      loadData()
    }
  }, [currentUser, isEmailVerified, loadData])

  // Periodic polling for checking items
  useEffect(() => {
    const hasChecking = items.some((it) => it.status === 'CHECKING')
    if (!hasChecking) return

    const timer = setInterval(() => {
      fetchUserFiles()
        .then((fresh) => {
          setItems(fresh)
        })
        .catch(() => {})
    }, 4000)

    return () => clearInterval(timer)
  }, [items])

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Validation: size
    if (file.size > 25_000_000) {
      setErrorMessage('Ukuran berkas melebihi batas 25 MB (maksimal 25.000.000 byte).')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 2. Validation: format
    const lowerName = file.name.toLowerCase()
    const isAllowed = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
    if (!isAllowed) {
      setErrorMessage(
        'Format berkas tidak didukung. Satukit mendukung PDF, DOCX, PPT/PPTX, XLS/XLSX, JPG, PNG, WebP, dan Markdown.'
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 3. Image EXIF check
    const isImage = IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
    if (isImage) {
      setPendingFile(file)
      setExifAgreed(false)
      setShowExifModal(true)
      return
    }

    executeUpload(file, false)
  }

  const executeUpload = async (file: File, hasExifWarning: boolean) => {
    setUploadingFilename(file.name)
    setUploadProgress(0)
    setErrorMessage(null)

    try {
      await uploadFileStream(file, hasExifWarning, (percent) => {
        setUploadProgress(percent)
      })
      await loadData()
    } catch (err: any) {
      setErrorMessage(err.message || 'Unggah berkas gagal.')
    } finally {
      setUploadProgress(null)
      setUploadingFilename(null)
      setPendingFile(null)
      setShowExifModal(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (item: FileShelfItem) => {
    setDownloadingId(item.id)
    try {
      await downloadUserFile(item.id, item.filename)
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mengunduh berkas.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (item: FileShelfItem) => {
    if (!confirm(`Hapus berkas "${item.filename}" dari Rak Berkas privat Anda?`)) {
      return
    }
    setDeletingId(item.id)
    try {
      await deleteUserFile(item.id)
      await loadData()
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menghapus berkas.')
    } finally {
      setDeletingId(null)
    }
  }

  // Derive 8 View States
  let currentState:
    | 'unauthenticated'
    | 'unverified_email'
    | 'uploading'
    | 'checking'
    | 'quota_full'
    | 'empty'
    | 'available'
    | 'error' = 'available'

  if (!currentUser) {
    currentState = 'unauthenticated'
  } else if (!isEmailVerified) {
    currentState = 'unverified_email'
  } else if (uploadProgress !== null) {
    currentState = 'uploading'
  } else if (errorMessage && items.length === 0) {
    currentState = 'error'
  } else if (items.some((it) => it.status === 'CHECKING')) {
    currentState = 'checking'
  } else if ((metrics?.slots_used ?? items.length) >= 5) {
    currentState = 'quota_full'
  } else if (items.length === 0) {
    currentState = 'empty'
  } else {
    currentState = 'available'
  }

  return (
    <div
      data-testid="file-shelf-view"
      data-state={currentState}
      className="min-h-[calc(100vh-4rem)] bg-stone-50 dark:bg-stone-900 text-stone-900 dark:text-stone-100 transition-colors py-8 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-7 h-7 text-teal-700 dark:text-teal-400" />
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Rak Berkas Privat
              </h1>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Penyimpanan aman terenkripsi AES-256-GCM envelope dengan pemindaian malware ClamAV
              dan isolasi parser.
            </p>
          </div>

          {currentUser && isEmailVerified && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="p-2 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition"
                title="Segarkan data"
                aria-label="Segarkan data"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={currentState === 'quota_full' || uploadProgress !== null}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-xs flex items-center gap-2 text-sm transition"
              >
                <Upload className="w-4 h-4" />
                <span>Unggah Berkas</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={handleFileSelection}
              />
            </div>
          )}
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div
            data-testid="error-banner"
            className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 flex items-start justify-between gap-3 text-sm"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              aria-label="Tutup pesan kesalahan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Cloud Ceiling Warning */}
        {metrics?.r2_storage_status === 'WARNING_APPROACHING_LIMIT' && (
          <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Kapasitas penyimpanan cloud mendekati batas kuota bulanan.</span>
          </div>
        )}

        {/* STATE 1: UNAUTHENTICATED */}
        {currentState === 'unauthenticated' && (
          <div
            data-testid="state-unauthenticated"
            className="p-8 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-xs text-center space-y-4 max-w-lg mx-auto my-8"
          >
            <div className="w-14 h-14 bg-teal-50 dark:bg-teal-950/60 rounded-full flex items-center justify-center mx-auto text-teal-700 dark:text-teal-400">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold">Masuk untuk Mengakses Rak Berkas</h2>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Rak Berkas adalah fasilitas penyimpanan privat per akun. Silakan masuk atau buat akun
              terlebih dahulu untuk mengunggah dan mengelola dokumen Anda.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg text-sm transition cursor-pointer"
            >
              Masuk / Daftar Akun
            </button>
          </div>
        )}

        {/* STATE 2: UNVERIFIED_EMAIL */}
        {currentState === 'unverified_email' && (
          <div
            data-testid="state-unverified-email"
            className="p-8 rounded-2xl bg-white dark:bg-stone-800 border border-amber-300 dark:border-amber-700 shadow-xs text-center space-y-4 max-w-lg mx-auto my-8"
          >
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/60 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold">Alamat Email Belum Diverifikasi</h2>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Untuk melindungi privasi dan keamanan akun Anda, fitur Rak Berkas hanya dapat
              digunakan oleh akun dengan email yang telah diverifikasi.
            </p>
            <p className="text-xs text-stone-500">
              Silakan periksa kotak masuk atau spam pada alamat email Anda.
            </p>
          </div>
        )}

        {/* Upload Streaming Progress Card (STATE 4) */}
        {uploadProgress !== null && (
          <div
            data-testid="state-uploading"
            className="p-5 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 space-y-3"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-teal-900 dark:text-teal-200 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
                Mengunggah &lsquo;{uploadingFilename}&rsquo; ke karantina...
              </span>
              <span className="font-mono text-teal-700 dark:text-teal-300 font-bold">
                {uploadProgress}%
              </span>
            </div>
            <div className="w-full bg-teal-200 dark:bg-teal-900 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-teal-600 h-2.5 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Quota & Usage Bar */}
        {currentUser && isEmailVerified && metrics && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700/80 text-xs">
            <div className="space-y-1">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Kapasitas Slot</span>
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>
                  {metrics.slots_used} dari {metrics.slots_total} Slot Terpakai
                </span>
                {metrics.slots_used >= 5 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                    Penuh
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Batas Rolling Hour</span>
              <div className="text-stone-700 dark:text-stone-300 font-semibold">
                Upload: {metrics.uploads_rolling_count}/10 | Unduh: {metrics.downloads_rolling_count}/30
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-stone-500 dark:text-stone-400 font-medium">Masa Simpan</span>
              <div className="text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>30 hari sejak berkas siap</span>
              </div>
            </div>
          </div>
        )}

        {/* STATE 7: QUOTA FULL NOTICE */}
        {currentState === 'quota_full' && (
          <div
            data-testid="state-quota-full"
            className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-200 text-sm flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Batas Kuota Rak Berkas Tercapai (5/5 Slot)</p>
              <p className="text-xs mt-1">
                Anda telah menggunakan 5 slot berkas privat. Hapus salah satu berkas lama untuk
                dapat mengunggah berkas baru.
              </p>
            </div>
          </div>
        )}

        {/* STATE 3: EMPTY */}
        {currentState === 'empty' && (
          <div
            data-testid="state-empty"
            className="p-12 rounded-2xl bg-white dark:bg-stone-800 border-2 border-dashed border-stone-200 dark:border-stone-700 text-center space-y-4 my-6"
          >
            <picture className="block mx-auto w-32 h-32">
              <source srcSet={kituFeatureFilesWebp} type="image/webp" />
              <img
                src={kituFeatureFilesPng}
                alt="Kitu Rak Berkas"
                className="w-32 h-32 object-contain mx-auto"
              />
            </picture>
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Rak Berkas Anda Masih Kosong</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                Unggah dokumen PDF, Office, atau gambar hingga 25 MB. Berkas dienkripsi dengan
                kunci unik dan tersimpan aman selama 30 hari.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg text-sm inline-flex items-center gap-2 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Pilih Berkas Pertama</span>
            </button>
          </div>
        )}

        {/* Active Items Table / List (STATES: CHECKING & AVAILABLE) */}
        {currentUser && isEmailVerified && items.length > 0 && (
          <div
            data-testid="file-items-list"
            className="bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shadow-xs overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-100 dark:bg-stone-900/60 text-stone-600 dark:text-stone-400 text-xs uppercase tracking-wider font-semibold border-b border-stone-200 dark:border-stone-700">
                  <tr>
                    <th scope="col" className="px-4 py-3">Nama Berkas</th>
                    <th scope="col" className="px-4 py-3">Ukuran</th>
                    <th scope="col" className="px-4 py-3">Status Keamanan</th>
                    <th scope="col" className="px-4 py-3">Masa Simpan</th>
                    <th scope="col" className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      data-testid={`file-row-${item.id}`}
                      className="hover:bg-stone-50/80 dark:hover:bg-stone-700/40 transition"
                    >
                      {/* Name & format icon */}
                      <td className="px-4 py-3 font-medium flex items-center gap-2.5">
                        {getFileIcon(item.filename)}
                        <div className="truncate max-w-[200px] sm:max-w-xs" title={item.filename}>
                          <span>{item.filename}</span>
                          {item.sha256_hash && (
                            <div className="text-[11px] text-stone-400 font-mono truncate" title={item.sha256_hash}>
                              SHA256: {item.sha256_hash.substring(0, 12)}...
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3 text-stone-600 dark:text-stone-300 font-mono text-xs whitespace-nowrap">
                        {formatBytes(item.size_bytes)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.status === 'CHECKING' && (
                          <span
                            data-testid="status-checking"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200"
                          >
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Memindai ClamAV...
                          </span>
                        )}
                        {item.status === 'AVAILABLE' && (
                          <span
                            data-testid="status-available"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200"
                          >
                            <Shield className="w-3.5 h-3.5 text-emerald-600" />
                            Aman (Terenkripsi)
                          </span>
                        )}
                        {item.status === 'FAILED' && (
                          <span
                            data-testid="status-failed"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200"
                            title={item.error_message || 'Pemindaian gagal'}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Gagal / Ditolak
                          </span>
                        )}
                      </td>

                      {/* Retention */}
                      <td className="px-4 py-3 text-stone-500 dark:text-stone-400 text-xs whitespace-nowrap">
                        {formatDaysRemaining(item.expires_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        <button
                          type="button"
                          onClick={() => handleDownload(item)}
                          disabled={item.status !== 'AVAILABLE' || downloadingId === item.id}
                          className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-teal-700 dark:text-teal-400 transition"
                          title="Unduh berkas terdekripsi"
                          aria-label={`Unduh ${item.filename}`}
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.id}
                          className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 disabled:opacity-40 transition"
                          title="Hapus berkas"
                          aria-label={`Hapus ${item.filename}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* EXIF / GPS Warning Modal (RISK-SEC-014) */}
      {showExifModal && pendingFile && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="exif-warning-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-stone-800 rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 dark:border-stone-700 space-y-4">
            <div className="flex items-start gap-3 text-amber-600 dark:text-amber-400">
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Konfirmasi Metadata Foto (EXIF/GPS)
                </h3>
                <p className="text-xs text-stone-500">
                  Berkas foto: <span className="font-semibold">{pendingFile.name}</span>
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-stone-50 dark:bg-stone-900/60 rounded-xl text-xs text-stone-600 dark:text-stone-300 space-y-2 border border-stone-200 dark:border-stone-700">
              <p>
                Sesuai kebijakan keamanan Satukit (<code>RISK-SEC-014</code>), berkas gambar statis
                disimpan dengan mempertahankan byte asli penuh (termasuk potensi data lokasi GPS dan
                model kamera).
              </p>
              <p>
                Berkas Anda tetap dienkripsi secara privat (AES-256-GCM) dan hanya dapat diakses
                oleh akun Anda sendiri.
              </p>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-stone-800 dark:text-stone-200 cursor-pointer">
              <input
                type="checkbox"
                data-testid="exif-agreement-checkbox"
                checked={exifAgreed}
                onChange={(e) => setExifAgreed(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-teal-700 focus:ring-teal-600"
              />
              <span>
                Saya memahami dan mengizinkan penyimpanan berkas gambar dengan metadata lokasi / EXIF aslinya.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowExifModal(false)
                  setPendingFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition"
              >
                Batal
              </button>
              <button
                type="button"
                data-testid="confirm-exif-upload-button"
                disabled={!exifAgreed}
                onClick={() => executeUpload(pendingFile, true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition"
              >
                Lanjutkan Unggah
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
