import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { Navbar } from '../layout/Navbar'
import { ContactForm } from '../builder/ContactForm'
import { SummaryForm } from '../builder/SummaryForm'
import { SkillsForm } from '../builder/SkillsForm'
import { LanguagesForm } from '../builder/LanguagesForm'
import { ResumePreview } from '../preview/ResumePreview'
import { DocxToPdfModal } from '../converter/DocxToPdfModal'
import { PdfToDocxModal } from '../converter/PdfToDocxModal'
import { PresentationConverterModal } from '../converter/PresentationConverterModal'
import { SpreadsheetConverterModal } from '../converter/SpreadsheetConverterModal'
import { PdfToolsModal } from '../pdf-tools/PdfToolsModal'
import { PdfEditorModal } from '../pdf-tools/PdfEditorModal'
import { PdfSignModal } from '../pdf-tools/PdfSignModal'
import { PdfSecurityModal } from '../pdf-tools/PdfSecurityModal'
import { PdfRepairModal } from '../pdf-tools/PdfRepairModal'
import { PdfOcrModal } from '../pdf-tools/PdfOcrModal'
import { PdfWatermarkModal } from '../pdf-tools/PdfWatermarkModal'
import { PdfPageNumbersModal } from '../pdf-tools/PdfPageNumbersModal'
import { PdfToMarkdownModal } from '../pdf-tools/PdfToMarkdownModal'
import { ImageResizeModal } from '../image-tools/ImageResizeModal'
import { type ResumeDraft, createEmptyResumeData } from '../../types/resume'

const dummyDraft: ResumeDraft = {
  id: '55555555-5555-4555-8555-555555555555',
  title: 'Draft Uji Aksesibilitas',
  templateId: 'ats-clean',
  colorTheme: '#4338ca',
  fontFamily: 'sans',
  resumeLanguage: 'id',
  data: {
    ...createEmptyResumeData(),
    contact: {
      fullName: 'Kartini Pertiwi',
      email: 'kartini@example.com',
      phone: '+62811223344',
      location: 'Jepara, Indonesia',
      linkedin: '',
      website: '',
    },
    summary: 'Pendidik dan aktivis literasi digital.',
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
}

describe('WCAG 2.2 AA Accessibility Audits', () => {
  it('Navbar bebas pelanggaran aksesibilitas', async () => {
    const { container } = render(
      <Navbar
        draft={dummyDraft}
        draftsList={[]}
        isSaving={false}
        lastSaved={new Date()}
        privateMode={false}
        pendingDelete={null}
        onUpdateTitle={vi.fn()}
        onUpdateTheme={vi.fn()}
        onUpdateFont={vi.fn()}
        onUpdateTemplate={vi.fn()}
        onExportDocx={vi.fn()}
        onExportPdf={vi.fn()}
        onOpenImportModal={vi.fn()}
        onCreateNew={vi.fn()}
        onLoadDraft={vi.fn()}
        onDeleteDraft={vi.fn()}
        onUndoDelete={vi.fn()}
        onTogglePrivateMode={vi.fn()}
      />
    )
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })

  it('ContactForm & SummaryForm bebas pelanggaran aksesibilitas', async () => {
    const { container } = render(
      <div>
        <ContactForm contact={dummyDraft.data.contact} onChange={vi.fn()} />
        <SummaryForm summary={dummyDraft.data.summary} onChange={vi.fn()} />
      </div>
    )
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })

  it('SkillsForm & LanguagesForm bebas pelanggaran aksesibilitas', async () => {
    const { container } = render(
      <div>
        <SkillsForm skills={dummyDraft.data.skills} onChange={vi.fn()} />
        <LanguagesForm languages={dummyDraft.data.languages} onChange={vi.fn()} />
      </div>
    )
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })

  it('ResumePreview bebas pelanggaran aksesibilitas', async () => {
    const { container } = render(<ResumePreview draft={dummyDraft} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })

  it('DocxToPdfModal & PdfToDocxModal bebas pelanggaran aksesibilitas', async () => {
    const { container } = render(
      <div>
        <DocxToPdfModal isOpen={true} onClose={vi.fn()} />
        <PdfToDocxModal isOpen={true} onClose={vi.fn()} />
        <PresentationConverterModal isOpen={true} onClose={vi.fn()} />
        <SpreadsheetConverterModal isOpen={true} onClose={vi.fn()} />
      </div>
    )
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })

  it('PdfToolsModal, PdfEditorModal, PdfSignModal, PdfSecurityModal, PdfRepairModal, PdfOcrModal, PdfWatermarkModal, PdfPageNumbersModal, PdfToMarkdownModal & ImageResizeModal bebas pelanggaran aksesibilitas', async () => {
    const { container } = render(
      <div>
        <PdfToolsModal isOpen={true} onClose={vi.fn()} />
        <PdfEditorModal isOpen={true} onClose={vi.fn()} />
        <PdfSignModal isOpen={true} onClose={vi.fn()} />
        <PdfSecurityModal isOpen={true} onClose={vi.fn()} initialTab="unlock" />
        <PdfSecurityModal isOpen={true} onClose={vi.fn()} initialTab="protect" />
        <PdfRepairModal isOpen={true} onClose={vi.fn()} />
        <PdfOcrModal isOpen={true} onClose={vi.fn()} />
        <PdfWatermarkModal isOpen={true} onClose={vi.fn()} />
        <PdfPageNumbersModal isOpen={true} onClose={vi.fn()} />
        <PdfToMarkdownModal isOpen={true} onClose={vi.fn()} />
        <ImageResizeModal isOpen={true} onClose={vi.fn()} />
      </div>
    )
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
