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
  ChevronDown,
  HelpCircle,
  Info,
  LogIn,
  LogOut,
} from 'lucide-react'
import { type ResumeDraft, type ResumeDraftSummary, type ResumeLanguage } from '../../types/resume'
import { type PendingDelete } from '../../hooks/useResumeDraft'
import { type AuthUser } from '../../services/auth'
import { TEMPLATES } from '../../templates/registry'
import { useDismiss } from '../../hooks/useDismiss'
import { BrandLogo } from '../brand/BrandLogo'
import { ThemeToggle } from './ThemeToggle'
import { KituNotice } from '../brand/KituNotice'

export type Workspace = 'home' | 'builder' | 'ats' | 'tools' | 'files' | 'login'

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
  currentUser?: AuthUser | null
  onOpenLogin?: () => void
  onLogout?: () => void
}

const THEME_COLORS = [
  { name: 'Slate', value: '#1e293b' },
  { name: 'Forest Teal', value: '#0f766e' },
  { name: 'Blue', value: '#0369a1' },
  { name: 'Emerald', value: '#047857' },
  { name: 'Amber', value: '#b45309' },
  { name: 'Rose', value: '#be123c' },
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
  currentUser,
  onOpenLogin,
  onLogout,
}) => {
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showCvMenu, setShowCvMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [infoModal, setInfoModal] = useState<'panduan' | 'tentang' | null>(null)
  const [draftSearch, setDraftSearch] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

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
    setShowCvMenu(false)
    setShowUserMenu(false)
  }

  const anyMenuOpen = showColorPicker || showFontPicker || showTemplatePicker || showExportMenu || showCvMenu || showUserMenu
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
      <header className="shrink-0 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl border-b border-teal-900/10 dark:border-stone-800 z-30 relative transition-colors shadow-[0_8px_30px_rgba(15,118,110,0.06)]">
        <div ref={menusRef}>
        <div className="min-h-18 max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-8 py-2 flex flex-wrap items-center gap-2 sm:gap-3.5">
          <button
            type="button"
            onClick={() => onNavigate?.('home')}
            className="group flex items-center shrink-0 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 py-1"
            aria-label="Buka Beranda Satukit"
            data-testid="btn-logo-home"
          >
            <span className="inline-flex sm:hidden">
              <BrandLogo variant="icon" size="lg" priority />
            </span>
            <span className="hidden sm:inline-flex max-w-[168px]">
              <BrandLogo size="lg" priority className="[&_img]:max-w-full" />
            </span>
          </button>

          {/* Navigasi produk memakai kontrak route yang sudah ada. */}
          <nav className="order-3 sm:order-none w-full sm:w-auto flex items-center justify-center gap-0.5 sm:gap-1 p-1 bg-teal-50/70 dark:bg-stone-800/90 border border-teal-900/10 dark:border-stone-700 rounded-full shadow-2xs overflow-x-auto scrollbar-none" aria-label="Navigasi utama">
            <button
              type="button"
              onClick={() => {
                closeMenus()
                onNavigate?.('home')
              }}
              className={`h-8 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer ${
                activeWorkspace === 'home'
                  ? 'bg-white dark:bg-stone-900 text-teal-900 dark:text-teal-300 shadow-xs border border-stone-200/80 dark:border-stone-700'
                  : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-700/50'
              }`}
              aria-current={activeWorkspace === 'home' ? 'page' : undefined}
            >
              <Home className="w-3.5 h-3.5 text-teal-800 dark:text-teal-400" />
              <span>Beranda</span>
            </button>

            {/* CV Builder Mega Menu Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const next = !showCvMenu
                  closeMenus()
                  setShowCvMenu(next)
                }}
                aria-expanded={showCvMenu}
                aria-haspopup="true"
                className={`h-8 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                  showCvMenu || activeWorkspace === 'builder'
                    ? 'bg-white dark:bg-stone-900 text-teal-900 dark:text-teal-300 shadow-xs border border-stone-200/80 dark:border-stone-700'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-700/50'
                }`}
                aria-current={activeWorkspace === 'builder' ? 'page' : undefined}
                data-testid="btn-nav-cv-builder"
              >
                <FileText className="w-3.5 h-3.5 text-teal-800 dark:text-teal-400" />
                <span>CV Builder</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showCvMenu ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {activeWorkspace === 'ats' && (
              <button
                type="button"
                onClick={() => {
                  closeMenus()
                  onNavigate?.('ats')
                }}
                className="h-8 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-stone-900 text-teal-900 dark:text-teal-300 shadow-xs border border-stone-200/80 dark:border-stone-700 cursor-pointer"
                aria-current="page"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-800 dark:text-teal-400" />
                <span className="hidden md:inline">ATS Optimizer</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                closeMenus()
                onNavigate?.('tools')
              }}
              className={`h-8 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-xs font-semibold transition-colors duration-150 cursor-pointer ${
                activeWorkspace === 'tools'
                  ? 'bg-white dark:bg-stone-900 text-teal-900 dark:text-teal-300 shadow-xs border border-stone-200/80 dark:border-stone-700'
                  : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-700/50'
              }`}
              aria-current={activeWorkspace === 'tools' ? 'page' : undefined}
            >
              <Wrench className="w-3.5 h-3.5 text-teal-800 dark:text-teal-400" />
              <span>Tools</span>
            </button>

            <button
              type="button"
              onClick={() => { closeMenus(); setInfoModal('panduan') }}
              className="h-8 px-3 rounded-full hidden sm:flex items-center gap-1 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-700/50 transition cursor-pointer"
            >
              <span>Panduan</span>
            </button>

            <button
              type="button"
              onClick={() => { closeMenus(); setInfoModal('tentang') }}
              className="h-8 px-3 rounded-full hidden sm:flex items-center gap-1 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-stone-700/50 transition cursor-pointer"
            >
              <span>Tentang</span>
            </button>
          </nav>

          <div className="contents">
            {activeWorkspace === 'builder' && draft && (
              <div
                className="order-4 basis-full min-w-0 flex flex-wrap lg:flex-nowrap items-center gap-2 pt-2 border-t border-[#b7ddd4] dark:border-stone-700"
                data-testid="builder-context-toolbar"
              >
                <div className="flex basis-full min-w-0 items-center gap-2" data-testid="builder-title-status">
                  <input
                    type="text"
                    value={draft.title}
                    onChange={e => onUpdateTitle(e.target.value)}
                    placeholder="Judul Resume"
                    aria-label="Judul Resume"
                    className="w-36 sm:w-48 lg:w-64 text-sm font-semibold text-stone-900 dark:text-stone-100 bg-white dark:bg-stone-800 focus:ring-2 focus:ring-teal-700 px-2.5 py-1.5 rounded-xl border border-[#b7ddd4] dark:border-stone-700 outline-none transition"
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

                <div className="flex flex-wrap items-center gap-2 ml-auto shrink-0" data-testid="builder-design-controls">
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
                    className="flex items-center p-0.5 bg-stone-200/60 dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700"
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
                  <button
                    type="button"
                    onClick={() => onTogglePrivateMode(!privateMode)}
                    className="block p-2 text-stone-600 dark:text-stone-300 hover:text-teal-900 dark:hover:text-teal-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition"
                    title="Mode privasi"
                    aria-pressed={privateMode}
                    data-testid="btn-private-mode"
                  >
                    {privateMode ? <Lock className="w-4 h-4 text-amber-700" /> : <Unlock className="w-4 h-4" />}
                  </button>
                </div>

                {atsScore !== undefined && (
                  <button
                    key={atsScore}
                    type="button"
                    onClick={onOpenAtsScore}
                    className="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-900 dark:text-teal-200 text-xs font-bold border border-teal-200 dark:border-teal-800 transition-colors hover:bg-teal-100"
                    title="Buka rincian skor ATS"
                    data-testid="badge-ats-score"
                  >
                    <ShieldCheck className="w-4 h-4 text-teal-800" /> {atsScore}
                  </button>
                )}

                <button
                  type="button"
                  onClick={onOpenImportModal}
                  className="flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-100 bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 border border-[#b7ddd4] dark:border-stone-700 rounded-xl transition"
                  data-testid="btn-open-import"
                >
                  <Upload className="w-4 h-4" /> Impor
                </button>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      closeMenus()
                      setShowExportMenu(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#079875] hover:bg-[#087b64] rounded-xl shadow-2xs transition"
                    data-testid="btn-export-menu"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh</span>
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
              </div>
            )}

            <div className="ml-auto flex items-center gap-2 min-w-0">
            {/* Theme Toggle Button */}
            <ThemeToggle className="ml-1" />

            {/* Auth Profile / Login Button */}
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const next = !showUserMenu
                    closeMenus()
                    setShowUserMenu(next)
                  }}
                  className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-xs shrink-0 cursor-pointer transition border ${
                    showUserMenu || activeWorkspace === 'files'
                      ? 'bg-teal-100 dark:bg-stone-700 border-teal-300 dark:border-stone-600 text-teal-900 dark:text-teal-200 shadow-xs'
                      : 'bg-teal-50 dark:bg-stone-800 border-teal-200 dark:border-stone-700 hover:bg-teal-100/70 dark:hover:bg-stone-700/80 text-stone-800 dark:text-stone-200'
                  }`}
                  data-testid="nav-user-profile"
                  aria-expanded={showUserMenu}
                  aria-haspopup="menu"
                  title="Menu Akun & Profil"
                >
                  <span className="w-5 h-5 rounded-full bg-[#079875] text-white flex items-center justify-center text-3xs font-black uppercase shrink-0">
                    {currentUser.name ? currentUser.name.charAt(0) : 'U'}
                  </span>
                  <span className="font-bold max-w-[80px] sm:max-w-[120px] truncate" title={currentUser.name}>
                    {currentUser.name}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-stone-500 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {showUserMenu && (
                  <div
                    className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-stone-900 border border-teal-900/10 dark:border-stone-700 shadow-[0_12px_32px_rgba(15,118,110,0.14)] p-1.5 z-50 animate-pop-in"
                    role="menu"
                    data-testid="nav-user-menu"
                  >
                    <div className="px-3 py-2 border-b border-stone-100 dark:border-stone-800 mb-1">
                      <p className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-2xs text-stone-500 dark:text-stone-400 truncate">
                        {currentUser.email}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        onNavigate?.('files')
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                        activeWorkspace === 'files'
                          ? 'bg-teal-50 dark:bg-stone-800 text-teal-900 dark:text-teal-300 font-bold'
                          : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                      }`}
                      role="menuitem"
                      data-testid="menu-item-files"
                    >
                      <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-stone-800 text-teal-800 dark:text-teal-400 shrink-0">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div>Rak Berkas</div>
                        <div className="text-3xs text-stone-500 dark:text-stone-400 font-normal">Penyimpanan berkas privat</div>
                      </div>
                    </button>

                    <div className="my-1 border-t border-stone-100 dark:border-stone-800" />

                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        onLogout?.()
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 transition cursor-pointer"
                      role="menuitem"
                      data-testid="btn-nav-logout"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span>Keluar</span>
                    </button>
                  </div>
                )}
              </div>
            ) : onOpenLogin ? (
              <button
                type="button"
                onClick={onOpenLogin}
                className="h-8 px-3 rounded-full flex items-center gap-1.5 text-xs font-bold text-white bg-[#079875] hover:bg-[#087b64] transition shadow-2xs cursor-pointer shrink-0"
                data-testid="btn-nav-login"
                title="Masuk ke akun Satukit"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Masuk</span>
              </button>
            ) : null}

            {(activeWorkspace === 'builder' || activeWorkspace === 'home') && (
              <button
                type="button"
                onClick={() => setShowDraftsModal(true)}
                className="p-1.5 sm:px-2.5 text-xs font-semibold text-stone-800 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-full transition flex items-center gap-1.5 cursor-pointer"
                data-testid="btn-open-drafts"
                title="Kelola draft CV"
              >
                <FolderOpen className="w-4 h-4 text-teal-800 dark:text-teal-400" />
                <span className="hidden xl:inline">Draft ({draftsList.length})</span>
              </button>
            )}
            </div>
          </div>
        </div>

        {/* Mega Menu Horizontal Khusus CV Builder */}
        {showCvMenu && (
          <div
            className="absolute left-0 right-0 top-full bg-[#fffdfa] dark:bg-stone-900 border-b border-[#b7ddd4] dark:border-stone-800 shadow-[0_24px_48px_rgba(15,118,110,0.14)] z-40 max-h-[80vh] overflow-y-auto custom-scrollbar animate-pop-in"
            data-testid="cv-mega-menu"
          >
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#b7ddd4]/70 dark:border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#dff8f0] dark:bg-stone-800 text-[#079875] dark:text-teal-300 border border-[#b7ddd4] dark:border-stone-700 shadow-2xs">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#17383c] dark:text-stone-100 flex items-center gap-2">
                      Fitur CV Builder ATS
                      <span className="px-2 py-0.5 text-3xs font-bold rounded-full bg-[#079875] text-white">
                        100% Gratis &amp; Privat
                      </span>
                    </h3>
                    <p className="text-xs text-[#53676b] dark:text-stone-400">
                      Rancang resume profesional berstandar industri yang lolos sistem Applicant Tracking System.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeMenus}
                  className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
                  aria-label="Tutup menu CV"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Kolom 1: Mulai & Kelola */}
                <div className="space-y-3">
                  <p className="text-2xs font-extrabold uppercase tracking-wider text-[#079875] dark:text-teal-400 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Mulai &amp; Kelola
                  </p>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        onCreateNew()
                        onNavigate?.('builder')
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-[#effbf6] dark:hover:bg-stone-800 text-left flex items-start gap-3 transition cursor-pointer group"
                      data-testid="mega-menu-create-new"
                    >
                      <div className="p-2 rounded-lg bg-teal-50 dark:bg-stone-800 text-[#079875] dark:text-teal-400 group-hover:bg-[#079875] group-hover:text-white transition-colors shrink-0">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#17383c] dark:text-stone-200 group-hover:text-[#079875] dark:group-hover:text-teal-300">
                          Buat CV Baru
                        </div>
                        <div className="text-[11px] text-[#53676b] dark:text-stone-400 leading-tight">
                          Mulai dari formulir kosong terstruktur standar ATS
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        setShowDraftsModal(true)
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-[#effbf6] dark:hover:bg-stone-800 text-left flex items-start gap-3 transition cursor-pointer group"
                      data-testid="mega-menu-open-drafts"
                    >
                      <div className="p-2 rounded-lg bg-teal-50 dark:bg-stone-800 text-[#079875] dark:text-teal-400 group-hover:bg-[#079875] group-hover:text-white transition-colors shrink-0">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#17383c] dark:text-stone-200 group-hover:text-[#079875] dark:group-hover:text-teal-300">
                          Draf Resume ({draftsList.length})
                        </div>
                        <div className="text-[11px] text-[#53676b] dark:text-stone-400 leading-tight">
                          Kelola, duplikasi, dan lanjutkan draf tersimpan
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        onNavigate?.('builder')
                        onOpenImportModal()
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-[#effbf6] dark:hover:bg-stone-800 text-left flex items-start gap-3 transition cursor-pointer group"
                      data-testid="mega-menu-import"
                    >
                      <div className="p-2 rounded-lg bg-teal-50 dark:bg-stone-800 text-[#079875] dark:text-teal-400 group-hover:bg-[#079875] group-hover:text-white transition-colors shrink-0">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#17383c] dark:text-stone-200 group-hover:text-[#079875] dark:group-hover:text-teal-300">
                          Impor Berkas CV
                        </div>
                        <div className="text-[11px] text-[#53676b] dark:text-stone-400 leading-tight">
                          Impor draf dari file JSON atau resume Satukit
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Kolom 2: Optimasi & Ekspor */}
                <div className="space-y-3">
                  <p className="text-2xs font-extrabold uppercase tracking-wider text-[#079875] dark:text-teal-400 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Optimasi &amp; Ekspor
                  </p>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        onNavigate?.('builder')
                        onOpenAtsScore?.()
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-[#effbf6] dark:hover:bg-stone-800 text-left flex items-start gap-3 transition cursor-pointer group"
                      data-testid="mega-menu-ats-score"
                    >
                      <div className="p-2 rounded-lg bg-teal-50 dark:bg-stone-800 text-[#079875] dark:text-teal-400 group-hover:bg-[#079875] group-hover:text-white transition-colors shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#17383c] dark:text-stone-200 group-hover:text-[#079875] dark:group-hover:text-teal-300">
                          Skor ATS {atsScore !== undefined ? `(${atsScore})` : ''}
                        </div>
                        <div className="text-[11px] text-[#53676b] dark:text-stone-400 leading-tight">
                          Evaluasi kelengkapan, kontak, dampak kuantitatif &amp; kata kunci
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        onNavigate?.('builder')
                        onExportPdf()
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-[#effbf6] dark:hover:bg-stone-800 text-left flex items-start gap-3 transition cursor-pointer group"
                      data-testid="mega-menu-export-pdf"
                    >
                      <div className="p-2 rounded-lg bg-teal-50 dark:bg-stone-800 text-[#079875] dark:text-teal-400 group-hover:bg-[#079875] group-hover:text-white transition-colors shrink-0">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#17383c] dark:text-stone-200 group-hover:text-[#079875] dark:group-hover:text-teal-300">
                          Unduh Format PDF
                        </div>
                        <div className="text-[11px] text-[#53676b] dark:text-stone-400 leading-tight">
                          Dokumen siap kirim resolusi tinggi standar cetak A4
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        onNavigate?.('builder')
                        onExportDocx()
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-[#effbf6] dark:hover:bg-stone-800 text-left flex items-start gap-3 transition cursor-pointer group"
                      data-testid="mega-menu-export-docx"
                    >
                      <div className="p-2 rounded-lg bg-teal-50 dark:bg-stone-800 text-[#079875] dark:text-teal-400 group-hover:bg-[#079875] group-hover:text-white transition-colors shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#17383c] dark:text-stone-200 group-hover:text-[#079875] dark:group-hover:text-teal-300">
                          Unduh Format Word (.docx)
                        </div>
                        <div className="text-[11px] text-[#53676b] dark:text-stone-400 leading-tight">
                          Format fleksibel yang dapat diedit di Microsoft Word
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closeMenus()
                        onNavigate?.('builder')
                        if (onExportPrint) onExportPrint()
                        else window.print()
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-[#effbf6] dark:hover:bg-stone-800 text-left flex items-start gap-3 transition cursor-pointer group"
                      data-testid="mega-menu-export-print"
                    >
                      <div className="p-2 rounded-lg bg-teal-50 dark:bg-stone-800 text-[#079875] dark:text-teal-400 group-hover:bg-[#079875] group-hover:text-white transition-colors shrink-0">
                        <Printer className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#17383c] dark:text-stone-200 group-hover:text-[#079875] dark:group-hover:text-teal-300">
                          Cetak Dokumen (Print)
                        </div>
                        <div className="text-[11px] text-[#53676b] dark:text-stone-400 leading-tight">
                          Kirim langsung ke mesin pencetak atau dialog cetak peramban
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Kolom 3: Kartu Ringkasan Standar ATS */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#effbf6] to-[#dff8f0] dark:from-stone-800/80 dark:to-stone-800/40 border border-[#b7ddd4] dark:border-stone-700 flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#079875]/10 text-[#079875] dark:text-teal-300 text-3xs font-extrabold uppercase tracking-wider">
                      <ShieldCheck className="w-3 h-3" /> Standar ATS 2026
                    </span>
                    <h4 className="text-xs font-extrabold text-[#17383c] dark:text-stone-100 leading-snug">
                      Kenapa CV Satukit Lebih Mudah Lolos?
                    </h4>
                    <ul className="text-3xs text-[#53676b] dark:text-stone-300 space-y-1.5 leading-relaxed pt-1">
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3 h-3 text-[#079875] shrink-0 mt-0.5" />
                        <span>Hirarki heading baku ramah parser ATS</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3 h-3 text-[#079875] shrink-0 mt-0.5" />
                        <span>Bebas tabel rumit &amp; grafis penipu parser</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <Check className="w-3 h-3 text-[#079875] shrink-0 mt-0.5" />
                        <span>Data diproses aman dan privat di server Satukit</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      closeMenus()
                      onNavigate?.('builder')
                    }}
                    className="mt-4 w-full py-2 px-3 text-center text-xs font-bold text-white bg-[#079875] hover:bg-[#087b64] rounded-xl transition shadow-2xs cursor-pointer"
                  >
                    Buka Editor CV
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </header>

      {pendingDelete && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm sm:max-w-md animate-toast-in">
          <KituNotice
            variant="toast"
            tone="warning"
            expression="sedih"
            title="Draf Dihapus"
            role="status"
            action={
              <button
                type="button"
                onClick={onUndoDelete}
                className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Batal
              </button>
            }
          >
            <span>
              Draft <strong>“{pendingDelete.title}”</strong> dihapus.
            </span>
          </KituNotice>
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
                          {item.expiresAt && (() => {
                            const days = Math.max(0, Math.ceil((item.expiresAt - Date.now()) / (86400 * 1000)))
                            const isUrgent = days <= 7
                            return (
                              <span
                                className={`rounded-full px-1.5 py-0.5 font-semibold ${
                                  isUrgent
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-stone-100 text-stone-600 border border-stone-200'
                                }`}
                                title="Masa simpan draf sebelum otomatis terhapus"
                              >
                                {days === 0 ? 'Kedaluwarsa hari ini' : `Tersisa ${days} hr`}
                              </span>
                            )
                          })()}
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

      {infoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="info-modal-title"
          className="fixed inset-0 z-50 bg-stone-900/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-pop-in space-y-4">
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
              aria-label="Tutup dialog"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-400 flex items-center justify-center">
                {infoModal === 'panduan' && <HelpCircle className="w-5 h-5" />}
                {infoModal === 'tentang' && <Info className="w-5 h-5" />}
              </div>
              <h3 id="info-modal-title" className="text-lg font-bold text-stone-900 dark:text-stone-100">
                {infoModal === 'panduan' && 'Panduan Penggunaan Satukit'}
                {infoModal === 'tentang' && 'Tentang Satukit'}
              </h3>
            </div>

            <div className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed space-y-3">
              {infoModal === 'panduan' && (
                <ol className="list-decimal pl-4 space-y-2">
                  <li><strong>Pilih Alat:</strong> Gunakan menu Beranda atau tab Tools untuk memilih CV Builder, Konversi PDF, Edit Foto, atau Kode QR.</li>
                  <li><strong>Isi &amp; Olah Data:</strong> Ketik riwayat pekerjaan atau unggah berkas. Data Anda aman tersimpan di browser tanpa dikirim ke server.</li>
                  <li><strong>Ekspor Dokumen:</strong> Unduh hasil dalam format PDF ATS murni, DOCX, atau berkas gambar olahan seketika.</li>
                </ol>
              )}
              {infoModal === 'tentang' && (
                <>
                  <p>
                    <strong>Satukit</strong> (&quot;Satu Tempat, Banyak Solusi Digital&quot;) adalah platform produktivitas all-in-one karya anak bangsa yang bernuansa budaya lokal khas toska dan bambu nusantara.
                  </p>
                  <p>
                    Ditemani maskot <strong>Kitu</strong> yang lincah dan berdaya guna, Satukit membantu jutaan pencari kerja dan profesional mengelola tugas digital mereka dengan cepat, rapi, dan aman.
                  </p>
                </>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
