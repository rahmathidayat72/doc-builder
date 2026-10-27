import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ExportResumeModal } from '../ExportResumeModal'
import { type ResumeDraft, createEmptyResumeData } from '../../../types/resume'

const createDraft = (): ResumeDraft => ({
  id: '22222222-2222-4222-8222-222222222222',
  title: 'CV Budi Santoso',
  templateId: 'ats-clean',
  colorTheme: '#1e293b',
  fontFamily: 'sans',
  resumeLanguage: 'id',
  data: {
    ...createEmptyResumeData(),
    contact: {
      fullName: 'Budi Santoso',
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
        endDate: 'Des 2024',
        current: false,
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
        description: ''
      }
    ],
    skills: [
      { id: 'skill-1', name: 'TypeScript', category: 'General' },
      { id: 'skill-2', name: 'React', category: 'General' },
      { id: 'skill-3', name: 'PostgreSQL', category: 'General' }
    ],
    languages: [
      { id: 'lang-1', language: 'Bahasa Indonesia', proficiency: 'Native / Bilingual' }
    ],
    customSections: []
  },
  createdAt: 1,
  updatedAt: 1,
  version: 1
})

const renderModal = (overrides: Partial<ComponentProps<typeof ExportResumeModal>> = {}) => {
  const props: ComponentProps<typeof ExportResumeModal> = {
    isOpen: true,
    draft: createDraft(),
    pageCount: 1,
    initialFormat: 'pdf',
    onClose: vi.fn(),
    onExport: vi.fn().mockResolvedValue(undefined),
    onFixIssue: vi.fn(),
    ...overrides
  }
  return { ...render(<ExportResumeModal {...props} />), props }
}

describe('ExportResumeModal', () => {
  it('menampilkan status halaman, skor, dan nama berkas awal', () => {
    renderModal()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('export-page-count')).toHaveTextContent('1')
    expect(screen.getByTestId('export-quality-score')).toHaveTextContent('100/100')
    expect(screen.getByTestId('input-export-filename')).toHaveValue('CV Budi Santoso')
    expect(screen.getByTestId('btn-confirm-export')).toBeEnabled()
  })

  it('memanggil ekspor dengan format dan nama berkas yang sudah dibersihkan', async () => {
    const { props } = renderModal()

    fireEvent.change(screen.getByTestId('input-export-filename'), {
      target: { value: 'CV: Budi/2026.pdf' }
    })
    fireEvent.click(screen.getByTestId('export-format-docx'))
    fireEvent.click(screen.getByTestId('btn-confirm-export'))

    await waitFor(() => {
      expect(props.onExport).toHaveBeenCalledWith('docx', 'CV Budi 2026')
    })
  })

  it('memblokir ekspor saat ada error dan menyediakan tombol perbaiki', () => {
    const draft = createDraft()
    draft.data.contact.fullName = ''
    const { props } = renderModal({ draft })

    expect(screen.getByText(/Nama lengkap belum diisi/i)).toBeInTheDocument()
    expect(screen.getByTestId('btn-confirm-export')).toBeDisabled()

    fireEvent.click(screen.getByTestId('btn-fix-required-full-name'))
    expect(props.onFixIssue).toHaveBeenCalledWith('contact')
  })

  it('mewajibkan konfirmasi peringatan sebelum ekspor', async () => {
    const draft = createDraft()
    draft.data.contact.phone = ''
    const { props } = renderModal({ draft })

    expect(screen.getByTestId('btn-confirm-export')).toBeDisabled()
    fireEvent.click(screen.getByTestId('checkbox-ack-warnings'))
    expect(screen.getByTestId('btn-confirm-export')).toBeEnabled()

    fireEvent.click(screen.getByTestId('btn-confirm-export'))
    await waitFor(() => {
      expect(props.onExport).toHaveBeenCalledWith('pdf', 'CV Budi Santoso')
    })
  })

  it('menampilkan pesan kesalahan ketika proses ekspor gagal', async () => {
    const onExport = vi.fn().mockRejectedValue(new Error('Backend tidak tersedia'))
    renderModal({ onExport })

    fireEvent.click(screen.getByTestId('btn-confirm-export'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend tidak tersedia')
  })
})
