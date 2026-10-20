import React, { useState } from 'react'
import {
  FileText,
  FolderOpen,
  Plus,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Palette,
  Type,
  Layout,
  Download,
  Upload,
  Printer,
  ShieldCheck,
  Briefcase,
  FileCode,
  X,
  RotateCcw
} from 'lucide-react'
import { type ResumeDraft, type ResumeDraftSummary } from '../../types/resume'
import { type PendingDelete } from '../../hooks/useResumeDraft'
import { TEMPLATES } from '../../templates/registry'

interface NavbarProps {
  draft: ResumeDraft | null
  draftsList: ResumeDraftSummary[]
  isSaving: boolean
  lastSaved: Date | null
  privateMode: boolean
  pendingDelete: PendingDelete | null
  atsScore?: number
  onOpenAtsScore?: () => void
  onOpenJobMatch?: () => void
  onOpenConverter?: () => void
  onOpenPdfToDocx?: () => void
  onUpdateTitle: (title: string) => void
  onUpdateTheme: (color: string) => void
  onUpdateFont: (font: string) => void
  onUpdateTemplate: (templateId: string) => void
  onExportDocx: () => void
  onExportPdf: () => void
  onOpenImportModal: () => void
  onCreateNew: () => void
  onLoadDraft: (id: string) => void
  onDeleteDraft: (id: string) => void
  onUndoDelete: () => void
  onTogglePrivateMode: (enabled: boolean) => void
}

const THEME_COLORS = [
  { name: 'Slate', value: '#1e293b' },
  { name: 'Indigo', value: '#4338ca' },
  { name: 'Blue', value: '#0369a1' },
  { name: 'Emerald', value: '#047857' },
  { name: 'Amber', value: '#b45309' },
  { name: 'Rose', value: '#be123c' }
]

