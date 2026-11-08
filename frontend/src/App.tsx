import { useState, useEffect, useRef, type ComponentType, type CSSProperties } from 'react'
import { initAuthSession } from './services/apiClient'
import { useResumeDraft } from './hooks/useResumeDraft'
import { exportResumeDocx, exportResumePdf, printResume } from './services/export'
import { analyzeAtsStructure, type AtsAnalysisResult } from './services/ats'
import {
  applyImportedResumeData,
  type ImportMode,
  type ImportSectionId
} from './services/importMerge'
import { type ResumeData } from './types/resume'
import { Navbar, type Workspace } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { Dashboard } from './components/dashboard/Dashboard'
import { ImportResumeModal } from './components/builder/ImportResumeModal'
import {
  ExportResumeModal,
  type ExportFormat
} from './components/export/ExportResumeModal'
import { AtsScorePanel } from './components/ats/AtsScorePanel'
import {
  JobMatchModal,
  type TargetedDraftRequest
} from './components/ats/JobMatchModal'
import { DocxToPdfModal } from './components/converter/DocxToPdfModal'
import { PdfToDocxModal } from './components/converter/PdfToDocxModal'
import {
  PresentationConverterModal,
  type PresentationTab
} from './components/converter/PresentationConverterModal'
import {
  SpreadsheetConverterModal,
  type SpreadsheetTab
} from './components/converter/SpreadsheetConverterModal'
import { PdfToolsModal } from './components/pdf-tools/PdfToolsModal'
import { PdfEditorModal } from './components/pdf-tools/PdfEditorModal'
import { PdfSignModal } from './components/pdf-tools/PdfSignModal'
import { PdfSecurityModal, type SecurityTab } from './components/pdf-tools/PdfSecurityModal'
import { PdfRepairModal } from './components/pdf-tools/PdfRepairModal'
import { PdfOcrModal } from './components/pdf-tools/PdfOcrModal'
import { PdfWatermarkModal } from './components/pdf-tools/PdfWatermarkModal'
import { PdfPageNumbersModal } from './components/pdf-tools/PdfPageNumbersModal'
import { PdfToMarkdownModal } from './components/pdf-tools/PdfToMarkdownModal'
import { ImageResizeModal } from './components/image-tools/ImageResizeModal'
import { RemoveBackgroundModal } from './components/image-tools/RemoveBackgroundModal'
import { UrlShortenerModal } from './components/tools/UrlShortenerModal'
import { ContactForm } from './components/builder/ContactForm'
import { SectionOrderForm } from './components/builder/SectionOrderForm'
import { SummaryForm } from './components/builder/SummaryForm'
import { ExperienceForm } from './components/builder/ExperienceForm'
import { EducationForm } from './components/builder/EducationForm'
import { SkillsForm } from './components/builder/SkillsForm'
import { LanguagesForm } from './components/builder/LanguagesForm'
import { CustomSectionsForm } from './components/builder/CustomSectionsForm'
import { ResumePreview } from './components/preview/ResumePreview'
import { type ResumeSectionId } from './types/resumeSections'
import {
  User,
  FileText,
  FileSpreadsheet,
  Presentation,
  Briefcase,
  GraduationCap,
  Wrench,
  Languages,
  Eye,
  Edit3,
  FileEdit,
  PenTool,
  ShieldCheck,
  FileSearch,
  FileCode,
  Scissors,
  Copy,
  Archive,
  Minimize2,
  Sparkles,
  Link2,
  Image as ImageIcon,
  Layers3,
  Unlock,
  Shield,
  Stamp,
  Hash,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  X
} from 'lucide-react'

type ToolCategory = 'convert' | 'organize' | 'security' | 'image'

interface ToolItem {
  title: string
  desc: string
  category: ToolCategory
  icon: ComponentType<{ className?: string }>
  iconClass: string
  isNew?: boolean
  action: () => void
}

const TOOL_CATEGORIES: { id: ToolCategory; label: string }[] = [
  { id: 'convert', label: 'Konversi' },
  { id: 'organize', label: 'Kelola PDF' },
  { id: 'security', label: 'Keamanan & Tanda Tangan' },
  { id: 'image', label: 'Gambar' }
]

function workspaceFromHash(): Workspace {
  const value = window.location.hash.replace('#/', '')
  return value === 'home' || value === 'builder' || value === 'ats' || value === 'tools'
    ? value
    : 'home'
}

