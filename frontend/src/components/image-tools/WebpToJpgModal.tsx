import React, { useState, useEffect, useRef } from 'react'
import {
  FileImage,
  Upload,
  CheckCircle2,
  X,
  Loader2,
  ShieldCheck,
  Download,
  Palette,
  Sliders,
  RotateCcw,
  Info,
} from 'lucide-react'
import { downloadImageBlob } from '../../services/imageTools'
import { KituNotice } from '../brand/KituNotice'

interface WebpToJpgModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ImageMeta {
  width: number
  height: number
  hasAlpha: boolean
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
const MAX_PIXELS = 8000 * 8000 // 64 MP limit

const BG_PRESETS = [
  { id: 'white', label: 'Putih', color: '#FFFFFF' },
  { id: 'black', label: 'Hitam', color: '#000000' },
  { id: 'slate', label: 'Abu-abu', color: '#F1F5F9' },
  { id: 'cream', label: 'Krem', color: '#FFFDF7' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function validateWebpMagicBytes(file: File): Promise<boolean> {
  try {
    const buffer = await file.slice(0, 16).arrayBuffer()
    const bytes = new Uint8Array(buffer)
    if (bytes.length < 12) return false

    // Check 'RIFF' (0..3)
    const isRiff =
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    // Check 'WEBP' (8..11)
    const isWebp =
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50

    return isRiff && isWebp
  } catch {
    return false
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gagal memproses berkas WebP. Berkas mungkin rusak.'))
    img.src = url
  })
}

export const WebpToJpgModal: React.FC<WebpToJpgModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [meta, setMeta] = useState<ImageMeta | null>(null)

  const [bgColor, setBgColor] = useState<string>('#FFFFFF')
  const [quality, setQuality] = useState<number>(92) // 60 - 100%

  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{
    originalSize: number
    resultSize: number
    filename: string
  } | null>(null)

  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bersihkan Object URLs saat ditutup atau unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setMeta(null)
    setErrorMessage(null)
    setSuccessInfo(null)
    setBgColor('#FFFFFF')
    setQuality(92)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const processSelectedFile = async (selected: File) => {
    setErrorMessage(null)
    setSuccessInfo(null)

    // Validasi ukuran
    if (selected.size > MAX_FILE_SIZE) {
      setErrorMessage('Ukuran berkas melebihi batas maksimal 25 MB.')
      return
    }

    if (selected.size === 0) {
      setErrorMessage('Berkas kosong (0 byte).')
      return
    }

    // Validasi nama / ekstensi
    const isWebpExt = /\.webp$/i.test(selected.name)
    if (!isWebpExt && selected.type !== 'image/webp') {
      setErrorMessage('Hanya berkas berformat WebP (.webp) yang didukung.')
      return
    }

    // Validasi magic bytes
    const isValidBytes = await validateWebpMagicBytes(selected)
    if (!isValidBytes) {
      setErrorMessage('Struktur berkas bukan WebP valid (header RIFF/WEBP tidak ditemukan).')
      return
    }

    // Muat citra untuk verifikasi dimensi
    const url = URL.createObjectURL(selected)
    try {
      const img = await loadImage(url)
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height

      if (w * h > MAX_PIXELS) {
        URL.revokeObjectURL(url)
        setErrorMessage('Dimensi gambar terlalu besar (maksimal 64 juta piksel).')
        return
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setFile(selected)
      setPreviewUrl(url)
      setMeta({
        width: w,
        height: h,
        hasAlpha: true, // WebP secara umum mendukung kanal alfa
      })
    } catch (err: any) {
      URL.revokeObjectURL(url)
      setErrorMessage(err.message || 'Gagal membaca berkas WebP.')
    }
  }

  const handleConvertAndDownload = async () => {
    if (!file || !previewUrl || !meta) {
      setErrorMessage('Pilih berkas WebP terlebih dahulu.')
      return
    }

    setIsProcessing(true)
    setErrorMessage(null)

    try {
      const img = await loadImage(previewUrl)
      const canvas = document.createElement('canvas')
      canvas.width = meta.width
      canvas.height = meta.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Gagal menginisialisasi kanvas grafis browser.')
      }

      // 1. Ratakan latar belakang (JPG tidak mendukung transparansi)
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 2. Gambar frame pertama WebP tanpa resize atau crop
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // 3. Ekspor ke format JPEG dengan kualitas pilihan
      const q = Math.max(0.6, Math.min(1.0, quality / 100))
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', q)
      })

      if (!blob) {
        throw new Error('Gagal mengonversi kanvas ke berkas JPG.')
      }

      // 4. Unduh berkas
      const stem = file.name.replace(/\.[^/.]+$/, '')
      const outFilename = `${stem}.jpg`
      downloadImageBlob(blob, outFilename)

      setSuccessInfo({
        originalSize: file.size,
        resultSize: blob.size,
        filename: outFilename,
      })
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat mengonversi WebP ke JPG.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="webp-to-jpg-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-overlay-in select-none"
    >
      <div className="relative w-full max-w-xl bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100/80 text-teal-800 rounded-xl">
              <FileImage className="w-5 h-5" />
            </div>
            <div>
              <h2 id="webp-to-jpg-title" className="text-base font-bold text-stone-900 leading-snug">
                WebP ke JPG
              </h2>
              <p className="text-xs text-stone-500">
                Konversi gambar WebP ke JPG utuh dengan kualitas tinggi di browser Anda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="btn-close-webp-modal"
            aria-label="Tutup jendela konversi"
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Isi Modal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Alert Error */}
          {errorMessage && (
            <KituNotice
              tone="error"
              expression="kecewa"
              title="Gagal Mengonversi Gambar"
              role="alert"
            >
              <span>{errorMessage}</span>
            </KituNotice>
          )}

