import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WatermarkRemovalModal } from '../WatermarkRemovalModal'
import * as watermarkService from '../../../services/watermarkRemoval'
import type {
  WatermarkAnalyzeData,
  WatermarkPreviewData,
} from '../../../services/watermarkRemoval'

vi.mock('../../../services/watermarkRemoval', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../services/watermarkRemoval')>()
  return {
    ...actual,
    analyzeWatermarkDocument: vi.fn(),
    previewWatermarkRemoval: vi.fn(),
    applyWatermarkRemoval: vi.fn(),
    downloadWatermarkBlob: vi.fn(),
  }
})

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function makeImageAnalyzeData(
  overrides: Partial<WatermarkAnalyzeData> = {}
): WatermarkAnalyzeData {
  return {
    file_sha256: 'a'.repeat(64),
    file_kind: 'png',
    filename: 'foto.png',
    page_count: 1,
    ocr_status: 'unavailable',
    ocr_message: 'OCR tidak tersedia; gunakan kuas manual atau kandidat terdeteksi.',
    pages: [
      {
        page_index: 0,
        page_number: 1,
        width: 800,
        height: 600,
        preview_width: 800,
        preview_height: 600,
        has_alpha: true,
        has_vector_content: false,
        preview_data_url: PNG_DATA_URL,
        candidates: [
          {
            id: 'cand-ocr-1',
            page_index: 0,
            source: 'ocr_text',
            label: 'DRAFT',
            confidence: 0.9,
            removal_mode: 'raster',
            annot_xref: null,
            bbox_norm: [0.2, 0.2, 0.5, 0.4],
            requires_rasterization: true,
          },
        ],
      },
    ],
    ...overrides,
  }
}

function makePdfAnalyzeData(
  mode: 'structural' | 'mixed'
): WatermarkAnalyzeData {
  const structuralCand = {
    id: 'cand-annot-10',
    page_index: 0,
    source: 'pdf_annotation' as const,
    label: 'Annotation Stamp (DRAFT)',
    confidence: 0.96,
    removal_mode: 'structural' as const,
    annot_xref: 10,
    bbox_norm: [0.25, 0.25, 0.65, 0.45] as [number, number, number, number],
    requires_rasterization: false,
  }
  const rasterCand = {
    id: 'cand-rep-2',
    page_index: 0,
    source: 'repeated_text' as const,
    label: 'CONFIDENTIAL',
    confidence: 0.91,
    removal_mode: 'raster' as const,
    annot_xref: null,
    bbox_norm: [0.1, 0.7, 0.4, 0.8] as [number, number, number, number],
    requires_rasterization: true,
  }
  return {
    file_sha256: 'b'.repeat(64),
    file_kind: 'pdf',
    filename: 'kontrak.pdf',
    page_count: 2,
    ocr_status: 'completed',
    ocr_message: 'OCR lokal aktif.',
    pages: [
      {
        page_index: 0,
        page_number: 1,
        width: 595,
        height: 842,
        preview_width: 595,
        preview_height: 842,
        has_alpha: false,
        has_vector_content: true,
        preview_data_url: PNG_DATA_URL,
        candidates: mode === 'structural' ? [structuralCand] : [structuralCand, rasterCand],
      },
      {
        page_index: 1,
        page_number: 2,
        width: 595,
        height: 842,
        preview_width: 595,
        preview_height: 842,
        has_alpha: false,
        has_vector_content: true,
        preview_data_url: PNG_DATA_URL,
        candidates: [],
      },
    ],
  }
}

function makePreviewData(pageIndex = 0): WatermarkPreviewData {
  return {
    file_kind: 'png',
    page_index: pageIndex,
    width: 800,
    height: 600,
    preview_width: 800,
    preview_height: 600,
    has_alpha: true,
    removal_mode: 'raster',
    mask_pixel_count: 1200,
    before_data_url: PNG_DATA_URL,
    after_data_url: PNG_DATA_URL,
  }
}

