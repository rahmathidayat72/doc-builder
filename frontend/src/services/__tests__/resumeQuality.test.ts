import { describe, expect, it } from 'vitest'
import { analyzeResumeQuality } from '../resumeQuality'
import { type ResumeDraft, createEmptyResumeData } from '../../types/resume'

const createDraft = (overrides: Partial<ResumeDraft> = {}): ResumeDraft => ({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'CV Profesional',
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
  version: 1,
  ...overrides
})

describe('Resume pre-export quality analysis', () => {
  it('menandai draft kosong sebagai error yang memblokir ekspor', () => {
    const draft = createDraft()
    draft.data = createEmptyResumeData()

    const report = analyzeResumeQuality(draft, { pageCount: 1 })

    expect(report.score).toBe(0)
    expect(report.errors).toHaveLength(1)
    expect(report.errors[0].id).toBe('draft-empty')
  })

  it('lolos tanpa error maupun peringatan untuk CV yang lengkap', () => {
    const report = analyzeResumeQuality(createDraft(), { pageCount: 1 })

    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
    expect(report.score).toBe(100)
    expect(report.pageCount).toBe(1)
  })

  it('menolak email tidak valid dan entri pengalaman kosong', () => {
    const draft = createDraft()
    draft.data.contact.email = 'bukan-email'
    draft.data.experiences.push({
      id: 'exp-empty',
      jobTitle: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: ''
    })

    const report = analyzeResumeQuality(draft)

    expect(report.errors.map(issue => issue.id)).toEqual(
      expect.arrayContaining(['invalid-email', 'empty-experience-exp-empty'])
    )
    expect(report.score).toBeLessThan(100)
  })

  it('memberi peringatan untuk tanggal terbalik, skill duplikat, dan CV lebih dari dua halaman', () => {
    const draft = createDraft()
    draft.data.experiences[0].startDate = '2024'
    draft.data.experiences[0].endDate = '2020'
    draft.data.skills.push({ id: 'skill-duplicate', name: 'react', category: 'General' })

    const report = analyzeResumeQuality(draft, { pageCount: 3 })
    const warningIds = report.warnings.map(issue => issue.id)

    expect(warningIds).toContain('invalid-experience-date-exp-1')
    expect(warningIds).toContain('duplicate-skill-skill-duplicate')
    expect(warningIds).toContain('too-many-pages')
    expect(report.errors).toEqual([])
  })

  it('memberi peringatan foto pada template ATS', () => {
    const draft = createDraft()
    draft.data.contact.usePhoto = true
    draft.data.contact.photoUrl = 'data:image/jpeg;base64,AAAA'

    const report = analyzeResumeQuality(draft)

    expect(report.warnings.map(issue => issue.id)).toContain('ats-photo')
  })
})
