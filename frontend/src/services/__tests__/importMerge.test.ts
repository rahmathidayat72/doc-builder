import { describe, it, expect } from 'vitest'
import {
  applyImportedResumeData,
  type ImportSectionId
} from '../importMerge'
import { createEmptyResumeData, type ResumeData } from '../../types/resume'

const makeData = (overrides: Partial<ResumeData> = {}): ResumeData => ({
  ...createEmptyResumeData(),
  contact: {
    fullName: 'Budi Santoso',
    headline: 'Backend Engineer',
    email: 'budi@example.com',
    phone: '08123456789',
    location: 'Jakarta',
    linkedin: 'linkedin.com/in/budi',
    website: 'budi.dev',
    websites: ['budi.dev'],
    usePhoto: true,
    photoUrl: 'data:image/jpeg;base64,photo'
  },
  summary: 'Ringkasan lama yang tetap dipertahankan.',
  experiences: [
    {
      id: 'exp-1',
      jobTitle: 'Backend Engineer',
      company: 'PT Lama',
      location: 'Jakarta',
      startDate: 'Jan 2020',
      endDate: 'Des 2021',
      current: false,
      description: '',
      achievements: ['Membangun API lama']
    }
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'Universitas Lama',
      degree: 'S1',
      fieldOfStudy: 'Informatika',
      startDate: '2015',
      endDate: '2019',
      gpa: '3.5',
      description: ''
    }
  ],
  skills: [
    { id: 'skill-1', name: 'Python', category: 'Technical' },
    { id: 'skill-2', name: 'Git', category: 'Tools' }
  ],
  languages: [{ id: 'lang-1', language: 'Indonesia', proficiency: 'Native' }],
  customSections: [
    {
      id: 'custom-1',
      sectionTitle: 'Sertifikasi',
      items: [
        {
          id: 'item-1',
          title: 'AWS Certified',
          subtitle: 'AWS',
          date: '2024',
          description: ''
        }
      ]
    }
  ],
  ...overrides
})

describe('applyImportedResumeData', () => {
  it('menggabungkan bagian terpilih tanpa menghapus data lama dan tanpa duplikasi', () => {
    const current = makeData()
    const imported = makeData({
      contact: {
        ...makeData().contact,
        fullName: 'Budi Santoso Baru',
        email: '',
        websites: ['baru.dev'],
        usePhoto: false,
        photoUrl: ''
      },
      summary: '',
      experiences: [
        {
          id: 'exp-import-1',
          jobTitle: 'Backend Engineer',
          company: 'PT Lama',
          location: 'Jakarta',
          startDate: 'Jan 2020',
          endDate: 'Des 2021',
          current: false,
          description: '',
          achievements: ['Duplikat tidak boleh masuk']
        },
        {
          id: 'exp-import-2',
          jobTitle: 'Senior Backend Engineer',
          company: 'PT Baru',
          location: 'Bandung',
          startDate: 'Feb 2022',
          endDate: 'Sekarang',
          current: true,
          description: '',
          achievements: ['Memimpin migrasi layanan']
        }
      ],
      skills: [
        { id: 'skill-import-1', name: 'python', category: 'Technical' },
        { id: 'skill-import-2', name: 'Docker', category: 'Tools' }
      ],
      languages: [{ id: 'lang-import-1', language: 'English', proficiency: 'Professional' }],
      customSections: [
        {
          id: 'custom-import-1',
          sectionTitle: 'Sertifikasi',
          items: [
            {
              id: 'item-import-1',
              title: 'AWS Certified',
              subtitle: 'AWS',
              date: '2024',
              description: ''
            },
            {
              id: 'item-import-2',
              title: 'TOGAF',
              subtitle: 'Open Group',
              date: '2025',
              description: ''
            }
          ]
        }
      ]
    })

    const selected: ImportSectionId[] = [
      'experiences',
      'skills',
      'languages',
      'customSections'
    ]
    const result = applyImportedResumeData(current, imported, selected, 'merge')

    expect(result.contact.fullName).toBe('Budi Santoso')
    expect(result.summary).toBe(current.summary)
    expect(result.experiences).toHaveLength(2)
    expect(result.experiences[1].company).toBe('PT Baru')
    expect(result.skills.map(item => item.name)).toEqual(['Python', 'Git', 'Docker'])
    expect(result.languages.map(item => item.language)).toEqual(['Indonesia', 'English'])
    expect(result.customSections[0].items).toHaveLength(2)
    expect(result.customSections[0].items[1].title).toBe('TOGAF')
    expect(current.skills).toHaveLength(2)
  })

  it('menimpa hanya bagian terpilih dan mempertahankan foto profil', () => {
    const current = makeData()
    const imported = makeData({
      contact: {
        fullName: 'Nama Impor',
        headline: 'Cloud Architect',
        email: 'impor@example.com',
        phone: '',
        location: 'Surabaya',
        linkedin: '',
        website: '',
        websites: [],
        usePhoto: false,
        photoUrl: ''
      },
      summary: 'Ringkasan dari hasil impor.',
      education: []
    })

    const result = applyImportedResumeData(
      current,
      imported,
      ['contact', 'summary', 'education'],
      'replace'
    )

    expect(result.contact.fullName).toBe('Nama Impor')
    expect(result.contact.headline).toBe('Cloud Architect')
    expect(result.contact.usePhoto).toBe(true)
    expect(result.contact.photoUrl).toBe(current.contact.photoUrl)
    expect(result.summary).toBe('Ringkasan dari hasil impor.')
    expect(result.education).toHaveLength(0)
    expect(result.experiences).toHaveLength(1)
    expect(result.skills).toHaveLength(2)
  })

  it('tidak mengosongkan ringkasan saat merge dengan hasil impor kosong', () => {
    const current = makeData()
    const imported = makeData({ summary: '' })

    const result = applyImportedResumeData(current, imported, ['summary'], 'merge')

    expect(result.summary).toBe(current.summary)
  })

  it('mendukung undo impor dengan mengembalikan bagian terpilih dari snapshot', () => {
    const current = makeData()
    const imported = makeData({
      skills: [
        { id: 'skill-import-1', name: 'Docker', category: 'Tools' },
        { id: 'skill-import-2', name: 'Kubernetes', category: 'Tools' }
      ]
    })
    const sections: ImportSectionId[] = ['skills']
    const merged = applyImportedResumeData(current, imported, sections, 'merge')
    expect(merged.skills.map(item => item.name)).toContain('Kubernetes')

    const restored = applyImportedResumeData(merged, current, sections, 'replace')
    expect(restored.skills.map(item => item.name)).toEqual(['Python', 'Git'])
  })
})