describe('watermarkRemoval helpers', () => {
  it('memvalidasi format, ukuran 0 byte, dan batas 25 MB pada berkas klien', () => {
    expect(
      watermarkService.validateWatermarkClientFile(
        new File(['x'], 'dokumen.docx', { type: 'application/octet-stream' })
      )
    ).toMatch(/Format berkas tidak didukung/i)

    expect(
      watermarkService.validateWatermarkClientFile(
        new File([], 'kosong.png', { type: 'image/png' })
      )
    ).toMatch(/Berkas kosong/i)

    const bigFile = new File(['x'], 'besar.pdf', { type: 'application/pdf' })
    Object.defineProperty(bigFile, 'size', { value: 26 * 1024 * 1024 })
    expect(watermarkService.validateWatermarkClientFile(bigFile)).toMatch(/25 MB/i)

    expect(
      watermarkService.validateWatermarkClientFile(
        new File(['%PDF-1.4'], 'valid.pdf', { type: 'application/pdf' })
      )
    ).toBeNull()
    expect(
      watermarkService.validateWatermarkClientFile(
        new File(['img'], 'foto.jpeg', { type: 'image/jpeg' })
      )
    ).toBeNull()
  })

  it('menghitung koordinat ternormalisasi 0..1 dan mengelola undo/redo/reset mask', () => {
    const pt = watermarkService.clientToNormalizedPoint(150, -10, {
      left: 50,
      top: 0,
      width: 200,
      height: 100,
    })
    expect(pt).toEqual({ x: 0.5, y: 0 })

    const analyzed = makeImageAnalyzeData()
    const initialStates = watermarkService.createInitialPageStates(analyzed.pages)
    let state = initialStates[0]
    expect(state.selectedCandidateIds).toEqual(['cand-ocr-1'])

    state = watermarkService.pushPageMaskEdit(state, {
      selectedCandidateIds: state.selectedCandidateIds,
      strokes: [
        {
          mode: 'add',
          brush_radius_norm: 0.03,
          points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
        },
      ],
    })
    expect(state.strokes).toHaveLength(1)

    state = watermarkService.undoPageMask(state)
    expect(state.strokes).toHaveLength(0)

    state = watermarkService.redoPageMask(state)
    expect(state.strokes).toHaveLength(1)

    state = watermarkService.resetPageMask(state, analyzed.pages[0])
    expect(state.strokes).toHaveLength(0)
    expect(state.selectedCandidateIds).toEqual(['cand-ocr-1'])
  })

  it('membangun manifest 0..1 dan mendeteksi halaman PDF target rasterisasi secara akurat', () => {
    const pdfStructural = makePdfAnalyzeData('structural')
    const structuralStates = watermarkService.createInitialPageStates(pdfStructural.pages)
    expect(watermarkService.getPdfRasterTargetPages(pdfStructural, structuralStates)).toEqual([])

    const manifest = watermarkService.buildRemovalManifest({
      analyzeData: pdfStructural,
      pageStates: structuralStates,
      ownerConfirmed: true,
      confirmPdfRasterization: false,
    })
    expect(manifest?.pages).toEqual([
      {
        page_index: 0,
        annot_xrefs: [10],
        selected_boxes: [],
        strokes: [],
      },
    ])

    // Tambah stroke manual memicu target rasterisasi halaman 1
    structuralStates[0] = watermarkService.pushPageMaskEdit(structuralStates[0], {
      selectedCandidateIds: [],
      strokes: [{ mode: 'add', brush_radius_norm: 0.025, points: [{ x: 0.5, y: 0.5 }] }],
    })
    expect(watermarkService.getPdfRasterTargetPages(pdfStructural, structuralStates)).toEqual([1])
  })
})

