import React, { useState, useEffect } from 'react'
import {
  Hash,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  FileText,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'
import { addPageNumbersPdf, type PdfToolResult } from '../../services/pdfTools'

interface PdfPageNumbersModalProps {
  isOpen: boolean
  onClose: () => void
}

export const PdfPageNumbersModal: React.FC<PdfPageNumbersModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState('Halaman {n} dari {total}')
  const [position, setPosition] = useState('bottom-center')
  const [margin, setMargin] = useState(30)
  const [startPage, setStartPage] = useState(1)
  const [startNumber, setStartNumber] = useState(1)
  const [fontsize, setFontsize] = useState(10)
  const [color, setColor] = useState('#334155')
  const [pagesMode, setPagesMode] = useState<'all' | 'custom'>('all')
  const [customPages, setCustomPages] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{
    filename: string
    numberedPages?: number
  } | null>(null)

  const resetForm = () => {
    setFile(null)
    setFormat('Halaman {n} dari {total}')
    setPosition('bottom-center')
    setMargin(30)
    setStartPage(1)
    setStartNumber(1)
    setFontsize(10)
    setColor('#334155')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setErrorMessage('Pilih berkas PDF terlebih dahulu.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setSuccessInfo(null)

    const res: PdfToolResult = await addPageNumbersPdf({
      file,
      format,
      position,
      margin,
      startPage,
      startNumber,
      fontsize,
      color,
      pages: pagesMode === 'all' ? 'all' : customPages,
    })

    setIsLoading(false)

    if (res.success) {
      setSuccessInfo({
        filename: res.filename || 'numbered.pdf',
        numberedPages: res.numberedPages,
      })
    } else {
      setErrorMessage(res.message || 'Gagal menambahkan nomor halaman.')
    }
  }

  const formats = [
    { id: '{n}', label: 'Hanya Angka', example: '1' },
    { id: '{n} / {total}', label: 'Nomor / Total', example: '1 / 10' },
    { id: 'Halaman {n} dari {total}', label: 'Formal Indonesia', example: 'Halaman 1 dari 10' },
    { id: 'Page {n} of {total}', label: 'Formal English', example: 'Page 1 of 10' },
  ]

  const positionButtons = [
    { id: 'top-left', label: 'Atas Kiri', icon: AlignLeft },
    { id: 'top-center', label: 'Atas Tengah', icon: AlignCenter },
    { id: 'top-right', label: 'Atas Kanan', icon: AlignRight },
    { id: 'bottom-left', label: 'Bawah Kiri', icon: AlignLeft },
    { id: 'bottom-center', label: 'Bawah Tengah', icon: AlignCenter },
    { id: 'bottom-right', label: 'Bawah Kanan', icon: AlignRight },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modal Nomor Halaman PDF"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-overlay-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-4 sm:p-6 space-y-4 border border-slate-200 animate-fade-in max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Nomor Halaman PDF
              </h3>
              <p className="text-xs text-slate-500">
                Sisipkan penomoran halaman otomatis dengan format, letak, dan margin presisi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal Nomor Halaman PDF"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition"
            data-testid="btn-close-pdf-page-numbers"
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
              <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/60 hover:bg-blue-50/20 text-center">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-full">
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
                  aria-label="Pilih berkas PDF untuk nomor halaman"
                  className="hidden"
                  onChange={handlePdfChange}
                  data-testid="input-page-numbers-pdf-file"
                />
              </label>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-blue-600 shrink-0">
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
                  className="text-xs font-semibold text-slate-600 hover:text-blue-600 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition shrink-0"
                  data-testid="btn-change-page-numbers-pdf"
                >
                  Ganti
                </button>
              </div>
            )}
          </div>

          {/* Format Selector */}
          <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="block text-2xs font-bold text-slate-700">
              Format Penomoran Halaman
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {formats.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    format === f.id
                      ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-100 text-blue-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                  data-testid={`btn-format-${f.id.replace(/\s+/g, '-')}`}
                >
                  <span className="block text-xs font-bold">{f.label}</span>
                  <span className="block text-3xs font-mono text-slate-500 mt-0.5">{f.example}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Position Selector */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="block text-2xs font-bold text-slate-700">
              Letak Posisi Nomor Halaman
            </label>
            <div className="grid grid-cols-3 gap-2">
              {positionButtons.map(p => {
                const IconComponent = p.icon
                const isSelected = position === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPosition(p.id)}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                    data-testid={`btn-pos-${p.id}`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="text-3xs font-bold">{p.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Margin & Start Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Start Page & Start Number */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <label className="block text-2xs font-bold text-slate-700">
                Mulai Penomoran
              </label>
              <div>
                <label htmlFor="input-start-page" className="block text-3xs font-medium text-slate-500 mb-1">
                  Mulai dari halaman dokumen ke-
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="input-start-page"
                    type="number"
                    min="1"
                    max="500"
                    value={startPage}
                    onChange={e => setStartPage(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:border-blue-500"
                    data-testid="input-start-page"
                  />
                  {startPage === 2 && (
                    <span className="text-3xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                      Sampul depan dilewati
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="input-start-number" className="block text-3xs font-medium text-slate-500 mb-1">
                  Angka nomor pertama yang dicetak
                </label>
                <input
                  id="input-start-number"
                  type="number"
                  min="0"
                  max="1000"
                  value={startNumber}
                  onChange={e => setStartNumber(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:border-blue-500"
                  data-testid="input-start-number"
                />
              </div>
            </div>

            {/* Typography & Margin */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <label className="block text-2xs font-bold text-slate-700">
                Jarak Margin & Ukuran Font
              </label>
              <div>
                <label htmlFor="input-page-margin" className="block text-3xs font-medium text-slate-500 mb-1">
                  Jarak dari tepi ({margin} pt)
                </label>
                <input
                  id="input-page-margin"
                  type="range"
                  min="15"
                  max="60"
                  step="5"
                  value={margin}
                  onChange={e => setMargin(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600 cursor-pointer"
                  data-testid="input-page-margin"
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <label htmlFor="select-fontsize" className="block text-3xs font-medium text-slate-500 mb-1">
                    Ukuran Font
                  </label>
                  <select
                    id="select-fontsize"
                    value={fontsize}
                    onChange={e => setFontsize(parseInt(e.target.value, 10))}
                    className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold outline-none focus:border-blue-500"
                    data-testid="select-page-fontsize"
                  >
                    <option value={8}>8 pt (Kecil)</option>
                    <option value={10}>10 pt (Standar)</option>
                    <option value={12}>12 pt (Besar)</option>
                    <option value={14}>14 pt (Sangat Besar)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="input-page-color" className="block text-3xs font-medium text-slate-500 mb-1">
                    Warna Font
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="input-page-color"
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5 bg-white"
                      data-testid="input-page-color"
                    />
                    <span className="text-3xs font-mono text-slate-500 uppercase">{color}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Page Target Range */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <label className="block text-2xs font-bold text-slate-700">
              Rentang Halaman Target
            </label>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="pn-pages-target"
                  checked={pagesMode === 'all'}
                  onChange={() => setPagesMode('all')}
                  className="accent-blue-600"
                />
                <span>Semua Halaman</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="pn-pages-target"
                  checked={pagesMode === 'custom'}
                  onChange={() => setPagesMode('custom')}
                  className="accent-blue-600"
                />
                <span>Halaman Tertentu</span>
              </label>
            </div>
            {pagesMode === 'custom' && (
              <input
                type="text"
                value={customPages}
                onChange={e => setCustomPages(e.target.value)}
                placeholder="Contoh: 2-10, 12"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-blue-500"
                data-testid="input-page-numbers-pages-range"
              />
            )}
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700" data-testid="alert-error-page-numbers">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs text-emerald-800" data-testid="alert-success-page-numbers">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Nomor Halaman Berhasil Ditambahkan!</span>
              </div>
              <p className="text-2xs text-emerald-700">
                Berkas <strong>{successInfo.filename}</strong> telah otomatis terunduh
                {successInfo.numberedPages !== undefined ? ` (${successInfo.numberedPages} halaman dinomori).` : '.'}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !file}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
            data-testid="btn-submit-page-numbers"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Membubuhkan Nomor Halaman ke PDF...</span>
              </>
            ) : (
              <>
                <Hash className="w-4 h-4" />
                <span>Tambahkan Nomor Halaman Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
