import React, { useState, useRef, useEffect } from 'react'
import {
  CircleUser,
  Upload,
  X,
  Loader2,
  Download,
  RotateCcw,
  Palette,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  Move,
  Sparkles,
  Image as ImageIcon,
  Circle,
  Square,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import {
  removeBackground,
  downloadImageBlob,
  type RemoveBackgroundResult,
} from '../../services/imageTools'
import { KituNotice } from '../brand/KituNotice'

interface PhotoProfileMakerModalProps {
  isOpen: boolean
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gagal memuat gambar'))
    img.src = url
  })
}

type AvatarShape = 'circle' | 'square'
type SubjectMode = 'original' | 'nobg'
type FitMode = 'contain' | 'cover'

interface PlatformPreset {
  id: string
  label: string
  sublabel: string
  size: number
}

const PLATFORM_PRESETS: PlatformPreset[] = [
  { id: 'general-512', label: 'Umum (512px)', sublabel: '512×512 px', size: 512 },
  { id: 'general-1080', label: 'HD (1080px)', sublabel: '1080×1080 px', size: 1080 },
  { id: 'linkedin', label: 'LinkedIn', sublabel: '400×400 px', size: 400 },
  { id: 'whatsapp', label: 'WhatsApp', sublabel: '500×500 px', size: 500 },
  { id: 'instagram', label: 'Instagram', sublabel: '1080×1080 px', size: 1080 },
]

interface BgOption {
  id: string
  label: string
  type: 'transparent' | 'color' | 'gradient' | 'blur'
  value: string
  previewStyle: React.CSSProperties
}

const BG_OPTIONS: BgOption[] = [
  {
    id: 'transparent',
    label: 'Transparan',
    type: 'transparent',
    value: 'transparent',
    previewStyle: {
      backgroundImage:
        'conic-gradient(#cbd5e1 90deg, #f1f5f9 90deg 180deg, #cbd5e1 180deg 270deg, #f1f5f9 270deg)',
      backgroundSize: '8px 8px',
    },
  },
  {
    id: 'white',
    label: 'Putih',
    type: 'color',
    value: '#FFFFFF',
    previewStyle: { backgroundColor: '#FFFFFF' },
  },
  {
    id: 'slate',
    label: 'Slate',
    type: 'color',
    value: '#1e293b',
    previewStyle: { backgroundColor: '#1e293b' },
  },
  {
    id: 'teal',
    label: 'Forest Teal',
    type: 'color',
    value: '#0f766e',
    previewStyle: { backgroundColor: '#0f766e' },
  },
  {
    id: 'sky',
    label: 'Sky Blue',
    type: 'color',
    value: '#0284c7',
    previewStyle: { backgroundColor: '#0284c7' },
  },
  {
    id: 'amber',
    label: 'Warm Amber',
    type: 'color',
    value: '#d97706',
    previewStyle: { backgroundColor: '#d97706' },
  },
  {
    id: 'grad-sunset',
    label: 'Sunset',
    type: 'gradient',
    value: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    previewStyle: {
      backgroundImage: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    },
  },
  {
    id: 'grad-ocean',
    label: 'Ocean',
    type: 'gradient',
    value: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    previewStyle: {
      backgroundImage: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    },
  },
  {
    id: 'grad-emerald',
    label: 'Emerald',
    type: 'gradient',
    value: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    previewStyle: {
      backgroundImage: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    },
  },
  {
    id: 'blur',
    label: 'Blur Latar',
    type: 'blur',
    value: 'blur',
    previewStyle: {
      backgroundImage:
        'radial-gradient(circle, #38bdf8 15%, #818cf8 60%, #c084fc 100%)',
    },
  },
]

const BORDER_WIDTHS = [
  { id: 'none', label: '0px', value: 0 },
  { id: 'thin', label: '4px', value: 4 },
  { id: 'medium', label: '8px', value: 8 },
  { id: 'thick', label: '14px', value: 14 },
]