export const Navbar: React.FC<NavbarProps> = ({
  draft,
  draftsList,
  isSaving,
  lastSaved,
  privateMode,
  pendingDelete,
  atsScore,
  onOpenAtsScore,
  onUpdateTitle,
  onUpdateTheme,
  onUpdateFont,
  onUpdateTemplate,
  onExportDocx,
  onExportPdf,
  onOpenImportModal,
  onOpenJobMatch,
  onOpenConverter,
  onOpenPdfToDocx,
  onCreateNew,
  onLoadDraft,
  onDeleteDraft,
  onUndoDelete,
  onTogglePrivateMode
}) => {
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-2xs sticky top-0 z-30">
        {/* Brand & Draft Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm text-slate-900 hidden sm:inline tracking-tight">
              Doc-builder
            </span>
          </div>

          {draft && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft.title}
                onChange={e => onUpdateTitle(e.target.value)}
                className="text-sm font-semibold text-slate-800 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 px-2 py-1 rounded-md border border-transparent focus:border-indigo-400 outline-none transition max-w-[200px] sm:max-w-[280px]"
                data-testid="input-draft-title"
              />

              {/* Status Autosave */}
              <div className="hidden md:flex items-center gap-1 text-2xs text-slate-500 font-medium pl-1">
                {isSaving ? (
                  <span className="flex items-center gap-1 text-indigo-600">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    Menyimpan...
                  </span>
                ) : lastSaved ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tersimpan {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
              </div>

              {/* Skor ATS Badge */}
              {atsScore !== undefined && (
                <button
                  type="button"
                  onClick={onOpenAtsScore}
                  className={`flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border transition cursor-pointer ${
                    atsScore >= 85
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                      : atsScore >= 70
                      ? 'bg-sky-50 text-sky-700 border-sky-300 hover:bg-sky-100'
                      : atsScore >= 50
                      ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                      : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                  }`}
                  title="Klik untuk membuka rincian evaluasi keterbacaan format ATS"
                  data-testid="badge-ats-score"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>ATS: {atsScore}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Theme Color Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColorPicker(!showColorPicker)
                setShowFontPicker(false)
              }}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition flex items-center gap-1 text-xs"
              title="Ganti Tema Warna"
            >
              <Palette className="w-4 h-4 text-indigo-600" />
              <span className="hidden lg:inline">Warna</span>
            </button>

            {showColorPicker && draft && (
              <div className="absolute right-0 mt-2 p-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 flex gap-1.5">
                {THEME_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      onUpdateTheme(c.value)
                      setShowColorPicker(false)
                    }}
                    style={{ backgroundColor: c.value }}
                    className={`w-6 h-6 rounded-full border-2 transition ${
                      draft.colorTheme === c.value ? 'border-indigo-500 scale-110' : 'border-white'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Font Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowFontPicker(!showFontPicker)
                setShowColorPicker(false)
              }}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition flex items-center gap-1 text-xs"
              title="Ganti Jenis Font"
            >
              <Type className="w-4 h-4 text-indigo-600" />
              <span className="hidden lg:inline">Font</span>
            </button>

            {showFontPicker && draft && (
              <div className="absolute right-0 mt-2 p-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 flex flex-col gap-1 w-28">
                {['sans', 'serif', 'mono'].map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      onUpdateFont(f)
                      setShowFontPicker(false)
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg text-left capitalize transition ${
                      draft.fontFamily === f ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-100'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Template Selector Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowTemplatePicker(!showTemplatePicker)
                setShowColorPicker(false)
                setShowFontPicker(false)
              }}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition flex items-center gap-1 text-xs"
              title="Pilih Desain Template"
              data-testid="btn-select-template"
            >
              <Layout className="w-4 h-4 text-indigo-600" />
              <span className="hidden lg:inline">Template</span>
            </button>

            {showTemplatePicker && draft && (
              <div className="absolute right-0 mt-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 w-72 space-y-2">
                <div className="text-2xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1">
                  Pilih Format Desain
                </div>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {TEMPLATES.map(t => {
                    const isSelected = draft.templateId === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          onUpdateTemplate(t.id)
                          setShowTemplatePicker(false)
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/60 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-800">{t.name}</span>
                          <span
                            className={`text-3xs px-2 py-0.5 rounded-full font-semibold ${
                              t.category === 'ats'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {t.badge}
                          </span>
                        </div>
                        <p className="text-3xs text-slate-500 leading-relaxed">{t.description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Mode Privat Toggle */}
          <button
            type="button"
            onClick={() => onTogglePrivateMode(!privateMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
              privateMode
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title={privateMode ? 'Mode privat aktif (data tidak disimpan ke disk)' : 'Aktifkan mode privat'}
          >
            {privateMode ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{privateMode ? 'Privat' : 'Standar'}</span>
          </button>

          {/* Unduh / Ekspor Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowExportMenu(!showExportMenu)
                setShowColorPicker(false)
                setShowFontPicker(false)
                setShowTemplatePicker(false)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-xs"
              data-testid="btn-export-menu"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CV</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 p-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 w-56 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onExportPdf()
                    setShowExportMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition flex items-center justify-between"
                  data-testid="btn-export-pdf"
                >
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-indigo-600" />
                    Unduh Dokumen PDF
                  </span>
                  <span className="text-3xs font-mono text-slate-400">.pdf</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onExportDocx()
                    setShowExportMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition flex items-center justify-between"
                  data-testid="btn-export-docx"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Unduh Dokumen Word
                  </span>
                  <span className="text-3xs font-mono text-slate-400">.docx</span>
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                <button
                  type="button"
                  onClick={() => {
                    window.print()
                    setShowExportMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center gap-2"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  Cetak Langsung (Print)
                </button>
              </div>
            )}
          </div>

          {/* Impor CV Button */}
          <button
            type="button"
            onClick={onOpenImportModal}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            title="Impor CV Lama (PDF/DOCX)"
            data-testid="btn-open-import"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Impor</span>
          </button>

          {/* Cocokkan Lowongan Button */}
          <button
            type="button"
            onClick={onOpenJobMatch}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 rounded-lg transition"
            title="Bandingkan CV dengan kualifikasi lowongan kerja"
            data-testid="btn-open-job-match"
          >
            <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden md:inline">Cocokkan Lowongan</span>
          </button>

          {/* Konversi DOCX ke PDF Button */}
          <button
            type="button"
            onClick={onOpenConverter}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            title="Konversi dokumen Word DOCX ke PDF"
            data-testid="btn-open-converter"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden lg:inline">DOCX→PDF</span>
          </button>

          {/* Konversi PDF ke DOCX Button */}
          <button
            type="button"
            onClick={onOpenPdfToDocx}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            title="Rekonstruksi dokumen PDF ke Word DOCX"
            data-testid="btn-open-pdf2docx"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden lg:inline">PDF→DOCX</span>
          </button>

          {/* Kelola Draft Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowDraftsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            data-testid="btn-open-drafts"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>Drafts ({draftsList.length})</span>
          </button>
        </div>
      </header>

      {/* Undo Notification Snackbar */}
      {pendingDelete && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-fade-in border border-slate-700">
          <span className="text-xs">
            Draft <strong>"{pendingDelete.title}"</strong> dihapus.
          </span>
          <button
            type="button"
            onClick={onUndoDelete}
            className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Batal (Undo 10s)
          </button>
        </div>
      )}

      {/* Modal Kelola Drafts */}
      {showDraftsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-600" />
                Daftar Draft Tersimpan
              </h3>
              <button
                type="button"
                onClick={() => setShowDraftsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Pilih resume untuk disunting atau buat baru.
              </span>
              <button
                type="button"
                onClick={() => {
                  onCreateNew()
                  setShowDraftsModal(false)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Draft Baru
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {draftsList.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">Belum ada draft tersimpan.</p>
              ) : (
                draftsList.map(d => (
                  <div
                    key={d.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition ${
                      draft?.id === d.id
                        ? 'border-indigo-400 bg-indigo-50/50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div
                      className="cursor-pointer flex-1"
                      onClick={() => {
                        onLoadDraft(d.id)
                        setShowDraftsModal(false)
                      }}
                    >
                      <h4 className="text-sm font-semibold text-slate-800">{d.title}</h4>
                      <p className="text-2xs text-slate-400">
                        Diperbarui: {new Date(d.updatedAt).toLocaleDateString()} {new Date(d.updatedAt).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onDeleteDraft(d.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                        title="Hapus draft"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
