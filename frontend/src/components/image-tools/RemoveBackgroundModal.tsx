import React, { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Upload,
  CheckCircle2,
  X,
  Loader2,
  Download,
  RotateCcw,
  Palette,
  ShieldCheck,
  Crop,
  Focus,
} from 'lucide-react'
import {
  removeBackground,
  downloadImageBlob,
  type RemoveBackgroundResult,
} from '../../services/imageTools'
import { KituNotice } from '../brand/KituNotice'

interface RemoveBackgroundModalProps {
  isOpen: boolean
  onClose: () => void
  initialBg?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const BG_PRESETS = [
  { id: 'transparent', label: 'Transparan', color: 'transparent' },
  { id: 'blur', label: 'Blur Latar', color: 'blur' },
  { id: 'white', label: 'Putih', color: '#FFFFFF' },
  { id: 'red', label: 'Merah Pasfoto', color: '#D32F2F' },
  { id: 'blue', label: 'Biru Pasfoto', color: '#1976D2' },
  { id: 'gray', label: 'Abu-abu', color: '#E5E7EB' },
]

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gagal memuat gambar'))
    img.src = url
  })
}

interface SizePreset {
  id: string
  label: string
  sublabel: string
  width?: number
  height?: number
  aspectRatio?: string
}

/**
 * Mendeteksi batas subjek (non-transparan) dan memangkas baris transparan di bagian bawah
 * agar subjek benar-benar menyentuh tepi bawah pasfoto ("mentok ke bawah").
 */
async function getSubjectBottomTrimmedBlob(originalBlob: Blob): Promise<Blob> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return originalBlob
  }

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(originalBlob)
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      if (!ctx) {
        resolve(originalBlob)
        return
      }

      ctx.drawImage(img, 0, 0)

      let imgData: ImageData
      try {
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      } catch {
        resolve(originalBlob)
        return
      }

      const data = imgData.data
      const width = canvas.width
      const height = canvas.height

      // Pindai baris piksel non-transparan terbawah (alpha > 15) dari bawah ke atas
      let maxY = -1
      for (let y = height - 1; y >= 0; y--) {
        const rowOffset = y * width * 4
        for (let x = 0; x < width; x++) {
          if (data[rowOffset + x * 4 + 3] > 15) {
            maxY = y
            break
          }
        }
        if (maxY !== -1) break
      }

      // Jika tidak ditemukan piksel atau sudah menyentuh baris paling bawah (toleransi 1px)
      if (maxY === -1 || maxY >= height - 2) {
        resolve(originalBlob)
        return
      }

      // Pangkas baris transparan di bawah subjek (+1 px untuk anti-aliasing)
      const trimmedHeight = Math.min(height, maxY + 1)
      const trimCanvas = document.createElement('canvas')
      trimCanvas.width = width
      trimCanvas.height = trimmedHeight
      const trimCtx = trimCanvas.getContext('2d')

      if (!trimCtx) {
        resolve(originalBlob)
        return
      }

      trimCtx.drawImage(
        canvas,
        0,
        0,
        width,
        trimmedHeight,
        0,
        0,
        width,
        trimmedHeight
      )

      trimCanvas.toBlob((trimmedBlob) => {
        resolve(trimmedBlob || originalBlob)
      }, 'image/png')
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(originalBlob)
    }

    img.src = url
  })
}

const SIZE_PRESETS: SizePreset[] = [
  { id: 'original', label: 'Asli', sublabel: 'Resolusi penuh' },
  {
    id: '2x3',
    label: '2×3 cm',
    sublabel: '236×354 px',
    width: 236,
    height: 354,
    aspectRatio: '2 / 3',
  },
  {
    id: '3x4',
    label: '3×4 cm',
    sublabel: '354×472 px',
    width: 354,
    height: 472,
    aspectRatio: '3 / 4',
  },
  {
    id: '4x6',
    label: '4×6 cm',
    sublabel: '472×709 px',
    width: 472,
    height: 709,
    aspectRatio: '4 / 6',
  },
  {
    id: '1x1',
    label: '1:1 Persegi',
    sublabel: '600×600 px',
    width: 600,
    height: 600,
    aspectRatio: '1 / 1',
  },
]

