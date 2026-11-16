import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Brush,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  Eye,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Redo2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import {
  DEFAULT_BRUSH_RADIUS_NORM,
  applyWatermarkRemoval,
  buildRemovalManifest,
  clientToNormalizedPoint,
  computeManifestSignature,
  createInitialPageStates,
  downloadWatermarkBlob,
  getPdfRasterTargetPages,
  previewWatermarkRemoval,
  pushPageMaskEdit,
  redoPageMask,
  resetPageMask,
  undoPageMask,
  validateWatermarkClientFile,
  analyzeWatermarkDocument,
  type BrushStroke,
  type PageMaskState,
  type WatermarkAnalyzeData,
  type WatermarkApplyResult,
  type WatermarkCandidate,
  type WatermarkPreviewData,
} from '../../services/watermarkRemoval'
import { KituNotice } from '../brand/KituNotice'

interface WatermarkRemovalModalProps {
  isOpen: boolean
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function candidateSourceBadge(cand: WatermarkCandidate): {
  text: string
  tone: string
} {
  if (cand.removal_mode === 'structural') {
    return {
      text: 'Struktural (Vektor Utuh)',
      tone: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-700/50',
    }
  }
  return {
    text: cand.source === 'ocr_text' ? 'OCR • Raster' : 'Kandidat • Raster',
    tone: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700/50',
  }
}

export const WatermarkRemovalModal: React.FC<WatermarkRemovalModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null
  return <WatermarkRemovalDialogContent onClose={onClose} />
}

