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
  Star,
  Copy,
  Pencil,
  Check,
  Search,
  Home,
} from 'lucide-react'
import { type ResumeDraft, type ResumeDraftSummary, type ResumeLanguage } from '../../types/resume'
import { type PendingDelete } from '../../hooks/useResumeDraft'
import { TEMPLATES } from '../../templates/registry'
import { useDismiss } from '../../hooks/useDismiss'
import { AnimatedDocumentMascot } from './AnimatedDocumentMascot'

export type Workspace = 'home' | 'builder' | 'ats' | 'tools'

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
  onUpdateLanguage?: (language: ResumeLanguage) => void
  onExportDocx: () => void
  onExportPdf: () => void
  onExportPrint?: () => void
  onOpenImportModal: () => void
  onCreateNew: () => void
  onLoadDraft: (id: string) => void
  onDeleteDraft: (id: string) => void
  onRenameDraft: (id: string, title: string) => Promise<void> | void
  onDuplicateDraft: (id: string) => Promise<void> | void
  onToggleFavorite: (id: string) => void
  onUndoDelete: () => void
  onTogglePrivateMode: (enabled: boolean) => void
}

const THEME_COLORS = [
  { name: 'Slate', value: '#1e293b' },
  { name: 'Forest Teal', value: '#0f766e' },
  { name: 'Blue', value: '#0369a1' },
  { name: 'Emerald', value: '#047857' },
  { name: 'Amber', value: '#b45309' },
  { name: 'Rose', value: '#be123c' },
]

