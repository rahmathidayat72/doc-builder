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
  Wrench,
  X,
  RotateCcw,
} from 'lucide-react'
import { type ResumeDraft, type ResumeDraftSummary } from '../../types/resume'
import { type PendingDelete } from '../../hooks/useResumeDraft'
import { TEMPLATES } from '../../templates/registry'

export type Workspace = 'builder' | 'ats' | 'tools'

interface NavbarProps {
  activeWorkspace?: Workspace
  onNavigate?: (workspace: Workspace) => void
  draft: ResumeDraft | null
  draftsList: ResumeDraftSummary[]
  isSaving: boolean
  lastSaved: Date | null
  privateMode: boolean
  pendingDelete: PendingDelete | null
  atsScore?: number
  onOpenAtsScore?: () => void
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
  { name: 'Rose', value: '#be123c' },
]

const WORKSPACES: { id: Workspace; label: string; icon: typeof FileText }[] = [
  { id: 'builder', label: 'Buat CV', icon: FileText },
  { id: 'ats', label: 'Optimasi ATS', icon: ShieldCheck },
  { id: 'tools', label: 'Alat Dokumen', icon: Wrench },
]

export const Navbar: React.FC<NavbarProps> = ({
  activeWorkspace = 'builder',
  onNavigate,
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
  onCreateNew,
  onLoadDraft,
  onDeleteDraft,
  onUndoDelete,
  onTogglePrivateMode,
}) => {
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  const closeMenus = () => {
    setShowColorPicker(false)
    setShowFontPicker(false)
    setShowTemplatePicker(false)
    setShowExportMenu(false)
  }

  return (
    <>
      <header className="shrink-0 bg-white border-b border-slate-200 shadow-xs z-30">
        <div className="h-14 px-3 sm:px-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate?.('builder')}
            className="flex items-center gap-2 shrink-0"
            aria-label="Buka Beranda Doc-builder"
          >
            <span className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <FileText className="w-5 h-5" />
            </span>
            <span className="font-black text-sm text-slate-900 hidden sm:block">Doc-builder</span>
          </button>

          <nav className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl" aria-label="Navigasi utama">
            {WORKSPACES.map(item => {
              const Icon = item.icon
              const active = activeWorkspace === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    closeMenus()
                    onNavigate?.(item.id)
                  }}
                  className={`h-8 px-2.5 sm:px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 min-w-0">
            {activeWorkspace === 'builder' && draft && (
              <>
                <div className="hidden xl:flex min-w-0 items-center gap-2 mr-1">
                  <input
                    type="text"
                    value={draft.title}
                    onChange={e => onUpdateTitle(e.target.value)}
                    placeholder="Judul Resume"
                    aria-label="Judul Resume"
                    className="w-36 2xl:w-48 text-sm font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none transition"
                    data-testid="input-draft-title"
                  />
                  <span className="flex items-center gap-1 text-2xs font-medium text-slate-500 whitespace-nowrap">
                    {isSaving ? (
                      <><Clock className="w-3.5 h-3.5 animate-spin text-indigo-600" /> Menyimpan</>
                    ) : lastSaved ? (
                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Tersimpan</>
                    ) : null}
                  </span>
                </div>

                <div className="hidden lg:flex items-center gap-1 border-l border-slate-200 pl-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        setShowColorPicker(true)
                      }}
                      className="p-2 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                      title="Ganti warna CV"
                    >
                      <Palette className="w-4 h-4" />
                    </button>
                    {showColorPicker && (
                      <div className="absolute right-0 mt-2 p-3 bg-white border border-slate-200 rounded-xl shadow-xl z-50 flex gap-2">
                        {THEME_COLORS.map(color => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => {
                              onUpdateTheme(color.value)
                              setShowColorPicker(false)
                            }}
                            style={{ backgroundColor: color.value }}
                            className={`w-7 h-7 rounded-full border-2 transition ${
                              draft.colorTheme === color.value ? 'border-indigo-500 scale-110' : 'border-white shadow-xs'
                            }`}
                            title={color.name}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        setShowFontPicker(true)
                      }}
                      className="p-2 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                      title="Ganti font CV"
                    >
                      <Type className="w-4 h-4" />
                    </button>
                    {showFontPicker && (
                      <div className="absolute right-0 mt-2 p-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 w-32">
                        {['sans', 'serif', 'mono'].map(font => (
                          <button
                            key={font}
                            type="button"
                            onClick={() => {
                              onUpdateFont(font)
                              setShowFontPicker(false)
                            }}
                            className={`w-full text-xs px-3 py-2 rounded-lg text-left capitalize ${
                              draft.fontFamily === font ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50'
                            }`}
                          >
                            {font}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        setShowTemplatePicker(true)
                      }}
                      className="p-2 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                      title="Pilih template CV"
                      data-testid="btn-select-template"
                    >
                      <Layout className="w-4 h-4" />
                    </button>
                    {showTemplatePicker && (
                      <div className="absolute right-0 mt-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 w-72 space-y-2">
                        <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Pilih Template</p>
                        {TEMPLATES.map(template => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => {
                              onUpdateTemplate(template.id)
                              setShowTemplatePicker(false)
                            }}
                            className={`w-full text-left p-3 rounded-xl border transition ${
                              draft.templateId === template.id
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-xs font-bold text-slate-800 block">{template.name}</span>
                            <span className="text-3xs text-slate-500">{template.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {atsScore !== undefined && (
                  <button
                    type="button"
                    onClick={onOpenAtsScore}
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200"
                    title="Buka rincian skor ATS"
                    data-testid="badge-ats-score"
                  >
                    <ShieldCheck className="w-4 h-4" /> {atsScore}
                  </button>
                )}

                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                  data-testid="btn-open-import"
                >
                  <Upload className="w-4 h-4" /> Impor
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      closeMenus()
                      setShowExportMenu(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
                    data-testid="btn-export-menu"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Unduh</span>
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 p-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 w-56 space-y-1">
                      <button
                        type="button"
                        onClick={() => { onExportPdf(); setShowExportMenu(false) }}
                        className="w-full px-3 py-2 text-xs font-medium text-left text-slate-700 hover:bg-indigo-50 rounded-lg flex justify-between"
                        data-testid="btn-export-pdf"
                      >
                        Unduh PDF <span className="text-slate-400">.pdf</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { onExportDocx(); setShowExportMenu(false) }}
                        className="w-full px-3 py-2 text-xs font-medium text-left text-slate-700 hover:bg-indigo-50 rounded-lg flex justify-between"
                        data-testid="btn-export-docx"
                      >
                        Unduh Word <span className="text-slate-400">.docx</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { window.print(); setShowExportMenu(false) }}
                        className="w-full px-3 py-2 text-xs font-medium text-left text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2"
                      >
                        <Printer className="w-4 h-4" /> Cetak langsung
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeWorkspace === 'builder' && (
              <button
                type="button"
                onClick={() => setShowDraftsModal(true)}
                className="p-2 sm:px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5"
                data-testid="btn-open-drafts"
                title="Kelola draft CV"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden 2xl:inline">Draft ({draftsList.length})</span>
              </button>
            )}
          </div>
        </div>

        {activeWorkspace === 'builder' && draft && (
          <div className="lg:hidden px-3 pb-2 flex items-center gap-2 overflow-x-auto">
            <input
              type="text"
              value={draft.title}
              onChange={e => onUpdateTitle(e.target.value)}
              aria-label="Judul Resume"
              className="min-w-36 flex-1 text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
            <button type="button" onClick={() => onTogglePrivateMode(!privateMode)} className="p-2 border border-slate-200 rounded-lg" title="Mode privasi">
              {privateMode ? <Lock className="w-4 h-4 text-amber-600" /> : <Unlock className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
        )}
      </header>

      {pendingDelete && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 border border-slate-700">
          <span className="text-xs">Draft <strong>“{pendingDelete.title}”</strong> dihapus.</span>
          <button type="button" onClick={onUndoDelete} className="flex items-center gap-1 text-xs font-bold text-amber-400">
            <RotateCcw className="w-3.5 h-3.5" /> Batal
          </button>
        </div>
      )}

      {showDraftsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">Draft CV</h3>
                <p className="text-xs text-slate-500">Pilih CV tersimpan atau buat CV baru.</p>
              </div>
              <button type="button" onClick={() => setShowDraftsModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="Tutup daftar draft">
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => { onCreateNew(); setShowDraftsModal(false) }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              <Plus className="w-4 h-4" /> Buat CV Baru
            </button>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {draftsList.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">Belum ada draft tersimpan.</p>
              ) : draftsList.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex items-center gap-2 ${
                    draft?.id === item.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => { onLoadDraft(item.id); setShowDraftsModal(false) }}
                    className="flex-1 text-left"
                  >
                    <span className="text-sm font-semibold text-slate-800 block">{item.title}</span>
                    <span className="text-2xs text-slate-400">{new Date(item.updatedAt).toLocaleString()}</span>
                  </button>
                  <button type="button" onClick={() => onDeleteDraft(item.id)} className="p-2 text-slate-400 hover:text-red-600" aria-label={`Hapus ${item.title}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
