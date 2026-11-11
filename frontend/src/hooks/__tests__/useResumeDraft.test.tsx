import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useResumeDraft } from '../useResumeDraft'
import { ResumeStorage } from '../../services/storage'
import { createEmptyResumeData, type ResumeDraft } from '../../types/resume'
import * as draftApi from '../../services/draftApi'
import { type AuthUser } from '../../services/auth'

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

  it('menggunakan draftApi saat pengguna terautentikasi dan mengosongkan draf saat akun berganti', async () => {
    const userA: AuthUser = { id: 'user-a', email: 'a@example.com', name: 'User A' }
    const userB: AuthUser = { id: 'user-b', email: 'b@example.com', name: 'User B' }

    const listSpy = vi.spyOn(draftApi, 'listDraftsApi').mockResolvedValue([])
    const createSpy = vi.spyOn(draftApi, 'createDraftApi').mockImplementation(async d => ({
      ...d,
      expiresAt: Date.now() + 30 * 86400 * 1000
    }))

    const { result, rerender } = renderHook<
      ReturnType<typeof useResumeDraft>,
      { user: AuthUser | null }
    >(
      ({ user }) => useResumeDraft(undefined, user, true),
      { initialProps: { user: userA } }
    )

    await waitFor(() => expect(result.current.isLoadingDrafts).toBe(false))
    expect(listSpy).toHaveBeenCalled()

    // Buat draf untuk User A
    await act(async () => {
      await result.current.createNewDraft('CV User A')
    })

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'CV User A',
        ownerId: 'user-a'
      })
    )
    expect(result.current.draft?.title).toBe('CV User A')

    // Beralih ke User B -> draf aktif di-reset, list dimuat ulang
    rerender({ user: userB })

    await waitFor(() => {
      expect(result.current.draft).toBeNull()
    })

    // Logout (user null) -> draf tetap null, beralih ke penyimpanan anonim
    rerender({ user: null })
    await waitFor(() => {
      expect(result.current.draft).toBeNull()
    })

    listSpy.mockRestore()
    createSpy.mockRestore()
  })

  it('menyimpan di memori sesi saat mode privat aktif dan tidak memanggil API server', async () => {
    const user: AuthUser = { id: 'user-test', email: 'test@example.com', name: 'Test' }
    const createSpy = vi.spyOn(draftApi, 'createDraftApi')

    await ResumeStorage.setPrivateMode(true)

    const { result } = renderHook(() => useResumeDraft(undefined, user, true))
    await waitFor(() => expect(result.current.isLoadingDrafts).toBe(false))
    expect(result.current.privateMode).toBe(true)

    await act(async () => {
      await result.current.createNewDraft('CV Mode Privat')
    })

    // Tidak boleh memanggil API backend saat private mode
    expect(createSpy).not.toHaveBeenCalled()
    expect(result.current.draft?.title).toBe('CV Mode Privat')

    await ResumeStorage.setPrivateMode(false)
    createSpy.mockRestore()
  })
})