export const RemoveBackgroundModal: React.FC<RemoveBackgroundModalProps> = ({
  isOpen,
  onClose,
  initialBg,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<RemoveBackgroundResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(null)
  const [trimmedPreviewUrl, setTrimmedPreviewUrl] = useState<string | null>(null)
  const [selectedBg, setSelectedBg] = useState<string>(initialBg || 'transparent')
  const [selectedSize, setSelectedSize] = useState<string>('original')
  const [customColor, setCustomColor] = useState<string>('#4A90E2')
  const [blurIntensity, setBlurIntensity] = useState<number>(16)
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png')
  const [isDragOver, setIsDragOver] = useState<boolean>(false)

  const currentSizeConfig =
    SIZE_PRESETS.find((s) => s.id === selectedSize) || SIZE_PRESETS[0]

  const activePreviewUrl =
    currentSizeConfig.id !== 'original' && trimmedPreviewUrl
      ? trimmedPreviewUrl
      : previewUrl

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bersihkan object URL saat modal ditutup atau unmount
  useEffect(() => {
    return () => {
      if (originalFileUrl) {
        URL.revokeObjectURL(originalFileUrl)
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      if (trimmedPreviewUrl) {
        URL.revokeObjectURL(trimmedPreviewUrl)
      }
    }
  }, [originalFileUrl, previewUrl, trimmedPreviewUrl])

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

  const handleProcessFile = async (selected: File) => {
    if (selected.size > 10 * 1024 * 1024) {
      setErrorMessage('Ukuran berkas melebihi batas 10 MB.')
      return
    }

    setFile(selected)
    setErrorMessage(null)
    setResult(null)
    setTrimmedBlob(null)
    if (originalFileUrl) {
      URL.revokeObjectURL(originalFileUrl)
      setOriginalFileUrl(null)
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    if (trimmedPreviewUrl) {
      URL.revokeObjectURL(trimmedPreviewUrl)
      setTrimmedPreviewUrl(null)
    }

    const origUrl = URL.createObjectURL(selected)
    setOriginalFileUrl(origUrl)

    setIsLoading(true)
    const res = await removeBackground(selected)
    setIsLoading(false)

    if (res.success && res.blob) {
      setResult(res)
      const url = URL.createObjectURL(res.blob)
      setPreviewUrl(url)

      // Pangkas padding transparan di bawah subjek agar pasfoto mentok ke bawah
      const trimmed = await getSubjectBottomTrimmedBlob(res.blob)
      setTrimmedBlob(trimmed)
      const tUrl = URL.createObjectURL(trimmed)
      setTrimmedPreviewUrl(tUrl)
    } else {
      setErrorMessage(res.message || 'Gagal menghapus latar belakang gambar.')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0])
    }
  }

  const handleDownload = () => {
    if (!result || !result.blob) return

    const baseName = (file?.name || 'image').replace(/\.[^/.]+$/, '')
    const sizeConfig =
      SIZE_PRESETS.find((s) => s.id === selectedSize) || SIZE_PRESETS[0]
    const isOriginalSize = sizeConfig.id === 'original'

    // Jika ukuran asli dan latar belakang transparan, unduh blob asli langsung
    if (isOriginalSize && selectedBg === 'transparent') {
      downloadImageBlob(result.blob, `${baseName}_nobg.png`)
      return
    }

    const effectiveFormat = selectedBg === 'transparent' ? 'png' : exportFormat
    const targetColor = selectedBg === 'custom' ? customColor : selectedBg

    // Gunakan trimmedBlob untuk pasfoto agar subjek mentok ke bawah, atau result.blob untuk ukuran asli
    const sourceBlob = !isOriginalSize && trimmedBlob ? trimmedBlob : result.blob
    const sourceUrl = URL.createObjectURL(sourceBlob)

    const isBlur = selectedBg === 'blur' && !!originalFileUrl

    Promise.all([
      loadImage(sourceUrl),
      isBlur && originalFileUrl ? loadImage(originalFileUrl) : Promise.resolve(null),
    ])
      .then(([subjectImg, origImg]) => {
        URL.revokeObjectURL(sourceUrl)
        const canvas = document.createElement('canvas')
        const targetWidth = sizeConfig.width || subjectImg.width
        const targetHeight = sizeConfig.height || subjectImg.height
        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          downloadImageBlob(result.blob!, `${baseName}_nobg.png`)
          return
        }

        // 1. Gambar latar belakang (blur atau warna solid)
        if (isBlur && origImg) {
          const previewRefHeight = 280
          const blurScale = Math.max(1, targetHeight / previewRefHeight)
          const canvasBlur = Math.round(blurIntensity * blurScale)

          ctx.save()
          if ('filter' in ctx) {
            ctx.filter = `blur(${canvasBlur}px)`
          }
          // Overdraw sedikit (+6%) agar blur di tepi kanvas tidak pudar/transparan
          const origScale =
            Math.max(targetWidth / origImg.width, targetHeight / origImg.height) * 1.06
          const ow = origImg.width * origScale
          const oh = origImg.height * origScale
          const ox = (targetWidth - ow) / 2
          const oy = (targetHeight - oh) / 2
          ctx.drawImage(origImg, ox, oy, ow, oh)
          ctx.restore()
        } else if (selectedBg !== 'transparent') {
          ctx.fillStyle = targetColor
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        // 2. Gambar subjek transparan (mentok ke bawah untuk pasfoto)
        if (isOriginalSize) {
          ctx.drawImage(subjectImg, 0, 0)
        } else {
          const scale = Math.max(targetWidth / subjectImg.width, targetHeight / subjectImg.height)
          const dw = subjectImg.width * scale
          const dh = subjectImg.height * scale
          const dx = (targetWidth - dw) / 2
          // Mentok ke bawah: sejajarkan bagian bawah subjek persis di tepi bawah kanvas
          const dy = targetHeight - dh
          ctx.drawImage(subjectImg, dx, dy, dw, dh)
        }

        const mimeType = effectiveFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
        const ext = effectiveFormat === 'jpeg' ? 'jpg' : 'png'
        const colorName =
          selectedBg === 'transparent'
            ? 'nobg'
            : selectedBg === 'blur'
              ? 'blur'
              : BG_PRESETS.find((p) => p.color === targetColor)?.id || 'custom'
        const filename = isOriginalSize
          ? `${baseName}_${colorName}.${ext}`
          : `${baseName}_${sizeConfig.id}_${colorName}.${ext}`

        canvas.toBlob(
          (colorBlob) => {
            if (colorBlob) {
              downloadImageBlob(colorBlob, filename)
            } else {
              downloadImageBlob(result.blob!, `${baseName}_nobg.png`)
            }
          },
          mimeType,
          effectiveFormat === 'jpeg' ? 0.92 : undefined
        )
      })
      .catch(() => {
        URL.revokeObjectURL(sourceUrl)
        downloadImageBlob(result.blob!, `${baseName}_nobg.png`)
      })
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setTrimmedBlob(null)
    setErrorMessage(null)
    setSelectedBg(initialBg || 'transparent')
    setSelectedSize('original')
    setBlurIntensity(16)
    setExportFormat('png')
    if (originalFileUrl) {
      URL.revokeObjectURL(originalFileUrl)
      setOriginalFileUrl(null)
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    if (trimmedPreviewUrl) {
      URL.revokeObjectURL(trimmedPreviewUrl)
      setTrimmedPreviewUrl(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-bg-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose()
      }}
    >
      <div className="relative w-full max-w-2xl bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Meja Kerja */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
              {initialBg === 'blur' ? (
                <Focus className="w-5 h-5" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2
                id="remove-bg-modal-title"
                className="text-lg font-bold text-stone-900"
              >
                {initialBg === 'blur'
                  ? 'Blur Background Foto'
                  : 'Hapus Latar Belakang Foto'}
              </h2>
              <p className="text-xs text-stone-500">
                {initialBg === 'blur'
                  ? 'Efek bokeh AI lokal • 100% offline & privat'
                  : 'Segmentasi AI U2NetP lokal • 100% offline & privat'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-700"
            aria-label="Tutup dialog"
            data-testid="btn-close-remove-bg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Isi Modal */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Alert Error */}
          {errorMessage && (
            <KituNotice
              tone="error"
              expression="sedih"
              title="Gagal Memproses Latar"
              role="alert"
            >
              <span>{errorMessage}</span>
            </KituNotice>
          )}

          {/* Kondisi 1: Belum ada file atau belum diproses */}
          {!result && !isLoading && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-teal-700 bg-teal-50/50 scale-[0.99]'
                  : 'border-stone-300 hover:border-teal-700 hover:bg-stone-50/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="hidden"
                aria-label="Unggah berkas foto"
                data-testid="file-input-remove-bg"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleProcessFile(e.target.files[0])
                  }
                }}
              />
              <div className="w-14 h-14 rounded-full bg-teal-50 text-teal-800 mx-auto flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-base font-semibold text-stone-900">
                Pilih atau Tarik Foto ke Sini
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Mendukung JPG, PNG, atau WebP hingga maksimal 10 MB
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 rounded-full text-xs text-stone-600 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                Diproses lokal di perangkat — foto Anda tidak pernah dikirim ke cloud
              </div>
            </div>
          )}

          {/* Kondisi 2: Sedang Memproses Inferensi */}
          {isLoading && (
            <div className="py-12 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-teal-100 animate-pulse" />
                <Loader2 className="w-8 h-8 text-teal-800 animate-spin" />
              </div>
              <div>
                <p className="text-base font-bold text-stone-900">
                  Mendeteksi Subjek &amp; Menghapus Latar Belakang...
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  AI U2NetP memproses citra secara lokal di CPU VPS
                </p>
              </div>
              <div className="max-w-xs mx-auto bg-stone-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-teal-700 h-full w-2/3 animate-[pulse_1s_ease-in-out_infinite]" />
              </div>
            </div>
          )}

          {/* Kondisi 3: Berhasil - Tampilkan Pratinjau & Pilihan Warna */}
          {result && previewUrl && (
            <div className="space-y-5 animate-fade-in">
              {/* Panggung Pratinjau */}
              <div className="relative border border-stone-200 rounded-xl overflow-hidden bg-stone-100 flex items-center justify-center min-h-[260px] max-h-[360px] p-4">
                {/* Layer Latar Belakang Terpilih */}
                <div
                  className="absolute inset-0 transition-colors"
                  style={{
                    backgroundColor:
                      selectedBg === 'transparent' || selectedBg === 'blur'
                        ? 'transparent'
                        : selectedBg === 'custom'
                          ? customColor
                          : selectedBg,
                    backgroundImage:
                      selectedBg === 'transparent'
                        ? 'conic-gradient(#e5e7eb 90deg, #f9fafb 90deg 180deg, #e5e7eb 180deg 270deg, #f9fafb 270deg)'
                        : 'none',
                    backgroundSize: '16px 16px',
                  }}
                  data-testid="preview-bg-layer"
                />
                {/* Citra Hasil PNG RGBA dengan framing rasio pasfoto */}
                <div
                  className={`relative z-10 flex transition-all overflow-hidden rounded-md ${
                    currentSizeConfig.aspectRatio
                      ? 'h-[280px] max-w-full shadow-sm ring-1 ring-stone-900/10 items-end justify-center'
                      : 'max-h-[320px] max-w-full items-center justify-center'
                  }`}
                  style={{
                    aspectRatio: currentSizeConfig.aspectRatio
                      ? `${currentSizeConfig.aspectRatio}`
                      : undefined,
                  }}
                  data-testid="preview-frame-container"
                >
                  {/* Lapisan Blur Background */}
                  {selectedBg === 'blur' && originalFileUrl && (
                    <img
                      src={originalFileUrl}
                      alt="Latar belakang buram"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-110"
                      style={{
                        filter: `blur(${blurIntensity}px)`,
                      }}
                      data-testid="preview-blur-image"
                    />
                  )}
                  <img
                    src={activePreviewUrl || undefined}
                    alt="Subjek tanpa latar belakang"
                    className={`max-h-full max-w-full drop-shadow-sm relative z-10 ${
                      currentSizeConfig.aspectRatio
                        ? 'w-full h-full object-cover object-bottom'
                        : 'object-contain p-2'
                    }`}
                    data-testid="result-preview-image"
                  />
                </div>
              </div>

              {/* Pilihan Ukuran Pasfoto / Dokumen */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Crop className="w-3.5 h-3.5 text-teal-800" />
                    Ukuran Pasfoto &amp; Dokumen
                  </label>
                  <span className="text-xs text-stone-500 font-medium">
                    {currentSizeConfig.sublabel}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {SIZE_PRESETS.map((preset) => {
                    const isSelected = selectedSize === preset.id
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedSize(preset.id)}
                        data-testid={`preset-size-${preset.id}`}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all ${
                          isSelected
                            ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20 shadow-sm'
                            : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        <span>{preset.label}</span>
                        <span className="text-xs text-stone-400 font-normal">
                          ({preset.id === 'original' ? 'Full' : preset.sublabel.split(' ')[0]})
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Pilihan Warna Latar Belakang (Pasfoto / Transparan) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-teal-800" />
                  Warna Latar Belakang
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {BG_PRESETS.map((preset) => {
                    const isSelected = selectedBg === preset.color
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedBg(preset.color)}
                        data-testid={`preset-color-${preset.id}`}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20 shadow-sm'
                            : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-stone-300 overflow-hidden flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor:
                              preset.color === 'transparent' || preset.color === 'blur'
                                ? 'transparent'
                                : preset.color,
                            backgroundImage:
                              preset.color === 'transparent'
                                ? 'conic-gradient(#cbd5e1 90deg, #f1f5f9 90deg 180deg, #cbd5e1 180deg 270deg, #f1f5f9 270deg)'
                                : preset.color === 'blur'
                                  ? 'radial-gradient(circle, #38bdf8 15%, #818cf8 60%, #c084fc 100%)'
                                  : 'none',
                            backgroundSize: preset.color === 'transparent' ? '8px 8px' : 'auto',
                          }}
                        />
                        {preset.label}
                      </button>
                    )
                  })}

                  {/* Opsi Warna Kustom */}
                  <label
                    data-testid="preset-color-custom"
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                      selectedBg === 'custom'
                        ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20 shadow-sm'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <input
                      type="color"
                      aria-label="Pilih warna latar belakang kustom"
                      value={customColor}
                      onChange={(e) => {
                        setCustomColor(e.target.value)
                        setSelectedBg('custom')
                      }}
                      className="w-4 h-4 rounded cursor-pointer border-0 p-0"
                    />
                    <span>Kustom</span>
                  </label>
                </div>
              </div>

              {/* Kontrol Khusus Efek Blur Latar Belakang */}
              {selectedBg === 'blur' && (
                <div
                  className="p-3.5 bg-sky-50/70 border border-sky-200/80 rounded-xl space-y-3 animate-fade-in"
                  data-testid="blur-controls-panel"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-950 flex items-center gap-1.5">
                      <Focus className="w-3.5 h-3.5 text-sky-700" />
                      Intensitas Blur Latar Belakang
                    </span>
                    <span
                      className="text-xs font-mono font-bold text-sky-800 bg-sky-100/90 px-2 py-0.5 rounded border border-sky-200"
                      data-testid="blur-radius-display"
                    >
                      {blurIntensity} px
                    </span>
                  </div>

                  {/* Slider halus */}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-sky-700 font-medium select-none">Ringan</span>
                    <input
                      type="range"
                      min="4"
                      max="40"
                      step="2"
                      value={blurIntensity}
                      onChange={(e) => setBlurIntensity(Number(e.target.value))}
                      className="flex-1 h-2 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-700"
                      aria-label="Tingkat keburaman latar belakang foto"
                      data-testid="input-blur-radius"
                    />
                    <span className="text-[11px] text-sky-700 font-medium select-none">Kuat</span>
                  </div>

                  {/* Preset cepat */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {[
                      { label: 'Ringan', value: 8 },
                      { label: 'Sedang', value: 16 },
                      { label: 'Kuat', value: 28 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setBlurIntensity(preset.value)}
                        className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                          blurIntensity === preset.value
                            ? 'bg-sky-700 text-white border-sky-800 shadow-xs'
                            : 'bg-white text-sky-900 border-sky-200 hover:bg-sky-100/60'
                        }`}
                        data-testid={`btn-blur-preset-${preset.label.toLowerCase()}`}
                      >
                        {preset.label} ({preset.value}px)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rincian Metrik */}
              <div className="flex flex-wrap items-center justify-between text-xs text-stone-500 bg-stone-50 px-4 py-2.5 rounded-lg border border-stone-200">
                <div className="flex items-center gap-1.5 text-teal-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  Selesai diproses
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  {result.originalSize && (
                    <span>Ukuran Asli: {formatBytes(result.originalSize)}</span>
                  )}
                  {result.processedSize && (
                    <span className="font-semibold text-stone-700">
                      Hasil: {formatBytes(result.processedSize)}
                    </span>
                  )}
                  {result.inferenceTimeMs !== undefined && result.inferenceTimeMs > 0 && (
                    <span className="text-stone-400">
                      ({(result.inferenceTimeMs / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Meja Kerja */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-200 bg-stone-50/80">
          {result ? (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Ganti Foto Lain
            </button>
          ) : (
            <div className="text-xs text-stone-400">Maks. 10 MB per foto</div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Tutup
            </button>

            {result && selectedBg !== 'transparent' && (
              <div
                className="flex items-center border border-stone-200 rounded-lg overflow-hidden bg-white text-xs"
                data-testid="export-format-selector"
              >
                <button
                  type="button"
                  onClick={() => setExportFormat('png')}
                  data-testid="btn-format-png"
                  className={`px-2.5 py-1.5 font-semibold transition-colors ${
                    exportFormat === 'png'
                      ? 'bg-stone-800 text-white'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  PNG
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('jpeg')}
                  data-testid="btn-format-jpeg"
                  className={`px-2.5 py-1.5 font-semibold transition-colors ${
                    exportFormat === 'jpeg'
                      ? 'bg-stone-800 text-white'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  JPG
                </button>
              </div>
            )}

            {result && (
              <button
                type="button"
                onClick={handleDownload}
                data-testid="btn-download-nobg"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-teal-700"
              >
                <Download className="w-4 h-4" />
                Unduh {(selectedBg === 'transparent' ? 'png' : exportFormat).toUpperCase()}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
