import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from '../App'
import { exportResumePdf } from '../services/export'
import { ResumeStorage } from '../services/storage'
import {
  createEmptyResumeData,
  type ResumeDraft
} from '../types/resume'

vi.mock('../services/apiClient', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/apiClient')>()
  return {
    ...actual,
    initAuthSession: vi.fn().mockResolvedValue('test-csrf-token')
  }
})

vi.mock('../services/ats', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/ats')>()
  return {
    ...actual,
    analyzeAtsStructure: vi.fn().mockResolvedValue({
      score: 88,
      grade: 'A',
      gradeCode: 'excellent',
      breakdown: {
        contact: 90,
        structure: 90,
        summary: 85,
        quantified_impact: 85,
        integrity: 90
      },
      checklist: [],
      recommendations: [],
      passedChecksCount: 10,
      totalChecksCount: 10,
      disclaimer: 'Test'
    })
  }
})

vi.mock('../services/export', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/export')>()
  return {
    ...actual,
    exportResumeDocx: vi.fn().mockResolvedValue(undefined),
    exportResumePdf: vi.fn().mockResolvedValue({ fallbackToPrint: false }),
    printResume: vi.fn()
  }
})

vi.mock('../components/builder/ImportResumeModal', async () => {
  const React = await import('react')
  const importedData = {
    contact: {
      fullName: 'Budi Santoso',
      headline: 'Software Engineer',
      email: 'budi@example.com',
      phone: '081234567890',
      location: 'Bandung',
      linkedin: '',
      website: '',
      websites: [],
      usePhoto: false,
      photoUrl: ''
    },
    summary:
      'Ringkasan baru hasil impor yang menjelaskan pengalaman membangun layanan backend, memimpin tim, dan meningkatkan keandalan sistem produksi secara terukur.',
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    customSections: [],
    sectionOrder: ['summary', 'experience', 'education', 'skills', 'languages', 'custom']
  }

  return {
    ImportResumeModal: ({
      isOpen,
      onApply,
      onClose
    }: {
      isOpen: boolean
      onApply: (data: typeof importedData, sections: string[], mode: string) => void
      onClose: () => void
    }) =>
      isOpen
        ? React.createElement(
            'div',
            { 'data-testid': 'stub-import-modal' },
            React.createElement(
              'button',
              {
                type: 'button',
                'data-testid': 'stub-apply-import',
                onClick: () => onApply(importedData, ['summary'], 'merge')
              },
              'Terapkan impor'
            ),
            React.createElement(
              'button',
              { type: 'button', onClick: onClose },
              'Tutup'
            )
          )
        : null
  }
})

const makeDraft = (): ResumeDraft => ({
  id: '77777777-7777-4777-8777-777777777777',
  title: 'CV Uji Integrasi',
  templateId: 'ats-clean',
  colorTheme: '#1e293b',
  fontFamily: 'sans',
  resumeLanguage: 'id',
  data: {
    ...createEmptyResumeData(),
    contact: {
      fullName: 'Budi Santoso',
      headline: 'Senior Software Engineer',
      email: 'budi.santoso@example.com',
      phone: '+6281234567890',
      location: 'Jakarta, Indonesia',
      linkedin: 'linkedin.com/in/budisantoso',
      website: 'budisantoso.dev',
      websites: ['budisantoso.dev'],
      usePhoto: false,
      photoUrl: ''
    },
    summary:
      'Software engineer dengan pengalaman lebih dari enam tahun membangun aplikasi web berskala besar. Terbiasa memimpin tim lintas fungsi, merancang arsitektur yang aman, dan meningkatkan keandalan layanan produksi secara terukur.',
    experiences: [
      {
        id: 'exp-1',
        jobTitle: 'Senior Software Engineer',
        company: 'PT Teknologi Nusantara',
        location: 'Jakarta',
        startDate: 'Jan 2021',
        endDate: '',
        current: true,
        description: '• Meningkatkan performa API 35%.\n• Memimpin tim berisi 6 engineer.'
      }
    ],
    education: [
      {
        id: 'edu-1',
        institution: 'Universitas Indonesia',
        degree: 'S1',
        fieldOfStudy: 'Ilmu Komputer',
        startDate: '2014',
        endDate: '2018',
        gpa: '3.70',
        description: 'Fokus pada rekayasa perangkat lunak dan sistem terdistribusi.'
      }
    ],
    skills: [
      { id: 'skill-1', name: 'TypeScript', category: 'Technical' },
      { id: 'skill-2', name: 'React', category: 'Technical' },
      { id: 'skill-3', name: 'Python', category: 'Technical' }
    ],
    languages: [
      { id: 'lang-1', language: 'Indonesia', proficiency: 'Native' },
      { id: 'lang-2', language: 'Inggris', proficiency: 'Professional' }
    ]
  },
  createdAt: 1,
  updatedAt: 1,
  version: 1
})

const waitForDraft = async () => {
  await waitFor(() => {
    expect(screen.getByTestId('input-draft-title')).toHaveValue('CV Uji Integrasi')
  })
}

