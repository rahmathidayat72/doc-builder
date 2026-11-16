import { apiFetch } from './apiClient'

export const MAX_WATERMARK_FILE_BYTES = 25 * 1024 * 1024 // 25 MB
export const MAX_STROKES_PER_PAGE = 200
export const MAX_POINTS_PER_STROKE = 2000
export const DEFAULT_INPAINT_RADIUS = 5
export const DEFAULT_BRUSH_RADIUS_NORM = 0.025

export type WatermarkCandidateSource =
  | 'pdf_annotation'
  | 'repeated_text'
  | 'repeated_image'
  | 'ocr_text'

export type WatermarkRemovalMode = 'structural' | 'raster' | 'hybrid_raster' | 'none'

export interface WatermarkCandidate {
  id: string
  page_index: number
  source: WatermarkCandidateSource
  label: string
  confidence: number
  removal_mode: 'structural' | 'raster'
  annot_xref: number | null
  bbox_norm: [number, number, number, number]
  requires_rasterization: boolean
}

export interface WatermarkAnalyzePage {
  page_index: number
  page_number: number
  width: number
  height: number
  preview_width: number
  preview_height: number
  has_alpha: boolean
  has_vector_content: boolean
  preview_data_url: string
  candidates: WatermarkCandidate[]
}

export interface WatermarkAnalyzeData {
  file_sha256: string
  file_kind: 'pdf' | 'jpeg' | 'png'
  filename: string
  page_count: number
  ocr_status: 'completed' | 'skipped' | 'unavailable' | 'failed'
  ocr_message: string
  pages: WatermarkAnalyzePage[]
}

export interface NormalizedPoint {
  x: number
  y: number
}

export interface NormalizedBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface BrushStroke {
  mode: 'add' | 'erase'
  brush_radius_norm: number
  points: NormalizedPoint[]
}

export interface PageRemovalInstruction {
  page_index: number
  annot_xrefs: number[]
  selected_boxes: NormalizedBox[]
  strokes: BrushStroke[]
}

export interface WatermarkRemovalManifest {
  file_sha256: string
  owner_confirmed: boolean
  confirm_pdf_rasterization: boolean
  inpaint_radius: number
  pages: PageRemovalInstruction[]
}

export interface WatermarkPreviewData {
  file_kind: 'pdf' | 'jpeg' | 'png'
  page_index: number
  width: number
  height: number
  preview_width: number
  preview_height: number
  has_alpha: boolean
  removal_mode: WatermarkRemovalMode
  mask_pixel_count: number
  before_data_url: string
  after_data_url: string
}

export interface WatermarkAnalyzeResult {
  success: boolean
  data?: WatermarkAnalyzeData
  message?: string
}

export interface WatermarkPreviewResult {
  success: boolean
  data?: WatermarkPreviewData
  message?: string
}

export interface WatermarkApplyResult {
  success: boolean
  blob?: Blob
  filename?: string
  message?: string
  fileKind?: 'pdf' | 'jpeg' | 'png'
  totalPages?: number
  structuralPages?: number
  rasterizedPages?: number
  annotsRemoved?: number
  originalSize?: number
  outputSize?: number
}

export interface PageMaskSnapshot {
  selectedCandidateIds: string[]
  strokes: BrushStroke[]
}

export interface PageMaskState extends PageMaskSnapshot {
  history: PageMaskSnapshot[]
  historyIndex: number
}

const MAX_HISTORY_LEN = 30

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, Number(value.toFixed(5))))
}

export function clientToNormalizedPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): NormalizedPoint {
  const relX = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
  const relY = rect.height > 0 ? (clientY - rect.top) / rect.height : 0
  return {
    x: clampUnit(relX),
    y: clampUnit(relY),
  }
}

export function validateWatermarkClientFile(file: File): string | null {
  if (!file || !file.name) {
    return 'Pilih berkas PDF, JPG/JPEG, atau PNG terlebih dahulu.'
  }
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) {
    return 'Format berkas tidak didukung. Gunakan PDF, JPG/JPEG, atau PNG.'
  }
  if (file.size <= 0) {
    return 'Berkas kosong (0 byte).'
  }
  if (file.size > MAX_WATERMARK_FILE_BYTES) {
    return 'Ukuran berkas melebihi batas maksimal 25 MB.'
  }
  return null
}

function cloneSnapshot(snap: PageMaskSnapshot): PageMaskSnapshot {
  return {
    selectedCandidateIds: [...snap.selectedCandidateIds],
    strokes: snap.strokes.map((s) => ({
      mode: s.mode,
      brush_radius_norm: s.brush_radius_norm,
      points: s.points.map((pt) => ({ x: pt.x, y: pt.y })),
    })),
  }
}