export function App() {
  const {
    draft,
    draftsList,
    isSaving,
    lastSaved,
    privateMode,
    pendingDelete,
    isLoadingDrafts,
    storageError,
    loadDraft,
    createNewDraft,
    duplicateDraft,
    renameDraft,
    toggleDraftFavorite,
    createTargetedDraft,
    updateData,
    updateMeta,
    deleteWithUndo,
    undoDelete,
    togglePrivateMode,
    refreshList
  } = useResumeDraft()

  const [activeSection, setActiveSection] = useState<ResumeSectionId>('contact')
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(workspaceFromHash)
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor')
  const [toolQuery, setToolQuery] = useState('')
  const formScrollRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)

  // Saat bagian berganti: kembali ke atas form dan pastikan tab aktif terlihat
  useEffect(() => {
    formScrollRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' })
    activeTabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [activeSection])
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')
  const [exportPageCount, setExportPageCount] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const [atsAnalysis, setAtsAnalysis] = useState<AtsAnalysisResult | null>(null)
  const [showAtsPanel, setShowAtsPanel] = useState(false)
  const [showJobMatchModal, setShowJobMatchModal] = useState(false)
  const [showConverterModal, setShowConverterModal] = useState(false)
  const [showPdfToDocxModal, setShowPdfToDocxModal] = useState(false)
  const [showPresentationModal, setShowPresentationModal] = useState(false)
  const [presentationTab, setPresentationTab] = useState<PresentationTab>('pptx2pdf')
  const [showSpreadsheetModal, setShowSpreadsheetModal] = useState(false)
  const [spreadsheetTab, setSpreadsheetTab] = useState<SpreadsheetTab>('xlsx2pdf')
  const [showPdfToolsModal, setShowPdfToolsModal] = useState(false)
  const [showPdfEditorModal, setShowPdfEditorModal] = useState(false)
  const [showPdfSignModal, setShowPdfSignModal] = useState(false)
  const [showPdfSecurityModal, setShowPdfSecurityModal] = useState(false)
  const [showPdfRepairModal, setShowPdfRepairModal] = useState(false)
  const [showPdfOcrModal, setShowPdfOcrModal] = useState(false)
  const [showPdfWatermarkModal, setShowPdfWatermarkModal] = useState(false)
  const [showPdfPageNumbersModal, setShowPdfPageNumbersModal] = useState(false)
  const [showPdfToMarkdownModal, setShowPdfToMarkdownModal] = useState(false)
  const [pdfSecurityTab, setPdfSecurityTab] = useState<SecurityTab>('unlock')
  const [pdfToolsTab, setPdfToolsTab] = useState<'merge' | 'split' | 'compress' | 'img2pdf' | 'pdf2img'>('merge')
  const [showImageResizeModal, setShowImageResizeModal] = useState(false)
  const [showRemoveBackgroundModal, setShowRemoveBackgroundModal] = useState(false)
  const [showUrlShortenerModal, setShowUrlShortenerModal] = useState(false)
  const [importUndo, setImportUndo] = useState<{
    draftId: string
    data: ResumeData
    sections: ImportSectionId[]
  } | null>(null)

  useEffect(() => {
    if (!importUndo) return
    const timer = window.setTimeout(() => setImportUndo(null), 30_000)
    return () => window.clearTimeout(timer)
  }, [importUndo])

  // Inisialisasi sesi autentikasi lokal & CSRF token saat mount
  useEffect(() => {
    initAuthSession().catch(() => {})
  }, [])

  useEffect(() => {
    const handleHashChange = () => setActiveWorkspace(workspaceFromHash())
    window.addEventListener('hashchange', handleHashChange)
    if (!window.location.hash) window.history.replaceState(null, '', '#/home')
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigateTo = (workspace: Workspace) => {
    window.location.hash = `/${workspace}`
    setActiveWorkspace(workspace)
  }

  // Evaluasi skor keterbacaan ATS setiap kali data draft berubah
  useEffect(() => {
    if (draft) {
      analyzeAtsStructure(draft).then(setAtsAnalysis)
    }
  }, [draft])

  const openExportModal = (format: ExportFormat) => {
    if (!draft) return
    setExportFormat(format)
    setShowExportModal(true)
  }

  const handleExport = async (format: ExportFormat, filename: string) => {
    if (!draft) return

    setIsExporting(true)
    try {
      if (format === 'docx') {
        await exportResumeDocx(draft, filename)
      } else if (format === 'pdf') {
        const result = await exportResumePdf(draft, filename)
        if (result.fallbackToPrint && result.message) {
          console.info(result.message)
        }
      } else {
        printResume(filename)
      }
      setShowExportModal(false)
    } finally {
      setIsExporting(false)
    }
  }

  const handleFixExportIssue = (section: ResumeSectionId) => {
    setActiveWorkspace('builder')
    window.location.hash = '/builder'
    setActiveSection(section)
    setMobileTab('editor')
    setShowExportModal(false)
  }

  const handleApplyImport = (
    importedData: ResumeData,
    selectedSections: ImportSectionId[],
    mode: ImportMode
  ) => {
    if (!draft) return
    const previousData = draft.data
    updateData(current =>
      applyImportedResumeData(current, importedData, selectedSections, mode)
    )
    setImportUndo({ draftId: draft.id, data: previousData, sections: selectedSections })
  }

  const handleUndoImport = () => {
    if (!importUndo || draft?.id !== importUndo.draftId) return
    const previousData = importUndo.data
    const sections = importUndo.sections
    updateData(current =>
      applyImportedResumeData(current, previousData, sections, 'replace')
    )
    setImportUndo(null)
  }

  const handleCreateTargetedDraft = async (target: TargetedDraftRequest) => {
    await createTargetedDraft(target)
    setActiveWorkspace('builder')
    window.location.hash = '/builder'
    setActiveSection('summary')
    setMobileTab('editor')
  }

  const handleCreateNewFromDashboard = async () => {
    await createNewDraft('Resume Baru', 'ats-clean')
    navigateTo('builder')
  }

  const handleImportFromDashboard = async () => {
    if (!draft) {
      await createNewDraft('Resume Baru', 'ats-clean')
    }
    navigateTo('builder')
    setShowImportModal(true)
  }

  const handleSelectDraft = async (id: string) => {
    await loadDraft(id)
    navigateTo('builder')
  }

  // Muat draft pertama yang tersimpan jika belum ada draft yang dimuat
  useEffect(() => {
    if (isLoadingDrafts) return
    if (!draft && draftsList.length > 0) {
      loadDraft(draftsList[0].id)
    }
  }, [draft, draftsList, isLoadingDrafts, loadDraft])

  const SECTIONS: { id: ResumeSectionId; label: string; icon: any }[] = [
    { id: 'contact', label: 'Kontak', icon: User },
    { id: 'summary', label: 'Ringkasan', icon: FileText },
    { id: 'experience', label: 'Pengalaman', icon: Briefcase },
    { id: 'education', label: 'Pendidikan', icon: GraduationCap },
    { id: 'skills', label: 'Keahlian', icon: Wrench },
    { id: 'languages', label: 'Bahasa', icon: Languages },
    { id: 'custom', label: 'Bagian Lain', icon: Layers3 }
  ]

  const TOOLS: ToolItem[] = [

    {
      title: 'DOCX ke PDF',
      category: 'convert' as ToolCategory,
      desc: 'Konversi dokumen Word menjadi PDF standar.',
      icon: FileCode,
      iconClass: 'bg-stone-100 text-stone-800',
      action: () => setShowConverterModal(true)
    },
    {
      title: 'PDF ke DOCX',
      category: 'convert' as ToolCategory,
      desc: 'Rekonstruksi PDF menjadi dokumen Word yang dapat diedit.',
      icon: FileText,
      iconClass: 'bg-stone-100 text-stone-800',
      action: () => setShowPdfToDocxModal(true)
    },
    {
      title: 'PowerPoint & PDF',
      category: 'convert' as ToolCategory,
      desc: 'Konversi PPTX/PPT ke PDF atau ubah PDF menjadi slide presentasi.',
      icon: Presentation,
      iconClass: 'bg-amber-50 text-amber-800',
      action: () => {
        setPresentationTab('pptx2pdf')
        setShowPresentationModal(true)
      }
    },
    {
      title: 'Excel & PDF',
      category: 'convert' as ToolCategory,
      desc: 'Konversi XLSX/XLS ke PDF atau ekstrak tabel dokumen PDF ke Excel.',
      icon: FileSpreadsheet,
      iconClass: 'bg-teal-50 text-teal-800',
      action: () => {
        setSpreadsheetTab('xlsx2pdf')
        setShowSpreadsheetModal(true)
      }
    },
    {
      title: 'Merge Dokumen',
      category: 'organize' as ToolCategory,
      desc: 'Gabungkan beberapa PDF, DOCX, dan gambar dengan urutan kustom.',
      icon: Copy,
      iconClass: 'bg-stone-100 text-stone-800',
      action: () => {
        setPdfToolsTab('merge')
        setShowPdfToolsModal(true)
      }
    },
    {
      title: 'Split PDF',
      category: 'organize' as ToolCategory,
      desc: 'Ekstrak rentang halaman PDF menjadi beberapa PDF dalam arsip ZIP.',
      icon: Scissors,
      iconClass: 'bg-stone-100 text-stone-800',
      action: () => {
        setPdfToolsTab('split')
        setShowPdfToolsModal(true)
      }
    },
    {
      title: 'Kompres PDF',
      category: 'organize' as ToolCategory,
      desc: 'Perkecil ukuran berkas PDF dengan 3 tingkat kompresi lokal aman.',
      icon: Minimize2,
      iconClass: 'bg-teal-50 text-teal-800',
      action: () => {
        setPdfToolsTab('compress')
        setShowPdfToolsModal(true)
      }
    },
    {
      title: 'PDF & Gambar',
      category: 'image' as ToolCategory,
      desc: 'Ubah gambar menjadi PDF atau ekstrak seluruh halaman PDF ke gambar.',
      icon: Archive,
      iconClass: 'bg-amber-50 text-amber-800',
      action: () => {
        setPdfToolsTab('img2pdf')
        setShowPdfToolsModal(true)
      }
    },
    {
      title: 'Hapus Latar Belakang',
      category: 'image' as ToolCategory,
      desc: 'Hapus latar belakang foto otomatis menggunakan AI lokal U2NetP dan ganti warna latar pasfoto.',
      icon: Sparkles,
      iconClass: 'bg-teal-50 text-teal-800',
      isNew: true,
      action: () => setShowRemoveBackgroundModal(true)
    },
    {
      title: 'Resize Gambar',
      category: 'image' as ToolCategory,
      desc: 'Kompres ukuran gambar sesuai target KB/MB dan bersihkan metadata EXIF.',
      icon: ImageIcon,
      iconClass: 'bg-teal-50 text-teal-800',
      action: () => setShowImageResizeModal(true)
    },
    {
      title: 'Edit PDF',
      category: 'organize' as ToolCategory,
      desc: 'Atur urutan, putar, hapus halaman, serta tambah teks & tanda tangan.',
      icon: FileEdit,
      iconClass: 'bg-stone-100 text-stone-800',
      action: () => setShowPdfEditorModal(true)
    },
    {
      title: 'Sign PDF',
      category: 'security' as ToolCategory,
      desc: 'Bubuhkan tanda tangan visual, paraf, nama, dan tanggal dengan drag & resize.',
      icon: PenTool,
      iconClass: 'bg-teal-50 text-teal-800',
      action: () => setShowPdfSignModal(true)
    },
    {
      title: 'Unlock PDF',
      category: 'security' as ToolCategory,
      desc: 'Hapus proteksi password pada dokumen PDF secara lokal, aman, dan tanpa batasan.',
      icon: Unlock,
      iconClass: 'bg-stone-100 text-stone-800',
      action: () => {
        setPdfSecurityTab('unlock')
        setShowPdfSecurityModal(true)
      }
    },
    {
      title: 'Protect PDF',
      category: 'security' as ToolCategory,
      desc: 'Enkripsi dokumen PDF dengan password AES-256 yang kuat sebelum dibagikan.',
      icon: Shield,
      iconClass: 'bg-teal-50 text-teal-800',
      action: () => {
        setPdfSecurityTab('protect')
        setShowPdfSecurityModal(true)
      }
    },
    {
      title: 'Repair PDF',
      category: 'organize' as ToolCategory,
      desc: 'Pulihkan berkas PDF yang rusak dan selamatkan data di dalamnya secara lokal.',
      icon: Wrench,
      iconClass: 'bg-stone-100 text-stone-800',
      action: () => setShowPdfRepairModal(true)
    },
    {
      title: 'OCR PDF',
      category: 'organize' as ToolCategory,
      desc: 'Ubah PDF hasil scan menjadi dokumen yang teksnya dapat dicari dan disalin.',
      icon: FileSearch,
      iconClass: 'bg-teal-50 text-teal-800',
      action: () => setShowPdfOcrModal(true)
    },
    {
      title: 'Watermark PDF',
      category: 'organize' as ToolCategory,
      desc: 'Bubuhkan stempel teks atau logo transparan pada halaman dengan posisi dan rotasi kustom.',
      icon: Stamp,
      iconClass: 'bg-stone-100 text-stone-800',
      action: () => setShowPdfWatermarkModal(true)
    },
    {
      title: 'Nomor Halaman',
      category: 'organize' as ToolCategory,
      desc: 'Sisipkan penomoran halaman otomatis dengan format angka, letak posisi, dan margin fleksibel.',
      icon: Hash,
      iconClass: 'bg-stone-100 text-stone-800',
      action: () => setShowPdfPageNumbersModal(true)
    },
    {
      title: 'PDF to Markdown',
      category: 'convert' as ToolCategory,
      desc: 'Ekstrak dokumen PDF menjadi berkas Markdown (.md) lokal dengan mempertahankan heading, tabel, list & tautan.',
      icon: FileCode,
      iconClass: 'bg-teal-50 text-teal-800',
      isNew: true,
      action: () => setShowPdfToMarkdownModal(true)
    },
    {
      title: 'Pemendek URL',
      category: 'organize' as ToolCategory,
      desc: 'Buat tautan singkat berlatensi rendah di edge serverless untuk CV online, dokumen, atau portofolio.',
      icon: Link2,
      iconClass: 'bg-teal-50 text-teal-800',
      isNew: true,
      action: () => setShowUrlShortenerModal(true)
    }
  ]
  const normalizedToolQuery = toolQuery.trim().toLowerCase()
  const visibleTools = normalizedToolQuery
    ? TOOLS.filter(tool =>
        `${tool.title} ${tool.desc}`.toLowerCase().includes(normalizedToolQuery)
      )
    : TOOLS

  const activeIndex = Math.max(0, SECTIONS.findIndex(s => s.id === activeSection))
  const isFirstSection = activeIndex === 0
  const isLastSection = activeIndex === SECTIONS.length - 1
  const goToSection = (index: number) => {
    const target = SECTIONS[Math.min(Math.max(index, 0), SECTIONS.length - 1)]
    setActiveSection(target.id)
  }

  return (
    <div className="app-shell h-dvh overflow-hidden paper-canvas dark:bg-[#0b1120] flex flex-col font-sans text-stone-900 dark:text-stone-100 transition-colors">
      {/* Navbar & Kontrol Topbar */}
      <Navbar
        activeWorkspace={activeWorkspace}
        onNavigate={navigateTo}
        draft={draft}
        draftsList={draftsList}
        isSaving={isSaving}
        lastSaved={lastSaved}
        privateMode={privateMode}
        pendingDelete={pendingDelete}
        atsScore={atsAnalysis?.score}
        onOpenAtsScore={() => setShowAtsPanel(true)}
        onUpdateTitle={title => updateMeta({ title })}
        onUpdateTheme={colorTheme => updateMeta({ colorTheme })}
        onUpdateFont={fontFamily => updateMeta({ fontFamily })}
        onUpdateTemplate={templateId => updateMeta({ templateId })}
        onUpdateLanguage={resumeLanguage => updateMeta({ resumeLanguage })}
        onExportDocx={() => openExportModal('docx')}
        onExportPdf={() => openExportModal('pdf')}
        onExportPrint={() => openExportModal('print')}
        onOpenImportModal={() => setShowImportModal(true)}
        onCreateNew={() => createNewDraft()}
        onLoadDraft={loadDraft}
        onDeleteDraft={deleteWithUndo}
        onRenameDraft={renameDraft}
        onDuplicateDraft={async id => {
          await duplicateDraft(id)
        }}
        onToggleFavorite={toggleDraftFavorite}
        onUndoDelete={undoDelete}
        onTogglePrivateMode={togglePrivateMode}
      />

      {activeWorkspace === 'home' && (
        <Dashboard
          draft={draft}
          draftsList={draftsList}
          atsScore={atsAnalysis?.score}
          privateMode={privateMode}
          isLoadingDrafts={isLoadingDrafts}
          storageError={storageError}
          onRetryLoadDrafts={refreshList}
          documentToolsCount={TOOLS.length}
          onNavigate={navigateTo}
          onCreateNewResume={handleCreateNewFromDashboard}
          onOpenImportModal={handleImportFromDashboard}
          onLoadDraft={handleSelectDraft}
          onOpenAtsScore={() => setShowAtsPanel(true)}
          onToggleFavorite={toggleDraftFavorite}
        />
      )}

      {activeWorkspace === 'builder' && (
        <>
      {/* Switcher Tab Mobile (Editor vs Preview) */}
      <div className="lg:hidden shrink-0 p-1.5 bg-[#FAF9F6] dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 transition-colors">
        <div className="relative grid grid-cols-2 p-1 bg-stone-200/70 dark:bg-stone-800 rounded-xl">
          <span
            aria-hidden="true"
            className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white dark:bg-stone-900 shadow-2xs transition-transform duration-300 ease-out ${
              mobileTab === 'preview' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />
          <button
            type="button"
            onClick={() => setMobileTab('editor')}
            aria-pressed={mobileTab === 'editor'}
            className={`relative z-10 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-lg transition-colors ${
              mobileTab === 'editor' ? 'text-teal-900 dark:text-teal-300' : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            Form Editor
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('preview')}
            aria-pressed={mobileTab === 'preview'}
            className={`relative z-10 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-lg transition-colors ${
              mobileTab === 'preview' ? 'text-teal-900 dark:text-teal-300' : 'text-stone-600 dark:text-stone-400'
            }`}
          >
            <Eye className="w-4 h-4" />
            Pratinjau A4
          </button>
        </div>
      </div>

      {/* Workspace Konten Utama */}
      <main className="flex-1 min-h-0 flex overflow-hidden animate-fade-in">
        {/* Kolom Kiri: Form Editor */}
        <section
          className={`w-full lg:w-[44%] min-h-0 flex-col bg-white dark:bg-stone-900 border-r border-stone-200/90 dark:border-stone-800 transition-colors ${
            mobileTab === 'editor' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Section Tabs Navigation */}
          <nav
            className="shrink-0 flex overflow-x-auto border-b border-stone-200 dark:border-stone-800 px-2 sm:px-4 gap-0.5 scrollbar-none bg-[#FAF9F6]/60 dark:bg-stone-900/60 transition-colors"
            aria-label="Bagian CV"
          >
            {SECTIONS.map(s => {
              const Icon = s.icon
              const isActive = activeSection === s.id
              return (
                <button
                  key={s.id}
                  ref={isActive ? activeTabRef : undefined}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  aria-current={isActive ? 'step' : undefined}
                  className={`group relative flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap transition-colors duration-150 ${
                    isActive ? 'text-teal-900 dark:text-teal-300' : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                  data-testid={`tab-${s.id}`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 transition-colors ${
                      isActive ? 'text-teal-800 dark:text-teal-400' : 'text-stone-500 dark:text-stone-500 group-hover:text-stone-700 dark:group-hover:text-stone-300'
                    }`}
                  />
                  {s.label}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-teal-800 dark:bg-teal-400 origin-center transition-transform duration-300 ease-out ${
                      isActive ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </button>
              )
            })}
          </nav>

          {/* Form Content Area (scroll independen) */}
          <div ref={formScrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full">
            {!draft ? (
              <div
                className="flex flex-col items-center justify-center py-16 text-center space-y-3 animate-fade-in"
                data-testid="builder-empty-state"
              >
                <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="max-w-sm">
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">Belum ada CV yang dipilih</h3>
                  <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                    Mulai buat CV baru dari template atau impor data teks dari berkas PDF/DOCX yang sudah ada.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => createNewDraft('Resume Baru', 'ats-clean')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 rounded-xl transition shadow-2xs cursor-pointer"
                    data-testid="btn-builder-create-new"
                  >
                    + Buat CV Baru Sekarang
                  </button>
                  <button
                    type="button"
                    onClick={handleImportFromDashboard}
                    className="px-4 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 rounded-xl transition cursor-pointer"
                    data-testid="btn-builder-import"
                  >
                    Impor Berkas
                  </button>
                </div>
              </div>
            ) : (
              <>
                <SectionOrderForm
                  order={draft.data.sectionOrder}
                  templateId={draft.templateId}
                  onChange={sectionOrder =>
                    updateData(prev => ({ ...prev, sectionOrder }))
                  }
                />
                <div key={activeSection} className="animate-fade-up">
                {activeSection === 'contact' && (
                  <ContactForm
                    contact={draft.data.contact}
                    onChange={contact => updateData(prev => ({ ...prev, contact }))}
                  />
                )}
                {activeSection === 'summary' && (
                  <SummaryForm
                    summary={draft.data.summary}
                    onChange={summary => updateData(prev => ({ ...prev, summary }))}
                  />
                )}
                {activeSection === 'experience' && (
                  <ExperienceForm
                    experiences={draft.data.experiences}
                    onChange={experiences => updateData(prev => ({ ...prev, experiences }))}
                  />
                )}
                {activeSection === 'education' && (
                  <EducationForm
                    education={draft.data.education}
                    onChange={education => updateData(prev => ({ ...prev, education }))}
                  />
                )}
                {activeSection === 'skills' && (
                  <SkillsForm
                    skills={draft.data.skills}
                    onChange={skills => updateData(prev => ({ ...prev, skills }))}
                  />
                )}
                {activeSection === 'languages' && (
                  <LanguagesForm
                    languages={draft.data.languages}
                    onChange={languages => updateData(prev => ({ ...prev, languages }))}
                  />
                )}
                {activeSection === 'custom' && (
                  <CustomSectionsForm
                    sections={draft.data.customSections}
                    onChange={customSections =>
                      updateData(prev => ({ ...prev, customSections }))
                    }
                  />
                )}
                </div>
              </>
            )}
          </div>
          </div>

          {/* Footer Navigasi Langkah */}
          {draft && (
            <div className="shrink-0 border-t border-stone-200 dark:border-stone-800 bg-[#FAF9F6]/95 dark:bg-stone-900/95 backdrop-blur px-3 sm:px-5 py-2.5 flex items-center gap-3 transition-colors">
              <button
                type="button"
                onClick={() => goToSection(activeIndex - 1)}
                disabled={isFirstSection}
                className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-800 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Bagian sebelumnya"
                data-testid="btn-section-prev"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Sebelumnya</span>
              </button>

              <div className="flex-1 min-w-0" aria-live="polite">
                <div className="flex items-center justify-between text-2xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                  <span className="truncate">
                    Langkah {activeIndex + 1} dari {SECTIONS.length} · <span className="text-stone-900 dark:text-stone-100 font-semibold">{SECTIONS[activeIndex].label}</span>
                  </span>
                </div>
                <div className="h-1 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-800 dark:bg-teal-400 transition-[width] duration-500 ease-out"
                    style={{ width: `${((activeIndex + 1) / SECTIONS.length) * 100}%` }}
                  />
                </div>
              </div>

              {isLastSection ? (
                <button
                  type="button"
                  onClick={() => openExportModal('pdf')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 rounded-lg shadow-2xs transition"
                  data-testid="btn-section-finish"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Periksa &amp; Unduh</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => goToSection(activeIndex + 1)}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 rounded-lg shadow-2xs transition"
                  aria-label="Bagian berikutnya"
                  data-testid="btn-section-next"
                >
                  <span className="hidden sm:inline">Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </section>

        {/* Kolom Kanan: Live Preview A4 */}
        <aside
          className={`w-full lg:w-[56%] h-full min-h-0 ${
            mobileTab === 'preview' ? 'block animate-fade-in' : 'hidden lg:block'
          }`}
        >
          <ResumePreview draft={draft} onPageCountChange={setExportPageCount} />
        </aside>
      </main>
        </>
      )}

      {activeWorkspace === 'ats' && (
        <main key="ats" className="flex-1 min-h-0 overflow-y-auto paper-canvas dark:bg-[#0b1120] custom-scrollbar animate-fade-in transition-colors">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-up">
              <div>
                <span className="text-[13px] font-semibold text-teal-800 dark:text-teal-400">Ruang kerja</span>
                <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">Optimasi ATS</h1>
                <p className="text-base text-stone-600 dark:text-stone-400 mt-1">Periksa keterbacaan CV dan cocokkan isi dengan lowongan target.</p>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('builder')}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto px-4 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-700 transition"
              >
                <ChevronLeft className="w-4 h-4" /> Kembali edit CV
              </button>
            </div>

            {!draft ? (
              <div
                className="p-8 text-center bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl space-y-3 animate-fade-in"
                data-testid="ats-empty-state"
              >
                <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto">
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Belum ada CV yang dipilih untuk dioptimasi</h2>
                  <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                    Evaluasi struktur ATS dan pencocokan lowongan memerlukan data CV aktif. Buat CV baru atau pilih dari draf tersimpan.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleCreateNewFromDashboard}
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 rounded-xl transition shadow-2xs cursor-pointer"
                    data-testid="btn-ats-create-cv"
                  >
                    + Buat CV Baru
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('home')}
                    className="px-4 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl transition cursor-pointer"
                  >
                    Kembali ke Beranda
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-5">
                <button
                  type="button"
                  onClick={() => setShowAtsPanel(true)}
                  style={{ '--i': 1 } as CSSProperties}
                  className="stagger-item group text-left p-6 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl shadow-2xs hover:border-teal-700 dark:hover:border-teal-500 transition duration-150 cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <span className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200/80 dark:border-stone-700 group-hover:bg-teal-50 dark:group-hover:bg-teal-950 group-hover:text-teal-900 dark:group-hover:text-teal-300 transition-colors"><ShieldCheck className="w-6 h-6" /></span>
                    <span className="text-[13px] font-medium text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 rounded-md">Audit struktur</span>
                  </div>
                  <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-5">Evaluasi Keterbacaan ATS</h2>
                  <p className="text-base text-stone-600 dark:text-stone-400 mt-2">Audit struktur, informasi kontak, ringkasan, dampak terukur, dan integritas kata kunci.</p>
                  <div className="mt-5 flex items-baseline gap-2">
                    <span key={atsAnalysis?.score ?? 0} className="text-3xl font-bold text-stone-900 dark:text-stone-100 tabular-nums animate-fade-up">{atsAnalysis?.score ?? 0}</span>
                    <span className="text-[13px] text-stone-600 dark:text-stone-400">skor dari 100</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-teal-800 dark:bg-teal-400 transition-[width] duration-700 ease-out"
                      style={{ width: `${Math.min(100, Math.max(0, atsAnalysis?.score ?? 0))}%` }}
                    />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowJobMatchModal(true)}
                  style={{ '--i': 2 } as CSSProperties}
                  className="stagger-item group text-left p-6 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl shadow-2xs hover:border-teal-700 dark:hover:border-teal-500 transition duration-150 cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <span className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200/80 dark:border-stone-700 group-hover:bg-teal-50 dark:group-hover:bg-teal-950 group-hover:text-teal-900 dark:group-hover:text-teal-300 transition-colors"><FileSearch className="w-6 h-6" /></span>
                    <span className="text-[13px] font-medium text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 rounded-md">Pencocokan</span>
                  </div>
                  <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-5">Cocokkan dengan Lowongan</h2>
                  <p className="text-base text-stone-600 dark:text-stone-400 mt-2">Bandingkan kata kunci CV dengan deskripsi pekerjaan dan temukan kompetensi yang belum tercantum.</p>
                  <span className="inline-flex mt-5 px-3 py-1 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-900 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-semibold">Analisis lokal &amp; privat</span>
                </button>
              </div>
            )}

            {/* Footer Pengembang */}
            <Footer className="mt-8" />
          </div>
        </main>
      )}

      {activeWorkspace === 'tools' && (
        <main key="tools" className="flex-1 min-h-0 overflow-y-auto paper-canvas dark:bg-[#0b1120] custom-scrollbar animate-fade-in transition-colors">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-up">
              <div>
                <span className="text-[13px] font-semibold text-teal-800 dark:text-teal-400">Ruang kerja</span>
                <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">Alat Dokumen</h1>
                <p className="text-base text-stone-600 dark:text-stone-400 mt-1">Konversi dan olah dokumen tanpa memenuhi layar editor CV.</p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="search"
                  value={toolQuery}
                  onChange={event => setToolQuery(event.target.value)}
                  placeholder="Cari alat, mis. kompres, OCR..."
                  aria-label="Cari alat dokumen"
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 py-2.5 pl-9 pr-9 text-sm text-stone-900 dark:text-stone-100 shadow-2xs outline-none transition focus:border-teal-700 dark:focus:border-teal-400 focus:ring-2 focus:ring-teal-700/30"
                  data-testid="input-search-tools"
                />
                {toolQuery && (
                  <button
                    type="button"
                    onClick={() => setToolQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition animate-fade-in"
                    aria-label="Hapus pencarian alat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {visibleTools.length === 0 ? (
              <div className="py-16 text-center animate-fade-in" data-testid="tools-empty">
                <Search className="mx-auto h-8 w-8 text-stone-400" />
                <p className="mt-3 text-sm font-semibold text-stone-800 dark:text-stone-200">Alat tidak ditemukan</p>
                <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">Coba kata kunci lain, misalnya &quot;PDF&quot;, &quot;gambar&quot;, atau &quot;password&quot;.</p>
              </div>
            ) : (
              TOOL_CATEGORIES.map(category => {
                const items = visibleTools.filter(tool => tool.category === category.id)
                if (items.length === 0) return null
                return (
                  <section key={category.id} aria-labelledby={`tools-${category.id}`} className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <h2 id={`tools-${category.id}`} className="text-base font-bold text-stone-900 dark:text-stone-100">{category.label}</h2>
                      <span className="text-[13px] font-medium text-stone-600 dark:text-stone-400 tabular-nums">{items.length} alat</span>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map((tool, index) => {
                        const Icon = tool.icon
                        return (
                          <button
                            key={tool.title}
                            type="button"
                            onClick={tool.action}
                            style={{ '--i': index } as CSSProperties}
                            className="stagger-item group text-left p-5 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl shadow-2xs hover:border-teal-700 dark:hover:border-teal-500 transition duration-150 min-h-44 flex flex-col relative cursor-pointer"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={`p-3 rounded-xl self-start border border-stone-200/70 dark:border-stone-700 transition-colors ${tool.iconClass}`}><Icon className="w-5 h-5" /></span>
                              {tool.isNew && (
                                <span className="text-2xs font-semibold px-2 py-0.5 bg-teal-50 dark:bg-teal-950 text-teal-900 dark:text-teal-300 rounded-md border border-teal-200 dark:border-teal-800">
                                  Baru
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-4 group-hover:text-teal-900 dark:group-hover:text-teal-300 transition-colors">{tool.title}</h3>
                            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400 mt-1.5 flex-1">{tool.desc}</p>
                            <span className="mt-4 text-xs font-semibold text-teal-800 dark:text-teal-400">
                              Buka utilitas
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })
            )}

            <div className="p-4 bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-800 dark:text-teal-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Pemrosesan lokal</h3>
                <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">Dokumen diproses melalui server lokal Satukit. Berkas sementara dibersihkan otomatis.</p>
              </div>
            </div>

            {/* Footer Pengembang */}
            <Footer className="mt-8" />
          </div>
        </main>
      )}

      {importUndo && draft?.id === importUndo.draftId && (
        <div
          className="fixed bottom-4 left-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white shadow-2xl animate-toast-in"
          role="status"
          data-testid="import-undo-toast"
        >
          <span className="text-xs">Data impor diterapkan ke CV.</span>
          <button
            type="button"
            onClick={handleUndoImport}
            className="flex shrink-0 items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300"
            data-testid="btn-undo-import"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Urungkan
          </button>
        </div>
      )}

      {/* Modal Impor CV Lama */}
      <ImportResumeModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onApply={handleApplyImport}
      />

      {/* Modal Pemeriksaan & Ekspor CV */}
      {showExportModal && (
        <ExportResumeModal
          isOpen={showExportModal}
          draft={draft}
          pageCount={exportPageCount}
          initialFormat={exportFormat}
          isExporting={isExporting}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          onFixIssue={handleFixExportIssue}
        />
      )}

      {/* Panel Evaluasi Skor ATS */}
      <AtsScorePanel
        analysis={atsAnalysis}
        resumeTitle={draft?.title || 'Resume'}
        isOpen={showAtsPanel}
        onClose={() => setShowAtsPanel(false)}
        onEditResume={() => navigateTo('builder')}
      />

      {/* Modal Pencocokan Lowongan Kerja */}
      <JobMatchModal
        draft={draft}
        isOpen={showJobMatchModal}
        onClose={() => setShowJobMatchModal(false)}
        onCreateTargetedDraft={handleCreateTargetedDraft}
      />

      {/* Modal Konversi DOCX ke PDF */}
      <DocxToPdfModal
        isOpen={showConverterModal}
        onClose={() => setShowConverterModal(false)}
      />

      {/* Modal Konversi PDF ke DOCX */}
      <PdfToDocxModal
        isOpen={showPdfToDocxModal}
        onClose={() => setShowPdfToDocxModal(false)}
      />

      {/* Modal Konversi PowerPoint & PDF */}
      <PresentationConverterModal
        isOpen={showPresentationModal}
        onClose={() => setShowPresentationModal(false)}
        initialTab={presentationTab}
      />

      {/* Modal Konversi Excel & PDF */}
      <SpreadsheetConverterModal
        isOpen={showSpreadsheetModal}
        onClose={() => setShowSpreadsheetModal(false)}
        initialTab={spreadsheetTab}
      />

      {/* Modal PDF Tools */}
      <PdfToolsModal
        isOpen={showPdfToolsModal}
        onClose={() => setShowPdfToolsModal(false)}
        initialTab={pdfToolsTab}
      />

      {/* Modal Editor PDF */}
      <PdfEditorModal
        isOpen={showPdfEditorModal}
        onClose={() => setShowPdfEditorModal(false)}
      />

      {/* Modal Sign PDF */}
      <PdfSignModal
        isOpen={showPdfSignModal}
        onClose={() => setShowPdfSignModal(false)}
      />

      {/* Modal Resize Gambar */}
      <ImageResizeModal
        isOpen={showImageResizeModal}
        onClose={() => setShowImageResizeModal(false)}
      />

      {/* Modal Hapus Latar Belakang */}
      <RemoveBackgroundModal
        isOpen={showRemoveBackgroundModal}
        onClose={() => setShowRemoveBackgroundModal(false)}
      />

      {/* Modal Pemendek URL */}
      <UrlShortenerModal
        isOpen={showUrlShortenerModal}
        onClose={() => setShowUrlShortenerModal(false)}
      />

      {/* Modal Keamanan PDF (Unlock & Protect) */}
      <PdfSecurityModal
        isOpen={showPdfSecurityModal}
        onClose={() => setShowPdfSecurityModal(false)}
        initialTab={pdfSecurityTab}
      />

      {/* Modal Repair PDF */}
      <PdfRepairModal
        isOpen={showPdfRepairModal}
        onClose={() => setShowPdfRepairModal(false)}
      />

      {/* Modal OCR PDF */}
      <PdfOcrModal
        isOpen={showPdfOcrModal}
        onClose={() => setShowPdfOcrModal(false)}
      />

      {/* Modal Watermark PDF */}
      <PdfWatermarkModal
        isOpen={showPdfWatermarkModal}
        onClose={() => setShowPdfWatermarkModal(false)}
      />

      {/* Modal Nomor Halaman PDF */}
      <PdfPageNumbersModal
        isOpen={showPdfPageNumbersModal}
        onClose={() => setShowPdfPageNumbersModal(false)}
      />

      {/* Modal PDF to Markdown */}
      <PdfToMarkdownModal
        isOpen={showPdfToMarkdownModal}
        onClose={() => setShowPdfToMarkdownModal(false)}
      />
    </div>
  )
}

export default App
