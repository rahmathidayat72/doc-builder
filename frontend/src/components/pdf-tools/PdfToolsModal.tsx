import React, { useState, useEffect } from 'react'
import {
  FileText,
  Copy,
  Scissors,
  Image as ImageIcon,
  Archive,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Minimize2,
  Info,
} from 'lucide-react'
import {
  mergePdfAndImages,
  splitPdf,
  compressPdf,
  imagesToPdf,
  pdfToImages,
  type PdfToolResult,
} from '../../services/pdfTools'

export type ToolTab = 'merge' | 'split' | 'compress' | 'img2pdf' | 'pdf2img'

interface PdfToolsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: ToolTab
}

export const PdfToolsModal: React.FC<PdfToolsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'merge',
}) => {
  const [activeTab, setActiveTab] = useState<ToolTab>(initialTab)

  // State untuk Merge
  const [mergeFiles, setMergeFiles] = useState<File[]>([])

  // State untuk Split
  const [splitFile, setSplitFile] = useState<File | null>(null)
  const [pageRange, setPageRange] = useState<string>('1')

  // State untuk Compress
  const [compressFile, setCompressFile] = useState<File | null>(null)
  const [compressLevel, setCompressLevel] = useState<'light' | 'balanced' | 'maximum'>('balanced')

  // State untuk Img2Pdf
  const [imgFiles, setImgFiles] = useState<File[]>([])
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER'>('A4')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')

  // State untuk Pdf2Img
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg'>('png')
  const [dpi, setDpi] = useState<number>(150)

  // Status
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }, [isOpen, initialTab])

  if (!isOpen) return null

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
  }

  const resetStatus = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  const handleTabChange = (tab: ToolTab) => {
    setActiveTab(tab)
    resetStatus()
  }

  const moveMergeFile = (index: number, direction: 'up' | 'down') => {
    setMergeFiles(prev => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const next = [...prev]
      const temp = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = temp
      return next
    })
  }

  // --- Handlers ---

  const handleMergeSubmit = async () => {
    if (mergeFiles.length === 0) {
      setErrorMessage('Pilih minimal satu berkas PDF atau gambar.')
      return
    }
    setIsLoading(true)
    resetStatus()
    const res: PdfToolResult = await mergePdfAndImages(mergeFiles)
    setIsLoading(false)
    if (res.success) {
      setSuccessMessage(`Berhasil menggabungkan berkas: ${res.filename}`)
    } else {
      setErrorMessage(res.message || 'Gagal menggabungkan berkas.')
    }
  }

  const handleSplitSubmit = async () => {
    if (!splitFile) {
      setErrorMessage('Pilih berkas PDF terlebih dahulu.')
      return
    }
    if (!pageRange.trim()) {
      setErrorMessage('Masukkan rentang halaman (contoh: 1-2, 4).')
      return
    }
    setIsLoading(true)
    resetStatus()
    const res: PdfToolResult = await splitPdf(splitFile, pageRange)
    setIsLoading(false)
    if (res.success) {
      setSuccessMessage(`Berhasil memisahkan PDF: ${res.filename}`)
    } else {
      setErrorMessage(res.message || 'Gagal memisahkan PDF.')
    }
  }

  const handleCompressSubmit = async () => {
    if (!compressFile) {
      setErrorMessage('Pilih berkas PDF terlebih dahulu.')
      return
    }
    setIsLoading(true)
    resetStatus()
    const res: PdfToolResult = await compressPdf(compressFile, compressLevel)
    setIsLoading(false)
    if (res.success) {
      if (res.applied && res.originalSize && res.outputSize) {
        const savedPct = Math.max(
          0,
          ((res.originalSize - res.outputSize) / res.originalSize) * 100
        ).toFixed(1)
        setSuccessMessage(
          `Berhasil mengompres PDF: ${res.filename} (${formatBytes(res.originalSize)} -> ${formatBytes(res.outputSize)}, hemat ${savedPct}%)`
        )
      } else {
        setSuccessMessage(
          `PDF sudah optimal: ${res.filename} (${formatBytes(res.originalSize || compressFile.size)}). Berkas asli diunduh tanpa penurunan kualitas.`
        )
      }
    } else {
      setErrorMessage(res.message || 'Gagal mengompres PDF.')
    }
  }

  const handleImg2PdfSubmit = async () => {
    if (imgFiles.length === 0) {
      setErrorMessage('Pilih minimal satu gambar.')
      return
    }
    setIsLoading(true)
    resetStatus()
    const res: PdfToolResult = await imagesToPdf(imgFiles, pageSize, orientation)
    setIsLoading(false)
    if (res.success) {
      setSuccessMessage(`Berhasil membuat PDF: ${res.filename}`)
    } else {
      setErrorMessage(res.message || 'Gagal membuat PDF dari gambar.')
    }
  }

  const handlePdf2ImgSubmit = async () => {
    if (!pdfFile) {
      setErrorMessage('Pilih berkas PDF terlebih dahulu.')
      return
    }
    setIsLoading(true)
    resetStatus()
    const res: PdfToolResult = await pdfToImages(pdfFile, imgFormat, dpi)
    setIsLoading(false)
    if (res.success) {
      setSuccessMessage(`Berhasil mengekstrak gambar: ${res.filename}`)
    } else {
      setErrorMessage(res.message || 'Gagal mengekstrak gambar dari PDF.')
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-overlay-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 border border-slate-200 animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">PDF Tools</h3>
              <p className="text-xs text-slate-500">
                Utilitas manipulasi dokumen PDF dan gambar secara lokal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal PDF Tools"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition"
            data-testid="btn-close-pdf-tools"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-100/90 p-1 rounded-xl gap-1 overflow-x-auto border border-slate-200/50">
          {[
            { id: 'merge', label: 'Gabung File', icon: Copy },
            { id: 'split', label: 'Pisah PDF', icon: Scissors },
            { id: 'compress', label: 'Kompres PDF', icon: Minimize2 },
            { id: 'img2pdf', label: 'Gambar ke PDF', icon: ImageIcon },
            { id: 'pdf2img', label: 'PDF ke Gambar', icon: Archive },
          ].map(t => {
            const Icon = t.icon
            const isActive = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTabChange(t.id as ToolTab)}
                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isActive
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
                data-testid={`tab-${t.id}`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 py-1 pr-1 custom-scrollbar">
          {/* TAB 1: MERGE */}
          {activeTab === 'merge' && (
            <div className="space-y-3 pb-1">
              <p className="text-xs text-slate-500 leading-relaxed">
                Gabungkan beberapa dokumen PDF, Word (.docx), dan berkas gambar (JPG, PNG) menjadi satu PDF terpadu. Urutkan berkas dengan tombol panah sebelum menggabungkan.
              </p>

              <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/60 hover:bg-indigo-50/20">
                <Upload className="w-6 h-6 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700">
                  Pilih atau seret berkas PDF / Word / Gambar
                </span>
                <span className="text-2xs text-slate-400">PDF, DOCX, JPG, PNG (maks 25 MB total)</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  aria-label="Pilih berkas PDF atau gambar untuk digabungkan"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) {
                      setMergeFiles(prev => [...prev, ...Array.from(e.target.files!)])
                      resetStatus()
                    }
                  }}
                  data-testid="input-merge-files"
                />
              </label>

              {mergeFiles.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  <div className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                    Daftar Berkas & Urutan Penggabungan ({mergeFiles.length})
                  </div>
                  {mergeFiles.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between p-2 bg-slate-50/80 rounded-xl text-xs border border-slate-200/80"
                    >
                      <span className="truncate max-w-[280px] sm:max-w-[380px] text-slate-700 font-medium">
                        {i + 1}. {f.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveMergeFile(i, 'up')}
                          disabled={i === 0}
                          aria-label={`Pindahkan ${f.name} ke atas`}
                          className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 p-1 rounded-lg transition"
                          title="Pindahkan ke atas"
                          data-testid={`btn-move-up-${i}`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMergeFile(i, 'down')}
                          disabled={i === mergeFiles.length - 1}
                          aria-label={`Pindahkan ${f.name} ke bawah`}
                          className="text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400 p-1 rounded-lg transition"
                          title="Pindahkan ke bawah"
                          data-testid={`btn-move-down-${i}`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMergeFiles(prev => prev.filter((_, idx) => idx !== i))}
                          aria-label={`Hapus ${f.name} dari daftar`}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
                          title="Hapus"
                          data-testid={`btn-remove-${i}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleMergeSubmit}
                disabled={isLoading || mergeFiles.length === 0}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2 mt-2"
                data-testid="btn-submit-merge"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menggabungkan Dokumen...</span>
                  </>
                ) : (
                  <span>Gabungkan Sekarang</span>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: SPLIT */}
          {activeTab === 'split' && (
            <div className="space-y-3 pb-1">
              <p className="text-xs text-slate-500 leading-relaxed">
                Ekstrak halaman tertentu dari PDF menjadi beberapa berkas PDF terpisah yang dikemas dalam arsip ZIP.
              </p>

              <label className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                splitFile
                  ? 'border-indigo-400 bg-indigo-50/20'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/20'
              }`}>
                <Upload className="w-6 h-6 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700 text-center truncate max-w-full px-2">
                  {splitFile ? splitFile.name : 'Pilih berkas PDF utama'}
                </span>
                <span className="text-2xs text-slate-400">
                  {splitFile ? `${formatBytes(splitFile.size)} • Klik untuk ganti berkas` : 'Berkas PDF (maks 25 MB)'}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  aria-label="Pilih berkas PDF utama untuk dipisahkan"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setSplitFile(e.target.files[0])
                      resetStatus()
                    }
                  }}
                  data-testid="input-split-file"
                />
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Rentang Halaman
                </label>
                <input
                  type="text"
                  value={pageRange}
                  onChange={e => setPageRange(e.target.value)}
                  placeholder="Contoh: 1-3, 5, 7-10"
                  aria-label="Rentang Halaman PDF"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  data-testid="input-page-range"
                />
                <p className="text-2xs text-slate-400 mt-1.5 leading-relaxed">
                  Format: nomor atau rentang dipisah koma (misal: 1-3, 5, 7-10). Setiap rentang akan menjadi 1 berkas PDF terpisah di dalam ZIP.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSplitSubmit}
                disabled={isLoading || !splitFile}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2 mt-2"
                data-testid="btn-submit-split"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memisahkan PDF...</span>
                  </>
                ) : (
                  <span>Pisahkan PDF (Arsip ZIP)</span>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: COMPRESS */}
          {activeTab === 'compress' && (
            <div className="space-y-3 pb-1">
              <p className="text-xs text-slate-500 leading-relaxed">
                Perkecil ukuran dokumen PDF secara lokal dengan 3 tingkat kompresi cerdas. Teks, tautan, dan tata letak tetap dipertahankan.
              </p>

              <label className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition ${
                compressFile
                  ? 'border-indigo-400 bg-indigo-50/20'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/20'
              }`}>
                <Upload className="w-6 h-6 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700 text-center truncate max-w-full px-2">
                  {compressFile ? compressFile.name : 'Pilih berkas PDF utama'}
                </span>
                <span className="text-2xs text-slate-400">
                  {compressFile ? `${formatBytes(compressFile.size)} • Klik untuk ganti berkas` : 'Berkas PDF (maks 25 MB)'}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  aria-label="Pilih berkas PDF utama untuk dikompres"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setCompressFile(e.target.files[0])
                      resetStatus()
                    }
                  }}
                  data-testid="input-compress-file"
                />
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tingkat Kompresi
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'light',
                      name: 'Ringan',
                      badge: 'Lossless',
                      desc: 'Optimasi struktur internal tanpa mengurangi ketajaman gambar.',
                    },
                    {
                      id: 'balanced',
                      name: 'Seimbang',
                      badge: 'Rekomendasi',
                      desc: 'Keseimbangan ideal ukuran & ketajaman (150 DPI, Q75).',
                    },
                    {
                      id: 'maximum',
                      name: 'Maksimum',
                      badge: 'Terkecil',
                      desc: 'Kompresi agresif untuk unggahan berkuota ketat (96 DPI, Q50).',
                    },
                  ].map(lvl => {
                    const isSelected = compressLevel === lvl.id
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => {
                          setCompressLevel(lvl.id as 'light' | 'balanced' | 'maximum')
                          resetStatus()
                        }}
                        data-testid={`btn-compress-level-${lvl.id}`}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/80 ring-1 ring-indigo-500 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full mb-1">
                          <span className="text-xs font-bold text-slate-800">{lvl.name}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 tracking-tight leading-none ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {lvl.badge}
                          </span>
                        </div>
                        <p className="text-2xs text-slate-500 leading-relaxed mt-1">{lvl.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-xs text-slate-600">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-2xs leading-relaxed">
                  Dokumen bertanda tangan digital ditolak demi menjaga keabsahan tanda tangan. Jika berkas sudah optimal, berkas asli diunduh tanpa penurunan kualitas.
                </span>
              </div>

              <button
                type="button"
                onClick={handleCompressSubmit}
                disabled={isLoading || !compressFile}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2 mt-2"
                data-testid="btn-submit-compress"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengompres PDF...</span>
                  </>
                ) : (
                  <span>Kompres PDF Sekarang</span>
                )}
              </button>
            </div>
          )}

          {/* TAB 4: IMAGE TO PDF */}
          {activeTab === 'img2pdf' && (
            <div className="space-y-3 pb-1">
              <p className="text-xs text-slate-500 leading-relaxed">
                Ubah kumpulan gambar menjadi berkas PDF standar dengan ukuran dan orientasi pilihan.
              </p>

              <label className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                imgFiles.length > 0
                  ? 'border-indigo-400 bg-indigo-50/20'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/20'
              }`}>
                <Upload className="w-6 h-6 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700 text-center truncate max-w-full px-2">
                  {imgFiles.length > 0 ? `${imgFiles.length} gambar dipilih` : 'Pilih berkas gambar'}
                </span>
                <span className="text-2xs text-slate-400">JPG, JPEG, PNG</span>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png"
                  aria-label="Pilih berkas gambar untuk dijadikan PDF"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files) {
                      setImgFiles(Array.from(e.target.files))
                      resetStatus()
                    }
                  }}
                  data-testid="input-img2pdf-files"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Ukuran Kertas
                  </label>
                  <select
                    value={pageSize}
                    aria-label="Ukuran Kertas PDF"
                    onChange={e => setPageSize(e.target.value as 'A4' | 'LETTER')}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  >
                    <option value="A4">A4 (210 x 297 mm)</option>
                    <option value="LETTER">US Letter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Orientasi
                  </label>
                  <select
                    value={orientation}
                    aria-label="Orientasi Kertas PDF"
                    onChange={e => setOrientation(e.target.value as 'portrait' | 'landscape')}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  >
                    <option value="portrait">Tegak (Portrait)</option>
                    <option value="landscape">Mendatar (Landscape)</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleImg2PdfSubmit}
                disabled={isLoading || imgFiles.length === 0}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2 mt-2"
                data-testid="btn-submit-img2pdf"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Membuat PDF...</span>
                  </>
                ) : (
                  <span>Konversi ke PDF</span>
                )}
              </button>
            </div>
          )}

          {/* TAB 5: PDF TO IMAGE */}
          {activeTab === 'pdf2img' && (
            <div className="space-y-3 pb-1">
              <p className="text-xs text-slate-500 leading-relaxed">
                Ekstrak setiap halaman berkas PDF ke dalam arsip ZIP berisi berkas gambar (JPG atau PNG).
              </p>

              <label className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${
                pdfFile
                  ? 'border-indigo-400 bg-indigo-50/20'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/20'
              }`}>
                <Upload className="w-6 h-6 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700 text-center truncate max-w-full px-2">
                  {pdfFile ? pdfFile.name : 'Pilih berkas PDF'}
                </span>
                <span className="text-2xs text-slate-400">
                  {pdfFile ? `${formatBytes(pdfFile.size)} • Klik untuk ganti berkas` : 'Berkas PDF (maks 25 MB)'}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  aria-label="Pilih berkas PDF untuk diekstrak gambarnya"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setPdfFile(e.target.files[0])
                      resetStatus()
                    }
                  }}
                  data-testid="input-pdf2img-file"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Format Gambar
                  </label>
                  <select
                    value={imgFormat}
                    aria-label="Format Gambar Output"
                    onChange={e => setImgFormat(e.target.value as 'png' | 'jpeg')}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  >
                    <option value="png">PNG (Berkualitas Tinggi)</option>
                    <option value="jpeg">JPEG (Ukuran Ringkas)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Resolusi (DPI)
                  </label>
                  <select
                    value={dpi}
                    aria-label="Resolusi DPI Gambar"
                    onChange={e => setDpi(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl outline-none bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  >
                    <option value={72}>72 DPI (Layar / Cepat)</option>
                    <option value={150}>150 DPI (Standar Rekomendasi)</option>
                    <option value={300}>300 DPI (Cetak Resolusi Tinggi)</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handlePdf2ImgSubmit}
                disabled={isLoading || !pdfFile}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2 mt-2"
                data-testid="btn-submit-pdf2img"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengekstrak Gambar...</span>
                  </>
                ) : (
                  <span>Ekstrak Gambar (ZIP)</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
