import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Dashboard } from '../Dashboard'
import { type ResumeDraft, type ResumeDraftSummary, createEmptyResumeData } from '../../../types/resume'

const sampleDraft: ResumeDraft = {
  id: 'draft-1',
  title: 'CV Software Engineer',
  templateId: 'ats-clean',
  colorTheme: '#1e293b',
  fontFamily: 'sans',
  resumeLanguage: 'id',
  data: createEmptyResumeData(),
  createdAt: 1000,
  updatedAt: Date.now() - 5000,
  version: 1,
  favorite: false
}

const sampleSummaries: ResumeDraftSummary[] = [
  {
    id: 'draft-1',
    title: 'CV Software Engineer',
    templateId: 'ats-clean',
    createdAt: 1000,
    updatedAt: Date.now() - 5000,
    favorite: true,
    targetJobTitle: 'Senior Backend Engineer'
  },
  {
    id: 'draft-2',
    title: 'CV Frontend Lead',
    templateId: 'ats-modern',
    createdAt: 2000,
    updatedAt: Date.now() - 120000,
    favorite: false
  }
]

describe('Dashboard Component Suite', () => {
  it('merender dashboard dengan empty state saat belum ada CV yang dibuat', () => {
    render(
      <Dashboard
        draft={null}
        draftsList={[]}
        privateMode={false}
        onNavigate={vi.fn()}
        onCreateNewResume={vi.fn()}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
      />
    )

    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Rancang CV Unggul/i })).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-drafts-empty')).toBeInTheDocument()
    expect(screen.getByText(/Belum ada CV yang dibuat/i)).toBeInTheDocument()
    expect(screen.getByTestId('stat-total-drafts')).toHaveTextContent('0')
    expect(screen.queryByTestId('btn-dashboard-continue-latest')).not.toBeInTheDocument()
  })

  it('merender dashboard dengan daftar draft tersimpan dan metrik cepat', () => {
    render(
      <Dashboard
        draft={sampleDraft}
        draftsList={sampleSummaries}
        atsScore={88}
        privateMode={true}
        onNavigate={vi.fn()}
        onCreateNewResume={vi.fn()}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
      />
    )

    expect(screen.getByTestId('stat-total-drafts')).toHaveTextContent('2')
    expect(screen.getByTestId('stat-ats-score')).toHaveTextContent('88')
    expect(screen.getByText('Mode Privat Aktif')).toBeInTheDocument()
    expect(screen.getByTestId('btn-dashboard-continue-latest')).toBeInTheDocument()
    expect(screen.getAllByText('CV Software Engineer').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('CV Frontend Lead')).toBeInTheDocument()
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument()
  })

  it('memanggil handler saat tombol aksi cepat dan kartu workspace diklik', () => {
    const handleNavigate = vi.fn()
    const handleCreateNew = vi.fn()
    const handleImport = vi.fn()
    const handleLoadDraft = vi.fn()
    const handleToggleFavorite = vi.fn()

    render(
      <Dashboard
        draft={sampleDraft}
        draftsList={sampleSummaries}
        atsScore={75}
        privateMode={false}
        onNavigate={handleNavigate}
        onCreateNewResume={handleCreateNew}
        onOpenImportModal={handleImport}
        onLoadDraft={handleLoadDraft}
        onToggleFavorite={handleToggleFavorite}
      />
    )

    // Klik Buat CV Baru
    fireEvent.click(screen.getByTestId('btn-dashboard-create-cv'))
    expect(handleCreateNew).toHaveBeenCalledTimes(1)

    // Klik Impor CV
    fireEvent.click(screen.getByTestId('btn-dashboard-import-cv'))
    expect(handleImport).toHaveBeenCalledTimes(1)

    // Klik Kartu Workspace Builder
    fireEvent.click(screen.getByTestId('card-workspace-builder'))
    expect(handleNavigate).toHaveBeenCalledWith('builder')

    // Klik Kartu Workspace ATS
    fireEvent.click(screen.getByTestId('card-workspace-ats'))
    expect(handleNavigate).toHaveBeenCalledWith('ats')

    // Klik Kartu Workspace Tools
    fireEvent.click(screen.getByTestId('card-workspace-tools'))
    expect(handleNavigate).toHaveBeenCalledWith('tools')

    // Klik judul draft dalam daftar
    fireEvent.click(screen.getByText('CV Frontend Lead'))
    expect(handleLoadDraft).toHaveBeenCalledWith('draft-2')
    expect(handleNavigate).toHaveBeenCalledWith('builder')

    // Klik tombol favorit pada draft
    fireEvent.click(screen.getByLabelText('Favorit CV Software Engineer'))
    expect(handleToggleFavorite).toHaveBeenCalledWith('draft-1')
  })
})