describe('WatermarkRemovalModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tidak me-render apapun ketika isOpen=false dan menutup saat ESC / tombol close', () => {
    const onClose = vi.fn()
    const { container, rerender } = render(
      <WatermarkRemovalModal isOpen={false} onClose={onClose} />
    )
    expect(container.firstChild).toBeNull()

    rerender(<WatermarkRemovalModal isOpen={true} onClose={onClose} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Hapus Watermark')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('btn-close-watermark-removal'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('mewajibkan berkas valid & centang kepemilikan sebelum analisis serta menampilkan mode fallback OCR', async () => {
    vi.mocked(watermarkService.analyzeWatermarkDocument).mockResolvedValueOnce({
      success: true,
      data: makeImageAnalyzeData(),
    })

    render(<WatermarkRemovalModal isOpen={true} onClose={vi.fn()} />)

    const fileInput = screen.getByTestId('input-watermark-removal-file')
    const invalidFile = new File(['abc'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })
    expect(screen.getByTestId('watermark-error-message')).toHaveTextContent(
      /Format berkas tidak didukung/i
    )

    const validPng = new File(['png-bytes'], 'foto.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [validPng] } })

    const btnAnalyze = screen.getByTestId('btn-analyze-watermark')
    expect(btnAnalyze).toBeDisabled()

    fireEvent.click(screen.getByTestId('checkbox-owner-confirmed'))
    expect(btnAnalyze).toBeEnabled()

    fireEvent.click(btnAnalyze)

    await waitFor(() => {
      expect(watermarkService.analyzeWatermarkDocument).toHaveBeenCalledWith(validPng, {
        ownerConfirmed: true,
        includeOcr: true,
      })
    })

    expect(await screen.findByTestId('notice-ocr-fallback')).toHaveTextContent(
      /OCR tidak tersedia/i
    )
    expect(screen.getByTestId('watermark-mask-canvas')).toBeInTheDocument()
  })

  it('mendukung goresan kuas tambah/hapus, undo/redo/reset, invalidasi preview wajib, dan unduh hasil', async () => {
    vi.mocked(watermarkService.analyzeWatermarkDocument).mockResolvedValueOnce({
      success: true,
      data: makeImageAnalyzeData(),
    })
    vi.mocked(watermarkService.previewWatermarkRemoval).mockResolvedValue({
      success: true,
      data: makePreviewData(0),
    })
    vi.mocked(watermarkService.applyWatermarkRemoval).mockResolvedValueOnce({
      success: true,
      blob: new Blob(['clean-png'], { type: 'image/png' }),
      filename: 'foto_watermark_removed.png',
      outputSize: 1234,
    })

    render(<WatermarkRemovalModal isOpen={true} onClose={vi.fn()} />)

    const validPng = new File(['png-bytes'], 'foto.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('input-watermark-removal-file'), {
      target: { files: [validPng] },
    })
    fireEvent.click(screen.getByTestId('checkbox-owner-confirmed'))
    fireEvent.click(screen.getByTestId('btn-analyze-watermark'))

    const canvas = await screen.findByTestId('watermark-mask-canvas')
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 300,
      right: 400,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    // Download terkunci sebelum preview
    const btnApply = screen.getByTestId('btn-apply-watermark-download')
    expect(btnApply).toBeDisabled()

    // Gores kuas tambah
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 40, clientY: 40 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 120, clientY: 90 })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 120, clientY: 90 })
    expect(screen.getByTestId('stroke-count-badge')).toHaveTextContent('Goresan kuas: 1')

    // Generate preview before/after
    fireEvent.click(screen.getByTestId('btn-generate-preview'))
    expect(await screen.findByTestId('panel-before-after-preview')).toBeInTheDocument()
    expect(btnApply).toBeEnabled()

    // Gores kuas hapus menginvalidasi review preview
    fireEvent.click(screen.getByTestId('btn-brush-erase'))
    fireEvent.pointerDown(canvas, { pointerId: 2, button: 0, clientX: 60, clientY: 60 })
    fireEvent.pointerUp(canvas, { pointerId: 2, clientX: 60, clientY: 60 })
    expect(screen.getByTestId('stroke-count-badge')).toHaveTextContent('Goresan kuas: 2')
    expect(btnApply).toBeDisabled()

    // Undo -> 1 stroke, Redo -> 2 stroke, Reset -> 0 stroke
    fireEvent.click(screen.getByTestId('btn-mask-undo'))
    expect(screen.getByTestId('stroke-count-badge')).toHaveTextContent('Goresan kuas: 1')
    fireEvent.click(screen.getByTestId('btn-mask-redo'))
    expect(screen.getByTestId('stroke-count-badge')).toHaveTextContent('Goresan kuas: 2')
    fireEvent.click(screen.getByTestId('btn-mask-reset'))
    expect(screen.getByTestId('stroke-count-badge')).toHaveTextContent('Goresan kuas: 0')

    // Preview ulang lalu unduh
    fireEvent.click(screen.getByTestId('btn-generate-preview'))
    await waitFor(() => expect(btnApply).toBeEnabled())

    fireEvent.click(btnApply)
    await waitFor(() => {
      expect(watermarkService.applyWatermarkRemoval).toHaveBeenCalledTimes(1)
      expect(watermarkService.downloadWatermarkBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        'foto_watermark_removed.png'
      )
    })
    expect(await screen.findByTestId('watermark-apply-success')).toHaveTextContent(
      'foto_watermark_removed.png'
    )
  })

  it('meminta konfirmasi eksplisit sebelum meraster halaman PDF dan mempertahankan mode struktural murni tanpa dialog raster', async () => {
    // 1. PDF mode campuran (ada kandidat raster) -> harus tampilkan dialog konfirmasi
    vi.mocked(watermarkService.analyzeWatermarkDocument).mockResolvedValueOnce({
      success: true,
      data: makePdfAnalyzeData('mixed'),
    })
    vi.mocked(watermarkService.previewWatermarkRemoval).mockResolvedValue({
      success: true,
      data: { ...makePreviewData(0), file_kind: 'pdf', removal_mode: 'hybrid_raster' },
    })

    const { unmount } = render(<WatermarkRemovalModal isOpen={true} onClose={vi.fn()} />)
    const pdfFile = new File(['%PDF-1.4'], 'kontrak.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByTestId('input-watermark-removal-file'), {
      target: { files: [pdfFile] },
    })
    fireEvent.click(screen.getByTestId('checkbox-owner-confirmed'))
    fireEvent.click(screen.getByTestId('btn-analyze-watermark'))

    expect(await screen.findByTestId('notice-pdf-raster-warning')).toHaveTextContent(
      /Halaman 1 menggunakan mask inpainting raster/i
    )

    fireEvent.click(screen.getByTestId('btn-generate-preview'))
    expect(screen.getByTestId('dialog-confirm-pdf-raster')).toBeInTheDocument()

    // Batalkan konfirmasi -> preview API tidak dipanggil
    fireEvent.click(screen.getByTestId('btn-cancel-raster-confirm'))
    expect(screen.queryByTestId('dialog-confirm-pdf-raster')).not.toBeInTheDocument()
    expect(watermarkService.previewWatermarkRemoval).not.toHaveBeenCalled()

    // Terima konfirmasi -> preview API dipanggil dengan confirm_pdf_rasterization: true
    fireEvent.click(screen.getByTestId('btn-generate-preview'))
    fireEvent.click(screen.getByTestId('btn-accept-raster-confirm'))

    await waitFor(() => {
      expect(watermarkService.previewWatermarkRemoval).toHaveBeenCalledWith(
        pdfFile,
        expect.objectContaining({ confirm_pdf_rasterization: true }),
        0
      )
    })
    unmount()

    // 2. PDF mode struktural murni -> tanpa dialog rasterisasi
    vi.mocked(watermarkService.analyzeWatermarkDocument).mockResolvedValueOnce({
      success: true,
      data: makePdfAnalyzeData('structural'),
    })
    render(<WatermarkRemovalModal isOpen={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('input-watermark-removal-file'), {
      target: { files: [pdfFile] },
    })
    fireEvent.click(screen.getByTestId('checkbox-owner-confirmed'))
    fireEvent.click(screen.getByTestId('btn-analyze-watermark'))

    expect(await screen.findByTestId('badge-structural-only')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-generate-preview'))
    expect(screen.queryByTestId('dialog-confirm-pdf-raster')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(watermarkService.previewWatermarkRemoval).toHaveBeenLastCalledWith(
        pdfFile,
        expect.objectContaining({ confirm_pdf_rasterization: false }),
        0
      )
    })
  })

  it('mendukung toggle kandidat, navigasi antarhalaman PDF, dan mode tampilan Before/After berdampingan', async () => {
    vi.mocked(watermarkService.analyzeWatermarkDocument).mockResolvedValueOnce({
      success: true,
      data: makePdfAnalyzeData('mixed'),
    })
    vi.mocked(watermarkService.previewWatermarkRemoval).mockResolvedValueOnce({
      success: true,
      data: { ...makePreviewData(0), file_kind: 'pdf', removal_mode: 'structural' },
    })

    render(<WatermarkRemovalModal isOpen={true} onClose={vi.fn()} />)
    const pdfFile = new File(['%PDF-1.4'], 'kontrak.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByTestId('input-watermark-removal-file'), {
      target: { files: [pdfFile] },
    })
    fireEvent.click(screen.getByTestId('checkbox-owner-confirmed'))
    fireEvent.click(screen.getByTestId('btn-analyze-watermark'))

    // Awalnya ada kandidat raster -> warning tampil; matikan kandidat raster -> kembali ke mode struktural murni
    const rasterCb = await screen.findByTestId('candidate-checkbox-cand-rep-2')
    expect(rasterCb).toBeChecked()
    fireEvent.click(rasterCb)
    expect(rasterCb).not.toBeChecked()
    expect(screen.getByTestId('badge-structural-only')).toBeInTheDocument()

    // Preview langsung jalan tanpa dialog raster & beralih ke mode Berdampingan
    fireEvent.click(screen.getByTestId('btn-generate-preview'))
    expect(await screen.findByTestId('panel-before-after-preview')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Berdampingan' }))
    expect(screen.getByText('Before (Asli)')).toBeInTheDocument()
    expect(screen.getByText('After (Hasil)')).toBeInTheDocument()

    // Pindah ke halaman 2 lalu kembali ke halaman 1
    expect(screen.getByTestId('label-page-indicator')).toHaveTextContent('Halaman 1 dari 2')
    fireEvent.click(screen.getByTestId('btn-next-page'))
    expect(screen.getByTestId('label-page-indicator')).toHaveTextContent('Halaman 2 dari 2')
    expect(screen.getByTestId('btn-next-page')).toBeDisabled()
    fireEvent.click(screen.getByTestId('btn-prev-page'))
    expect(screen.getByTestId('label-page-indicator')).toHaveTextContent('Halaman 1 dari 2')
  })
})