export function createInitialPageStates(
  pages: WatermarkAnalyzePage[]
): Record<number, PageMaskState> {
  const states: Record<number, PageMaskState> = {}
  for (const page of pages) {
    const initialSnap: PageMaskSnapshot = {
      selectedCandidateIds: page.candidates.map((c) => c.id),
      strokes: [],
    }
    states[page.page_index] = {
      ...cloneSnapshot(initialSnap),
      history: [cloneSnapshot(initialSnap)],
      historyIndex: 0,
    }
  }
  return states
}

export function pushPageMaskEdit(
  state: PageMaskState,
  nextSnap: PageMaskSnapshot
): PageMaskState {
  const truncated = state.history.slice(0, state.historyIndex + 1)
  const boundedStrokes = nextSnap.strokes.slice(-MAX_STROKES_PER_PAGE).map((s) => ({
    ...s,
    brush_radius_norm: Math.min(0.25, Math.max(0.005, s.brush_radius_norm)),
    points: s.points.slice(0, MAX_POINTS_PER_STROKE),
  }))
  const normalizedNext: PageMaskSnapshot = {
    selectedCandidateIds: Array.from(new Set(nextSnap.selectedCandidateIds)),
    strokes: boundedStrokes,
  }
  const nextHistory = [...truncated, cloneSnapshot(normalizedNext)]
  if (nextHistory.length > MAX_HISTORY_LEN) {
    nextHistory.shift()
  }
  return {
    ...cloneSnapshot(normalizedNext),
    history: nextHistory,
    historyIndex: nextHistory.length - 1,
  }
}

export function undoPageMask(state: PageMaskState): PageMaskState {
  if (state.historyIndex <= 0) return state
  const nextIdx = state.historyIndex - 1
  const snap = cloneSnapshot(state.history[nextIdx])
  return {
    ...snap,
    history: state.history,
    historyIndex: nextIdx,
  }
}

export function redoPageMask(state: PageMaskState): PageMaskState {
  if (state.historyIndex >= state.history.length - 1) return state
  const nextIdx = state.historyIndex + 1
  const snap = cloneSnapshot(state.history[nextIdx])
  return {
    ...snap,
    history: state.history,
    historyIndex: nextIdx,
  }
}

export function resetPageMask(
  state: PageMaskState,
  page: WatermarkAnalyzePage
): PageMaskState {
  return pushPageMaskEdit(state, {
    selectedCandidateIds: page.candidates.map((c) => c.id),
    strokes: [],
  })
}

export function buildRemovalManifest(params: {
  analyzeData: WatermarkAnalyzeData
  pageStates: Record<number, PageMaskState>
  ownerConfirmed: boolean
  confirmPdfRasterization: boolean
  inpaintRadius?: number
}): WatermarkRemovalManifest | null {
  const {
    analyzeData,
    pageStates,
    ownerConfirmed,
    confirmPdfRasterization,
    inpaintRadius = DEFAULT_INPAINT_RADIUS,
  } = params

  const pageInstructions: PageRemovalInstruction[] = []

  for (const page of analyzeData.pages) {
    const state = pageStates[page.page_index]
    if (!state) continue

    const selectedSet = new Set(state.selectedCandidateIds)
    const annotXrefs: number[] = []
    const selectedBoxes: NormalizedBox[] = []

    for (const candidate of page.candidates) {
      if (!selectedSet.has(candidate.id)) continue
      if (
        candidate.removal_mode === 'structural' &&
        candidate.annot_xref !== null &&
        candidate.annot_xref > 0
      ) {
        if (!annotXrefs.includes(candidate.annot_xref)) {
          annotXrefs.push(candidate.annot_xref)
        }
      } else {
        const [rawX0, rawY0, rawX1, rawY1] = candidate.bbox_norm
        const x0 = clampUnit(rawX0)
        const y0 = clampUnit(rawY0)
        const x1 = clampUnit(rawX1)
        const y1 = clampUnit(rawY1)
        if (x1 > x0 && y1 > y0) {
          selectedBoxes.push({ x0, y0, x1, y1 })
        }
      }
    }

    const strokes = state.strokes.slice(0, MAX_STROKES_PER_PAGE)
    if (annotXrefs.length > 0 || selectedBoxes.length > 0 || strokes.length > 0) {
      pageInstructions.push({
        page_index: page.page_index,
        annot_xrefs: annotXrefs,
        selected_boxes: selectedBoxes,
        strokes,
      })
    }
  }

  if (pageInstructions.length === 0) {
    return null
  }

  return {
    file_sha256: analyzeData.file_sha256,
    owner_confirmed: ownerConfirmed,
    confirm_pdf_rasterization: confirmPdfRasterization,
    inpaint_radius: inpaintRadius,
    pages: pageInstructions,
  }
}

