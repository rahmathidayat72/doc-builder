import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AtsCleanTemplate } from '../AtsClean'
import { AtsModernTemplate } from '../AtsModern'
import { VisualExecutiveTemplate } from '../VisualExecutive'
import { VisualMinimalTemplate } from '../VisualMinimal'
import { TEMPLATES, getTemplateComponent } from '../registry'
import { ResumePreview } from '../../components/preview/ResumePreview'
import { type ResumeDraft, createEmptyResumeData } from '../../types/resume'

describe('Template Registry & Rendering Suite (2 ATS + 2 Visual)', () => {
  const sampleDraft: ResumeDraft = {
    id: '66666666-6666-4666-8666-666666666666',
    title: 'Resume Pengujian Template',
    templateId: 'ats-clean',
    colorTheme: '#0284c7',
    fontFamily: 'sans',
    data: {
      ...createEmptyResumeData(),
      contact: {
        fullName: 'Dewi Sartika',
        email: 'dewi.sartika@example.com',
        phone: '08129876543',
        location: 'Bandung, Indonesia',
        linkedin: 'linkedin.com/in/dewisartika',
        website: 'dewisartika.id'
      },
      summary: 'Spesialis transformasi digital dan arsitektur dokumen modern.',
      experiences: [
        {
          id: 'exp-1',
          jobTitle: 'Lead Software Architect',
          company: 'PT Inovasi Nusantara',
          location: 'Jakarta',
          startDate: 'Jan 2022',
          endDate: 'Sekarang',
          current: true,
          description: '• Memimpin orkestrasi microservices dan pipeline data terpusat.'
        }
      ],
      education: [
        {
          id: 'edu-1',
          institution: 'Institut Teknologi Bandung',
          degree: 'S1',
          fieldOfStudy: 'Teknik Informatika',
          startDate: '2016',
          endDate: '2020',
          gpa: '3.90',
          description: ''
        }
      ],
      skills: [
        { id: 'sk-1', name: 'TypeScript', category: 'Technical' },
        { id: 'sk-2', name: 'FastAPI', category: 'Technical' }
      ],
      languages: [
        { id: 'lang-1', language: 'Bahasa Indonesia', proficiency: 'Native' },
        { id: 'lang-2', language: 'English', proficiency: 'Professional' }
      ]
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1
  }

  it('registry memuat tepat 4 template awal (2 ATS + 2 Visual)', () => {
    expect(TEMPLATES).toHaveLength(4)
    const atsTemplates = TEMPLATES.filter(t => t.category === 'ats')
    const visualTemplates = TEMPLATES.filter(t => t.category === 'visual')
    expect(atsTemplates).toHaveLength(2)
    expect(visualTemplates).toHaveLength(2)
  })

  it('getTemplateComponent mengembalikan komponen yang sesuai dan fallback ke AtsClean', () => {
    expect(getTemplateComponent('ats-clean')).toBe(AtsCleanTemplate)
    expect(getTemplateComponent('ats-modern')).toBe(AtsModernTemplate)
    expect(getTemplateComponent('visual-executive')).toBe(VisualExecutiveTemplate)
    expect(getTemplateComponent('visual-minimal')).toBe(VisualMinimalTemplate)
    expect(getTemplateComponent('unknown-id')).toBe(AtsCleanTemplate)
  })

  it('AtsCleanTemplate merender tata letak 1-kolom klasik', () => {
    render(<AtsCleanTemplate draft={sampleDraft} />)
    expect(screen.getByTestId('template-ats-clean')).toBeInTheDocument()
    expect(screen.getByText('Dewi Sartika')).toBeInTheDocument()
    expect(screen.getByText('Lead Software Architect')).toBeInTheDocument()
    expect(screen.getByText('Institut Teknologi Bandung')).toBeInTheDocument()
  })

  it('AtsModernTemplate merender tata letak 1-kolom kontemporer', () => {
    render(<AtsModernTemplate draft={sampleDraft} />)
    expect(screen.getByTestId('template-ats-modern')).toBeInTheDocument()
    expect(screen.getByText('Dewi Sartika')).toBeInTheDocument()
    expect(screen.getByText('Lead Software Architect')).toBeInTheDocument()
  })

  it('VisualExecutiveTemplate merender tata letak 2-kolom sidebar', () => {
    render(<VisualExecutiveTemplate draft={sampleDraft} />)
    expect(screen.getByTestId('template-visual-executive')).toBeInTheDocument()
    expect(screen.getByText('Dewi Sartika')).toBeInTheDocument()
    expect(screen.getByText('Profil Profesional')).toBeInTheDocument()
  })

  it('VisualMinimalTemplate merender tata letak minimalis elegan', () => {
    render(<VisualMinimalTemplate draft={sampleDraft} />)
    expect(screen.getByTestId('template-visual-minimal')).toBeInTheDocument()
    expect(screen.getByText('Dewi Sartika')).toBeInTheDocument()
    expect(screen.getByText('Tentang Saya')).toBeInTheDocument()
  })

  it('ResumePreview berganti template secara dinamis saat templateId berubah', () => {
    const { rerender } = render(<ResumePreview draft={{ ...sampleDraft, templateId: 'ats-clean' }} />)
    expect(screen.getByTestId('template-ats-clean')).toBeInTheDocument()

    rerender(<ResumePreview draft={{ ...sampleDraft, templateId: 'visual-executive' }} />)
    expect(screen.getByTestId('template-visual-executive')).toBeInTheDocument()
    expect(screen.queryByTestId('template-ats-clean')).not.toBeInTheDocument()
  })
})
