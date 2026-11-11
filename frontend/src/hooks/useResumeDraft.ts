import { useState, useEffect, useRef, useCallback } from 'react'
import {
  type ResumeDraft,
  type ResumeDraftSummary,
  type ResumeData,
  createEmptyResumeData
} from '../types/resume'
import { ResumeStorage } from '../services/storage'
import {
  listDraftsApi,
  getDraftApi,
  createDraftApi,
  updateDraftApi,
  saveDraftApi,
  softDeleteDraftApi,
  restoreDraftApi,
  hardDeleteDraftApi
} from '../services/draftApi'
import { type AuthUser } from '../services/auth'

export interface PendingDelete {
  id: string
  title: string
  timerId: any
}

export interface TargetDraftInput {
  title: string
  company?: string
  description: string
  matchedSkills: string[]
}

export function useResumeDraft(
  initialDraftId?: string,
  currentUser?: AuthUser | null,
  authReady = true
) {
  const [draft, setDraft] = useState<ResumeDraft | null>(null)
  const [draftsList, setDraftsList] = useState<ResumeDraftSummary[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [privateMode, setPrivateModeState] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)

  const autosaveTimerRef = useRef<any>(null)
  const pendingDraftRef = useRef<ResumeDraft | null>(null)
  const currentUserIdRef = useRef<string | undefined>(currentUser?.id)

  // 1. Inisialisasi daftar draft dan status mode privat
  const refreshList = useCallback(async () => {
    try {
      const pMode = await ResumeStorage.isPrivateMode()
      setPrivateModeState(pMode)

      if (pMode) {
        const list = await ResumeStorage.listDrafts()
        setDraftsList(list)
      } else if (currentUser && authReady) {
        const list = await listDraftsApi()
        setDraftsList(list)
      } else {
        const list = await ResumeStorage.listDrafts('anonymous')
        setDraftsList(list)
      }
      setStorageError(null)
    } catch (err: any) {
      console.error('Gagal memuat daftar draft:', err)
      setStorageError(err.message || 'Gagal memuat daftar draf. Silakan coba lagi.')
    } finally {
      setIsLoadingDrafts(false)
    }
  }, [currentUser, authReady])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  // Saat akun berganti / login / logout: batalkan autosave tertunda, kosongkan draf aktif
  useEffect(() => {
    const prevId = currentUserIdRef.current
    const nextId = currentUser?.id

    if (prevId !== nextId) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      pendingDraftRef.current = null
      setDraft(null)
      currentUserIdRef.current = nextId
      refreshList()
    }
  }, [currentUser?.id, refreshList])

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [])

  // 2. Muat draft awal jika initialDraftId diberikan
  useEffect(() => {
    if (initialDraftId) {
      const fetchInitial = async () => {
        try {
          let loaded: ResumeDraft | null | undefined
          if (privateMode) {
            loaded = await ResumeStorage.getDraft(initialDraftId)
          } else if (currentUser && authReady) {
            loaded = await getDraftApi(initialDraftId)
          } else {
            loaded = await ResumeStorage.getDraft(initialDraftId, 'anonymous')
          }
          if (loaded) {
            setDraft(loaded)
            pendingDraftRef.current = loaded
            setLastSaved(new Date(loaded.updatedAt))
          }
        } catch {
          // ignore error on initial load
        }
      }
      fetchInitial()
    }
  }, [initialDraftId, privateMode, currentUser, authReady])

  // 3. Simpan segera
  const saveNow = useCallback(async (draftToSave?: ResumeDraft) => {
    const target = draftToSave || pendingDraftRef.current
    if (!target) return

    setIsSaving(true)
    try {
      const updated: ResumeDraft = {
        ...target,
        ownerId: currentUser?.id || 'anonymous',
        updatedAt: Date.now()
      }

      if (privateMode) {
        await ResumeStorage.saveDraft(updated)
      } else if (currentUser && authReady) {
        const saved = await saveDraftApi(updated)
        updated.expiresAt = saved.expiresAt
      } else {
        await ResumeStorage.saveDraft(updated, 'anonymous')
      }

      if (pendingDraftRef.current?.id === updated.id) {
        pendingDraftRef.current = updated
        setDraft(current =>
          !current || current.id === updated.id ? updated : current
        )
        setLastSaved(new Date(updated.updatedAt))
      }
      setStorageError(null)
      await refreshList()
    } catch (err: any) {
      console.error('Gagal menyimpan draft:', err)
      setStorageError(err.message || 'Gagal menyimpan draft ke basis data.')
    } finally {
      setIsSaving(false)
    }
  }, [privateMode, currentUser, authReady, refreshList])

  const cancelScheduledAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
  }, [])

  /**
   * Menyimpan perubahan yang masih tertunda ke storage sebelum berpindah
   * draft, agar data yang baru diketik tidak hilang atau menimpa draft lain.
   */
  const flushPendingSave = useCallback(async () => {
    cancelScheduledAutosave()
    const pending = pendingDraftRef.current
    if (!pending) return
    try {
      const updated: ResumeDraft = {
        ...pending,
        ownerId: currentUser?.id || 'anonymous',
        updatedAt: Date.now()
      }
      if (privateMode) {
        await ResumeStorage.saveDraft(updated)
      } else if (currentUser && authReady) {
        await saveDraftApi(updated)
      } else {
        await ResumeStorage.saveDraft(updated, 'anonymous')
      }
    } catch (err: any) {
      console.error('Gagal menyimpan perubahan sebelum berpindah draft:', err)
    }
  }, [cancelScheduledAutosave, privateMode, currentUser, authReady])

  // 4. Jadwalkan Autosave (Debounce 500ms)
  const scheduleAutosave = useCallback((updated: ResumeDraft) => {
    pendingDraftRef.current = updated
    setDraft(updated)

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      const latest = pendingDraftRef.current
      if (latest) saveNow(latest)
    }, 500)
  }, [saveNow])

  // 5. Buat draft baru
  const createNewDraft = useCallback(async (
    title = 'CV Tanpa Judul',
    templateId = 'ats-clean'
  ): Promise<ResumeDraft> => {
    await flushPendingSave()
    const now = Date.now()
    const newDraft: ResumeDraft = {
      id: crypto.randomUUID(),
      title,
      templateId,
      colorTheme: '#1e293b',
      fontFamily: 'sans',
      resumeLanguage: 'id',
      data: createEmptyResumeData(),
      createdAt: now,
      updatedAt: now,
      ownerId: currentUser?.id || 'anonymous',
      version: 1,
      favorite: false
    }

    try {
      if (privateMode) {
        await ResumeStorage.saveDraft(newDraft)
      } else if (currentUser && authReady) {
        const created = await createDraftApi(newDraft)
        newDraft.expiresAt = created.expiresAt
      } else {
        await ResumeStorage.saveDraft(newDraft, 'anonymous')
      }
      setStorageError(null)
    } catch (err: any) {
      console.error('Gagal menyimpan draft baru:', err)
      setStorageError(err.message || 'Gagal menyimpan draft baru.')
      throw err
    }

    setDraft(newDraft)
    pendingDraftRef.current = newDraft
    setLastSaved(new Date(now))
    await refreshList()
    return newDraft
  }, [flushPendingSave, privateMode, currentUser, authReady, refreshList])

  // 6a. Duplikasi draft dan langsung buka salinannya
  const duplicateDraft = useCallback(async (id: string) => {
    await flushPendingSave()
    let duplicated: ResumeDraft
    try {
      if (privateMode) {
        duplicated = await ResumeStorage.duplicateDraft(id)
      } else if (currentUser && authReady) {
        const original = await getDraftApi(id)
        if (!original) {
          throw new Error(`Draft dengan ID ${id} tidak ditemukan.`)
        }
        const now = Date.now()
        const copy: ResumeDraft = {
          ...original,
          id: crypto.randomUUID(),
          title: `${original.title} (Salinan)`,
          favorite: false,
          ownerId: currentUser.id,
          createdAt: now,
          updatedAt: now,
        }
        const saved = await createDraftApi(copy)
        copy.expiresAt = saved.expiresAt
        duplicated = copy
      } else {
        duplicated = await ResumeStorage.duplicateDraft(id, 'anonymous')
      }
      setStorageError(null)
    } catch (err: any) {
      console.error('Gagal menduplikasi draft:', err)
      setStorageError(err.message || 'Gagal menduplikasi draft.')
      throw err
    }

    setDraft(duplicated)
    pendingDraftRef.current = duplicated
    setLastSaved(new Date(duplicated.updatedAt))
    await refreshList()
    return duplicated
  }, [flushPendingSave, privateMode, currentUser, authReady, refreshList])

  // 6b. Ganti nama draft tanpa mengubah data CV
  const renameDraft = useCallback(async (id: string, title: string) => {
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      throw new Error('Judul draft tidak boleh kosong.')
    }

    try {
      if (privateMode) {
        await ResumeStorage.renameDraft(id, cleanTitle)
      } else if (currentUser && authReady) {
        const curr = (draft?.id === id ? draft : await getDraftApi(id))
        if (!curr) throw new Error(`Draft dengan ID ${id} tidak ditemukan.`)
        const updated: ResumeDraft = {
          ...curr,
          title: cleanTitle,
          updatedAt: Date.now()
        }
        const saved = await updateDraftApi(id, updated)
        updated.expiresAt = saved.expiresAt
      } else {
        await ResumeStorage.renameDraft(id, cleanTitle, 'anonymous')
      }
      setStorageError(null)
    } catch (err: any) {
      console.error('Gagal mengganti nama draft:', err)
      setStorageError(err.message || 'Gagal mengganti nama draft.')
      throw err
    }

    if (draft?.id === id) {
      const updated = { ...draft, title: cleanTitle, updatedAt: Date.now() }
      setDraft(updated)
      pendingDraftRef.current = updated
      setLastSaved(new Date(updated.updatedAt))
    }
    await refreshList()
  }, [draft, privateMode, currentUser, authReady, refreshList])

  // 6c. Tandai favorit agar draft penting tetap di atas daftar
  const toggleDraftFavorite = useCallback(async (id: string) => {
    let favorite = false
    try {
      if (privateMode) {
        favorite = await ResumeStorage.toggleFavorite(id)
      } else if (currentUser && authReady) {
        const curr = (draft?.id === id ? draft : await getDraftApi(id))
        if (!curr) throw new Error(`Draft dengan ID ${id} tidak ditemukan.`)
        favorite = !curr.favorite
        const updated = { ...curr, favorite }
        await updateDraftApi(id, updated)
      } else {
        favorite = await ResumeStorage.toggleFavorite(id, 'anonymous')
      }
      setStorageError(null)
    } catch (err: any) {
      console.error('Gagal mengubah status favorit:', err)
      setStorageError(err.message || 'Gagal mengubah status favorit.')
      throw err
    }

    if (draft?.id === id) {
      const updated = { ...draft, favorite }
      setDraft(updated)
      pendingDraftRef.current = updated
    }
    await refreshList()
  }, [draft, privateMode, currentUser, authReady, refreshList])

  // 6d. Buat draft target dari hasil job matching tanpa mengubah draft sumber
  const createTargetedDraft = useCallback(async (target: TargetDraftInput) => {
    if (!draft) throw new Error('Tidak ada draft aktif untuk dijadikan dasar CV target.')

    await flushPendingSave()
    const now = Date.now()
    const clonedData = JSON.parse(JSON.stringify(draft.data)) as ResumeData
    const matchedKeys = new Set(target.matchedSkills.map(skill => skill.toLowerCase()))
    clonedData.skills = [...clonedData.skills].sort((left, right) => {
      const leftMatched = matchedKeys.has(left.name.toLowerCase()) ? 1 : 0
      const rightMatched = matchedKeys.has(right.name.toLowerCase()) ? 1 : 0
      return rightMatched - leftMatched
    })

    const role = target.title.trim()
    const company = target.company?.trim()
    const title = `CV Target — ${role}${company ? ` di ${company}` : ''}`.slice(0, 140)

    const targeted: ResumeDraft = {
      ...draft,
      id: crypto.randomUUID(),
      title,
      data: clonedData,
      favorite: false,
      ownerId: currentUser?.id || 'anonymous',
      targetJob: {
        title: role,
        company: company || '',
        description: target.description,
        matchedSkills: target.matchedSkills,
        createdAt: now
      },
      createdAt: now,
      updatedAt: now,
      version: 1
    }

    try {
      if (privateMode) {
        await ResumeStorage.saveDraft(targeted)
      } else if (currentUser && authReady) {
        const saved = await createDraftApi(targeted)
        targeted.expiresAt = saved.expiresAt
      } else {
        await ResumeStorage.saveDraft(targeted, 'anonymous')
      }
      setStorageError(null)
    } catch (err: any) {
      console.error('Gagal menyimpan draft target:', err)
      setStorageError(err.message || 'Gagal menyimpan draft target.')
      throw err
    }

    setDraft(targeted)
    pendingDraftRef.current = targeted
    setLastSaved(new Date(now))
    await refreshList()
    return targeted
  }, [draft, flushPendingSave, privateMode, currentUser, authReady, refreshList])

  // 7. Mutasi data CV (memicu autosave ter-debounce)
  const updateData = useCallback((updater: (prev: ResumeData) => ResumeData) => {
    if (!draft) return
    const newData = updater(draft.data)
    const updatedDraft: ResumeDraft = {
      ...draft,
      data: newData,
      updatedAt: Date.now()
    }
    scheduleAutosave(updatedDraft)
  }, [draft, scheduleAutosave])

  // 7. Mutasi metadata draft (title, template, warna, bahasa)
  const updateMeta = useCallback((meta: Partial<Pick<ResumeDraft, 'title' | 'templateId' | 'colorTheme' | 'fontFamily' | 'resumeLanguage'>>) => {
    if (!draft) return
    const updatedDraft: ResumeDraft = {
      ...draft,
      ...meta,
      updatedAt: Date.now()
    }
    scheduleAutosave(updatedDraft)
  }, [draft, scheduleAutosave])

  // 8. Hapus draft dengan jendela pembatalan (Undo Window 10 Detik)
  const deleteWithUndo = useCallback(async (id: string) => {
    const target = draftsList.find(d => d.id === id) || (draft?.id === id ? draft : null)
    const title = target?.title || 'Draft'

    if (draft?.id === id) {
      cancelScheduledAutosave()
      pendingDraftRef.current = null
    }

    try {
      if (privateMode) {
        await ResumeStorage.deleteDraft(id, true)
      } else if (currentUser && authReady) {
        await softDeleteDraftApi(id)
      } else {
        await ResumeStorage.deleteDraft(id, true, 'anonymous')
      }
      setStorageError(null)
    } catch (err: any) {
      console.error('Gagal menghapus draft:', err)
      setStorageError(err.message || 'Gagal menghapus draft.')
    }

    await refreshList()

    if (draft?.id === id) {
      setDraft(null)
      pendingDraftRef.current = null
    }

    // Set timer pembatalan 10 detik
    const timerId = setTimeout(async () => {
      try {
        if (currentUser && !privateMode) {
          await hardDeleteDraftApi(id).catch(() => {})
        } else {
          await ResumeStorage.purgeExpiredTrash(0)
        }
      } catch {
        // cleanup error
      }
      setPendingDelete(null)
    }, 10_000)

    setPendingDelete({ id, title, timerId })
  }, [draft, draftsList, cancelScheduledAutosave, privateMode, currentUser, authReady, refreshList])

  // 9. Batalkan penghapusan (Undo Delete)
  const undoDelete = useCallback(async () => {
    if (!pendingDelete) return

    clearTimeout(pendingDelete.timerId)
    let restored: ResumeDraft | null | undefined
    try {
      if (privateMode) {
        restored = await ResumeStorage.restoreDraft(pendingDelete.id)
      } else if (currentUser && authReady) {
        restored = await restoreDraftApi(pendingDelete.id)
      } else {
        restored = await ResumeStorage.restoreDraft(pendingDelete.id, 'anonymous')
      }
      setStorageError(null)
    } catch (err: any) {
      console.error('Gagal memulihkan draft:', err)
      setStorageError(err.message || 'Gagal memulihkan draft.')
    }

    setPendingDelete(null)
    await refreshList()

    if (restored) {
      setDraft(restored)
      pendingDraftRef.current = restored
    }
  }, [pendingDelete, privateMode, currentUser, authReady, refreshList])

  // 10. Toggle Mode Privat
  const togglePrivateMode = useCallback(async (enabled: boolean) => {
    await ResumeStorage.setPrivateMode(enabled)
    setPrivateModeState(enabled)
    await refreshList()
  }, [refreshList])

  return {
    draft,
    draftsList,
    isSaving,
    lastSaved,
    privateMode,
    pendingDelete,
    isLoadingDrafts,
    storageError,
    loadDraft: async (id: string) => {
      try {
        setStorageError(null)
        await flushPendingSave()
        let d: ResumeDraft | null | undefined
        if (privateMode) {
          d = await ResumeStorage.getDraft(id)
        } else if (currentUser && authReady) {
          d = await getDraftApi(id)
        } else {
          d = await ResumeStorage.getDraft(id, 'anonymous')
        }

        if (d) {
          setDraft(d)
          pendingDraftRef.current = d
          setLastSaved(new Date(d.updatedAt))
        }
      } catch (err: any) {
        console.error('Gagal memuat draft:', err)
        setStorageError(err.message || 'Gagal memuat draf dari basis data. Silakan coba lagi.')
      }
    },
    createNewDraft,
    duplicateDraft,
    renameDraft,
    toggleDraftFavorite,
    createTargetedDraft,
    updateData,
    updateMeta,
    saveNow,
    deleteWithUndo,
    undoDelete,
    togglePrivateMode,
    refreshList
  }
}
