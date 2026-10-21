import React, { useState } from 'react'
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
} from 'lucide-react'
import {
  mergePdfAndImages,
  splitPdf,
  imagesToPdf,
  pdfToImages,
  type PdfToolResult,
} from '../../services/pdfTools'

interface PdfToolsModalProps {
  isOpen: boolean
  onClose: () => void
}

type ToolTab = 'merge' | 'split' | 'img2pdf' | 'pdf2img'

export const PdfToolsModal: React.FC<PdfToolsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<ToolTab>('merge')

  // State untuk Merge
  const [mergeFiles, setMergeFiles] = useState<File[]>([])

  // State untuk Split
  const [splitFile, setSplitFile] = useState<File | null>(null)
  const [pageRange, setPageRange] = useState<string>('1')

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

  if (!isOpen) return null

  const resetStatus = () => {
    setErrorMessage(null)
    setSuccessMessage(null)
  }

  const handleTabChange = (tab: ToolTab) => {
    setActiveTab(tab)
    resetStatus()
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
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
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
            data-testid="btn-close-pdf-tools"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => handleTabChange('merge')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'merge'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            data-testid="tab-merge"
          >
            <Copy className="w-3.5 h-3.5" />
            Gabung File
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('split')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'split'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            data-testid="tab-split"
          >
            <Scissors className="w-3.5 h-3.5" />
            Pisah PDF
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('img2pdf')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'img2pdf'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            data-testid="tab-img2pdf"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Gambar ke PDF
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('pdf2img')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'pdf2img'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            data-testid="tab-pdf2img"
          >
            <Archive className="w-3.5 h-3.5" />
            PDF ke Gambar
          </button>
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
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* TAB 1: MERGE */}
          {activeTab === 'merge' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Gabungkan beberapa dokumen PDF dan berkas gambar (JPG, PNG) menjadi satu PDF terpadu.
              </p>

              <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/50 hover:bg-indigo-50/30">
                <Upload className="w-6 h-6 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700">
                  Pilih atau seret berkas PDF / Gambar
                </span>
                <span className="text-2xs text-slate-400">PDF, JPG, PNG (maks 25 MB total)</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
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
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  <div className="text-2xs font-bold uppercase text-slate-400">
                    Daftar Berkas ({mergeFiles.length})
                  </div>
                  {mergeFiles.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs border border-slate-200"
                    >
                      <span className="truncate max-w-[340px] text-slate-700">
                        {i + 1}. {f.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMergeFiles(prev => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Hapus ${f.name} dari daftar`}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleMergeSubmit}
                disabled={isLoading || mergeFiles.length === 0}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2"
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
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Ekstrak halaman tertentu dari PDF menjadi dokumen PDF baru.
              </p>

              <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/50 hover:bg-indigo-50/30">
                <Upload className="w-6 h-6 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700">
                  {splitFile ? splitFile.name : 'Pilih berkas PDF utama'}
                </span>
                <span className="text-2xs text-slate-400">Berkas PDF (maks 25 MB)</span>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rentang Halaman
                </label>
                <input
                  type="text"
                  value={pageRange}
                  onChange={e => setPageRange(e.target.value)}
                  placeholder="Contoh: 1-3, 5, 7-10"
                  aria-label="Rentang Halaman PDF"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  data-testid="input-page-range"
                />
                <p className="text-2xs text-slate-400 mt-1">
                  Format: nomor dipisah koma (misal: 1, 3) atau tanda strip (misal: 1-5).
                </p>
              </div>

              <button
                type="button"
                onClick={handleSplitSubmit}
                disabled={isLoading || !splitFile}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                data-testid="btn-submit-split"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memisahkan PDF...</span>
                  </>
                ) : (
                  <span>Pisahkan PDF</span>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: IMAGE TO PDF */}
          {activeTab === 'img2pdf' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Ubah kumpulan gambar menjadi berkas PDF standar dengan ukuran dan orientasi pilihan.
              </p>

              <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/50 hover:bg-indigo-50/30">
                <Upload className="w-6 h-6 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700">
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
                  <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                    Ukuran Kertas
                  </label>
                  <select
                    value={pageSize}
                    aria-label="Ukuran Kertas PDF"
                    onChange={e => setPageSize(e.target.value as 'A4' | 'LETTER')}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none bg-white"
                  >
                    <option value="A4">A4 (210 x 297 mm)</option>
                    <option value="LETTER">US Letter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                    Orientasi
                  </label>
                  <select
                    value={orientation}
                    aria-label="Orientasi Kertas PDF"
                    onChange={e => setOrientation(e.target.value as 'portrait' | 'landscape')}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none bg-white"
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
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2"
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

          {/* TAB 4: PDF TO IMAGE */}
          {activeTab === 'pdf2img' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Ekstrak setiap halaman berkas PDF ke dalam arsip ZIP berisi berkas gambar (JPG atau PNG).
              </p>

              <label className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/50 hover:bg-indigo-50/30">
                <Upload className="w-6 h-6 text-indigo-500" />
                <span className="text-xs font-semibold text-slate-700">
                  {pdfFile ? pdfFile.name : 'Pilih berkas PDF'}
                </span>
                <span className="text-2xs text-slate-400">Berkas PDF (maks 25 MB)</span>
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
                  <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                    Format Gambar
                  </label>
                  <select
                    value={imgFormat}
                    aria-label="Format Gambar Output"
                    onChange={e => setImgFormat(e.target.value as 'png' | 'jpeg')}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none bg-white"
                  >
                    <option value="png">PNG (Berkualitas Tinggi)</option>
                    <option value="jpeg">JPEG (Ukuran Ringkas)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                    Resolusi (DPI)
                  </label>
                  <select
                    value={dpi}
                    aria-label="Resolusi DPI Gambar"
                    onChange={e => setDpi(Number(e.target.value))}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none bg-white"
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
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2"
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