describe('App integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await ResumeStorage.clearAllData()
    await ResumeStorage.saveDraft(makeDraft())
    window.location.hash = '#/builder'
  })

  afterEach(() => {
    window.location.hash = ''
  })

  it('membuka modal preflight dan mengekspor PDF dengan nama berkas yang dapat diedit', async () => {
    render(<App />)
    await waitForDraft()

    fireEvent.click(screen.getByTestId('btn-export-menu'))
    fireEvent.click(screen.getByTestId('btn-export-pdf'))

    expect(screen.getByTestId('export-modal')).toBeInTheDocument()
    const filenameInput = screen.getByTestId('input-export-filename')
    expect(filenameInput).toHaveValue('CV Uji Integrasi')

    fireEvent.change(filenameInput, {
      target: { value: 'CV Budi - Backend 2026' }
    })
    fireEvent.click(screen.getByTestId('btn-confirm-export'))

    await waitFor(() => {
      expect(vi.mocked(exportResumePdf)).toHaveBeenCalledWith(
        expect.objectContaining({ id: '77777777-7777-4777-8777-777777777777' }),
        'CV Budi - Backend 2026'
      )
    })
    await waitFor(() => {
      expect(screen.queryByTestId('export-modal')).not.toBeInTheDocument()
    })
  })

  it('menerapkan impor terpilih dan mengembalikan snapshot melalui toast undo', async () => {
    render(<App />)
    await waitForDraft()

    fireEvent.click(screen.getByTestId('tab-summary'))
    const summary = screen.getByTestId('textarea-summary')
    expect(summary).toHaveValue(
      'Software engineer dengan pengalaman lebih dari enam tahun membangun aplikasi web berskala besar. Terbiasa memimpin tim lintas fungsi, merancang arsitektur yang aman, dan meningkatkan keandalan layanan produksi secara terukur.'
    )

    fireEvent.click(screen.getByTestId('btn-open-import'))
    expect(screen.getByTestId('stub-import-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('stub-apply-import'))

    await waitFor(() => {
      expect(screen.getByTestId('textarea-summary')).toHaveValue(
        'Ringkasan baru hasil impor yang menjelaskan pengalaman membangun layanan backend, memimpin tim, dan meningkatkan keandalan sistem produksi secara terukur.'
      )
    })
    expect(screen.getByTestId('import-undo-toast')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-undo-import'))

    await waitFor(() => {
      expect(screen.getByTestId('textarea-summary')).toHaveValue(
        'Software engineer dengan pengalaman lebih dari enam tahun membangun aplikasi web berskala besar. Terbiasa memimpin tim lintas fungsi, merancang arsitektur yang aman, dan meningkatkan keandalan layanan produksi secara terukur.'
      )
    })
    expect(screen.queryByTestId('import-undo-toast')).not.toBeInTheDocument()
  })

  it('navigasi Sebelumnya/Berikutnya berpindah bagian dan langkah terakhir membuka ekspor', async () => {
    render(<App />)
    await waitForDraft()

    expect(screen.getByTestId('btn-section-prev')).toBeDisabled()
    expect(screen.getByTestId('tab-contact')).toHaveAttribute('aria-current', 'step')

    fireEvent.click(screen.getByTestId('btn-section-next'))
    expect(screen.getByTestId('tab-summary')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByTestId('textarea-summary')).toBeInTheDocument()
    expect(screen.getByText(/Langkah 2 dari 7/)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-section-prev'))
    expect(screen.getByTestId('tab-contact')).toHaveAttribute('aria-current', 'step')

    fireEvent.click(screen.getByTestId('tab-custom'))
    expect(screen.queryByTestId('btn-section-next')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-section-finish'))
    expect(screen.getByTestId('export-modal')).toBeInTheDocument()
  })

  it('menutup menu unduh dengan Escape dan klik di luar', async () => {
    render(<App />)
    await waitForDraft()

    fireEvent.click(screen.getByTestId('btn-export-menu'))
    expect(screen.getByTestId('btn-export-pdf')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('btn-export-pdf')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-export-menu'))
    expect(screen.getByTestId('btn-export-pdf')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('btn-export-pdf')).not.toBeInTheDocument()
  })

  it('workspace Alat Dokumen mengelompokkan kartu dan mendukung pencarian', async () => {
    window.location.hash = '#/tools'
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Konversi' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kelola PDF' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Keamanan & Tanda Tangan' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gambar' })).toBeInTheDocument()

    const search = screen.getByTestId('input-search-tools')
    fireEvent.change(search, { target: { value: 'ocr' } })
    expect(screen.getByRole('heading', { name: 'OCR PDF' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Split PDF' })).not.toBeInTheDocument()

    fireEvent.change(search, { target: { value: 'tidak-ada-alat-xyz' } })
    expect(screen.getByTestId('tools-empty')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hapus pencarian alat' }))
    expect(screen.getByRole('heading', { name: 'Split PDF' })).toBeInTheDocument()
  })
})
