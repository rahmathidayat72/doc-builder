import React, { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Download,
  RotateCcw,
  Palette,
  ShieldCheck,
} from 'lucide-react'
import {
  removeBackground,
  downloadImageBlob,
  type RemoveBackgroundResult,
} from '../../services/imageTools'

interface RemoveBackgroundModalProps {
  isOpen: boolean
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const BG_PRESETS = [
  { id: 'transparent', label: 'Transparan', color: 'transparent' },
  { id: 'white', label: 'Putih', color: '#FFFFFF' },
  { id: 'red', label: 'Merah Pasfoto', color: '#D32F2F' },
  { id: 'blue', label: 'Biru Pasfoto', color: '#1976D2' },
  { id: 'gray', label: 'Abu-abu', color: '#E5E7EB' },
]

export const RemoveBackgroundModal: React.FC<RemoveBackgroundModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<RemoveBackgroundResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedBg, setSelectedBg] = useState<string>('transparent')
  const [customColor, setCustomColor] = useState<string>('#4A90E2')
  const [isDragOver, setIsDragOver] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bersihkan object URL saat modal ditutup atau unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
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

  const handleProcessFile = async (selected: File) => {
    if (selected.size > 10 * 1024 * 1024) {
      setErrorMessage('Ukuran berkas melebihi batas 10 MB.')
      return
    }

    setFile(selected)
    setErrorMessage(null)
    setResult(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }

    setIsLoading(true)
    const res = await removeBackground(selected)
    setIsLoading(false)

    if (res.success && res.blob) {
      setResult(res)
      const url = URL.createObjectURL(res.blob)
      setPreviewUrl(url)
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
    if (!result || !result.blob || !previewUrl) return

    const baseName = (file?.name || 'image').replace(/\.[^/.]+$/, '')

    // Jika latar belakang transparan, unduh blob asli
    if (selectedBg === 'transparent') {
      downloadImageBlob(result.blob, `${baseName}_nobg.png`)
      return
    }

    // Jika warna latar belakang dipilih, kompositkan ke canvas lalu unduh
    const targetColor = selectedBg === 'custom' ? customColor : selectedBg
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        downloadImageBlob(result.blob!, `${baseName}_nobg.png`)
        return
      }

      // 1. Gambar latar belakang solid
      ctx.fillStyle = targetColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 2. Gambar subjek transparan di atasnya
      ctx.drawImage(img, 0, 0)

      canvas.toBlob((colorBlob) => {
        if (colorBlob) {
          const colorName =
            BG_PRESETS.find((p) => p.color === targetColor)?.id || 'custom'
          downloadImageBlob(colorBlob, `${baseName}_${colorName}.png`)
        } else {
          downloadImageBlob(result.blob!, `${baseName}_nobg.png`)
        }
      }, 'image/png')
    }
    img.src = previewUrl
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setErrorMessage(null)
    setSelectedBg('transparent')
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
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
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="remove-bg-modal-title"
                className="text-lg font-bold text-stone-900"
              >
                Hapus Latar Belakang Foto
              </h2>
              <p className="text-xs text-stone-500">
                Segmentasi AI U2NetP lokal • 100% offline &amp; privat
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
            <div
              role="alert"
              className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-rose-800 text-sm"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Terjadi Kesalahan</p>
                <p className="mt-0.5 text-xs text-rose-700">{errorMessage}</p>
              </div>
            </div>
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
              <div className="relative border border-stone-200 rounded-xl overflow-hidden bg-stone-100 flex items-center justify-center min-h-[260px] max-h-[360px]">
                {/* Layer Latar Belakang Terpilih */}
                <div
                  className="absolute inset-0 transition-colors"
                  style={{
                    backgroundColor:
                      selectedBg === 'transparent'
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
                {/* Citra Hasil PNG RGBA */}
                <img
                  src={previewUrl}
                  alt="Subjek tanpa latar belakang"
                  className="relative max-h-[340px] max-w-full object-contain z-10 drop-shadow-sm p-3"
                  data-testid="result-preview-image"
                />
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
                          className="w-3.5 h-3.5 rounded-full border border-stone-300"
                          style={{
                            backgroundColor:
                              preset.color === 'transparent' ? 'transparent' : preset.color,
                            backgroundImage:
                              preset.color === 'transparent'
                                ? 'conic-gradient(#cbd5e1 90deg, #f1f5f9 90deg 180deg, #cbd5e1 180deg 270deg, #f1f5f9 270deg)'
                                : 'none',
                            backgroundSize: '8px 8px',
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

            {result && (
              <button
                type="button"
                onClick={handleDownload}
                data-testid="btn-download-nobg"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-teal-700"
              >
                <Download className="w-4 h-4" />
                Unduh PNG
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
