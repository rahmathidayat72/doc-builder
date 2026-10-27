import React, { useState, useEffect } from 'react'
import {
  Stamp,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  FileText,
  Type,
  ImageIcon,
  Grid,
} from 'lucide-react'
import { watermarkPdf, type PdfToolResult } from '../../services/pdfTools'

interface PdfWatermarkModalProps {
  isOpen: boolean
  onClose: () => void
}

type WatermarkMode = 'text' | 'image'

export const PdfWatermarkModal: React.FC<PdfWatermarkModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<WatermarkMode>('text')
  const [text, setText] = useState('CONFIDENTIAL')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [opacity, setOpacity] = useState(0.3)
  const [rotation, setRotation] = useState(45)
  const [position, setPosition] = useState('center')
  const [fontsize, setFontsize] = useState(40)
  const [color, setColor] = useState('#e11d48')
  const [pagesMode, setPagesMode] = useState<'all' | 'custom'>('all')
  const [customPages, setCustomPages] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{
    filename: string
    watermarkedPages?: number
  } | null>(null)

  const resetForm = () => {
    setFile(null)
    setMode('text')
    setText('CONFIDENTIAL')
    setImageFile(null)
    setOpacity(0.3)
    setRotation(45)
    setPosition('center')
    setFontsize(40)
    setColor('#e11d48')
    setPagesMode('all')
    setCustomPages('')
    setIsLoading(false)
    setErrorMessage(null)
    setSuccessInfo(null)
  }

  useEffect(() => {
    if (isOpen) {
      resetForm()
    }
  }, [isOpen])

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

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setSuccessInfo(null)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0]
      if (!/\.(png|jpe?g)$/i.test(selected.name)) {
        setErrorMessage('Format gambar harus PNG atau JPG/JPEG.')
        return
      }
      if (selected.size > 10 * 1024 * 1024) {
        setErrorMessage('Ukuran gambar melebihi batas 10 MB.')
        return
      }
      setImageFile(selected)
      setErrorMessage(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setErrorMessage('Pilih berkas PDF terlebih dahulu.')
      return
    }
    if (mode === 'image' && !imageFile) {
      setErrorMessage('Pilih berkas gambar untuk dijadikan watermark.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessInfo(null)

    const res: PdfToolResult = await watermarkPdf({
      file,
      mode,
      text,
      imageFile,
      opacity,
      rotation,
      position,
      fontsize,
      color,
      pages: pagesMode === 'all' ? 'all' : customPages,
    })

    setIsLoading(false)

    if (res.success) {
      setSuccessInfo({
        filename: res.filename || 'watermarked.pdf',
        watermarkedPages: res.watermarkedPages,
      })
    } else {
      setErrorMessage(res.message || 'Gagal membubuhkan watermark PDF.')
    }
  }

  const positions = [
    { id: 'top-left', label: 'Kiri Atas' },
    { id: 'top-center', label: 'Tengah Atas' },
    { id: 'top-right', label: 'Kanan Atas' },
    { id: 'center-left', label: 'Kiri Tengah' },
    { id: 'center', label: 'Tengah' },
    { id: 'center-right', label: 'Kanan Tengah' },
    { id: 'bottom-left', label: 'Kiri Bawah' },
    { id: 'bottom-center', label: 'Tengah Bawah' },
    { id: 'bottom-right', label: 'Kanan Bawah' },
  ]

  const textPresets = ['CONFIDENTIAL', 'DRAFT', 'SALINAN', 'RAHASIA', 'SAMPLE']

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modal Watermark PDF"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-overlay-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 border border-slate-200 animate-fade-in max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Watermark PDF
              </h3>
              <p className="text-xs text-slate-500">
                Bubuhkan stempel cap air teks atau logo gambar dengan posisi & rotasi presisi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal Watermark PDF"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition"
            data-testid="btn-close-pdf-watermark"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {/* File Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Berkas Dokumen PDF
            </label>
            {!file ? (
              <label className="border-2 border-dashed border-slate-300 hover:border-rose-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/60 hover:bg-rose-50/20 text-center">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-full">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Pilih atau tarik berkas PDF ke sini
                  </span>
                  <span className="text-3xs text-slate-400 block mt-0.5">
                    Maksimum ukuran 25 MB • Pemrosesan 100% lokal offline
                  </span>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  aria-label="Pilih berkas PDF untuk watermark"
                  className="hidden"
                  onChange={handlePdfChange}
                  data-testid="input-watermark-pdf-file"
                />
              </label>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-rose-600 shrink-0">
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
                  data-testid="btn-change-watermark-pdf"
                >
                  Ganti
                </button>
              </div>
            )}
          </div>

          {/* Mode Switcher */}
          <div className="p-1 bg-slate-100 rounded-xl grid grid-cols-2 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                mode === 'text'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              data-testid="tab-watermark-text"
            >
              <Type className="w-4 h-4" />
              <span>Teks Watermark</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('image')}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                mode === 'image'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              data-testid="tab-watermark-image"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Gambar / Logo</span>
            </button>
          </div>

          {/* Mode Text Controls */}
          {mode === 'text' ? (
            <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label htmlFor="input-watermark-text" className="block text-2xs font-bold text-slate-700 mb-1">
                  Isi Teks Watermark
                </label>
                <input
                  id="input-watermark-text"
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Contoh: CONFIDENTIAL"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-rose-500 font-semibold text-slate-800"
                  data-testid="input-watermark-text"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {textPresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setText(preset)}
                      className={`text-3xs px-2 py-0.5 rounded-md border font-semibold transition ${
                        text === preset
                          ? 'bg-rose-50 border-rose-300 text-rose-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="input-watermark-fontsize" className="block text-2xs font-bold text-slate-700 mb-1">
                    Ukuran Font ({fontsize} pt)
                  </label>
                  <input
                    id="input-watermark-fontsize"
                    type="range"
                    min="14"
                    max="90"
                    step="2"
                    value={fontsize}
                    onChange={e => setFontsize(parseInt(e.target.value, 10))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                </div>
                <div>
                  <label htmlFor="input-watermark-color" className="block text-2xs font-bold text-slate-700 mb-1">
                    Warna Teks
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="input-watermark-color"
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5 bg-white"
                      data-testid="input-watermark-color"
                    />
                    <span className="text-3xs font-mono text-slate-500 uppercase">{color}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-2xs font-bold text-slate-700">
                Pilih Berkas Gambar (PNG / JPG)
              </label>
              {!imageFile ? (
                <label className="border border-dashed border-slate-300 hover:border-rose-400 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-white transition text-center">
                  <Upload className="w-4 h-4 text-rose-600" />
                  <span className="text-2xs font-semibold text-slate-700">Pilih gambar logo transparan</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg"
                    aria-label="Pilih gambar logo watermark"
                    className="hidden"
                    onChange={handleImageChange}
                    data-testid="input-watermark-image-file"
                  />
                </label>
              ) : (
                <div className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="truncate font-semibold text-slate-800 text-2xs">{imageFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setImageFile(null)}
                    className="text-3xs text-rose-600 font-bold hover:underline"
                  >
                    Ganti
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Position & Rotation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Position 3x3 */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-2xs font-bold text-slate-700">
                Posisi Watermark
              </label>
              <div className="grid grid-cols-3 gap-1.5 max-w-[190px] mx-auto">
                {positions.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPosition(p.id)}
                    title={p.label}
                    className={`h-8 rounded-lg border text-3xs font-bold transition flex items-center justify-center ${
                      position === p.id
                        ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    data-testid={`btn-pos-${p.id}`}
                  >
                    •
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPosition('mosaic')}
                className={`w-full py-1.5 px-2 rounded-lg border text-2xs font-bold transition flex items-center justify-center gap-1.5 ${
                  position === 'mosaic'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                data-testid="btn-pos-mosaic"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Pola Berulang (Mosaic)</span>
              </button>
            </div>

            {/* Opacity & Rotation */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div>
                <div className="flex justify-between text-2xs font-bold text-slate-700 mb-1">
                  <label htmlFor="range-opacity">Transparansi / Opasitas</label>
                  <span>{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  id="range-opacity"
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={opacity}
                  onChange={e => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                  data-testid="input-watermark-opacity"
                />
              </div>

              <div>
                <div className="flex justify-between text-2xs font-bold text-slate-700 mb-1">
                  <label htmlFor="range-rotation">Rotasi Sudut</label>
                  <span>{rotation}°</span>
                </div>
                <div className="flex gap-1.5 mb-1.5">
                  {[0, 45, 90, -45].map(angle => (
                    <button
                      key={angle}
                      type="button"
                      onClick={() => setRotation(angle)}
                      className={`flex-1 py-1 rounded text-3xs font-bold border transition ${
                        rotation === angle
                          ? 'bg-rose-50 border-rose-300 text-rose-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {angle}°
                    </button>
                  ))}
                </div>
                <input
                  id="range-rotation"
                  type="range"
                  min="-90"
                  max="90"
                  step="5"
                  value={rotation}
                  onChange={e => setRotation(parseInt(e.target.value, 10))}
                  className="w-full accent-rose-600 cursor-pointer"
                  data-testid="input-watermark-rotation"
                />
              </div>
            </div>
          </div>

          {/* Page Target Range */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="block text-2xs font-bold text-slate-700">
              Target Halaman
            </label>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="wm-pages-target"
                  checked={pagesMode === 'all'}
                  onChange={() => setPagesMode('all')}
                  className="accent-rose-600"
                />
                <span>Semua Halaman</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="wm-pages-target"
                  checked={pagesMode === 'custom'}
                  onChange={() => setPagesMode('custom')}
                  className="accent-rose-600"
                />
                <span>Halaman Tertentu</span>
              </label>
            </div>
            {pagesMode === 'custom' && (
              <input
                type="text"
                value={customPages}
                onChange={e => setCustomPages(e.target.value)}
                placeholder="Contoh: 1-3, 5"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-rose-500"
                data-testid="input-watermark-pages-range"
              />
            )}
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700" data-testid="alert-error-watermark">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs text-emerald-800" data-testid="alert-success-watermark">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Watermark Berhasil Dibubuhkan!</span>
              </div>
              <p className="text-2xs text-emerald-700">
                Berkas <strong>{successInfo.filename}</strong> telah otomatis terunduh
                {successInfo.watermarkedPages !== undefined ? ` (${successInfo.watermarkedPages} halaman).` : '.'}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !file || (mode === 'image' && !imageFile)}
            className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
            data-testid="btn-submit-watermark"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Membubuhkan Watermark ke PDF...</span>
              </>
            ) : (
              <>
                <Stamp className="w-4 h-4" />
                <span>Bubuhkan Watermark Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
