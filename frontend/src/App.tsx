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
  Image as ImageIcon,
  ArrowRight,
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
  return value === 'ats' || value === 'tools' ? value : 'builder'
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
    togglePrivateMode
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
    if (!window.location.hash) window.history.replaceState(null, '', '#/builder')
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

  // Inisialisasi draft pertama setelah daftar draft selesai dimuat
  useEffect(() => {
    if (isLoadingDrafts) return
    if (!draft && draftsList.length === 0) {
      createNewDraft('Resume Baru', 'ats-clean')
    } else if (!draft && draftsList.length > 0) {
      loadDraft(draftsList[0].id)
    }
  }, [draft, draftsList, isLoadingDrafts, createNewDraft, loadDraft])

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
      iconClass: 'bg-indigo-50 text-indigo-600',
      action: () => setShowConverterModal(true)
    },
    {
      title: 'PDF ke DOCX',
      category: 'convert' as ToolCategory,
      desc: 'Rekonstruksi PDF menjadi dokumen Word yang dapat diedit.',
      icon: FileText,
      iconClass: 'bg-sky-50 text-sky-600',
      action: () => setShowPdfToDocxModal(true)
    },
    {
      title: 'PowerPoint & PDF',
      category: 'convert' as ToolCategory,
      desc: 'Konversi PPTX/PPT ke PDF atau ubah PDF menjadi slide presentasi.',
      icon: Presentation,
      iconClass: 'bg-orange-50 text-orange-600',
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
      iconClass: 'bg-emerald-50 text-emerald-600',
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
      iconClass: 'bg-violet-50 text-violet-600',
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
      iconClass: 'bg-rose-50 text-rose-600',
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
      iconClass: 'bg-teal-50 text-teal-600',
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
      iconClass: 'bg-amber-50 text-amber-600',
      action: () => {
        setPdfToolsTab('img2pdf')
        setShowPdfToolsModal(true)
      }
    },
    {
      title: 'Resize Gambar',
      category: 'image' as ToolCategory,
      desc: 'Kompres ukuran gambar sesuai target KB/MB dan bersihkan metadata EXIF.',
      icon: ImageIcon,
      iconClass: 'bg-emerald-50 text-emerald-600',
      action: () => setShowImageResizeModal(true)
    },
    {
      title: 'Edit PDF',
      category: 'organize' as ToolCategory,
      desc: 'Atur urutan, putar, hapus halaman, serta tambah teks & tanda tangan.',
      icon: FileEdit,
      iconClass: 'bg-indigo-50 text-indigo-600',
      action: () => setShowPdfEditorModal(true)
    },
    {
      title: 'Sign PDF',
      category: 'security' as ToolCategory,
      desc: 'Bubuhkan tanda tangan visual, paraf, nama, dan tanggal dengan drag & resize.',
      icon: PenTool,
      iconClass: 'bg-blue-50 text-blue-600',
      action: () => setShowPdfSignModal(true)
    },
    {
      title: 'Unlock PDF',
      category: 'security' as ToolCategory,
      desc: 'Hapus proteksi password pada dokumen PDF secara lokal, aman, dan tanpa batasan.',
      icon: Unlock,
      iconClass: 'bg-sky-50 text-sky-600',
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
      iconClass: 'bg-indigo-50 text-indigo-600',
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
      iconClass: 'bg-lime-50 text-lime-700',
      action: () => setShowPdfRepairModal(true)
    },
    {
      title: 'OCR PDF',
      category: 'organize' as ToolCategory,
      desc: 'Ubah PDF hasil scan menjadi dokumen yang teksnya dapat dicari dan disalin.',
      icon: FileSearch,
      iconClass: 'bg-emerald-50 text-emerald-700',
      action: () => setShowPdfOcrModal(true)
    },
    {
      title: 'Watermark PDF',
      category: 'organize' as ToolCategory,
      desc: 'Bubuhkan stempel teks atau logo transparan pada halaman dengan posisi dan rotasi kustom.',
      icon: Stamp,
      iconClass: 'bg-rose-50 text-rose-600',
      action: () => setShowPdfWatermarkModal(true)
    },
    {
      title: 'Nomor Halaman',
      category: 'organize' as ToolCategory,
      desc: 'Sisipkan penomoran halaman otomatis dengan format angka, letak posisi, dan margin fleksibel.',
      icon: Hash,
      iconClass: 'bg-blue-50 text-blue-600',
      action: () => setShowPdfPageNumbersModal(true)
    },
    {
      title: 'PDF to Markdown',
      category: 'convert' as ToolCategory,
      desc: 'Ekstrak dokumen PDF menjadi berkas Markdown (.md) lokal dengan mempertahankan heading, tabel, list & tautan.',
      icon: FileCode,
      iconClass: 'bg-purple-50 text-purple-600',
      isNew: true,
      action: () => setShowPdfToMarkdownModal(true)
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
    <div className="app-shell h-dvh overflow-hidden bg-slate-50 flex flex-col font-sans text-slate-800">
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

      {activeWorkspace === 'builder' && (
        <>
      {/* Switcher Tab Mobile (Editor vs Preview) */}
      <div className="lg:hidden shrink-0 p-1.5 bg-white border-b border-slate-200">
        <div className="relative grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
          <span
            aria-hidden="true"
            className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-xs transition-transform duration-300 ease-out ${
              mobileTab === 'preview' ? 'translate-x-full' : 'translate-x-0'
            }`}
          />
          <button
            type="button"
            onClick={() => setMobileTab('editor')}
            aria-pressed={mobileTab === 'editor'}
            className={`relative z-10 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 rounded-lg transition-colors ${
              mobileTab === 'editor' ? 'text-indigo-700' : 'text-slate-500'
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
              mobileTab === 'preview' ? 'text-indigo-700' : 'text-slate-500'
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
          className={`w-full lg:w-[44%] min-h-0 flex-col bg-white ${
            mobileTab === 'editor' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Section Tabs Navigation */}
          <nav
            className="shrink-0 flex overflow-x-auto border-b border-slate-200 px-2 sm:px-4 gap-0.5 scrollbar-none bg-white"
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
                  className={`group relative flex items-center gap-1.5 px-3 py-3 text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${
                    isActive ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  data-testid={`tab-${s.id}`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 transition-colors ${
                      isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  {s.label}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-indigo-600 origin-center transition-transform duration-300 ease-out ${
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
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 animate-fade-in">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500 font-medium">Menyiapkan editor CV...</p>
                <button
                  type="button"
                  onClick={() => createNewDraft('Resume Baru', 'ats-clean')}
                  className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-xs"
                >
                  + Buat CV Baru Sekarang
                </button>
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
            <div className="shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur px-3 sm:px-5 py-2.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => goToSection(activeIndex - 1)}
                disabled={isFirstSection}
                className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50 active:scale-[0.97] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                aria-label="Bagian sebelumnya"
                data-testid="btn-section-prev"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Sebelumnya</span>
              </button>

              <div className="flex-1 min-w-0" aria-live="polite">
                <div className="flex items-center justify-between text-2xs font-medium text-slate-500 mb-1">
                  <span className="truncate">
                    Langkah {activeIndex + 1} dari {SECTIONS.length} · <span className="text-slate-700">{SECTIONS[activeIndex].label}</span>
                  </span>
                </div>
                <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-500 ease-out"
                    style={{ width: `${((activeIndex + 1) / SECTIONS.length) * 100}%` }}
                  />
                </div>
              </div>

              {isLastSection ? (
                <button
                  type="button"
                  onClick={() => openExportModal('pdf')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs active:scale-[0.97] transition"
                  data-testid="btn-section-finish"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Periksa &amp; Unduh</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => goToSection(activeIndex + 1)}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs active:scale-[0.97] transition"
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
        <main key="ats" className="flex-1 min-h-0 overflow-y-auto bg-slate-50 custom-scrollbar animate-fade-in">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-up">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Workspace</span>
                <h1 className="text-2xl font-black text-slate-900 mt-1">Optimasi ATS</h1>
                <p className="text-sm text-slate-500 mt-1">Periksa keterbacaan CV dan cocokkan isi dengan lowongan target.</p>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('builder')}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 active:scale-[0.97] transition"
              >
                <ChevronLeft className="w-4 h-4" /> Kembali edit CV
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => setShowAtsPanel(true)}
                style={{ '--i': 1 } as CSSProperties}
                className="stagger-item group text-left p-6 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5 transition duration-200"
              >
                <div className="flex items-start justify-between">
                  <span className="p-3 rounded-xl bg-indigo-50 text-indigo-600 transition-transform duration-200 group-hover:scale-110"><ShieldCheck className="w-6 h-6" /></span>
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-5">Evaluasi Keterbacaan ATS</h2>
                <p className="text-sm text-slate-500 mt-2">Audit struktur, informasi kontak, ringkasan, dampak terukur, dan integritas kata kunci.</p>
                <div className="mt-5 flex items-center gap-3">
                  <span key={atsAnalysis?.score ?? 0} className="text-3xl font-black text-indigo-700 animate-fade-up">{atsAnalysis?.score ?? 0}</span>
                  <span className="text-xs text-slate-400">skor dari 100</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, atsAnalysis?.score ?? 0))}%` }}
                  />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowJobMatchModal(true)}
                style={{ '--i': 2 } as CSSProperties}
                className="stagger-item group text-left p-6 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-emerald-300 hover:shadow-lg hover:-translate-y-0.5 transition duration-200"
              >
                <div className="flex items-start justify-between">
                  <span className="p-3 rounded-xl bg-emerald-50 text-emerald-600 transition-transform duration-200 group-hover:scale-110"><FileSearch className="w-6 h-6" /></span>
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-5">Cocokkan dengan Lowongan</h2>
                <p className="text-sm text-slate-500 mt-2">Bandingkan kata kunci CV dengan deskripsi pekerjaan dan temukan kompetensi yang belum tercantum.</p>
                <span className="inline-flex mt-5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">Analisis lokal &amp; privat</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {activeWorkspace === 'tools' && (
        <main key="tools" className="flex-1 min-h-0 overflow-y-auto bg-slate-50 custom-scrollbar animate-fade-in">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-up">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Workspace</span>
                <h1 className="text-2xl font-black text-slate-900 mt-1">Alat Dokumen</h1>
                <p className="text-sm text-slate-500 mt-1">Konversi dan olah dokumen tanpa memenuhi layar editor CV.</p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={toolQuery}
                  onChange={event => setToolQuery(event.target.value)}
                  placeholder="Cari alat, mis. kompres, OCR..."
                  aria-label="Cari alat dokumen"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm shadow-xs outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                  data-testid="input-search-tools"
                />
                {toolQuery && (
                  <button
                    type="button"
                    onClick={() => setToolQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition animate-fade-in"
                    aria-label="Hapus pencarian alat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {visibleTools.length === 0 ? (
              <div className="py-16 text-center animate-fade-in" data-testid="tools-empty">
                <Search className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Alat tidak ditemukan</p>
                <p className="mt-1 text-xs text-slate-500">Coba kata kunci lain, misalnya &quot;PDF&quot;, &quot;gambar&quot;, atau &quot;password&quot;.</p>
              </div>
            ) : (
              TOOL_CATEGORIES.map(category => {
                const items = visibleTools.filter(tool => tool.category === category.id)
                if (items.length === 0) return null
                return (
                  <section key={category.id} aria-labelledby={`tools-${category.id}`} className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <h2 id={`tools-${category.id}`} className="text-sm font-bold text-slate-800">{category.label}</h2>
                      <span className="text-2xs font-medium text-slate-400">{items.length} alat</span>
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
                            className="stagger-item group text-left p-5 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition duration-200 min-h-44 flex flex-col relative"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={`p-3 rounded-xl self-start transition-transform duration-200 group-hover:scale-110 ${tool.iconClass}`}><Icon className="w-6 h-6" /></span>
                              {tool.isNew && (
                                <span className="text-3xs font-extrabold uppercase px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full border border-sky-200 tracking-wide">
                                  New!
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-slate-900 mt-4">{tool.title}</h3>
                            <p className="text-xs leading-relaxed text-slate-500 mt-2 flex-1">{tool.desc}</p>
                            <span className="mt-4 text-xs font-bold text-indigo-600 flex items-center gap-1">
                              Buka alat <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })
            )}

            <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-800">Pemrosesan lokal</h3>
                <p className="text-xs text-slate-500 mt-1">Dokumen diproses melalui server lokal Doc-builder. Berkas sementara dibersihkan otomatis.</p>
              </div>
            </div>
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