const WatermarkRemovalDialogContent: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [ownerConfirmed, setOwnerConfirmed] = useState(false)
  const [includeOcr, setIncludeOcr] = useState(true)

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [analyzeData, setAnalyzeData] = useState<WatermarkAnalyzeData | null>(null)
  const [activePageIndex, setActivePageIndex] = useState(0)
  const [pageStates, setPageStates] = useState<Record<number, PageMaskState>>({})

  // Brush editor controls
  const [brushMode, setBrushMode] = useState<'add' | 'erase'>('add')
  const [brushRadiusNorm, setBrushRadiusNorm] = useState(DEFAULT_BRUSH_RADIUS_NORM)
  const [draftStroke, setDraftStroke] = useState<BrushStroke | null>(null)

  // Rasterization confirmation dialog & mandatory preview state
  const [confirmedRasterKey, setConfirmedRasterKey] = useState<string | null>(null)
  const [pendingRasterAction, setPendingRasterAction] = useState<'preview' | 'apply' | null>(
    null
  )

  const [previewData, setPreviewData] = useState<WatermarkPreviewData | null>(null)
  const [reviewedSignature, setReviewedSignature] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState<'slider' | 'side'>('slider')
  const [compareSplit, setCompareSplit] = useState(50)

  const [applyResult, setApplyResult] = useState<WatermarkApplyResult | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const activePointerIdRef = useRef<number | null>(null)

  const resetAll = () => {
    setFile(null)
    setOwnerConfirmed(false)
    setIncludeOcr(true)
    setIsAnalyzing(false)
    setIsPreviewing(false)
    setIsApplying(false)
    setErrorMessage(null)
    setAnalyzeData(null)
    setActivePageIndex(0)
    setPageStates({})
    setBrushMode('add')
    setBrushRadiusNorm(DEFAULT_BRUSH_RADIUS_NORM)
    setDraftStroke(null)
    setConfirmedRasterKey(null)
    setPendingRasterAction(null)
    setPreviewData(null)
    setReviewedSignature(null)
    setCompareMode('slider')
    setCompareSplit(50)
    setApplyResult(null)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingRasterAction) {
          setPendingRasterAction(null)
        } else if (!isAnalyzing && !isPreviewing && !isApplying) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingRasterAction, isAnalyzing, isPreviewing, isApplying, onClose])

  const activePage = analyzeData?.pages[activePageIndex] ?? null
  const activeState = activePage ? pageStates[activePage.page_index] : undefined

  const rasterTargetPages = useMemo(
    () => getPdfRasterTargetPages(analyzeData, pageStates),
    [analyzeData, pageStates]
  )
  const rasterScopeKey = rasterTargetPages.join(',')
  const confirmPdfRasterization =
    rasterTargetPages.length > 0 && confirmedRasterKey === rasterScopeKey

  const currentManifest = useMemo(() => {
    if (!analyzeData) return null
    return buildRemovalManifest({
      analyzeData,
      pageStates,
      ownerConfirmed,
      confirmPdfRasterization,
    })
  }, [analyzeData, pageStates, ownerConfirmed, confirmPdfRasterization])

  const currentSignature = useMemo(
    () => computeManifestSignature(currentManifest),
    [currentManifest]
  )

  const activePageHasInstruction = useMemo(() => {
    if (!activePage || !activeState) return false
    return activeState.selectedCandidateIds.length > 0 || activeState.strokes.length > 0
  }, [activePage, activeState])

  const hasReviewedCurrentPreview = Boolean(
    previewData &&
      reviewedSignature &&
      currentSignature &&
      reviewedSignature === currentSignature
  )

  // Gambar overlay mask (kotak kandidat + goresan kuas add/erase) di atas <canvas>
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !activePage || !activeState) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const selectedSet = new Set(activeState.selectedCandidateIds)

    // 1. Kotak kandidat tak terpilih (outline abu-abu putus-putus)
    for (const cand of activePage.candidates) {
      if (selectedSet.has(cand.id)) continue
      const [x0, y0, x1, y1] = cand.bbox_norm
      ctx.save()
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.7)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.strokeRect(x0 * w, y0 * h, (x1 - x0) * w, (y1 - y0) * h)
      ctx.restore()
    }

    // 2. Mask raster & anotasi terpilih
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = w
    maskCanvas.height = h
    const mctx = maskCanvas.getContext('2d')
    if (!mctx) return

    for (const cand of activePage.candidates) {
      if (!selectedSet.has(cand.id)) continue
      const [x0, y0, x1, y1] = cand.bbox_norm
      const rx = x0 * w
      const ry = y0 * h
      const rw = (x1 - x0) * w
      const rh = (y1 - y0) * h
      if (cand.removal_mode === 'structural') {
        ctx.save()
        ctx.fillStyle = 'rgba(16, 185, 129, 0.22)'
        ctx.strokeStyle = 'rgba(5, 150, 105, 0.9)'
        ctx.lineWidth = 2
        ctx.fillRect(rx, ry, rw, rh)
        ctx.strokeRect(rx, ry, rw, rh)
        ctx.restore()
      } else {
        mctx.fillStyle = 'rgba(225, 29, 72, 0.45)'
        mctx.fillRect(rx, ry, rw, rh)
      }
    }

    const strokesToDraw = draftStroke
      ? [...activeState.strokes, draftStroke]
      : activeState.strokes

    const maxDim = Math.max(1, w, h)
    for (const stroke of strokesToDraw) {
      if (stroke.points.length === 0) continue
      const radiusPx = Math.max(2, stroke.brush_radius_norm * maxDim)
      mctx.save()
      if (stroke.mode === 'erase') {
        mctx.globalCompositeOperation = 'destination-out'
        mctx.strokeStyle = 'rgba(0, 0, 0, 1)'
        mctx.fillStyle = 'rgba(0, 0, 0, 1)'
      } else {
        mctx.globalCompositeOperation = 'source-over'
        mctx.strokeStyle = 'rgba(225, 29, 72, 0.5)'
        mctx.fillStyle = 'rgba(225, 29, 72, 0.5)'
      }
      mctx.lineCap = 'round'
      mctx.lineJoin = 'round'
      mctx.lineWidth = radiusPx * 2

      if (stroke.points.length === 1) {
        mctx.beginPath()
        mctx.arc(stroke.points[0].x * w, stroke.points[0].y * h, radiusPx, 0, Math.PI * 2)
        mctx.fill()
      } else {
        mctx.beginPath()
        mctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h)
        for (let i = 1; i < stroke.points.length; i += 1) {
          mctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h)
        }
        mctx.stroke()
      }
      mctx.restore()
    }

    ctx.drawImage(maskCanvas, 0, 0)
  }, [activePage, activeState, draftStroke])

  const handleFileChange = (selected: File | null) => {
    if (!selected) return
    const err = validateWatermarkClientFile(selected)
    if (err) {
      setErrorMessage(err)
      return
    }
    setFile(selected)
    setErrorMessage(null)
    setAnalyzeData(null)
    setPageStates({})
    setPreviewData(null)
    setReviewedSignature(null)
    setApplyResult(null)
    setConfirmedRasterKey(null)
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setErrorMessage('Pilih berkas PDF, JPG/JPEG, atau PNG terlebih dahulu.')
      return
    }
    if (!ownerConfirmed) {
      setErrorMessage(
        'Centang konfirmasi hak kepemilikan atau izin modifikasi dokumen sebelum analisis.'
      )
      return
    }

    setIsAnalyzing(true)
    setErrorMessage(null)
    setPreviewData(null)
    setReviewedSignature(null)
    setApplyResult(null)

    const res = await analyzeWatermarkDocument(file, {
      ownerConfirmed,
      includeOcr,
    })
    setIsAnalyzing(false)

    if (res.success && res.data) {
      setAnalyzeData(res.data)
      setActivePageIndex(0)
      setPageStates(createInitialPageStates(res.data.pages))
      setConfirmedRasterKey(null)
    } else {
      setErrorMessage(res.message || 'Gagal menganalisis dokumen.')
    }
  }

  const updateActivePageState = (updater: (cur: PageMaskState) => PageMaskState) => {
    if (!activePage) return
    setPageStates((prev) => {
      const current = prev[activePage.page_index]
      if (!current) return prev
      return {
        ...prev,
        [activePage.page_index]: updater(current),
      }
    })
    setApplyResult(null)
  }

  const handleToggleCandidate = (candId: string) => {
    if (!activeState) return
    const exists = activeState.selectedCandidateIds.includes(candId)
    const nextIds = exists
      ? activeState.selectedCandidateIds.filter((id) => id !== candId)
      : [...activeState.selectedCandidateIds, candId]
    updateActivePageState((cur) =>
      pushPageMaskEdit(cur, {
        selectedCandidateIds: nextIds,
        strokes: cur.strokes,
      })
    )
  }

  const handleSelectAllCandidates = (selectAll: boolean) => {
    if (!activePage || !activeState) return
    updateActivePageState((cur) =>
      pushPageMaskEdit(cur, {
        selectedCandidateIds: selectAll ? activePage.candidates.map((c) => c.id) : [],
        strokes: cur.strokes,
      })
    )
  }

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activePage || !canvasRef.current) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const rect = canvasRef.current.getBoundingClientRect()
    const pt = clientToNormalizedPoint(e.clientX, e.clientY, rect)
    activePointerIdRef.current = e.pointerId
    if (typeof canvasRef.current.setPointerCapture === 'function') {
      try {
        canvasRef.current.setPointerCapture(e.pointerId)
      } catch {
        // jsdom / pointer synthetic fallback
      }
    }
    setDraftStroke({
      mode: brushMode,
      brush_radius_norm: brushRadiusNorm,
      points: [pt],
    })
  }

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draftStroke || !canvasRef.current) return
    if (
      activePointerIdRef.current !== null &&
      e.pointerId !== activePointerIdRef.current
    ) {
      return
    }
    const rect = canvasRef.current.getBoundingClientRect()
    const pt = clientToNormalizedPoint(e.clientX, e.clientY, rect)
    setDraftStroke((prev) => {
      if (!prev) return null
      const last = prev.points[prev.points.length - 1]
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.002) {
        return prev
      }
      return {
        ...prev,
        points: [...prev.points, pt],
      }
    })
  }

  const commitDraftStroke = () => {
    if (!draftStroke) return
    const finalized = draftStroke
    setDraftStroke(null)
    activePointerIdRef.current = null
    if (finalized.points.length === 0) return
    updateActivePageState((cur) =>
      pushPageMaskEdit(cur, {
        selectedCandidateIds: cur.selectedCandidateIds,
        strokes: [...cur.strokes, finalized],
      })
    )
  }

  const executePreview = async (forceConfirmRaster: boolean) => {
    if (!file || !analyzeData || !activePage) return
    const manifest = buildRemovalManifest({
      analyzeData,
      pageStates,
      ownerConfirmed,
      confirmPdfRasterization: forceConfirmRaster || confirmPdfRasterization,
    })
    if (!manifest) {
      setErrorMessage('Pilih minimal satu kandidat atau buat goresan kuas terlebih dahulu.')
      return
    }

    setIsPreviewing(true)
    setErrorMessage(null)

    const res = await previewWatermarkRemoval(file, manifest, activePage.page_index)
    setIsPreviewing(false)

    if (res.success && res.data) {
      setPreviewData(res.data)
      setReviewedSignature(computeManifestSignature(manifest))
    } else {
      setErrorMessage(res.message || 'Gagal menghasilkan pratinjau before/after.')
    }
  }

  const executeApply = async (forceConfirmRaster: boolean) => {
    if (!file || !analyzeData) return
    const manifest = buildRemovalManifest({
      analyzeData,
      pageStates,
      ownerConfirmed,
      confirmPdfRasterization: forceConfirmRaster || confirmPdfRasterization,
    })
    if (!manifest) {
      setErrorMessage('Pilih minimal satu kandidat atau buat goresan kuas terlebih dahulu.')
      return
    }

    setIsApplying(true)
    setErrorMessage(null)

    const res = await applyWatermarkRemoval(file, manifest)
    setIsApplying(false)

    if (res.success && res.blob && res.filename) {
      downloadWatermarkBlob(res.blob, res.filename)
      setApplyResult(res)
    } else {
      setErrorMessage(res.message || 'Gagal memproses penghapusan watermark.')
    }
  }

  const handleRequestPreview = () => {
    if (!activePageHasInstruction) {
      setErrorMessage(
        'Pilih kandidat watermark atau gores kuas pada halaman aktif sebelum membuat pratinjau.'
      )
      return
    }
    if (rasterTargetPages.length > 0 && !confirmPdfRasterization) {
      setPendingRasterAction('preview')
      return
    }
    void executePreview(false)
  }

  const handleRequestApply = () => {
    if (!hasReviewedCurrentPreview) {
      setErrorMessage(
        'Tinjau pratinjau Before / After terbaru terlebih dahulu sebelum mengunduh hasil.'
      )
      return
    }
    if (rasterTargetPages.length > 0 && !confirmPdfRasterization) {
      setPendingRasterAction('apply')
      return
    }
    void executeApply(false)
  }

  const handleConfirmPdfRasterization = () => {
    const action = pendingRasterAction
    setConfirmedRasterKey(rasterScopeKey)
    setPendingRasterAction(null)
    if (action === 'preview') {
      void executePreview(true)
    } else if (action === 'apply') {
      void executeApply(true)
    }
  }

  const canUndo = Boolean(activeState && activeState.historyIndex > 0)
  const canRedo = Boolean(
    activeState && activeState.historyIndex < activeState.history.length - 1
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="watermark-removal-title"
      className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-overlay-in"
    >
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full p-4 sm:p-6 space-y-4 border border-stone-200 dark:border-slate-700 animate-fade-in max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 rounded-xl border border-teal-200/70 dark:border-teal-700/50">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="watermark-removal-title"
                className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100"
              >
                Hapus Watermark
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-300">
                Bersihkan watermark tipis pada PDF, JPG/JPEG, atau PNG dengan pratinjau before/after wajib.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isAnalyzing || isPreviewing || isApplying}
            aria-label="Tutup modal Hapus Watermark"
            data-testid="btn-close-watermark-removal"
            className="p-2 text-stone-500 hover:text-stone-800 dark:text-stone-300 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-slate-800 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-teal-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {errorMessage && (
            <KituNotice
              tone="error"
              title="Permintaan Belum Dapat Diproses"
              role="alert"
            >
              <span data-testid="watermark-error-message">{errorMessage}</span>
            </KituNotice>
          )}

          {/* Tahap 1: Upload & Konfirmasi Hak Kepemilikan */}
          {!analyzeData && (
            <form onSubmit={handleAnalyze} className="space-y-4">
              <div>
                <span className="block text-xs font-bold text-stone-800 dark:text-stone-200 mb-1.5">
                  Pilih Berkas Dokumen atau Gambar
                </span>
                {!file ? (
                  <label
                    htmlFor="watermark-file-input"
                    className="border-2 border-dashed border-stone-300 dark:border-slate-600 hover:border-teal-700 dark:hover:border-teal-400 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition bg-stone-50/70 dark:bg-slate-800/40 text-center"
                  >
                    <div className="p-3 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 rounded-full">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                      Pilih berkas PDF, JPG/JPEG, atau PNG
                    </span>
                    <span className="text-xs text-stone-600 dark:text-stone-300">
                      Maksimum 25 MB • PDF interaktif maks 50 halaman • Tanpa penyimpanan permanen
                    </span>
                    <input
                      id="watermark-file-input"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      aria-label="Pilih berkas PDF, JPG, atau PNG untuk hapus watermark"
                      className="sr-only"
                      data-testid="input-watermark-removal-file"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                ) : (
                  <div className="p-3.5 bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-stone-200 dark:border-slate-700 text-teal-700 dark:text-teal-300 shrink-0">
                        {file.name.toLowerCase().endsWith('.pdf') ? (
                          <FileText className="w-5 h-5" />
                        ) : (
                          <ImageIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate"
                          title={file.name}
                        >
                          {file.name}
                        </p>
                        <p className="text-xs text-stone-600 dark:text-stone-300">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-xs font-semibold text-stone-700 dark:text-stone-200 hover:text-rose-700 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-900 transition"
                    >
                      Ganti Berkas
                    </button>
                  </div>
                )}
              </div>

              {/* Opsi OCR */}
              <div className="p-3.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50/70 dark:bg-slate-800/40 flex items-start gap-2.5">
                <input
                  id="watermark-include-ocr"
                  type="checkbox"
                  checked={includeOcr}
                  onChange={(e) => setIncludeOcr(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-700"
                  data-testid="checkbox-include-ocr"
                />
                <label
                  htmlFor="watermark-include-ocr"
                  className="text-xs text-stone-700 dark:text-stone-200 cursor-pointer leading-relaxed"
                >
                  <span className="font-semibold block">
                    Aktifkan deteksi teks watermark otomatis (OCR lokal opsional)
                  </span>
                  <span className="text-stone-600 dark:text-stone-300">
                    Jika engine OCR tidak aktif di server, mode pemilihan kandidat struktural &amp; kuas manual tetap dapat digunakan.
                  </span>
                </label>
              </div>

              {/* Checkbox Wajib Hak Kepemilikan / Izin */}
              <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-950/30 flex items-start gap-2.5">
                <input
                  id="watermark-owner-confirmed"
                  type="checkbox"
                  checked={ownerConfirmed}
                  onChange={(e) => setOwnerConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-400 text-teal-700 focus:ring-teal-700"
                  data-testid="checkbox-owner-confirmed"
                />
                <label
                  htmlFor="watermark-owner-confirmed"
                  className="text-xs text-stone-800 dark:text-stone-100 cursor-pointer leading-relaxed"
                >
                  <span className="font-bold">
                    Saya menyatakan berkas ini milik saya sendiri atau saya memiliki izin sah untuk memodifikasi dan menghapus watermark pada dokumen ini.
                  </span>
                  <span className="block text-stone-600 dark:text-stone-300 mt-0.5">
                    Berkas berenkripsi dan PDF bertanda tangan digital ditolak otomatis demi menjaga keamanan dokumen.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
                  <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-300" />
                  Diproses in-memory aman &amp; metadata EXIF output dibersihkan
                </span>
                <button
                  type="submit"
                  disabled={!file || !ownerConfirmed || isAnalyzing}
                  data-testid="btn-analyze-watermark"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 disabled:bg-stone-300 dark:disabled:bg-slate-700 disabled:text-stone-500 text-white transition"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menganalisis Dokumen...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analisis Kandidat Watermark
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Tahap 2 & 3: Workspace Editor Mask + Pratinjau Before/After */}
          {analyzeData && activePage && activeState && (
            <div className="space-y-4">
              {/* Bar Info File & Status OCR */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-stone-50 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-900 dark:text-stone-100">
                    {file?.name || analyzeData.filename}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-stone-200 dark:bg-slate-700 text-stone-800 dark:text-stone-200 font-semibold uppercase">
                    {analyzeData.file_kind}
                  </span>
                  <span className="text-stone-600 dark:text-stone-300">
                    {analyzeData.page_count} halaman
                  </span>
                </div>
                <button
                  type="button"
                  onClick={resetAll}
                  disabled={isPreviewing || isApplying}
                  data-testid="btn-change-watermark-doc"
                  className="text-xs font-semibold text-teal-800 dark:text-teal-300 hover:underline"
                >
                  Ganti Dokumen
                </button>
              </div>

              {analyzeData.ocr_status !== 'completed' && (
                <KituNotice
                  tone="info"
                  title="Mode Manual & Struktural Aktif"
                  data-testid="notice-ocr-fallback"
                >
                  <span>{analyzeData.ocr_message}</span>
                </KituNotice>
              )}

              {rasterTargetPages.length > 0 ? (
                <KituNotice
                  tone="warning"
                  title="Peringatan Rasterisasi Halaman PDF"
                  data-testid="notice-pdf-raster-warning"
                >
                  <span>
                    Halaman {rasterTargetPages.join(', ')} menggunakan mask inpainting raster (150 DPI), sehingga teks selectable, vektor, dan tautan di halaman tersebut tidak lagi interaktif. Halaman lain tetap vektor asli.
                  </span>
                </KituNotice>
              ) : (
                analyzeData.file_kind === 'pdf' && (
                  <div
                    className="p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/70 dark:bg-emerald-950/40 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2"
                    data-testid="badge-structural-only"
                  >
                    <Layers className="w-4 h-4 shrink-0" />
                    <span>
                      Mode Struktural: Hanya annotation/stamp terpilih yang dihapus; teks &amp; vektor halaman PDF tetap utuh 100%.
                    </span>
                  </div>
                )
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Panel Kiri: Navigasi Halaman, Kandidat, & Kuas */}
                <div className="lg:col-span-4 space-y-3">
                  {/* Navigasi Halaman */}
                  {analyzeData.page_count > 1 && (
                    <div className="p-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePageIndex((p) => Math.max(0, p - 1))
                          setPreviewData(null)
                          setReviewedSignature(null)
                        }}
                        disabled={activePageIndex === 0}
                        aria-label="Halaman sebelumnya"
                        data-testid="btn-prev-page"
                        className="p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span
                        className="text-xs font-bold text-stone-800 dark:text-stone-100"
                        data-testid="label-page-indicator"
                      >
                        Halaman {activePage.page_number} dari {analyzeData.page_count}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActivePageIndex((p) =>
                            Math.min(analyzeData.page_count - 1, p + 1)
                          )
                          setPreviewData(null)
                          setReviewedSignature(null)
                        }}
                        disabled={activePageIndex >= analyzeData.page_count - 1}
                        aria-label="Halaman berikutnya"
                        data-testid="btn-next-page"
                        className="p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Daftar Kandidat Halaman Aktif */}
                  <div className="p-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                        Kandidat Terdeteksi ({activePage.candidates.length})
                      </h3>
                      {activePage.candidates.length > 0 && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectAllCandidates(true)}
                            className="text-xs font-semibold text-teal-800 dark:text-teal-300 hover:underline"
                          >
                            Pilih Semua
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectAllCandidates(false)}
                            className="text-xs font-semibold text-stone-600 dark:text-stone-300 hover:underline"
                          >
                            Kosongkan
                          </button>
                        </div>
                      )}
                    </div>

                    {activePage.candidates.length === 0 ? (
                      <p className="text-xs text-stone-600 dark:text-stone-300 py-1">
                        Tidak ada kandidat otomatis di halaman ini. Gunakan kuas tambah di area gambar untuk menandai watermark.
                      </p>
                    ) : (
                      <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {activePage.candidates.map((cand) => {
                          const checked = activeState.selectedCandidateIds.includes(cand.id)
                          const badge = candidateSourceBadge(cand)
                          const cbId = `cand-${cand.id}`
                          return (
                            <li
                              key={cand.id}
                              className="p-2 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50/70 dark:bg-slate-800/50 flex items-start gap-2"
                            >
                              <input
                                id={cbId}
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleCandidate(cand.id)}
                                data-testid={`candidate-checkbox-${cand.id}`}
                                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-700"
                              />
                              <label
                                htmlFor={cbId}
                                className="flex-1 min-w-0 cursor-pointer space-y-1"
                              >
                                <span className="block text-xs font-semibold text-stone-800 dark:text-stone-100 truncate">
                                  {cand.label}
                                </span>
                                <span
                                  className={`inline-block text-2xs px-1.5 py-0.5 rounded border font-semibold ${badge.tone}`}
                                >
                                  {badge.text}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Toolbar Kuas Mask */}
                  <div className="p-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-3">
                    <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      Koreksi Mask Manual
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBrushMode('add')}
                        aria-pressed={brushMode === 'add'}
                        data-testid="btn-brush-add"
                        className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold border transition ${
                          brushMode === 'add'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        <Brush className="w-3.5 h-3.5" />
                        Kuas Tambah
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrushMode('erase')}
                        aria-pressed={brushMode === 'erase'}
                        data-testid="btn-brush-erase"
                        className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold border transition ${
                          brushMode === 'erase'
                            ? 'bg-teal-700 text-white border-teal-700'
                            : 'bg-stone-50 dark:bg-slate-800 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-slate-700'
                        }`}
                      >
                        <Eraser className="w-3.5 h-3.5" />
                        Kuas Hapus
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <label
                          htmlFor="brush-size-slider"
                          className="font-semibold text-stone-700 dark:text-stone-200"
                        >
                          Ukuran Kuas
                        </label>
                        <span className="font-mono text-stone-600 dark:text-stone-300">
                          {(brushRadiusNorm * 100).toFixed(1)}%
                        </span>
                      </div>
                      <input
                        id="brush-size-slider"
                        type="range"
                        min={0.008}
                        max={0.08}
                        step={0.004}
                        value={brushRadiusNorm}
                        onChange={(e) => setBrushRadiusNorm(Number(e.target.value))}
                        data-testid="slider-brush-size"
                        className="w-full accent-teal-700"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => updateActivePageState(undoPageMask)}
                        disabled={!canUndo}
                        aria-label="Undo perubahan mask"
                        data-testid="btn-mask-undo"
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-200 disabled:opacity-40"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Undo
                      </button>
                      <button
                        type="button"
                        onClick={() => updateActivePageState(redoPageMask)}
                        disabled={!canRedo}
                        aria-label="Redo perubahan mask"
                        data-testid="btn-mask-redo"
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-200 disabled:opacity-40"
                      >
                        <Redo2 className="w-3.5 h-3.5" />
                        Redo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateActivePageState((cur) => resetPageMask(cur, activePage))
                        }
                        aria-label="Reset mask halaman"
                        data-testid="btn-mask-reset"
                        className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-200 hover:text-rose-700"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* Panel Kanan: Kanvas Mask Editor + Before/After Preview */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="p-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-100/80 dark:bg-slate-800/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-stone-800 dark:text-stone-100">
                        Kanvas Mask Halaman {activePage.page_number}
                      </span>
                      <span
                        className="text-stone-600 dark:text-stone-300"
                        data-testid="stroke-count-badge"
                      >
                        Goresan kuas: {activeState.strokes.length}
                      </span>
                    </div>

                    <div className="relative mx-auto max-h-[380px] overflow-hidden rounded-lg border border-stone-300 dark:border-slate-600 bg-white dark:bg-slate-950 flex items-center justify-center">
                      <div
                        className="relative inline-block max-w-full"
                        style={{
                          aspectRatio: `${activePage.preview_width} / ${activePage.preview_height}`,
                        }}
                      >
                        <img
                          src={activePage.preview_data_url}
                          alt={`Pratinjau dokumen halaman ${activePage.page_number}`}
                          className="block max-h-[360px] w-auto select-none pointer-events-none"
                          draggable={false}
                        />
                        <canvas
                          ref={canvasRef}
                          width={Math.max(1, activePage.preview_width)}
                          height={Math.max(1, activePage.preview_height)}
                          aria-label="Kanvas editor mask watermark"
                          data-testid="watermark-mask-canvas"
                          onPointerDown={handleCanvasPointerDown}
                          onPointerMove={handleCanvasPointerMove}
                          onPointerUp={commitDraftStroke}
                          onPointerCancel={commitDraftStroke}
                          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi Preview Wajib */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleRequestPreview}
                      disabled={!activePageHasInstruction || isPreviewing || isApplying}
                      data-testid="btn-generate-preview"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 dark:bg-teal-700 dark:hover:bg-teal-600 disabled:bg-stone-300 dark:disabled:bg-slate-700 text-white transition"
                    >
                      {isPreviewing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Membuat Pratinjau...
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          Pratinjau Before / After (Wajib)
                        </>
                      )}
                    </button>

                    {!activePageHasInstruction && (
                      <span className="text-xs text-stone-600 dark:text-stone-300">
                        Pilih kandidat atau gores kuas pada halaman ini terlebih dahulu.
                      </span>
                    )}
                  </div>

                  {/* Panel Before / After Preview */}
                  {previewData && (
                    <div
                      className="p-4 rounded-xl border border-teal-200 dark:border-teal-700/60 bg-teal-50/40 dark:bg-teal-950/20 space-y-3"
                      data-testid="panel-before-after-preview"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                            Perbandingan Before / After (Halaman {previewData.page_index + 1})
                          </h3>
                          {!hasReviewedCurrentPreview && (
                            <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">
                              Mask diubah setelah pratinjau terakhir. Klik Pratinjau ulang sebelum mengunduh.
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCompareMode('slider')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                              compareMode === 'slider'
                                ? 'bg-teal-700 text-white border-teal-700'
                                : 'bg-white dark:bg-slate-900 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-slate-700'
                            }`}
                          >
                            Slider
                          </button>
                          <button
                            type="button"
                            onClick={() => setCompareMode('side')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                              compareMode === 'side'
                                ? 'bg-teal-700 text-white border-teal-700'
                                : 'bg-white dark:bg-slate-900 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-slate-700'
                            }`}
                          >
                            Berdampingan
                          </button>
                        </div>
                      </div>

                      {compareMode === 'slider' ? (
                        <div className="space-y-2">
                          <div className="relative overflow-hidden rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 max-h-[320px] flex items-center justify-center">
                            <img
                              src={previewData.after_data_url}
                              alt="Sesudah penghapusan watermark"
                              className="block max-h-[300px] w-auto select-none"
                            />
                            <div
                              className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none"
                              style={{
                                clipPath: `inset(0 ${100 - compareSplit}% 0 0)`,
                              }}
                            >
                              <img
                                src={previewData.before_data_url}
                                alt="Sebelum penghapusan watermark"
                                className="block max-h-[300px] w-auto select-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label
                              htmlFor="compare-split-slider"
                              className="flex items-center justify-between text-xs text-stone-700 dark:text-stone-200 mb-1"
                            >
                              <span>Before ({compareSplit}%)</span>
                              <span>After ({100 - compareSplit}%)</span>
                            </label>
                            <input
                              id="compare-split-slider"
                              type="range"
                              min={0}
                              max={100}
                              value={compareSplit}
                              onChange={(e) => setCompareSplit(Number(e.target.value))}
                              aria-label="Posisi pembanding Before dan After"
                              data-testid="slider-before-after"
                              className="w-full accent-teal-700"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <figure className="space-y-1">
                            <figcaption className="text-xs font-semibold text-stone-700 dark:text-stone-200">
                              Before (Asli)
                            </figcaption>
                            <img
                              src={previewData.before_data_url}
                              alt="Sebelum penghapusan watermark"
                              className="w-full max-h-[260px] object-contain rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                            />
                          </figure>
                          <figure className="space-y-1">
                            <figcaption className="text-xs font-semibold text-stone-700 dark:text-stone-200">
                              After (Hasil)
                            </figcaption>
                            <img
                              src={previewData.after_data_url}
                              alt="Sesudah penghapusan watermark"
                              className="w-full max-h-[260px] object-contain rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                            />
                          </figure>
                        </div>
                      )}

                      <p className="text-xs text-stone-600 dark:text-stone-300">
                        Catatan keterbatasan: detail latar yang tertutup penuh oleh watermark opaque diestimasi dari piksel sekitarnya dan mungkin tidak pulih 100% sempurna.
                      </p>
                    </div>
                  )}

                  {applyResult?.success && (
                    <KituNotice
                      tone="success"
                      title="Watermark Berhasil Dibersihkan"
                      data-testid="watermark-apply-success"
                    >
                      <span>
                        Berkas <strong>{applyResult.filename}</strong> siap &amp; diunduh (
                        {formatBytes(applyResult.outputSize ?? 0)}
                        {analyzeData.file_kind === 'pdf'
                          ? ` • Struktural: ${applyResult.structuralPages ?? 0} hal, Raster: ${applyResult.rasterizedPages ?? 0} hal`
                          : ''}
                        ).
                      </span>
                    </KituNotice>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {analyzeData && (
          <div className="border-t border-stone-200 dark:border-slate-700 pt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-stone-600 dark:text-stone-300">
              {hasReviewedCurrentPreview
                ? 'Pratinjau Before / After telah ditinjau. Siap mengunduh hasil akhir.'
                : 'Tinjau pratinjau Before / After terlebih dahulu sebelum mengunduh.'}
            </span>
            <button
              type="button"
              onClick={handleRequestApply}
              disabled={!hasReviewedCurrentPreview || isApplying || isPreviewing}
              data-testid="btn-apply-watermark-download"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 disabled:bg-stone-300 dark:disabled:bg-slate-700 disabled:text-stone-500 text-white transition"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses Dokumen...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Terapkan &amp; Unduh Hasil Bersih
                </>
              )}
            </button>
          </div>
        )}

        {/* Dialog Konfirmasi Eksplisit Rasterisasi PDF */}
        {pendingRasterAction && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="raster-confirm-title"
            data-testid="dialog-confirm-pdf-raster"
            className="absolute inset-0 z-10 bg-stone-950/70 backdrop-blur-xs rounded-2xl flex items-center justify-center p-4"
          >
            <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-2xl p-5 space-y-3 shadow-2xl">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3
                    id="raster-confirm-title"
                    className="text-sm font-bold text-stone-900 dark:text-stone-100"
                  >
                    Konfirmasi Rasterisasi Halaman PDF
                  </h3>
                  <p className="text-xs text-stone-700 dark:text-stone-300 mt-1 leading-relaxed">
                    Halaman <strong>{rasterTargetPages.join(', ')}</strong> mengandung area mask non-annotation sehingga akan dirender ulang pada 150 DPI untuk pembersihan OpenCV. Teks selectable, vektor, dan tautan pada halaman tersebut tidak lagi interaktif. Halaman PDF lain yang tidak ditargetkan tetap dipertahankan dalam bentuk vektor asli.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingRasterAction(null)}
                  data-testid="btn-cancel-raster-confirm"
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-stone-300 dark:border-slate-600 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPdfRasterization}
                  data-testid="btn-accept-raster-confirm"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saya Mengerti &amp; Lanjutkan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