export function getPdfRasterTargetPages(
  analyzeData: WatermarkAnalyzeData | null,
  pageStates: Record<number, PageMaskState>
): number[] {
  if (!analyzeData || analyzeData.file_kind !== 'pdf') return []
  const rasterPages: number[] = []

  for (const page of analyzeData.pages) {
    const state = pageStates[page.page_index]
    if (!state) continue
    const selectedSet = new Set(state.selectedCandidateIds)
    const hasRasterCandidate = page.candidates.some(
      (c) => selectedSet.has(c.id) && c.removal_mode !== 'structural'
    )
    if (hasRasterCandidate || state.strokes.length > 0) {
      rasterPages.push(page.page_number)
    }
  }

  return rasterPages
}

export function computeManifestSignature(manifest: WatermarkRemovalManifest | null): string {
  if (!manifest) return ''
  return JSON.stringify({
    file_sha256: manifest.file_sha256,
    owner_confirmed: manifest.owner_confirmed,
    inpaint_radius: manifest.inpaint_radius,
    pages: manifest.pages,
  })
}

function getFilenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback
  const match = header.match(/filename="?([^";]+)"?/)
  return match ? match[1] : fallback
}

async function parseErrorDetail(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) {
    return 'Sesi belum masuk atau telah berakhir. Silakan login terlebih dahulu.'
  }
  if (res.status === 413) {
    return 'Ukuran berkas melebihi batas maksimal 25 MB.'
  }
  if (res.status === 429) {
    return 'Server sedang memproses berkas lain. Silakan tunggu beberapa detik dan coba lagi.'
  }
  const err = await res.json().catch(() => ({}))
  return err.detail || err.message || fallback
}

export async function analyzeWatermarkDocument(
  file: File,
  options: { ownerConfirmed: boolean; includeOcr?: boolean }
): Promise<WatermarkAnalyzeResult> {
  const fileErr = validateWatermarkClientFile(file)
  if (fileErr) {
    return { success: false, message: fileErr }
  }
  if (!options.ownerConfirmed) {
    return {
      success: false,
      message: 'Harap centang konfirmasi hak kepemilikan atau izin modifikasi dokumen.',
    }
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('owner_confirmed', String(options.ownerConfirmed))
  formData.append('include_ocr', String(options.includeOcr ?? true))

  try {
    const res = await apiFetch('/api/watermark-removal/analyze', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const payload = await res.json()
      return { success: true, data: payload.data as WatermarkAnalyzeData }
    }

    return {
      success: false,
      message: await parseErrorDetail(
        res,
        `Gagal menganalisis dokumen (${res.status}).`
      ),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : undefined
    return {
      success: false,
      message: msg || 'Tidak dapat terhubung ke server backend Satukit.',
    }
  }
}

export async function previewWatermarkRemoval(
  file: File,
  manifest: WatermarkRemovalManifest,
  pageIndex: number
): Promise<WatermarkPreviewResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('manifest_json', JSON.stringify(manifest))
  formData.append('page_index', String(pageIndex))

  try {
    const res = await apiFetch('/api/watermark-removal/preview', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const payload = await res.json()
      return { success: true, data: payload.data as WatermarkPreviewData }
    }

    return {
      success: false,
      message: await parseErrorDetail(
        res,
        `Gagal membuat pratinjau before/after (${res.status}).`
      ),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : undefined
    return {
      success: false,
      message: msg || 'Tidak dapat terhubung ke server backend Satukit.',
    }
  }
}

export async function applyWatermarkRemoval(
  file: File,
  manifest: WatermarkRemovalManifest
): Promise<WatermarkApplyResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('manifest_json', JSON.stringify(manifest))

  try {
    const res = await apiFetch('/api/watermark-removal/apply', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const blob = await res.blob()
      const extMatch = file.name.match(/\.(pdf|jpe?g|png)$/i)
      const fallbackExt = extMatch
        ? extMatch[1].toLowerCase() === 'jpeg'
          ? 'jpg'
          : extMatch[1].toLowerCase()
        : 'pdf'
      const stem = file.name.replace(/\.[^/.]+$/, '') || 'document'
      const filename = getFilenameFromHeader(
        res.headers.get('content-disposition'),
        `${stem}_watermark_removed.${fallbackExt}`
      )

      return {
        success: true,
        blob,
        filename,
        totalPages: Number(res.headers.get('x-total-pages')) || manifest.pages.length,
        structuralPages: Number(res.headers.get('x-structural-pages')) || 0,
        rasterizedPages: Number(res.headers.get('x-rasterized-pages')) || 0,
        annotsRemoved: Number(res.headers.get('x-annots-removed')) || 0,
        originalSize: Number(res.headers.get('x-original-size')) || file.size,
        outputSize: Number(res.headers.get('x-output-size')) || blob.size,
      }
    }

    return {
      success: false,
      message: await parseErrorDetail(
        res,
        `Gagal memproses penghapusan watermark (${res.status}).`
      ),
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : undefined
    return {
      success: false,
      message: msg || 'Tidak dapat terhubung ke server backend Satukit.',
    }
  }
}

export function downloadWatermarkBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
