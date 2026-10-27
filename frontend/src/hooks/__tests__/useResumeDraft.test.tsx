import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useResumeDraft } from '../useResumeDraft'
import { ResumeStorage } from '../../services/storage'
import { createEmptyResumeData, type ResumeDraft } from '../../types/resume'

const makeSourceDraft = (): ResumeDraft => ({
  id: '99999999-9999-4999-8999-999999999999',
  title: 'CV Sumber',
  templateId: 'ats-clean',
  colorTheme: '#1e293b',
  fontFamily: 'sans',
  resumeLanguage: 'id',
  data: {
    ...createEmptyResumeData(),
    contact: {
      fullName: 'Hadi Gunawan',
      headline: 'Backend Engineer',
      email: 'hadi@example.com',
      phone: '08123456789',
      location: 'Jakarta',
      linkedin: '',
      website: '',
      websites: []
    },
    summary: 'Backend engineer yang membangun layanan API berskala besar.',
    skills: [
      { id: 'skill-1', name: 'React', category: 'Technical' },
      { id: 'skill-2', name: 'FastAPI', category: 'Technical' },
      { id: 'skill-3', name: 'Python', category: 'Technical' }
    ]
  },
  createdAt: 1,
  updatedAt: 1,
  version: 1,
  favorite: true
})

describe('useResumeDraft targeted draft', () => {
  beforeEach(async () => {
    await ResumeStorage.clearAllData()
  })

  it('menduplikasi draft sumber, menyimpan targetJob, dan mengurutkan skill yang cocok', async () => {
    const source = makeSourceDraft()
    await ResumeStorage.saveDraft(source)

    const { result } = renderHook(() => useResumeDraft())

    await waitFor(() => expect(result.current.isLoadingDrafts).toBe(false))
    await act(async () => {
      await result.current.loadDraft(source.id)
    })
    await waitFor(() => expect(result.current.draft?.id).toBe(source.id))

    let targeted: ResumeDraft | undefined
    await act(async () => {
      targeted = await result.current.createTargetedDraft({
        title: 'Senior Backend Engineer',
        company: 'PT Maju',
        description: 'Membutuhkan Python dan FastAPI untuk layanan backend.',
        matchedSkills: ['python', 'fastapi']
      })
    })

    expect(targeted).toBeDefined()
    expect(targeted?.id).not.toBe(source.id)
    expect(targeted?.title).toBe('CV Target — Senior Backend Engineer di PT Maju')
    expect(targeted?.favorite).toBe(false)
    expect(targeted?.targetJob).toMatchObject({
      title: 'Senior Backend Engineer',
      company: 'PT Maju',
      matchedSkills: ['python', 'fastapi']
    })
    expect(targeted?.data.skills.map(skill => skill.name)).toEqual([
      'FastAPI',
      'Python',
      'React'
    ])

    const original = await ResumeStorage.getDraft(source.id)
    expect(original?.data.skills.map(skill => skill.name)).toEqual([
      'React',
      'FastAPI',
      'Python'
    ])
    expect(original?.targetJob).toBeUndefined()
    expect(await ResumeStorage.listDrafts()).toHaveLength(2)
  })
})