const BORDER_COLORS = [
  { id: 'white', label: 'Putih', color: '#FFFFFF' },
  { id: 'teal', label: 'Teal', color: '#0f766e' },
  { id: 'charcoal', label: 'Charcoal', color: '#1c1917' },
  { id: 'gold', label: 'Gold', color: '#f59e0b' },
]

export const PhotoProfileMakerModal: React.FC<PhotoProfileMakerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [originalFileUrl, setOriginalFileUrl] = useState<string | null>(null)
  const [_nobgResult, setNobgResult] = useState<RemoveBackgroundResult | null>(null)
  const [nobgUrl, setNobgUrl] = useState<string | null>(null)
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Opsi Avatar
  const [subjectMode, setSubjectMode] = useState<SubjectMode>('original')
  const [shape, setShape] = useState<AvatarShape>('circle')
  const [fitMode, setFitMode] = useState<FitMode>('contain')
  const [zoom, setZoom] = useState<number>(100) // 20% to 300%
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [selectedBgId, setSelectedBgId] = useState<string>('white')
  const [customBgColor, setCustomBgColor] = useState<string>('#4A90E2')
  const [borderWidth, setBorderWidth] = useState<number>(0)
  const [borderColor, setBorderColor] = useState<string>('#FFFFFF')
  const [selectedPresetId, setSelectedPresetId] = useState<string>('general-512')
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png')
  const [isDragOver, setIsDragOver] = useState<boolean>(false)

  // Drag interaction state
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const offsetStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bersihkan Object URLs saat ditutup atau unmount
  useEffect(() => {
    return () => {
      if (originalFileUrl) URL.revokeObjectURL(originalFileUrl)
      if (nobgUrl) URL.revokeObjectURL(nobgUrl)
    }
  }, [originalFileUrl, nobgUrl])

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

  const activePreset =
    PLATFORM_PRESETS.find((p) => p.id === selectedPresetId) || PLATFORM_PRESETS[0]

  const activeBg =
    BG_OPTIONS.find((b) => b.id === selectedBgId) || BG_OPTIONS[1] // default white

  const handleSelectFile = (selected: File) => {
    if (selected.size > 10 * 1024 * 1024) {
      setErrorMessage('Ukuran berkas melebihi batas 10 MB.')
      return
    }

    setFile(selected)
    setErrorMessage(null)
    setNobgResult(null)
    setZoom(100)
    setPanOffset({ x: 0, y: 0 })
    setSubjectMode('original')
    setFitMode('contain')

    if (originalFileUrl) URL.revokeObjectURL(originalFileUrl)
    if (nobgUrl) {
      URL.revokeObjectURL(nobgUrl)
      setNobgUrl(null)
    }

    const origUrl = URL.createObjectURL(selected)
    setOriginalFileUrl(origUrl)
  }

  const handleToggleNobg = async () => {
    if (subjectMode === 'nobg') {
      setSubjectMode('original')
      return
    }

    // Jika sudah punya hasil nobg sebelumnya, langsung gunakan
    if (nobgUrl) {
      setSubjectMode('nobg')
      setFitMode('contain')
      setZoom(100)
      setPanOffset({ x: 0, y: 0 })
      return
    }

    // Jika belum ada, panggil model segmentasi U2NetP AI lokal
    if (!file) return

    setIsAiLoading(true)
    setErrorMessage(null)
    const res = await removeBackground(file)
    setIsAiLoading(false)

    if (res.success && res.blob) {
      setNobgResult(res)
      const url = URL.createObjectURL(res.blob)
      setNobgUrl(url)
      setSubjectMode('nobg')
      setFitMode('contain')
      setZoom(100)
      setPanOffset({ x: 0, y: 0 })
    } else {
      setErrorMessage(res.message || 'Gagal menghapus latar belakang gambar.')
    }
  }

  // Pointer drag handling untuk geser posisi foto
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!originalFileUrl) return
    isDraggingRef.current = true
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    offsetStartRef.current = { ...panOffset }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    setPanOffset({
      x: Math.round(offsetStartRef.current.x + dx),
      y: Math.round(offsetStartRef.current.y + dy),
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {
      // safe ignore
    }
  }

  const handleResetPosition = () => {
    setZoom(100)
    setPanOffset({ x: 0, y: 0 })
  }

  const handleFitObject = () => {
    setFitMode('contain')
    setZoom(100)
    setPanOffset({ x: 0, y: 0 })
  }

  const handleNudge = (dx: number, dy: number) => {
    setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const handleResetAll = () => {
    setFile(null)
    setNobgResult(null)
    setErrorMessage(null)
    setSubjectMode('original')
    setShape('circle')
    setFitMode('contain')
    setZoom(100)
    setPanOffset({ x: 0, y: 0 })
    setSelectedBgId('white')
    setBorderWidth(0)
    setBorderColor('#FFFFFF')
    setSelectedPresetId('general-512')
    setExportFormat('png')

    if (originalFileUrl) {
      URL.revokeObjectURL(originalFileUrl)
      setOriginalFileUrl(null)
    }
    if (nobgUrl) {
      URL.revokeObjectURL(nobgUrl)
      setNobgUrl(null)
    }
  }

  const handleDownload = () => {
    if (!file || !originalFileUrl) return

    const sourceUrl = subjectMode === 'nobg' && nobgUrl ? nobgUrl : originalFileUrl
    const targetSize = activePreset.size
    const previewBoxSize = 260 // Ukuran panggung pratinjau acuan di UI (px)
    const scaleRatio = targetSize / previewBoxSize

    const isBlur = selectedBgId === 'blur' && !!originalFileUrl

    Promise.all([
      loadImage(sourceUrl),
      isBlur ? loadImage(originalFileUrl) : Promise.resolve(null),
    ])
      .then(([subjectImg, origImg]) => {
        const canvas = document.createElement('canvas')
        canvas.width = targetSize
        canvas.height = targetSize
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          downloadImageBlob(file, `${file.name.replace(/\.[^/.]+$/, '')}_profile.png`)
          return
        }

        const effectiveFormat = exportFormat
        const isCircle = shape === 'circle'

        // 1. Jika lingkaran & format JPEG, isi latar kanvas terluar dengan putih
        if (isCircle && effectiveFormat === 'jpeg') {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, targetSize, targetSize)
        }

        // 2. Terapkan kliping bentuk avatar (lingkaran / persegi)
        ctx.save()
        if (isCircle) {
          ctx.beginPath()
          ctx.arc(targetSize / 2, targetSize / 2, targetSize / 2, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
        }

        // 3. Render latar belakang avatar di dalam area klip
        if (selectedBgId === 'custom') {
          ctx.fillStyle = customBgColor
          ctx.fillRect(0, 0, targetSize, targetSize)
        } else if (activeBg.type === 'color') {
          ctx.fillStyle = activeBg.value
          ctx.fillRect(0, 0, targetSize, targetSize)
        } else if (activeBg.type === 'gradient') {
          // Buat gradien linear diagonal 135deg
          const grad = ctx.createLinearGradient(0, 0, targetSize, targetSize)
          if (activeBg.id === 'grad-sunset') {
            grad.addColorStop(0, '#f97316')
            grad.addColorStop(1, '#ec4899')
          } else if (activeBg.id === 'grad-ocean') {
            grad.addColorStop(0, '#06b6d4')
            grad.addColorStop(1, '#3b82f6')
          } else if (activeBg.id === 'grad-emerald') {
            grad.addColorStop(0, '#10b981')
            grad.addColorStop(1, '#047857')
          }
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, targetSize, targetSize)
        } else if (activeBg.type === 'blur' && origImg) {
          ctx.save()
          if ('filter' in ctx) {
            ctx.filter = `blur(${Math.round(18 * scaleRatio)}px)`
          }
          // Overdraw +8% agar tepi blur tidak pudar
          const bScale = Math.max(targetSize / origImg.width, targetSize / origImg.height) * 1.08
          const bw = origImg.width * bScale
          const bh = origImg.height * bScale
          const bx = (targetSize - bw) / 2
          const by = (targetSize - bh) / 2
          ctx.drawImage(origImg, bx, by, bw, bh)
          ctx.restore()
        }
        // Jika transparent: biarkan transparan untuk PNG

        // 4. Gambar citra subjek dengan posisi (pan) & skala (zoom)
        const safePadding =
          fitMode === 'contain'
            ? (shape === 'circle' ? 32 : 12) * scaleRatio
            : 0
        const availWidth = targetSize - safePadding * 2
        const availHeight = targetSize - safePadding * 2
        const baseScale =
          fitMode === 'contain'
            ? Math.min(availWidth / subjectImg.width, availHeight / subjectImg.height)
            : Math.max(targetSize / subjectImg.width, targetSize / subjectImg.height)
        const effectiveZoom = zoom / 100
        const sw = subjectImg.width * baseScale * effectiveZoom
        const sh = subjectImg.height * baseScale * effectiveZoom
        const sx = (targetSize - sw) / 2 + panOffset.x * scaleRatio
        const sy = (targetSize - sh) / 2 + panOffset.y * scaleRatio

        ctx.drawImage(subjectImg, sx, sy, sw, sh)

        // 5. Gambar garis tepi (Border) jika aktif
        if (borderWidth > 0) {
          const canvasBorder = Math.max(1, borderWidth * scaleRatio)
          ctx.lineWidth = canvasBorder
          ctx.strokeStyle = borderColor

          if (isCircle) {
            ctx.beginPath()
            ctx.arc(
              targetSize / 2,
              targetSize / 2,
              targetSize / 2 - canvasBorder / 2,
              0,
              Math.PI * 2
            )
            ctx.stroke()
          } else {
            ctx.strokeRect(
              canvasBorder / 2,
              canvasBorder / 2,
              targetSize - canvasBorder,
              targetSize - canvasBorder
            )
          }
        }

        ctx.restore()

        const baseStem = file.name.replace(/\.[^/.]+$/, '')
        const filename = `${baseStem}_profile_${shape}_${targetSize}x${targetSize}.${effectiveFormat === 'jpeg' ? 'jpg' : 'png'}`
        const mimeType = effectiveFormat === 'jpeg' ? 'image/jpeg' : 'image/png'

        canvas.toBlob(
          (blob) => {
            if (blob) {
              downloadImageBlob(blob, filename)
            } else {
              downloadImageBlob(file, `${baseStem}_profile.png`)
            }
          },
          mimeType,
          effectiveFormat === 'jpeg' ? 0.94 : undefined
        )
      })
      .catch(() => {
        downloadImageBlob(file, `${file.name.replace(/\.[^/.]+$/, '')}_profile.png`)
      })
  }

  const currentDisplayUrl =
    subjectMode === 'nobg' && nobgUrl ? nobgUrl : originalFileUrl

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-maker-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isAiLoading) onClose()
      }}
    >
      <div className="relative w-full max-w-2xl bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
              <CircleUser className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="profile-maker-modal-title"
                className="text-lg font-bold text-stone-900"
              >
                Photo Profile Maker
              </h2>
              <p className="text-xs text-stone-500">
                Avatar profesional media sosial • 100% offline &amp; privat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isAiLoading}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-700"
            aria-label="Tutup dialog"
            data-testid="btn-close-profile-maker"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Isi Dialog */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Alert Error */}
          {errorMessage && (
            <KituNotice
              tone="error"
              expression="sedih"
              title="Gagal Mengedit Foto Profil"
              role="alert"
            >
              <span>{errorMessage}</span>
            </KituNotice>
          )}

          {/* Kondisi 1: Belum ada file yang dipilih */}
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
                  handleSelectFile(e.dataTransfer.files[0])
                }
              }}
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
                aria-label="Unggah foto profil"
                data-testid="file-input-profile-maker"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleSelectFile(e.target.files[0])
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

          {/* Kondisi 2: Foto sudah dipilih -> Meja Kerja Avatar */}
          {file && currentDisplayUrl && (
            <div className="space-y-5 animate-fade-in">
              {/* Panggung Pratinjau Interaktif */}
              <div className="flex flex-col items-center justify-center p-4 bg-stone-100 border border-stone-200 rounded-xl relative select-none">
                {/* Petunjuk Drag */}
                <div className="absolute top-2.5 left-3 text-[11px] text-stone-500 font-medium flex items-center gap-1">
                  <Move className="w-3 h-3 text-stone-400" />
                  Tarik untuk geser posisi
                </div>

                {/* Wadah Kanvas Avatar 260x260 */}
                <div
                  data-testid="avatar-preview-canvas"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onWheel={(e) => {
                    const delta = e.deltaY < 0 ? 5 : -5
                    setZoom((prev) => Math.max(20, Math.min(300, prev + delta)))
                  }}
                  className={`relative w-[260px] h-[260px] cursor-grab active:cursor-grabbing shadow-lg transition-all ${
                    shape === 'circle' ? 'rounded-full' : 'rounded-2xl'
                  }`}
                  style={{
                    overflow: 'hidden',
                    border:
                      borderWidth > 0
                        ? `${borderWidth}px solid ${borderColor}`
                        : '1px solid rgba(0,0,0,0.08)',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Lapisan Latar Belakang */}
                  <div
                    data-testid="avatar-bg-layer"
                    className="absolute inset-0 transition-colors pointer-events-none"
                    style={{
                      backgroundColor:
                        selectedBgId === 'custom'
                          ? customBgColor
                          : activeBg.type === 'color'
                            ? activeBg.value
                            : 'transparent',
                      backgroundImage:
                        selectedBgId === 'custom'
                          ? 'none'
                          : activeBg.type === 'gradient'
                            ? activeBg.value
                            : activeBg.type === 'transparent'
                              ? 'conic-gradient(#cbd5e1 90deg, #f1f5f9 90deg 180deg, #cbd5e1 180deg 270deg, #f1f5f9 270deg)'
                              : 'none',
                      backgroundSize:
                        activeBg.type === 'transparent' ? '12px 12px' : 'auto',
                    }}
                  />

                  {/* Efek Blur Latar Belakang */}
                  {selectedBgId === 'blur' && originalFileUrl && (
                    <img
                      src={originalFileUrl}
                      alt="Latar belakang buram"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-125"
                      style={{ filter: 'blur(16px)' }}
                      data-testid="avatar-blur-bg"
                    />
                  )}

                  {/* Subjek Foto (Foto Asli atau Hasil Hapus Latar) */}
                  <img
                    src={currentDisplayUrl}
                    alt="Subjek foto profil"
                    draggable={false}
                    className={`absolute inset-0 w-full h-full pointer-events-none transition-transform duration-75 ${
                      fitMode === 'contain' ? 'object-contain' : 'object-cover'
                    }`}
                    style={{
                      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
                      padding:
                        fitMode === 'contain'
                          ? shape === 'circle'
                            ? '32px'
                            : '12px'
                          : '0px',
                      boxSizing: 'border-box',
                    }}
                    data-testid="avatar-subject-image"
                  />
                </div>

                {/* Tombol Nudge Navigasi & Reset Posisi */}
                <div className="flex items-center gap-2 mt-3 text-xs">
                  <span className="text-stone-500 font-medium">Posisi:</span>
                  <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => handleNudge(-10, 0)}
                      aria-label="Geser ke kiri"
                      className="px-2 py-1 hover:bg-stone-100 rounded text-stone-700 font-bold"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNudge(0, -10)}
                      aria-label="Geser ke atas"
                      className="px-2 py-1 hover:bg-stone-100 rounded text-stone-700 font-bold"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNudge(0, 10)}
                      aria-label="Geser ke bawah"
                      className="px-2 py-1 hover:bg-stone-100 rounded text-stone-700 font-bold"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNudge(10, 0)}
                      aria-label="Geser ke kanan"
                      className="px-2 py-1 hover:bg-stone-100 rounded text-stone-700 font-bold"
                    >
                      →
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPosition}
                    data-testid="btn-reset-position"
                    className="px-2.5 py-1 text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-lg text-xs font-medium hover:bg-stone-50 transition-colors"
                  >
                    Tengah
                  </button>
                </div>
              </div>

              {/* 1. Mode Subjek: Foto Asli vs Hapus Latar Belakang */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-800" />
                  Mode Subjek Foto
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSubjectMode('original')}
                    data-testid="btn-mode-original"
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                      subjectMode === 'original'
                        ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Foto Asli (Cepat)
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleNobg}
                    disabled={isAiLoading}
                    data-testid="btn-mode-nobg"
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                      subjectMode === 'nobg'
                        ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    {isAiLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
                        AI Memproses...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                        Hapus Latar Belakang
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 2. Bentuk Avatar: Lingkaran vs Persegi */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Circle className="w-3.5 h-3.5 text-teal-800" />
                  Bentuk Avatar
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShape('circle')}
                    data-testid="btn-shape-circle"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      shape === 'circle'
                        ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20 font-bold'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <Circle className="w-3.5 h-3.5" />
                    Lingkaran (Bulat)
                  </button>

                  <button
                    type="button"
                    onClick={() => setShape('square')}
                    data-testid="btn-shape-square"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      shape === 'square'
                        ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20 font-bold'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <Square className="w-3.5 h-3.5" />
                    Persegi (Rounded)
                  </button>
                </div>
              </div>

              {/* 3. Pemotongan Objek: Pas Utuh vs Isi Penuh */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Minimize2 className="w-3.5 h-3.5 text-teal-800" />
                  Pemotongan Objek
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFitMode('contain')
                      setZoom(100)
                      setPanOffset({ x: 0, y: 0 })
                    }}
                    data-testid="btn-fit-contain"
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                      fitMode === 'contain'
                        ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    Pas Utuh (Tidak Terpotong)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFitMode('cover')
                      setZoom(100)
                      setPanOffset({ x: 0, y: 0 })
                    }}
                    data-testid="btn-fit-cover"
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                      fitMode === 'cover'
                        ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Isi Penuh (Crop Frame)
                  </button>
                </div>
              </div>

              {/* 4. Slider Zoom Foto (Zoom In / Out) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ZoomIn className="w-3.5 h-3.5 text-teal-800" />
                    Ukuran Objek (Zoom In / Out)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleFitObject}
                      data-testid="btn-zoom-fit"
                      className="px-2 py-0.5 text-[11px] font-semibold text-teal-900 bg-teal-50 border border-teal-300 rounded hover:bg-teal-100 transition-colors"
                      title="Sesuaikan ukuran foto agar objek pas utuh tanpa terpotong"
                    >
                      Pas Utuh
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(100)}
                      data-testid="btn-zoom-100"
                      className="px-2 py-0.5 text-[11px] font-medium text-stone-600 bg-stone-100 border border-stone-200 rounded hover:bg-stone-200 transition-colors"
                      title="Kembalikan zoom ke 100%"
                    >
                      100%
                    </button>
                    <span
                      className="text-xs font-mono font-bold text-stone-800 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 min-w-[48px] text-center"
                      data-testid="zoom-level-display"
                    >
                      {zoom}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.max(20, prev - 10))}
                    disabled={zoom <= 20}
                    aria-label="Perkecil zoom foto"
                    data-testid="btn-zoom-out"
                    className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Perkecil (Zoom Out)"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>

                  <input
                    type="range"
                    min="20"
                    max="300"
                    step="5"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    aria-label="Atur tingkat zoom foto profil"
                    data-testid="input-zoom-slider"
                    className="flex-1 h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-teal-800"
                  />

                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.min(300, prev + 10))}
                    disabled={zoom >= 300}
                    aria-label="Perbesar zoom foto"
                    data-testid="btn-zoom-in"
                    className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Perbesar (Zoom In)"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 5. Pilihan Warna & Efek Latar Belakang */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-teal-800" />
                  Warna &amp; Efek Latar
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {BG_OPTIONS.map((opt) => {
                    const isSelected = selectedBgId === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedBgId(opt.id)}
                        data-testid={`btn-bg-${opt.id}`}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20'
                            : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-stone-300 overflow-hidden shrink-0"
                          style={opt.previewStyle}
                        />
                        {opt.label}
                      </button>
                    )
                  })}

                  {/* Warna Kustom */}
                  <label
                    data-testid="btn-bg-custom"
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                      selectedBgId === 'custom'
                        ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <input
                      type="color"
                      aria-label="Pilih warna latar belakang kustom"
                      value={customBgColor}
                      onChange={(e) => {
                        setCustomBgColor(e.target.value)
                        setSelectedBgId('custom')
                      }}
                      className="w-3.5 h-3.5 rounded cursor-pointer border-0 p-0"
                    />
                    <span>Kustom</span>
                  </label>
                </div>
              </div>

              {/* 6. Garis Tepi (Border) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Circle className="w-3.5 h-3.5 text-teal-800" />
                  Garis Tepi (Border)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1">
                    {BORDER_WIDTHS.map((bw) => (
                      <button
                        key={bw.id}
                        type="button"
                        onClick={() => setBorderWidth(bw.value)}
                        data-testid={`btn-border-width-${bw.id}`}
                        className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                          borderWidth === bw.value
                            ? 'bg-stone-800 text-white border-stone-800'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {bw.label}
                      </button>
                    ))}
                  </div>

                  {borderWidth > 0 && (
                    <div className="flex items-center gap-1 border-l border-stone-200 pl-3">
                      {BORDER_COLORS.map((bc) => (
                        <button
                          key={bc.id}
                          type="button"
                          onClick={() => setBorderColor(bc.color)}
                          data-testid={`btn-border-color-${bc.id}`}
                          title={bc.label}
                          className={`w-5 h-5 rounded-full border transition-all ${
                            borderColor === bc.color
                              ? 'ring-2 ring-teal-700 ring-offset-1 border-stone-400'
                              : 'border-stone-300'
                          }`}
                          style={{ backgroundColor: bc.color }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 7. Preset Ukuran Platform */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Ukuran Platform Tujuan
                  </label>
                  <span className="text-xs text-stone-500 font-medium">
                    {activePreset.sublabel}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {PLATFORM_PRESETS.map((p) => {
                    const isSelected = selectedPresetId === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPresetId(p.id)}
                        data-testid={`btn-preset-${p.id}`}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20 font-bold'
                            : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Rincian Berkas */}
              <div className="flex items-center justify-between text-xs text-stone-500 bg-stone-50 px-4 py-2.5 rounded-lg border border-stone-200">
                <span className="font-medium text-stone-700 truncate max-w-[240px]">
                  {file.name}
                </span>
                <span>{formatBytes(file.size)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Meja Kerja */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-200 bg-stone-50/80">
          {file ? (
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Ganti Foto
            </button>
          ) : (
            <div className="text-xs text-stone-400">Maks. 10 MB per foto</div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isAiLoading}
              className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Tutup
            </button>

            {file && (
              <div
                className="flex items-center border border-stone-200 rounded-lg overflow-hidden bg-white text-xs"
                data-testid="profile-export-format-selector"
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

            {file && (
              <button
                type="button"
                onClick={handleDownload}
                data-testid="btn-download-profile"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-teal-700"
              >
                <Download className="w-4 h-4" />
                Unduh Avatar ({activePreset.size}px)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
