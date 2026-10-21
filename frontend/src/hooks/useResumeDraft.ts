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

export function useResumeDraft(initialDraftId?: string) {
  const [draft, setDraft] = useState<ResumeDraft | null>(null)
  const [draftsList, setDraftsList] = useState<ResumeDraftSummary[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [privateMode, setPrivateModeState] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

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
    }
  }, [])

  useEffect(() => {
    refreshList()
  }, [refreshList])

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
      setDraft(updated)
      pendingDraftRef.current = updated
      setLastSaved(new Date(updated.updatedAt))
      await refreshList()
    } catch (err) {
      console.error('Gagal menyimpan draft:', err)
    } finally {
      setIsSaving(false)
    }
  }, [refreshList])

  // 4. Jadwalkan Autosave (Debounce 500ms)
  const scheduleAutosave = useCallback((updated: ResumeDraft) => {
    pendingDraftRef.current = updated
    setDraft(updated)

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = setTimeout(() => {
      saveNow(updated)
    }, 500)
  }, [saveNow])

  // 5. Buat draft baru
  const createNewDraft = useCallback(async (
    title = 'CV Tanpa Judul',
    templateId = 'ats-clean'
  ): Promise<ResumeDraft> => {
    const now = Date.now()
    const newDraft: ResumeDraft = {
      id: crypto.randomUUID(),
      title,
      templateId,
      colorTheme: '#1e293b',
      fontFamily: 'sans',
      data: createEmptyResumeData(),
      createdAt: now,
      updatedAt: now,
      version: 1
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
  }, [refreshList])

  // 6. Mutasi data CV (memicu autosave ter-debounce)
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

  // 7. Mutasi metadata draft (title, template, warna)
  const updateMeta = useCallback((meta: Partial<Pick<ResumeDraft, 'title' | 'templateId' | 'colorTheme' | 'fontFamily'>>) => {
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
  }, [draft, draftsList, refreshList])

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
    loadDraft: async (id: string) => {
      try {
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
    updateData,
    updateMeta,
    saveNow,
    deleteWithUndo,
    undoDelete,
    togglePrivateMode,
    refreshList
  }
}