const WORKSPACES: { id: Workspace; label: string; icon: typeof FileText }[] = [
  { id: 'home', label: 'Beranda', icon: Home },
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
  onUpdateLanguage,
  onExportDocx,
  onExportPdf,
  onExportPrint,
  onOpenImportModal,
  onCreateNew,
  onLoadDraft,
  onDeleteDraft,
  onRenameDraft,
  onDuplicateDraft,
  onToggleFavorite,
  onUndoDelete,
  onTogglePrivateMode,
}) => {
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [draftSearch, setDraftSearch] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isLogoHovered, setIsLogoHovered] = useState(false)
  const [isLogoClicked, setIsLogoClicked] = useState(false)

  const query = draftSearch.trim().toLowerCase()
  const filteredDrafts = query
    ? draftsList.filter(
        item =>
          item.title.toLowerCase().includes(query) ||
          (item.targetJobTitle || '').toLowerCase().includes(query)
      )
    : draftsList

  const startRename = (id: string, title: string) => {
    setRenamingId(id)
    setRenameValue(title)
  }

  const saveRename = async (id: string) => {
    if (!renameValue.trim()) return
    await onRenameDraft(id, renameValue)
    setRenamingId(null)
  }

  const closeMenus = () => {
    setShowColorPicker(false)
    setShowFontPicker(false)
    setShowTemplatePicker(false)
    setShowExportMenu(false)
  }

  const anyMenuOpen = showColorPicker || showFontPicker || showTemplatePicker || showExportMenu
  const menusRef = useDismiss<HTMLDivElement>(anyMenuOpen, closeMenus)
  const draftsPanelRef = useDismiss<HTMLDivElement>(showDraftsModal, () => {
    if (renamingId) {
      setRenamingId(null)
      return
    }
    setShowDraftsModal(false)
  })

  return (
    <>
      <header className="shrink-0 bg-[#FAF9F6]/95 backdrop-blur border-b border-stone-200/90 z-30 relative">
        <div className="h-16 px-3 sm:px-5 flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => {
              setIsLogoClicked(true)
              setTimeout(() => setIsLogoClicked(false), 800)
              onNavigate?.('home')
            }}
            onMouseEnter={() => setIsLogoHovered(true)}
            onMouseLeave={() => setIsLogoHovered(false)}
            className="group flex items-center gap-2.5 shrink-0 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 py-1"
            aria-label="Buka Beranda Doc-builder"
            data-testid="btn-logo-home"
          >
            <AnimatedDocumentMascot
              activeWorkspace={activeWorkspace}
              isSaving={isSaving}
              lastSaved={lastSaved}
              isHovered={isLogoHovered}
              isClicked={isLogoClicked}
              className="w-11 h-11 sm:w-12 sm:h-12"
            />
            <span className="font-bold tracking-tight text-base text-stone-900 hidden sm:block">Doc-builder</span>
          </button>

          <nav className="flex items-center gap-1 p-1 bg-stone-200/60 border border-stone-200/80 rounded-xl" aria-label="Navigasi utama">
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
                  className={`h-8 px-2.5 sm:px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                    active
                      ? 'bg-white text-teal-900 shadow-2xs border border-stone-200/70'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-teal-800' : 'text-stone-500'}`} />
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div ref={menusRef} className="ml-auto flex items-center gap-2 min-w-0">
            {activeWorkspace === 'builder' && draft && (
              <>
                <div className="hidden xl:flex min-w-0 items-center gap-2 mr-1">
                  <input
                    type="text"
                    value={draft.title}
                    onChange={e => onUpdateTitle(e.target.value)}
                    placeholder="Judul Resume"
                    aria-label="Judul Resume"
                    className="w-36 2xl:w-48 text-sm font-semibold text-stone-900 bg-white focus:bg-white focus:ring-2 focus:ring-teal-700 px-2.5 py-1.5 rounded-lg border border-stone-300 outline-none transition"
                    data-testid="input-draft-title"
                  />
                  <span className="flex items-center gap-1 text-2xs font-medium text-stone-600 whitespace-nowrap">
                    {isSaving ? (
                      <span key="saving" className="flex items-center gap-1 animate-fade-in"><Clock className="w-3.5 h-3.5 animate-spin text-teal-800" /> Menyimpan</span>
                    ) : lastSaved ? (
                      <span key="saved" className="flex items-center gap-1 animate-fade-in"><CheckCircle2 className="w-3.5 h-3.5 text-teal-800" /> Tersimpan</span>
                    ) : null}
                  </span>
                </div>

                <div className="hidden lg:flex items-center gap-1 border-l border-stone-200 pl-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        setShowColorPicker(true)
                      }}
                      className="p-2 text-stone-600 hover:text-teal-900 hover:bg-stone-100 rounded-lg transition"
                      title="Ganti warna CV"
                    >
                      <Palette className="w-4 h-4" />
                    </button>
                    {showColorPicker && (
                      <div className="absolute right-0 mt-2 p-3 bg-white border border-stone-200 rounded-xl shadow-xl z-50 flex gap-2 origin-top-right animate-pop-in">
                        {THEME_COLORS.map(color => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => {
                              onUpdateTheme(color.value)
                              setShowColorPicker(false)
                            }}
                            style={{ backgroundColor: color.value }}
                            className={`w-7 h-7 rounded-full border-2 transition-transform duration-150 hover:scale-110 ${
                              draft.colorTheme === color.value ? 'border-teal-700 scale-110' : 'border-white shadow-xs'
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
                      className="p-2 text-stone-600 hover:text-teal-900 hover:bg-stone-100 rounded-lg transition"
                      title="Ganti font CV"
                    >
                      <Type className="w-4 h-4" />
                    </button>
                    {showFontPicker && (
                      <div className="absolute right-0 mt-2 p-2 bg-white border border-stone-200 rounded-xl shadow-xl z-50 w-32 origin-top-right animate-pop-in">
                        {['sans', 'serif', 'mono'].map(font => (
                          <button
                            key={font}
                            type="button"
                            onClick={() => {
                              onUpdateFont(font)
                              setShowFontPicker(false)
                            }}
                            className={`w-full text-xs px-3 py-2 rounded-lg text-left capitalize transition-colors ${
                              draft.fontFamily === font ? 'bg-teal-50 text-teal-900 font-bold' : 'hover:bg-stone-50'
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
                      className="p-2 text-stone-600 hover:text-teal-900 hover:bg-stone-100 rounded-lg transition"
                      title="Pilih template CV"
                      data-testid="btn-select-template"
                    >
                      <Layout className="w-4 h-4" />
                    </button>
                    {showTemplatePicker && (
                      <div className="absolute right-0 mt-2 p-3 bg-white border border-stone-200 rounded-2xl shadow-2xl z-50 w-72 space-y-2 origin-top-right animate-pop-in">
                        <p className="text-2xs font-bold uppercase tracking-wider text-stone-500">Pilih Template</p>
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
                                ? 'border-teal-700 bg-teal-50/70'
                                : 'border-stone-200 hover:bg-stone-50'
                            }`}
                          >
                            <span className="text-xs font-bold text-stone-900 block">{template.name}</span>
                            <span className="text-3xs text-stone-600">{template.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    className="flex items-center p-0.5 bg-stone-200/60 rounded-lg border border-stone-200 ml-1"
                    role="group"
                    aria-label="Pilih bahasa CV"
                  >
                    <button
                      type="button"
                      onClick={() => onUpdateLanguage?.('id')}
                      className={`px-2 py-1 text-2xs font-bold rounded-md transition ${
                        (draft.resumeLanguage || 'id') === 'id'
                          ? 'bg-white text-teal-900 shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                      aria-pressed={(draft.resumeLanguage || 'id') === 'id'}
                      data-testid="btn-lang-id"
                      title="Bahasa CV: Indonesia"
                    >
                      ID
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateLanguage?.('en')}
                      className={`px-2 py-1 text-2xs font-bold rounded-md transition ${
                        draft.resumeLanguage === 'en'
                          ? 'bg-white text-teal-900 shadow-2xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                      aria-pressed={draft.resumeLanguage === 'en'}
                      data-testid="btn-lang-en"
                      title="Bahasa CV: English"
                    >
                      EN
                    </button>
                  </div>
                </div>

                {atsScore !== undefined && (
                  <button
                    key={atsScore}
                    type="button"
                    onClick={onOpenAtsScore}
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-900 text-xs font-bold border border-teal-200 transition-colors hover:bg-teal-100"
                    title="Buka rincian skor ATS"
                    data-testid="badge-ats-score"
                  >
                    <ShieldCheck className="w-4 h-4 text-teal-800" /> {atsScore}
                  </button>
                )}

                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg transition"
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
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg shadow-2xs transition"
                    data-testid="btn-export-menu"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Unduh</span>
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 p-2 bg-white border border-stone-200 rounded-xl shadow-2xl z-50 w-56 space-y-1 origin-top-right animate-pop-in">
                      <button
                        type="button"
                        onClick={() => { onExportPdf(); setShowExportMenu(false) }}
                        className="w-full px-3 py-2 text-xs font-medium text-left text-stone-800 hover:bg-stone-100 rounded-lg flex justify-between"
                        data-testid="btn-export-pdf"
                      >
                        Unduh PDF <span className="text-stone-500">.pdf</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { onExportDocx(); setShowExportMenu(false) }}
                        className="w-full px-3 py-2 text-xs font-medium text-left text-stone-800 hover:bg-stone-100 rounded-lg flex justify-between"
                        data-testid="btn-export-docx"
                      >
                        Unduh Word <span className="text-stone-500">.docx</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onExportPrint) onExportPrint()
                          else window.print()
                          setShowExportMenu(false)
                        }}
                        className="w-full px-3 py-2 text-xs font-medium text-left text-stone-700 hover:bg-stone-100 rounded-lg flex items-center gap-2"
                        data-testid="btn-export-print"
                      >
                        <Printer className="w-4 h-4" /> Cetak langsung
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {(activeWorkspace === 'builder' || activeWorkspace === 'home') && (
              <button
                type="button"
                onClick={() => setShowDraftsModal(true)}
                className="p-2 sm:px-3 text-xs font-semibold text-stone-800 bg-stone-200/70 hover:bg-stone-200 rounded-lg transition flex items-center gap-1.5"
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
              className="min-w-36 flex-1 text-xs font-semibold px-3 py-2 bg-white border border-stone-300 rounded-lg outline-none"
            />
            <div
              className="flex items-center p-0.5 bg-stone-200/60 rounded-lg border border-stone-200 shrink-0"
              role="group"
              aria-label="Pilih bahasa CV (mobile)"
            >
              <button
                type="button"
                onClick={() => onUpdateLanguage?.('id')}
                className={`px-2 py-1 text-2xs font-bold rounded-md transition ${
                  (draft.resumeLanguage || 'id') === 'id'
                    ? 'bg-white text-teal-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                aria-pressed={(draft.resumeLanguage || 'id') === 'id'}
                data-testid="btn-lang-id-mobile"
                title="Bahasa CV: Indonesia"
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => onUpdateLanguage?.('en')}
                className={`px-2 py-1 text-2xs font-bold rounded-md transition ${
                  draft.resumeLanguage === 'en'
                    ? 'bg-white text-teal-900 shadow-2xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
                aria-pressed={draft.resumeLanguage === 'en'}
                data-testid="btn-lang-en-mobile"
                title="Bahasa CV: English"
              >
                EN
              </button>
            </div>
            <button type="button" onClick={() => onTogglePrivateMode(!privateMode)} className="p-2 border border-stone-300 bg-white rounded-lg" title="Mode privasi">
              {privateMode ? <Lock className="w-4 h-4 text-amber-700" /> : <Unlock className="w-4 h-4 text-stone-600" />}
            </button>
          </div>
        )}
      </header>

      {pendingDelete && (
        <div role="status" className="fixed bottom-4 right-4 bg-stone-900 text-white px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-3 border border-stone-700 animate-toast-in">
          <span className="text-xs">Draft <strong>“{pendingDelete.title}”</strong> dihapus.</span>
          <button type="button" onClick={onUndoDelete} className="flex items-center gap-1 text-xs font-bold text-amber-400">
            <RotateCcw className="w-3.5 h-3.5" /> Batal
          </button>
        </div>
      )}

      {showDraftsModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-overlay-in">
          <div
            ref={draftsPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Draft CV"
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4 border border-stone-200"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">Draft CV</h3>
                <p className="text-xs text-stone-600">Pilih CV tersimpan atau buat CV baru.</p>
              </div>
              <button type="button" onClick={() => setShowDraftsModal(false)} className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition" aria-label="Tutup daftar draft">
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => { onCreateNew(); setShowDraftsModal(false) }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> Buat CV Baru
            </button>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type="search"
                value={draftSearch}
                onChange={event => setDraftSearch(event.target.value)}
                placeholder="Cari judul atau target lowongan..."
                className="w-full rounded-lg border border-stone-300 bg-stone-50 py-2 pl-8 pr-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-teal-700"
                aria-label="Cari draft CV"
                data-testid="input-search-drafts"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {draftsList.length === 0 ? (
                <p className="text-center text-xs text-stone-500 py-6">Belum ada draft tersimpan.</p>
              ) : filteredDrafts.length === 0 ? (
                <p className="text-center text-xs text-stone-500 py-6">Tidak ada draft yang cocok dengan pencarian.</p>
              ) : filteredDrafts.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex items-center gap-1.5 transition-colors duration-150 ${
                    draft?.id === item.id ? 'border-teal-700 bg-teal-50/60' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                  data-testid={`draft-item-${item.id}`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(item.id)}
                    className={`p-1.5 rounded transition ${
                      item.favorite ? 'text-amber-600 hover:text-amber-700' : 'text-stone-400 hover:text-amber-600'
                    }`}
                    aria-label={item.favorite ? `Hapus favorit ${item.title}` : `Favoritkan ${item.title}`}
                    title={item.favorite ? 'Hapus dari favorit' : 'Jadikan favorit'}
                    data-testid={`btn-favorite-${item.id}`}
                  >
                    <Star className={`h-4 w-4 ${item.favorite ? 'fill-current' : ''}`} />
                  </button>

                  <div className="min-w-0 flex-1">
                    {renamingId === item.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={event => setRenameValue(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') saveRename(item.id)
                            if (event.key === 'Escape') setRenamingId(null)
                          }}
                          autoFocus
                          maxLength={140}
                          className="min-w-0 flex-1 rounded border border-teal-700 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-teal-700"
                          aria-label={`Judul baru untuk ${item.title}`}
                          data-testid={`input-rename-draft-${item.id}`}
                        />
                        <button
                          type="button"
                          onClick={() => saveRename(item.id)}
                          disabled={!renameValue.trim()}
                          className="rounded p-1 text-teal-800 hover:bg-teal-50 disabled:opacity-40"
                          aria-label="Simpan nama draft"
                          data-testid={`btn-save-rename-${item.id}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setRenamingId(null)} className="rounded p-1 text-stone-500 hover:bg-stone-100" aria-label="Batal ganti nama">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { onLoadDraft(item.id); setShowDraftsModal(false) }}
                        className="block w-full text-left"
                      >
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                          <span className="truncate">{item.title}</span>
                          {item.favorite && <Star className="h-3 w-3 shrink-0 fill-amber-500 text-amber-600" />}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-stone-500">
                          <span>{new Date(item.updatedAt).toLocaleString()}</span>
                          {item.targetJobTitle && (
                            <span className="rounded-full bg-teal-50 px-1.5 py-0.5 font-semibold text-teal-900 border border-teal-200">
                              Target: {item.targetJobTitle}
                            </span>
                          )}
                        </span>
                      </button>
                    )}
                  </div>

                  {renamingId !== item.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => startRename(item.id, item.title)}
                        className="p-1.5 text-stone-500 hover:text-teal-800"
                        aria-label={`Ganti nama ${item.title}`}
                        title="Ganti nama"
                        data-testid={`btn-rename-${item.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onDuplicateDraft(item.id)
                          setShowDraftsModal(false)
                        }}
                        className="p-1.5 text-stone-500 hover:text-teal-800"
                        aria-label={`Duplikasi ${item.title}`}
                        title="Duplikasi draft"
                        data-testid={`btn-duplicate-${item.id}`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteDraft(item.id)}
                        className="p-1.5 text-stone-500 hover:text-red-700"
                        aria-label={`Hapus ${item.title}`}
                        title="Hapus draft"
                        data-testid={`btn-delete-draft-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
