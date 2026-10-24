import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { JobMatchModal } from '../JobMatchModal'
import { matchResumeToJobClientFallback } from '../../../services/ats'
import { type ResumeDraft, createEmptyResumeData } from '../../../types/resume'

describe('JobMatchModal & Client-Side Job Matching Suite', () => {
  const sampleDraft: ResumeDraft = {
    id: '77777777-7777-4777-8777-777777777777',
    title: 'Resume Developer',
    templateId: 'ats-clean',
    colorTheme: '#1e293b',
    fontFamily: 'sans',
    resumeLanguage: 'id',
    data: {
      ...createEmptyResumeData(),
      contact: {
        fullName: 'Hadi Gunawan',
        email: 'hadi@example.com',
        phone: '08123456789',
        location: 'Jakarta',
        linkedin: '',
        website: ''
      },
      summary: 'Backend Engineer mahir Python, FastAPI, dan PostgreSQL.',
      experiences: [
        {
          id: '1',
          jobTitle: 'Backend Engineer',
          company: 'PT Digital Tech',
          location: 'Jakarta',
          startDate: '2021',
          endDate: 'Sekarang',
          current: true,
          description: '• Membangun REST API dengan FastAPI dan PostgreSQL.\n• Berpengalaman dengan Git.'
        }
      ],
      skills: [
        { id: '1', name: 'Python', category: 'Technical' },
        { id: '2', name: 'FastAPI', category: 'Technical' },
        { id: '3', name: 'PostgreSQL', category: 'Technical' },
        { id: '4', name: 'Git', category: 'Tools' }
      ]
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1
  }

  const sampleJobText = `
    Dibutuhkan Senior Backend Engineer.
    Kualifikasi:
    - Menguasai Python dan FastAPI.
    - Mahir PostgreSQL dan Git.
    - Pengalaman dengan Docker dan Redis adalah nilai tambah.
  `

  it('matchResumeToJobClientFallback menghitung kecocokan dan mengidentifikasi missing skills', () => {
    const result = matchResumeToJobClientFallback(sampleDraft, sampleJobText)
    expect(result.match_score).toBeGreaterThan(50)
    expect(result.matched_skills).toContain('python')
    expect(result.matched_skills).toContain('fastapi')
    expect(result.matched_skills).toContain('postgresql')
    expect(result.missing_skills).toContain('docker')
    expect(result.missing_skills).toContain('redis')
    expect(result.advice.length).toBeGreaterThanOrEqual(1)
  })

  it('JobMatchModal tidak me-render saat isOpen bernilai false', () => {
    const { container } = render(
      <JobMatchModal draft={sampleDraft} isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('JobMatchModal merender input deskripsi pekerjaan saat isOpen bernilai true', () => {
    render(
      <JobMatchModal draft={sampleDraft} isOpen={true} onClose={vi.fn()} />
    )

    expect(screen.getByText(/Pencocokan Lowongan Kerja/i)).toBeInTheDocument()
    expect(screen.getByTestId('textarea-job-desc')).toBeInTheDocument()
    expect(screen.getByTestId('btn-run-match')).toBeInTheDocument()
  })

  it('menekan tombol contoh lowongan mengisi teks deskripsi lowongan', () => {
    render(
      <JobMatchModal draft={sampleDraft} isOpen={true} onClose={vi.fn()} />
    )

    const btnSample = screen.getByText(/\+ Masukkan Contoh Lowongan/i)
    fireEvent.click(btnSample)

    const textarea = screen.getByTestId('textarea-job-desc') as HTMLTextAreaElement
    expect(textarea.value).toContain('Dibutuhkan Senior Backend Engineer')
  })

  it('menutup modal memicu callback onClose', () => {
    const mockClose = vi.fn()
    render(
      <JobMatchModal draft={sampleDraft} isOpen={true} onClose={mockClose} />
    )

    const btnClose = screen.getByTestId('btn-close-job-match')
    fireEvent.click(btnClose)
    expect(mockClose).toHaveBeenCalledTimes(1)
  })
})
