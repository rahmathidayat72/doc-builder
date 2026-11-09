import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  QrCode,
  Download,
  AlertTriangle,
  X,
  ShieldCheck,
  Palette,
  Sliders,
  Type,
  Link as LinkIcon,
  CheckCircle2,
} from 'lucide-react'
import QRCode from 'qrcode'
import { downloadImageBlob } from '../../services/imageTools'

interface QrCodeGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
}

type QrMode = 'text' | 'url'
type QrSize = 256 | 512 | 1024

const MAX_BYTES = 2000

const COLOR_PRESETS = [
  { id: 'classic', label: 'Hitam - Putih', dark: '#000000', light: '#FFFFFF' },
  { id: 'forest', label: 'Teal - Putih', dark: '#0F766E', light: '#FFFFFF' },
  { id: 'navy', label: 'Navy - Krem', dark: '#0F172A', light: '#FFFDF7' },
  { id: 'charcoal', label: 'Arang - Abu', dark: '#1E293B', light: '#F1F5F9' },
]

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16)
    const g = parseInt(clean[1] + clean[1], 16)
    const b = parseInt(clean[2] + clean[2], 16)
    return [r, g, b]
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16)
    const g = parseInt(clean.substring(2, 4), 16)
    const b = parseInt(clean.substring(4, 6), 16)
    return [r, g, b]
  }
  return null
}

function getLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function checkColorContrast(
  fgHex: string,
  bgHex: string
): { ratio: number; isValid: boolean; reason?: string } {
  const fgRgb = hexToRgb(fgHex)
  const bgRgb = hexToRgb(bgHex)
  if (!fgRgb || !bgRgb) {
    return { ratio: 1, isValid: false, reason: 'Format kode warna heksadesimal tidak valid.' }
  }

  const lFg = getLuminance(fgRgb)
  const lBg = getLuminance(bgRgb)

  if (lFg >= lBg) {
    return {
      ratio: (lFg + 0.05) / (lBg + 0.05),
      isValid: false,
      reason: 'Warna modul QR harus lebih gelap daripada warna latar belakang.',
    }
  }

  const ratio = (lBg + 0.05) / (lFg + 0.05)
  if (ratio < 3.0) {
    return {
      ratio,
      isValid: false,
      reason: `Rasio kontras (${ratio.toFixed(1)}:1) terlalu rendah. Minimal rasio yang disarankan adalah 3:1 agar kode dapat dipindai.`,
    }
  }

  return { ratio, isValid: true }
}

