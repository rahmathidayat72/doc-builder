import { useState, useEffect } from 'react'
import { useResumeDraft } from './hooks/useResumeDraft'
import { exportResumeDocx, exportResumePdf } from './services/export'
import { analyzeAtsStructure, type AtsAnalysisResult } from './services/ats'
import { Navbar } from './components/layout/Navbar'
import { ImportResumeModal } from './components/builder/ImportResumeModal'
import { AtsScorePanel } from './components/ats/AtsScorePanel'
import { JobMatchModal } from './components/ats/JobMatchModal'
import { DocxToPdfModal } from './components/converter/DocxToPdfModal'
import { PdfToDocxModal } from './components/converter/PdfToDocxModal'
import { ContactForm } from './components/builder/ContactForm'
import { SummaryForm } from './components/builder/SummaryForm'
import { ExperienceForm } from './components/builder/ExperienceForm'
import { EducationForm } from './components/builder/EducationForm'
import { SkillsForm } from './components/builder/SkillsForm'
import { LanguagesForm } from './components/builder/LanguagesForm'
import { ResumePreview } from './components/preview/ResumePreview'
import {
  User,
  FileText,
  Briefcase,
  GraduationCap,
  Wrench,
  Languages,
  Eye,
  Edit3
} from 'lucide-react'

type ActiveSection = 'contact' | 'summary' | 'experience' | 'education' | 'skills' | 'languages'

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
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor')
  const [showImportModal, setShowImportModal] = useState(false)
  const [atsAnalysis, setAtsAnalysis] = useState<AtsAnalysisResult | null>(null)
  const [showAtsPanel, setShowAtsPanel] = useState(false)
  const [showJobMatchModal, setShowJobMatchModal] = useState(false)
  const [showConverterModal, setShowConverterModal] = useState(false)
  const [showPdfToDocxModal, setShowPdfToDocxModal] = useState(false)

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
    { id: 'languages', label: 'Bahasa', icon: Languages }
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Navbar & Kontrol Topbar */}
      <Navbar
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
        onExportDocx={handleExportDocx}
        onExportPdf={handleExportPdf}
        onOpenImportModal={() => setShowImportModal(true)}
        onOpenJobMatch={() => setShowJobMatchModal(true)}
        onOpenConverter={() => setShowConverterModal(true)}
        onOpenPdfToDocx={() => setShowPdfToDocxModal(true)}
        onCreateNew={() => createNewDraft()}
        onLoadDraft={loadDraft}
        onDeleteDraft={deleteWithUndo}
        onUndoDelete={undoDelete}
        onTogglePrivateMode={togglePrivateMode}
      />

      {/* Switcher Tab Mobile (Editor vs Preview) */}
      <div className="lg:hidden flex border-b border-slate-200 bg-white sticky top-[53px] z-20">
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
          className={`w-full lg:w-1/2 flex flex-col bg-white overflow-y-auto ${
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
            {draft && (
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
              </>
            )}
          </div>
        </section>

        {/* Kolom Kanan: Live Preview A4 */}
        <aside
          className={`w-full lg:w-1/2 h-[calc(100vh-53px)] ${
            mobileTab === 'preview' ? 'block' : 'hidden lg:block'
          }`}
        >
          <ResumePreview draft={draft} />
        </aside>
      </main>

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
    </div>
  )
}

export default App
