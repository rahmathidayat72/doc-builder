import React from 'react'
import { FileText, Sparkles } from 'lucide-react'

interface SummaryFormProps {
  summary: string
  onChange: (updated: string) => void
}

export const SummaryForm: React.FC<SummaryFormProps> = ({ summary, onChange }) => {
  const wordCount = summary.trim() ? summary.trim().split(/\s+/).length : 0

  return (
    <div className="space-y-3">
      <div className="border-b pb-2 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Ringkasan Profesional
          </h3>
          <p className="text-xs text-slate-500">
            Jelaskan pengalaman kunci, spesialisasi, dan nilai tambah Anda dalam 2–4 kalimat padat.
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded font-medium ${
          wordCount >= 30 && wordCount <= 80
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-slate-100 text-slate-600'
        }`}>
          {wordCount} kata (Ideal: 40–70)
        </span>
      </div>

      <div className="relative">
        <textarea
          rows={5}
          placeholder="Contoh: Software Engineer berdedikasi dengan 4+ tahun pengalaman dalam perancangan API mikro terdistribusi menggunakan Python dan TypeScript..."
          value={summary}
          onChange={e => onChange(e.target.value)}
          className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition leading-relaxed"
          data-testid="textarea-summary"
        />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2 text-xs text-amber-800">
        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p>
          <strong>Tips ATS:</strong> Hindari klaim klise tanpa bukti. Sertakan kata kunci posisi jabatan dan hasil terukur (misal: "Meningkatkan performa sistem 35%").
        </p>
      </div>
    </div>
  )
}
