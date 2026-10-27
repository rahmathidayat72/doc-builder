import React, { useEffect, useRef, useState } from 'react'
import { type ResumeDraft } from '../../types/resume'
import { getTemplateComponent } from '../../templates/registry'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

const MM_TO_PX = 96 / 25.4
const A4_HEIGHT_PX = 297 * MM_TO_PX
const PAGE_VERTICAL_PADDING_PX = 80 // p-10 atas + bawah
const PAGE_CONTENT_HEIGHT_PX = A4_HEIGHT_PX - PAGE_VERTICAL_PADDING_PX
const FULL_BLEED_TEMPLATE_IDS = new Set(['visual-executive'])

interface ResumePreviewProps {
  draft: ResumeDraft | null
  onPageCountChange?: (pageCount: number) => void
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({ draft, onPageCountChange }) => {
  const [zoom, setZoom] = useState(1.0)
  const [pageCount, setPageCount] = useState(1)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!draft) return

    const measure = () => {
      const height = contentRef.current?.scrollHeight || 0
      const fullBleed = FULL_BLEED_TEMPLATE_IDS.has(draft.templateId)
      // Template full-bleed memakai tinggi A4 penuh (tanpa padding kertas),
      // sehingga tinggi minimum 297mm tidak boleh dihitung sebagai halaman kedua.
      const pageHeight = fullBleed ? A4_HEIGHT_PX : PAGE_CONTENT_HEIGHT_PX
      const nextPageCount =
        height > 0 ? Math.max(1, Math.ceil(height / pageHeight)) : 1
      setPageCount(previous => (previous === nextPageCount ? previous : nextPageCount))
    }

    measure()

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && contentRef.current) {
      observer = new ResizeObserver(measure)
      observer.observe(contentRef.current)
    }

    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [draft])

  useEffect(() => {
    onPageCountChange?.(pageCount)
  }, [onPageCountChange, pageCount])

  if (!draft) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 p-8 text-slate-400">
        <p className="text-sm">Pilih atau buat draft baru untuk melihat pratinjau.</p>
      </div>
    )
  }

  const fontClass =
    draft.fontFamily === 'serif'
      ? 'font-serif'
      : draft.fontFamily === 'mono'
      ? 'font-mono'
      : 'font-sans'

  const TemplateComponent = getTemplateComponent(draft.templateId)
  const isFullBleed = FULL_BLEED_TEMPLATE_IDS.has(draft.templateId)
  const pageBreaks = Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 2)

  return (
    <div className="flex flex-col h-full bg-slate-200 border-l border-slate-300">
      {/* Toolbar Zoom & Status */}
      <div className="no-print bg-white border-b border-slate-300 px-4 py-2 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Live Preview (A4)
          </span>
          <span className="text-2xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <span
            key={pageCount}
            className={`text-2xs px-2 py-0.5 rounded font-semibold animate-soft-pulse ${
              pageCount > 2 ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'
            }`}
            data-testid="page-count"
            title={`Perkiraan ${pageCount} halaman A4`}
          >
            {pageCount} halaman
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom(prev => Math.max(0.6, prev - 0.1))}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition"
            title="Perkecil"
            aria-label="Perkecil pratinjau"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1.0)}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition"
            title="Reset Zoom (100%)"
            aria-label="Reset zoom pratinjau"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(prev => Math.min(1.4, prev + 0.1))}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition"
            title="Perbesar"
            aria-label="Perbesar pratinjau"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Viewport Kontainer Kertas A4 */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
            width: '210mm',
            minHeight: '297mm'
          }}
          className={`bg-white shadow-2xl p-10 text-slate-800 ${fontClass} relative flex flex-col justify-between`}
          data-testid="resume-preview-sheet"
        >
          <div ref={contentRef} className="relative flex-1">
            <div key={`${draft.templateId}-${draft.fontFamily}-${draft.colorTheme}`} className="animate-fade-in">
              <TemplateComponent draft={draft} />
            </div>

            {pageBreaks.map(pageNumber => (
              <div
                key={pageNumber}
                className="no-print pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-indigo-400/70 print:hidden"
                style={{
                  top: isFullBleed
                    ? `${A4_HEIGHT_PX * (pageNumber - 1) - 40}px`
                    : `${PAGE_CONTENT_HEIGHT_PX * (pageNumber - 1)}px`
                }}
                data-testid={`page-break-${pageNumber}`}
                aria-hidden="true"
              >
                <span className="absolute right-0 -top-5 rounded bg-indigo-50 px-1.5 py-0.5 text-3xs font-semibold text-indigo-600">
                  Halaman {pageNumber}
                </span>
              </div>
            ))}
          </div>

          <footer className="pt-8 text-center text-3xs text-slate-300">
            Dihasilkan secara aman dengan Doc-builder (Offline &amp; Private)
          </footer>
        </div>
      </div>
    </div>
  )
}
