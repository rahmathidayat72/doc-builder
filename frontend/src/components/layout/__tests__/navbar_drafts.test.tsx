import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Navbar } from '../Navbar'
import {
  type ResumeDraft,
  type ResumeDraftSummary,
  createEmptyResumeData
} from '../../../types/resume'

const draft: ResumeDraft = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'CV Utama',
  templateId: 'ats-clean',
  colorTheme: '#1e293b',
  fontFamily: 'sans',
  resumeLanguage: 'id',
  data: createEmptyResumeData(),
  createdAt: 1,
  updatedAt: 1,
  version: 1
}

const summaries: ResumeDraftSummary[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'CV Utama',
    templateId: 'ats-clean',
    createdAt: 1,
    updatedAt: 10,
    favorite: false
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'CV Backend Target',
    templateId: 'ats-modern',
    createdAt: 2,
    updatedAt: 20,
    favorite: true,
    targetJobTitle: 'Senior Backend Engineer'
  }
]

const renderNavbar = (
  overrides: Partial<ComponentProps<typeof Navbar>> = {}
) => {
  const props: ComponentProps<typeof Navbar> = {
    draft,
    draftsList: summaries,
    isSaving: false,
    lastSaved: new Date(1),
    privateMode: false,
    pendingDelete: null,
    onUpdateTitle: vi.fn(),
    onUpdateTheme: vi.fn(),
    onUpdateFont: vi.fn(),
    onUpdateTemplate: vi.fn(),
    onExportDocx: vi.fn(),
    onExportPdf: vi.fn(),
    onOpenImportModal: vi.fn(),
    onCreateNew: vi.fn(),
    onLoadDraft: vi.fn(),
    onDeleteDraft: vi.fn(),
    onRenameDraft: vi.fn(),
    onDuplicateDraft: vi.fn().mockResolvedValue(undefined),
    onToggleFavorite: vi.fn(),
    onUndoDelete: vi.fn(),
    onTogglePrivateMode: vi.fn(),
    ...overrides
  }
  return { ...render(<Navbar {...props} />), props }
}

const openDrafts = () => {
  fireEvent.click(screen.getByTestId('btn-open-drafts'))
}

describe('Navbar draft management', () => {
  it('mencari draft berdasarkan judul atau target lowongan', () => {
    renderNavbar()
    openDrafts()

    fireEvent.change(screen.getByTestId('input-search-drafts'), {
      target: { value: 'backend' }
    })

    expect(screen.getByText('CV Backend Target')).toBeInTheDocument()
    expect(screen.queryByText('CV Utama')).not.toBeInTheDocument()
    expect(screen.queryByText(/Tidak ada draft yang cocok/i)).not.toBeInTheDocument()
  })

  it('menampilkan pesan kosong saat pencarian tidak menemukan draft', () => {
    renderNavbar()
    openDrafts()

    fireEvent.change(screen.getByTestId('input-search-drafts'), {
      target: { value: 'tidak-ada' }
    })

    expect(
      screen.getByText(/Tidak ada draft yang cocok dengan pencarian/i)
    ).toBeInTheDocument()
  })

  it('memanggil toggle favorit dan memuat draft saat judul diklik', () => {
    const { props } = renderNavbar()
    openDrafts()

    fireEvent.click(
      screen.getByTestId('btn-favorite-22222222-2222-4222-8222-222222222222')
    )
    expect(props.onToggleFavorite).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222'
    )

    fireEvent.click(screen.getByText('CV Backend Target'))
    expect(props.onLoadDraft).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222')
  })

  it('mengganti nama draft secara inline dan menyimpan judul baru', async () => {
    const { props } = renderNavbar()
    openDrafts()

    fireEvent.click(
      screen.getByTestId('btn-rename-22222222-2222-4222-8222-222222222222')
    )
    const input = screen.getByTestId(
      'input-rename-draft-22222222-2222-4222-8222-222222222222'
    )
    fireEvent.change(input, { target: { value: 'CV Backend Baru' } })
    fireEvent.click(
      screen.getByTestId('btn-save-rename-22222222-2222-4222-8222-222222222222')
    )

    await waitFor(() => {
      expect(props.onRenameDraft).toHaveBeenCalledWith(
        '22222222-2222-4222-8222-222222222222',
        'CV Backend Baru'
      )
    })
    expect(
      screen.queryByTestId('input-rename-draft-22222222-2222-4222-8222-222222222222')
    ).not.toBeInTheDocument()
  })

  it('menduplikasi draft lalu menutup daftar draft', async () => {
    const { props } = renderNavbar()
    openDrafts()

    fireEvent.click(
      screen.getByTestId('btn-duplicate-22222222-2222-4222-8222-222222222222')
    )

    await waitFor(() => {
      expect(props.onDuplicateDraft).toHaveBeenCalledWith(
        '22222222-2222-4222-8222-222222222222'
      )
    })
    expect(screen.queryByText('Draft CV')).not.toBeInTheDocument()
  })
})