          {/* Kondisi 1: Belum ada berkas -> Dropzone */}
          {!file && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragOver(false)
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  processSelectedFile(e.dataTransfer.files[0])
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-teal-700 bg-teal-50/40 ring-4 ring-teal-700/10'
                  : 'border-stone-300 hover:border-teal-600 hover:bg-stone-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".webp,image/webp"
                aria-label="Pilih berkas WebP"
                className="hidden"
                data-testid="file-input-webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processSelectedFile(e.target.files[0])
                  }
                }}
              />
              <div className="w-14 h-14 mb-3 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-800">
                <Upload className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-stone-900">
                Pilih atau Tarik Berkas WebP ke Sini
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Mendukung gambar WebP hingga maksimal 25 MB
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 rounded-full text-xs text-stone-600 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                Diproses 100% lokal di browser — berkas tidak diunggah ke server
              </div>
            </div>
          )}

          {/* Kondisi 2: Berkas siap dikonversi */}
          {file && previewUrl && meta && (
            <div className="space-y-5 animate-fade-in">
              {/* Kartu Ringkasan Berkas */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-stone-200/80 border border-stone-300 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt="Pratinjau WebP"
                      className="w-full h-full object-contain"
                      data-testid="img-webp-preview"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-900 truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-2xs text-stone-500 mt-0.5">
                      Ukuran: {formatBytes(file.size)} • Dimensi: {meta.width} × {meta.height} px
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  data-testid="btn-reset-webp"
                  className="px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg border border-stone-200 transition-colors flex items-center gap-1 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Ganti
                </button>
              </div>

              {/* Catatan WebP Animasi */}
              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2 text-2xs text-amber-900">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Format JPG adalah gambar statis. Jika berkas Anda adalah WebP animasi, sistem akan
                  mengonversi bingkai (frame) pertama secara utuh.
                </p>
              </div>

              {/* Pengaturan 1: Latar Belakang Transparansi */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-teal-800" />
                  Warna Pengganti Transparansi
                </label>
                <p className="text-2xs text-stone-500">
                  Format JPG tidak mendukung transparansi. Pilih warna latar untuk mengisi bagian
                  transparan:
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {BG_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setBgColor(p.color)}
                      data-testid={`btn-bg-${p.id}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        bgColor.toUpperCase() === p.color.toUpperCase()
                          ? 'border-teal-800 bg-teal-50 text-teal-900 font-bold ring-2 ring-teal-700/20'
                          : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-stone-300"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.label}
                    </button>
                  ))}

                  {/* Color Picker Kustom */}
                  <label
                    data-testid="label-bg-custom"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-medium text-stone-700 cursor-pointer transition-colors"
                  >
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      data-testid="input-bg-color"
                      aria-label="Pilih warna kustom latar JPG"
                      className="w-4 h-4 p-0 border-0 rounded cursor-pointer"
                    />
                    <span>Kustom</span>
                  </label>
                </div>
              </div>

              {/* Pengaturan 2: Slider Kualitas JPG */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="input-quality-slider"
                    className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5 text-teal-800" />
                    Kualitas JPG: <span className="text-teal-900 font-extrabold">{quality}%</span>
                  </label>
                  <span className="text-2xs text-stone-500">Rekomendasi: 92%</span>
                </div>
                <input
                  id="input-quality-slider"
                  type="range"
                  min="60"
                  max="100"
                  step="1"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  data-testid="input-quality-slider"
                  aria-label="Kualitas kompresi JPG"
                  className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-teal-800"
                />
                <div className="flex justify-between text-2xs text-stone-400 font-mono">
                  <span>60% (Ukuran Ringkas)</span>
                  <span>92% (Seimbang)</span>
                  <span>100% (Maksimal)</span>
                </div>
              </div>

              {/* Hasil Sukses */}
              {successInfo && (
                <div
                  role="status"
                  className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs text-emerald-900 animate-fade-in"
                >
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Gambar JPG berhasil dibuat dan diunduh!</span>
                  </div>
                  <div className="flex items-center gap-2 text-2xs text-stone-600 pt-0.5">
                    <span>Berkas: <strong>{successInfo.filename}</strong></span>
                    <span>•</span>
                    <span>Ukuran WebP: {formatBytes(successInfo.originalSize)}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">
                      Ukuran JPG: {formatBytes(successInfo.resultSize)}
                    </span>
                  </div>
                </div>
              )}

              {/* Tombol Aksi Konversi */}
              <button
                type="button"
                onClick={handleConvertAndDownload}
                disabled={isProcessing}
                data-testid="btn-convert-download"
                className="w-full py-3 px-4 bg-teal-800 hover:bg-teal-900 disabled:bg-stone-300 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengonversi ke JPG...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Konversi & Unduh JPG ({meta.width} × {meta.height} px)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
