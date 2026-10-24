import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AtsScorePanel } from '../AtsScorePanel'
import { evaluateAtsClientFallback } from '../../../services/ats'
import { type ResumeDraft, createEmptyResumeData } from '../../../types/resume'

describe('AtsScorePanel & Client-Side ATS Evaluation Suite', () => {
  const sampleCompleteDraft: ResumeDraft = {
    id: '88888888-8888-4888-8888-888888888888',
    title: 'Resume Lengkap',
    templateId: 'ats-clean',
    colorTheme: '#1e293b',
    fontFamily: 'sans',
    resumeLanguage: 'id',
    data: {
      ...createEmptyResumeData(),
      contact: {
        fullName: 'Budi Hartono',
        email: 'budi.hartono@example.com',
        phone: '081234567890',
        location: 'Jakarta, Indonesia',
        linkedin: '',
        website: ''
      },
      summary:
        'Software Engineer berdedikasi dengan 5 tahun pengalaman membangun layanan ' +
        'backend berskala tinggi dengan Python dan TypeScript. Berpengalaman dalam optimasi ' +
        'database PostgreSQL, arsitektur microservices, automated testing, dan orkestrasi ' +
        'container Docker di lingkungan cloud modern.',
      experiences: [
        {
          id: '1',
          jobTitle: 'Senior Backend Engineer',
          company: 'PT Solusi Digital',
          location: 'Jakarta',
          startDate: '2021',
          endDate: 'Sekarang',
          current: true,
          description: '• Meningkatkan throughput transaksi sebesar 40%.\n• Mengurangi waktu respon API sebesar 25%.'
        },
        {
          id: '2',
          jobTitle: 'Backend Engineer',
          company: 'PT Finansial Maju',
          location: 'Jakarta',
          startDate: '2019',
          endDate: '2021',
          current: false,
          description: '• Mengelola 15 microservices dengan ketersediaan 99.9%.\n• Memangkas biaya cloud 20%.'
        }
      ],
      education: [
        {
          id: '1',
          institution: 'Universitas Indonesia',
          degree: 'S1',
          fieldOfStudy: 'Ilmu Komputer',
          startDate: '2015',
          endDate: '2019',
          gpa: '3.85',
          description: ''
        }
      ],
      skills: [
        { id: '1', name: 'Python', category: 'Technical' },
        { id: '2', name: 'TypeScript', category: 'Technical' },
        { id: '3', name: 'FastAPI', category: 'Technical' },
        { id: '4', name: 'Docker', category: 'Tools' }
      ]
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1
  }

  const sampleEmptyDraft: ResumeDraft = {
    id: '99999999-9999-4999-8999-999999999999',
    title: 'Resume Kosong',
    templateId: 'ats-clean',
    colorTheme: '#1e293b',
    fontFamily: 'sans',
    resumeLanguage: 'id',
    data: createEmptyResumeData(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1
  }

  it('evaluateAtsClientFallback menghasilkan skor tinggi (>= 85) untuk resume lengkap', () => {
    const analysis = evaluateAtsClientFallback(sampleCompleteDraft)
    expect(analysis.score).toBeGreaterThanOrEqual(85)
    expect(analysis.gradeCode).toBe('A')
    expect(analysis.breakdown.contact).toBe(25)
    expect(analysis.breakdown.structure).toBe(25)
    expect(analysis.breakdown.quantified_impact).toBe(20)
    expect(analysis.recommendations).toHaveLength(0)
  })

  it('evaluateAtsClientFallback mendeteksi kekurangan data pada resume kosong', () => {
    const analysis = evaluateAtsClientFallback(sampleEmptyDraft)
    expect(analysis.score).toBeLessThan(40)
    expect(analysis.gradeCode).toBe('D')
    expect(analysis.recommendations.length).toBeGreaterThanOrEqual(3)
  })

  it('AtsScorePanel tidak me-render saat isOpen bernilai false', () => {
    const analysis = evaluateAtsClientFallback(sampleCompleteDraft)
    const { container } = render(
      <AtsScorePanel analysis={analysis} isOpen={false} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('AtsScorePanel merender dialog, skor, grade, rincian 5 pilar, dan disclaimer saat terbuka', () => {
    const analysis = evaluateAtsClientFallback(sampleCompleteDraft)
    const mockClose = vi.fn()

    render(<AtsScorePanel analysis={analysis} isOpen={true} onClose={mockClose} />)

    expect(screen.getByRole('dialog', { name: /Evaluasi Keterbacaan ATS/i })).toBeInTheDocument()
    expect(screen.getByTestId('ats-score-number')).toHaveTextContent(analysis.score.toString())
    expect(screen.getByText(/Rincian 5 Pilar Penilaian/i)).toBeInTheDocument()
    expect(screen.getByText(/Skor ATS bersifat heuristik/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tutup evaluasi ATS/i })).toHaveAttribute('aria-label')

    fireEvent.click(screen.getByTestId('btn-close-ats'))
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('CTA perbaikan membuka editor dan Escape menutup dialog', () => {
    const analysis = evaluateAtsClientFallback(sampleEmptyDraft)
    const mockClose = vi.fn()
    const mockEditResume = vi.fn()

    render(
      <AtsScorePanel
        analysis={analysis}
        isOpen={true}
        onClose={mockClose}
        onEditResume={mockEditResume}
      />
    )

    expect(screen.getByText(/Perbaiki ini lebih dulu/i)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-edit-resume'))
    expect(mockEditResume).toHaveBeenCalledTimes(1)
    expect(mockClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockClose).toHaveBeenCalledTimes(2)
  })

  it('filter checklist (Semua, Perlu Cek, Lolos) menyaring daftar item dengan tepat', () => {
    const analysis = evaluateAtsClientFallback(sampleEmptyDraft)

    render(<AtsScorePanel analysis={analysis} isOpen={true} onClose={vi.fn()} />)

    const btnFailed = screen.getByRole('button', { name: /Perlu Cek/i })
    fireEvent.click(btnFailed)

    expect(screen.getByText(/Alamat Email Belum Lengkap/i)).toBeInTheDocument()
  })
})
