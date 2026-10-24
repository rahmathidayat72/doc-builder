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
    resumeLanguage: 'id',
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
      ],
      customSections: [
        {
          id: 'custom-1',
          sectionTitle: 'Sertifikasi',
          items: [
            {
              id: 'custom-item-1',
              title: 'AWS Certified Developer',
              subtitle: 'Amazon Web Services',
              date: '2025',
              description: 'Validasi kompetensi pengembangan aplikasi cloud.'
            }
          ]
        }
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
    expect(screen.getByText('AWS Certified Developer')).toBeInTheDocument()
  })

  it('AtsModernTemplate merender tata letak 1-kolom kontemporer', () => {
    render(<AtsModernTemplate draft={sampleDraft} />)
    expect(screen.getByTestId('template-ats-modern')).toBeInTheDocument()
    expect(screen.getByText('Dewi Sartika')).toBeInTheDocument()
    expect(screen.getByText('Lead Software Architect')).toBeInTheDocument()
    expect(screen.getByText('AWS Certified Developer')).toBeInTheDocument()
  })

  it('VisualExecutiveTemplate merender tata letak 2-kolom sidebar', () => {
    render(<VisualExecutiveTemplate draft={sampleDraft} />)
    expect(screen.getByTestId('template-visual-executive')).toBeInTheDocument()
    expect(screen.getByText('Dewi Sartika')).toBeInTheDocument()
    expect(screen.getByText('Profil Profesional')).toBeInTheDocument()
    expect(screen.getByText('AWS Certified Developer')).toBeInTheDocument()
  })

  it('VisualMinimalTemplate merender tata letak minimalis elegan', () => {
    render(<VisualMinimalTemplate draft={sampleDraft} />)
    expect(screen.getByTestId('template-visual-minimal')).toBeInTheDocument()
    expect(screen.getByText('Dewi Sartika')).toBeInTheDocument()
    expect(screen.getByText('Tentang Saya')).toBeInTheDocument()
    expect(screen.getByText('AWS Certified Developer')).toBeInTheDocument()
  })

  it('ResumePreview berganti template secara dinamis saat templateId berubah', () => {
    const { rerender } = render(<ResumePreview draft={{ ...sampleDraft, templateId: 'ats-clean' }} />)
    expect(screen.getByTestId('template-ats-clean')).toBeInTheDocument()

    rerender(<ResumePreview draft={{ ...sampleDraft, templateId: 'visual-executive' }} />)
    expect(screen.getByTestId('template-visual-executive')).toBeInTheDocument()
    expect(screen.queryByTestId('template-ats-clean')).not.toBeInTheDocument()
  })

  it('merender label dalam bahasa Inggris saat resumeLanguage bernilai en', () => {
    const enDraft: ResumeDraft = {
      ...sampleDraft,
      resumeLanguage: 'en',
      templateId: 'ats-clean'
    }
    render(<AtsCleanTemplate draft={enDraft} />)
    expect(screen.getByText('Professional Summary')).toBeInTheDocument()
    expect(screen.getByText('Work Experience')).toBeInTheDocument()
    expect(screen.getByText('Education')).toBeInTheDocument()
    expect(screen.getByText('Skills & Competencies')).toBeInTheDocument()
    expect(screen.getByText('Language Proficiency')).toBeInTheDocument()
    expect(screen.getByText(/in Teknik Informatika/)).toBeInTheDocument()
  })

  it('merender label dalam bahasa Indonesia secara default saat resumeLanguage tidak disetel atau bernilai id', () => {
    const idDraft: ResumeDraft = {
      ...sampleDraft,
      resumeLanguage: 'id',
      templateId: 'ats-clean'
    }
    render(<AtsCleanTemplate draft={idDraft} />)
    expect(screen.getByText('Ringkasan Profesional')).toBeInTheDocument()
    expect(screen.getByText('Pengalaman Kerja')).toBeInTheDocument()
    expect(screen.getByText('Pendidikan')).toBeInTheDocument()
    expect(screen.getByText('Keahlian & Kompetensi')).toBeInTheDocument()
    expect(screen.getByText('Kemampuan Bahasa')).toBeInTheDocument()
    expect(screen.getByText(/dalam Teknik Informatika/)).toBeInTheDocument()
  })

  it('merender periode pendidikan tahun tunggal tanpa tanda minus gantung di semua template', () => {
    const singleYearDraft: ResumeDraft = {
      ...sampleDraft,
      data: {
        ...sampleDraft.data,
        education: [
          {
            id: 'edu-single',
            institution: 'SMA Negeri 1 Cileungsi',
            degree: 'SMA',
            fieldOfStudy: 'IPA',
            startDate: '',
            endDate: '2015',
            gpa: '',
            description: ''
          }
        ]
      }
    }

    const { unmount: u1 } = render(<AtsCleanTemplate draft={{ ...singleYearDraft, templateId: 'ats-clean' }} />)
    expect(screen.getByText('2015')).toBeInTheDocument()
    expect(screen.queryByText(/-\s*2015/)).not.toBeInTheDocument()
    expect(screen.queryByText(/2015\s*-/)).not.toBeInTheDocument()
    u1()

    const { unmount: u2 } = render(<AtsModernTemplate draft={{ ...singleYearDraft, templateId: 'ats-modern' }} />)
    expect(screen.getByText('2015')).toBeInTheDocument()
    expect(screen.queryByText(/-\s*2015/)).not.toBeInTheDocument()
    expect(screen.queryByText(/2015\s*-/)).not.toBeInTheDocument()
    u2()

    const { unmount: u3 } = render(<VisualExecutiveTemplate draft={{ ...singleYearDraft, templateId: 'visual-executive' }} />)
    expect(screen.getByText('2015')).toBeInTheDocument()
    expect(screen.queryByText(/-\s*2015/)).not.toBeInTheDocument()
    expect(screen.queryByText(/2015\s*-/)).not.toBeInTheDocument()
    u3()

    const { unmount: u4 } = render(<VisualMinimalTemplate draft={{ ...singleYearDraft, templateId: 'visual-minimal' }} />)
    expect(screen.getByText('2015')).toBeInTheDocument()
    expect(screen.queryByText(/—\s*2015/)).not.toBeInTheDocument()
    expect(screen.queryByText(/2015\s*—/)).not.toBeInTheDocument()
    u4()
  })

  it('merender foto profil secara adaptif di 4 template saat usePhoto aktif', () => {
    const photoDraft: ResumeDraft = {
      ...sampleDraft,
      data: {
        ...sampleDraft.data,
        contact: {
          ...sampleDraft.data.contact,
          usePhoto: true,
          photoUrl: 'data:image/jpeg;base64,sample-photo-data'
        }
      }
    }

    const { unmount: u1 } = render(<AtsCleanTemplate draft={{ ...photoDraft, templateId: 'ats-clean' }} />)
    expect(screen.getByTestId('preview-photo')).toHaveAttribute('src', 'data:image/jpeg;base64,sample-photo-data')
    u1()

    const { unmount: u2 } = render(<AtsModernTemplate draft={{ ...photoDraft, templateId: 'ats-modern' }} />)
    expect(screen.getByTestId('preview-photo')).toHaveAttribute('src', 'data:image/jpeg;base64,sample-photo-data')
    u2()

    const { unmount: u3 } = render(<VisualExecutiveTemplate draft={{ ...photoDraft, templateId: 'visual-executive' }} />)
    expect(screen.getByTestId('preview-photo')).toHaveAttribute('src', 'data:image/jpeg;base64,sample-photo-data')
    u3()

    const { unmount: u4 } = render(<VisualMinimalTemplate draft={{ ...photoDraft, templateId: 'visual-minimal' }} />)
    expect(screen.getByTestId('preview-photo')).toHaveAttribute('src', 'data:image/jpeg;base64,sample-photo-data')
    u4()
  })

  it('tidak merender foto profil jika usePhoto bernilai false', () => {
    const noPhotoDraft: ResumeDraft = {
      ...sampleDraft,
      data: {
        ...sampleDraft.data,
        contact: {
          ...sampleDraft.data.contact,
          usePhoto: false,
          photoUrl: 'data:image/jpeg;base64,sample-photo-data'
        }
      }
    }

    const { unmount: u1 } = render(<AtsCleanTemplate draft={{ ...noPhotoDraft, templateId: 'ats-clean' }} />)
    expect(screen.queryByTestId('preview-photo')).not.toBeInTheDocument()
    u1()

    const { unmount: u2 } = render(<AtsModernTemplate draft={{ ...noPhotoDraft, templateId: 'ats-modern' }} />)
    expect(screen.queryByTestId('preview-photo')).not.toBeInTheDocument()
    u2()

    const { unmount: u3 } = render(<VisualExecutiveTemplate draft={{ ...noPhotoDraft, templateId: 'visual-executive' }} />)
    expect(screen.queryByTestId('preview-photo')).not.toBeInTheDocument()
    u3()

    const { unmount: u4 } = render(<VisualMinimalTemplate draft={{ ...noPhotoDraft, templateId: 'visual-minimal' }} />)
    expect(screen.queryByTestId('preview-photo')).not.toBeInTheDocument()
    u4()
  })
})
