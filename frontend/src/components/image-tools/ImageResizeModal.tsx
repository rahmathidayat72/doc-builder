import React, { useState } from 'react'
import {
  ImageIcon,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { resizeImage, type ImageResizeResult } from '../../services/imageTools'

interface ImageResizeModalProps {
  isOpen: boolean
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export const ImageResizeModal: React.FC<ImageResizeModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null)
  const [targetKb, setTargetKb] = useState<number>(100)
  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg')
  const [stripExif, setStripExif] = useState<boolean>(true)

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<ImageResizeResult | null>(null)

  if (!isOpen) return null

  const handleFileChange = (selected: File) => {
    setFile(selected)
    setErrorMessage(null)
    setResult(null)
    // Suggest target around 50% of original or 100 KB
    const currentKb = Math.round(selected.size / 1024)
    if (currentKb > 100) {
      setTargetKb(Math.max(50, Math.round(currentKb * 0.5)))
    } else {
      setTargetKb(Math.max(10, Math.round(currentKb * 0.8)))
    }
  }

  const handleSubmit = async () => {
    if (!file) {
      setErrorMessage('Pilih berkas gambar terlebih dahulu.')
      return
    }
    if (targetKb < 5) {
      setErrorMessage('Target ukuran minimal 5 KB.')
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setResult(null)

    const res = await resizeImage(file, targetKb, outputFormat, stripExif)
    setIsLoading(false)

    if (res.success) {
      setResult(res)
    } else {
      setErrorMessage(res.message || 'Gagal mengubah ukuran gambar.')
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Resize & Kompres Gambar</h3>
              <p className="text-xs text-slate-500">
                Optimasi ukuran gambar sesuai target KB/MB dengan pembersihan metadata privasi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal resize gambar"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
            data-testid="btn-close-image-resize"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 py-1">
          {/* File Picker */}
          <label className="border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-slate-50/50 hover:bg-emerald-50/30">
            <Upload className="w-6 h-6 text-emerald-500" />
            <span className="text-xs font-semibold text-slate-700">
              {file ? file.name : 'Pilih atau seret berkas gambar'}
            </span>
            <span className="text-2xs text-slate-400">
              {file
                ? `Ukuran awal: ${formatBytes(file.size)}`
                : 'Mendukung JPG, JPEG, PNG, WEBP (maks 25 MB)'}
            </span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              aria-label="Pilih berkas gambar untuk dikompres"
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0])
                }
              }}
              data-testid="input-image-file"
            />
          </label>

          {/* Configuration Form */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Target Ukuran Maksimal (KB)
                </label>
                <div className="flex gap-1">
                  {[50, 100, 200, 500].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTargetKb(preset)}
                      className={`text-2xs px-2 py-0.5 rounded border transition ${
                        targetKb === preset
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {preset} KB
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                min={5}
                max={25000}
                value={targetKb}
                aria-label="Target Ukuran Maksimal dalam Kilobyte"
                onChange={e => setTargetKb(Math.max(5, Number(e.target.value)))}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                data-testid="input-target-kb"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-bold uppercase text-slate-500 mb-1">
                  Format Output
                </label>
                <select
                  value={outputFormat}
                  aria-label="Pilihan Format Gambar Output"
                  onChange={e => setOutputFormat(e.target.value as 'jpeg' | 'png' | 'webp')}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg outline-none bg-white"
                  data-testid="select-output-format"
                >
                  <option value="jpeg">JPEG (Kompatibilitas Luas)</option>
                  <option value="png">PNG (Transparansi / Grafis)</option>
                  <option value="webp">WEBP (Kompresi Modern)</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={stripExif}
                    onChange={e => setStripExif(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    data-testid="checkbox-strip-exif"
                  />
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Hapus Metadata EXIF</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Success Card */}
          {result && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-800">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Gambar berhasil dioptimasi & diunduh!</span>
              </div>
              <div className="flex items-center gap-2 text-2xs text-slate-600 pt-1">
                <span>Awal: {formatBytes(result.originalSize || 0)}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="font-bold text-emerald-700">
                  Hasil: {formatBytes(result.optimizedSize || 0)}
                </span>
                {result.originalSize && result.optimizedSize && (
                  <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                    Hemat{' '}
                    {Math.round(
                      (1 - result.optimizedSize / Math.max(result.originalSize, 1)) * 100
                    )}
                    %
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !file}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-2"
            data-testid="btn-submit-resize"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengoptimasi Gambar...</span>
              </>
            ) : (
              <span>Kompres & Unduh Gambar</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