export const QrCodeGeneratorModal: React.FC<QrCodeGeneratorModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<QrMode>('text')
  const [textPayload, setTextPayload] = useState<string>('')
  const [urlPayload, setUrlPayload] = useState<string>('')

  const [size, setSize] = useState<QrSize>(512)
  const [darkColor, setDarkColor] = useState<string>('#000000')
  const [lightColor, setLightColor] = useState<string>('#FFFFFF')

  const [activeQrData, setActiveQrData] = useState<string | null>(null)
  const [isStale, setIsStale] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const currentPayload = mode === 'text' ? textPayload : urlPayload
  const byteLength = new TextEncoder().encode(currentPayload).length

  const contrastResult = checkColorContrast(darkColor, lightColor)

  const handleClose = useCallback(() => {
    setTextPayload('')
    setUrlPayload('')
    setActiveQrData(null)
    setIsStale(false)
    setErrorMessage(null)
    setDarkColor('#000000')
    setLightColor('#FFFFFF')
    setSize(512)
    setMode('text')
    onClose()
  }, [onClose])

  // Tutup dengan Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  const handlePayloadChange = (val: string) => {
    if (mode === 'text') {
      setTextPayload(val)
    } else {
      setUrlPayload(val)
    }
    if (activeQrData) {
      setIsStale(true)
    }
    setErrorMessage(null)
  }

  const handleModeChange = (newMode: QrMode) => {
    setMode(newMode)
    setErrorMessage(null)
    if (activeQrData) {
      setIsStale(true)
    }
  }

  const handleColorChange = (dark: string, light: string) => {
    setDarkColor(dark)
    setLightColor(light)
    if (activeQrData) {
      setIsStale(true)
    }
  }

  const handleSizeChange = (newSize: QrSize) => {
    setSize(newSize)
    if (activeQrData) {
      setIsStale(true)
    }
  }

  const validateInput = (): { valid: boolean; error?: string } => {
    const trimmed = currentPayload.trim()
    if (!trimmed) {
      return { valid: false, error: 'Konten teks atau tautan tidak boleh kosong.' }
    }

    if (byteLength > MAX_BYTES) {
      return {
        valid: false,
        error: `Ukuran payload melebihi batas maksimal 2.000 byte (saat ini ${byteLength} byte).`,
      }
    }

    if (mode === 'url') {
      try {
        const parsed = new URL(trimmed)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return {
            valid: false,
            error: 'Hanya tautan berprotokol HTTP atau HTTPS yang diperbolehkan.',
          }
        }
        if (parsed.username || parsed.password) {
          return {
            valid: false,
            error: 'Tautan tidak boleh memuat kredensial pengguna (username atau password).',
          }
        }
      } catch {
        return {
          valid: false,
          error: 'Format URL tidak valid. Pastikan diawali dengan https:// atau http://.',
        }
      }
    }

    if (!contrastResult.isValid) {
      return {
        valid: false,
        error: contrastResult.reason || 'Kombinasi warna tidak memenuhi standar kontras QR.',
      }
    }

    return { valid: true }
  }

  const handleGenerate = async () => {
    setErrorMessage(null)
    const valResult = validateInput()
    if (!valResult.valid) {
      setErrorMessage(valResult.error || 'Input tidak valid.')
      return
    }

    setIsGenerating(true)
    try {
      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, currentPayload.trim(), {
          width: size,
          margin: 4,
          errorCorrectionLevel: 'M',
          color: {
            dark: darkColor,
            light: lightColor,
          },
        })
      }
      setActiveQrData(currentPayload.trim())
      setIsStale(false)
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menghasilkan gambar QR code.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadPng = () => {
    if (!canvasRef.current || !activeQrData || isStale) {
      setErrorMessage('Silakan tekan tombol Generate QR Code terlebih dahulu.')
      return
    }

    canvasRef.current.toBlob((blob) => {
      if (blob) {
        downloadImageBlob(blob, 'satukit-qr-code.png')
      } else {
        setErrorMessage('Gagal memproses berkas PNG dari kanvas.')
      }
    }, 'image/png')
  }

  const handleDownloadSvg = async () => {
    if (!activeQrData || isStale) {
      setErrorMessage('Silakan tekan tombol Generate QR Code terlebih dahulu.')
      return
    }

    try {
      const svgString = await QRCode.toString(activeQrData, {
        type: 'svg',
        width: size,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: {
          dark: darkColor,
          light: lightColor,
        },
      })
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      downloadImageBlob(blob, 'satukit-qr-code.svg')
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuat berkas vektor SVG.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-generator-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-overlay-in select-none"
    >
      <div className="relative w-full max-w-xl bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100/80 text-teal-800 rounded-xl">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 id="qr-generator-title" className="text-base font-bold text-stone-900 leading-snug">
                Generate QR Code
              </h2>
              <p className="text-xs text-stone-500">
                Buat kode QR instan 100% lokal di browser Anda untuk tautan atau teks.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            data-testid="btn-close-qr-modal"
            aria-label="Tutup jendela pembuat QR"
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Konten Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Alert Error */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-shake"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Mode Tabs: Teks vs URL */}
          <div className="flex p-1 bg-stone-100 rounded-xl">
            <button
              type="button"
              onClick={() => handleModeChange('text')}
              data-testid="tab-mode-text"
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'text'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              Teks Biasa
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('url')}
              data-testid="tab-mode-url"
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'url'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Tautan (URL)
            </button>
          </div>

          {/* Input Konten */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="input-qr-content"
                className="text-xs font-bold text-stone-700 uppercase tracking-wider"
              >
                {mode === 'text' ? 'Isi Teks' : 'Alamat Tautan (URL)'}
              </label>
              <span
                data-testid="text-byte-count"
                className={`text-2xs font-mono ${
                  byteLength > MAX_BYTES ? 'text-rose-600 font-bold' : 'text-stone-400'
                }`}
              >
                {byteLength} / {MAX_BYTES} byte
              </span>
            </div>

            {mode === 'text' ? (
              <textarea
                id="input-qr-content"
                rows={3}
                value={textPayload}
                onChange={(e) => handlePayloadChange(e.target.value)}
                placeholder="Ketik teks yang ingin diubah menjadi kode QR..."
                data-testid="input-qr-text"
                className="w-full px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition-all resize-y text-stone-900 placeholder:text-stone-400"
              />
            ) : (
              <input
                id="input-qr-content"
                type="url"
                value={urlPayload}
                onChange={(e) => handlePayloadChange(e.target.value)}
                placeholder="https://contoh.com/laman-tujuan"
                data-testid="input-qr-url"
                className="w-full px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition-all text-stone-900 placeholder:text-stone-400 font-mono"
              />
            )}
          </div>

          {/* Pilihan Ukuran Resolusi */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-teal-800" />
              Ukuran Ekspor
            </label>
            <div className="flex items-center gap-2">
              {([256, 512, 1024] as QrSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSizeChange(s)}
                  data-testid={`btn-size-${s}`}
                  className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-bold transition-all ${
                    size === s
                      ? 'border-teal-800 bg-teal-50 text-teal-900 ring-2 ring-teal-700/20'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  {s} × {s} px
                </button>
              ))}
            </div>
          </div>

          {/* Pengaturan Warna Modul & Latar Belakang */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-teal-800" />
                Warna QR
              </label>
              {!contrastResult.isValid && (
                <span className="text-2xs text-rose-600 font-bold">Kontras tidak layak</span>
              )}
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleColorChange(p.dark, p.light)}
                  data-testid={`btn-color-${p.id}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    darkColor.toUpperCase() === p.dark.toUpperCase() &&
                    lightColor.toUpperCase() === p.light.toUpperCase()
                      ? 'border-teal-800 bg-teal-50 text-teal-900 font-bold ring-2 ring-teal-700/20'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-stone-300"
                    style={{ backgroundColor: p.dark }}
                  />
                  <span>{p.label}</span>
                </button>
              ))}

              {/* Color pickers custom */}
              <div className="flex items-center gap-2 pl-1">
                <label
                  title="Warna Modul QR"
                  className="flex items-center gap-1 text-2xs text-stone-600 font-medium cursor-pointer"
                >
                  <span>QR:</span>
                  <input
                    type="color"
                    value={darkColor}
                    onChange={(e) => handleColorChange(e.target.value, lightColor)}
                    data-testid="input-color-dark"
                    aria-label="Pilih warna modul QR"
                    className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                  />
                </label>
                <label
                  title="Warna Latar Belakang"
                  className="flex items-center gap-1 text-2xs text-stone-600 font-medium cursor-pointer"
                >
                  <span>Latar:</span>
                  <input
                    type="color"
                    value={lightColor}
                    onChange={(e) => handleColorChange(darkColor, e.target.value)}
                    data-testid="input-color-light"
                    aria-label="Pilih warna latar QR"
                    className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {!contrastResult.isValid && (
              <p className="text-2xs text-rose-700 mt-1 leading-relaxed">
                {contrastResult.reason}
              </p>
            )}
          </div>

          {/* Tombol Generate Utama */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !contrastResult.isValid}
            data-testid="btn-generate-qr"
            className="w-full py-2.5 px-4 bg-teal-800 hover:bg-teal-900 disabled:bg-stone-300 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <QrCode className="w-4 h-4" />
            <span>{activeQrData ? 'Perbarui Kode QR' : 'Generate QR Code'}</span>
          </button>

          {/* Pratinjau Kanvas QR */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl flex flex-col items-center justify-center gap-3">
            <div className="relative p-2 bg-white rounded-xl shadow-xs border border-stone-200/80">
              <canvas
                ref={canvasRef}
                data-testid="qr-canvas-preview"
                className="max-w-[200px] max-h-[200px] w-auto h-auto rounded-lg"
              />
              {!activeQrData && (
                <div className="w-[180px] h-[180px] flex flex-col items-center justify-center text-stone-400 text-center p-3">
                  <QrCode className="w-10 h-10 stroke-1 mb-1.5 opacity-40" />
                  <span className="text-2xs">Tekan Generate QR Code untuk melihat pratinjau</span>
                </div>
              )}
            </div>

            {/* Status Pratinjau */}
            {activeQrData && isStale && (
              <p
                role="status"
                data-testid="badge-qr-stale"
                className="text-2xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200"
              >
                Konten atau warna telah diubah — tekan Generate untuk memperbarui
              </p>
            )}

            {activeQrData && !isStale && (
              <div className="flex items-center gap-1.5 text-2xs text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Kode QR siap diunduh ({size} × {size} px)</span>
              </div>
            )}

            {/* Tombol Unduh PNG & SVG */}
            <div className="flex items-center gap-2 w-full pt-1">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={!activeQrData || isStale}
                data-testid="btn-download-png"
                className="flex-1 py-2 px-3 bg-stone-800 hover:bg-stone-900 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh PNG
              </button>
              <button
                type="button"
                onClick={handleDownloadSvg}
                disabled={!activeQrData || isStale}
                data-testid="btn-download-svg"
                className="flex-1 py-2 px-3 bg-stone-100 hover:bg-stone-200 disabled:bg-stone-100 disabled:text-stone-300 text-stone-800 font-bold text-xs rounded-xl border border-stone-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh SVG
              </button>
            </div>
          </div>

          {/* Catatan Privasi & Keamanan */}
          <div className="p-3 bg-stone-100/70 border border-stone-200/60 rounded-xl flex items-start gap-2 text-2xs text-stone-600">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Diproses 100% lokal di browser menggunakan enkripsi algoritma QR standar (ECC Level M).
              Data teks/tautan Anda tidak disimpan atau dikirimkan ke server.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
