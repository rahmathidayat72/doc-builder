import { useState, useEffect, useRef, useCallback } from 'react'
import {
  type ResumeDraft,
  type ResumeDraftSummary,
  type ResumeData,
  createEmptyResumeData
} from '../types/resume'
import { ResumeStorage } from '../services/storage'

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

export function useResumeDraft(initialDraftId?: string) {
  const [draft, setDraft] = useState<ResumeDraft | null>(null)
  const [draftsList, setDraftsList] = useState<ResumeDraftSummary[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [privateMode, setPrivateModeState] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(true)

  const autosaveTimerRef = useRef<any>(null)
  const pendingDraftRef = useRef<ResumeDraft | null>(null)

  // 1. Inisialisasi daftar draft dan status mode privat
  const refreshList = useCallback(async () => {
    try {
      const list = await ResumeStorage.listDrafts()
      setDraftsList(list)
      const pMode = await ResumeStorage.isPrivateMode()
      setPrivateModeState(pMode)
    } catch (err) {
      console.error('Gagal memuat daftar draft:', err)
    } finally {
      setIsLoadingDrafts(false)
    }
  }, [])

  useEffect(() => {
    refreshList()
  }, [refreshList])

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
      ResumeStorage.getDraft(initialDraftId).then(loaded => {
        if (loaded) {
          setDraft(loaded)
          pendingDraftRef.current = loaded
          setLastSaved(new Date(loaded.updatedAt))
        }
      })
    }
  }, [initialDraftId])

  // 3. Simpan segera
  const saveNow = useCallback(async (draftToSave?: ResumeDraft) => {
    const target = draftToSave || pendingDraftRef.current
    if (!target) return

    setIsSaving(true)
    try {
      const updated: ResumeDraft = {
        ...target,
        updatedAt: Date.now()
      }
      await ResumeStorage.saveDraft(updated)

      // Jangan menimpa draft aktif jika pengguna sudah berpindah draft
      // ketika proses penyimpanan masih berjalan.
      if (pendingDraftRef.current?.id === updated.id) {
        pendingDraftRef.current = updated
        setDraft(current =>
          !current || current.id === updated.id ? updated : current
        )
        setLastSaved(new Date(updated.updatedAt))
      }
      await refreshList()
    } catch (err) {
      console.error('Gagal menyimpan draft:', err)
    } finally {
      setIsSaving(false)
    }
  }, [refreshList])

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
      await ResumeStorage.saveDraft({ ...pending, updatedAt: Date.now() })
    } catch (err) {
      console.error('Gagal menyimpan perubahan sebelum berpindah draft:', err)
    }
  }, [cancelScheduledAutosave])

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
      version: 1,
      favorite: false
    }

    try {
      await ResumeStorage.saveDraft(newDraft)
    } catch (err) {
      console.error('Gagal menyimpan draft baru:', err)
    }

    setDraft(newDraft)
    pendingDraftRef.current = newDraft
    setLastSaved(new Date(now))
    await refreshList()
    return newDraft
  }, [flushPendingSave, refreshList])

  // 6a. Duplikasi draft dan langsung buka salinannya
  const duplicateDraft = useCallback(async (id: string) => {
    await flushPendingSave()
    const duplicated = await ResumeStorage.duplicateDraft(id)
    setDraft(duplicated)
    pendingDraftRef.current = duplicated
    setLastSaved(new Date(duplicated.updatedAt))
    await refreshList()
    return duplicated
  }, [flushPendingSave, refreshList])

  // 6b. Ganti nama draft tanpa mengubah data CV
  const renameDraft = useCallback(async (id: string, title: string) => {
    await ResumeStorage.renameDraft(id, title)
    const cleanTitle = title.trim()
    if (draft?.id === id) {
      const updated = { ...draft, title: cleanTitle, updatedAt: Date.now() }
      setDraft(updated)
      pendingDraftRef.current = updated
      setLastSaved(new Date(updated.updatedAt))
    }
    await refreshList()
  }, [draft, refreshList])

  // 6c. Tandai favorit agar draft penting tetap di atas daftar
  const toggleDraftFavorite = useCallback(async (id: string) => {
    const favorite = await ResumeStorage.toggleFavorite(id)
    if (draft?.id === id) {
      const updated = { ...draft, favorite }
      setDraft(updated)
      pendingDraftRef.current = updated
    }
    await refreshList()
  }, [draft, refreshList])

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

    await ResumeStorage.saveDraft(targeted)
    setDraft(targeted)
    pendingDraftRef.current = targeted
    setLastSaved(new Date(now))
    await refreshList()
    return targeted
  }, [draft, flushPendingSave, refreshList])

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

    // Pindahkan ke trash di storage
    await ResumeStorage.deleteDraft(id, true)
    await refreshList()

    if (draft?.id === id) {
      setDraft(null)
      pendingDraftRef.current = null
    }

    // Set timer pembatalan 10 detik
    const timerId = setTimeout(async () => {
      await ResumeStorage.purgeExpiredTrash(0)
      setPendingDelete(null)
    }, 10_000)

    setPendingDelete({ id, title, timerId })
  }, [draft, draftsList, cancelScheduledAutosave, refreshList])

  // 9. Batalkan penghapusan (Undo Delete)
  const undoDelete = useCallback(async () => {
    if (!pendingDelete) return

    clearTimeout(pendingDelete.timerId)
    const restored = await ResumeStorage.restoreDraft(pendingDelete.id)
    setPendingDelete(null)
    await refreshList()

    if (restored) {
      setDraft(restored)
      pendingDraftRef.current = restored
    }
  }, [pendingDelete, refreshList])

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
    loadDraft: async (id: string) => {
      try {
        await flushPendingSave()
        const d = await ResumeStorage.getDraft(id)
        if (d) {
          setDraft(d)
          pendingDraftRef.current = d
          setLastSaved(new Date(d.updatedAt))
        }
      } catch (err) {
        console.error('Gagal memuat draft:', err)
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
