import { useState, useEffect } from 'react'
import { initAuthSession } from './services/apiClient'
import { useResumeDraft } from './hooks/useResumeDraft'
import { exportResumeDocx, exportResumePdf } from './services/export'
import { analyzeAtsStructure, type AtsAnalysisResult } from './services/ats'
import { Navbar, type Workspace } from './components/layout/Navbar'
import { ImportResumeModal } from './components/builder/ImportResumeModal'
import { AtsScorePanel } from './components/ats/AtsScorePanel'
import { JobMatchModal } from './components/ats/JobMatchModal'
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
import { SummaryForm } from './components/builder/SummaryForm'
import { ExperienceForm } from './components/builder/ExperienceForm'
import { EducationForm } from './components/builder/EducationForm'
import { SkillsForm } from './components/builder/SkillsForm'
import { LanguagesForm } from './components/builder/LanguagesForm'
import { CustomSectionsForm } from './components/builder/CustomSectionsForm'
import { ResumePreview } from './components/preview/ResumePreview'
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
  Hash
} from 'lucide-react'

type ActiveSection =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'languages'
  | 'custom'

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
    loadDraft,
    createNewDraft,
    updateData,
    updateMeta,
    deleteWithUndo,
    undoDelete,
    togglePrivateMode
  } = useResumeDraft()

  const [activeSection, setActiveSection] = useState<ActiveSection>('contact')
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(workspaceFromHash)
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor')
  const [showImportModal, setShowImportModal] = useState(false)
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

  const handleExportDocx = async () => {
    if (!draft) return
    try {
      await exportResumeDocx(draft)
    } catch (err: any) {
      alert(`Gagal mengunduh berkas Word: ${err.message}`)
    }
  }

  const handleExportPdf = async () => {
    if (!draft) return
    try {
      const res = await exportResumePdf(draft)
      if (res.fallbackToPrint && res.message) {
        console.info(res.message)
      }
    } catch (err: any) {
      alert(`Gagal mengunduh berkas PDF: ${err.message}`)
    }
  }

  // Inisialisasi draft pertama jika belum ada
  useEffect(() => {
    if (!draft && draftsList.length === 0) {
      createNewDraft('Resume Baru', 'ats-clean')
    } else if (!draft && draftsList.length > 0) {
      loadDraft(draftsList[0].id)
    }
  }, [draft, draftsList, createNewDraft, loadDraft])

  const SECTIONS: { id: ActiveSection; label: string; icon: any }[] = [
    { id: 'contact', label: 'Kontak', icon: User },
    { id: 'summary', label: 'Ringkasan', icon: FileText },
    { id: 'experience', label: 'Pengalaman', icon: Briefcase },
    { id: 'education', label: 'Pendidikan', icon: GraduationCap },
    { id: 'skills', label: 'Keahlian', icon: Wrench },
    { id: 'languages', label: 'Bahasa', icon: Languages },
    { id: 'custom', label: 'Bagian Lain', icon: Layers3 }
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
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
        onExportDocx={handleExportDocx}
        onExportPdf={handleExportPdf}
        onOpenImportModal={() => setShowImportModal(true)}
        onCreateNew={() => createNewDraft()}
        onLoadDraft={loadDraft}
        onDeleteDraft={deleteWithUndo}
        onUndoDelete={undoDelete}
        onTogglePrivateMode={togglePrivateMode}
      />

      {activeWorkspace === 'builder' && (
        <>
      {/* Switcher Tab Mobile (Editor vs Preview) */}
      <div className="lg:hidden flex border-b border-slate-200 bg-white sticky top-14 z-20">
        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
            mobileTab === 'editor'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
              : 'border-transparent text-slate-500'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          Form Editor
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
            mobileTab === 'preview'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
              : 'border-transparent text-slate-500'
          }`}
        >
          <Eye className="w-4 h-4" />
          Pratinjau A4
        </button>
      </div>

      {/* Workspace Konten Utama */}
      <main className="flex-1 flex overflow-hidden">
        {/* Kolom Kiri: Form Editor */}
        <section
          className={`w-full lg:w-[44%] flex flex-col bg-white overflow-y-auto ${
            mobileTab === 'editor' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Section Tabs Navigation */}
          <nav className="flex overflow-x-auto border-b border-slate-200 px-4 pt-2 gap-1 scrollbar-none bg-slate-50/80 sticky top-0 z-10">
            {SECTIONS.map(s => {
              const Icon = s.icon
              const isActive = activeSection === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition whitespace-nowrap border-t-2 border-x border-b-0 ${
                    isActive
                      ? 'bg-white border-t-indigo-600 border-x-slate-200 text-indigo-700 shadow-2xs'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                  }`}
                  data-testid={`tab-${s.id}`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {s.label}
                </button>
              )
            })}
          </nav>

          {/* Form Content Area */}
          <div className="p-4 sm:p-6 flex-1 max-w-2xl mx-auto w-full">
            {!draft ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
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
              </>
            )}
          </div>
        </section>

        {/* Kolom Kanan: Live Preview A4 */}
        <aside
          className={`w-full lg:w-[56%] h-[calc(100vh-56px)] ${
            mobileTab === 'preview' ? 'block' : 'hidden lg:block'
          }`}
        >
          <ResumePreview draft={draft} />
        </aside>
      </main>
        </>
      )}

      {activeWorkspace === 'ats' && (
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Workspace</span>
                <h1 className="text-2xl font-black text-slate-900 mt-1">Optimasi ATS</h1>
                <p className="text-sm text-slate-500 mt-1">Periksa keterbacaan CV dan cocokkan isi dengan lowongan target.</p>
              </div>
              <button
                type="button"
                onClick={() => navigateTo('builder')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
              >
                Kembali edit CV
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => setShowAtsPanel(true)}
                className="group text-left p-6 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <span className="p-3 rounded-xl bg-indigo-50 text-indigo-600"><ShieldCheck className="w-6 h-6" /></span>
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-5">Evaluasi Keterbacaan ATS</h2>
                <p className="text-sm text-slate-500 mt-2">Audit struktur, informasi kontak, ringkasan, dampak terukur, dan integritas kata kunci.</p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="text-3xl font-black text-indigo-700">{atsAnalysis?.score ?? 0}</span>
                  <span className="text-xs text-slate-400">skor dari 100</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowJobMatchModal(true)}
                className="group text-left p-6 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-emerald-300 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <span className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><FileSearch className="w-6 h-6" /></span>
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-5">Cocokkan dengan Lowongan</h2>
                <p className="text-sm text-slate-500 mt-2">Bandingkan kata kunci CV dengan deskripsi pekerjaan dan temukan kompetensi yang belum tercantum.</p>
                <span className="inline-flex mt-5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">Analisis lokal & privat</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {activeWorkspace === 'tools' && (
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Workspace</span>
              <h1 className="text-2xl font-black text-slate-900 mt-1">Alat Dokumen</h1>
              <p className="text-sm text-slate-500 mt-1">Konversi dan olah dokumen tanpa memenuhi layar editor CV.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  title: 'DOCX ke PDF',
                  desc: 'Konversi dokumen Word menjadi PDF standar.',
                  icon: FileCode,
                  iconClass: 'bg-indigo-50 text-indigo-600',
                  action: () => setShowConverterModal(true)
                },
                {
                  title: 'PDF ke DOCX',
                  desc: 'Rekonstruksi PDF menjadi dokumen Word yang dapat diedit.',
                  icon: FileText,
                  iconClass: 'bg-sky-50 text-sky-600',
                  action: () => setShowPdfToDocxModal(true)
                },
                {
                  title: 'PowerPoint & PDF',
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
                  desc: 'Kompres ukuran gambar sesuai target KB/MB dan bersihkan metadata EXIF.',
                  icon: ImageIcon,
                  iconClass: 'bg-emerald-50 text-emerald-600',
                  action: () => setShowImageResizeModal(true)
                },
                {
                  title: 'Edit PDF',
                  desc: 'Atur urutan, putar, hapus halaman, serta tambah teks & tanda tangan.',
                  icon: FileEdit,
                  iconClass: 'bg-indigo-50 text-indigo-600',
                  action: () => setShowPdfEditorModal(true)
                },
                {
                  title: 'Sign PDF',
                  desc: 'Bubuhkan tanda tangan visual, paraf, nama, dan tanggal dengan drag & resize.',
                  icon: PenTool,
                  iconClass: 'bg-blue-50 text-blue-600',
                  action: () => setShowPdfSignModal(true)
                },
                {
                  title: 'Unlock PDF',
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
                  desc: 'Pulihkan berkas PDF yang rusak dan selamatkan data di dalamnya secara lokal.',
                  icon: Wrench,
                  iconClass: 'bg-lime-50 text-lime-700',
                  action: () => setShowPdfRepairModal(true)
                },
                {
                  title: 'OCR PDF',
                  desc: 'Ubah PDF hasil scan menjadi dokumen yang teksnya dapat dicari dan disalin.',
                  icon: FileSearch,
                  iconClass: 'bg-emerald-50 text-emerald-700',
                  action: () => setShowPdfOcrModal(true)
                },
                {
                  title: 'Watermark PDF',
                  desc: 'Bubuhkan stempel teks atau logo transparan pada halaman dengan posisi dan rotasi kustom.',
                  icon: Stamp,
                  iconClass: 'bg-rose-50 text-rose-600',
                  action: () => setShowPdfWatermarkModal(true)
                },
                {
                  title: 'Nomor Halaman',
                  desc: 'Sisipkan penomoran halaman otomatis dengan format angka, letak posisi, dan margin fleksibel.',
                  icon: Hash,
                  iconClass: 'bg-blue-50 text-blue-600',
                  action: () => setShowPdfPageNumbersModal(true)
                },
                {
                  title: 'PDF to Markdown',
                  desc: 'Ekstrak dokumen PDF menjadi berkas Markdown (.md) lokal dengan mempertahankan heading, tabel, list & tautan.',
                  icon: FileCode,
                  iconClass: 'bg-purple-50 text-purple-600',
                  isNew: true,
                  action: () => setShowPdfToMarkdownModal(true)
                },
              ].map(tool => {
                const Icon = tool.icon
                return (
                  <button
                    key={tool.title}
                    type="button"
                    onClick={tool.action}
                    className="group text-left p-5 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-indigo-300 hover:shadow-md transition min-h-48 flex flex-col relative"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`p-3 rounded-xl self-start ${tool.iconClass}`}><Icon className="w-6 h-6" /></span>
                      {tool.isNew && (
                        <span className="text-3xs font-extrabold uppercase px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full border border-sky-200 tracking-wide">
                          New!
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mt-5">{tool.title}</h2>
                    <p className="text-xs leading-relaxed text-slate-500 mt-2 flex-1">{tool.desc}</p>
                    <span className="mt-4 text-xs font-bold text-indigo-600 flex items-center gap-1">Buka alat <ArrowRight className="w-4 h-4" /></span>
                  </button>
                )
              })}
            </div>

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

      {/* Modal Impor CV Lama */}
      <ImportResumeModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onApply={extracted => updateData(() => extracted)}
      />

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
