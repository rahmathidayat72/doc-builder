import React, { useState } from 'react'
import { type ResumeDraft } from '../../types/resume'
import { getTemplateComponent } from '../../templates/registry'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

interface ResumePreviewProps {
  draft: ResumeDraft | null
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({ draft }) => {
  const [zoom, setZoom] = useState(1.0)

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

  return (
    <div className="flex flex-col h-full bg-slate-200 border-l border-slate-300">
      {/* Toolbar Zoom & Status */}
      <div className="bg-white border-b border-slate-300 px-4 py-2 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Live Preview (A4)
          </span>
          <span className="text-2xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom(prev => Math.max(0.6, prev - 0.1))}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition"
            title="Perkecil"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1.0)}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition"
            title="Reset Zoom (100%)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(prev => Math.min(1.4, prev + 0.1))}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition"
            title="Perbesar"
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
          <div className="flex-1">
            <TemplateComponent draft={draft} />
          </div>

          <footer className="pt-8 text-center text-3xs text-slate-300">
            Dihasilkan secara aman dengan Doc-builder (Offline & Private)
          </footer>
        </div>
      </div>
    </div>
  )
}
